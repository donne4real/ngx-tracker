import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EodhdLimitError, EodhdUnavailableError } from '../src/eodhd.js';
import { ValidationError } from '../src/kobo.js';
import { runBackfillOnly, runDaily, type RunDeps } from '../src/run.js';
import { DataStore, formatHistory } from '../src/store.js';

const sample = JSON.parse(readFileSync(new URL('./fixtures/kobo-sample.json', import.meta.url), 'utf8'));
const kobo = (status = 'closed', date = '2026-09-25', asOf = `${date}T15:20:00.000Z`) => {
  const j = structuredClone(sample);
  j.as_of = asOf;
  j.market.market_status = status;
  j.market.trade_date = `${date}T00:00:00`;
  for (const s of j.stocks) s.trade_date = `${date}T00:00:00`;
  return j;
};
const eodRows = [
  { date: '2026-09-23', close: 850, volume: 1000 },
  { date: '2026-09-24', close: 855, volume: 900 },
];
const DAY1 = '2026-09-25';
const DAY2 = '2026-09-28';

let dir: string;
let eodCalls: string[];
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ngx-'));
  eodCalls = [];
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const deps = (over: Partial<RunDeps> = {}): RunDeps => ({
  fetchKobo: async () => kobo(),
  fetchEodhd: async (symbol) => {
    eodCalls.push(symbol);
    return eodRows;
  },
  store: new DataStore(dir),
  now: () => new Date('2026-09-25T16:00:00Z'),
  minStocks: 1,
  ...over,
});
const on = (date: string, over: Partial<RunDeps> = {}) => deps({ fetchKobo: async () => kobo('closed', date), ...over });
const readJson = async (rel: string) => JSON.parse(await readFile(join(dir, rel), 'utf8'));

describe('runDaily', () => {
  it('writes nothing while the market is open', async () => {
    const r = await runDaily(deps({ fetchKobo: async () => kobo('open') }));
    expect(r.outcome).toBe('market-open');
    expect(await readdir(dir)).toEqual([]);
    expect(eodCalls).toEqual([]);
  });

  it('writes nothing unless Kobo explicitly says closed', async () => {
    for (const status of ['pre-open', 'Open', 'halted', 'unknown']) {
      const r = await runDaily(deps({ fetchKobo: async () => kobo(status) }));
      expect(r.outcome).toBe('market-open');
    }
    expect(await readdir(dir)).toEqual([]);
  });

  it('writes nothing when the snapshot was taken before the NGX close', async () => {
    const r = await runDaily(deps({ fetchKobo: async () => kobo('closed', '2026-09-25', '2026-09-25T11:00:00.000Z') }));
    expect(r.outcome).toBe('not-final');
    expect(await readdir(dir)).toEqual([]);
    expect(eodCalls).toEqual([]);
  });

  it('throws and writes nothing for an invalid response', async () => {
    await expect(runDaily(deps({ fetchKobo: async () => ({ stocks: [] }) }))).rejects.toBeInstanceOf(ValidationError);
    expect(await readdir(dir)).toEqual([]);
  });

  it("appends on a stock's first day but waits a day to backfill (EODHD lags)", async () => {
    const r = await runDaily(on(DAY1));
    expect(r.outcome).toBe('appended');
    expect(eodCalls).toEqual([]);
    expect((await readJson('history/MTNN.json')).bars.map((b: { date: string }) => b.date)).toEqual([DAY1]);
    expect((await readJson('stocks.json')).stocks.every((s: { backfill: string }) => s.backfill === 'pending')).toBe(true);
    expect((await readJson('summary.json')).asOf).toBe(DAY1);
  });

  it('backfills on the next day and writes every file', async () => {
    await runDaily(on(DAY1));
    const r = await runDaily(on(DAY2));
    expect(r.outcome).toBe('appended');
    expect(r.backfill.ok).toHaveLength(4);
    const hist = await readJson('history/MTNN.json');
    expect(hist.bars.map((b: { date: string }) => b.date)).toEqual(['2026-09-23', '2026-09-24', DAY1, DAY2]);
    const summary = await readJson('summary.json');
    expect(summary.asOf).toBe(DAY2);
    const stocks = await readJson('stocks.json');
    expect(stocks.stocks.every((s: { backfill: string }) => s.backfill === 'done')).toBe(true);
    expect((await readJson('report.json')).outcome).toBe('appended');
  });

  it('backfills at most the per-run limit, largest market cap first', async () => {
    await runDaily(on(DAY1));
    await runDaily(on(DAY2, { backfillPerRun: 2 }));
    expect(eodCalls).toEqual(['MTNN', 'DANGCEM']);
  });

  it('stops backfilling at the EODHD limit without failing the run', async () => {
    await runDaily(on(DAY1));
    const limited = { fetchEodhd: async () => { throw new EodhdLimitError('EODHD daily limit reached (HTTP 429)'); } };
    const r = await runDaily(on(DAY2, limited));
    expect(r.outcome).toBe('appended');
    expect(r.backfill.stoppedEarly).toMatch(/limit/);
    const stocks = await readJson('stocks.json');
    expect(stocks.stocks.every((s: { backfill: string; backfillAttempts: number }) => s.backfill === 'pending' && s.backfillAttempts === 0)).toBe(true);
  });

  it('pauses backfilling without using up retries when EODHD rejects the key', async () => {
    await runDaily(on(DAY1));
    const rejected = { fetchEodhd: async () => { throw new EodhdUnavailableError('EODHD rejected the API key (HTTP 401)'); } };
    const r = await runDaily(on(DAY2, rejected));
    expect(r.outcome).toBe('appended');
    expect(r.backfill.stoppedEarly).toMatch(/401/);
    expect(r.backfill.failed).toEqual([]);
    const stocks = await readJson('stocks.json');
    expect(stocks.stocks.every((s: { backfill: string; backfillAttempts: number }) => s.backfill === 'pending' && s.backfillAttempts === 0)).toBe(true);
  });

  it('does nothing on a second run for the same trade date', async () => {
    await runDaily(on(DAY1));
    await runDaily(on(DAY2));
    const before = await readFile(join(dir, 'history/MTNN.json'), 'utf8');
    eodCalls = [];
    const r = await runDaily(on(DAY2));
    expect(r.outcome).toBe('duplicate-date');
    expect(eodCalls).toEqual([]);
    expect(await readFile(join(dir, 'history/MTNN.json'), 'utf8')).toBe(before);
  });

  it('marks a backfill failed after 3 unsuccessful attempts', async () => {
    const empty = { fetchEodhd: async () => [] };
    for (const date of [DAY1, DAY2, '2026-09-29', '2026-09-30']) {
      await runDaily(on(date, empty));
    }
    const stocks = await readJson('stocks.json');
    expect(stocks.stocks.every((s: { backfill: string }) => s.backfill === 'failed')).toBe(true);
    expect((await readJson('report.json')).backfill.failed[0].error).toMatch(/no prices/);
  });
});

