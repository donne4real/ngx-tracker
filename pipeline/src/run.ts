import { BACKFILL_PER_RUN, MAX_BACKFILL_ATTEMPTS, backfillRange, mergeBackfill, pickBackfills } from './backfill.js';
import { EodhdLimitError, EodhdUnavailableError, parseEodhd } from './eodhd.js';
import { isFinalSnapshot, parseKoboSnapshot } from './kobo.js';
import { appendSnapshot, isNewTradeDate } from './merge.js';
import { buildSummary } from './metrics.js';
import type { DataStore } from './store.js';
import type { History, Report, StockMeta } from './types.js';

export interface RunDeps {
  fetchKobo: () => Promise<unknown>;
  fetchEodhd: (symbol: string, from: string, to: string) => Promise<unknown>;
  store: DataStore;
  now: () => Date;
  minStocks?: number;
  backfillPerRun?: number;
}

export type BackfillDeps = Omit<RunDeps, 'fetchKobo' | 'minStocks'>;

const emptyBackfill = (): Report['backfill'] => ({ ok: [], failed: [], stoppedEarly: null });

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
      const bars = parseEodhd(await fetchEodhd(meta.symbol, from, to));
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
    warnings: [...snap.warnings],
  };

  // Kobo's prices keep moving until the close; never store an intraday price.
  // Allow-list: only an explicit 'closed' counts, and the snapshot itself must
  // postdate the close (the status comes from a calendar, not the feed).
  if (snap.market.status !== 'closed') return { ...report, outcome: 'market-open' };
  if (!isFinalSnapshot(snap)) return { ...report, outcome: 'not-final' };

  let file = await deps.store.readStocks();
  // Weekend, holiday or a second scheduled attempt: nothing new, and no EODHD calls.
  if (!isNewTradeDate(file, snap.tradeDate)) return { ...report, outcome: 'duplicate-date' };

  const symbols = new Set([...file.stocks.map((s) => s.symbol), ...snap.stocks.map((s) => s.symbol)]);
  const histories = await deps.store.readHistories(symbols);
  file = appendSnapshot(file, histories, snap);

  await backfillStocks(pickBackfills(file, deps.backfillPerRun ?? BACKFILL_PER_RUN, snap.tradeDate), histories, deps.fetchEodhd, report);

  const summary = buildSummary(file, histories, snap.market, snap.tradeDate, report.runAt);
  for (const h of histories.values()) await deps.store.writeHistory(h);
  await deps.store.writeStocks(file);
  await deps.store.writeSummary(summary);
  await deps.store.writeReport(report);
  return report;
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
  const report: Report = { runAt, outcome: 'backfill-only', tradeDate: file.lastTradeDate, backfill: emptyBackfill(), warnings: [] };
  if (file.lastTradeDate === null) return report;

  const previous = await deps.store.readSummary();
  if (!previous) return { ...report, warnings: ['No summary.json yet: run the daily job first'] };

  // Not on the day a stock was first seen: EODHD may not have the previous trading day yet.
  const picks = pickBackfills(file, deps.backfillPerRun ?? BACKFILL_PER_RUN, today);
  if (picks.length === 0) return report;

  const histories = await deps.store.readHistories(file.stocks.map((s) => s.symbol));
  await backfillStocks(picks, histories, deps.fetchEodhd, report);

  const { noTrade: _noTrade, ...market } = previous.market;
  const summary = buildSummary(file, histories, market, file.lastTradeDate, runAt);
  for (const meta of picks) {
    const h = histories.get(meta.symbol);
    if (h) await deps.store.writeHistory(h);
  }
  await deps.store.writeStocks(file);
  await deps.store.writeSummary(summary);
  await deps.store.writeReport(report);
  return report;
}
