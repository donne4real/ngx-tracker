import { toISODate } from './dates.js';
import type { Bar } from './types.js';

export class EodhdLimitError extends Error {
  override name = 'EodhdLimitError';
}

/** The key was rejected or EODHD can't be reached: pause the whole backfill, not one stock. */
export class EodhdUnavailableError extends Error {
  override name = 'EodhdUnavailableError';
}

type Row = { date?: unknown; close?: unknown; volume?: unknown };

export function parseEodhd(json: unknown): Bar[] {
  return parseEodhdWithStats(json).bars;
}

/** Same as parseEodhd, but also reports how many rows were dropped. */
export function parseEodhdWithStats(json: unknown): { bars: Bar[]; dropped: number } {
  if (!Array.isArray(json)) throw new Error('EODHD response is not a list');
  const out: Bar[] = [];
  let dropped = 0;
  for (const r of json as Row[]) {
    if (!r || typeof r.date !== 'string' || typeof r.close !== 'number' || !(r.close > 0)) {
      dropped++;
      continue;
    }
    let date: string;
    try {
      date = toISODate(r.date);
    } catch {
      dropped++;
      continue;
    }
    const volume = typeof r.volume === 'number' && r.volume > 0 ? r.volume : 0;
    out.push({ date, close: r.close, volume, traded: volume > 0, source: 'eodhd' });
  }
  return { bars: out, dropped };
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
  let res: Response;
  try {
    res = await fetchImpl(url);
  } catch {
    throw new EodhdUnavailableError('EODHD could not be reached');
  }
  if (res.status === 401 || res.status === 403) {
    throw new EodhdUnavailableError(`EODHD rejected the API key (HTTP ${res.status})`);
  }
  if (res.status >= 500) throw new EodhdUnavailableError(`EODHD is unavailable (HTTP ${res.status})`);
  if (res.status === 429 || res.status === 402) {
    throw new EodhdLimitError(`EODHD daily limit reached (HTTP ${res.status})`);
  }
  if (!res.ok) {
    let snippet = '';
    try {
      snippet = `: ${(await res.text()).slice(0, 120)}`;
    } catch {
      // ignore body read errors
    }
    throw new Error(`EODHD HTTP ${res.status}${snippet}`);
  }
  return res.json();
}
