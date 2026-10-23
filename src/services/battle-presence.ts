import { API_BASE } from './http';
import type { BattleRoom } from './battles';

const key = (wallet: string) => `kanto.battle-room:${API_BASE}:${wallet}`;
export function savedBattleRoom(wallet: string): string | null {
  try {
    return localStorage.getItem(key(wallet));
  } catch {
    return null;
  }
}
export function rememberBattleRoom(wallet: string, roomId: string | null) {
  if (!wallet) return;
  try {
    if (roomId) localStorage.setItem(key(wallet), roomId);
    else localStorage.removeItem(key(wallet));
  } catch {
    /* The server can still restore an active room without browser storage. */
  }
}

/** Separate leases let a refresh or a second tab resume the same battle safely. */
export function startBattlePresence(options: {
  send: (
    body: { clientId: string; sequence: number; present: boolean },
    keepalive: boolean,
  ) => Promise<BattleRoom>;
  accept: (room: BattleRoom) => void;
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  clientId?: string;
  every?: (callback: () => void, ms: number) => ReturnType<typeof setInterval>;
  cancel?: (timer: ReturnType<typeof setInterval>) => void;
}) {
  const clientId = options.clientId || crypto.randomUUID();
  let sequence = 0,
    stopped = false,
    visible = options.document.visibilityState !== 'hidden';
  const send = (present: boolean, keepalive = false) => {
    const requestSequence = ++sequence;
    void options
      .send({ clientId, sequence: requestSequence, present }, keepalive)
      .then((room) => {
        if (!stopped && present && visible && requestSequence === sequence) options.accept(room);
      })
      .catch(() => {
        /* A missing heartbeat expires on the server; never invent presence locally. */
      });
  };
  const visibility = () => {
    const next = options.document.visibilityState !== 'hidden';
    if (next === visible || stopped) return;
    visible = next;
    send(visible, !visible);
  };
  const hide = () => {
    if (!stopped && visible) {
      visible = false;
      send(false, true);
    }
  };
  const show = () => {
    if (!stopped) {
      visible = options.document.visibilityState !== 'hidden';
      if (visible) send(true);
    }
  };
  send(visible);
  const timer = (options.every || setInterval)(() => {
    if (!stopped && visible) send(true);
  }, 5000);
  options.document.addEventListener('visibilitychange', visibility);
  options.window.addEventListener('pagehide', hide);
  options.window.addEventListener('pageshow', show);
  return () => {
    if (stopped) return;
    stopped = true;
    (options.cancel || clearInterval)(timer);
    options.document.removeEventListener('visibilitychange', visibility);
    options.window.removeEventListener('pagehide', hide);
    options.window.removeEventListener('pageshow', show);
    send(false, true);
  };
}
