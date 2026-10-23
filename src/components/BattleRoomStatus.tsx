import { useApp } from '../state/AppContext';
import { Icon, Pokeball } from './UI';
import { battleWagerLabel, type BattleRoom } from '../services/battles';

export function battleClock(deadline: string | null | undefined, now: number) {
  if (!deadline) return '—';
  const seconds = Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function BattleJourney({ room }: { room: BattleRoom }) {
  const monetary = room.wager === 'sol' || room.wager === 'token';
  const steps = [
    { label: 'Find a rival', status: 'waiting' },
    { label: 'Agree the match', status: 'review' },
    ...(monetary ? [{ label: 'Pay your stake', status: 'funding' }] : []),
    { label: 'Battle', status: 'active' },
  ];
  const current =
    room.status === 'finished'
      ? steps.length
      : steps.findIndex((step) => step.status === room.status);
  if (room.status === 'cancelled') return null;
  return (
    <ol className="battle-journey" aria-label="Battle progress">
      {steps.map((step, index) => (
        <li
          key={step.status}
          className={index < current ? 'complete' : index === current ? 'current' : ''}
          aria-current={index === current ? 'step' : undefined}
        >
          <span aria-hidden="true">
            {index < current ? <Icon name="Check" size={13} /> : <i />}
          </span>
          {step.label}
        </li>
      ))}
    </ol>
  );
}

export function RoomNextStep({
  room,
  clockOffset = 0,
}: {
  room: BattleRoom;
  clockOffset?: number;
}) {
  const { now } = useApp();
  const own = room.review?.teams.find((team) => team.seat === room.yourSeat);
  const other = room.review?.teams.find((team) => team.seat !== room.yourSeat);
  const monetary = room.wager === 'sol' || room.wager === 'token';
  let title = '',
    text = '';
  if (room.status === 'waiting') {
    title = 'Waiting for a rival to join';
    text =
      room.visibility === 'public'
        ? 'Your room is listed for other trainers. Share your invitation to play with a friend, or stay here for someone to join.'
        : 'Share your invitation with a friend. Only trainers with the link can join this room.';
  } else if (room.status === 'review') {
    title = own?.accepted
      ? 'You’re ready. Waiting for your rival.'
      : other?.accepted
        ? 'Your rival accepted. It’s your turn.'
        : 'Check the matchup, then accept';
    text = own?.accepted
      ? `Keep this room open. ${monetary ? 'Payment opens' : 'The battle starts'} automatically when your rival accepts.`
      : `Look over both teams and the rules below. ${monetary ? 'Accepting does not send money; you’ll approve your stake in your wallet next.' : 'You can propose changes or chat before you accept.'}`;
  }
  if (!title) return null;
  return (
    <div className="battle-next-step" role="status">
      <div className="battle-next-ball" aria-hidden="true">
        <Pokeball size={32} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      {room.deadlineAt && (
        <span className="battle-room-clock" aria-live="off">
          <small>Room closes in</small>
          <b>{battleClock(room.deadlineAt, now + clockOffset)}</b>
        </span>
      )}
    </div>
  );
}

export function BattlePresenceNotice({
  room,
  clockOffset = 0,
}: {
  room: BattleRoom;
  clockOffset?: number;
}) {
  const { now } = useApp();
  if (!['review', 'funding', 'active'].includes(room.status)) return null;
  const rival = room.presence?.find((entry) => entry.wallet === room.opponentWallet);
  if (rival?.status !== 'away') return null;
  const name =
    room.trainers.find((trainer) => trainer.wallet === room.opponentWallet)?.displayName ||
    'Your rival';
  return (
    <div className="battle-away-notice" role="status">
      <Icon name="Clock" size={20} />
      <div>
        <strong>{name} has left the arena</strong>
        <p>
          {rival.forfeitAt
            ? 'They can return to this battle. Turns keep counting down; a missed turn can end it sooner.'
            : room.status === 'funding'
              ? 'Waiting for them to return. The payment deadline keeps counting down.'
              : 'Waiting for them to return before the match can start.'}
        </p>
      </div>
      {rival.forfeitAt && (
        <span aria-live="off">
          <small>Forfeit in</small>
          <b>{battleClock(rival.forfeitAt, now + clockOffset)}</b>
        </span>
      )}
    </div>
  );
}

export function WaitingStake({ room }: { room: BattleRoom }) {
  return (
    <div className="battle-payment-preview">
      <span>Your stake</span>
      <strong>{battleWagerLabel(room)}</strong>
      <div className="battle-payment-lock">
        <Icon name="Lock" size={18} />
        <b>Nothing to pay yet</b>
      </div>
      <p>
        Both trainers must join and accept the match first. Then a <b>Pay with wallet</b> button
        will appear here.
      </p>
    </div>
  );
}
