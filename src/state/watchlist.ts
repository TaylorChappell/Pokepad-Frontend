import { useEffect, useState } from 'react';

const PREFIX = 'pokepad-watchlist-v1:';
function readWatchlist(key: string): string[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(saved)
      ? [...new Set(saved.filter((id): id is string => typeof id === 'string'))]
      : [];
  } catch {
    return [];
  }
}

/** Watchlists are a device preference, scoped to the connected trainer wallet. */
export function useCoinWatchlist(wallet: string) {
  const key = PREFIX + wallet;
  const [ids, setIds] = useState<string[]>(() => readWatchlist(key));
  useEffect(() => {
    setIds(readWatchlist(key));
    const update = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setIds(readWatchlist(key));
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [key]);
  const toggle = (id: string) => {
    setIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // The in-memory preference remains usable when browser storage is unavailable.
      }
      return next;
    });
  };
  return { ids, toggle };
}
