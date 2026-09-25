import { describe, expect, it } from 'vitest';
import { formatPct } from './format';

describe('formatPct', () => {
  it('signs, rounds, and shows a dash for missing values', () => {
    expect(formatPct(0.94)).toBe('+0.94%');
    expect(formatPct(-1.3)).toBe('-1.30%');
    expect(formatPct(0)).toBe('0.00%');
    expect(formatPct(null)).toBe('—');
    expect(formatPct(undefined)).toBe('—'); // period missing from an older summary.json
  });
});
