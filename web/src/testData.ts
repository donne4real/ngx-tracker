import type { Summary, SummaryRow } from '../../pipeline/src/types';

export function makeRow(over: Partial<SummaryRow> & { symbol: string }): SummaryRow {
  return {
    name: `${over.symbol} Plc`, sector: 'ICT', board: 'Main Board', status: 'active', close: 100, volume: 1000,
    traded: true, lastDate: '2026-09-25', historyStart: '2025-09-25', changes: { day: 1, week: 2, month: 3 },
    largeMove: false, ...over,
  };
}

export function makeSummary(rows: SummaryRow[]): Summary {
  return {
    asOf: '2026-09-25',
    generatedAt: '2026-09-25T16:00:00.000Z',
    market: { asi: 252471.31, pctChange: 0.13, advancers: 34, decliners: 25, unchanged: 5, status: 'closed', noTrade: 15 },
    stocks: rows,
    coverage: {
      day: { eligible: 131, total: 131 },
      week: { eligible: 131, total: 131 },
      month: { eligible: 131, total: 131 },
    },
    movers: {
      day: { gainers: [], losers: [] },
      week: { gainers: [], losers: [] },
      month: { gainers: [], losers: [] },
    },
  };
}
