import type { PendingTransaction } from '../services/transactions';
export function TransactionStatus({
  pending,
  status,
  error,
}: {
  pending: PendingTransaction | null;
  status: string;
  error: string;
}) {
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
      {pending?.signature && (
        <a
          href={`https://solscan.io/tx/${encodeURIComponent(pending.signature)}${pending.chain === 'solana:devnet' ? '?cluster=devnet' : ''}`}
          target="_blank"
          rel="noreferrer"
        >
          View transaction on Solscan
        </a>
      )}
    </>
  );
}
