import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/http';
import { asset } from '../utils';

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
export function BackendStatus() {
  const [notice, setNotice] = useState<ReturnType<typeof serviceNotice>>(null);
  const [checking, setChecking] = useState(false);
  const request = useRef<AbortController | null>(null);
  const check = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setChecking(true);
    try {
      const status = await apiRequest<ServiceStatus>('/health/ready', {
        signal: controller.signal,
        auth: false,
        credentials: 'omit',
      });
      if (!controller.signal.aborted) setNotice(serviceNotice(status));
    } catch {
      if (!controller.signal.aborted)
        setNotice({
          title: 'Having trouble connecting',
          details: ['We can’t check which features are available. Please try again.'],
        });
    } finally {
      if (request.current === controller) request.current = null;
      if (!controller.signal.aborted) setChecking(false);
    }
  }, []);
  useEffect(() => {
    void check();
    const refresh = () => {
      if (document.visibilityState !== 'hidden') void check();
    };
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      request.current?.abort();
      request.current = null;
    };
  }, [check]);
  if (!notice) return null;
  return (
    <section className="backend-status trainer-notice" aria-label="Kanto service notice">
      <div className="trainer-notice-emblem" aria-hidden="true">
        <img src={asset('brand/kanto-emblem.png')} alt="" />
      </div>
      <div className="trainer-notice-copy" role="status" aria-live="polite">
        <h2>{notice.title}</h2>
        <p>{notice.details.join(' ')}</p>
      </div>
      <button
        className="trainer-notice-retry"
        type="button"
        onClick={() => void check()}
        disabled={checking}
      >
        {checking ? 'Checking…' : 'Check again'}
        <span aria-hidden="true">↻</span>
      </button>
    </section>
  );
}
