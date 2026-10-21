import { useEffect, useMemo, useState } from 'react';
import type { BattleCue } from '../battle/presentation';
import { createBattleScene, sampleBattleSceneAt, type BattleScene } from '../battle/geometry';
import {
  bindSpriteTimeline,
  buildSpriteTimeline,
  effectCueElapsed,
  effectSheetPath,
  resolveEffectAnchors,
  sampleSpriteLayer,
} from '../battle/effect-sprites';
import { effectFrameAt, effectFrameGeometry } from '../battle/effect-atlases';
import { asset } from '../utils';

const fallbackScene = () =>
  createBattleScene({
    width: 1000,
    height: 600,
    player: { speciesId: 25 },
    rival: { speciesId: 133 },
  });

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** One clock advances every particle's six-frame strip; no interpolated source crops. */
function useEffectClock(duration: number, paused: boolean, cueStartedAt?: number) {
  const [mountedAt] = useState(() => performance.now());
  const epoch = cueStartedAt ?? mountedAt;
  const [elapsed, setElapsed] = useState(() =>
    paused ? 0 : effectCueElapsed(performance.now(), epoch, duration),
  );
  useEffect(() => {
    if (paused) {
      setElapsed(0);
      return;
    }
    let raf = 0;
    let lastFrame = -1;
    const tick = (now: number) => {
      const time = effectCueElapsed(now, epoch, duration);
      const frame = Math.floor(time / (1000 / 60));
      if (frame !== lastFrame || time === duration) {
        lastFrame = frame;
        setElapsed(time);
      }
      if (time < duration) raf = window.requestAnimationFrame(tick);
    };
    tick(performance.now());
    return () => window.cancelAnimationFrame(raf);
  }, [duration, paused, epoch]);
  return elapsed;
}

function RasterFrame({
  sheet,
  row,
  frame,
  size,
}: {
  sheet: number;
  row: number;
  frame: number;
  size: number;
}) {
  const geometry = effectFrameGeometry(sheet, row, frame, size);
  return (
    <span className="pixel-vfx-canvas" style={geometry.canvas}>
      <span
        className="pixel-vfx-cell"
        data-sprite-frame={frame}
        style={{ ...geometry.crop, backgroundImage: `url("${asset(effectSheetPath(sheet))}")` }}
      />
    </span>
  );
}

function BattleEffectSequence({
  cue,
  scene,
  reducedMotion,
  cueStartedAt,
}: {
  cue: BattleCue;
  scene: BattleScene;
  reducedMotion: boolean;
  cueStartedAt?: number;
}) {
  const baseTimeline = useMemo(() => buildSpriteTimeline(cue, scene), [cue, scene]);
  const sceneAt = useMemo(() => {
    const cache = new Map<number, BattleScene>();
    return (time: number) => {
      const cached = cache.get(time);
      if (cached) return cached;
      const sampled = sampleBattleSceneAt(scene, cue, time, reducedMotion);
      cache.set(time, sampled);
      return sampled;
    };
  }, [cue, scene, reducedMotion]);
  const timeline = useMemo(
    () => bindSpriteTimeline(baseTimeline, cue, scene, sceneAt),
    [baseTimeline, cue, scene, sceneAt],
  );
  const elapsed = useEffectClock(cue.durationMs, reducedMotion, cueStartedAt);
  const currentScene = sceneAt(elapsed);
  const currentAnchors = resolveEffectAnchors(cue, currentScene, timeline.script);
  const point =
    cue.target === 'self' || cue.outcome === 'charge'
      ? currentAnchors.source
      : currentAnchors.target;
  const staticSize = Math.max(
    40,
    Math.round(timeline.script.size * Math.min(scene.width / 1000, scene.height / 600)),
  );
  return (
    <div
      className={'pixel-battle-effects' + (reducedMotion ? ' is-reduced' : '')}
      data-effect={cue.variant}
      data-move={cue.moveName || cue.kind}
      data-outcome={cue.outcome}
      data-source-side={cue.side}
      data-target-side={cue.targetSide}
      data-origin={timeline.origin}
      data-source-x={currentAnchors.source.x}
      data-source-y={currentAnchors.source.y}
      data-target-x={currentAnchors.target.x}
      data-target-y={currentAnchors.target.y}
      data-cue-started-at={cueStartedAt}
      aria-hidden="true"
    >
      {reducedMotion ? (
        <span className="pixel-vfx-reduced-cue" style={{ left: point.x, top: point.y }}>
          <RasterFrame
            sheet={timeline.script.sheet}
            row={timeline.script.row}
            frame={cue.outcome === 'hit' ? 3 : 1}
            size={staticSize}
          />
        </span>
      ) : (
        timeline.layers.map((layer) => {
          const sampled = sampleSpriteLayer(layer, timeline, cue, scene, currentScene, elapsed);
          return (
            <span
              key={layer.key}
              className={'pixel-vfx-particle pixel-role-' + layer.role}
              data-layer-role={layer.role}
              data-frame-set={layer.frames}
              data-space={layer.space}
              style={{
                transform: `translate3d(${sampled.position.x}px, ${sampled.position.y}px, 0)`,
                opacity: sampled.opacity,
              }}
            >
              <span
                className="pixel-vfx-orientation"
                style={{
                  transform: `rotate(${sampled.rotation}deg) scaleX(${layer.flip ? -1 : 1})`,
                }}
              >
                <RasterFrame
                  sheet={timeline.script.sheet}
                  row={timeline.script.row}
                  frame={effectFrameAt(layer.frames, elapsed, layer.delay, layer.duration)}
                  size={layer.size}
                />
              </span>
            </span>
          );
        })
      )}
    </div>
  );
}

/** Raster animation strips share the stage's measured, species-specific coordinates. */
export function BattleEffects({
  cue,
  scene,
  reducedMotion = false,
  cueStartedAt,
}: {
  cue: BattleCue | null;
  scene?: BattleScene;
  reducedMotion?: boolean;
  cueStartedAt?: number;
}) {
  const systemReduced = useSystemReducedMotion();
  const measured = useMemo(() => scene || fallbackScene(), [scene]);
  if (!cue) return null;
  return (
    <BattleEffectSequence
      key={`${cue.id}:${cueStartedAt ?? ''}`}
      cue={cue}
      scene={measured}
      reducedMotion={reducedMotion || systemReduced}
      cueStartedAt={cueStartedAt}
    />
  );
}
