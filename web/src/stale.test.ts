import { describe, expect, it } from 'vitest';
import { isStale } from './stale';

describe('isStale', () => {
  // 2026-09-25 is a Friday
  it('is false within 4 weekdays and true after', () => {
    expect(isStale('2026-09-25', new Date('2026-09-28T12:00:00Z'))).toBe(false); // 1 weekday
    expect(isStale('2026-09-25', new Date('2026-10-01T12:00:00Z'))).toBe(false); // 4 weekdays
    expect(isStale('2026-09-25', new Date('2026-10-02T12:00:00Z'))).toBe(true);  // 5 weekdays
  });
});
