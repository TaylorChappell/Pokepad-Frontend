import { asset } from '../utils';
import type { BattleCue } from './presentation';
import type { BattleScene } from './geometry';
import { NATIVE_EFFECT_ASSETS, nativeMoveAssetIds } from './native-effect-art';
import { preloadNativeEffectImages, snapNativePoint } from './native-effect-renderer';

export type AttackOrigin = 'mouth' | 'hand' | 'cannon' | 'body' | 'feet' | 'crown';
export type AttackMotion =
  | 'lunge'
  | 'claw'
  | 'leap'
  | 'cast'
  | 'beam'
  | 'hover'
  | 'shake'
  | 'guard'
  | 'drain'
  | 'sway';
export type SpriteRecipe =
  | 'shots'
  | 'stream'
  | 'blast'
  | 'spiral'
  | 'beam'
  | 'wave'
  | 'electric'
  | 'rings'
  | 'curse'
  | 'drain'
  | 'vine'
  | 'powder'
  | 'slash'
  | 'bite'
  | 'tongue'
  | 'kick'
  | 'melee'
  | 'speed'
  | 'dive'
  | 'quake'
  | 'rocks'
  | 'silk'
  | 'heal'
  | 'sleep'
  | 'agility'
  | 'shield'
  | 'swords';
export interface MoveSpriteScript {
  name: string;
  sheet: number;
  row: number;
  origin: AttackOrigin;
  motion: AttackMotion;
  recipe: SpriteRecipe;
  /** Choreography spread at the reference battlefield; native art uses the actor pixel scale. */
  size: number;
  count: number;
  spread: number;
  arc: number;
  releaseAt: number;
  impactAt: number;
}
const move = (
  name: string,
  sheet: number,
  row: number,
  origin: AttackOrigin,
  motion: AttackMotion,
  recipe: SpriteRecipe,
  size: number,
  count = 1,
  spread = 0,
  arc = 0,
  impactAt = 0.68,
): MoveSpriteScript => ({
  name,
  sheet,
  row,
  origin,
  motion,
  recipe,
  size,
  count,
  spread,
  arc,
  releaseAt: 0.13,
  impactAt,
});

