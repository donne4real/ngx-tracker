import { addDays, minusMonths } from './dates.js';
import type { Bar, Changes, History, Horizon, MarketInfo, MoverRow, Movers, StocksFile, Summary, SummaryRow } from './types.js';

export const LARGE_MOVE_PCT = 10;
export const MOVERS_COUNT = 10;
const HORIZONS: Horizon[] = ['day', 'week', 'month'];

const pct = (now: number, then: number) => Math.round((now / then - 1) * 10000) / 100;

/** Last bar dated on or before `date` (bars sorted ascending). */
export function closeOnOrBefore(bars: Bar[], date: string): Bar | undefined {
  for (let i = bars.length - 1; i >= 0; i--) if (bars[i].date <= date) return bars[i];
  return undefined;
}

export function computeChanges(bars: Bar[]): Changes {
  const last = bars.at(-1);
  if (!last) return { day: null, week: null, month: null };
  const prev = bars.length > 1 ? bars[bars.length - 2] : undefined;
  const week = closeOnOrBefore(bars, addDays(last.date, -7));
  const month = closeOnOrBefore(bars, minusMonths(last.date, 1));
  return {
    day: prev ? pct(last.close, prev.close) : null,
    week: week ? pct(last.close, week.close) : null,
    month: month ? pct(last.close, month.close) : null,
  };
}

function movers(rows: SummaryRow[], h: Horizon): Movers {
  const eligible = rows
    .filter((r) => r.status === 'active' && r.traded && r.changes[h] !== null)
    .map<MoverRow>((r) => ({ symbol: r.symbol, name: r.name, close: r.close, change: r.changes[h] as number, largeMove: r.largeMove }));
  const bySymbol = (a: MoverRow, b: MoverRow) => a.symbol.localeCompare(b.symbol);
  return {
    gainers: eligible.filter((r) => r.change > 0).sort((a, b) => b.change - a.change || bySymbol(a, b)).slice(0, MOVERS_COUNT),
    losers: eligible.filter((r) => r.change < 0).sort((a, b) => a.change - b.change || bySymbol(a, b)).slice(0, MOVERS_COUNT),
  };
}

export function buildSummary(
  file: StocksFile,
  histories: Map<string, History>,
  market: MarketInfo,
  asOf: string,
  generatedAt: string,
): Summary {
  const rows: SummaryRow[] = [];
  for (const m of file.stocks) {
    const bars = histories.get(m.symbol)?.bars ?? [];
    const last = bars.at(-1);
    if (!last) continue;
    const changes = computeChanges(bars);
    rows.push({
      symbol: m.symbol,
      name: m.name,
      sector: m.sector,
      board: m.board,
      status: m.status,
      close: last.close,
      volume: last.volume,
      traded: last.date === asOf && last.traded,
      lastDate: last.date,
      historyStart: bars[0].date,
      changes,
      largeMove: changes.day !== null && Math.abs(changes.day) > LARGE_MOVE_PCT,
    });
  }
  const noTrade = rows.filter((r) => r.status === 'active' && !r.traded).length;
  const tradedToday = rows.filter((r) => r.status === 'active' && r.traded);
  const coverage = Object.fromEntries(
    HORIZONS.map((h) => [h, { eligible: tradedToday.filter((r) => r.changes[h] !== null).length, total: tradedToday.length }]),
  ) as Summary['coverage'];
  return {
    asOf,
    generatedAt,
    market: { ...market, noTrade },
    stocks: rows,
    movers: Object.fromEntries(HORIZONS.map((h) => [h, movers(rows, h)])) as Record<Horizon, Movers>,
    coverage,
  };
}
