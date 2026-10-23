import { useSyncExternalStore } from 'react';
import { useOptionalWalking } from '../state/WalkingContext';
import { Icon } from './UI';
import { walkingDistance } from '../services/walking-controller';
export function WalkingStatus({ path }: { path: string }) {
  const controller = useOptionalWalking();
  return controller ? <Status controller={controller} path={path} /> : null;
}
function Status({
  controller,
  path,
}: {
  controller: NonNullable<ReturnType<typeof useOptionalWalking>>;
  path: string;
}) {
  const walk = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  if (
    ['/walk', '/walking'].includes(path) ||
    (!walk.hasSession && !['requesting', 'connecting'].includes(walk.phase))
  )
    return null;
  const active = walk.phase === 'walking';
  const starting = ['requesting', 'connecting'].includes(walk.phase);
  return (
    <div className={'walking-status ' + (active ? 'is-active' : '')}>
      <a href="#/walk">
        <Icon name="Footprints" size={20} />
        <span>
          <strong>
            {active
              ? 'Walking active'
              : walk.phase === 'background'
                ? 'Walking paused in background'
                : 'Your walking session'}
          </strong>
          <small>{walkingDistance(walk.meters)} walked · View egg timers</small>
        </span>
        <Icon name="ArrowRight" size={16} />
      </a>
      <button
        type="button"
        onClick={() => (active || starting ? controller.pause() : void controller.start())}
        disabled={walk.phase === 'finishing'}
      >
        {starting ? 'Cancel' : active ? 'Pause' : 'Resume'}
      </button>
    </div>
  );
}
