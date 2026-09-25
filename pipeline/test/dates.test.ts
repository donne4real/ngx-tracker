import { describe, expect, it } from 'vitest';
import { addDays, minusMonths, toISODate, weekdaysAfter } from '../src/dates.js';

describe('toISODate', () => {
  it('takes the date part of an ISO timestamp', () => {
    expect(toISODate('2026-09-25T00:00:00')).toBe('2026-09-25');
    expect(toISODate('2026-09-25')).toBe('2026-09-25');
  });
  it('rejects non-ISO text', () => {
    expect(() => toISODate('Sep 25 2026')).toThrow(/Not an ISO date/);
  });
});

describe('addDays', () => {
  it('crosses month and leap-year boundaries', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2026-09-25', 7)).toBe('2026-10-02');
  });
});

describe('minusMonths', () => {
  it('clamps to the last day of a shorter month', () => {
    expect(minusMonths('2026-03-31', 1)).toBe('2026-02-28');
    expect(minusMonths('2024-03-31', 1)).toBe('2024-02-29');
  });
  it('crosses year boundaries', () => {
    expect(minusMonths('2026-01-15', 1)).toBe('2025-12-15');
    expect(minusMonths('2026-09-25', 12)).toBe('2025-09-25');
  });
});

describe('weekdaysAfter', () => {
  // 2026-09-25 is a Friday
  it('counts Mon–Fri days after `from`, up to and including `to`', () => {
    expect(weekdaysAfter('2026-09-25', '2026-09-25')).toBe(0);
    expect(weekdaysAfter('2026-09-25', '2026-09-27')).toBe(0); // weekend only
    expect(weekdaysAfter('2026-09-25', '2026-09-28')).toBe(1); // Monday
    expect(weekdaysAfter('2026-09-25', '2026-10-01')).toBe(4);
  });
});
