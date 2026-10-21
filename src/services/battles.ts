import type { BattleAction, BattleState } from '../battle/engine';
import type { Profile } from '../types';
import { apiRequest } from './http';

export type OnlineWager = 'friendly' | 'pokemon';
export interface BattleRoom {
  id: string;
  status: 'waiting' | 'active' | 'finished' | 'cancelled';
  wager: OnlineWager;
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
}
export interface OpenBattleRoom {
  id: string;
  wager: OnlineWager;
  teamSize: number;
  hostWallet: string;
  hostName: string;
  deadlineAt: string;
}
export function createBattleClient(request: typeof apiRequest = apiRequest) {
  return {
    list: (signal?: AbortSignal) => request<{ rooms: OpenBattleRoom[] }>('/v1/battles', { signal }),
    current: (signal?: AbortSignal) =>
      request<{ room: BattleRoom | null }>('/v1/battles/mine', { signal }),
    read: (id: string, signal?: AbortSignal) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id), { signal }),
    create: (
      pokemonIds: string[],
      wager: OnlineWager,
      visibility: 'public' | 'invite',
      requestId: string,
    ) =>
      request<BattleRoom>('/v1/battles', {
        method: 'POST',
        json: { pokemonIds, wager, visibility, requestId, acceptPokemonRisk: wager === 'pokemon' },
      }),
    join: (id: string, pokemonIds: string[], wager: OnlineWager, inviteCode?: string) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id) + '/join', {
        method: 'POST',
        json: {
          pokemonIds,
          wager,
          acceptPokemonRisk: wager === 'pokemon',
          ...(inviteCode ? { inviteCode } : {}),
        },
      }),
    command: (id: string, turn: number, action: BattleAction, requestId: string) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id) + '/commands', {
        method: 'POST',
        json: { turn, action: { kind: action.kind, index: action.index }, requestId },
      }),
    leave: (id: string) =>
      request<BattleRoom>('/v1/battles/' + encodeURIComponent(id) + '/leave', {
        method: 'POST',
        json: {},
      }),
  };
}
const client = createBattleClient();
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
