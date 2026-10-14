import { describe, expect, it } from 'vitest';
import { appendSnapshot, INACTIVE_AFTER, isNewTradeDate } from '../src/merge.js';
import type { History, Snapshot, StocksFile } from '../src/types.js';

const snap = (tradeDate: string, rows: Array<[string, number, number]>): Snapshot => ({
  tradeDate,
  asOf: tradeDate + 'T15:20:00Z',
  stocks: rows.map(([symbol, close, volume]) => ({
    symbol, name: `${symbol} Plc`, close, volume, sector: 'ICT', board: 'Main Board', marketCap: 100,
  })),
  market: { asi: 1, pctChange: 0, advancers: 0, decliners: 0, unchanged: 0, status: 'closed' },
  warnings: [],
});
const empty = (): StocksFile => ({ lastTradeDate: null, stocks: [] });
const meta = (f: StocksFile, s: string) => f.stocks.find((x) => x.symbol === s)!;

describe('appendSnapshot', () => {
  it('adds new stocks with their first Kobo date and a pending backfill', () => {
    const h = new Map<string, History>();
    const f = appendSnapshot(empty(), h, snap('2026-09-25', [['MTNN', 863, 4002657], ['STERLINGNG', 7.7, 0]]));
    expect(f.lastTradeDate).toBe('2026-09-25');
    expect(f.stocks.map((s) => s.symbol)).toEqual(['MTNN', 'STERLINGNG']);
    expect(meta(f, 'MTNN')).toMatchObject({
      status: 'active', missingDays: 0, firstKoboDate: '2026-09-25', backfill: 'pending', backfillAttempts: 0,
    });
    expect(h.get('MTNN')!.bars).toEqual([{ date: '2026-09-25', close: 863, volume: 4002657, traded: true, source: 'kobo' }]);
    expect(h.get('STERLINGNG')!.bars[0].traded).toBe(false);
  });

  it('appends later days in date order and keeps the first Kobo date', () => {
    const h = new Map<string, History>();
    let f = appendSnapshot(empty(), h, snap('2026-09-25', [['MTNN', 863, 1]]));
    f = appendSnapshot(f, h, snap('2026-09-28', [['MTNN', 870, 1]]));
    expect(h.get('MTNN')!.bars.map((b) => b.date)).toEqual(['2026-09-25', '2026-09-28']);
    expect(meta(f, 'MTNN').firstKoboDate).toBe('2026-09-25');
    expect(f.lastTradeDate).toBe('2026-09-28');
  });

  it('overwrites the same date with a correction and warns', () => {
    const h = new Map<string, History>();
    const s1 = snap('2026-09-25', [['MTNN', 863, 1]]);
    let f = appendSnapshot(empty(), h, s1);
    const s2 = snap('2026-09-25', [['MTNN', 999, 1]]);
    f = appendSnapshot(f, h, s2);
    expect(h.get('MTNN')!.bars).toHaveLength(1);
    expect(h.get('MTNN')!.bars[0].close).toBe(999);
    expect(s2.warnings.join(' ')).toMatch(/Corrected MTNN/);
  });

  it(`marks a stock inactive after ${INACTIVE_AFTER} missing days and reactivates it`, () => {
    const h = new Map<string, History>();
    let f = appendSnapshot(empty(), h, snap('2026-09-01', [['AAA', 1, 1], ['BBB', 1, 1]]));
    for (let i = 0; i < INACTIVE_AFTER - 1; i++) {
      f = appendSnapshot(f, h, snap(`2026-09-${String(2 + i).padStart(2, '0')}`, [['AAA', 1, 1]]));
    }
    expect(meta(f, 'BBB')).toMatchObject({ status: 'active', missingDays: INACTIVE_AFTER - 1 });
    f = appendSnapshot(f, h, snap('2026-09-20', [['AAA', 1, 1]]));
    expect(meta(f, 'BBB').status).toBe('inactive');
    f = appendSnapshot(f, h, snap('2026-09-21', [['AAA', 1, 1], ['BBB', 2, 5]]));
    expect(meta(f, 'BBB')).toMatchObject({ status: 'active', missingDays: 0, firstKoboDate: '2026-09-01' });
  });
});

describe('isNewTradeDate', () => {
  it('is true only for a date after the last stored one', () => {
    expect(isNewTradeDate({ lastTradeDate: null, stocks: [] }, '2026-09-25')).toBe(true);
    expect(isNewTradeDate({ lastTradeDate: '2026-09-25', stocks: [] }, '2026-09-25')).toBe(false);
    expect(isNewTradeDate({ lastTradeDate: '2026-09-25', stocks: [] }, '2026-09-24')).toBe(false);
    expect(isNewTradeDate({ lastTradeDate: '2026-09-25', stocks: [] }, '2026-09-28')).toBe(true);
  });
});