/** Every playable move owns an authored release, travel, impact and recovery sequence. */
export const MOVE_SPRITE_SCRIPTS: Readonly<Record<string, MoveSpriteScript>> = Object.freeze(
  Object.fromEntries(
    [
      move('Ember', 1, 0, 'mouth', 'cast', 'shots', 94, 3, 20, -24, 0.66),
      move('Flamethrower', 1, 1, 'mouth', 'beam', 'stream', 114, 12, 9, 0, 0.73),
      move('Fire Blast', 1, 2, 'mouth', 'cast', 'blast', 185, 1, 0, -20, 0.63),
      move('Fire Spin', 1, 3, 'mouth', 'cast', 'spiral', 134, 4, 43, -35, 0.63),
      move('Dragon Rage', 1, 4, 'mouth', 'cast', 'shots', 141, 2, 12, -34, 0.71),
      move('Hyper Beam', 1, 5, 'mouth', 'beam', 'beam', 112, 13, 0, 0, 0.72),
      move('Water Gun', 2, 0, 'cannon', 'beam', 'stream', 89, 8, 3, 0, 0.63),
      move('Surf', 2, 1, 'feet', 'sway', 'wave', 225, 3, 35, 0, 0.71),
      move('Hydro Pump', 2, 2, 'cannon', 'beam', 'beam', 146, 11, 5, 0, 0.75),
      move('Ice Beam', 2, 3, 'mouth', 'beam', 'beam', 98, 12, 0, 0, 0.72),
      move('Thunder Shock', 2, 4, 'body', 'shake', 'electric', 105, 4, 20, 0, 0.64),
      move('Thunderbolt', 2, 5, 'body', 'shake', 'electric', 163, 7, 35, 0, 0.7),
      move('Thunder Wave', 3, 0, 'body', 'cast', 'rings', 116, 3, 10, 0, 0.66),
      move('Psychic', 3, 1, 'crown', 'cast', 'rings', 166, 4, 16, -16, 0.66),
      move('Confusion', 3, 2, 'crown', 'cast', 'rings', 118, 3, 9, -8, 0.64),
      move('Hypnosis', 3, 3, 'crown', 'cast', 'rings', 139, 3, 4, 0, 0.73),
      move('Night Shade', 3, 4, 'body', 'sway', 'curse', 184, 3, 27, -45, 0.66),
      move('Dream Eater', 3, 5, 'crown', 'drain', 'drain', 123, 5, 22, -42, 0.36),
      move('Vine Whip', 4, 0, 'hand', 'beam', 'vine', 83, 9, 15, 35, 0.66),
      move('Razor Leaf', 4, 1, 'hand', 'cast', 'shots', 96, 5, 34, -48, 0.72),
      move('Solar Beam', 4, 2, 'crown', 'beam', 'beam', 124, 13, 0, 0, 0.74),
      move('Sleep Powder', 4, 3, 'crown', 'sway', 'powder', 134, 6, 47, -46, 0.74),
      move('Poison Powder', 4, 4, 'crown', 'sway', 'powder', 129, 7, 43, -30, 0.76),
      move('Poison Sting', 4, 5, 'mouth', 'cast', 'shots', 81, 3, 13, -10, 0.61),
      move('Scratch', 5, 0, 'hand', 'claw', 'slash', 156, 3, 14, 0, 0.49),
      move('Slash', 5, 1, 'hand', 'claw', 'slash', 196, 3, 20, 0, 0.54),
      move('Bite', 5, 2, 'mouth', 'lunge', 'bite', 188, 1, 0, 0, 0.4),
      move('Lick', 5, 3, 'mouth', 'beam', 'tongue', 96, 8, 0, 0, 0.56),
      move('Low Kick', 5, 4, 'feet', 'leap', 'kick', 157, 1, 0, 0, 0.48),
      move('Wing Attack', 5, 5, 'hand', 'cast', 'shots', 134, 3, 22, -13, 0.61),
      move('Tackle', 6, 0, 'body', 'lunge', 'melee', 147, 1, 0, 0, 0.5),
      move('Body Slam', 6, 1, 'body', 'leap', 'melee', 217, 2, 23, -45, 0.58),
      move('Double-Edge', 6, 2, 'body', 'lunge', 'melee', 192, 3, 21, 0, 0.58),
      move('Quick Attack', 6, 3, 'body', 'lunge', 'speed', 138, 4, 10, 0, 0.44),
      move('Fly', 6, 4, 'body', 'leap', 'dive', 182, 3, 15, -135, 0.62),
      move('Struggle', 6, 5, 'body', 'shake', 'melee', 144, 3, 25, 0, 0.54),
      move('Growl', 7, 0, 'mouth', 'cast', 'rings', 117, 3, 3, 0, 0.72),
      move('Swift', 7, 1, 'hand', 'cast', 'shots', 100, 5, 29, -39, 0.7),
      move('Sand Attack', 7, 2, 'feet', 'cast', 'powder', 134, 6, 39, -62, 0.7),
      move('Earthquake', 7, 3, 'feet', 'shake', 'quake', 183, 6, 53, 0, 0.62),
      move('Rock Slide', 7, 4, 'hand', 'cast', 'rocks', 125, 5, 49, 0, 0.47),
      move('String Shot', 7, 5, 'mouth', 'cast', 'silk', 101, 9, 8, 0, 0.68),
      move('Recover', 8, 0, 'body', 'guard', 'heal', 124, 6, 51, -37, 0.55),
      move('Rest', 8, 1, 'crown', 'guard', 'sleep', 102, 3, 25, -76, 0.62),
      move('Agility', 8, 2, 'body', 'hover', 'agility', 164, 4, 38, 0, 0.55),
      move('Harden', 8, 3, 'body', 'guard', 'shield', 201, 1, 0, 0, 0.58),
      move('Swords Dance', 8, 4, 'body', 'guard', 'swords', 125, 4, 67, -5, 0.58),
      move('Leech Life', 8, 5, 'mouth', 'drain', 'drain', 105, 5, 18, -30, 0.36),
    ].map((entry) => [entry.name, entry]),
  ),
);

export function getMoveSpriteScript(name?: string): MoveSpriteScript {
  return MOVE_SPRITE_SCRIPTS[name || ''] || MOVE_SPRITE_SCRIPTS.Struggle;
}
export const EFFECT_ATLAS_COLUMNS = 6;
export const EFFECT_ATLAS_ROWS = 6;
export const effectSheetPath = (sheet: number) =>
  `battle/effects/sheet-${String(sheet).padStart(2, '0')}.png`;

let ballLoad: Promise<void> | undefined;
function preloadBattleBall(): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  if (ballLoad) return ballLoad;
  ballLoad = new Promise<void>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      error ? reject(error) : resolve();
    };
    const failed = () => finish(new Error('Battle effects could not load. Please try again.'));
    const timeout = setTimeout(failed, 15000);
    image.onerror = failed;
    image.onload = () => {
      if (typeof image.decode !== 'function') finish();
    };
    image.src = asset('pixel/items/poke-ball.png');
    if (typeof image.decode === 'function') image.decode().then(() => finish(), failed);
    else if (image.complete && image.naturalWidth > 0) finish();
  }).catch((error) => {
    ballLoad = undefined;
    throw error;
  });
  return ballLoad;
}

