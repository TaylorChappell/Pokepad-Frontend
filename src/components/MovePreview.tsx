import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from 'react';
import { BattleSprite } from '../battle/BattleSprite';
import { BattleEffects } from './BattleEffects';
import { createBattleScene } from '../battle/geometry';
import { getBattleCue } from '../battle/presentation';
import { getBodyAssetState, loadBodyManifest, subscribeBodyAsset } from '../battle/body-registry';
import { getBodyPreviewManifest } from '../battle/body-animation';
import { preloadEffectSprites } from '../battle/effect-sprites';
import { useOptionalApp } from '../state/AppContext';
import { moveByName } from '../data/moves';
import { Modal, TypeChip } from './UI';
function useBody(id: number) {
  const value = useSyncExternalStore(
    (cb) => subscribeBodyAsset(id, cb),
    () => getBodyAssetState(id),
    () => getBodyAssetState(id),
  );
  useEffect(() => {
    void loadBodyManifest(id).catch(() => {});
  }, [id]);
  return value.manifest || getBodyPreviewManifest(id);
}
export function MovePreview({
  name,
  speciesId,
  shiny = false,
}: {
  name: string;
  speciesId: number;
  shiny?: boolean;
}) {
  const app = useOptionalApp(),
    reduced = app?.state.profile.reducedMotion || false;
  const paused = reduced;
  const [clock, setClock] = useState({ epoch: 0, active: false }),
    [size, setSize] = useState({ width: 540, height: 210 });
  const field = useRef<HTMLDivElement>(null),
    player = useBody(speciesId),
    rival = useBody(speciesId === 133 ? 25 : 133);
  const targetId = speciesId === 133 ? 25 : 133;
  const cue = useMemo(
    () => getBattleCue({ kind: 'move', side: 'player', moveName: name, text: name })!,
    [name],
  );
  useEffect(() => {
    void preloadEffectSprites().catch(() => {});
  }, []);
  useEffect(() => {
    const element = field.current;
    if (!element) return;
    const resize = () => {
      const r = element.getBoundingClientRect();
      if (r.width && r.height) setSize({ width: r.width, height: r.height });
    };
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(element);
    return () => observer?.disconnect();
  }, []);
  const scene = useMemo(
    () =>
      createBattleScene({
        ...size,
        player: { speciesId, shiny, manifest: player },
        rival: { speciesId: targetId, manifest: rival },
      }),
    [size, speciesId, shiny, player, rival, targetId],
  );
  useEffect(() => {
    if (paused || reduced) {
      setClock({ epoch: 0, active: false });
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      setClock({ epoch: performance.now(), active: true });
      timer = setTimeout(() => {
        setClock((c) => ({ ...c, active: false }));
        timer = setTimeout(loop, 900);
      }, cue.durationMs);
    };
    timer = setTimeout(loop, 550);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [name, paused, reduced, cue.durationMs]);
  const active = clock.active ? cue : null;
  return (
    <section className="move-preview" aria-label={name + ' battle animation preview'}>
      <div className="move-preview-field" ref={field}>
        <svg
          className="move-preview-ground"
          viewBox={`0 0 ${size.width} ${size.height}`}
          aria-hidden="true"
        >
          {(['player', 'rival'] as const).map((side) => {
            const g = scene.actors[side].ground;
            return (
              <ellipse
                key={side}
                cx={g.x}
                cy={g.y}
                rx={g.rx}
                ry={g.ry}
                fill="#c3d59a"
                stroke="#aabf84"
                strokeWidth="2"
              />
            );
          })}
        </svg>
        {(['player', 'rival'] as const).map((side) => {
          const a = scene.actors[side];
          return (
            <div
              key={side}
              className={'battle-placed-actor move-preview-actor preview-' + side}
              style={
                {
                  left: a.rect.x,
                  top: a.rect.y,
                  width: a.rect.width,
                  height: a.rect.height,
                } as CSSProperties
              }
            >
              <BattleSprite
                speciesId={side === 'player' ? speciesId : targetId}
                shiny={side === 'player' && shiny}
                side={side}
                actor={a}
                manifest={side === 'player' ? player : rival}
                cue={active}
                cueStartedAt={clock.epoch}
                paused={paused}
                reducedMotion={reduced}
              />
            </div>
          );
        })}
        <BattleEffects
          key={clock.epoch}
          cue={active}
          scene={scene}
          cueStartedAt={clock.epoch}
          reducedMotion={reduced}
        />
        <span className="move-preview-label">{clock.active ? name : 'Move preview'}</span>
      </div>
    </section>
  );
}
export function MoveInfoDialog({
  name,
  speciesId,
  shiny,
  onClose,
}: {
  name: string;
  speciesId: number;
  shiny?: boolean;
  onClose: () => void;
}) {
  const move = moveByName(name);
  return (
    <Modal title={name} onClose={onClose}>
      <div className="move-info-dialog">
        <MovePreview name={name} speciesId={speciesId} shiny={shiny} />
        <div className="move-info-description">
          <TypeChip type={move.type} />
          <p>{move.description}</p>
          <dl>
            <div>
              <dt>Power</dt>
              <dd>{move.power ?? '—'}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>{move.accuracy === null ? 'Always hits' : move.accuracy + '%'}</dd>
            </div>
            <div>
              <dt>PP</dt>
              <dd>{move.pp}</dd>
            </div>
          </dl>
        </div>
      </div>
    </Modal>
  );
}
