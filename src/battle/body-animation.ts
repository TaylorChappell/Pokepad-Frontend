import type { CSSProperties } from 'react';
import { battleMove, moveCategory, type Side } from './engine';
import type { BattleCue } from './presentation';
import { getMoveSpriteScript } from './effect-sprites';
import catalogueData from './pmd-catalogue.json';

export type BodyPoint = [number, number];
export type BodyRect = [number, number, number, number];
export type BodyAnchor = 'mouth' | 'hand' | 'cannon' | 'body' | 'feet' | 'crown';
export type BodyFacing = 'front' | 'back';
export type BodyVariant = 'normal' | 'shiny';
export interface PmdFrame {
  rect: BodyRect;
  offset: BodyPoint;
  bounds: BodyRect;
  anchors: {
    body: BodyPoint;
    head: BodyPoint;
    leftHand: BodyPoint;
    rightHand: BodyPoint;
    feet: BodyPoint;
  };
}
export interface PmdClip {
  sourceAction?: string;
  durations: number[];
  rushFrame?: number;
  hitFrame?: number;
  returnFrame?: number;
  frames: Record<BodyFacing, PmdFrame[]>;
}
export interface PmdManifest {
  id: number;
  name: string;
  image: { src: string; width: number; height: number };
  canvas: BodyPoint;
  ground?: BodyPoint;
  variants: Record<BodyVariant, { clips: Record<string, PmdClip> }>;
}
export interface PmdCatalogueEntry {
  id: number;
  name: string;
  image: PmdManifest['image'];
  manifest: string;
  canvas: BodyPoint;
  ground: BodyPoint;
  variants: Record<
    BodyVariant,
    {
      bounds: Record<BodyFacing, BodyRect>;
      actions: string[];
      idleFrame?: Record<BodyFacing, PmdFrame>;
    }
  >;
}
export const PMD_CATALOGUE = catalogueData as unknown as Record<string, PmdCatalogueEntry>;

export interface BodyFrame {
  sheet: number;
  rect: BodyRect;
  offset: BodyPoint;
  bounds: BodyRect;
  at: number;
  sourceAction?: string;
  anchors: Record<BodyAnchor, BodyPoint>;
}
export interface BodyClip {
  action: string;
  durationMs: number;
  releaseAt: number;
  impactAt: number;
  returnAt: number;
  frames: BodyFrame[];
}
export interface BodyView {
  bounds: BodyRect;
  contact: BodyPoint;
  clips: Record<string, BodyClip>;
}
export interface BodyManifest {
  version: 1;
  speciesId: number;
  canvasWidth: number;
  canvasHeight: number;
  sheets: { src: string; imageWidth: number; imageHeight: number }[];
  variants: Record<BodyVariant, Record<BodyFacing, BodyView>>;
  preview?: boolean;
}
export interface BodyFrameOptions {
  side: Side;
  shiny?: boolean;
  cue?: BattleCue | null;
  elapsedMs: number;
  reducedMotion?: boolean;
  paused?: boolean;
}
export interface BodyFrameSelection {
  view: BodyView;
  clip: BodyClip;
  frame: BodyFrame;
  frameIndex: number;
  animation: string;
  phase: 'idle' | 'windup' | 'release' | 'recovery' | 'hurt' | 'faint';
}