/** Decode native art before commands and switches; failed decodes remain retryable. */
export async function preloadEffectSprites(moveNames?: readonly string[]): Promise<void> {
  const ids = moveNames
    ? [...moveNames.flatMap(nativeMoveAssetIds), 'materialize', 'synthesis_sparkle']
    : Object.keys(NATIVE_EFFECT_ASSETS);
  await Promise.all([preloadNativeEffectImages(ids), preloadBattleBall()]);
}
export type EffectPoint = { x: number; y: number };
export interface EffectSpriteLayer {
  key: string;
  from: EffectPoint;
  via: EffectPoint;
  to: EffectPoint;
  size: number;
  rotation: number;
  delay: number;
  duration: number;
  opacity: number;
  frames: 'full' | 'charge' | 'impact';
  role: 'release' | 'travel' | 'impact' | 'self' | 'return' | 'transition';
  flip: boolean;
  /** Flights keep their emission points; attachments follow the current body frame. */
  space: 'flight' | 'source' | 'target' | 'tether' | 'ground';
  sourceAnchor?: AttackOrigin;
  fromBinding?: 'source' | 'target' | 'path';
  toBinding?: 'source' | 'target' | 'path';
}
export interface SpriteTimeline {
  script: MoveSpriteScript;
  source: EffectPoint;
  target: EffectPoint;
  origin: AttackOrigin;
  layers: EffectSpriteLayer[];
  releaseSource?: EffectPoint;
  releaseTarget?: EffectPoint;
}
const lerp = (a: EffectPoint, b: EffectPoint, t: number): EffectPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
const offset = (p: EffectPoint, x = 0, y = 0): EffectPoint => ({ x: p.x + x, y: p.y + y });
const point = (p: EffectPoint): EffectPoint => ({ x: Math.round(p.x), y: Math.round(p.y) });

export function resolveEffectAnchors(
  cue: BattleCue,
  scene: BattleScene,
  script = getMoveSpriteScript(cue.moveName),
) {
  const caster = scene.actors[cue.side];
  let origin = script.origin;
  if (
    (script.name === 'Razor Leaf' || script.name === 'Vine Whip') &&
    [1, 2, 3].includes(caster.speciesId)
  )
    origin = 'crown';
  if (script.name === 'Poison Sting') {
    if ([15, 72, 73].includes(caster.speciesId)) origin = 'hand';
    else if ([13, 14, 29, 30, 31, 32, 33, 34].includes(caster.speciesId)) origin = 'crown';
  }
  const source = caster.anchors[origin];
  const self = cue.target === 'self' || cue.outcome === 'charge';
  const victim = scene.actors[self ? cue.side : cue.targetSide];
  const groundTarget = ['wave', 'quake', 'rocks', 'kick'].includes(script.recipe);
  const target = self ? source : groundTarget ? victim.anchors.feet : victim.anchors.body;
  const miss = cue.outcome === 'miss';
  const unit = Math.max(0.3, Math.min(scene.width / 1000, scene.height / 600));
  return {
    origin,
    source: point(source),
    target: point(
      miss ? offset(target, cue.side === 'player' ? 70 * unit : -70 * unit, -58 * unit) : target,
    ),
    self,
    unit,
    caster,
    victim,
  };
}

