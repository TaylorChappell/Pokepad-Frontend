import { useEffect, useState } from 'react';
import { apiRequest } from '../services/http';
export function BackendStatus() {
  const [message, setMessage] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest<{ ready: boolean; services: Record<string, boolean> }>('/health/ready', {
      signal: controller.signal,
    })
      .then((status) => {
        const names: Record<string, string> = {
          launching: 'coin launches',
          trading: 'trading',
          rewards: 'new rewards',
          payouts: 'redemptions',
          walking: 'walking',
          battles: 'online battles',
        };
        const unavailable = Object.entries(names)
          .filter(([key]) => status.services?.[key] === false)
          .map(([, label]) => label);
        setMessage(
          unavailable.length ? 'Currently unavailable: ' + unavailable.join(', ') + '.' : '',
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            'Backend status could not be checked. Requests may be temporarily unavailable.',
          );
      });
    return () => controller.abort();
  }, []);
  return message ? (
    <div className="backend-status" role="status">
      {message}
    </div>
  ) : null;
}
