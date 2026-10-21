import { useEffect, useMemo, useState, useRef } from 'react';
import type { BattleCue } from '../battle/presentation';
import { createBattleScene, sampleBattleSceneAt, type BattleScene } from '../battle/geometry';
import {
  bindSpriteTimeline,
  buildSpriteTimeline,
  effectCueElapsed,
  preloadEffectSprites,
  resolveEffectAnchors,
  type EffectDepth,
} from '../battle/effect-sprites';
import { compileNativeEffects, paintNativeEffectPlane } from '../battle/native-effect-scene';
import {
  getNativeEffectAsset,
  getNativeEffectImage,
  preloadNativeEffectImages,
  rasterizeNativeEffect,
} from '../battle/native-effect-renderer';

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

/** All native variable-length clips and body frames share a single clock. */
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

/** Standalone native clip anchored by its original pivot, used by recall/sendout. */
export function NativeEffectSprite({
  assetId,
  frameIndex,
  direction = 0,
  pixelScale = 1,
}: {
  assetId: string;
  frameIndex: number;
  direction?: number;
  pixelScale?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(() => !!getNativeEffectImage(assetId));
  useEffect(() => {
    let live = true;
    void preloadNativeEffectImages([assetId]).then(
      () => {
        if (live) setReady(true);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [assetId]);
  useEffect(() => {
    const image = getNativeEffectImage(assetId),
      target = canvas.current;
    if (!image || !target || !ready) return;
    const ctx = target.getContext('2d');
    if (!ctx) return;
    const raster = rasterizeNativeEffect(
      image,
      getNativeEffectAsset(assetId),
      frameIndex,
      direction,
    );
    const scale = Math.max(1, Math.round(pixelScale));
    target.width = raster.canvas.width;
    target.height = raster.canvas.height;
    target.style.width = `${target.width * scale}px`;
    target.style.height = `${target.height * scale}px`;
    target.style.left = `${-raster.pivot.x * scale}px`;
    target.style.top = `${-raster.pivot.y * scale}px`;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(raster.canvas, 0, 0);
  }, [assetId, frameIndex, direction, pixelScale, ready]);
  return (
    <canvas
      ref={canvas}
      className="native-effect-sprite"
      data-native-asset={assetId}
      aria-hidden="true"
    />
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
  const compiled = useMemo(
    () => compileNativeEffects(timeline, cue, scene, currentScene, elapsed, reducedMotion),
    [timeline, cue, scene, currentScene, elapsed, reducedMotion],
  );
  const rear = useRef<HTMLCanvasElement>(null),
    middle = useRef<HTMLCanvasElement>(null),
    front = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    void preloadEffectSprites(cue.moveName ? [cue.moveName] : undefined).then(
      () => {
        if (live) setReady(true);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, [cue.moveName]);
  useEffect(() => {
    for (const [depth, ref] of [
      ['rear', rear],
      ['middle', middle],
      ['front', front],
    ] as const) {
      const ctx = ref.current?.getContext('2d');
      if (!ctx) continue;
      ctx.clearRect(0, 0, scene.width, scene.height);
      paintNativeEffectPlane(ctx, compiled, depth);
    }
  }, [compiled, scene.width, scene.height, ready]);
  const plane = (depth: EffectDepth, ref: typeof rear) => (
    <canvas
      key={depth}
      ref={ref}
      width={Math.round(scene.width)}
      height={Math.round(scene.height)}
      style={{ width: Math.round(scene.width), height: Math.round(scene.height) }}
      className={'pixel-battle-effects pixel-depth-' + depth + (reducedMotion ? ' is-reduced' : '')}
      data-depth={depth}
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
      data-native-sprites={compiled.sprites.filter((s) => s.depth === depth).length}
      aria-hidden="true"
    />
  );
  return (
    <>
      {plane('rear', rear)}
      {plane('middle', middle)}
      {plane('front', front)}
    </>
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
