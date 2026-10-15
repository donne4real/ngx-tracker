import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataStore, formatHistory } from '../src/store.js';
import type { History } from '../src/types.js';

let dir: string;
let store: DataStore;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ngx-store-'));
  store = new DataStore(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('DataStore', () => {
  it('round-trips history through formatHistory', async () => {
    const h: History = {
      symbol: 'MTNN',
      bars: [
        { date: '2026-09-25', close: 863, volume: 100, traded: true, source: 'kobo' },
        { date: '2026-09-28', close: 870, volume: 0, traded: false, source: 'kobo' },
      ],
    };
    await store.writeHistory(h);
    const raw = await readFile(join(dir, 'history/MTNN.json'), 'utf8');
    // One bar per line for tidy git diffs.
    expect(raw.split('\n').filter((l) => l.includes('"date"'))).toHaveLength(2);
    const back = await store.readHistories(['MTNN']);
    expect(back.get('MTNN')).toEqual(h);
  });

  it('throws a helpful error on corrupt stocks.json', async () => {
    await store.writeStocks({ lastTradeDate: null, stocks: [] });
    await writeFile(join(dir, 'stocks.json'), '{not json', 'utf8');
    await expect(store.readStocks()).rejects.toThrow();
    await writeFile(join(dir, 'stocks.json'), JSON.stringify({ lastTradeDate: null, stocks: {} }), 'utf8');
    await expect(store.readStocks()).rejects.toThrow(/corrupt/);
  });

  it('skips missing history files', async () => {
    const map = await store.readHistories(['NOPE']);
    expect(map.size).toBe(0);
  });

  it('writes atomically (no .tmp left behind)', async () => {
    await store.writeStocks({ lastTradeDate: '2026-09-25', stocks: [] });
    await store.writeReport({ runAt: '2026-09-25T16:00:00Z', outcome: 'appended', tradeDate: '2026-09-25', backfill: { ok: [], failed: [], stoppedEarly: null }, dividends: { ok: [], failed: [] }, warnings: [] });
    const { readdir } = await import('node:fs/promises');
    const all: string[] = [];
    const walk = async (d: string) => {
      for (const e of await readdir(d, { withFileTypes: true })) {
        const p = join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else all.push(p);
      }
    };
    await walk(dir);
    expect(all.some((p) => p.endsWith('.tmp'))).toBe(false);
  });
});
