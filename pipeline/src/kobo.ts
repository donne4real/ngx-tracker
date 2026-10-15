import { toISODate } from './dates.js';
import type { DividendHistory, DividendRecord, KoboStock, Snapshot } from './types.js';

export const KOBO_URL = 'https://koboterminal.com/api/ngxdata/stocks';
const SYMBOL_RE = /^[A-Z0-9][A-Z0-9.]*$/;

export class ValidationError extends Error {
  override name = 'ValidationError';
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, fallback: number) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  // Kobo sometimes sends numerics as strings: coerce finite values, warn otherwise.
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return fallback;
};
/** Nullable numeric snapshot extra (previous_close, change_percent, …): null when absent. */
const numOrNull = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);
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
    if (!isObj(s) || typeof s.symbol !== 'string' || !SYMBOL_RE.test(s.symbol.trim())) {
      warnings.push(`Skipped a stock with an invalid symbol: ${JSON.stringify(isObj(s) ? s.symbol : s)}`);
      continue;
    }
    const symbol = (s.symbol as string).trim();
    if (typeof s.current_price !== 'number' || !Number.isFinite(s.current_price) || s.current_price <= 0) {
      warnings.push(`Skipped ${symbol}: no valid current_price`);
      continue;
    }
    const own = isoOrNull(s.trade_date);
    if (s.trade_date !== undefined && own === null) {
      warnings.push(`Skipped ${symbol}: unparseable trade_date ${JSON.stringify(s.trade_date)}`);
      continue;
    }
    if (own !== null && own !== tradeDate) {
      warnings.push(`Skipped ${symbol}: trade date ${own} differs from market date ${tradeDate}`);
      continue;
    }
    if (typeof s.volume === 'number' && s.volume < 0) warnings.push(`${symbol}: negative volume coerced to 0`);
    if (s.market_cap !== undefined && typeof s.market_cap !== 'number') warnings.push(`${symbol}: non-numeric market_cap coerced`);
    stocks.push({
      symbol,
      name: str(s.name, symbol),
      close: s.current_price,
      volume: Math.max(0, num(s.volume, 0)),
      sector: str(s.sector, 'Unclassified'),
      board: str(s.market, ''),
      marketCap: num(s.market_cap, 0),
      prevClose: numOrNull(s.previous_close),
      changePct: numOrNull(s.official_change_percent ?? s.change_percent),
      change7d: numOrNull(s.pct_change_7d),
      sharesOutstanding: Math.max(0, num(s.shares_outstanding, 0)),
    });
  }
  if (stocks.length < minStocks) {
    throw new ValidationError(`Only ${stocks.length} valid stocks in the Kobo response (need at least ${minStocks})`);
  }
  const asOf = typeof json.as_of === 'string' ? json.as_of : typeof m.updated_at === 'string' ? m.updated_at : null;
  return {
    tradeDate,
    asOf,
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

/** NGX's official close is 14:30 WAT = 13:30 UTC. */
export const NGX_CLOSE_UTC = 'T13:30:00Z';

/** A snapshot is final only if Kobo took it after the close of its own trade date. */
export function isFinalSnapshot(snap: Snapshot): boolean {
  if (!snap.asOf) return false;
  const taken = Date.parse(snap.asOf);
  return Number.isFinite(taken) && taken >= Date.parse(snap.tradeDate + NGX_CLOSE_UTC);
}

export async function fetchKobo(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl(KOBO_URL, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kobo HTTP ${res.status}`);
  return res.json();
}

const DIV_URL = 'https://koboterminal.com/api/ngxdata/dividends';

function dividendKind(text: unknown): string | null {
  if (typeof text !== 'string') return null;
  const t = text.toLowerCase();
  if (t.includes('special')) return 'special';
  if (t.includes('interim')) return 'interim';
  if (t.includes('final')) return 'final';
  return null;
}

/** Parse one /dividends/:symbol response into a DividendHistory (drops unusable rows). */
export function parseDividends(symbol: string, json: unknown, fetchedAt: string): DividendHistory {
  if (!isObj(json) || !Array.isArray(json.history)) {
    throw new ValidationError(`Kobo dividends for ${symbol}: no history array`);
  }
  const records: DividendRecord[] = [];
  for (const r of json.history) {
    if (!isObj(r) || typeof r.ex_dividend_date !== 'string') continue;
    let exDate: string;
    try {
      exDate = toISODate(r.ex_dividend_date);
    } catch {
      continue;
    }
    const dps = typeof r.dividend_per_share === 'number' && Number.isFinite(r.dividend_per_share) && r.dividend_per_share > 0
      ? r.dividend_per_share
      : null;
    if (dps === null) continue;
    let recordDate: string | null = null;
    let payDate: string | null = null;
    try {
      recordDate = typeof r.record_date === 'string' ? toISODate(r.record_date) : null;
    } catch {
      recordDate = null;
    }
    try {
      payDate = typeof r.pay_date === 'string' ? toISODate(r.pay_date) : null;
    } catch {
      payDate = null;
    }
    records.push({ exDate, recordDate, payDate, dps, kind: dividendKind(r.raw_declared_text) });
  }
  records.sort((a, b) => (a.exDate < b.exDate ? -1 : a.exDate > b.exDate ? 1 : 0));
  let latestExDate: string | null = null;
  try {
    latestExDate = typeof json.latest_ex_dividend_date === 'string' ? toISODate(json.latest_ex_dividend_date) : records.at(-1)?.exDate ?? null;
  } catch {
    latestExDate = records.at(-1)?.exDate ?? null;
  }
  return { symbol, fetchedAt, latestExDate, records };
}

export async function fetchDividends(symbol: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<unknown> {
  const res = await fetchImpl(`${DIV_URL}/${encodeURIComponent(symbol)}`, { headers: { 'X-API-Key': apiKey, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Kobo dividends HTTP ${res.status} for ${symbol}`);
  return res.json();
}

/** Sum of cash DPS with ex-date in (asOf − 12 months, asOf]. */
export function trailingDps(records: DividendRecord[], asOf: string): number | null {
  if (records.length === 0) return null;
  const y = Number(asOf.slice(0, 4));
  const start = `${y - 1}${asOf.slice(4)}`;
  let sum = 0;
  let n = 0;
  for (const r of records) {
    if (r.exDate > start && r.exDate <= asOf) {
      sum += r.dps;
      n++;
    }
  }
  return n > 0 ? Math.round(sum * 100) / 100 : null;
}
