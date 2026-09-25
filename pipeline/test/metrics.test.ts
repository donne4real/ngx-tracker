import { describe, expect, it } from 'vitest';
import { buildSummary, closeOnOrBefore, computeChanges, MOVERS_COUNT } from '../src/metrics.js';
import type { Bar, History, MarketInfo, StockMeta, StocksFile } from '../src/types.js';

const bars = (rows: Array<[string, number, number?]>): Bar[] =>
  rows.map(([date, close, volume = 100]) => ({ date, close, volume, traded: volume > 0, source: 'kobo' }));

const meta = (symbol: string, status: 'active' | 'inactive' = 'active'): StockMeta => ({
  symbol, name: `${symbol} Plc`, sector: 'ICT', board: 'Main Board', marketCap: 1, status,
  missingDays: 0, firstKoboDate: '2026-09-01', backfill: 'done', backfillAttempts: 0,
});
const market: MarketInfo = { asi: 1, pctChange: 0, advancers: 1, decliners: 1, unchanged: 0, status: 'closed' };

describe('computeChanges', () => {
  it('day change compares with the previous stored day, rounded to 2 dp', () => {
    expect(computeChanges(bars([['2026-09-24', 855], ['2026-09-25', 863]])).day).toBe(0.94);
  });

  it('is null when history is too short', () => {
    expect(computeChanges(bars([['2026-09-25', 863]]))).toEqual({ day: null, week: null, month: null });
    expect(computeChanges(bars([['2026-09-24', 855], ['2026-09-25', 863]])).week).toBeNull();
    expect(computeChanges([])).toEqual({ day: null, week: null, month: null });
  });

  it('week change uses the last close on or before 7 days earlier (holiday in between)', () => {
    // latest Wed 2026-09-23; target 2026-09-16 was a holiday -> use Tue 2026-09-15
    const b = bars([['2026-09-15', 100], ['2026-09-17', 110], ['2026-09-23', 121]]);
    expect(computeChanges(b).week).toBe(21);
  });

  it('month change clamps Mar 31 to Feb 28', () => {
    const b = bars([['2026-02-27', 100], ['2026-03-02', 150], ['2026-03-31', 120]]);
    expect(computeChanges(b).month).toBe(20);
  });
});

describe('closeOnOrBefore', () => {
  it('returns undefined before history starts', () => {
    expect(closeOnOrBefore(bars([['2026-09-25', 1]]), '2026-09-24')).toBeUndefined();
    expect(closeOnOrBefore(bars([['2026-09-24', 1], ['2026-09-25', 2]]), '2026-09-24')?.close).toBe(1);
  });
});

describe('buildSummary', () => {
  const asOf = '2026-09-25';
  const setup = () => {
    const file: StocksFile = {
      lastTradeDate: asOf,
      stocks: [meta('A'), meta('B'), meta('C'), meta('D', 'inactive'), meta('E'), meta('F')],
    };
    const h = new Map<string, History>([
      ['A', { symbol: 'A', bars: bars([['2026-09-24', 100], [asOf, 105]]) }],            // +5, traded
      ['B', { symbol: 'B', bars: bars([['2026-09-24', 100], [asOf, 50]]) }],             // −50, bonus-like
      ['C', { symbol: 'C', bars: bars([['2026-09-24', 100], [asOf, 103, 0]]) }],         // +3, didn't trade
      ['D', { symbol: 'D', bars: bars([['2026-09-24', 100], [asOf, 108]]) }],            // inactive
      ['E', { symbol: 'E', bars: bars([['2026-09-23', 100], ['2026-09-24', 109]]) }],    // no bar today
      ['F', { symbol: 'F', bars: bars([[asOf, 10]]) }],                                  // no history
    ]);
    return buildSummary(file, h, market, asOf, '2026-09-25T16:00:00.000Z');
  };

  it('excludes untraded, inactive, stale and null stocks from movers', () => {
    const s = setup();
    expect(s.movers.day.gainers.map((r) => r.symbol)).toEqual(['A']);
    expect(s.movers.day.losers.map((r) => r.symbol)).toEqual(['B']);
  });

  it("reports how many traded stocks each horizon's movers are based on", () => {
    const s = setup();
    // traded active stocks today: A, B, F. F has no previous bar yet.
    expect(s.coverage.day).toEqual({ eligible: 2, total: 3 });
    expect(s.coverage.week).toEqual({ eligible: 0, total: 3 });
  });

  it('flags moves beyond ±10% but still lists them', () => {
    const s = setup();
    expect(s.movers.day.losers[0]).toMatchObject({ symbol: 'B', change: -50, largeMove: true });
    expect(s.stocks.find((r) => r.symbol === 'A')!.largeMove).toBe(false);
  });

  it('keeps every stock in the table with its status and trading flag', () => {
    const s = setup();
    expect(s.stocks.map((r) => r.symbol)).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
    expect(s.stocks.find((r) => r.symbol === 'D')!.status).toBe('inactive');
    expect(s.stocks.find((r) => r.symbol === 'C')!.traded).toBe(false);
    expect(s.stocks.find((r) => r.symbol === 'E')!.traded).toBe(false);
    expect(s.stocks.find((r) => r.symbol === 'E')!.lastDate).toBe('2026-09-24');
    expect(s.market.noTrade).toBe(2); // C and E (active, not traded today)
    expect(s.asOf).toBe(asOf);
  });

  it(`caps movers at ${MOVERS_COUNT}, sorted by change then symbol`, () => {
    const file: StocksFile = { lastTradeDate: asOf, stocks: [] };
    const h = new Map<string, History>();
    for (let i = 0; i < 12; i++) {
      const sym = `S${String(i).padStart(2, '0')}`;
      file.stocks.push(meta(sym));
      h.set(sym, { symbol: sym, bars: bars([['2026-09-24', 100], [asOf, 100 + (i % 6) + 1]]) });
    }
    const s = buildSummary(file, h, market, asOf, 'x');
    expect(s.movers.day.gainers).toHaveLength(MOVERS_COUNT);
    expect(s.movers.day.gainers.slice(0, 2).map((r) => r.symbol)).toEqual(['S05', 'S11']);
  });
});
