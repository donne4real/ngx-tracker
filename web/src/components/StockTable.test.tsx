import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeRow } from '../testData';
import { StockTable } from './StockTable';

const rows = [
  makeRow({ symbol: 'MTNN', name: 'MTN Nigeria Communications Plc' }),
  makeRow({ symbol: 'NB', name: 'Nigerian Breweries Plc', sector: 'CONSUMER GOODS' }),
  makeRow({ symbol: 'GONE', name: 'Delisted Plc', status: 'inactive' }),
];
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

describe('StockTable with an older summary.json', () => {
  it('shows a dash for periods the data file does not have yet, without crashing', () => {
    const old = makeRow({ symbol: 'OLD' });
    old.changes = { day: 1, week: 2, month: 3 } as unknown as typeof old.changes;
    render(<StockTable rows={[old]} />);
    expect(screen.getByRole('link', { name: 'OLD' })).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4);
  });
});

describe('StockTable longer periods', () => {
  it('has sortable 3M, 6M, YTD and 1Y columns', () => {
    render(<StockTable rows={rows} />);
    for (const label of ['3M', '6M', 'YTD', '1Y']) expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });
});

describe('StockTable', () => {
  it('filters as you type and links each symbol to its page', async () => {
    render(<StockTable rows={rows} />);
    expect(bodyRows()).toHaveLength(2);
    await userEvent.type(screen.getByLabelText(/search stocks/i), 'brew');
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'NB' })).toHaveAttribute('href', '#/stock/NB');
  });

  it('shows inactive stocks only when the box is ticked', async () => {
    render(<StockTable rows={rows} />);
    expect(screen.queryByText('GONE')).toBeNull();
    await userEvent.click(screen.getByLabelText(/show inactive/i));
    expect(screen.getByText('GONE')).toBeInTheDocument();
  });
});
