import { useEffect, useMemo, useState } from 'react';
import bs58 from 'bs58';
import { API_BASE, apiRequest, ApiError } from './http';
import { signAndSendPrepared, type PreparedTransaction } from './wallet';

export interface TransactionRequest {
  preparePath: string;
  confirmPath: string;
  body: Record<string, unknown>;
}
export interface PendingTransaction extends TransactionRequest {
  wallet: string;
  kind: string;
  requestId: string;
  intentId?: string;
  mint?: string;
  chain?: PreparedTransaction['chain'];
  signature?: string;
  signingStarted?: boolean;
}
export interface TransactionConfirmation {
  status: 'pending' | 'confirmed';
  signature?: string;
  coinId?: string;
  mint?: string;
}
type IntentStatus = PreparedTransaction & {
  status?: 'prepared' | 'submitted' | 'confirmed' | 'failed' | 'expired';
  signature?: string | null;
};
export interface TransactionState {
  pending: PendingTransaction | null;
  busy: boolean;
  status: string;
  error: string;
}
function key(wallet: string, kind: string) {
  return `kanto.pending:${API_BASE}:${wallet}:${kind}`;
}
export function readPending(wallet: string, kind: string): PendingTransaction | null {
  try {
    const raw = JSON.parse(localStorage.getItem(key(wallet, kind)) || 'null');
    return raw?.wallet === wallet &&
      raw?.kind === kind &&
      typeof raw.requestId === 'string' &&
      typeof raw.preparePath === 'string' &&
      raw.preparePath.startsWith('/v1/coins/') &&
      typeof raw.confirmPath === 'string' &&
      raw.confirmPath.startsWith('/v1/coins/') &&
      raw.body &&
      typeof raw.body === 'object'
      ? raw
      : null;
  } catch {
    return null;
  }
}
function savePending(wallet: string, kind: string, pending: PendingTransaction | null) {
  if (pending) localStorage.setItem(key(wallet, kind), JSON.stringify(pending));
  else localStorage.removeItem(key(wallet, kind));
}
export function decimalToRaw(value: string, decimals: number): string {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18 ||
    !/^\d+(?:\.\d+)?$/.test(value.trim())
  )
    throw new Error('Enter a valid amount.');
  const [whole, fraction = ''] = value.trim().split('.');
  if (fraction.length > decimals)
    throw new Error(`This asset supports at most ${decimals} decimal places.`);
  const raw = BigInt(whole + fraction.padEnd(decimals, '0'));
  if (raw <= 0n) throw new Error('The amount must be greater than zero.');
  return raw.toString();
}
interface TransactionDependencies {
  request: typeof apiRequest;
  sign: (prepared: PreparedTransaction, onSigning?: () => void) => Promise<string>;
  read: (wallet: string, kind: string) => PendingTransaction | null;
  save: (wallet: string, kind: string, value: PendingTransaction | null) => void;
}
/** Persists the reviewed request before preparation and never re-signs an ambiguous send. */
export class TransactionController {
  state: TransactionState;
  private listeners = new Set<(state: TransactionState) => void>();
  private readonly deps: TransactionDependencies;
  constructor(
    readonly wallet: string,
    readonly kind: string,
    deps: Partial<TransactionDependencies> = {},
  ) {
    this.deps = {
      request: apiRequest,
      sign: signAndSendPrepared,
      read: readPending,
      save: savePending,
      ...deps,
    };
    this.state = { pending: this.deps.read(wallet, kind), busy: false, status: '', error: '' };
  }
  subscribe(listener: (state: TransactionState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update(patch: Partial<TransactionState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
  private remember(pending: PendingTransaction | null) {
    this.deps.save(this.wallet, this.kind, pending);
    this.update({ pending });
  }
  async execute(input: TransactionRequest): Promise<TransactionConfirmation | null> {
    if (this.state.busy || this.state.pending || !this.wallet) return null;
    try {
      this.remember({
        ...structuredClone(input),
        wallet: this.wallet,
        kind: this.kind,
        requestId: crypto.randomUUID(),
      });
    } catch {
      this.update({
        error:
          'Browser storage is unavailable. Enable storage so this transaction can be recovered before continuing.',
      });
      return null;
    }
    return this.confirm();
  }
  async confirm(suppliedSignature?: string): Promise<TransactionConfirmation | null> {
    let record = this.state.pending;
    if (!record || this.state.busy) return null;
    if (suppliedSignature) {
      try {
        if (bs58.decode(suppliedSignature.trim()).length !== 64) throw new Error();
      } catch {
        this.update({ error: 'Enter a valid Solana transaction signature.' });
        return null;
      }
      record = { ...record, signature: suppliedSignature.trim() };
    }
    this.update({
      busy: true,
      error: '',
      status: record.intentId
        ? 'Checking your saved transaction…'
        : 'Preparing your reviewed transaction…',
    });
    try {
      this.remember(record);
      const intent = record.intentId
        ? await this.deps.request<IntentStatus>(
            `/v1/transactions/${encodeURIComponent(record.intentId)}`,
          )
        : await this.deps.request<IntentStatus>(record.preparePath, {
            method: 'POST',
            json: { ...record.body, requestId: record.requestId },
            headers: { 'Idempotency-Key': record.requestId },
          });
      record = {
        ...record,
        intentId: intent.intentId,
        mint: intent.mint,
        chain: intent.chain,
        ...(intent.signature ? { signature: intent.signature } : {}),
      };
      this.remember(record);
      if (intent.status === 'expired' || intent.status === 'failed') {
        this.remember(null);
        this.update({
          status: '',
          error:
            intent.status === 'expired'
              ? 'This transaction expired without completing. You can review a new transaction.'
              : 'The transaction failed on Solana. You can review a new transaction.',
        });
        return null;
      }
      if (
        !record.signature &&
        !record.signingStarted &&
        intent.status !== 'submitted' &&
        intent.status !== 'confirmed'
      ) {
        this.update({ status: 'Review and approve the transaction in your wallet.' });
        const signature = await this.deps.sign(intent, () => {
          record = { ...record!, signingStarted: true };
          this.remember(record);
        });
        record = { ...record, signature };
        this.remember(record);
      }
      if (!record.signature) {
        this.update({
          status:
            'The wallet response was interrupted. Check again to recover the submission, or paste its signature from your wallet history. This will not send another transaction.',
        });
        return { status: 'pending', mint: record.mint };
      }
      const result = await this.deps.request<TransactionConfirmation>(record.confirmPath, {
        method: 'POST',
        json: { intentId: record.intentId, signature: record.signature },
        headers: { 'Idempotency-Key': record.intentId! },
      });
      if (result.status === 'confirmed') {
        this.remember(null);
        this.update({ status: 'Confirmed on Solana.' });
      } else
        this.update({
          status:
            'Submitted. Waiting for final confirmation. You can check again without sending another transaction.',
        });
      return result;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error &&
        'code' in error &&
        error.code === 4001 &&
        record.intentId
      ) {
        this.remember({ ...record, signingStarted: false });
        this.update({
          status: 'Cancelled in your wallet. Continue this same transaction, or let it expire.',
        });
      }
      // Prepare validation failures never created a chain intent. An ambiguous error always remains recoverable.
      if (
        !record.intentId &&
        error instanceof ApiError &&
        [400, 401, 403, 404, 422].includes(error.status)
      )
        this.remember(null);
      this.update({
        error:
          error instanceof Error
            ? error.message
            : 'This request could not finish. Your transaction is saved for recovery.',
      });
      return null;
    } finally {
      this.update({ busy: false });
    }
  }
}
export function useTransactionFlow(wallet: string, kind: string) {
  const controller = useMemo(() => new TransactionController(wallet, kind), [wallet, kind]);
  const [state, setState] = useState(controller.state);
  useEffect(() => {
    setState(controller.state);
    return controller.subscribe(setState);
  }, [controller]);
  return {
    ...state,
    execute: (input: TransactionRequest) => controller.execute(input),
    confirm: (_record?: PendingTransaction | null, signature?: string) =>
      controller.confirm(signature),
  };
}
