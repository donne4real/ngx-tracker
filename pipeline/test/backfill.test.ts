import { describe, expect, it } from 'vitest';
import { backfillRange, mergeBackfill, pickBackfills } from '../src/backfill.js';
import type { Bar, StockMeta } from '../src/types.js';

const meta = (symbol: string, marketCap: number, over: Partial<StockMeta> = {}): StockMeta => ({
  symbol, name: symbol, sector: 'X', board: 'Main Board', marketCap, status: 'active', missingDays: 0,
  firstKoboDate: '2026-09-25', backfill: 'pending', backfillAttempts: 0, ...over,
});
const bar = (date: string, close: number, source: Bar['source']): Bar => ({ date, close, volume: 1, traded: true, source });

describe('pickBackfills', () => {
  it('picks pending active stocks, largest market cap first, up to the limit', () => {
    const file = {
      lastTradeDate: '2026-09-25',
      stocks: [
        meta('SMALL', 1),
        meta('BIG', 100),
        meta('MID', 50),
        meta('DONE', 999, { backfill: 'done' }),
        meta('FAILED', 998, { backfill: 'failed' }),
        meta('GONE', 997, { status: 'inactive' }),
        meta('NEW', 996, { firstKoboDate: null }),
      ],
    };
    expect(pickBackfills(file, 2).map((s) => s.symbol)).toEqual(['BIG', 'MID']);
    expect(pickBackfills(file).map((s) => s.symbol)).toEqual(['BIG', 'MID', 'SMALL']);
  });
});

describe('backfillRange', () => {
  it('covers a year plus a week before the first Kobo day', () => {
    expect(backfillRange('2026-09-25')).toEqual({ from: '2025-09-18', to: '2026-09-24' });
  });
});

describe('mergeBackfill', () => {
  it('adds only dates before the first Kobo day, in order', () => {
    const h = { symbol: 'MTNN', bars: [bar('2026-09-25', 863, 'kobo')] };
    const eod = [bar('2026-09-23', 850, 'eodhd'), bar('2026-09-24', 855, 'eodhd'), bar('2026-09-25', 1, 'eodhd')];
    const out = mergeBackfill(h, eod, '2026-09-25');
    expect(out.bars.map((b) => [b.date, b.close, b.source])).toEqual([
      ['2026-09-23', 850, 'eodhd'],
      ['2026-09-24', 855, 'eodhd'],
      ['2026-09-25', 863, 'kobo'],
    ]);
  });
});
