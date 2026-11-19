import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { makeRow } from '../testData';
import { StockTable } from './StockTable';

const AS_OF = '2026-09-25';
const rows = [
  makeRow({ symbol: 'MTNN', name: 'MTN Nigeria Communications Plc' }),
  makeRow({ symbol: 'NB', name: 'Nigerian Breweries Plc', sector: 'CONSUMER GOODS' }),
  makeRow({ symbol: 'GONE', name: 'Delisted Plc', status: 'inactive' }),
];
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);
const table = (props: Partial<{ rows: typeof rows; asOf: string }> = {}) =>
  <StockTable rows={props.rows ?? rows} asOf={props.asOf ?? AS_OF} />;

afterEach(() => localStorage.clear());

describe('StockTable with an older summary.json', () => {
  it('shows a dash for periods the data file does not have yet, without crashing', () => {
    const old = makeRow({ symbol: 'OLD' });
    old.changes = { day: 1, week: 2, month: 3 } as unknown as typeof old.changes;
    render(table({ rows: [old] }));
    expect(screen.getByRole('link', { name: 'OLD' })).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});

describe('StockTable longer periods', () => {
  it('has sortable 3M, 6M, YTD and 1Y columns', () => {
    render(table());
    for (const label of ['3M', '6M', 'YTD', '1Y']) expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});

describe('StockTable', () => {
  it('filters as you type and links each symbol to its page', async () => {
    render(table());
    expect(bodyRows()).toHaveLength(2);
    await userEvent.type(screen.getByLabelText(/search stocks/i), 'brew');
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'NB' })).toHaveAttribute('href', '#/stock/NB');
  });

  it('shows inactive stocks only when the box is ticked', async () => {
    render(table());
    expect(screen.queryByText('GONE')).toBeNull();
    await userEvent.click(screen.getByLabelText(/show inactive/i));
    expect(screen.getByText('GONE')).toBeInTheDocument();
  });
});

describe('StockTable watchlist', () => {
  it('stars a stock, filters to watched stocks only, and persists across remounts', async () => {
    const { unmount } = render(table());
    await userEvent.click(screen.getByRole('button', { name: 'Add MTNN to watchlist' }));
    expect(screen.getByRole('button', { name: 'Remove MTNN from watchlist' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByLabelText(/watchlist only/i));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'MTNN' })).toBeInTheDocument();

    unmount();
    render(table());
    expect(screen.getByRole('button', { name: 'Remove MTNN from watchlist' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByLabelText(/watchlist only/i));
    expect(bodyRows()).toHaveLength(1);
  });

  it('explains itself when watchlist-only is on but nothing is starred', async () => {
    render(table());
    await userEvent.click(screen.getByLabelText(/watchlist only/i));
    expect(bodyRows()).toHaveLength(0);
    expect(screen.getByText(/tap ☆ next to a stock/i)).toBeInTheDocument();
  });

  it('unstars on a second click', async () => {
    render(table());
    const star = screen.getByRole('button', { name: 'Add NB to watchlist' });
    await userEvent.click(star);
    await userEvent.click(screen.getByRole('button', { name: 'Remove NB from watchlist' }));
    expect(screen.getByRole('button', { name: 'Add NB to watchlist' })).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('ngx-watchlist')).toBe('[]');
  });
});

describe('StockTable staleness', () => {
  it('marks a stock whose last bar is older than the summary date', () => {
    const stale = makeRow({ symbol: 'UHOMREIT', lastDate: '2026-09-10' });
    const fresh = makeRow({ symbol: 'MTNN', lastDate: AS_OF });
    render(table({ rows: [stale, fresh] }));
    expect(screen.getByText('as of 10 Sept 2026')).toBeInTheDocument();
    expect(screen.getByText(/marks a stock whose last trading data is older than 25 Sept 2026/i)).toBeInTheDocument();
  });

  it('shows no marker when every last bar matches the summary date', () => {
    render(table());
    expect(screen.queryByText(/^as of /)).toBeNull();
    expect(screen.queryByText(/whose last trading data is older/i)).toBeNull();
  });
});
