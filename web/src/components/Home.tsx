import type { Summary } from '../../../pipeline/src/types';

export function Home({ summary }: { summary: Summary }) {
  return <p>{summary.stocks.length} stocks tracked.</p>;
}
