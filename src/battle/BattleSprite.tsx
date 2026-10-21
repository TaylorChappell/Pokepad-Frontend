import { useEffect, useRef, type CSSProperties } from 'react';
import { pokemonById } from '../data/pokemon';
import { asset } from '../utils';
import type { Side } from './engine';
import {
  getBattleIdleFrames,
  getBattlePoseFrames,
  type BattleActorGeometry,
  type BattlePoseOptions,
} from './geometry';

/** Native FRLG art is preserved; separate pose and atlas layers never alter its crop. */
export function BattleSprite({
  speciesId,
  shiny = false,
  side,
  className = '',
  style,
  actor,
  pose,
  poseKey,
  reducedMotion = false,
  paused = false,
}: {
  speciesId: number;
  shiny?: boolean;
  side: Side;
  className?: string;
  style?: CSSProperties;
  actor?: BattleActorGeometry;
  pose?: BattlePoseOptions;
  poseKey?: string;
  reducedMotion?: boolean;
  paused?: boolean;
}) {
  const species = pokemonById(speciesId);
  const facing = side === 'player' ? 'back' : 'front';
  const index = species.id - 1;
  const column = index % 13;
  const row = Math.floor(index / 13);
  const layer = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!actor || reducedMotion || paused || !layer.current?.animate) return;
    const media =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    if (media?.matches) return;
    const anim = layer.current.animate(
      pose?.motion ? getBattlePoseFrames(actor, pose) : getBattleIdleFrames(actor),
      {
        duration: pose?.motion ? pose.durationMs || 800 : actor.idleDuration,
        iterations: pose?.motion ? 1 : Infinity,
        easing: pose?.motion ? 'steps(8, end)' : 'steps(4, end)',
        fill: 'none',
      },
    );
    const onPreference = (event: MediaQueryListEvent) => {
      if (event.matches) anim.cancel();
    };
    media?.addEventListener?.('change', onPreference);
    return () => {
      anim.cancel();
      media?.removeEventListener?.('change', onPreference);
    };
  }, [
    species.id,
    actor?.rect.size,
    actor?.idle,
    actor?.idleAmplitude,
    actor?.idleDuration,
    poseKey,
    pose?.motion,
    pose?.durationMs,
    pose?.impactAt,
    pose?.vector?.x,
    pose?.vector?.y,
    reducedMotion,
    paused,
  ]);
  return (
    <span
      className={'battle-native-sprite ' + className}
      role="img"
      aria-label={species.name + (shiny ? ', shiny' : '')}
      data-facing={facing}
      data-species={species.id}
      data-idle={actor?.idle}
      data-pose={pose?.motion || 'idle'}
      style={{ display: 'block', width: '100%', height: '100%', aspectRatio: '1 / 1', ...style }}
    >
      <span
        ref={layer}
        className="battle-sprite-pose"
        style={{ display: 'block', width: '100%', height: '100%' }}
      >
        <span
          className="battle-sprite-pixels"
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            backgroundImage: `url("${asset(`battle/sprites/${facing}${shiny ? '-shiny' : ''}.svg`)}")`,
            backgroundSize: '1300% 1200%',
            backgroundPosition: `${(column / 12) * 100}% ${(row / 11) * 100}%`,
            backgroundRepeat: 'no-repeat',
            imageRendering: 'pixelated',
          }}
        />
      </span>
    </span>
  );
}
