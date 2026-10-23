type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Share an expiring, server-verified sign-in across this site's browser tabs. */
export function createBrowserWalletStorage(sessionKey: string, signedOutKey: string) {
  let storage: SessionStorage | undefined;
  return (): SessionStorage | undefined => {
    if (storage) return storage;
    if (typeof window === 'undefined') return undefined;
    let tab: SessionStorage | undefined;
    try {
      tab = window.sessionStorage;
    } catch {
      /* Cookies can still authenticate. */
    }
    try {
      const persistent = window.localStorage;
      const migrationKey = sessionKey + ':persistent';
      const migrated = persistent.getItem(migrationKey);
      // Writing the migration marker also checks that persistent storage is usable.
      persistent.setItem(migrationKey, '1');
      if (!migrated && !persistent.getItem(sessionKey) && !persistent.getItem(signedOutKey)) {
        const signedOut = tab?.getItem(signedOutKey);
        const session = tab?.getItem(sessionKey);
        if (signedOut) persistent.setItem(signedOutKey, signedOut);
        else if (session) persistent.setItem(sessionKey, session);
      }
      // Never resurrect an older tab's credentials after a shared logout/account switch.
      try {
        tab?.removeItem(sessionKey);
        tab?.removeItem(signedOutKey);
      } catch {
        /* The shared record is already authoritative. */
      }
      storage = persistent;
    } catch {
      storage = tab;
    }
    return storage;
  };
}

export function watchWalletStorage(sessionKey: string, signedOutKey: string, changed: () => void) {
  if (typeof window === 'undefined') return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === sessionKey || event.key === signedOutKey) {
      try {
        if (event.storageArea !== window.localStorage) return;
      } catch {
        return;
      }
      changed();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
