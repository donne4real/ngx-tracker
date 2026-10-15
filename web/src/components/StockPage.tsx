import { useEffect, useMemo, useState } from 'react';
import type { DividendHistory, History, Summary } from '../../../pipeline/src/types';
import { loadDividends, loadHistory } from '../api';
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

const pctClass = (n: number | null | undefined) => (n == null ? 'muted' : n > 0 ? 'up' : n < 0 ? 'down' : '');

/** Free full statements/ratios on StockAnalysis (covers large NGX names; thin for small caps). */
const financialsUrl = (symbol: string) => `https://stockanalysis.com/quote/ngx/${encodeURIComponent(symbol)}/financials/`;

export function StockPage({ summary, symbol }: { summary: Summary; symbol: string }) {
  const row = summary.stocks.find((s) => s.symbol === symbol);
  const [history, setHistory] = useState<History | null | undefined>(undefined);
  const [dividends, setDividends] = useState<DividendHistory | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>('1Y');

  useEffect(() => {
    let live = true;
    setHistory(undefined);
    setDividends(undefined);
    setError(null);
    if (!row) return;
    loadHistory(symbol).then(
      (h) => live && setHistory(h),
      (e: Error) => live && setError(e.message),
    );
    loadDividends(symbol).then(
      (d) => live && setDividends(d),
      () => live && setDividends(null),
    );
    return () => {
      live = false;
    };
  }, [symbol, !!row]);

  const shownBars = useMemo(() => (history ? barsInRange(history.bars, range, summary.asOf) : []), [history, range, summary.asOf]);
  const stats = useMemo(() => (history ? stockStats(history.bars, summary.asOf) : null), [history, summary.asOf]);

  if (!row) return <NotFound symbol={symbol} />;
  if (history === null) {
    return (
      <section className="card">
        <h2>History not available</h2>
        <p>
          {symbol} is tracked, but its price history file is missing. <a href="#/">Back to all stocks</a>
        </p>
      </section>
    );
  }

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
        <p className="muted">History starts {formatDate(row.historyStart)}. <a href={financialsUrl(row.symbol)} target="_blank" rel="noreferrer">Financials on StockAnalysis ↗</a></p>
      </section>

      <section className="card">
        <div className="range" role="group" aria-label="Chart range">
          {RANGES.map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
        {error && <p role="alert">{error}</p>}
        {history === undefined && !error && <p className="muted">Loading history…</p>}
        {history && (shownBars.length === 0 ? <p className="muted">No data in this range.</p> : <PriceChart bars={shownBars} />)}
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

      {(row.ttmDps != null || row.divYield != null || (dividends && dividends.records.length > 0)) && (
        <section className="card">
          <h3>Dividends</h3>
          <div className="stats">
            <div className="stat"><span className="label">TTM payout</span><span className="value">{row.ttmDps != null ? formatNaira(row.ttmDps) : '—'}</span></div>
            <div className="stat"><span className="label">Yield</span><span className="value">{formatPct(row.divYield)}</span></div>
            {dividends && dividends.latestExDate && (
              <div className="stat"><span className="label">Latest ex-date</span><span className="value">{formatDate(dividends.latestExDate)}</span></div>
            )}
          </div>
          {dividends && dividends.records.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Ex-date</th><th className="num">Per share</th><th>Type</th><th>Pay date</th></tr>
                </thead>
                <tbody>
                  {dividends.records.slice(-4).reverse().map((d) => (
                    <tr key={d.exDate + d.dps}>
                      <td>{formatDate(d.exDate)}</td>
                      <td className="num">{formatNaira(d.dps)}</td>
                      <td>{d.kind ? d.kind[0].toUpperCase() + d.kind.slice(1) : '—'}</td>
                      <td>{d.payDate ? formatDate(d.payDate) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
