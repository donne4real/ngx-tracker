import { describe, expect, it } from 'vitest';
import { loadHistory, loadSummary } from './api';

const json = (body: unknown, status = 200) =>
  (async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
const html = (async () => new Response('<!doctype html><html></html>', { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch;

describe('loadHistory', () => {
  it('returns the history for a tracked stock', async () => {
    const h = await loadHistory('MTNN', json({ symbol: 'MTNN', bars: [] }));
    expect(h?.symbol).toBe('MTNN');
  });
  it('returns null for a 404', async () => {
    expect(await loadHistory('NOPE', json({}, 404))).toBeNull();
  });
  it("returns null when the host serves its HTML page instead of JSON (Cloudflare's fallback)", async () => {
    expect(await loadHistory('NOPE', html)).toBeNull();
  });
  it('rejects symbols with unexpected characters without fetching', async () => {
    let called = false;
    const spy = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
    expect(await loadHistory('../stocks', spy)).toBeNull();
    expect(called).toBe(false);
  });
});

describe('loadSummary', () => {
  it('throws a readable error when the summary is missing', async () => {
    await expect(loadSummary(html)).rejects.toThrow(/summary/i);
  });
});
