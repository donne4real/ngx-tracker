import { useMemo, useState } from 'react';
import type { SummaryRow } from '../../../pipeline/src/types';
import { filterSort, sectorsOf, TEXT_KEYS, type SortKey, type TableQuery } from '../filterSort';
import { formatNaira, formatPct, formatVolume } from '../format';
import { stockHref } from '../route';

const COLUMNS: Array<{ key: SortKey; label: string; num?: boolean; hideSm?: boolean }> = [
  { key: 'symbol', label: 'Symbol' },
  { key: 'name', label: 'Name', hideSm: true },
  { key: 'sector', label: 'Sector', hideSm: true },
  { key: 'close', label: 'Last close', num: true },
  { key: 'day', label: 'Day', num: true },
  { key: 'week', label: 'Week', num: true, hideSm: true },
  { key: 'month', label: 'Month', num: true, hideSm: true },
  { key: '3m', label: '3M', num: true, hideSm: true },
  { key: '6m', label: '6M', num: true, hideSm: true },
  { key: 'ytd', label: 'YTD', num: true, hideSm: true },
  { key: '1y', label: '1Y', num: true, hideSm: true },
  { key: 'volume', label: 'Volume', num: true, hideSm: true },
];

const pctClass = (n: number | null) => (n === null ? 'num muted' : n > 0 ? 'num up' : n < 0 ? 'num down' : 'num');

export function StockTable({ rows }: { rows: SummaryRow[] }) {
  const [q, setQ] = useState<TableQuery>({ search: '', sector: '', sortKey: 'symbol', sortDir: 'asc', showInactive: false });
  const shown = useMemo(() => filterSort(rows, q), [rows, q]);
  const sectors = useMemo(() => sectorsOf(rows), [rows]);

  const sortBy = (key: SortKey) =>
    setQ((p) =>
      p.sortKey === key
        ? { ...p, sortDir: p.sortDir === 'asc' ? 'desc' : 'asc' }
        : { ...p, sortKey: key, sortDir: TEXT_KEYS.includes(key) ? 'asc' : 'desc' },
    );
  const arrow = (key: SortKey) => (q.sortKey === key ? (q.sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  return (
    <section className="card">
      <h2>All stocks</h2>
      <div className="controls">
        <input
          type="search"
          aria-label="Search stocks"
          placeholder="Search symbol or name"
          value={q.search}
          onChange={(e) => setQ((p) => ({ ...p, search: e.target.value }))}
        />
        <select aria-label="Sector" value={q.sector} onChange={(e) => setQ((p) => ({ ...p, sector: e.target.value }))}>
          <option value="">All sectors</option>
          {sectors.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={q.showInactive} onChange={(e) => setQ((p) => ({ ...p, showInactive: e.target.checked }))} /> Show inactive
        </label>
        <span className="muted">{shown.length} stocks</span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={[c.num ? 'num' : '', c.hideSm ? 'hide-sm' : ''].join(' ').trim()}
                  aria-sort={q.sortKey === c.key ? (q.sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  <button onClick={() => sortBy(c.key)}>{c.label}{arrow(c.key)}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.symbol} className={r.status === 'inactive' ? 'inactive' : undefined}>
                <td><a href={stockHref(r.symbol)}>{r.symbol}</a></td>
                <td className="hide-sm">{r.name}</td>
                <td className="hide-sm">{r.sector}</td>
                <td className="num">{formatNaira(r.close)}</td>
                <td className={pctClass(r.changes.day)}>{formatPct(r.changes.day)}</td>
                <td className={`${pctClass(r.changes.week)} hide-sm`}>{formatPct(r.changes.week)}</td>
                <td className={`${pctClass(r.changes.month)} hide-sm`}>{formatPct(r.changes.month)}</td>
                <td className={`${pctClass(r.changes['3m'])} hide-sm`}>{formatPct(r.changes['3m'])}</td>
                <td className={`${pctClass(r.changes['6m'])} hide-sm`}>{formatPct(r.changes['6m'])}</td>
                <td className={`${pctClass(r.changes.ytd)} hide-sm`}>{formatPct(r.changes.ytd)}</td>
                <td className={`${pctClass(r.changes['1y'])} hide-sm`}>{formatPct(r.changes['1y'])}</td>
                <td className="num hide-sm">{r.traded ? formatVolume(r.volume) : <span className="muted">no trades</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
