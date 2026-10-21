import bs58 from 'bs58';
import { API_BASE, apiRequest, ApiError } from './http';
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
/** A reviewed escrow operation survives reloads and interrupted wallet responses. */
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
  async run(action: EscrowAction): Promise<FundingResult | null> {
    if (this.state.busy) return null;
    if (!this.state.pending) {
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
    } else if (this.state.pending.action !== action) {
      this.update({
        error: 'Resolve your saved transaction before starting another escrow action.',
      });
      return null;
    }
    return this.check();
  }
  async check(suppliedSignature?: string): Promise<FundingResult | null> {
    let record = this.state.pending;
    if (!record || this.state.busy) return null;
    if (suppliedSignature) {
      try {
        if (bs58.decode(suppliedSignature.trim()).length !== 64) throw new Error();
      } catch {
        this.update({ error: 'Enter the complete Solana transaction signature from your wallet.' });
        return null;
      }
      record = { ...record, signature: suppliedSignature.trim() };
    }
    this.update({
      busy: true,
      error: '',
      message: record.intentId
        ? 'Checking your escrow transaction…'
        : 'Preparing your escrow transaction…',
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
      };
      this.remember(record);
      if (intent.status === 'failed' || intent.status === 'expired') {
        this.remember(null);
        this.update({
          message: '',
          error:
            intent.status === 'expired'
              ? 'The escrow transaction expired. Review the room before trying again.'
              : 'The escrow transaction failed on Solana.',
        });
        return null;
      }
      if (
        !record.signature &&
        !record.signingStarted &&
        !['submitted', 'confirmed'].includes(intent.status || '')
      ) {
        this.update({
          message:
            record.action === 'deposit'
              ? 'Approve your exact wager in your wallet.'
              : 'Approve the escrow refund transaction in your wallet.',
        });
        const signature = await this.deps.sign(
          { ...intent, mint: intent.mint || '' },
          () => {
            record = { ...record!, signingStarted: true };
            this.remember(record);
          },
          `${prefix(this.roomId)}/submit`,
        );
        record = { ...record, signature };
        this.remember(record);
      }
      if (!record.signature) {
        this.update({
          message:
            'Your wallet response was interrupted. Check the saved transaction or paste its signature; Kanto will not send a second deposit.',
        });
        return { status: 'pending' };
      }
      const result = await this.deps.request<FundingResult>(`${prefix(this.roomId)}/confirm`, {
        method: 'POST',
        json: { intentId: record.intentId, signature: record.signature },
      });
      if (result.status === 'confirmed') {
        this.remember(null);
        this.update({
          message:
            record.action === 'deposit'
              ? 'Your wager is confirmed in escrow.'
              : 'Your escrow refund is confirmed.',
        });
      } else this.update({ message: 'Submitted. Waiting for confirmation on Solana.' });
      return result;
    } catch (error) {
      if (typeof error === 'object' && error && 'code' in error && error.code === 4001)
        this.remember({ ...record, signingStarted: false });
      if (
        !record.intentId &&
        error instanceof ApiError &&
        [400, 403, 404, 422].includes(error.status)
      )
        this.remember(null);
      this.update({
        error:
          error instanceof Error
            ? error.message
            : 'Escrow is temporarily unavailable. Your transaction is saved.',
      });
      return null;
    } finally {
      this.update({ busy: false });
    }
  }
}
