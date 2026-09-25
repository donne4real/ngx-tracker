import { describe, expect, it } from 'vitest';
import { EodhdLimitError, EodhdUnavailableError, fetchEodhd, parseEodhd } from '../src/eodhd.js';

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

  it('treats a rejected key, a server error or no connection as EODHD being unavailable', async () => {
    await expect(fetchEodhd('MTNN', 'a', 'b', 'k', respond(401, {}))).rejects.toBeInstanceOf(EodhdUnavailableError);
    await expect(fetchEodhd('MTNN', 'a', 'b', 'k', respond(403, {}))).rejects.toBeInstanceOf(EodhdUnavailableError);
    await expect(fetchEodhd('MTNN', 'a', 'b', 'k', respond(503, {}))).rejects.toBeInstanceOf(EodhdUnavailableError);
    const offline = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    await expect(fetchEodhd('MTNN', 'a', 'b', 'k', offline)).rejects.toBeInstanceOf(EodhdUnavailableError);
  });

  it('keeps an unknown symbol (404) as a per-stock failure', async () => {
    const p = fetchEodhd('MTNN', 'a', 'b', 'k', respond(404, {}));
    await expect(p).rejects.not.toBeInstanceOf(EodhdUnavailableError);
  });

  it('reports other HTTP errors without the key', async () => {
    const p = fetchEodhd('MTNN', 'a', 'b', 'secret-key', respond(418, {}));
    await expect(p).rejects.toThrow('EODHD HTTP 418');
    await expect(fetchEodhd('MTNN', 'a', 'b', 'secret-key', respond(418, {}))).rejects.not.toThrow(/secret-key/);
    await expect(fetchEodhd('MTNN', 'a', 'b', 'secret-key', respond(401, {}))).rejects.not.toThrow(/secret-key/);
  });
});
