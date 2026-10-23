import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { readBattleRoom, currentBattleRoom, type BattleRoom } from '../services/battles';
import { savedBattleRoom } from '../services/battle-presence';
import { battleClock } from './BattleRoomStatus';
import { Icon } from './UI';

/** Reading a saved match never renews arena presence while browsing other pages. */
export function BattleResumeNotice({ path }: { path: string }) {
  const { mode, session, now } = useApp();
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    setRoom(null);
    if (path.startsWith('/battles') || mode !== 'live' || session.status !== 'authenticated')
      return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let active = false;
      try {
        const id = savedBattleRoom(session.wallet || '');
        const current = (await currentBattleRoom(abort.signal)).room;
        const next = current || (id ? await readBattleRoom(id, abort.signal) : null);
        if (!abort.signal.aborted) {
          setRoom(next);
          active = !!next && ['active', 'funding', 'review', 'waiting'].includes(next.status);
          if (next) setOffset(Date.parse(next.serverTime) - Date.now());
        }
      } catch {
        if (!abort.signal.aborted) setRoom(null);
      }
      if (!abort.signal.aborted) timer = setTimeout(poll, active ? 5000 : 30000);
    };
    void poll();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [path, mode, session.status, session.wallet]);
  if (
    path.startsWith('/battles') ||
    !room ||
    !['active', 'funding', 'review', 'waiting'].includes(room.status)
  )
    return null;
  const away = room.presence?.find((entry) => entry.wallet === session.wallet);
  return (
    <a className="battle-resume-notice" href={'#/battles?room=' + room.id}>
      <Icon name="Swords" size={22} />
      <span>
        <strong>
          {room.status === 'active' ? 'Your battle is still running' : 'Your battle room is saved'}
        </strong>
        <small>
          {room.status === 'active'
            ? 'Return to play. Turn timers keep running.'
            : room.status === 'funding'
              ? 'Return to check your stake and your rival’s payment.'
              : 'Return to check on your rival.'}
        </small>
      </span>
      <b>
        {room.status === 'active' && away?.forfeitAt
          ? battleClock(away.forfeitAt, now + offset) + ' to return'
          : 'Return to room'}{' '}
        <Icon name="ArrowRight" size={15} />
      </b>
    </a>
  );
}
