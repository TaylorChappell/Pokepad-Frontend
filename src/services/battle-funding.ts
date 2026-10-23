import { API_BASE, apiRequest } from './http';
import { signAndSendPrepared, type PreparedTransaction } from './wallet';
import type { BattleRoom } from './battles';
export type EscrowAction = 'deposit' | 'refund';
export type EscrowIntent = Omit<PreparedTransaction, 'mint'> & {
  mint?: string;
  status?: 'prepared' | 'submitted' | 'confirmed' | 'failed' | 'expired';
  signature?: string | null;
};
export interface FundingRecord {
  wallet: string;
  roomId: string;
  action: EscrowAction;
  requestId: string;
  intentId?: string;
  signature?: string;
  signingStarted?: boolean;
  chain?: PreparedTransaction['chain'];
}
export interface FundingState {
  pending: FundingRecord | null;
  busy: boolean;
  message: string;
  error: string;
}
export interface FundingResult {
  status: 'pending' | 'confirmed';
  signature?: string;
  room?: BattleRoom;
}
const prefix = (room: string) => `/v1/battles/${encodeURIComponent(room)}/escrow`;
const storageKey = (wallet: string, room: string) =>
  `kanto.battle-funding:${API_BASE}:${wallet}:${room}`;
interface FundingDependencies {
  request: typeof apiRequest;
  sign: typeof signAndSendPrepared;
  load: (wallet: string, room: string) => FundingRecord | null;
  save: (wallet: string, room: string, value: FundingRecord | null) => void;
}
const storage: Pick<FundingDependencies, 'load' | 'save'> = {
  load(wallet, room) {
    try {
      const value = JSON.parse(localStorage.getItem(storageKey(wallet, room)) || 'null');
      return value?.wallet === wallet &&
        value.roomId === room &&
        ['deposit', 'refund'].includes(value.action) &&
        typeof value.requestId === 'string'
        ? value
        : null;
    } catch {
      return null;
    }
  },
  save(wallet, room, value) {
    if (value) localStorage.setItem(storageKey(wallet, room), JSON.stringify(value));
    else localStorage.removeItem(storageKey(wallet, room));
  },
};
/** Discard failed attempts while tracking potentially submitted deposits and refunds. */
export class BattleFundingController {
  state: FundingState;
  private listeners = new Set<(state: FundingState) => void>();
  private deps: FundingDependencies;
  constructor(
    readonly wallet: string,
    readonly roomId: string,
    dependencies: Partial<FundingDependencies> = {},
  ) {
    this.deps = { request: apiRequest, sign: signAndSendPrepared, ...storage, ...dependencies };
    this.state = { pending: this.deps.load(wallet, roomId), busy: false, message: '', error: '' };
    if (this.state.pending && !this.state.pending.signingStarted && !this.state.pending.signature)
      this.discard();
  }
  subscribe(listener: (state: FundingState) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private update(patch: Partial<FundingState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }
  private remember(pending: FundingRecord | null) {
    this.deps.save(this.wallet, this.roomId, pending);
    this.update({ pending });
  }
  private discard() {
    try {
      this.deps.save(this.wallet, this.roomId, null);
    } catch {
      // Keep the current page usable even if the browser has disabled storage.
    }
    this.update({ pending: null });
  }
  async run(action: EscrowAction): Promise<FundingResult | null> {
    if (this.state.busy || this.state.pending || !this.wallet) return null;
    try {
      this.remember({
        wallet: this.wallet,
        roomId: this.roomId,
        action,
        requestId: crypto.randomUUID(),
      });
    } catch {
      this.update({
        error:
          'Enable browser storage before funding a battle, so an interrupted transaction can be recovered.',
      });
      return null;
    }
    return this.process(true);
  }
  async check(): Promise<FundingResult | null> {
    return this.process(false);
  }
  private async process(allowSigning: boolean): Promise<FundingResult | null> {
    let record = this.state.pending;
    if (!record || this.state.busy) return null;
    if (!allowSigning && (!record.intentId || (!record.signature && !record.signingStarted))) {
      this.discard();
      return null;
    }
    this.update({
      busy: true,
      error: '',
      message: record.intentId ? 'Checking your payment…' : 'Preparing your wallet payment…',
    });
    try {
      this.remember(record);
      const intent = record.intentId
        ? await this.deps.request<EscrowIntent>(
            `${prefix(this.roomId)}/intents/${encodeURIComponent(record.intentId)}`,
          )
        : await this.deps.request<EscrowIntent>(`${prefix(this.roomId)}/prepare`, {
            method: 'POST',
            json: { requestId: record.requestId, action: record.action },
          });
      record = {
        ...record,
        intentId: intent.intentId,
        chain: intent.chain,
        ...(intent.signature ? { signature: intent.signature } : {}),
        ...(['submitted', 'confirmed'].includes(intent.status || '')
          ? { signingStarted: true }
          : {}),
      };
      this.remember(record);
      if (intent.status === 'failed' || intent.status === 'expired') {
        this.discard();
        this.update({
          message: '',
          error:
            intent.status === 'expired'
              ? 'The payment request expired. Check the room before trying again.'
              : 'The payment failed on Solana.',
        });
        return null;
      }
      if (intent.status === 'confirmed') {
        this.discard();
        this.update({
          message:
            record.action === 'deposit'
              ? 'Your stake has been received.'
              : 'Your stake has been returned to your wallet.',
        });
        return { status: 'confirmed', signature: record.signature };
      }
      if (
        allowSigning &&
        !record.signature &&
        !record.signingStarted &&
        intent.status !== 'submitted'
      ) {
        this.update({
          message:
            record.action === 'deposit'
              ? 'Approve your exact wager in your wallet.'
              : 'Approve the refund in your wallet.',
        });
        const signature = await this.deps.sign(
          { ...intent, mint: intent.mint || '' },
          () => {
            const signing = { ...record!, signingStarted: true };
            this.remember(signing);
            record = signing;
          },
          `${prefix(this.roomId)}/submit`,
        );
        record = { ...record, signature };
        this.remember(record);
      }
      if (!record.signature) {
        this.update({
          message: 'Checking whether your wallet sent the transaction. This updates automatically.',
        });
        return { status: 'pending' };
      }
      const result = await this.deps.request<FundingResult>(`${prefix(this.roomId)}/confirm`, {
        method: 'POST',
        json: { intentId: record.intentId, signature: record.signature },
      });
      if (result.status === 'confirmed') {
        this.discard();
        this.update({
          message:
            record.action === 'deposit'
              ? 'Your stake has been received.'
              : 'Your stake has been returned to your wallet.',
        });
      } else this.update({ message: 'Submitted. Waiting for confirmation on Solana.' });
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
        message: mayBeSubmitted
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
