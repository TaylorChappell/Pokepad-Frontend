import { useState } from 'react';
import { Button } from './UI';
import { useOptionalApp } from '../state/AppContext';
import { WalletConnection } from './WalletConnection';
import type { PendingTransaction } from '../services/transactions';
export function TransactionStatus({
  pending,
  busy,
  status,
  error,
  onCheck,
}: {
  pending: PendingTransaction | null;
  busy: boolean;
  status: string;
  error: string;
  onCheck: (signature?: string) => void;
}) {
  const [signature, setSignature] = useState('');
  const app = useOptionalApp();
  const needsWallet =
    app?.mode === 'live' &&
    !app.session.signingReady &&
    pending &&
    !pending.signature &&
    !pending.signingStarted;
  return (
    <>
      {status && (
        <p className="transaction-status" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="transaction-error" role="alert">
          {error}
        </p>
      )}
      {pending && (
        <div className="transaction-status">
          <strong>{pending.intentId ? 'Pending transaction' : 'Saved transaction request'}</strong>
          {pending.signature ? (
            <a
              href={`https://solscan.io/tx/${encodeURIComponent(pending.signature)}${pending.chain === 'solana:devnet' ? '?cluster=devnet' : ''}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction on Solscan
            </a>
          ) : pending.signingStarted ? (
            <label>
              Transaction signature from your wallet
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Paste transaction signature"
                autoComplete="off"
              />
            </label>
          ) : (
            <p>
              Continue your saved request. Its reviewed details are preserved, so retrying cannot
              create a duplicate.
            </p>
          )}
          {needsWallet && <WalletConnection />}
          <Button
            variant="secondary"
            disabled={busy || Boolean(needsWallet)}
            onClick={() => onCheck(signature || undefined)}
          >
            {pending.signingStarted || pending.signature
              ? 'Check confirmation'
              : 'Continue transaction'}
          </Button>
        </div>
      )}
    </>
  );
}
