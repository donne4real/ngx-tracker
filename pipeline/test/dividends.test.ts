import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseDividends, trailingDps } from '../src/kobo.js';
import { pickDividends, runDaily, type RunDeps } from '../src/run.js';
import { DataStore } from '../src/store.js';
import type { DividendRecord, StockMeta, StocksFile } from '../src/types.js';

const divPayload = () => ({
  success: true,
  symbol: 'GTCO',
  latest_ex_dividend_date: '2026-10-12T00:00:00',
  history: [
    { ex_dividend_date: '2026-10-12T00:00:00', record_date: '2026-10-12T00:00:00', pay_date: '2026-10-20T00:00:00', dividend_per_share: 1, raw_declared_text: 'Interim dividend H1 2026' },
    { ex_dividend_date: '2026-04-15T00:00:00', record_date: null, pay_date: '2026-04-24T00:00:00', dividend_per_share: 2.5, raw_declared_text: 'Final dividend FY 2025' },
    { ex_dividend_date: 'not-a-date', dividend_per_share: 9 },
    { ex_dividend_date: '2025-01-01T00:00:00', dividend_per_share: 0 },
  ],
});

const rec = (exDate: string, dps: number): DividendRecord => ({ exDate, recordDate: null, payDate: null, dps, kind: null });

describe('parseDividends', () => {
  it('keeps usable rows sorted, labels interim/final, drops bad rows', () => {
    const d = parseDividends('GTCO', divPayload(), '2026-10-14');
    expect(d.symbol).toBe('GTCO');
    expect(d.latestExDate).toBe('2026-10-12');
    expect(d.records).toHaveLength(2);
    expect(d.records[0]).toMatchObject({ exDate: '2026-04-15', dps: 2.5, kind: 'final' });
    expect(d.records[1]).toMatchObject({ exDate: '2026-10-12', dps: 1, kind: 'interim' });
  });

  it('falls back to the last record when the header date is missing', () => {
    const p = divPayload() as Record<string, unknown>;
    delete p.latest_ex_dividend_date;
    expect(parseDividends('GTCO', p, '2026-10-14').latestExDate).toBe('2026-10-12');
  });
});

describe('trailingDps', () => {
  const records = [rec('2025-10-20', 1), rec('2026-04-15', 2.5), rec('2026-10-12', 1)];
  it('sums ex-dates within the 12 months before asOf', () => {
    expect(trailingDps(records, '2026-10-14')).toBe(4.5);
  });
  it('is null with no records in window', () => {
    expect(trailingDps([], '2026-10-14')).toBeNull();
    expect(trailingDps([rec('2020-01-01', 5)], '2026-10-14')).toBeNull();
  });
});

describe('pickDividends', () => {
  const meta = (symbol: string, dividendsAt: string | null = null, status: 'active' | 'inactive' = 'active'): StockMeta => ({
    symbol, name: symbol, sector: 'S', board: 'B', marketCap: 1, status, missingDays: 0,
    firstKoboDate: '2026-09-25', backfill: 'done', backfillAttempts: 0, dividendsAt,
  });
  it('takes never-fetched first, then oldest, skips fresh and inactive', () => {
    const file: StocksFile = {
      lastTradeDate: '2026-10-14',
      stocks: [
        meta('FRESH', '2026-10-10'),
        meta('OLD', '2026-08-01'),
        meta('NEVER'),
        meta('OFF', null, 'inactive'),
      ],
    };
    expect(pickDividends(file, 10, '2026-10-14').map((s) => s.symbol)).toEqual(['NEVER', 'OLD']);
    expect(pickDividends(file, 1, '2026-10-14').map((s) => s.symbol)).toEqual(['NEVER']);
  });
});

describe('runDaily dividends', () => {
  let dir: string;
  beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'ngx-div-')); });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  const koboDay1 = () => ({
    stocks: [
      { symbol: 'MTNN', name: 'MTN', current_price: 100, volume: 10, sector: 'ICT', market: 'Main', market_cap: 100, shares_outstanding: 50, trade_date: '2026-09-25T00:00:00' },
    ],
    total: 1,
    as_of: '2026-09-25T15:20:00.000Z',
    market: { market_status: 'closed', trade_date: '2026-09-25T00:00:00', asi: 1, pct_change: 0, advancers: 0, decliners: 0, unchanged: 0 },
  });

  const deps = (over: Partial<RunDeps> = {}): RunDeps => ({
    fetchKobo: async () => koboDay1(),
    fetchEodhd: async () => [],
    fetchDividends: async () => divPayload(),
    store: new DataStore(dir),
    now: () => new Date('2026-09-25T16:00:00Z'),
    minStocks: 1,
    dividendsPerRun: 10,
    ...over,
  });

  it('writes dividend files and yield into the summary', async () => {
    const r = await runDaily(deps());
    expect(r.dividends.ok).toEqual(['MTNN']);
    const d = JSON.parse(await readFile(join(dir, 'dividends/MTNN.json'), 'utf8'));
    expect(d.records).toHaveLength(2);
    const summary = JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8'));
    const row = summary.stocks.find((s: { symbol: string }) => s.symbol === 'MTNN');
    // Only the 2026-04-15 record is within 12m of 2026-09-25.
    expect(row.ttmDps).toBe(2.5);
    expect(row.divYield).toBe(2.5);
    const stocks = JSON.parse(await readFile(join(dir, 'stocks.json'), 'utf8'));
    expect(stocks.stocks[0].dividendsAt).toBe('2026-09-25');
    expect(stocks.stocks[0].sharesOutstanding).toBe(50);
  });

  it('skips gracefully without a fetcher and leaves yields null', async () => {
    const { fetchDividends: _omit, ...rest } = deps();
    const r = await runDaily(rest);
    expect(r.dividends).toEqual({ ok: [], failed: [] });
    const summary = JSON.parse(await readFile(join(dir, 'summary.json'), 'utf8'));
    expect(summary.stocks[0].ttmDps).toBeNull();
    expect(summary.stocks[0].divYield).toBeNull();
  });
});
