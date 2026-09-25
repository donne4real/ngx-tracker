import type { Summary } from '../../../pipeline/src/types';
import { formatPct } from '../format';

export function MarketSummary({ market }: { market: Summary['market'] }) {
  const items: Array<[string, string, string?]> = [
    ['All-Share Index', market.asi.toLocaleString('en-NG', { maximumFractionDigits: 2 }), formatPct(market.pctChange)],
    ['Rose', String(market.advancers)],
    ['Fell', String(market.decliners)],
    ['Unchanged', String(market.unchanged)],
    ["Didn't trade", String(market.noTrade)],
  ];
  return (
    <section className="card" aria-label="Market summary">
      <div className="stats">
        {items.map(([label, value, extra]) => (
          <div className="stat" key={label}>
            <span className="label">{label}</span>
            <span className="value">{value}</span>
            {extra && <span className={market.pctChange >= 0 ? 'up' : 'down'}> {extra}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
