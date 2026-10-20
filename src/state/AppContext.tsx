import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Action, AppSnapshot } from '../types';
interface ContextValue {
  state: AppSnapshot;
  mode: 'demo' | 'live';
  act: (a: Action) => Promise<AppSnapshot | null>;
  toast: (message: string) => void;
  now: number;
  busy: boolean;
}
const Context = createContext<ContextValue | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppSnapshot | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [now, setNow] = useState(Date.now());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined),
    inFlight = useRef(false);
  const toast = (text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 4500);
  };
  const load = () => {
    setError('');
    api
      .load()
      .then(setState)
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(timer.current);
    };
  }, []);
  useEffect(() => {
    if (!state) return;
    document.documentElement.dataset.motion = state.profile.reducedMotion ? 'reduced' : 'normal';
  }, [state?.profile.reducedMotion]);
  useEffect(() => {
    if (!state) return;
    const ready = state.rewards.some(
      (r) =>
        r.kind === 'egg' &&
        !r.openedAt &&
        r.readyAt <= now &&
        !state.notifications.some((n) => n.id === 'ready-' + r.id),
    );
    if (ready && state.profile.rewardNotifications && !inFlight.current) {
      inFlight.current = true;
      api
        .dispatch({ type: 'sync' })
        .then(setState)
        .catch(() => {})
        .finally(() => {
          inFlight.current = false;
        });
    }
  }, [now, state]);
  const act = async (action: Action) => {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    try {
      const s = await api.dispatch(action);
      setState(s);
      return s;
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      return null;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  };
  if (error)
    return (
      <div className="app-loading">
        <div className="pokeball-mark" />
        <h1>Let’s try that again</h1>
        <p>{error}</p>
        <button className="button primary" onClick={load}>
          Retry connection
        </button>
      </div>
    );
  if (!state)
    return (
      <div className="app-loading">
        <div className="pokeball-mark loading-ball" />
        <h1>Loading Poképad…</h1>
      </div>
    );
  return (
    <Context.Provider value={{ state, mode: api.mode, act, toast, now, busy }}>
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
          <button aria-label="Dismiss notification" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export function useApp() {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('AppProvider is required');
  return ctx;
}

export function useOptionalApp() {
  return useContext(Context);
}
