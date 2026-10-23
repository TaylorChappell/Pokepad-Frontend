import { useEffect, useState, useSyncExternalStore } from 'react';
import { Button, Modal } from './UI';
import { asset } from '../utils';
import {
  getPhantomApproval,
  subscribePhantomApproval,
  markPhantomOpened,
  clearPhantomSession,
  type PhantomCallbackResult,
} from '../services/phantom-deeplink';
import { completeMobileSignIn } from '../services/wallet';
import { dismissBootScreen } from './BootScreen';
import App from '../App';

export function PhantomApprovalDialog() {
  const pending = useSyncExternalStore(subscribePhantomApproval, getPhantomApproval);
  if (!pending) return null;
  return (
    <div className="phantom-approval-layer">
      <Modal title={pending.title} onClose={pending.cancel} className="wallet-device">
        <div className="wallet-device-screen phantom-return-screen">
          <img className="phantom-return-logo" src={asset('wallets/phantom.svg')} alt="Phantom" />
          <h3>{pending.opened ? 'Waiting for your approval' : 'Ready for Phantom'}</h3>
          <p>
            {pending.opened
              ? 'Approve in Phantom, then return to this Kanto tab to finish.'
              : 'Phantom will show the details before you approve. Keep this Kanto tab open.'}
          </p>
          <a
            className="button primary"
            href={pending.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={markPhantomOpened}
          >
            Open Phantom
          </a>
          <Button variant="secondary" onClick={pending.cancel}>
            Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
}
export function PhantomReturn({ response }: { response: Promise<PhantomCallbackResult> }) {
  const [result, setResult] = useState<PhantomCallbackResult | null>(null);
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    dismissBootScreen({ immediate: true });
    let active = true;
    void response
      .then(async (value) => {
        if (value.kind === 'proof') {
          try {
            await completeMobileSignIn(value.proof);
          } catch (e) {
            clearPhantomSession();
            throw e;
          }
          window.history.replaceState(
            window.history.state,
            '',
            window.location.pathname + value.returnTo,
          );
          if (active) setComplete(true);
        } else {
          if (active) setResult(value);
          if (value.kind === 'delivered') window.close();
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Please connect again.');
      });
    return () => {
      active = false;
    };
  }, [response]);
  if (complete) return <App />;
  return (
    <main className="phantom-return-page">
      <section className="wallet-device phantom-return-card">
        <div className="wallet-device-screen phantom-return-screen">
          <img className="phantom-return-logo" src={asset('wallets/phantom.svg')} alt="Phantom" />
          <h1>
            {error
              ? 'Let’s try that again'
              : result?.kind === 'login'
                ? 'Confirm your trainer'
                : result?.kind === 'delivered'
                  ? 'Back to your Kanto tab'
                  : 'Checking your approval…'}
          </h1>
          <p>
            {error ||
              (result?.kind === 'login'
                ? 'Your wallet is connected. Sign one message to log in to Kanto in this browser. No payment is needed.'
                : result?.kind === 'delivered'
                  ? 'Return to your original Kanto tab to finish. You can close this tab.'
                  : 'Keep this page open for a moment.')}
          </p>
          {result?.kind === 'login' && (
            <>
              <a className="button primary" href={result.href}>
                Sign in with Phantom
              </a>
              <a
                className="button secondary"
                href={result.returnTo}
                onClick={() => {
                  result.cancel();
                  window.location.replace(window.location.pathname + result.returnTo);
                }}
              >
                Cancel
              </a>
            </>
          )}
          {result?.kind === 'delivered' && (
            <Button onClick={() => window.close()}>Close this tab</Button>
          )}
          {error && (
            <a className="button primary" href="./">
              Return to Kanto
            </a>
          )}
        </div>
      </section>
    </main>
  );
}
