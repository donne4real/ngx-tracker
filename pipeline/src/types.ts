/** 'YYYY-MM-DD' */
export type ISODate = string;

export interface Bar {
  date: ISODate;
  close: number;
  volume: number;
  /** volume > 0 on that day */
  traded: boolean;
  source: 'kobo' | 'eodhd';
}

export interface History {
  symbol: string;
  /** sorted by date, ascending, unique dates */
  bars: Bar[];
}

export type BackfillState = 'pending' | 'done' | 'failed';

export interface StockMeta {
  symbol: string;
  name: string;
  sector: string;
  board: string;
  marketCap: number;
  status: 'active' | 'inactive';
  /** consecutive trading days missing from Kobo */
  missingDays: number;
  firstKoboDate: ISODate | null;
  backfill: BackfillState;
  backfillAttempts: number;
}

export interface StocksFile {
  lastTradeDate: ISODate | null;
  stocks: StockMeta[];
}

export interface KoboStock {
  symbol: string;
  name: string;
  close: number;
  volume: number;
  sector: string;
  board: string;
  marketCap: number;
}

export interface MarketInfo {
  asi: number;
  pctChange: number;
  advancers: number;
  decliners: number;
  unchanged: number;
  status: string;
}

export interface Snapshot {
  tradeDate: ISODate;
  /** when Kobo took the snapshot (ISO timestamp), if it said */
  asOf: string | null;
  stocks: KoboStock[];
  market: MarketInfo;
  warnings: string[];
}

export type Horizon = 'day' | 'week' | 'month' | '3m' | '6m' | 'ytd' | '1y';
export type Changes = Record<Horizon, number | null>;

export interface SummaryRow {
  symbol: string;
  name: string;
  sector: string;
  board: string;
  status: 'active' | 'inactive';
  close: number;
  volume: number;
  /** traded on the summary's as-of date */
  traded: boolean;
  lastDate: ISODate;
  historyStart: ISODate;
  changes: Changes;
  largeMove: boolean;
}

export interface MoverRow {
  symbol: string;
  name: string;
  close: number;
  change: number;
  largeMove: boolean;
}

export interface Movers {
  gainers: MoverRow[];
  losers: MoverRow[];
}

export interface Summary {
  asOf: ISODate;
  generatedAt: string;
  market: MarketInfo & { noTrade: number };
  stocks: SummaryRow[];
  movers: Record<Horizon, Movers>;
  /** of the active stocks that traded today, how many have enough history for each horizon */
  coverage: Record<Horizon, { eligible: number; total: number }>;
}

export type RunOutcome = 'appended' | 'duplicate-date' | 'market-open' | 'not-final';

export interface Report {
  runAt: string;
  outcome: RunOutcome;
  tradeDate: ISODate | null;
  backfill: {
    ok: string[];
    failed: { symbol: string; error: string }[];
    stoppedEarly: string | null;
  };
  warnings: string[];
}
