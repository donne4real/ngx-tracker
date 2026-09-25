import type { Summary } from '../../../pipeline/src/types';
import { MarketSummary } from './MarketSummary';
import { MoversPanel } from './MoversPanel';
import { StockTable } from './StockTable';

export function Home({ summary }: { summary: Summary }) {
  return (
    <>
      <MarketSummary market={summary.market} />
      <MoversPanel movers={summary.movers} />
      <StockTable rows={summary.stocks} />
    </>
  );
}
