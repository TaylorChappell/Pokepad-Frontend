export interface ServiceStatus {
  ready: boolean;
  services: Record<string, boolean>;
}
const features = [
  ['rewards', 'Egg & pack drops', 'New eggs and packs aren’t being sent out.'],
  ['payouts', 'Pokémon sales', 'Selling Pokémon for SOL is paused.'],
  ['launching', 'Coin launches', 'New coins can’t be launched right now.'],
  ['trading', 'Coin trading', 'Buying and selling coins is paused.'],
  ['walking', 'Walking boosts', 'Walking can’t speed up your eggs right now.'],
  ['battles', 'Online battles', 'Online battles can’t be started right now.'],
] as const;
export function serviceNotice(status: ServiceStatus) {
  if (!status.ready)
    return {
      title: 'Kanto is taking a short break',
      details: ['Some features aren’t available right now. Please try again shortly.'],
    };
  const paused = features.filter(([key]) => status.services[key] === false);
  if (!paused.length) return null;
  const title =
    paused.length === 1
      ? paused[0][1] + ' paused'
      : paused.length === 2 && paused.every(([key]) => key === 'rewards' || key === 'payouts')
        ? 'Rewards & Pokémon sales are paused'
        : 'Some features are paused';
  return { title, details: paused.map(([, , explanation]) => explanation) };
}

export const STATUS_CONFIRM_MS = 10000;
export const STATUS_POLL_MS = 30000;
export type ServiceNotice = ReturnType<typeof serviceNotice>;
const connectionNotice = {
  title: 'Having trouble connecting',
  details: ['We can’t check which features are available. Please try again.'],
};

/** A single missed check is not an outage. Confirm it with a fresh response. */
export class ServiceStatusMonitor {
  notice: ServiceNotice = null;
  private candidate: { key: string; since: number; lastSeen: number } | null = null;

  get confirming() {
    return this.candidate !== null;
  }

  record(status: ServiceStatus | null, now = Date.now()): ServiceNotice {
    const next = status === null ? connectionNotice : serviceNotice(status);
    const key = JSON.stringify(next);
    if (!next || key === JSON.stringify(this.notice)) {
      this.candidate = null;
      this.notice = next;
    } else {
      const previous = this.candidate;
      // A hidden/suspended tab must recheck; old observations cannot confirm
      // a new outage. Focus events cannot bypass the confirmation period.
      if (
        !previous ||
        previous.key !== key ||
        now < previous.lastSeen ||
        now - previous.lastSeen > STATUS_POLL_MS * 2
      ) {
        this.candidate = { key, since: now, lastSeen: now };
      } else if (now - previous.since >= STATUS_CONFIRM_MS) {
        this.notice = next;
        this.candidate = null;
      } else {
        this.candidate = { ...previous, lastSeen: now };
      }
    }
    return this.notice;
  }
}
