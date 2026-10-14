import { useEffect, useState } from 'react';

export type Route = { page: 'home' } | { page: 'stock'; symbol: string };

export function parseRoute(hash: string): Route {
  const m = /^#\/stock\/([^/?#]+)\/?$/.exec(hash);
  if (!m) return { page: 'home' };
  try {
    const symbol = decodeURIComponent(m[1]).toUpperCase();
    if (!symbol) return { page: 'home' };
    return { page: 'stock', symbol };
  } catch {
    return { page: 'home' };
  }
}

export const stockHref = (symbol: string) => `#/stock/${encodeURIComponent(symbol)}`;

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
