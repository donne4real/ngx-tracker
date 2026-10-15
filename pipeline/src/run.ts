import { BACKFILL_PER_RUN, MAX_BACKFILL_ATTEMPTS, backfillRange, mergeBackfill, pickBackfills } from './backfill.js';
import { addDays } from './dates.js';
import { EodhdLimitError, EodhdUnavailableError, parseEodhdWithStats } from './eodhd.js';
import { isFinalSnapshot, parseDividends, parseKoboSnapshot } from './kobo.js';
import { appendSnapshot, isNewTradeDate } from './merge.js';
import { buildSummary } from './metrics.js';
import type { DataStore } from './store.js';
import type { DividendHistory, History, Report, StockMeta, StocksFile } from './types.js';

export interface RunDeps {
  fetchKobo: () => Promise<unknown>;
  fetchEodhd: (symbol: string, from: string, to: string) => Promise<unknown>;
  fetchDividends?: (symbol: string) => Promise<unknown>;
  store: DataStore;
  now: () => Date;
  minStocks?: number;
  backfillPerRun?: number;
  retryFailed?: boolean;
  dividendsPerRun?: number;
}

/** Max dividend refreshes per run: Kobo free allows 100 req/day, prices use ~2. */
export const DIVIDENDS_PER_RUN = 20;
/** Refresh a stock's dividends when never fetched or older than this many days. */
export const DIVIDENDS_REFRESH_DAYS = 30;

export type BackfillDeps = Omit<RunDeps, 'fetchKobo' | 'minStocks'>;

const emptyBackfill = (): Report['backfill'] => ({ ok: [], failed: [], stoppedEarly: null });
const emptyDividends = (): Report['dividends'] => ({ ok: [], failed: [] });

/** Stocks whose dividend history is missing or older than DIVIDENDS_REFRESH_DAYS. */
export function pickDividends(file: StocksFile, limit: number, today: string): StockMeta[] {
  const cutoff = addDays(today, -DIVIDENDS_REFRESH_DAYS);
  return file.stocks
    .filter((s) => s.status === 'active' && (s.dividendsAt == null || s.dividendsAt <= cutoff))
    .sort((a, b) => (a.dividendsAt ?? '') < (b.dividendsAt ?? '') ? -1 : (a.dividendsAt ?? '') > (b.dividendsAt ?? '') ? 1 : a.symbol.localeCompare(b.symbol))
    .slice(0, limit);
}

/** Refresh Kobo dividend histories for `picks` (never fails the run). */
async function refreshDividends(
  picks: StockMeta[],
  dividends: Map<string, DividendHistory>,
  fetchDividends: NonNullable<RunDeps['fetchDividends']>,
  store: DataStore,
  report: Report,
  today: string,
): Promise<void> {
  for (const meta of picks) {
    try {
      const parsed = parseDividends(meta.symbol, await fetchDividends(meta.symbol), today);
      dividends.set(meta.symbol, parsed);
      await store.writeDividends(parsed);
      meta.dividendsAt = today;
      report.dividends.ok.push(meta.symbol);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // Don't burn the free quota once Kobo throttles us.
      if (/HTTP 429/.test(msg)) {
        report.warnings.push(`Dividend refresh paused (Kobo rate limit): ${msg}`);
        break;
      }
      report.dividends.failed.push({ symbol: meta.symbol, error: msg });
    }
  }
}

/** Fetch EODHD history for each stock in `picks` (mutating the metas, histories and report). */
async function backfillStocks(
  picks: StockMeta[],
  histories: Map<string, History>,
  fetchEodhd: RunDeps['fetchEodhd'],
  report: Report,
): Promise<void> {
  for (const meta of picks) {
    const first = meta.firstKoboDate as string;
    const { from, to } = backfillRange(first);
    try {
      const { bars, dropped } = parseEodhdWithStats(await fetchEodhd(meta.symbol, from, to));
      if (dropped > 0) report.warnings.push(`${meta.symbol}: dropped ${dropped} unusable EODHD rows`);
      if (bars.length === 0) throw new Error('EODHD returned no prices');
      const current = histories.get(meta.symbol) ?? { symbol: meta.symbol, bars: [] };
      histories.set(meta.symbol, mergeBackfill(current, bars, first));
      meta.backfill = 'done';
      report.backfill.ok.push(meta.symbol);
    } catch (err) {
      // Quota, key or outage problems pause the backfill without using up retries.
      if (err instanceof EodhdLimitError || err instanceof EodhdUnavailableError) {
        report.backfill.stoppedEarly = err.message;
        break;
      }
      meta.backfillAttempts += 1;
      if (meta.backfillAttempts >= MAX_BACKFILL_ATTEMPTS) meta.backfill = 'failed';
      report.backfill.failed.push({ symbol: meta.symbol, error: err instanceof Error ? err.message : String(err) });
    }
  }
}

