import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Button, Icon, Modal, Pokeball } from './UI';
import type { WalletName } from '../services/wallet';
import { asset } from '../utils';
import { phantomMobileLink } from '../services/phantom-mobile';

function connectionError(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error && error.code === 4001)
    return 'Sign-in was cancelled in your wallet. Choose your wallet to try again.';
  const message = error instanceof Error ? error.message : '';
  if (/reject|denied|cancel/i.test(message))
    return 'Sign-in was cancelled in your wallet. Choose your wallet to try again.';
  return message || 'Kanto couldn’t sign you in. Please try again.';
}
export function WalletConnection({ compact = false }: { compact?: boolean }) {
  const { mode, session, connectWallet, disconnectWallet, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [phantomLink, setPhantomLink] = useState<string | null>(null);
  if (mode === 'demo') return null;
  const connecting = pending || session.status === 'connecting';
  const stage =
    session.step === 'signing'
      ? 'Approve the sign-in message in your wallet.'
      : session.step === 'verifying'
        ? 'Checking your signature with Kanto…'
        : session.status === 'authenticated' && pending
          ? 'Loading your trainer…'
          : `Open ${session.provider || 'your wallet'} to continue.`;
  async function connect(name: WalletName) {
    setError('');
    const mobileLink = name === 'Phantom' ? phantomMobileLink() : null;
    if (mobileLink) {
      setPhantomLink(mobileLink);
      window.location.assign(mobileLink);
      return;
    }
    setPhantomLink(null);
    setPending(true);
    try {
      await connectWallet(name);
      setOpen(false);
    } catch (e) {
      setError(connectionError(e));
    } finally {
      setPending(false);
    }
  }
  const disconnect = (
    <Button
      type="button"
      variant="secondary"
      onClick={() =>
        void disconnectWallet().catch(() =>
          toast('You’re signed out here. Reconnect your wallet to sign in again.'),
        )
      }
    >
      Disconnect wallet
    </Button>
  );
  return (
    <>
      {session.status === 'authenticated' && session.signingReady && !open ? (
        disconnect
      ) : (
        <Button
          type="button"
          className={compact ? 'header-connect' : 'trainer-connect-button'}
          disabled={session.status === 'checking' || session.restoringProvider}
          aria-label={
            session.restoringProvider
              ? 'Restoring wallet'
              : session.status === 'authenticated'
                ? 'Reconnect wallet'
                : 'Connect wallet'
          }
          onClick={() => {
            setError('');
            setPhantomLink(null);
            setOpen(true);
          }}
        >
          <Pokeball size={21} />
          <span>
            {session.restoringProvider
              ? 'Restoring'
              : session.status === 'authenticated'
                ? 'Reconnect'
                : 'Connect'}
            <span className="wallet-button-extra"> wallet</span>
          </span>
          <Icon name="ChevronRight" size={17} />
        </Button>
      )}
      {open && (
        <Modal
          title="Connect to Kanto"
          onClose={() => setOpen(false)}
          closeDisabled={connecting}
          className="wallet-device"
        >
          <div className="wallet-device-lights search-device-lights" aria-hidden="true">
            <span className="search-device-lens" />
            <i />
            <i />
            <i />
          </div>
          <div className="wallet-device-screen">
            <header>
              <Pokeball size={38} />
              <div>
                <h3>Your wallet. Your trainer.</h3>
                <p>Choose a wallet to enter Kanto.</p>
              </div>
            </header>
            <div className="wallet-provider-list">
              {(['Phantom', 'MetaMask'] as WalletName[]).map((name) => (
                <button
                  type="button"
                  className={'wallet-provider ' + name.toLowerCase()}
                  key={name}
                  disabled={connecting}
                  onClick={() => void connect(name)}
                >
                  <span className="wallet-provider-logo">
                    <img
                      width={42}
                      height={42}
                      src={asset('wallets/' + name.toLowerCase() + '.svg')}
                      alt=""
                    />
                  </span>
                  <span className="wallet-provider-copy">
                    <strong>{name}</strong>
                    <small>Solana wallet</small>
                  </span>
                  <Icon name="ChevronRight" size={20} />
                </button>
              ))}
            </div>
            {connecting && (
              <div className="wallet-connection-progress" role="status">
                <Pokeball size={24} />
                <span>{stage}</span>
              </div>
            )}
            {error && (
              <div className="wallet-error" role="alert">
                <strong>Let’s try that again</strong>
                <p>{error}</p>
              </div>
            )}
            {phantomLink && (
              <div className="wallet-connection-progress" role="status">
                <span>Opening Kanto in Phantom…</span>
                <a href={phantomLink}>Open Phantom</a>
              </div>
            )}
            <div className="wallet-signature-note">
              <Icon name="Lock" size={18} />
              <span>Sign a message to log in. No payment or transaction.</span>
            </div>
          </div>
          <p className="wallet-device-help">On mobile, choosing Phantom opens its app.</p>
        </Modal>
      )}
    </>
  );
}
