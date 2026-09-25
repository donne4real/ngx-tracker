import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeSummary } from '../testData';
import { MoversPanel } from './MoversPanel';

describe('MoversPanel', () => {
  it('switches horizons and explains empty lists', async () => {
    const s = makeSummary([]);
    s.movers.day.gainers = [{ symbol: 'MTNN', name: 'MTN', close: 863, change: 0.94, largeMove: false }];
    s.movers.day.losers = [{ symbol: 'XYZ', name: 'XYZ Plc', close: 5, change: -50, largeMove: true }];
    render(<MoversPanel movers={s.movers} />);
    expect(screen.getByText('MTNN')).toBeInTheDocument();
    expect(screen.getByTitle(/bonus issue or split/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(screen.queryByText('MTNN')).toBeNull();
    expect(screen.getAllByText(/not enough history yet/i)).toHaveLength(2);
  });
});
