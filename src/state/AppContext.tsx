import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../services/api';
import type { Action, AppSnapshot } from '../types';
import { dismissBootScreen } from '../components/BootScreen';
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
    inFlight = useRef(false),
    actionQueue = useRef<Promise<unknown>>(Promise.resolve()),
    pendingActions = useRef(0);
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
    if (state || error) dismissBootScreen({ immediate: Boolean(error) });
  }, [state, error]);
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
      void act({ type: 'sync' });
    }
  }, [now, state]);
  const act = (action: Action): Promise<AppSnapshot | null> => {
    inFlight.current = true;
    pendingActions.current += 1;
    setBusy(true);
    const result = actionQueue.current.then(async () => {
      try {
        const s = await api.dispatch(action);
        setState(s);
        return s;
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
        return null;
      } finally {
        pendingActions.current -= 1;
        inFlight.current = pendingActions.current > 0;
        setBusy(inFlight.current);
      }
    });
    actionQueue.current = result;
    return result;
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
        <h1>Loading Kanto…</h1>
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
