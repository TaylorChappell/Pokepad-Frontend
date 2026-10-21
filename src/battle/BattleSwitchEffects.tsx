import { useEffect, useState } from 'react';
import { NativeEffectSprite } from '../components/BattleEffects';
import { asset } from '../utils';
import type { BattleScene } from './geometry';
import type { BattleCue } from './presentation';
import { sampleSwitchVisual } from './switch-presentation';

const now = () => (typeof performance === 'undefined' ? 0 : performance.now());
function SwitchSequence({
  cue,
  scene,
  startedAt,
  explicitReduced,
}: {
  cue: BattleCue;
  scene: BattleScene;
  startedAt: number;
  explicitReduced: boolean;
}) {
  const [systemReduced, setSystemReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  const reducedMotion = explicitReduced || systemReduced;
  const [time, setTime] = useState(now);
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const update = () => setSystemReduced(!!media?.matches);
    media?.addEventListener('change', update);
    return () => media?.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (reducedMotion) {
      const timer = window.setTimeout(
        () => setTime(now()),
        Math.max(0, startedAt + cue.durationMs * 0.65 - now()),
      );
      return () => window.clearTimeout(timer);
    }
    let raf = 0,
      last = -1;
    const tick = (clock: number) => {
      const frame = Math.floor((clock - startedAt) / (1000 / 30));
      if (frame !== last) {
        last = frame;
        setTime(clock);
      }
      if (clock - startedAt < cue.durationMs) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [startedAt, cue.durationMs, reducedMotion]);
  const visual = sampleSwitchVisual(
    scene,
    cue.side,
    cue.switchPhase!,
    time - startedAt,
    cue.durationMs,
    reducedMotion,
  );
  const { ball } = visual;
  const size = 30 * ball.pixelScale;
  const sprite = asset('pixel/items/poke-ball.png');
  return (
    <div
      className="battle-switch-effects"
      data-switch-phase={cue.switchPhase}
      data-switch-side={cue.side}
      data-switch-progress={visual.progress}
      aria-hidden="true"
    >
      {ball.opacity > 0 && (
        <div
          className="battle-switch-ball"
          data-ball-open={ball.open > 0}
          style={{
            left: ball.x,
            top: ball.y,
            width: size,
            height: size,
            opacity: ball.opacity,
            transform: `translate(-50%, -50%) rotate(${ball.rotation}deg)`,
          }}
        >
          <img
            className="battle-switch-ball-top"
            src={sprite}
            alt=""
            draggable={false}
            style={{ transform: `translateY(${-Math.round(ball.open * 5) * ball.pixelScale}px)` }}
          />
          <img
            className="battle-switch-ball-bottom"
            src={sprite}
            alt=""
            draggable={false}
            style={{ transform: `translateY(${Math.round(ball.open * 2) * ball.pixelScale}px)` }}
          />
        </div>
      )}
      {visual.energy.map((particle, i) => (
        <span
          key={i}
          className={'battle-switch-energy' + (particle.recall ? ' is-recall' : '')}
          style={{ left: particle.x, top: particle.y, opacity: particle.opacity }}
        >
          <NativeEffectSprite
            assetId="materialize"
            frameIndex={particle.frameIndex}
            direction={0}
            pixelScale={particle.pixelScale}
          />
        </span>
      ))}
    </div>
  );
}

/** The old fighter remains mounted through recall; only the sendout stage receives the new body. */
export function BattleSwitchEffects({
  cue,
  scene,
  cueStartedAt,
  reducedMotion = false,
}: {
  cue: BattleCue | null;
  scene: BattleScene;
  cueStartedAt: number;
  reducedMotion?: boolean;
}) {
  if (!cue?.switchPhase) return null;
  return (
    <SwitchSequence
      key={`${cue.id}:${cueStartedAt}`}
      cue={cue}
      scene={scene}
      startedAt={cueStartedAt}
      explicitReduced={reducedMotion}
    />
  );
}
