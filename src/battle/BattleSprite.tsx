import { useEffect, useMemo, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { pokemonById } from '../data/pokemon';
import { asset } from '../utils';
import type { Side } from './engine';
import type { BattleActorGeometry } from './geometry';
import type { BattleCue } from './presentation';
import {
  getBodyFrameAt,
  getBodyFrameStyle,
  getBodyPreviewManifest,
  PMD_CATALOGUE,
  type BodyManifest,
  type BodyFrameSelection,
} from './body-animation';
import { getBodyAssetState, preloadBattleBodies, subscribeBodyAsset } from './body-registry';

function useReducedMotion(explicit: boolean) {
  const [system, setSystem] = useState(
    () =>
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setSystem(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return explicit || system;
}

const now = () => (typeof performance === 'undefined' ? 0 : performance.now());
function useBodyFrame(
  manifest: BodyManifest,
  side: Side,
  shiny: boolean,
  cue: BattleCue | null,
  cueStartedAt: number,
  reducedMotion: boolean,
  paused: boolean,
): BodyFrameSelection {
  const key = `${manifest.speciesId}:${shiny}:${side}:${cue?.id || 'idle'}:${cueStartedAt}`;
  const [clock, setClock] = useState({ key, time: now(), manifest });
  const time = clock.key === key && clock.manifest === manifest ? clock.time : now();
  const sample = (timeMs: number) =>
    getBodyFrameAt(manifest, {
      side,
      shiny,
      cue,
      elapsedMs: cue ? Math.max(0, timeMs - cueStartedAt) : timeMs,
      reducedMotion,
      paused,
    });
  useEffect(() => {
    if (
      reducedMotion ||
      manifest.preview ||
      (paused && !(cue?.kind === 'faint' && cue.side === side))
    )
      return;
    let raf = 0;
    let previous = '';
    const tick = (timeMs: number) => {
      const selection = sample(timeMs);
      const finished = !!cue && timeMs - cueStartedAt >= cue.durationMs;
      const next = `${selection.animation}:${selection.clip.action}:${selection.frameIndex}:${selection.phase}:${finished}`;
      if (next !== previous) {
        previous = next;
        setClock({ key, time: timeMs, manifest });
      }
      if (!finished && !document.hidden) raf = window.requestAnimationFrame(tick);
    };
    const visibility = () => {
      window.cancelAnimationFrame(raf);
      if (!document.hidden) raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [manifest, side, shiny, cue, cueStartedAt, reducedMotion, paused]);
  return sample(time);
}

/** Real multi-frame PMD character artwork; source crops and anatomy move together. */
export function BattleSprite({
  speciesId,
  shiny = false,
  side,
  className = '',
  style,
  actor,
  manifest: supplied,
  cue = null,
  cueStartedAt = 0,
  reducedMotion = false,
  paused = false,
}: {
  speciesId: number;
  shiny?: boolean;
  side: Side;
  className?: string;
  style?: CSSProperties;
  actor?: BattleActorGeometry;
  manifest?: BodyManifest;
  cue?: BattleCue | null;
  cueStartedAt?: number;
  reducedMotion?: boolean;
  paused?: boolean;
}) {
  const species = pokemonById(speciesId);
  const subscribe = useMemo(
    () => (listener: () => void) => subscribeBodyAsset(species.id, listener),
    [species.id],
  );
  const getSnapshot = useMemo(() => () => getBodyAssetState(species.id), [species.id]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const manifest =
    supplied && !supplied.preview
      ? supplied
      : state.manifest || supplied || getBodyPreviewManifest(species.id);
  const reduced = useReducedMotion(reducedMotion);
  const selection = useBodyFrame(manifest, side, shiny, cue, cueStartedAt, reduced, paused);
  useEffect(() => {
    void preloadBattleBodies([{ speciesId: species.id, shiny }]).catch(() => {});
  }, [species.id, shiny]);
  const facing = side === 'player' ? 'back' : 'front';
  const hasPreview =
    !!PMD_CATALOGUE[String(species.id)].variants[shiny ? 'shiny' : 'normal'].idleFrame?.[facing];
  const canRender = !manifest.preview || hasPreview;
  return (
    <span
      className={'battle-native-sprite battle-body-sprite ' + className}
      role="img"
      aria-label={species.name + (shiny ? ', shiny' : '')}
      data-facing={facing}
      data-species={species.id}
      data-body-status={state.status}
      data-idle={selection.animation === 'idle' ? 'animated' : undefined}
      data-pose={selection.animation}
      data-body-action={selection.clip.action}
      data-body-frame={selection.frameIndex}
      data-body-phase={selection.phase}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        aspectRatio: `${manifest.canvasWidth} / ${manifest.canvasHeight}`,
        ...style,
      }}
    >
      {canRender ? (
        <span className="battle-body-canvas" style={{ width: '100%', height: '100%' }}>
          <span
            className="battle-body-frame"
            style={{
              ...getBodyFrameStyle(manifest, selection.frame),
              backgroundImage: `url("${asset(manifest.sheets[selection.frame.sheet].src)}")`,
            }}
          />
        </span>
      ) : (
        <span className="battle-body-loading" aria-hidden="true">
          ●
        </span>
      )}
      {state.status === 'error' && !actor && (
        <span className="battle-body-unavailable">Sprite unavailable</span>
      )}
    </span>
  );
}
