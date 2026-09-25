import type { Horizon, SummaryRow } from '../../pipeline/src/types';

export type SortKey = 'symbol' | 'name' | 'sector' | 'close' | 'volume' | Horizon;
export const TEXT_KEYS: SortKey[] = ['symbol', 'name', 'sector'];

export interface TableQuery {
  search: string;
  /** '' = all sectors */
  sector: string;
  sortKey: SortKey;
  sortDir: 'asc' | 'desc';
  showInactive: boolean;
}

function valueOf(r: SummaryRow, k: SortKey): string | number | null {
  switch (k) {
    case 'day':
    case 'week':
    case 'month':
    case '3m':
    case '6m':
    case 'ytd':
    case '1y':
      return r.changes[k];
    case 'close':
      return r.close;
    case 'volume':
      return r.volume;
    case 'symbol':
      return r.symbol;
    case 'name':
      return r.name;
    case 'sector':
      return r.sector;
  }
}

export function filterSort(rows: SummaryRow[], q: TableQuery): SummaryRow[] {
  const needle = q.search.trim().toLowerCase();
  const dir = q.sortDir === 'asc' ? 1 : -1;
  return rows
    .filter(
      (r) =>
        (q.showInactive || r.status === 'active') &&
        (!q.sector || r.sector === q.sector) &&
        (!needle || r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle)),
    )
    .sort((a, b) => {
      const va = valueOf(a, q.sortKey);
      const vb = valueOf(b, q.sortKey);
      if (va === null || vb === null) {
        if (va === vb) return a.symbol.localeCompare(b.symbol);
        return va === null ? 1 : -1; // missing values last in both directions
      }
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return c !== 0 ? c * dir : a.symbol.localeCompare(b.symbol);
    });
}

export function sectorsOf(rows: SummaryRow[]): string[] {
  return [...new Set(rows.map((r) => r.sector))].sort();
}
