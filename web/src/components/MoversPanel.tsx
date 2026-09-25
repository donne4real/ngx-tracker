import { useState } from 'react';
import type { Horizon, MoverRow, Summary } from '../../../pipeline/src/types';
import { formatPct } from '../format';
import { stockHref } from '../route';

const TABS: Array<{ key: Horizon; label: string }> = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export const LARGE_MOVE_TITLE = 'Moved more than ±10% in a day: possibly a bonus issue or split, since prices are not adjusted';

function MoverList({ title, rows }: { title: string; rows: MoverRow[] }) {
  return (
    <div>
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="muted">Not enough history yet.</p>
      ) : (
        <ol>
          {rows.map((r) => (
            <li key={r.symbol}>
              <a href={stockHref(r.symbol)}>{r.symbol}</a>
              <span className="name">{r.name}</span>
              <span className={r.change >= 0 ? 'up' : 'down'}>{formatPct(r.change)}</span>
              {r.largeMove && <span className="flag" title={LARGE_MOVE_TITLE}>⚠</span>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Below this share of traded stocks, the lists get a 'based on N of M' note. */
const FULL_COVERAGE = 0.9;

export function MoversPanel({ movers, coverage }: { movers: Summary['movers']; coverage: Summary['coverage'] }) {
  const [tab, setTab] = useState<Horizon>('day');
  const cov = coverage[tab];
  return (
    <section className="card">
      <h2>Top movers</h2>
      <div role="tablist" aria-label="Period">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      {cov.total > 0 && cov.eligible < cov.total * FULL_COVERAGE && (
        <p className="muted">
          Based on {cov.eligible} of {cov.total} stocks that traded: price history for the rest is still loading.
        </p>
      )}
      <div className="movers">
        <MoverList title="Gainers" rows={movers[tab].gainers} />
        <MoverList title="Losers" rows={movers[tab].losers} />
      </div>
    </section>
  );
}
