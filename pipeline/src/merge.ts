import type { Bar, History, Snapshot, StockMeta, StocksFile } from './types.js';
import { weekdaysAfter } from './dates.js';

export const INACTIVE_AFTER = 10;

const byDate = (a: Bar, b: Bar) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

export function isNewTradeDate(file: StocksFile, tradeDate: string): boolean {
  return file.lastTradeDate === null || tradeDate > file.lastTradeDate;
}

/** Adds one bar per snapshot stock (mutating `histories`) and returns the updated stock list. */
export function appendSnapshot(file: StocksFile, histories: Map<string, History>, snap: Snapshot): StocksFile {
  const bySymbol = new Map<string, StockMeta>(file.stocks.map((s) => [s.symbol, { ...s }]));
  const seen = new Set<string>();

  for (const k of snap.stocks) {
    seen.add(k.symbol);
    const prev = bySymbol.get(k.symbol);
    bySymbol.set(k.symbol, {
      symbol: k.symbol,
      name: k.name,
      sector: k.sector,
      board: k.board,
      marketCap: k.marketCap,
      sharesOutstanding: k.sharesOutstanding,
      status: 'active',
      missingDays: 0,
      firstKoboDate: prev?.firstKoboDate ?? snap.tradeDate,
      backfill: prev?.backfill ?? 'pending',
      backfillAttempts: prev?.backfillAttempts ?? 0,
      dividendsAt: prev?.dividendsAt ?? null,
    });

    const h = histories.get(k.symbol) ?? { symbol: k.symbol, bars: [] };
    const existing = h.bars.find((b) => b.date === snap.tradeDate);
    if (!existing) {
      h.bars.push({ date: snap.tradeDate, close: k.close, volume: k.volume, traded: k.volume > 0, source: 'kobo' });
      h.bars.sort(byDate);
    } else if (existing.close !== k.close || existing.volume !== k.volume) {
      snap.warnings.push(`Corrected ${k.symbol} ${snap.tradeDate} ${existing.close}→${k.close}`);
      existing.close = k.close;
      existing.volume = k.volume;
      existing.traded = k.volume > 0;
      existing.source = 'kobo';
    }
    histories.set(k.symbol, h);
  }

  // Count actual weekdays missed, so a multi-day Kobo outage isn't undercounted.
  let gap = 1;
  try {
    if (file.lastTradeDate) gap = Math.max(1, weekdaysAfter(file.lastTradeDate, snap.tradeDate));
  } catch {
    gap = 1;
  }
  for (const [symbol, m] of bySymbol) {
    if (seen.has(symbol)) continue;
    m.missingDays += gap;
    if (m.missingDays >= INACTIVE_AFTER) m.status = 'inactive';
  }

  return {
    lastTradeDate: snap.tradeDate,
    stocks: [...bySymbol.values()].sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}
