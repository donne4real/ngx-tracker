import { toISODate } from './dates.js';
import type { KoboStock, Snapshot } from './types.js';

export const KOBO_URL = 'https://koboterminal.com/api/ngxdata/stocks';
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.]*$/;

export class ValidationError extends Error {
  override name = 'ValidationError';
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback: string) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback);

function isoOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    return toISODate(v);
  } catch {
    return null;
  }
}

export function parseKoboSnapshot(json: unknown, { minStocks = 100 }: { minStocks?: number } = {}): Snapshot {
  if (!isObj(json) || !Array.isArray(json.stocks)) {
    throw new ValidationError('Kobo response has no stocks array');
  }
  const m = json.market;
  const tradeDate = isObj(m) ? isoOrNull(m.trade_date) : null;
  if (!isObj(m) || typeof m.market_status !== 'string' || tradeDate === null) {
    throw new ValidationError('Kobo response has no market status or trade date');
  }

  const warnings: string[] = [];
  const stocks: KoboStock[] = [];
  for (const s of json.stocks) {
    if (!isObj(s) || typeof s.symbol !== 'string' || !SYMBOL_RE.test(s.symbol)) {
      warnings.push(`Skipped a stock with an invalid symbol: ${JSON.stringify(isObj(s) ? s.symbol : s)}`);
      continue;
    }
    if (typeof s.current_price !== 'number' || !Number.isFinite(s.current_price) || s.current_price <= 0) {
      warnings.push(`Skipped ${s.symbol}: no valid current_price`);
      continue;
    }
    const own = isoOrNull(s.trade_date);
    if (own !== null && own !== tradeDate) {
      warnings.push(`Skipped ${s.symbol}: trade date ${own} differs from market date ${tradeDate}`);
      continue;
    }
    stocks.push({
      symbol: s.symbol,
      name: str(s.name, s.symbol),
      close: s.current_price,
      volume: Math.max(0, num(s.volume, 0)),
      sector: str(s.sector, 'Unclassified'),
      board: str(s.market, ''),
      marketCap: num(s.market_cap, 0),
    });
  }
  if (stocks.length < minStocks) {
    throw new ValidationError(`Only ${stocks.length} valid stocks in the Kobo response (need at least ${minStocks})`);
  }
  return {
    tradeDate,
    stocks,
    market: {
      asi: num(m.asi, 0),
      pctChange: num(m.pct_change, 0),
      advancers: num(m.advancers, 0),
      decliners: num(m.decliners, 0),
      unchanged: num(m.unchanged, 0),
      status: m.market_status,
    },
    warnings,
  };
}

export async function fetchKobo(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl(KOBO_URL, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kobo HTTP ${res.status}`);
  return res.json();
}
