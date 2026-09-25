import { addDays, minusMonths } from './dates.js';
import type { Bar, History, StockMeta, StocksFile } from './types.js';

export const BACKFILL_PER_RUN = 18;
export const MAX_BACKFILL_ATTEMPTS = 3;

/**
 * Stocks first seen on `tradeDate` wait a day: EODHD usually doesn't have the
 * previous trading day yet, and a backfill marked done would miss it for good.
 */
export function pickBackfills(file: StocksFile, limit = BACKFILL_PER_RUN, tradeDate?: string): StockMeta[] {
  return file.stocks
    .filter((s) => s.status === 'active' && s.backfill === 'pending' && s.firstKoboDate !== null)
    .filter((s) => tradeDate === undefined || (s.firstKoboDate as string) < tradeDate)
    .sort((a, b) => b.marketCap - a.marketCap || a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

export function backfillRange(firstKoboDate: string): { from: string; to: string } {
  return { from: addDays(minusMonths(firstKoboDate, 12), -7), to: addDays(firstKoboDate, -1) };
}

/** EODHD fills only the dates before the first Kobo day, so the two sources never overlap. */
export function mergeBackfill(h: History, eodBars: Bar[], firstKoboDate: string): History {
  const earliest = h.bars[0]?.date ?? firstKoboDate;
  const cutoff = earliest < firstKoboDate ? earliest : firstKoboDate;
  const have = new Set(h.bars.map((b) => b.date));
  const added = eodBars.filter((b) => b.date < cutoff && !have.has(b.date));
  const bars = [...added, ...h.bars].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { symbol: h.symbol, bars };
}
