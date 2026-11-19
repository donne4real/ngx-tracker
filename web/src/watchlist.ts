const KEY = 'ngx-watchlist';

/** Starred symbols from localStorage ([] if missing, corrupt, or unavailable). */
export function loadWatchlist(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((s): s is string => typeof s === 'string');
  } catch {
    return [];
  }
}

export function saveWatchlist(symbols: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(symbols));
  } catch {
    // storage unavailable (private mode/quota) — the watchlist just won't persist
  }
}
