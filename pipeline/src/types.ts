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
  /** optional: absent from files written before Oct 2026 (forward-filled on read) */
  sharesOutstanding?: number;
  status: 'active' | 'inactive';
  /** consecutive trading days missing from Kobo */
  missingDays: number;
  firstKoboDate: ISODate | null;
  backfill: BackfillState;
  backfillAttempts: number;
  /** last date this stock's dividend history was refreshed (null/absent = never) */
  dividendsAt?: ISODate | null;
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
  /** all optional: present in the live snapshot, absent from old fixtures */
  prevClose: number | null;
  changePct: number | null;
  change7d: number | null;
  sharesOutstanding: number;
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
  /** trailing-12-month cash DPS in NGN (null = unknown) */
  ttmDps: number | null;
  /** ttmDps / close * 100 (null = unknown) */
  divYield: number | null;
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

export type RunOutcome = 'appended' | 'duplicate-date' | 'market-open' | 'not-final' | 'backfill-only';

export interface DividendRecord {
  exDate: ISODate;
  recordDate: ISODate | null;
  payDate: ISODate | null;
  /** cash DPS in NGN */
  dps: number;
  /** interim / final / special when the announcement text says so */
  kind: string | null;
}

export interface DividendHistory {
  symbol: string;
  /** when this file was refreshed */
  fetchedAt: ISODate;
  latestExDate: ISODate | null;
  records: DividendRecord[];
}

export interface Report {
  runAt: string;
  outcome: RunOutcome;
  tradeDate: ISODate | null;
  backfill: {
    ok: string[];
    failed: { symbol: string; error: string }[];
    stoppedEarly: string | null;
  };
  dividends: {
    ok: string[];
    failed: { symbol: string; error: string }[];
  };
  warnings: string[];
}
