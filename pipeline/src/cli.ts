import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { fetchEodhd } from './eodhd.js';
import { fetchKobo } from './kobo.js';
import { runBackfillOnly, runDaily } from './run.js';
import { DataStore } from './store.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Minimal .env reader (KEY=value lines). Real environment variables win. */
function readDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(path, 'utf8').replace(/^﻿/, '').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue;
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

async function main() {
  const { values } = parseArgs({ options: { 'data-dir': { type: 'string' }, backfill: { type: 'string' }, 'backfill-only': { type: 'boolean' } } });
  const env: Record<string, string | undefined> = { ...readDotEnv(resolve(repoRoot, '.env')), ...process.env };
  const koboKey = env.KOBO_API_KEY;
  const eodKey = env.EODHD_API_KEY;
  const backfillOnly = values['backfill-only'] === true;
  if (!eodKey || (!backfillOnly && !koboKey)) {
    throw new Error('KOBO_API_KEY and EODHD_API_KEY must be set (in .env locally, or as GitHub secrets)');
  }
  const dataDir = values['data-dir'] ? resolve(process.cwd(), values['data-dir']) : resolve(repoRoot, 'data');
  const backfillPerRun = values.backfill !== undefined ? Number(values.backfill) : undefined;

  const common = {
    fetchEodhd: (symbol: string, from: string, to: string) => fetchEodhd(symbol, from, to, eodKey),
    store: new DataStore(dataDir),
    now: () => new Date(),
    backfillPerRun,
  };
  const report = backfillOnly
    ? await runBackfillOnly(common)
    : await runDaily({ ...common, fetchKobo: () => fetchKobo(koboKey as string) });

  console.log(`Outcome: ${report.outcome} (trade date ${report.tradeDate})`);
  const bf = report.backfill;
  console.log(`Backfill: ${bf.ok.length} ok, ${bf.failed.length} failed${bf.stoppedEarly ? `; stopped early: ${bf.stoppedEarly}` : ''}`);
  // Shows as a yellow annotation on the GitHub Actions run.
  if (process.env.GITHUB_ACTIONS && bf.stoppedEarly) console.log(`::warning title=EODHD backfill paused::${bf.stoppedEarly}`);
  for (const w of report.warnings) console.log(`Warning: ${w}`);
  console.log(`Data directory: ${dataDir}`);
}

main().catch((err) => {
  console.error(`Daily run failed: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
