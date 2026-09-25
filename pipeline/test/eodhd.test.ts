import { describe, expect, it } from 'vitest';
import { EodhdLimitError, fetchEodhd, parseEodhd } from '../src/eodhd.js';

const respond = (status: number, body: unknown) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

describe('parseEodhd', () => {
  it('uses the unadjusted close and drops unusable rows', () => {
    const rows = [
      { date: '2025-09-25', open: 1, high: 1, low: 1, close: 850, adjusted_close: 840, volume: 10 },
      { date: '2025-09-26', close: 0, volume: 0 },
      { close: 5 },
      { date: '2025-09-29', close: 851 },
    ];
    expect(parseEodhd(rows)).toEqual([
      { date: '2025-09-25', close: 850, volume: 10, traded: true, source: 'eodhd' },
      { date: '2025-09-29', close: 851, volume: 0, traded: false, source: 'eodhd' },
    ]);
  });

  it('rejects a non-list response', () => {
    expect(() => parseEodhd({ error: 'Invalid symbol' })).toThrow(/not a list/);
  });
});

describe('fetchEodhd', () => {
  it('requests SYMBOL.XNSA for the date range', async () => {
    let url = '';
    const fake = (async (u: string) => {
      url = u;
      return new Response('[]', { status: 200 });
    }) as unknown as typeof fetch;
    await fetchEodhd('MTNN', '2025-09-18', '2026-09-24', 'secret-key', fake);
    expect(url.startsWith('https://eodhd.com/api/eod/MTNN.XNSA?')).toBe(true);
    expect(url).toContain('from=2025-09-18');
    expect(url).toContain('to=2026-09-24');
  });

  it('turns HTTP 429 into EodhdLimitError', async () => {
    await expect(fetchEodhd('MTNN', 'a', 'b', 'k', respond(429, {}))).rejects.toBeInstanceOf(EodhdLimitError);
  });

  it('reports other HTTP errors without the key', async () => {
    const p = fetchEodhd('MTNN', 'a', 'b', 'secret-key', respond(500, {}));
    await expect(p).rejects.toThrow('EODHD HTTP 500');
    await expect(fetchEodhd('MTNN', 'a', 'b', 'secret-key', respond(500, {}))).rejects.not.toThrow(/secret-key/);
  });
});
