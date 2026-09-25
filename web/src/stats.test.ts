import { describe, expect, it } from 'vitest';
import type { Bar } from '../../pipeline/src/types';
import { barsInRange, stockStats } from './stats';

const b = (date: string, close: number, volume = 10): Bar => ({ date, close, volume, traded: volume > 0, source: 'kobo' });

describe('stockStats', () => {
  it('uses the last 12 months and reports whether a full year is covered', () => {
    const bars = [b('2025-09-01', 999), b('2025-09-26', 100, 20), b('2026-03-01', 150, 40), b('2026-09-25', 120, 0)];
    expect(stockStats(bars, '2026-09-25')).toEqual({ high: 150, low: 100, avgVolume: 20, from: '2025-09-26', to: '2026-09-25', fullYear: true });
  });
  it('labels short histories as partial', () => {
    expect(stockStats([b('2026-09-25', 10)], '2026-09-25')).toMatchObject({ high: 10, low: 10, fullYear: false, from: '2026-09-25' });
  });
  it('is null without bars', () => {
    expect(stockStats([], '2026-09-25')).toBeNull();
  });
});

describe('barsInRange', () => {
  it('keeps bars from the range start, or everything for All', () => {
    const bars = [b('2026-06-24', 1), b('2026-08-25', 2), b('2026-09-25', 3)];
    expect(barsInRange(bars, '1M', '2026-09-25').map((x) => x.close)).toEqual([2, 3]);
    expect(barsInRange(bars, 'All', '2026-09-25')).toHaveLength(3);
  });
});
