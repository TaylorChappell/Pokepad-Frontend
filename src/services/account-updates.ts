import type { AppSnapshot } from '../types';

/** A background read must never overwrite a newer action, wallet or foreground reload. */
export function createAccountUpdates(options: {
  wallet: string;
  load: () => Promise<AppSnapshot>;
  canRefresh: () => boolean;
  revision: () => number;
  apply: (snapshot: AppSnapshot) => void;
}) {
  let stopped = false;
  let running = false;
  return {
    async refresh() {
      if (stopped || running || !options.canRefresh()) return;
      running = true;
      const revision = options.revision();
      try {
        const snapshot = await options.load();
        if (
          !stopped &&
          options.canRefresh() &&
          options.revision() === revision &&
          snapshot.profile.wallet === options.wallet
        )
          options.apply(snapshot);
      } catch {
        // Keep the current screen through a temporary outage. Authentication errors
        // are handled by the shared transport; the next visible refresh retries.
      } finally {
        running = false;
      }
    },
    stop() {
      stopped = true;
    },
  };
}