describe('runBackfillOnly (weekend history run)', () => {
  const weekend = (iso: string, over: Partial<RunDeps> = {}) => deps({
    fetchKobo: async () => { throw new Error('Kobo must not be called on a history-only run'); },
    now: () => new Date(iso),
    ...over,
  });

  it("backfills stocks first seen on an earlier day without touching today's prices", async () => {
    await runDaily(on(DAY1)); // Friday
    const summaryBefore = await readJson('summary.json');
    const r = await runBackfillOnly(weekend('2026-09-26T12:00:00Z')); // Saturday
    expect(r.outcome).toBe('backfill-only');
    expect(r.tradeDate).toBe(DAY1);
    expect(eodCalls.sort()).toEqual(['DANGCEM', 'MTNN', 'NB', 'STERLINGNG']);
    expect((await readJson('history/MTNN.json')).bars.map((b: { date: string }) => b.date)).toEqual(['2026-09-23', '2026-09-24', DAY1]);
    const summary = await readJson('summary.json');
    expect(summary.asOf).toBe(DAY1);
    expect(summary.market).toEqual(summaryBefore.market);
    expect(summary.stocks.find((s: { symbol: string }) => s.symbol === 'MTNN').changes.day).toBe(0.94);
    expect((await readJson('stocks.json')).stocks.every((s: { backfill: string }) => s.backfill === 'done')).toBe(true);
  });

  it('does nothing on the same day a stock was first seen', async () => {
    await runDaily(on(DAY1));
    const before = await readFile(join(dir, 'history/MTNN.json'), 'utf8');
    const r = await runBackfillOnly(weekend('2026-09-25T20:00:00Z'));
    expect(r.backfill.ok).toEqual([]);
    expect(eodCalls).toEqual([]);
    expect(await readFile(join(dir, 'history/MTNN.json'), 'utf8')).toBe(before);
  });

  it('does nothing before tracking has started', async () => {
    const r = await runBackfillOnly(weekend('2026-09-26T12:00:00Z'));
    expect(r.outcome).toBe('backfill-only');
    expect(eodCalls).toEqual([]);
    expect(await readdir(dir)).toEqual([]);
  });

  it('respects the per-run limit', async () => {
    await runDaily(on(DAY1));
    await runBackfillOnly(weekend('2026-09-26T12:00:00Z', { backfillPerRun: 1 }));
    expect(eodCalls).toEqual(['MTNN']);
  });
});

describe('formatHistory', () => {
  it('writes one bar per line so git diffs show only new rows', () => {
    const text = formatHistory({
      symbol: 'X',
      bars: [
        { date: '2026-09-24', close: 1, volume: 1, traded: true, source: 'kobo' },
        { date: '2026-09-25', close: 2, volume: 1, traded: true, source: 'kobo' },
      ],
    });
    expect(text.split('\n').filter((l) => l.includes('"date"'))).toHaveLength(2);
    expect(JSON.parse(text).bars).toHaveLength(2);
  });
});
