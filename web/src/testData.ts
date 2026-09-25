import type { Changes, Horizon, Movers, Summary, SummaryRow } from '../../pipeline/src/types';

export const ALL_HORIZONS: Horizon[] = ['day', 'week', 'month', '3m', '6m', 'ytd', '1y'];

/** A full Changes object: every period null unless given. */
export function changes(over: Partial<Changes> = {}): Changes {
  return { day: null, week: null, month: null, '3m': null, '6m': null, ytd: null, '1y': null, ...over };
}

export function makeRow(over: Partial<SummaryRow> & { symbol: string }): SummaryRow {
  return {
    name: `${over.symbol} Plc`, sector: 'ICT', board: 'Main Board', status: 'active', close: 100, volume: 1000,
    traded: true, lastDate: '2026-09-25', historyStart: '2025-09-25',
    changes: changes({ day: 1, week: 2, month: 3, '3m': 4, '6m': 5, ytd: 6, '1y': 7 }),
    largeMove: false, ...over,
  };
}

export function makeSummary(rows: SummaryRow[]): Summary {
  const each = <T,>(f: () => T) => Object.fromEntries(ALL_HORIZONS.map((h) => [h, f()])) as Record<Horizon, T>;
  return {
    asOf: '2026-09-25',
    generatedAt: '2026-09-25T16:00:00.000Z',
    market: { asi: 252471.31, pctChange: 0.13, advancers: 34, decliners: 25, unchanged: 5, status: 'closed', noTrade: 15 },
    stocks: rows,
    coverage: each(() => ({ eligible: 131, total: 131 })),
    movers: each<Movers>(() => ({ gainers: [], losers: [] })),
  };
}