/** A pure choreography plan: every sprite uses the same measured actor coordinates as the stage. */
export function buildSpriteTimeline(cue: BattleCue, scene: BattleScene): SpriteTimeline {
  const script = getMoveSpriteScript(
    cue.moveName || (cue.kind === 'switch' ? 'Recover' : 'Struggle'),
  );
  const { origin, source, target, self, unit, caster, victim } = resolveEffectAnchors(
    cue,
    scene,
    script,
  );
  const layers: EffectSpriteLayer[] = [];
  const size = Math.max(30, Math.round(script.size * unit));
  const duration = cue.durationMs;
  const dir = cue.side === 'player' ? 1 : -1;
  const angle = (Math.atan2(target.y - source.y, target.x - source.x) * 180) / Math.PI;
  const pathRotation = angle - (dir < 0 ? 180 : 0);
  const impact = cue.outcome === 'hit' && !self;
  const at = (
    from: EffectPoint,
    to: EffectPoint,
    delay: number,
    length: number,
    options: Partial<Omit<EffectSpriteLayer, 'key' | 'from' | 'to' | 'delay' | 'duration'>> = {},
  ) => {
    const via = options.via || lerp(from, to, 0.5);
    const role = options.role || 'travel';
    const launch = role === 'travel' && !self ? Math.max(script.releaseAt, delay) : delay;
    const space =
      options.space ||
      (role === 'impact'
        ? 'target'
        : ['release', 'self', 'transition'].includes(role)
          ? 'source'
          : 'flight');
    layers.push({
      key: `${script.name}-${layers.length}`,
      from: point(from),
      via: point(via),
      to: point(to),
      size,
      rotation: 0,
      delay: Math.round(launch * duration),
      duration: Math.max(45, Math.round((delay + length - launch) * duration)),
      opacity: 1,
      frames: 'full',
      role: 'travel',
      flip: dir < 0,
      space,
      ...options,
    });
  };
  const still = (
    p: EffectPoint,
    delay: number,
    length: number,
    scale = 1,
    options: Parameters<typeof at>[4] = {},
  ) => at(p, p, delay, length, { size: Math.round(size * scale), ...options });
  const release = (scale = 0.72) =>
    still(source, 0.03, 0.24, scale, { frames: 'charge', role: 'release' });
  const hit = (scale = 1.25, when = script.impactAt) => {
    if (impact)
      still(target, when, Math.min(0.3, 1 - when), scale, { frames: 'impact', role: 'impact' });
  };
  if (cue.kind === 'faint' || cue.kind === 'switch') {
    const body = caster.anchors.body;
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2;
      const edge = offset(body, Math.cos(a) * size * 0.35, Math.sin(a) * size * 0.35);
      at(
        cue.kind === 'switch' ? edge : body,
        cue.kind === 'switch' ? body : edge,
        i * 0.035,
        0.65,
        {
          size: size * 0.65,
          frames: cue.kind === 'switch' ? 'charge' : 'impact',
          role: 'transition',
        },
      );
    }
    return { script, source, target, origin, layers };
  }
  if (cue.outcome === 'charge') {
    if (script.name === 'Fly') {
      for (let i = 0; i < 3; i++)
        at(
          offset(source, (i - 1) * 15 * unit, 12 * unit),
          offset(source, (i - 1) * 22 * unit, -90 * unit),
          i * 0.08,
          0.6,
          { size: size * 0.7, role: 'self', frames: 'charge' },
        );
    } else {
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        at(
          offset(source, Math.cos(a) * size * 0.65, Math.sin(a) * size * 0.65),
          source,
          i * 0.04,
          0.62,
          { size: size * 0.6, role: 'self', frames: 'charge' },
        );
      }
      still(source, 0.45, 0.5, 1, { role: 'self', frames: 'charge' });
    }
    return { script, source, target, origin, layers };
  }
  switch (script.recipe) {
    case 'shots': {
      release(0.52);
      for (let i = 0; i < script.count; i++) {
        const n = i - (script.count - 1) / 2;
        at(source, offset(target, 0, n * script.spread * unit * 0.35), 0.08 + i * 0.065, 0.48, {
          via: offset(lerp(source, target, 0.5), 0, (script.arc + n * script.spread) * unit),
          size: size * (0.85 + (i % 2) * 0.15),
          rotation:
            script.name === 'Razor Leaf'
              ? n * 25
              : script.name === 'Poison Sting'
                ? pathRotation
                : 0,
        });
      }
      hit(script.name === 'Wing Attack' ? 1.1 : 1.35);
      break;
    }
    case 'stream':
    case 'beam':
    case 'silk':
    case 'tongue':
    case 'vine': {
      release(script.recipe === 'beam' ? 0.92 : 0.68);
      const count = script.count;
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const p = lerp(source, target, t);
        const bend =
          script.recipe === 'vine'
            ? Math.sin(t * Math.PI) * script.arc * unit
            : script.recipe === 'silk'
              ? Math.sin(t * Math.PI * 3) * script.spread * unit
              : 0;
        const start = offset(p, 0, bend);
        still(
          start,
          0.13 + t * 0.38,
          (script.recipe === 'stream' ? 0.86 : 0.9) - (0.13 + t * 0.38),
          script.recipe === 'vine' ? 0.8 : 1,
          {
            rotation: pathRotation + (script.recipe === 'vine' ? Math.cos(t * Math.PI) * 16 : 0),
            role: 'travel',
            space: 'tether',
            opacity: cue.outcome === 'immune' && t > 0.88 ? 0.35 : 1,
          },
        );
        if (script.recipe === 'stream' && i % 3 === 0)
          at(source, p, 0.09 + t * 0.17, 0.28, {
            size: size * 0.6,
            rotation: pathRotation,
            toBinding: 'path',
          });
      }
      if (script.recipe === 'silk' && impact)
        still(target, 0.6, 0.35, 1.55, { role: 'impact', frames: 'impact' });
      else hit(script.recipe === 'beam' ? 1.65 : 1.15);
      break;
    }
    case 'blast':
      release();
      at(source, target, 0.13, 0.5, {
        size: size * 0.6,
        via: offset(lerp(source, target, 0.5), 0, script.arc * unit),
        frames: 'charge',
      });
      hit(1.7);
      break;
    case 'spiral':
      release(0.6);
      at(source, target, 0.08, 0.4, {
        size: size * 0.75,
        via: offset(lerp(source, target, 0.5), 0, -35 * unit),
      });
      if (impact)
        for (let i = 0; i < script.count; i++) {
          const a = (i * Math.PI * 2) / script.count;
          at(
            offset(target, Math.cos(a) * script.spread * unit, 30 * unit),
            offset(target, Math.cos(a + Math.PI) * script.spread * unit, -size * 0.3),
            0.42 + i * 0.05,
            0.4,
            {
              via: offset(target, Math.cos(a + Math.PI / 2) * script.spread * unit, -10 * unit),
              role: 'impact',
              size: size * 0.9,
            },
          );
        }
      break;
    case 'wave': {
      const start = caster.anchors.feet;
      for (let i = 0; i < script.count; i++)
        at(
          offset(start, -dir * i * 25 * unit, 0),
          offset(target, dir * 30 * unit, (i - 1) * 10 * unit),
          0.05 + i * 0.11,
          0.65,
          {
            size: size * (0.8 + i * 0.12),
            via: offset(lerp(start, target, 0.5), 0, -i * 12 * unit),
            space: 'ground',
          },
        );
      hit(1.05);
      break;
    }
    case 'electric':
      release(0.8);
      for (let i = 0; i < script.count; i++) {
        const p = lerp(source, target, (i + 1) / (script.count + 1));
        still(
          offset(p, 0, (i % 2 ? 1 : -1) * script.spread * unit * 0.3),
          0.12 + i * 0.045,
          0.32,
          0.8 + (i % 2) * 0.18,
          { rotation: pathRotation, role: 'travel', space: 'tether' },
        );
      }
      if (impact) {
        still(target, script.impactAt, 0.28, 1.65, { role: 'impact' });
        if (script.name === 'Thunderbolt')
          at(offset(victim.anchors.crown, 0, -70 * unit), target, script.impactAt - 0.13, 0.16, {
            role: 'impact',
            size: size * 1.1,
          });
      }
      break;
    case 'rings':
      for (let i = 0; i < script.count; i++)
        at(source, target, 0.04 + i * 0.13, 0.48, {
          size: size * (0.62 + i * 0.14),
          via: offset(lerp(source, target, 0.5), 0, script.arc * unit),
        });
      if (impact && script.name !== 'Growl')
        still(target, script.impactAt, Math.min(0.3, 1 - script.impactAt), 1.3, {
          frames: 'impact',
          role: 'impact',
        });
      break;
    case 'curse':
      release(0.75);
      for (let i = 0; i < script.count; i++)
        at(source, offset(target, (i - 1) * 16 * unit, 0), 0.08 + i * 0.09, 0.52, {
          via: offset(lerp(source, target, 0.5), (i - 1) * 15 * unit, (script.arc + i * 10) * unit),
          size: size * (0.55 + i * 0.13),
        });
      hit(1.4);
      break;
    case 'drain':
      release(0.6);
      at(source, target, 0.04, 0.32, { size: size * 0.65 });
      if (impact) {
        still(target, script.impactAt, 0.2, 1.25, { role: 'impact', frames: 'impact' });
        for (let i = 0; i < script.count; i++)
          at(
            offset(target, (i % 2 ? 1 : -1) * script.spread * unit, 0),
            caster.anchors.body,
            0.44 + i * 0.045,
            0.32,
            {
              via: offset(lerp(target, caster.anchors.body, 0.5), 0, (script.arc - i * 8) * unit),
              size: size * (0.46 + (i % 2) * 0.12),
              role: 'return',
              sourceAnchor: 'body',
            },
          );
        still(caster.anchors.body, 0.8, 0.18, 1, {
          role: 'self',
          frames: 'impact',
          sourceAnchor: 'body',
        });
      }
      break;
    case 'powder':
      release(0.6);
      for (let i = 0; i < script.count; i++) {
        const n = i - (script.count - 1) / 2;
        at(
          source,
          offset(target, n * script.spread * unit * 0.35, 15 * unit),
          0.04 + i * 0.055,
          0.58,
          {
            via: offset(lerp(source, target, 0.52), n * 12 * unit, script.arc * unit),
            size: size * (0.6 + (i % 3) * 0.12),
            opacity: 0.9,
          },
        );
      }
      if (impact)
        still(target, script.impactAt, Math.min(0.29, 1 - script.impactAt), 1.2, {
          role: 'impact',
          frames: 'impact',
        });
      break;
    case 'slash':
      for (let i = 0; i < script.count; i++)
        at(
          source,
          offset(target, (i - 1) * 12 * unit, (i - 1) * script.spread * unit),
          0.16 + i * 0.075,
          0.22,
          { size: size * 0.42, rotation: pathRotation, opacity: 0.7, frames: 'charge' },
        );
      if (impact)
        for (let i = 0; i < 2; i++)
          still(
            offset(target, (i ? 1 : -1) * 12 * unit, 0),
            script.impactAt + i * 0.1,
            0.26,
            1.15,
            {
              role: 'impact',
              rotation: i ? 18 : -14,
            },
          );
      break;
    case 'bite':
      at(source, target, 0.13, 0.27, { size: size * 0.42, frames: 'charge', opacity: 0.65 });
      hit(1.24);
      break;
    case 'kick':
      at(source, target, 0.12, 0.36, {
        size: size * 0.6,
        via: offset(lerp(source, target, 0.5), 0, -36 * unit),
        rotation: dir * 15,
      });
      hit(1.25);
      break;
    case 'melee':
      still(caster.anchors.feet, 0.05, 0.3, 0.68, {
        role: 'release',
        frames: 'charge',
        sourceAnchor: 'feet',
      });
      for (let i = 0; i < script.count; i++)
        at(source, target, 0.12 + i * 0.06, 0.25, {
          size: size * 0.45,
          via: offset(lerp(source, target, 0.5), 0, script.arc * unit),
          rotation: pathRotation,
          opacity: 0.6,
          frames: 'charge',
        });
      hit(script.name === 'Body Slam' ? 1.3 : 1.1, script.impactAt);
      break;
    case 'speed':
      for (let i = 0; i < script.count; i++) {
        const p = lerp(source, target, i / (script.count + 1));
        at(p, offset(p, dir * 65 * unit, -15 * unit), 0.06 + i * 0.06, 0.26, {
          size: size * (0.65 + i * 0.1),
          rotation: pathRotation,
          opacity: 0.6 + i * 0.08,
          fromBinding: 'path',
          toBinding: 'path',
        });
      }
      hit(1.1);
      break;
    case 'dive': {
      // PMD's Hop/attack frame already contains the airborne displacement.
      // Applying another synthetic height would detach the wind from the body.
      const peak = source;
      for (let i = 0; i < 3; i++)
        at(offset(peak, (i - 1) * 18 * unit, 0), target, 0.13 + i * 0.065, 0.43, {
          via: offset(lerp(peak, target, 0.5), 0, -30 * unit),
          size: size * (0.65 + i * 0.13),
          rotation:
            (Math.atan2(target.y - peak.y, target.x - peak.x) * 180) / Math.PI -
            (dir < 0 ? 180 : 0),
        });
      hit(1.2);
      break;
    }
    case 'quake':
      for (let i = 0; i < script.count; i++) {
        const p = lerp(caster.anchors.feet, target, i / (script.count - 1));
        still(
          offset(p, 0, (i % 2 ? 1 : -1) * 8 * unit),
          0.04 + i * 0.095,
          0.42,
          0.8 + (i % 2) * 0.3,
          { role: i === script.count - 1 && impact ? 'impact' : 'travel', space: 'ground' },
        );
      }
      break;
    case 'rocks':
      release(0.55);
      for (let i = 0; i < script.count; i++) {
        const n = i - (script.count - 1) / 2;
        const end = offset(target, n * script.spread * unit * 0.4, 0);
        at(
          offset(end, -dir * 25 * unit, -Math.min(170 * unit, end.y - 8)),
          end,
          0.12 + i * 0.09,
          0.35,
          { size: size * (0.68 + (i % 3) * 0.17), rotation: n * 9, space: 'ground' },
        );
        if (impact)
          still(end, script.impactAt + i * 0.09, 0.16, 0.9, {
            role: 'impact',
            frames: 'impact',
            space: 'ground',
          });
      }
      break;
    case 'heal':
      for (let i = 0; i < script.count; i++) {
        const a = (i * Math.PI * 2) / script.count;
        at(
          offset(source, Math.cos(a) * script.spread * unit, Math.sin(a) * script.spread * unit),
          source,
          0.04 + i * 0.065,
          0.48,
          {
            size: size * 0.65,
            role: 'self',
            via: offset(
              source,
              Math.cos(a + 0.65) * script.spread * unit,
              Math.sin(a + 0.65) * script.spread * unit,
            ),
          },
        );
      }
      still(source, 0.51, 0.44, 1.4, { role: 'self' });
      break;
    case 'sleep':
      for (let i = 0; i < script.count; i++)
        at(
          source,
          offset(source, dir * (18 + i * 8) * unit, (-37 - i * 18) * unit),
          0.03 + i * 0.18,
          0.46,
          {
            size: size * (0.6 + i * 0.15),
            role: 'self',
            via: offset(source, -dir * 13 * unit, -32 * unit),
          },
        );
      break;
    case 'agility':
      for (let i = 0; i < script.count; i++) {
        const d = i % 2 ? 1 : -1;
        at(
          offset(source, d * script.spread * unit, 0),
          offset(source, -d * script.spread * unit, 0),
          i * 0.15,
          0.28,
          { size: size * (0.9 - i * 0.08), role: 'self', opacity: 0.75, rotation: d * 8 },
        );
      }
      break;
    case 'shield':
      still(source, 0.02, 0.89, 1.15, { role: 'self' });
      break;
    case 'swords':
      for (let i = 0; i < script.count; i++) {
        const a = (i * Math.PI * 2) / script.count;
        at(
          offset(source, Math.cos(a) * script.spread * unit, Math.sin(a) * script.spread * unit),
          offset(
            source,
            Math.cos(a + Math.PI) * script.spread * unit,
            Math.sin(a + Math.PI) * script.spread * unit,
          ),
          0.02 + i * 0.025,
          0.78,
          {
            via: offset(
              source,
              Math.cos(a + Math.PI / 2) * script.spread * unit,
              Math.sin(a + Math.PI / 2) * script.spread * unit,
            ),
            size: size * 0.78,
            role: 'self',
            rotation: -dir * 12,
          },
        );
      }
      break;
  }
  return { script, source, target, origin, layers };
}

