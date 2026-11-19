import { weekdaysAfter } from '../../pipeline/src/dates';

export const STALE_AFTER_WEEKDAYS = 4;

export function isStale(asOf: string, today: Date): boolean {
  // NGX trade dates are Lagos days: compute "today" in Africa/Lagos to avoid
  // an off-by-one near midnight WAT (UTC+1).
  const lagosToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
  return weekdaysAfter(asOf, lagosToday) > STALE_AFTER_WEEKDAYS;
}

/** True when a stock's last bar is older than the summary's as-of date (ISO date strings compare lexicographically). */
export function isRowStale(lastDate: string, asOf: string): boolean {
  return lastDate < asOf;
}