/** Every move selects an actual PMD body-action family; artwork may share a family. */
export const BODY_MOVE_ACTIONS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  Swift: ['Shoot', 'Attack'],
  Recover: ['DeepBreath', 'Charge', 'Pose'],
  Scratch: ['Attack', 'Strike'],
  Tackle: ['Attack', 'Strike'],
  Growl: ['Shake', 'Charge', 'Shoot'],
  Ember: ['Shoot', 'Charge', 'Attack'],
  Flamethrower: ['Shoot', 'Charge', 'Attack'],
  'Fire Blast': ['Shoot', 'Charge', 'Attack'],
  'Fire Spin': ['Rotate', 'Shoot', 'Charge'],
  Slash: ['Swing', 'Strike', 'Attack'],
  Fly: ['Hop', 'Attack'],
  'Water Gun': ['Shoot', 'Charge', 'Attack'],
  Surf: ['Charge', 'Shoot', 'Shake'],
  'Hydro Pump': ['Shoot', 'Charge', 'Attack'],
  Bite: ['Attack', 'Strike'],
  'Ice Beam': ['Shoot', 'Charge', 'Attack'],
  'Vine Whip': ['Strike', 'Swing', 'Attack'],
  'Razor Leaf': ['Shoot', 'Swing', 'Attack'],
  'Solar Beam': ['Shoot', 'Charge', 'Attack'],
  'Sleep Powder': ['Shake', 'Shoot', 'Charge'],
  Lick: ['Strike', 'Attack'],
  'Night Shade': ['Charge', 'Shoot', 'Shake'],
  Hypnosis: ['Charge', 'Shoot', 'Shake'],
  'Dream Eater': ['Charge', 'Shoot', 'Attack'],
  Psychic: ['Shoot', 'Charge', 'Attack'],
  'Thunder Shock': ['Charge', 'Shoot', 'Shake'],
  Thunderbolt: ['Shoot', 'Charge', 'Attack'],
  'Thunder Wave': ['Shake', 'Charge', 'Shoot'],
  'Quick Attack': ['Attack', 'Strike'],
  'Body Slam': ['Hop', 'Attack'],
  Rest: ['Sleep', 'DeepBreath', 'Pose'],
  'Hyper Beam': ['Shoot', 'Charge', 'Attack'],
  'Dragon Rage': ['Shoot', 'Charge', 'Attack'],
  Agility: ['Walk', 'Hop', 'Attack'],
  'Sand Attack': ['Kick', 'Swing', 'Attack'],
  'Double-Edge': ['Attack', 'Strike'],
  'Low Kick': ['Kick', 'Strike', 'Attack'],
  'Wing Attack': ['Swing', 'Strike', 'Attack'],
  'Poison Sting': ['Strike', 'Attack', 'Shoot'],
  Earthquake: ['Shake', 'Hop', 'Attack'],
  'Rock Slide': ['Shoot', 'Strike', 'Attack'],
  'Leech Life': ['Attack', 'Strike'],
  Confusion: ['Shoot', 'Charge', 'Attack'],
  Harden: ['Pose', 'Charge', 'Shake'],
  'Swords Dance': ['Dance', 'Rotate', 'Swing', 'Attack'],
  'String Shot': ['Shoot', 'Charge', 'Attack'],
  'Poison Powder': ['Shake', 'Shoot', 'Charge'],
  Struggle: ['Attack', 'Strike'],
});

export function getBodyMoveTiming(name?: string) {
  const script = getMoveSpriteScript(name);
  return { releaseAt: script.releaseAt, impactAt: script.impactAt, returnAt: 0.86 };
}

const clamp = (n: number, low = 0, high = 1) => Math.max(low, Math.min(high, n));
const finitePoint = (p: unknown): p is BodyPoint =>
  Array.isArray(p) && p.length === 2 && p.every(Number.isFinite);
const finiteRect = (r: unknown): r is BodyRect =>
  Array.isArray(r) && r.length === 4 && r.every(Number.isFinite) && r[2] > 0 && r[3] > 0;
const rectInside = ([x, y, w, h]: BodyRect, width: number, height: number) =>
  x >= 0 && y >= 0 && x + w <= width + 0.001 && y + h <= height + 0.001;

function bodyAnchors(
  frame: PmdFrame,
  side: Side,
  speciesId: number,
): Record<BodyAnchor, BodyPoint> {
  const { body, head, leftHand, rightHand, feet } = frame.anchors;
  const hand = side === 'player' ? rightHand : leftHand;
  const direction = side === 'player' ? 1 : -1;
  const mouth: BodyPoint = [
    head[0] + direction * Math.min(3, frame.bounds[2] * 0.06),
    head[1] - direction,
  ];
  // PMD supplies a moving head marker and both hands. Species anatomy adds the
  // bulb/horn/cannon points which the original offset format does not encode.
  const crown: BodyPoint = [1, 2, 3].includes(speciesId)
    ? [body[0] - direction * frame.bounds[2] * 0.1, frame.bounds[1] + frame.bounds[3] * 0.19]
    : [head[0], head[1] - Math.min(4, frame.bounds[3] * 0.12)];
  const cannon: BodyPoint =
    speciesId === 9
      ? [
          body[0] + direction * Math.min(13, frame.bounds[2] * 0.4),
          body[1] - Math.min(10, frame.bounds[3] * 0.26) - direction,
        ]
      : mouth;
  return { body, mouth, hand, cannon, feet, crown };
}