export type EffectSceneSampler = (elapsedMs: number) => BattleScene;

const subtract = (a: EffectPoint, b: EffectPoint): EffectPoint => ({ x: a.x - b.x, y: a.y - b.y });
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const pathAngle = (from: EffectPoint, to: EffectPoint) =>
  (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

function frameOffsets(
  layer: EffectSpriteLayer,
  timeline: SpriteTimeline,
  cue: BattleCue,
  baseScene: BattleScene,
  currentScene: BattleScene,
) {
  const current = resolveEffectAnchors(cue, currentScene, timeline.script);
  const source = layer.sourceAnchor
    ? baseScene.actors[cue.side].anchors[layer.sourceAnchor]
    : timeline.source;
  const liveSource = layer.sourceAnchor
    ? currentScene.actors[cue.side].anchors[layer.sourceAnchor]
    : current.source;
  return {
    source,
    sourceDelta: subtract(liveSource, source),
    targetDelta: subtract(current.target, timeline.target),
    angleDelta: pathAngle(liveSource, current.target) - pathAngle(source, timeline.target),
  };
}

function moveWithAnchors(
  original: EffectPoint,
  source: EffectPoint,
  target: EffectPoint,
  sourceDelta: EffectPoint,
  targetDelta: EffectPoint,
) {
  const dx = target.x - source.x,
    dy = target.y - source.y;
  const distanceSquared = dx * dx + dy * dy;
  const fraction =
    distanceSquared > 0
      ? clamp01(((original.x - source.x) * dx + (original.y - source.y) * dy) / distanceSquared)
      : 0;
  const shift = lerp(sourceDelta, targetDelta, fraction);
  return point(offset(original, shift.x, shift.y));
}

/** Freeze emitted particles using the real pose at launch and the real victim pose at arrival.
 * The same sampled path is used for the whole flight, so a turning head cannot drag a fired shot.
 */
export function bindSpriteTimeline(
  timeline: SpriteTimeline,
  cue: BattleCue,
  baseScene: BattleScene,
  sceneAt: EffectSceneSampler,
): SpriteTimeline {
  return {
    ...timeline,
    releaseSource: resolveEffectAnchors(
      cue,
      sceneAt(timeline.script.releaseAt * cue.durationMs),
      timeline.script,
    ).source,
    releaseTarget: resolveEffectAnchors(
      cue,
      sceneAt(timeline.script.impactAt * cue.durationMs),
      timeline.script,
    ).target,
    layers: timeline.layers.map((layer) => {
      if (layer.space !== 'flight') return layer;
      const adjust = (p: EffectPoint, elapsed: number, binding: 'source' | 'target' | 'path') => {
        const delta = frameOffsets(layer, timeline, cue, baseScene, sceneAt(elapsed));
        if (binding === 'source') return point(offset(p, delta.sourceDelta.x, delta.sourceDelta.y));
        if (binding === 'target') return point(offset(p, delta.targetDelta.x, delta.targetDelta.y));
        return moveWithAnchors(
          p,
          delta.source,
          timeline.target,
          delta.sourceDelta,
          delta.targetDelta,
        );
      };
      return {
        ...layer,
        from: adjust(
          layer.from,
          layer.delay,
          layer.fromBinding || (layer.role === 'return' ? 'target' : 'source'),
        ),
        via: adjust(layer.via, layer.delay + layer.duration / 2, 'path'),
        to: adjust(
          layer.to,
          layer.delay + layer.duration,
          layer.toBinding || (layer.role === 'return' ? 'source' : 'target'),
        ),
      };
    }),
  };
}

export type EffectDepth = 'rear' | 'middle' | 'front';
export const EFFECT_DEPTH_Z: Record<EffectDepth, number> = { rear: 1, middle: 3, front: 5 };
const actorScale = (value: number) => Math.max(1, Math.round(value));
function pathFraction(position: EffectPoint, source: EffectPoint, target: EffectPoint) {
  const dx = target.x - source.x,
    dy = target.y - source.y;
  const length = dx * dx + dy * dy;
  return length
    ? clamp01(((position.x - source.x) * dx + (position.y - source.y) * dy) / length)
    : 0;
}
export function getEffectPixelScale(
  layer: EffectSpriteLayer,
  timeline: SpriteTimeline,
  cue: BattleCue,
  scene: BattleScene,
  position: EffectPoint,
): number {
  const source = actorScale(scene.actors[cue.side].pixelScale);
  const target = actorScale(scene.actors[cue.targetSide].pixelScale);
  if (layer.space === 'source' || layer.role === 'self') return source;
  if (layer.space === 'target' || layer.role === 'impact') return target;
  return actorScale(
    source + (target - source) * pathFraction(position, timeline.source, timeline.target),
  );
}
export function getEffectGridOrigin(
  scene: BattleScene,
  cue: BattleCue,
  scale: number,
  owner?: 'source' | 'target',
  position?: EffectPoint,
): EffectPoint {
  if (owner === 'source') return scene.actors[cue.side].origin;
  if (owner === 'target') return scene.actors[cue.targetSide].origin;
  const source = scene.actors[cue.side],
    target = scene.actors[cue.targetSide];
  if (scale === actorScale(source.pixelScale) && scale === actorScale(target.pixelScale)) {
    const progress = position
      ? pathFraction(position, source.anchors.body, target.anchors.body)
      : 0;
    return progress > 0.5 ? target.origin : source.origin;
  }
  if (scale === actorScale(source.pixelScale)) return source.origin;
  if (scale === actorScale(target.pixelScale)) return target.origin;
  return { x: 0, y: 0 };
}
const behindActor = (side: BattleCue['side']): EffectDepth =>
  side === 'player' ? 'middle' : 'rear';
const beforeActor = (side: BattleCue['side']): EffectDepth =>
  side === 'player' ? 'front' : 'middle';
export function getEffectDepth(
  layer: EffectSpriteLayer,
  timeline: SpriteTimeline,
  cue: BattleCue,
  scene: BattleScene,
  position: EffectPoint,
): EffectDepth {
  if (layer.role === 'self' || layer.space === 'source') return behindActor(cue.side);
  if (layer.role === 'impact' || layer.space === 'target') return beforeActor(cue.targetSide);
  if (layer.space === 'ground') return behindActor(cue.targetSide);
  const inside = (side: BattleCue['side']) => {
    const box = scene.actors[side].activeBounds || scene.actors[side].bounds;
    return (
      position.x >= box.x &&
      position.x <= box.x + box.width &&
      position.y >= box.y &&
      position.y <= box.y + box.height
    );
  };
  const t = pathFraction(position, timeline.source, timeline.target);
  if (t < 0.35 && inside(cue.side))
    return layer.role === 'return' ? beforeActor(cue.side) : behindActor(cue.side);
  if (t > 0.65 && inside(cue.targetSide))
    return layer.role === 'return' ? behindActor(cue.targetSide) : beforeActor(cue.targetSide);
  return 'middle';
}

export interface EffectSpriteSample {
  position: EffectPoint;
  opacity: number;
  rotation: number;
  pixelScale: number;
  depth: EffectDepth;
  gridOrigin: EffectPoint;
}

/** Position, opacity and crop frame all share the cue clock, including delayed particles. */
export function sampleSpriteLayer(
  layer: EffectSpriteLayer,
  timeline: SpriteTimeline,
  cue: BattleCue,
  baseScene: BattleScene,
  currentScene: BattleScene,
  elapsedMs: number,
): EffectSpriteSample {
  const progress = (elapsedMs - layer.delay) / layer.duration;
  const active = progress >= 0 && progress < 1;
  const t = Math.floor(clamp01(progress) * 18) / 18;
  const basePoint =
    t < 0.5 ? lerp(layer.from, layer.via, t * 2) : lerp(layer.via, layer.to, (t - 0.5) * 2);
  let position = basePoint;
  let rotation = layer.rotation;
  if (layer.space !== 'flight' && layer.space !== 'ground') {
    const delta = frameOffsets(layer, timeline, cue, baseScene, currentScene);
    if (layer.space === 'source')
      position = offset(basePoint, delta.sourceDelta.x, delta.sourceDelta.y);
    else if (layer.space === 'target')
      position = offset(basePoint, delta.targetDelta.x, delta.targetDelta.y);
    else {
      position = moveWithAnchors(
        basePoint,
        delta.source,
        timeline.target,
        delta.sourceDelta,
        delta.targetDelta,
      );
      rotation += delta.angleDelta;
    }
  }
  const fade = !active
    ? 0
    : progress < 0.09
      ? progress / 0.09
      : progress > 0.82
        ? (1 - progress) / 0.18
        : 1;
  const pixelScale = getEffectPixelScale(layer, timeline, cue, currentScene, position);
  const owner =
    layer.role === 'impact' || layer.space === 'target'
      ? 'target'
      : layer.role === 'self' || layer.space === 'source'
        ? 'source'
        : undefined;
  const gridOrigin = getEffectGridOrigin(currentScene, cue, pixelScale, owner, position);
  position = snapNativePoint(position, pixelScale, gridOrigin);
  return {
    position,
    opacity: fade * layer.opacity,
    rotation,
    pixelScale,
    depth: getEffectDepth(layer, timeline, cue, currentScene, position),
    gridOrigin,
  };
}

/** A late-mounted frame catches up to the existing cue instead of restarting its animation. */
export function effectCueElapsed(now: number, cueStartedAt: number, durationMs: number): number {
  return Math.max(0, Math.min(durationMs, now - cueStartedAt));
}
