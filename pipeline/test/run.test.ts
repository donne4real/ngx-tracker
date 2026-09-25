import { readFileSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EodhdLimitError } from '../src/eodhd.js';
import { ValidationError } from '../src/kobo.js';
import { runDaily, type RunDeps } from '../src/run.js';
import { DataStore, formatHistory } from '../src/store.js';

const sample = JSON.parse(readFileSync(new URL('./fixtures/kobo-sample.json', import.meta.url), 'utf8'));
const kobo = (status = 'closed', date = '2026-09-25') => {
  const j = structuredClone(sample);
  j.market.market_status = status;
  j.market.trade_date = `${date}T00:00:00`;
  for (const s of j.stocks) s.trade_date = `${date}T00:00:00`;
  return j;
};
const eodRows = [
  { date: '2026-09-23', close: 850, volume: 1000 },
  { date: '2026-09-24', close: 855, volume: 900 },
];

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
const readJson = async (rel: string) => JSON.parse(await readFile(join(dir, rel), 'utf8'));

describe('runDaily', () => {
  it('writes nothing while the market is open', async () => {
    const r = await runDaily(deps({ fetchKobo: async () => kobo('open') }));
    expect(r.outcome).toBe('market-open');
    expect(await readdir(dir)).toEqual([]);
    expect(eodCalls).toEqual([]);
  });

  it('throws and writes nothing for an invalid response', async () => {
    await expect(runDaily(deps({ fetchKobo: async () => ({ stocks: [] }) }))).rejects.toBeInstanceOf(ValidationError);
    expect(await readdir(dir)).toEqual([]);
  });

  it('appends, backfills and writes every file on the first run', async () => {
    const r = await runDaily(deps());
    expect(r.outcome).toBe('appended');
    expect(r.backfill.ok).toHaveLength(4);
    const hist = await readJson('history/MTNN.json');
    expect(hist.bars.map((b: { date: string }) => b.date)).toEqual(['2026-09-23', '2026-09-24', '2026-09-25']);
    const summary = await readJson('summary.json');
    expect(summary.asOf).toBe('2026-09-25');
    expect(summary.stocks.find((s: { symbol: string }) => s.symbol === 'MTNN').changes.day).toBe(0.94);
    const stocks = await readJson('stocks.json');
    expect(stocks.stocks.every((s: { backfill: string }) => s.backfill === 'done')).toBe(true);
    expect((await readJson('report.json')).outcome).toBe('appended');
  });

  it('backfills at most the per-run limit, largest market cap first', async () => {
    await runDaily(deps({ backfillPerRun: 2 }));
    expect(eodCalls).toEqual(['MTNN', 'DANGCEM']);
  });

  it('stops backfilling at the EODHD limit without failing the run', async () => {
    const r = await runDaily(deps({ fetchEodhd: async () => { throw new EodhdLimitError('EODHD daily limit reached (HTTP 429)'); } }));
    expect(r.outcome).toBe('appended');
    expect(r.backfill.stoppedEarly).toMatch(/limit/);
    const stocks = await readJson('stocks.json');
    expect(stocks.stocks.every((s: { backfill: string }) => s.backfill === 'pending')).toBe(true);
  });

  it('does nothing on a second run for the same trade date', async () => {
    await runDaily(deps());
    const before = await readFile(join(dir, 'history/MTNN.json'), 'utf8');
    eodCalls = [];
    const r = await runDaily(deps());
    expect(r.outcome).toBe('duplicate-date');
    expect(eodCalls).toEqual([]);
    expect(await readFile(join(dir, 'history/MTNN.json'), 'utf8')).toBe(before);
  });

  it('marks a backfill failed after 3 unsuccessful attempts', async () => {
    const empty = deps({ fetchEodhd: async () => [] });
    for (const date of ['2026-09-25', '2026-09-28', '2026-09-29']) {
      await runDaily({ ...empty, fetchKobo: async () => kobo('closed', date) });
    }
    const stocks = await readJson('stocks.json');
    expect(stocks.stocks.every((s: { backfill: string }) => s.backfill === 'failed')).toBe(true);
    expect((await readJson('report.json')).backfill.failed[0].error).toMatch(/no prices/);
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
