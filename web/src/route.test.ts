import { describe, expect, it } from 'vitest';
import { parseRoute, stockHref } from './route';

describe('parseRoute', () => {
  it('reads the home and stock routes', () => {
    expect(parseRoute('')).toEqual({ page: 'home' });
    expect(parseRoute('#/')).toEqual({ page: 'home' });
    expect(parseRoute('#/stock/mtnn')).toEqual({ page: 'stock', symbol: 'MTNN' });
    expect(parseRoute(stockHref('NB'))).toEqual({ page: 'stock', symbol: 'NB' });
  });
});
