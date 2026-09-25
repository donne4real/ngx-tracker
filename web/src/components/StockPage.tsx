import { useEffect, useMemo, useState } from 'react';
import type { History, Summary } from '../../../pipeline/src/types';
import { loadHistory } from '../api';
import { formatDate, formatNaira, formatPct, formatVolume } from '../format';
import { barsInRange, RANGES, stockStats, type Range } from '../stats';
import { HORIZON_TABS } from '../horizons';
import { LARGE_MOVE_TITLE } from './MoversPanel';
import { PriceChart } from './PriceChart';

function NotFound({ symbol }: { symbol: string }) {
  return (
    <section className="card">
      <h2>Stock not found</h2>
      <p>
        No stock with the symbol “{symbol}” is being tracked. <a href="#/">Back to all stocks</a>
      </p>
    </section>
  );
}

const pctClass = (n: number | null) => (n === null ? 'muted' : n > 0 ? 'up' : n < 0 ? 'down' : '');

export function StockPage({ summary, symbol }: { summary: Summary; symbol: string }) {
  const row = summary.stocks.find((s) => s.symbol === symbol);
  const [history, setHistory] = useState<History | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('1Y');

  useEffect(() => {
    let live = true;
    setHistory(undefined);
    setError(null);
    if (!row) return;
    loadHistory(symbol).then(
      (h) => live && setHistory(h),
      (e: Error) => live && setError(e.message),
    );
    return () => {
      live = false;
    };
  }, [symbol, row]);

  const shownBars = useMemo(() => (history ? barsInRange(history.bars, range, summary.asOf) : []), [history, range, summary.asOf]);

  if (!row || history === null) return <NotFound symbol={symbol} />;
  const stats = history ? stockStats(history.bars, summary.asOf) : null;

  return (
    <>
      <section className="card">
        <p className="muted"><a href="#/">← All stocks</a></p>
        <h2>{row.name}</h2>
        <p className="muted">
          {row.symbol} · {row.sector} · {row.board}
          {row.status === 'inactive' && ' · inactive (not seen on the exchange recently)'}
        </p>
        <div className="stats">
          <div className="stat"><span className="label">Last close ({formatDate(row.lastDate)})</span><span className="value">{formatNaira(row.close)}</span></div>
          {HORIZON_TABS.map(({ key, label }) => (
            <div className="stat" key={key}>
              <span className="label">{label}</span>
              <span className={`value ${pctClass(row.changes[key])}`}>{formatPct(row.changes[key])}</span>
            </div>
          ))}
        </div>
        {row.largeMove && <p className="banner" title={LARGE_MOVE_TITLE}>⚠ Moved more than ±10% on the day: possibly a bonus issue or split, since prices are not adjusted.</p>}
        <p className="muted">History starts {formatDate(row.historyStart)}.</p>
      </section>

      <section className="card">
        <div className="range" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        {history === undefined && !error && <p className="muted">Loading history…</p>}
        {history && <PriceChart bars={shownBars} />}
      </section>

      {stats && (
        <section className="card">
          <div className="stats">
            <div className="stat"><span className="label">{stats.fullYear ? '52-week high' : `High since ${formatDate(stats.from)}`}</span><span className="value">{formatNaira(stats.high)}</span></div>
            <div className="stat"><span className="label">{stats.fullYear ? '52-week low' : `Low since ${formatDate(stats.from)}`}</span><span className="value">{formatNaira(stats.low)}</span></div>
            <div className="stat"><span className="label">Average daily volume</span><span className="value">{formatVolume(stats.avgVolume)}</span></div>
          </div>
        </section>
      )}
    </>
  );
}
