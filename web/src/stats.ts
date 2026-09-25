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
  const start = minusMonths(asOf, 12);
  const window = bars.filter((b) => b.date > start && b.date <= asOf);
  if (window.length === 0) return null;
  const closes = window.map((b) => b.close);
  return {
    high: Math.max(...closes),
    low: Math.min(...closes),
    avgVolume: Math.round(window.reduce((s, b) => s + b.volume, 0) / window.length),
    from: window[0].date,
    to: window[window.length - 1].date,
    fullYear: bars[0].date <= start,
  };
}

export type Range = '1M' | '3M' | '6M' | '1Y' | 'All';
export const RANGES: Range[] = ['1M', '3M', '6M', '1Y', 'All'];
const MONTHS: Record<Exclude<Range, 'All'>, number> = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 };

export function barsInRange(bars: Bar[], range: Range, asOf: string): Bar[] {
  if (range === 'All') return bars;
  const start = minusMonths(asOf, MONTHS[range]);
  return bars.filter((b) => b.date >= start);
}
