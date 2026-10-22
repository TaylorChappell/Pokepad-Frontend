import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../services/http';
import {
  ServiceStatusMonitor,
  STATUS_CONFIRM_MS,
  STATUS_POLL_MS,
  type ServiceNotice,
  type ServiceStatus,
} from '../services/service-status';
import { asset } from '../utils';

export { serviceNotice, type ServiceStatus } from '../services/service-status';

async function fetchStatus(signal: AbortSignal): Promise<ServiceStatus> {
  const status = await apiRequest<ServiceStatus>('/health/ready', {
    signal,
    auth: false,
    credentials: 'omit',
    cache: 'no-store',
  });
  if (
    !status ||
    typeof status.ready !== 'boolean' ||
    !status.services ||
    typeof status.services !== 'object' ||
    Array.isArray(status.services)
  ) {
    throw new Error('Invalid service status');
  }
  return status;
}

export function BackendStatus({
  loadStatus = fetchStatus,
}: {
  loadStatus?: (signal: AbortSignal) => Promise<ServiceStatus>;
}) {
  const [notice, setNotice] = useState<ServiceNotice>(null);
  const [checking, setChecking] = useState(false);
  const retry = useRef<() => void>(() => {});
  useEffect(() => {
    const monitor = new ServiceStatusMonitor();
    let request: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    setNotice(null);
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, monitor.confirming ? STATUS_CONFIRM_MS : STATUS_POLL_MS);
    };
    async function check() {
      if (stopped || request) return;
      clearTimeout(timer);
      const controller = new AbortController();
      request = controller;
      setChecking(true);
      try {
        const status = await loadStatus(controller.signal);
        if (!stopped && !controller.signal.aborted) setNotice(monitor.record(status));
      } catch {
        // A failed request cannot establish that rewards or sales are paused.
        if (!stopped && !controller.signal.aborted) setNotice(monitor.record(null));
      } finally {
        request = null;
        if (!stopped) {
          setChecking(false);
          schedule();
        }
      }
    }
    function refresh() {
      if (document.visibilityState !== 'hidden') void check();
      else schedule();
    }
    retry.current = () => void check();
    void check();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      stopped = true;
      clearTimeout(timer);
      request?.abort();
      retry.current = () => {};
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadStatus]);
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
        onClick={() => retry.current()}
        disabled={checking}
      >
        {checking ? 'Checking…' : 'Check again'}
        <span aria-hidden="true">↻</span>
      </button>
    </section>
  );
}
