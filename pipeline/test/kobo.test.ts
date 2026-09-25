import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { fetchKobo, KOBO_URL, parseKoboSnapshot, ValidationError } from '../src/kobo.js';

const sample = () => JSON.parse(readFileSync(new URL('./fixtures/kobo-sample.json', import.meta.url), 'utf8'));

describe('parseKoboSnapshot', () => {
  it('maps the real response shape', () => {
    const s = parseKoboSnapshot(sample(), { minStocks: 1 });
    expect(s.tradeDate).toBe('2026-09-25');
    expect(s.stocks).toHaveLength(4);
    expect(s.stocks[0]).toEqual({
      symbol: 'MTNN', name: 'MTN Nigeria Communications Plc', close: 863, volume: 4002657,
      sector: 'ICT', board: 'Premium Board', marketCap: 18119168368889,
    });
    expect(s.market).toEqual({ asi: 252471.31, pctChange: 0.13, advancers: 34, decliners: 25, unchanged: 5, status: 'open' });
    expect(s.warnings).toEqual([]);
  });

  it('requires at least 100 valid stocks by default', () => {
    expect(() => parseKoboSnapshot(sample())).toThrow(ValidationError);
    expect(() => parseKoboSnapshot(sample())).toThrow(/Only 4 valid stocks/);
  });

  it('rejects a response without a stocks array', () => {
    expect(() => parseKoboSnapshot({ error: 'Unauthorized' }, { minStocks: 1 })).toThrow(ValidationError);
  });

  it('rejects a response without market status or trade date', () => {
    const j = sample();
    delete j.market;
    expect(() => parseKoboSnapshot(j, { minStocks: 1 })).toThrow(/market status/);
  });

  it('skips invalid symbols and prices with a warning', () => {
    const j = sample();
    j.stocks[0].symbol = '../etc';
    j.stocks[1].current_price = 0;
    j.stocks[2].current_price = 'n/a';
    const s = parseKoboSnapshot(j, { minStocks: 1 });
    expect(s.stocks.map((x) => x.symbol)).toEqual(['NB']);
    expect(s.warnings).toHaveLength(3);
  });

  it('skips a stock whose trade date differs from the market date', () => {
    const j = sample();
    j.stocks[3].trade_date = '2026-09-24T00:00:00';
    const s = parseKoboSnapshot(j, { minStocks: 1 });
    expect(s.stocks.map((x) => x.symbol)).not.toContain('NB');
    expect(s.warnings[0]).toMatch(/NB/);
  });
});

describe('fetchKobo', () => {
  it('sends the key in the X-API-Key header', async () => {
    let seen: { url: string; headers: Record<string, string> } | undefined;
    const fake = (async (url: string, init?: RequestInit) => {
      seen = { url, headers: init?.headers as Record<string, string> };
      return new Response('{"stocks":[]}', { status: 200, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch;
    await fetchKobo('secret-key', fake);
    expect(seen?.url).toBe(KOBO_URL);
    expect(seen?.headers['X-API-Key']).toBe('secret-key');
  });

  it('throws on HTTP errors without echoing the key', async () => {
    const fake = (async () => new Response('{}', { status: 401 })) as typeof fetch;
    await expect(fetchKobo('secret-key', fake)).rejects.toThrow('Kobo HTTP 401');
    await expect(fetchKobo('secret-key', fake)).rejects.not.toThrow(/secret-key/);
  });
});
