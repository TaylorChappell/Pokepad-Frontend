import { useState } from 'react';
import { useApp } from '../state/AppContext';
import { Button, Icon, Modal } from './UI';
import type { WalletName } from '../services/wallet';

export function WalletConnection({ compact = false }: { compact?: boolean }) {
  const { mode, session, connectWallet, disconnectWallet, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  if (mode === 'demo') return null;
  const connecting = session.status === 'connecting';
  async function connect(name: WalletName) {
    setError('');
    try {
      await connectWallet(name);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet connection failed.');
    }
  }
  const disconnect = (
    <Button
      variant="secondary"
      onClick={() =>
        void disconnectWallet().catch(() =>
          toast(
            'Signed out on this browser. Server session revocation could not be confirmed; reconnect to sign in again.',
          ),
        )
      }
    >
      Disconnect wallet
    </Button>
  );
  if (session.status === 'authenticated' && session.signingReady) return disconnect;
  return (
    <>
      <Button className={compact ? 'header-connect' : ''} onClick={() => setOpen(true)}>
        <Icon name="Wallet" size={18} />
        {session.status === 'authenticated' ? 'Reconnect wallet' : 'Connect wallet'}
      </Button>
      {session.status === 'authenticated' && disconnect}
      {open && (
        <Modal title="Connect to Kanto" onClose={() => setOpen(false)} closeDisabled={connecting}>
          <div className="modal-body wallet-connect-dialog">
            <p>
              Choose your Solana wallet. Sign a one-time message to verify your account. Signing in
              does not move funds.
            </p>
            {(['Phantom', 'MetaMask'] as WalletName[]).map((name) => (
              <Button
                key={name}
                variant="secondary"
                disabled={connecting}
                onClick={() => void connect(name)}
              >
                <Icon name="Wallet" size={20} />
                {connecting && session.provider === name ? `Waiting for ${name}…` : name}
                <span>Solana</span>
              </Button>
            ))}
            {error && (
              <p className="wallet-error" role="alert">
                {error}
              </p>
            )}
            <small>
              On a phone, open Kanto in your wallet’s browser. Only Solana accounts are supported.
            </small>
          </div>
        </Modal>
      )}
    </>
  );
}
