import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeSummary } from '../testData';
import { MoversPanel } from './MoversPanel';

describe('MoversPanel coverage note', () => {
  it('says how many stocks the lists are based on while history is still loading', () => {
    const s = makeSummary([]);
    s.coverage.day = { eligible: 18, total: 131 };
    render(<MoversPanel movers={s.movers} coverage={s.coverage} />);
    expect(screen.getByText(/based on 18 of 131 stocks/i)).toBeInTheDocument();
  });
  it('shows no note once coverage is complete', () => {
    const s = makeSummary([]);
    render(<MoversPanel movers={s.movers} coverage={s.coverage} />);
    expect(screen.queryByText(/based on/i)).toBeNull();
  });
});

describe('MoversPanel with an older summary.json', () => {
  it('treats a period missing from the data file as having no history yet', async () => {
    const s = makeSummary([]);
    delete (s.movers as Partial<typeof s.movers>).ytd;
    delete (s.coverage as Partial<typeof s.coverage>).ytd;
    render(<MoversPanel movers={s.movers} coverage={s.coverage} />);
    await userEvent.click(screen.getByRole('tab', { name: 'YTD' }));
    expect(screen.getAllByText(/not enough history yet/i)).toHaveLength(2);
  });
});

describe('MoversPanel longer periods', () => {
  it("has a tab for every period and shows that period's lists", async () => {
    const s = makeSummary([]);
    s.movers.ytd.gainers = [{ symbol: 'GTCO', name: 'Guaranty Trust', close: 90, change: 45.5, largeMove: false }];
    render(<MoversPanel movers={s.movers} coverage={s.coverage} />);
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Day', 'Week', 'Month', '3M', '6M', 'YTD', '1Y']);
    await userEvent.click(screen.getByRole('tab', { name: 'YTD' }));
    expect(screen.getByText('GTCO')).toBeInTheDocument();
    expect(screen.getByText('+45.50%')).toBeInTheDocument();
  });
  it('explains that changes are price-only', () => {
    const s = makeSummary([]);
    render(<MoversPanel movers={s.movers} coverage={s.coverage} />);
    expect(screen.getByText(/price changes only/i)).toBeInTheDocument();
  });
});

describe('MoversPanel', () => {
  it('switches horizons and explains empty lists', async () => {
    const s = makeSummary([]);
    s.movers.day.gainers = [{ symbol: 'MTNN', name: 'MTN', close: 863, change: 0.94, largeMove: false }];
    s.movers.day.losers = [{ symbol: 'XYZ', name: 'XYZ Plc', close: 5, change: -50, largeMove: true }];
    render(<MoversPanel movers={s.movers} coverage={s.coverage} />);
    expect(screen.getByText('MTNN')).toBeInTheDocument();
    expect(screen.getByTitle(/bonus issue or split/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Week' }));
    expect(screen.queryByText('MTNN')).toBeNull();
    expect(screen.getAllByText(/not enough history yet/i)).toHaveLength(2);
  });
});
