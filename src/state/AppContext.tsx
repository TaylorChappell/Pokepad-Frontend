import { PageSkeleton } from '../components/Loading';
import { useSoundEffects } from '../audio/sound';
import { MOVE_LEARN_SOUND } from '../audio/catalog';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api as defaultApi, type KantoApi } from '../services/api';
import { createAccountUpdates } from '../services/account-updates';
import type { Action, AppSnapshot } from '../types';
import { dismissBootScreen } from '../components/BootScreen';
import {
  connectWallet,
  disconnectWallet,
  currentWalletSession,
  restoreWalletSession,
  resumeWalletSession,
  subscribeWalletSession,
  type WalletName,
  type WalletSession,
} from '../services/wallet';
interface ContextValue {
  state: AppSnapshot;
  mode: 'demo' | 'live';
  act: (a: Action) => Promise<AppSnapshot | null>;
  toast: (message: string) => void;
  now: number;
  busy: boolean;
  session: WalletSession;
  connectWallet: (name: WalletName) => Promise<void>;
  disconnectWallet: () => Promise<void>;
  reload: () => Promise<AppSnapshot | null>;
}
export const AppContext = createContext<ContextValue | null>(null);
const defaultWallet = {
  connectWallet,
  disconnectWallet,
  currentWalletSession,
  restoreWalletSession,
  resumeWalletSession,
  subscribeWalletSession,
};
export function AppProvider({
  children,
  api = defaultApi,
  wallet = defaultWallet,
}: {
  children: ReactNode;
  api?: KantoApi;
  wallet?: Omit<typeof defaultWallet, 'resumeWalletSession'> &
    Partial<Pick<typeof defaultWallet, 'resumeWalletSession'>>;
}) {
  const {
    connectWallet,
    disconnectWallet,
    currentWalletSession,
    restoreWalletSession,
    resumeWalletSession,
    subscribeWalletSession,
  } = wallet;
  const [state, setState] = useState<AppSnapshot | null>(null),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [session, setSession] = useState<WalletSession>(() =>
      api.mode === 'demo'
        ? { status: 'anonymous', wallet: null, provider: null, expiresAt: null }
        : currentWalletSession(),
    ),
    [now, setNow] = useState(Date.now());
  const learningAudio = useSoundEffects();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined),
    inFlight = useRef(false),
    actionQueue = useRef<Promise<unknown>>(Promise.resolve()),
    pendingActions = useRef(0);
  const sessionEpoch = useRef(0),
    loadId = useRef(0),
    initialized = useRef(false),
    foregroundLoads = useRef(0),
    sessionRefresh = useRef<Promise<AppSnapshot | null> | null>(null);
  const toast = (text: string) => {
    setMessage(text);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(''), 4500);
  };
  const load = async (keepScreen = false): Promise<AppSnapshot | null> => {
    const requestId = ++loadId.current;
    foregroundLoads.current++;
    setError('');
    try {
      const next = await api.load();
      if (requestId === loadId.current) setState(next);
      return next;
    } catch (e) {
      if (requestId === loadId.current && !keepScreen)
        setError(e instanceof Error ? e.message : 'The backend is unavailable.');
      return null;
    } finally {
      foregroundLoads.current--;
    }
  };
  useEffect(() => {
    let active = true;
    let previousWallet = currentWalletSession().wallet;
    const stop = subscribeWalletSession((next) => {
      setSession(next);
      if (next.status === 'connecting' || next.status === 'checking') return;
      const changedAccount = previousWallet !== next.wallet;
      const previousAccount = previousWallet;
      const wasSignedIn = previousAccount !== null;
      previousWallet = next.wallet;
      if (initialized.current && changedAccount) {
        sessionEpoch.current++;
        // Keep the public screen and connection dialog alive during sign-in.
        // A real sign-out/account switch still removes the old private snapshot immediately.
        if (wasSignedIn)
          setState((current) => (current?.profile.wallet === previousAccount ? null : current));
        sessionRefresh.current = load(next.status === 'authenticated' && !wasSignedIn);
      }
    });
    void (async () => {
      if (api.mode === 'live') {
        try {
          await restoreWalletSession();
        } catch {
          /* Public browsing still works when a session cannot be restored. */
        }
      }
      if (active) {
        initialized.current = true;
        await load();
      }
    })();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(timer.current);
      active = false;
      stop();
    };
  }, []);
  useEffect(() => {
    if (api.mode !== 'live' || !resumeWalletSession) return;
    const resume = () => {
      if (document.visibilityState !== 'hidden' && initialized.current)
        void resumeWalletSession().catch(() => {});
    };
    window.addEventListener('focus', resume);
    window.addEventListener('pageshow', resume);
    window.addEventListener('hashchange', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('focus', resume);
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('hashchange', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [api.mode, resumeWalletSession]);
  useEffect(() => {
    if (!state) return;
    document.documentElement.dataset.motion = state.profile.reducedMotion ? 'reduced' : 'normal';
  }, [state?.profile.reducedMotion]);
  useEffect(() => {
    if (error) dismissBootScreen({ immediate: true });
  }, [state, error]);
  useEffect(() => {
    if (!state || api.mode !== 'demo') return;
    const recovered = state.pokemon.some(
      (p) => !p.locked && typeof p.recoverAt === 'number' && p.recoverAt <= now,
    );
    const ready = state.rewards.some(
      (r) =>
        r.kind === 'egg' &&
        !r.openedAt &&
        r.readyAt <= now &&
        !state.notifications.some((n) => n.id === 'ready-' + r.id),
    );
    if (
      (recovered ||
        (ready && state.profile.rewardNotifications) ||
        now - (state.demoCandyUpdatedAt || now) >= 60000) &&
      !inFlight.current
    ) {
      void act({ type: 'sync' });
    }
  }, [now, state]);
  useEffect(() => {
    if (api.mode !== 'live' || session.status !== 'authenticated' || !session.wallet) return;
    const updates = createAccountUpdates({
      wallet: session.wallet,
      load: () => api.load(),
      canRefresh: () =>
        initialized.current &&
        !inFlight.current &&
        foregroundLoads.current === 0 &&
        document.visibilityState !== 'hidden',
      revision: () => loadId.current,
      apply: (snapshot) => {
        setState(snapshot);
        setError('');
      },
    });
    const refresh = () => void updates.refresh();
    const interval = setInterval(refresh, 10000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      updates.stop();
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [session.status, session.wallet]);
  const act = (action: Action): Promise<AppSnapshot | null> => {
    if (api.mode === 'live' && session.status !== 'authenticated') {
      if (action.type !== 'sync') toast('Connect your wallet to continue.');
      return Promise.resolve(null);
    }
    if (action.type === 'pokemon.learn' || action.type === 'pokemon.manual')
      learningAudio.unlock(MOVE_LEARN_SOUND);
    const epoch = sessionEpoch.current;
    loadId.current += 1;
    inFlight.current = true;
    pendingActions.current += 1;
    setBusy(true);
    const result = actionQueue.current.then(async () => {
      try {
        if (epoch !== sessionEpoch.current) return null;
        const s = await api.dispatch(action);
        if (epoch !== sessionEpoch.current) return null;
        setState(s);
        if (action.type === 'pokemon.learn' || action.type === 'pokemon.manual')
          learningAudio.play(MOVE_LEARN_SOUND);
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
        <button className="button primary" onClick={() => void load()}>
          Retry connection
        </button>
      </div>
    );
  if (!state) return <PageSkeleton />;
  return (
    <AppContext.Provider
      value={{
        state,
        mode: api.mode,
        act,
        toast,
        now,
        busy,
        session,
        connectWallet: async (name) => {
          await connectWallet(name);
          const next = await sessionRefresh.current;
          if (!next || next.profile.wallet !== currentWalletSession().wallet)
            throw new Error(
              'You’re signed in, but your trainer couldn’t load. Please try reconnecting.',
            );
        },
        disconnectWallet,
        reload: () => load(),
      }}
    >
      {children}
      {message && (
        <div className="toast" role="status">
          {message}
          <button aria-label="Dismiss notification" onClick={() => setMessage('')}>
            ×
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('AppProvider is required');
  return ctx;
}

export function useOptionalApp() {
  return useContext(AppContext);
}