function normalizeClip(
  clip: PmdClip,
  action: string,
  facing: BodyFacing,
  speciesId: number,
): BodyClip {
  const sourceAction = clip.sourceAction || action;
  const total = clip.durations.reduce((sum, n) => sum + n, 0);
  let start = 0;
  const frames = clip.frames[facing].map((frame, index): BodyFrame => {
    const at = start / total;
    start += clip.durations[index];
    return {
      ...frame,
      sheet: 0,
      at,
      sourceAction,
      anchors: bodyAnchors(frame, facing === 'back' ? 'player' : 'rival', speciesId),
    };
  });
  const fraction = (index: number | undefined, fallback: number) =>
    index === undefined ? fallback : frames[clamp(Math.trunc(index), 0, frames.length - 1)].at;
  const hit = fraction(clip.hitFrame, frames[Math.floor(frames.length / 2)].at);
  return {
    action: sourceAction,
    durationMs: total * (1000 / 60),
    releaseAt: Math.min(hit, fraction(clip.rushFrame, hit * 0.5)),
    impactAt: hit,
    returnAt: Math.max(hit, fraction(clip.returnFrame, 0.85)),
    frames,
  };
}

/** Import measured PMD frame data. Aliases are resolved by the importer, not guessed at runtime. */
export function normalizeBodyManifest(
  raw: PmdManifest,
  entry = PMD_CATALOGUE[String(raw.id)],
): BodyManifest {
  validatePmdManifest(raw, entry);
  const variants = {} as BodyManifest['variants'];
  for (const variant of ['normal', 'shiny'] as const) {
    variants[variant] = {} as Record<BodyFacing, BodyView>;
    for (const facing of ['front', 'back'] as const) {
      const clips = Object.fromEntries(
        Object.entries(raw.variants[variant].clips).map(([action, clip]) => [
          action,
          normalizeClip(clip, action, facing, raw.id),
        ]),
      );
      // These two source Idle strips are single frames. Their Walk cycle is a real fidget.
      clips.idle =
        clips.Idle?.frames.length > 1
          ? clips.Idle
          : clips.Walk && {
              action: 'Idle / Walk fidget',
              durationMs: 2800,
              releaseAt: 0.13,
              impactAt: 0.6,
              returnAt: 0.86,
              frames: [
                { ...clips.Idle.frames[0], at: 0 },
                ...clips.Walk.frames.map((frame) => ({ ...frame, at: 0.63 + frame.at * 0.32 })),
                { ...clips.Idle.frames[0], at: 0.95 },
              ],
            };
      clips.Faint = clips.Faint || clips.Sleep || clips.Hurt;
      if (!clips.idle || clips.idle.frames.length < 2)
        throw new Error(`Animated idle unavailable for Pokémon ${raw.id}`);
      variants[variant][facing] = {
        bounds: entry.variants[variant].bounds[facing],
        contact: entry.ground,
        clips,
      };
    }
  }
  return {
    version: 1,
    speciesId: raw.id,
    canvasWidth: raw.canvas[0],
    canvasHeight: raw.canvas[1],
    sheets: [{ src: raw.image.src, imageWidth: raw.image.width, imageHeight: raw.image.height }],
    variants,
  };
}

export function validatePmdManifest(raw: PmdManifest, entry?: PmdCatalogueEntry): void {
  const fail = (message: string): never => {
    throw new Error(`Invalid Pokémon ${entry?.id ?? raw?.id ?? ''} animation: ${message}`);
  };
  if (
    !entry ||
    !raw ||
    raw.id !== entry.id ||
    !finitePoint(raw.canvas) ||
    raw.canvas.some((n) => n <= 0) ||
    raw.canvas[0] !== entry.canvas[0] ||
    raw.canvas[1] !== entry.canvas[1] ||
    raw.image?.src !== entry.image.src ||
    raw.image.width !== entry.image.width ||
    raw.image.height !== entry.image.height
  )
    fail('manifest identity');
  for (const variant of ['normal', 'shiny'] as const) {
    const clips = raw.variants?.[variant]?.clips;
    if (!clips || !clips.Idle || !clips.Attack || !clips.Hurt) fail(`${variant} actions`);
    for (const [name, clip] of Object.entries(clips)) {
      if (
        !clip ||
        !Array.isArray(clip.durations) ||
        !clip.durations.length ||
        !clip.durations.every((n) => Number.isFinite(n) && n > 0)
      )
        fail(`${name} durations`);
      for (const facing of ['front', 'back'] as const) {
        const frames = clip.frames?.[facing];
        if (!Array.isArray(frames) || frames.length !== clip.durations.length)
          fail(`${name} direction frames`);
        for (const frame of frames) {
          if (
            !frame ||
            !finiteRect(frame.rect) ||
            !rectInside(frame.rect, raw.image.width, raw.image.height) ||
            !finitePoint(frame.offset) ||
            !finiteRect(frame.bounds) ||
            !rectInside(frame.bounds, raw.canvas[0], raw.canvas[1])
          )
            fail(`${name} source frame`);
          for (const anchor of ['body', 'head', 'leftHand', 'rightHand', 'feet'] as const)
            if (!finitePoint(frame.anchors?.[anchor])) fail(`${name} ${anchor}`);
        }
      }
    }
  }
}

