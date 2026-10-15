import type { DividendHistory, History, Summary } from '../../pipeline/src/types';

const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.\-]*$/;
const isJson = (r: Response) => (r.headers.get('content-type') ?? '').includes('json');

function isValidSummary(j: unknown): j is Summary {
  return (
    typeof j === 'object' && j !== null && typeof (j as Summary).asOf === 'string' && Array.isArray((j as Summary).stocks)
  );
}

function isValidHistory(j: unknown): j is History {
  return typeof j === 'object' && j !== null && typeof (j as History).symbol === 'string' && Array.isArray((j as History).bars);
}

const historyCache = new Map<string, History>();
const dividendsCache = new Map<string, DividendHistory>();

export async function loadSummary(fetchImpl: typeof fetch = fetch): Promise<Summary> {
  const r = await fetchImpl('data/summary.json', { cache: 'no-cache' });
  if (!r.ok || !isJson(r)) throw new Error('Price summary is not available yet');
  const j: unknown = await r.json();
  if (!isValidSummary(j)) throw new Error('Price summary is corrupt: expected { asOf, stocks[] }');
  return j;
}

/** null = not tracked (unknown symbol, 404, or the host's HTML fallback page). */
export async function loadHistory(symbol: string, fetchImpl: typeof fetch = fetch): Promise<History | null> {
  if (!SYMBOL_RE.test(symbol) || /^\.+$/.test(symbol.replace(/[-]/g, ''))) return null;
  const cached = historyCache.get(symbol);
  if (cached) return cached;
  const r = await fetchImpl(`data/history/${encodeURIComponent(symbol)}.json`, { cache: 'no-cache' });
  if (r.status === 404 || (r.ok && !isJson(r))) return null;
  if (!r.ok) throw new Error(`Couldn't load price history (HTTP ${r.status})`);
  const j: unknown = await r.json();
  if (!isValidHistory(j)) throw new Error(`Price history for ${symbol} is corrupt`);
  historyCache.set(symbol, j);
  return j;
}

/** null = no dividend file yet (batch hasn't reached this stock, or it pays none). */
export async function loadDividends(symbol: string, fetchImpl: typeof fetch = fetch): Promise<DividendHistory | null> {
  if (!SYMBOL_RE.test(symbol) || /^\.+$/.test(symbol.replace(/[-]/g, ''))) return null;
  const cached = dividendsCache.get(symbol);
  if (cached) return cached;
  const r = await fetchImpl(`data/dividends/${encodeURIComponent(symbol)}.json`, { cache: 'no-cache' });
  if (r.status === 404 || (r.ok && !isJson(r))) return null;
  if (!r.ok) throw new Error(`Couldn't load dividends (HTTP ${r.status})`);
  const j: unknown = await r.json();
  if (typeof j !== 'object' || j === null || !Array.isArray((j as DividendHistory).records)) {
    throw new Error(`Dividends for ${symbol} are corrupt`);
  }
  dividendsCache.set(symbol, j as DividendHistory);
  return j as DividendHistory;
}
