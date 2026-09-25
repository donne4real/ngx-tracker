import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { changes, makeRow, makeSummary } from '../testData';
import { StockPage } from './StockPage';

vi.mock('./PriceChart', () => ({ PriceChart: () => <div data-testid="chart" /> }));

const respondWith = (body: unknown, type = 'application/json', status = 200) =>
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': type } }));

afterEach(() => vi.restoreAllMocks());

describe('StockPage', () => {
  it('shows "Stock not found" for a symbol that is not tracked', () => {
    render(<StockPage summary={makeSummary([makeRow({ symbol: 'MTNN' })])} symbol="NOPE" />);
    expect(screen.getByRole('heading', { name: /stock not found/i })).toBeInTheDocument();
  });

  it('shows "Stock not found" when the history file is missing (HTML fallback)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }));
    render(<StockPage summary={makeSummary([makeRow({ symbol: 'MTNN' })])} symbol="MTNN" />);
    expect(await screen.findByRole('heading', { name: /stock not found/i })).toBeInTheDocument();
  });

  it('shows price, changes, partial-history label, large-move flag and the chart', async () => {
    respondWith({ symbol: 'MTNN', bars: [
      { date: '2026-09-24', close: 855, volume: 10, traded: true, source: 'eodhd' },
      { date: '2026-09-25', close: 863, volume: 20, traded: true, source: 'kobo' },
    ] });
    const row = makeRow({ symbol: 'MTNN', name: 'MTN Nigeria Communications Plc', close: 863, historyStart: '2026-09-24', largeMove: true, changes: changes({ day: 0.94, '1y': 12.5 }) });
    render(<StockPage summary={makeSummary([row])} symbol="MTNN" />);
    expect(screen.getByRole('heading', { name: /MTN Nigeria Communications Plc/ })).toBeInTheDocument();
    expect(screen.getByText('+0.94%')).toBeInTheDocument();
    expect(screen.getByText('1Y', { selector: '.label' })).toBeInTheDocument();
    expect(screen.getByText('+12.50%')).toBeInTheDocument();
    expect(screen.getByText('YTD')).toBeInTheDocument();
    expect(screen.getByText(/history starts/i)).toBeInTheDocument();
    expect(screen.getByText(/possibly a bonus issue or split/i)).toBeInTheDocument();
    expect(await screen.findByTestId('chart')).toBeInTheDocument();
    expect(screen.getByText(/high since/i)).toBeInTheDocument();
  });
});