export async function runDaily(deps: RunDeps): Promise<Report> {
  const snap = parseKoboSnapshot(await deps.fetchKobo(), { minStocks: deps.minStocks });
  const report: Report = {
    runAt: deps.now().toISOString(),
    outcome: 'appended',
    tradeDate: snap.tradeDate,
    backfill: emptyBackfill(),
    dividends: emptyDividends(),
    warnings: [...snap.warnings],
  };

  // Kobo's prices keep moving until the close; never store an intraday price.
  // Allow-list: only an explicit 'closed' counts, and the snapshot itself must
  // postdate the close (the status comes from a calendar, not the feed).
  if (snap.market.status !== 'closed') {
    const r = { ...report, outcome: 'market-open' as const };
    await deps.store.writeReport(r);
    return r;
  }
  if (!isFinalSnapshot(snap)) {
    const r = { ...report, outcome: 'not-final' as const };
    await deps.store.writeReport(r);
    return r;
  }

  let file = await deps.store.readStocks();
  // Weekend, holiday or a second scheduled attempt: nothing new, and no EODHD calls.
  if (!isNewTradeDate(file, snap.tradeDate)) {
    const r = { ...report, outcome: 'duplicate-date' as const };
    await deps.store.writeReport(r);
    return r;
  }

  const symbols = new Set([...file.stocks.map((s) => s.symbol), ...snap.stocks.map((s) => s.symbol)]);
  const histories = await deps.store.readHistories(symbols);
  file = appendSnapshot(file, histories, snap);

  await backfillStocks(
    pickBackfills(file, deps.backfillPerRun ?? BACKFILL_PER_RUN, snap.tradeDate, { includeFailed: deps.retryFailed === true }),
    histories,
    deps.fetchEodhd,
    report,
  );

  // Dividend enrichment (Kobo free tier, batched like the EODHD backfill).
  const dividends = await readDividends(deps.store, file.stocks.map((s) => s.symbol));
  if (deps.fetchDividends) {
    await refreshDividends(
      pickDividends(file, deps.dividendsPerRun ?? DIVIDENDS_PER_RUN, snap.tradeDate),
      dividends,
      deps.fetchDividends,
      deps.store,
      report,
      snap.tradeDate,
    );
  }

  const summary = buildSummary(file, histories, snap.market, snap.tradeDate, report.runAt, dividends);
  for (const h of histories.values()) await deps.store.writeHistory(h);
  await deps.store.writeStocks(file);
  await deps.store.writeSummary(summary);
  await deps.store.writeReport(report);
  return report;
}

/** Read stored dividend histories (missing files = never fetched yet). */
async function readDividends(store: DataStore, symbols: string[]): Promise<Map<string, DividendHistory>> {
  const map = new Map<string, DividendHistory>();
  await Promise.all(
    symbols.map(async (s) => {
      const d = await store.readDividends(s);
      if (d) map.set(s, d);
    }),
  );
  return map;
}

/**
 * Weekend run: no Kobo request, just more EODHD history (the free quota is per
 * calendar day, weekends included). Today's prices and market figures are
 * kept as they are; only history and the changes computed from it move.
 */
export async function runBackfillOnly(deps: BackfillDeps): Promise<Report> {
  const runAt = deps.now().toISOString();
  const today = runAt.slice(0, 10);
  const file = await deps.store.readStocks();
  const report: Report = { runAt, outcome: 'backfill-only', tradeDate: file.lastTradeDate, backfill: emptyBackfill(), dividends: emptyDividends(), warnings: [] };
  if (file.lastTradeDate === null) return report;

  const previous = await deps.store.readSummary();
  if (!previous) return { ...report, warnings: ['No summary.json yet: run the daily job first'] };

  // Not on the day a stock was first seen: EODHD may not have the previous trading day yet.
  const picks = pickBackfills(file, deps.backfillPerRun ?? BACKFILL_PER_RUN, today);
  const dividends = await readDividends(deps.store, file.stocks.map((s) => s.symbol));
  if (deps.fetchDividends) {
    await refreshDividends(
      pickDividends(file, deps.dividendsPerRun ?? DIVIDENDS_PER_RUN, today),
      dividends,
      deps.fetchDividends,
      deps.store,
      report,
      today,
    );
  }
  if (picks.length === 0 && report.dividends.ok.length === 0 && report.dividends.failed.length === 0) return report;

  const histories = await deps.store.readHistories(file.stocks.map((s) => s.symbol));
  await backfillStocks(picks, histories, deps.fetchEodhd, report);

  const { noTrade: _noTrade, ...market } = previous.market;
  const summary = buildSummary(file, histories, market, file.lastTradeDate, runAt, dividends);
  for (const meta of picks) {
    const h = histories.get(meta.symbol);
    if (h) await deps.store.writeHistory(h);
  }
  await deps.store.writeStocks(file);
  await deps.store.writeSummary(summary);
  await deps.store.writeReport(report);
  return report;
}
