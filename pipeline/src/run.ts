import { BACKFILL_PER_RUN, MAX_BACKFILL_ATTEMPTS, backfillRange, mergeBackfill, pickBackfills } from './backfill.js';
import { EodhdLimitError, parseEodhd } from './eodhd.js';
import { parseKoboSnapshot } from './kobo.js';
import { appendSnapshot, isNewTradeDate } from './merge.js';
import { buildSummary } from './metrics.js';
import type { DataStore } from './store.js';
import type { Report } from './types.js';

export interface RunDeps {
  fetchKobo: () => Promise<unknown>;
  fetchEodhd: (symbol: string, from: string, to: string) => Promise<unknown>;
  store: DataStore;
  now: () => Date;
  minStocks?: number;
  backfillPerRun?: number;
}

export async function runDaily(deps: RunDeps): Promise<Report> {
  const snap = parseKoboSnapshot(await deps.fetchKobo(), { minStocks: deps.minStocks });
  const report: Report = {
    runAt: deps.now().toISOString(),
    outcome: 'appended',
    tradeDate: snap.tradeDate,
    backfill: { ok: [], failed: [], stoppedEarly: null },
    warnings: [...snap.warnings],
  };

  // Kobo's prices keep moving until the close; never store an intraday price.
  if (snap.market.status === 'open') return { ...report, outcome: 'market-open' };

  let file = await deps.store.readStocks();
  // Weekend, holiday or a second scheduled attempt: nothing new, and no EODHD calls.
  if (!isNewTradeDate(file, snap.tradeDate)) return { ...report, outcome: 'duplicate-date' };

  const symbols = new Set([...file.stocks.map((s) => s.symbol), ...snap.stocks.map((s) => s.symbol)]);
  const histories = await deps.store.readHistories(symbols);
  file = appendSnapshot(file, histories, snap);

  for (const meta of pickBackfills(file, deps.backfillPerRun ?? BACKFILL_PER_RUN)) {
    const first = meta.firstKoboDate as string;
    const { from, to } = backfillRange(first);
    try {
      const bars = parseEodhd(await deps.fetchEodhd(meta.symbol, from, to));
      if (bars.length === 0) throw new Error('EODHD returned no prices');
      const current = histories.get(meta.symbol) ?? { symbol: meta.symbol, bars: [] };
      histories.set(meta.symbol, mergeBackfill(current, bars, first));
      meta.backfill = 'done';
      report.backfill.ok.push(meta.symbol);
    } catch (err) {
      if (err instanceof EodhdLimitError) {
        report.backfill.stoppedEarly = err.message;
        break;
      }
      meta.backfillAttempts += 1;
      if (meta.backfillAttempts >= MAX_BACKFILL_ATTEMPTS) meta.backfill = 'failed';
      report.backfill.failed.push({ symbol: meta.symbol, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const summary = buildSummary(file, histories, snap.market, snap.tradeDate, report.runAt);
  for (const h of histories.values()) await deps.store.writeHistory(h);
  await deps.store.writeStocks(file);
  await deps.store.writeSummary(summary);
  await deps.store.writeReport(report);
  return report;
}
