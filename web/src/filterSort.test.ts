import { describe, expect, it } from 'vitest';
import { filterSort, sectorsOf, type TableQuery } from './filterSort';
import { makeRow } from './testData';

const rows = [
  makeRow({ symbol: 'MTNN', name: 'MTN Nigeria Communications Plc', sector: 'ICT', close: 863, changes: { day: 0.94, week: 5, month: null } }),
  makeRow({ symbol: 'NB', name: 'Nigerian Breweries Plc', sector: 'CONSUMER GOODS', close: 76, changes: { day: -1.3, week: null, month: 2 } }),
  makeRow({ symbol: 'GONE', name: 'Delisted Plc', sector: 'ICT', status: 'inactive', changes: { day: 9, week: 9, month: 9 } }),
];
const q = (over: Partial<TableQuery> = {}): TableQuery => ({ search: '', sector: '', sortKey: 'symbol', sortDir: 'asc', showInactive: false, ...over });

describe('filterSort', () => {
  it('hides inactive stocks unless asked', () => {
    expect(filterSort(rows, q()).map((r) => r.symbol)).toEqual(['MTNN', 'NB']);
    expect(filterSort(rows, q({ showInactive: true })).map((r) => r.symbol)).toEqual(['GONE', 'MTNN', 'NB']);
  });
  it('searches symbol and name, case-insensitively', () => {
    expect(filterSort(rows, q({ search: 'brew' })).map((r) => r.symbol)).toEqual(['NB']);
    expect(filterSort(rows, q({ search: 'mtn' })).map((r) => r.symbol)).toEqual(['MTNN']);
  });
  it('filters by sector', () => {
    expect(filterSort(rows, q({ sector: 'CONSUMER GOODS' })).map((r) => r.symbol)).toEqual(['NB']);
  });
  it('sorts numbers either way and always puts missing values last', () => {
    expect(filterSort(rows, q({ sortKey: 'close', sortDir: 'desc' })).map((r) => r.symbol)).toEqual(['MTNN', 'NB']);
    expect(filterSort(rows, q({ sortKey: 'week', sortDir: 'desc' })).map((r) => r.symbol)).toEqual(['MTNN', 'NB']);
    expect(filterSort(rows, q({ sortKey: 'week', sortDir: 'asc' })).map((r) => r.symbol)).toEqual(['MTNN', 'NB']);
  });
});

describe('sectorsOf', () => {
  it('lists distinct sectors alphabetically', () => {
    expect(sectorsOf(rows)).toEqual(['CONSUMER GOODS', 'ICT']);
  });
});
