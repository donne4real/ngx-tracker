import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { History, Report, StocksFile, Summary } from './types.js';

/** One bar per line, so daily git diffs show exactly the new rows. */
export function formatHistory(h: History): string {
  const lines = h.bars.map((b) => '    ' + JSON.stringify(b));
  return `{\n  "symbol": ${JSON.stringify(h.symbol)},\n  "bars": [\n${lines.join(',\n')}\n  ]\n}\n`;
}

export class DataStore {
  constructor(readonly dir: string) {}

  async readStocks(): Promise<StocksFile> {
    return (await this.readJson<StocksFile>('stocks.json')) ?? { lastTradeDate: null, stocks: [] };
  }

  readSummary(): Promise<Summary | null> {
    return this.readJson<Summary>('summary.json');
  }

  async readHistories(symbols: Iterable<string>): Promise<Map<string, History>> {
    const map = new Map<string, History>();
    for (const s of symbols) {
      const h = await this.readJson<History>(`history/${s}.json`);
      if (h) map.set(s, h);
    }
    return map;
  }

  writeStocks(f: StocksFile) {
    return this.writeText('stocks.json', JSON.stringify(f, null, 2) + '\n');
  }
  writeHistory(h: History) {
    return this.writeText(`history/${h.symbol}.json`, formatHistory(h));
  }
  /** Compact: the website downloads this file on every visit. */
  writeSummary(s: Summary) {
    return this.writeText('summary.json', JSON.stringify(s) + '\n');
  }
  writeReport(r: Report) {
    return this.writeText('report.json', JSON.stringify(r, null, 2) + '\n');
  }

  private async readJson<T>(rel: string): Promise<T | null> {
    try {
      return JSON.parse(await readFile(join(this.dir, rel), 'utf8')) as T;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
  }

  private async writeText(rel: string, text: string): Promise<void> {
    const p = join(this.dir, rel);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, text, 'utf8');
  }
}
