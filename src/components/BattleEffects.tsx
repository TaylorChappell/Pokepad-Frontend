import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { BattleCue } from '../battle/presentation';
import { createBattleScene, type BattleScene } from '../battle/geometry';
import { buildSpriteTimeline, effectSheetPath } from '../battle/effect-sprites';
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
function useEffectClock(duration: number, paused: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (paused) return;
    let raf = 0;
    let start: number | undefined;
    let lastFrame = -1;
    const tick = (now: number) => {
      if (start === undefined) start = now;
      const time = Math.min(duration, now - start);
      const frame = Math.floor(time / (1000 / 30));
      if (frame !== lastFrame || time === duration) {
        lastFrame = frame;
        setElapsed(time);
      }
      if (time < duration) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [duration, paused]);
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
}: {
  cue: BattleCue;
  scene: BattleScene;
  reducedMotion: boolean;
}) {
  const timeline = useMemo(() => buildSpriteTimeline(cue, scene), [cue, scene]);
  const elapsed = useEffectClock(cue.durationMs, reducedMotion);
  const point =
    cue.target === 'self' || cue.outcome === 'charge' ? timeline.source : timeline.target;
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
      data-source-x={timeline.source.x}
      data-source-y={timeline.source.y}
      data-target-x={timeline.target.x}
      data-target-y={timeline.target.y}
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
        timeline.layers.map((layer) => (
          <span
            key={layer.key}
            className={'pixel-vfx-particle pixel-role-' + layer.role}
            data-layer-role={layer.role}
            data-frame-set={layer.frames}
            style={
              {
                '--start-x': layer.from.x + 'px',
                '--start-y': layer.from.y + 'px',
                '--middle-x': layer.via.x + 'px',
                '--middle-y': layer.via.y + 'px',
                '--end-x': layer.to.x + 'px',
                '--end-y': layer.to.y + 'px',
                '--sprite-delay': layer.delay + 'ms',
                '--sprite-time': layer.duration + 'ms',
                '--sprite-opacity': layer.opacity,
              } as CSSProperties
            }
          >
            <span
              className="pixel-vfx-orientation"
              style={{ transform: `rotate(${layer.rotation}deg) scaleX(${layer.flip ? -1 : 1})` }}
            >
              <RasterFrame
                sheet={timeline.script.sheet}
                row={timeline.script.row}
                frame={effectFrameAt(layer.frames, elapsed, layer.delay, layer.duration)}
                size={layer.size}
              />
            </span>
          </span>
        ))
      )}
    </div>
  );
}

/** Raster animation strips share the stage's measured, species-specific coordinates. */
export function BattleEffects({
  cue,
  scene,
  reducedMotion = false,
}: {
  cue: BattleCue | null;
  scene?: BattleScene;
  reducedMotion?: boolean;
}) {
  const systemReduced = useSystemReducedMotion();
  const measured = useMemo(() => scene || fallbackScene(), [scene]);
  if (!cue) return null;
  return (
    <BattleEffectSequence
      key={cue.id}
      cue={cue}
      scene={measured}
      reducedMotion={reducedMotion || systemReduced}
    />
  );
}
