import { useEffect, useState } from 'react';
import type { Summary } from '../../pipeline/src/types';
import { loadSummary } from './api';
import { Home } from './components/Home';
import { StockPage } from './components/StockPage';
import { formatDate } from './format';
import { useRoute } from './route';
import { isStale } from './stale';

export default function App() {
  const route = useRoute();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary().then(setSummary, (e: Error) => setError(e.message));
  }, []);

  if (error) return <main className="page"><p role="alert">Couldn't load prices: {error}</p></main>;
  if (!summary) return <main className="page"><p>Loading prices…</p></main>;

  return (
    <>
      <header className="top">
        <a className="brand" href="#/">NGX Tracker</a>
        <span className="asof">Prices as of {formatDate(summary.asOf)}, end of day</span>
      </header>
      {isStale(summary.asOf, new Date()) && (
        <div className="banner" role="status">
          Data may be out of date: the last update was for {formatDate(summary.asOf)}.
        </div>
      )}
      <main className="page">
        {route.page === 'home' ? <Home summary={summary} /> : <StockPage summary={summary} symbol={route.symbol} />}
      </main>
    </>
  );
}
