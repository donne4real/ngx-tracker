import type { History, Summary } from '../../pipeline/src/types';

const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.]*$/;
const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('json');

export async function loadSummary(fetchImpl: typeof fetch = fetch): Promise<Summary> {
  const r = await fetchImpl('data/summary.json', { cache: 'no-cache' });
  if (!r.ok || !isJson(r)) throw new Error('Price summary is not available yet');
  return (await r.json()) as Summary;
}

/** null = not tracked (unknown symbol, 404, or the host's HTML fallback page). */
export async function loadHistory(symbol: string, fetchImpl: typeof fetch = fetch): Promise<History | null> {
  if (!SYMBOL_RE.test(symbol)) return null;
  const r = await fetchImpl(`data/history/${symbol}.json`, { cache: 'no-cache' });
  if (r.status === 404 || (r.ok && !isJson(r))) return null;
  if (!r.ok) throw new Error(`Couldn't load price history (HTTP ${r.status})`);
  return (await r.json()) as History;
}