const previewCache = new Map<number, BodyManifest>();
/** Only used while metadata loads; keeps the final union geometry from the first paint. */
export function getBodyPreviewManifest(speciesId: number): BodyManifest {
  const cached = previewCache.get(speciesId);
  if (cached) return cached;
  const entry = PMD_CATALOGUE[String(speciesId)];
  if (!entry) throw new Error(`Pokémon animation not catalogued: ${speciesId}`);
  const variants = {} as BodyManifest['variants'];
  for (const variant of ['normal', 'shiny'] as const) {
    variants[variant] = {} as Record<BodyFacing, BodyView>;
    for (const facing of ['front', 'back'] as const) {
      const source = entry.variants[variant].idleFrame?.[facing];
      const bounds = entry.variants[variant].bounds[facing];
      const anchor = [bounds[0] + bounds[2] / 2, bounds[1] + bounds[3] / 2] as BodyPoint;
      // The frame is never rendered without an idle crop; the box is a loading placeholder only.
      const frame: BodyFrame = source
        ? {
            ...source,
            sheet: 0,
            at: 0,
            anchors: bodyAnchors(source, facing === 'back' ? 'player' : 'rival', speciesId),
          }
        : {
            sheet: 0,
            rect: [0, 0, 1, 1],
            offset: [0, 0],
            bounds,
            at: 0,
            anchors: {
              body: anchor,
              mouth: anchor,
              hand: anchor,
              cannon: anchor,
              crown: anchor,
              feet: entry.ground,
            },
          };
      const idle: BodyClip = {
        action: 'Idle',
        durationMs: 1000,
        releaseAt: 0.13,
        impactAt: 0.6,
        returnAt: 0.86,
        frames: [frame],
      };
      variants[variant][facing] = { bounds, contact: entry.ground, clips: { idle, Idle: idle } };
    }
  }
  const manifest: BodyManifest = {
    version: 1,
    speciesId,
    canvasWidth: entry.canvas[0],
    canvasHeight: entry.canvas[1],
    sheets: [
      { src: entry.image.src, imageWidth: entry.image.width, imageHeight: entry.image.height },
    ],
    variants,
    preview: true,
  };
  previewCache.set(speciesId, manifest);
  return manifest;
}

export function getBodyView(manifest: BodyManifest, side: Side, shiny = false): BodyView {
  return manifest.variants[shiny ? 'shiny' : 'normal'][side === 'player' ? 'back' : 'front'];
}
export function resolveBodyAction(view: BodyView, moveName: string): BodyClip {
  const choices = BODY_MOVE_ACTIONS[moveName];
  if (!choices) throw new Error(`Body animation mapping unavailable for ${moveName}`);
  for (const name of choices) if (view.clips[name]) return view.clips[name];
  if (view.clips.Attack) return view.clips.Attack;
  throw new Error(`Body animation unavailable for ${moveName}`);
}

export const adaptPmdManifest = normalizeBodyManifest;
export function bodyFrameIndexAt(clip: BodyClip, progress: number): number {
  progress = clamp(Number.isFinite(progress) ? progress : 0);
  for (let index = clip.frames.length - 1; index >= 0; index--)
    if (progress >= clip.frames[index].at) return index;
  return 0;
}
const interpolate = (value: number, fromA: number, fromB: number, toA: number, toB: number) =>
  fromB <= fromA ? toB : toA + clamp((value - fromA) / (fromB - fromA)) * (toB - toA);
