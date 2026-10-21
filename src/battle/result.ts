import type { BattleRoom } from '../services/battles';

/** A combat result and an on-chain payout are separate confirmations. */
export function monetaryBattleResult(room: BattleRoom): string {
  if (!room.escrow) return 'Wager details are syncing.';
  switch (room.escrow.status) {
    case 'settled':
      return room.state?.winner === 'draw'
        ? 'Draw · the escrow return is confirmed.'
        : room.state?.winner === 'player'
          ? 'Your winnings are confirmed on-chain.'
          : 'The escrow payout to your rival is confirmed.';
    case 'refunded':
      return 'The escrow refund is confirmed.';
    case 'refund-available':
      return 'Escrow refunds are available. Open wager details to reclaim your deposit.';
    default:
      return 'Battle complete · escrow settlement is pending confirmation.';
  }
}
