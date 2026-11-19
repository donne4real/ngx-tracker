import { afterEach, describe, expect, it } from 'vitest';
import { loadWatchlist, saveWatchlist } from './watchlist';

afterEach(() => localStorage.clear());

describe('watchlist persistence', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadWatchlist()).toEqual([]);
  });

  it('round-trips symbols through localStorage', () => {
    saveWatchlist(['MTNN', 'GTCO']);
    expect(loadWatchlist()).toEqual(['MTNN', 'GTCO']);
  });

  it('ignores corrupt or non-array JSON instead of throwing', () => {
    localStorage.setItem('ngx-watchlist', '{not json');
    expect(loadWatchlist()).toEqual([]);
    localStorage.setItem('ngx-watchlist', '{"a":1}');
    expect(loadWatchlist()).toEqual([]);
    localStorage.setItem('ngx-watchlist', JSON.stringify(['MTNN', 42, null]));
    expect(loadWatchlist()).toEqual(['MTNN']);
  });
});
