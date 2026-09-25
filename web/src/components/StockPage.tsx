import type { Summary } from '../../../pipeline/src/types';

export function StockPage({ symbol }: { summary: Summary; symbol: string }) {
  return <h2>{symbol}</h2>;
}