function sourceProgress(clip: BodyClip, progress: number, moveName: string): number {
  const timing = getBodyMoveTiming(moveName);
  const script = getMoveSpriteScript(moveName);
  const physical =
    ['lunge', 'claw', 'leap'].includes(script.motion) ||
    ['slash', 'bite', 'kick', 'melee'].includes(script.recipe);
  if (!physical) {
    // A shooting pose is held while its beam/projectiles are being emitted.
    if (progress < timing.releaseAt)
      return interpolate(progress, 0, timing.releaseAt, 0, clip.impactAt);
    const emissionEnd = ['beam', 'vine', 'silk', 'tongue'].includes(script.recipe)
      ? 0.9
      : script.recipe === 'stream'
        ? 0.86
        : timing.impactAt;
    if (progress <= emissionEnd) return clip.impactAt;
    return interpolate(progress, emissionEnd, 1, clip.impactAt, 1);
  }
  if (progress < timing.releaseAt)
    return interpolate(progress, 0, timing.releaseAt, 0, clip.releaseAt);
  if (progress < timing.impactAt)
    return interpolate(progress, timing.releaseAt, timing.impactAt, clip.releaseAt, clip.impactAt);
  if (progress < timing.returnAt)
    return interpolate(progress, timing.impactAt, timing.returnAt, clip.impactAt, clip.returnAt);
  return interpolate(progress, timing.returnAt, 1, clip.returnAt, 1);
}

/** One pure sampler drives visible character frames and all effect emission coordinates. */
export function getBodyFrameAt(
  manifest: BodyManifest,
  options: BodyFrameOptions,
): BodyFrameSelection {
  const { side, shiny = false, cue, reducedMotion = false, paused = false } = options;
  const view = getBodyView(manifest, side, shiny);
  const elapsed = Math.max(0, Number.isFinite(options.elapsedMs) ? options.elapsedMs : 0);
  let clip = view.clips.idle;
  let animation = 'idle';
  let phase: BodyFrameSelection['phase'] = 'idle';
  let progress = paused || reducedMotion ? 0 : (elapsed % clip.durationMs) / clip.durationMs;
  if (!manifest.preview && cue) {
    const normalized = clamp(elapsed / Math.max(1, cue.durationMs));
    if (cue.kind === 'faint' && cue.side === side) {
      clip = view.clips.Faint;
      animation = 'Faint';
      phase = 'faint';
      progress = reducedMotion ? 1 : normalized;
    } else if (cue.kind === 'move' && cue.side === side && cue.moveName) {
      clip =
        cue.outcome === 'charge'
          ? view.clips.Charge || resolveBodyAction(view, cue.moveName)
          : resolveBodyAction(view, cue.moveName);
      animation = cue.moveName;
      const timing = getBodyMoveTiming(cue.moveName);
      phase =
        normalized < timing.releaseAt
          ? 'windup'
          : normalized <= timing.impactAt
            ? 'release'
            : 'recovery';
      progress =
        cue.outcome === 'charge'
          ? Math.min(clip.impactAt, normalized * clip.impactAt)
          : reducedMotion
            ? clip.impactAt
            : sourceProgress(clip, normalized, cue.moveName);
    } else if (
      cue.kind === 'move' &&
      cue.targetSide === side &&
      cue.side !== side &&
      cue.outcome === 'hit' &&
      !!cue.moveName &&
      moveCategory(battleMove(cue.moveName)) !== 'Status'
    ) {
      const hit = getBodyMoveTiming(cue.moveName).impactAt;
      if (normalized >= hit) {
        clip = view.clips.Hurt;
        animation = 'Hurt';
        phase = 'hurt';
        progress = reducedMotion ? 0 : interpolate(normalized, hit, 1, 0, 1);
      } else progress = 0;
    } else if (cue.kind === 'move') progress = 0;
  }
  const frameIndex = bodyFrameIndexAt(clip, progress);
  return { view, clip, frame: clip.frames[frameIndex], frameIndex, animation, phase };
}

/** Percentages retain each action's original pixel scale despite different cell dimensions. */
export function getBodyFrameStyle(manifest: BodyManifest, frame: BodyFrame): CSSProperties {
  const sheet = manifest.sheets[frame.sheet];
  const [x, y, width, height] = frame.rect;
  return {
    left: `${(frame.offset[0] / manifest.canvasWidth) * 100}%`,
    top: `${(frame.offset[1] / manifest.canvasHeight) * 100}%`,
    width: `${(width / manifest.canvasWidth) * 100}%`,
    height: `${(height / manifest.canvasHeight) * 100}%`,
    backgroundSize: `${(sheet.imageWidth / width) * 100}% ${(sheet.imageHeight / height) * 100}%`,
    backgroundPosition: `${sheet.imageWidth === width ? 0 : (x / (sheet.imageWidth - width)) * 100}% ${sheet.imageHeight === height ? 0 : (y / (sheet.imageHeight - height)) * 100}%`,
  };
}
