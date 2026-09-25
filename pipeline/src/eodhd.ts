import { toISODate } from './dates.js';
import type { Bar } from './types.js';

export class EodhdLimitError extends Error {
  override name = 'EodhdLimitError';
}

type Row = { date?: unknown; close?: unknown; volume?: unknown };

export function parseEodhd(json: unknown): Bar[] {
  if (!Array.isArray(json)) throw new Error('EODHD response is not a list');
  const out: Bar[] = [];
  for (const r of json as Row[]) {
    if (!r || typeof r.date !== 'string' || typeof r.close !== 'number' || !(r.close > 0)) continue;
    let date: string;
    try {
      date = toISODate(r.date);
    } catch {
      continue;
    }
    const volume = typeof r.volume === 'number' && r.volume > 0 ? r.volume : 0;
    out.push({ date, close: r.close, volume, traded: volume > 0, source: 'eodhd' });
  }
  return out;
}

/** Error messages never include the URL, because the URL carries the API key. */
export async function fetchEodhd(
  symbol: string,
  from: string,
  to: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const url =
    `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}.XNSA` +
    `?period=d&fmt=json&from=${from}&to=${to}&api_token=${encodeURIComponent(apiKey)}`;
  const res = await fetchImpl(url);
  if (res.status === 429 || res.status === 402) {
    throw new EodhdLimitError(`EODHD daily limit reached (HTTP ${res.status})`);
  }
  if (!res.ok) throw new Error(`EODHD HTTP ${res.status}`);
  return res.json();
}
