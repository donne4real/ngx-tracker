import { weekdaysAfter } from '../../pipeline/src/dates';

export const STALE_AFTER_WEEKDAYS = 4;

export function isStale(asOf: string, today: Date): boolean {
  return weekdaysAfter(asOf, today.toISOString().slice(0, 10)) > STALE_AFTER_WEEKDAYS;
}
