import { useEffect, useMemo, useRef, useState } from 'react';
import { API_BASE, apiRequest } from './http';
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
/** Failed attempts are discarded; potentially submitted transactions are only checked, never re-signed. */
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
    if (this.state.pending && !this.state.pending.signingStarted && !this.state.pending.signature)
      this.discard();
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
  private discard() {
    try {
      this.deps.save(this.wallet, this.kind, null);
    } catch {
      // Keep the current page usable even if the browser has disabled storage.
    }
    this.update({ pending: null });
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
    return this.process(true);
  }
  async confirm(): Promise<TransactionConfirmation | null> {
    return this.process(false);
  }
  private async process(allowSigning: boolean): Promise<TransactionConfirmation | null> {
    let record = this.state.pending;
    if (!record || this.state.busy) return null;
    if (!allowSigning && (!record.intentId || (!record.signature && !record.signingStarted))) {
      this.discard();
      return null;
    }
    this.update({
      busy: true,
      error: '',
      status: record.intentId
        ? 'Waiting for confirmation on Solana…'
        : 'Preparing your transaction…',
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
        ...(['submitted', 'confirmed'].includes(intent.status || '')
          ? { signingStarted: true }
          : {}),
      };
      this.remember(record);
      if (intent.status === 'expired' || intent.status === 'failed') {
        this.discard();
        this.update({
          status: '',
          error:
            intent.status === 'expired'
              ? 'This transaction expired. Please try again.'
              : 'The transaction failed on Solana. Please try again.',
        });
        return null;
      }
      if (intent.status === 'confirmed') {
        this.discard();
        this.update({ status: 'Confirmed on Solana.' });
        return {
          status: 'confirmed',
          signature: record.signature,
          mint: record.mint,
          ...(this.kind === 'launch' ? { coinId: record.mint } : {}),
        };
      }
      if (
        allowSigning &&
        !record.signature &&
        !record.signingStarted &&
        intent.status !== 'submitted'
      ) {
        this.update({ status: 'Review and approve the transaction in your wallet.' });
        const signature = await this.deps.sign(intent, () => {
          const signing = { ...record!, signingStarted: true };
          this.remember(signing);
          record = signing;
        });
        record = { ...record, signature };
        this.remember(record);
      }
      if (!record.signature) {
        this.update({
          status: 'Checking whether your wallet sent the transaction. This updates automatically.',
        });
        return { status: 'pending', mint: record.mint };
      }
      const result = await this.deps.request<TransactionConfirmation>(record.confirmPath, {
        method: 'POST',
        json: { intentId: record.intentId, signature: record.signature },
        headers: { 'Idempotency-Key': record.intentId! },
      });
      if (result.status === 'confirmed') {
        this.discard();
        this.update({ status: 'Confirmed on Solana.' });
      } else
        this.update({
          status: 'Submitted. Waiting for confirmation on Solana…',
        });
      return result;
    } catch (error) {
      const rejected =
        typeof error === 'object' &&
        error &&
        'code' in error &&
        String(error.code) === '4001' &&
        !record.signature;
      const mayBeSubmitted = !rejected && Boolean(record.signingStarted || record.signature);
      if (!mayBeSubmitted) this.discard();
      this.update({
        status: mayBeSubmitted
          ? 'Checking whether your transaction completed. This updates automatically.'
          : rejected
            ? 'Cancelled in your wallet.'
            : '',
        error: rejected
          ? ''
          : error instanceof Error
            ? error.message
            : 'The transaction failed. Please try again.',
      });
      return null;
    } finally {
      this.update({ busy: false });
    }
  }
}
export function useTransactionFlow(
  wallet: string,
  kind: string,
  onConfirmed?: (result: TransactionConfirmation) => void | Promise<void>,
) {
  const controller = useMemo(() => new TransactionController(wallet, kind), [wallet, kind]);
  const [state, setState] = useState(controller.state);
  const confirmed = useRef(onConfirmed);
  confirmed.current = onConfirmed;
  useEffect(() => {
    setState(controller.state);
    return controller.subscribe(setState);
  }, [controller]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const check = async () => {
      try {
        const { pending, busy } = controller.state;
        if (!busy && (pending?.signingStarted || pending?.signature)) {
          const result = await controller.confirm();
          if (active && result?.status === 'confirmed') await confirmed.current?.(result);
        }
      } finally {
        if (active) timer = setTimeout(() => void check().catch(() => {}), 4000);
      }
    };
    timer = setTimeout(() => void check().catch(() => {}), 4000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [controller]);
  return {
    ...state,
    execute: (input: TransactionRequest) => controller.execute(input),
  };
}
