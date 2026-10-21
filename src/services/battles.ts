import type { BattleAction, BattleState } from '../battle/engine';
import type { Profile } from '../types';
import { apiRequest } from './http';
import { decimalToRaw } from './transactions';

export type OnlineWager = 'friendly' | 'pokemon' | 'sol' | 'token';
export interface MonetaryTerms {
  wagerAmount: string;
  wagerMint?: string;
}
export interface BattleTerms {
  wager: OnlineWager;
  wagerAmount?: string | null;
  wagerMint?: string | null;
  wagerDecimals?: number | null;
  wagerSymbol?: string | null;
}
export interface BattleCapabilities {
  friendly: boolean;
  pokemon: boolean;
  sol: boolean;
  token: boolean;
  monetaryWagerReason?: string;
  tokens?: { mint: string; symbol: string; name: string; decimals: number }[];
  solDecimals?: number;
  turnSeconds: number;
  waitingSeconds: number;
  recoverySeconds: number;
  maxTeamSize: number;
}
export interface BattleEscrow {
  initialized?: boolean;
  chain?: 'solana:mainnet' | 'solana:devnet';
  asset: 'sol' | 'token';
  mint: string | null;
  amount: string;
  decimals?: number;
  symbol?: string;
  address: string | null;
  deposits: { host: boolean; guest: boolean };
  status:
    | 'awaiting-opponent'
    | 'funding'
    | 'funded'
    | 'settling'
    | 'settled'
    | 'refund-available'
    | 'refunded';
  depositDeadlineAt?: string | null;
  refundAvailableAt?: string | null;
  settlementSignature?: string | null;
  recipientTokenAccounts?: { host?: string; guest?: string };
}
export interface BattleRoom extends BattleTerms {
  id: string;
  status: 'waiting' | 'funding' | 'active' | 'finished' | 'cancelled';
  visibility: 'public' | 'invite';
  teamSize: number;
  revision: number;
  yourSeat: 0 | 1;
  yourPokemonIds: string[];
  opponentWallet: string | null;
  trainers: Pick<Profile, 'wallet' | 'displayName' | 'character' | 'accessoryColor'>[];
  deadlineAt: string | null;
  serverTime: string;
  inviteCode?: string;
  submitted: boolean;
  opponentSubmitted: boolean;
  state: BattleState | null;
  winnerWallet: string | null;
  resultReason: string | null;
  settledAt: string | null;
  escrow?: BattleEscrow;
}
export interface OpenBattleRoom extends BattleTerms {
  id: string;
  teamSize: number;
  hostWallet: string;
  hostName: string;
  deadlineAt: string;
  status?: BattleRoom['status'];
}
export function monetaryTerms(
  wager: OnlineWager,
  amount: string,
  token?: { mint: string; decimals: number },
): MonetaryTerms | undefined {
  if (wager !== 'sol' && wager !== 'token') return undefined;
  if (wager === 'token' && (!token?.mint || !Number.isInteger(token.decimals)))
    throw new Error('Choose an available wager token.');
  return {
    wagerAmount: decimalToRaw(amount, wager === 'sol' ? 9 : token!.decimals),
    ...(wager === 'token' ? { wagerMint: token!.mint } : {}),
  };
}
export function formatRawAmount(raw: string, decimals: number) {
  if (!/^\d+$/.test(raw) || !Number.isInteger(decimals) || decimals < 0 || decimals > 18)
    return 'Unavailable';
  const padded = raw.padStart(decimals + 1, '0');
  const whole = decimals ? padded.slice(0, -decimals) : padded;
  const fraction = decimals ? padded.slice(-decimals).replace(/0+$/, '') : '';
  return whole.replace(/^0+(?=\d)/, '') + (fraction ? '.' + fraction : '');
}
export function battleWagerLabel(room: BattleTerms) {
  if (room.wager === 'friendly') return 'Friendly';
  if (room.wager === 'pokemon') return 'Pokémon wager';
  if (!room.wagerAmount || typeof room.wagerDecimals !== 'number')
    return room.wager === 'sol' ? 'SOL wager' : 'Token wager';
  return (
    formatRawAmount(room.wagerAmount, room.wagerDecimals) +
    ' ' +
    (room.wagerSymbol || (room.wager === 'sol' ? 'SOL' : 'tokens'))
  );
}
function stakeBody(wager: OnlineWager, terms?: MonetaryTerms) {
  if (wager !== 'sol' && wager !== 'token') return {};
  if (!terms || !/^[1-9]\d*$/.test(terms.wagerAmount) || (wager === 'token' && !terms.wagerMint))
    throw new Error('Review a valid wager amount and token before continuing.');
  return {
    wagerAmount: terms.wagerAmount,
    ...(wager === 'token' ? { wagerMint: terms.wagerMint } : {}),
    acceptMonetaryRisk: true,
  };
}
export function createBattleClient(request: typeof apiRequest = apiRequest) {
  return {
    capabilities: (signal?: AbortSignal) =>
      request<BattleCapabilities>('/v1/battles/capabilities', { signal }),
    list: (signal?: AbortSignal) => request<{ rooms: OpenBattleRoom[] }>('/v1/battles', { signal }),
    current: (signal?: AbortSignal) =>
      request<{ room: BattleRoom | null }>('/v1/battles/mine', { signal }),
    read: (id: string, signal?: AbortSignal) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id), { signal }),
    preview: (id: string, inviteCode?: string, signal?: AbortSignal) =>
      request<OpenBattleRoom>(
        '/v1/battles/' +
          encodeURIComponent(id) +
          '/preview' +
          (inviteCode ? '?inviteCode=' + encodeURIComponent(inviteCode) : ''),
        { signal },
      ),
    create: (
      pokemonIds: string[],
      wager: OnlineWager,
      visibility: 'public' | 'invite',
      requestId: string,
      terms?: MonetaryTerms,
    ) =>
      request<BattleRoom>('/v1/battles', {
        method: 'POST',
        json: {
          pokemonIds,
          wager,
          visibility,
          requestId,
          acceptPokemonRisk: wager === 'pokemon',
          ...stakeBody(wager, terms),
        },
      }),
    join: (
      id: string,
      pokemonIds: string[],
      wager: OnlineWager,
      inviteCode?: string,
      terms?: MonetaryTerms,
    ) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id) + '/join', {
        method: 'POST',
        json: {
          pokemonIds,
          wager,
          acceptPokemonRisk: wager === 'pokemon',
          ...(inviteCode ? { inviteCode } : {}),
          ...stakeBody(wager, terms),
        },
      }),
    command: (
      id: string,
      turn: number,
      action: BattleAction,
      requestId: string,
      phase: 'turn' | 'replacement' = 'turn',
    ) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id) + '/commands', {
        method: 'POST',
        json: { turn, phase, action: { kind: action.kind, index: action.index }, requestId },
      }),
    leave: (id: string) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id) + '/leave', {
        method: 'POST',
        json: {},
      }),
  };
}
const client = createBattleClient();
export const loadBattleCapabilities = client.capabilities;
export const previewBattleRoom = client.preview;
export const listBattleRooms = client.list;
export const currentBattleRoom = client.current;
export const readBattleRoom = client.read;
export const createOnlineBattle = client.create;
export const joinOnlineBattle = client.join;
export const sendBattleCommand = client.command;
export const leaveOnlineBattle = client.leave;
/** Discard stale polls that raced a command response. */
export const newestBattleRoom = (current: BattleRoom | null, incoming: BattleRoom) =>
  current?.id === incoming.id && current.revision > incoming.revision ? current : incoming;
