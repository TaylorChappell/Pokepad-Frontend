import { useEffect, useRef, useState } from 'react';
import { useOptionalApp } from './AppContext';
import { apiRequest } from '../services/http';

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
  const app = useOptionalApp();
  const live = app?.mode === 'live';
  const mutation = useRef(false);
  const key = PREFIX + wallet;
  const [ids, setIds] = useState<string[]>(() => readWatchlist(key));
  useEffect(() => {
    if (live) {
      setIds(app?.state.watchlist || []);
      return;
    }
    setIds(readWatchlist(key));
    const update = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setIds(readWatchlist(key));
    };
    window.addEventListener('storage', update);
    return () => window.removeEventListener('storage', update);
  }, [key, live, app?.state.watchlist]);
  const toggle = (id: string) => {
    if (live) {
      if (!wallet || app?.session.status !== 'authenticated') {
        app?.toast('Connect your wallet to save a watchlist.');
        return;
      }
      if (mutation.current) return;
      mutation.current = true;
      void apiRequest<{ coinIds: string[] }>(`/v1/watchlist/${encodeURIComponent(id)}`, {
        method: ids.includes(id) ? 'DELETE' : 'PUT',
      })
        .then((result) => {
          setIds(result.coinIds);
          return app?.reload();
        })
        .catch((error) =>
          app?.toast(error instanceof Error ? error.message : 'Your watchlist could not be saved.'),
        )
        .finally(() => {
          mutation.current = false;
        });
      return;
    }
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
