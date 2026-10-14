import { minusMonths } from '../../pipeline/src/dates';
import type { Bar } from '../../pipeline/src/types';

export interface StockStats {
  high: number;
  low: number;
  avgVolume: number;
  from: string;
  to: string;
  /** history reaches back a full 12 months */
  fullYear: boolean;
}

export function stockStats(bars: Bar[], asOf: string): StockStats | null {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const start = minusMonths(asOf, 12);
  const window = sorted.filter((b) => b.date > start && b.date <= asOf);
  if (window.length === 0) return null;
  let high = -Infinity;
  let low = Infinity;
  let vol = 0;
  for (const b of window) {
    if (b.close > high) high = b.close;
    if (b.close < low) low = b.close;
    vol += b.volume;
  }
  return {
    high,
    low,
    avgVolume: Math.round(vol / window.length),
    from: window[0].date,
    to: window[window.length - 1].date,
    fullYear: sorted[0].date <= start,
  };
}

export type Range = '1M' | '3M' | '6M' | '1Y' | 'All';
export const RANGES: Range[] = ['1M', '3M', '6M', '1Y', 'All'];
const MONTHS: Record<Exclude<Range, 'All'>, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };

export function barsInRange(bars: Bar[], range: Range, asOf: string): Bar[] {
  if (range === 'All') return bars.filter((b) => b.date <= asOf);
  const start = minusMonths(asOf, MONTHS[range]);
  return bars.filter((b) => b.date >= start && b.date <= asOf);
}
