import { paintNativeTether, type NativeTetherCommand } from './native-tether-renderer';
import type { BattleCue } from './presentation';
import type { BattleScene } from './geometry';
import {
  getEffectDepth,
  getEffectGridOrigin,
  getEffectPixelScale,
  resolveEffectAnchors,
  sampleSpriteLayer,
  type EffectDepth,
  type EffectPoint,
  type EffectSpriteLayer,
  type SpriteTimeline,
} from './effect-sprites';
import { getNativeMoveArt } from './native-effect-art';
import {
  getNativeEffectAsset,
  getNativeEffectImage,
  nativeEffectDirection,
  nativeEffectFrameAt,
  paintNativeEffectBeam,
  paintNativeEffectSprite,
  snapNativePoint,
  type NativeBeamPaint,
  type NativeCanvasFactory,
  type NativeSpritePaint,
} from './native-effect-renderer';

export interface NativeSpriteCommand {
  key: string;
  assetId: string;
  depth: EffectDepth;
  role: EffectSpriteLayer['role'];
  paint: NativeSpritePaint;
  pivot?: EffectPoint;
  clip?: { x: number; y: number; width: number; height: number };
}
export interface NativeBeamCommand {
  key: string;
  assetId: string;
  paint: NativeBeamPaint;
  depthAt: (point: EffectPoint) => EffectDepth;
}
export interface NativeEffectScene {
  sprites: NativeSpriteCommand[];
  beams: NativeBeamCommand[];
  tethers: NativeTetherCommand[];
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const angle = (a: EffectPoint, b: EffectPoint) =>
  (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
const behind = (side: BattleCue['side']): EffectDepth => (side === 'player' ? 'middle' : 'rear');
const front = (side: BattleCue['side']): EffectDepth => (side === 'player' ? 'front' : 'middle');

/** Compile native effect clips against the exact body frame and one shared cue clock. */
export function compileNativeEffects(
  timeline: SpriteTimeline,
  cue: BattleCue,
  baseScene: BattleScene,
  currentScene: BattleScene,
  elapsedMs: number,
  reducedMotion = false,
): NativeEffectScene {
  const sprites: NativeSpriteCommand[] = [],
    beams: NativeBeamCommand[] = [],
    tethers: NativeTetherCommand[] = [];
  if (cue.kind === 'faint' || cue.kind === 'switch') return { sprites, beams, tethers };
  const art = getNativeMoveArt(cue.moveName),
    script = timeline.script;
  const anchors = resolveEffectAnchors(cue, currentScene, script);
  const duration = cue.durationMs,
    phase = elapsedMs / duration;
  const caster = currentScene.actors[cue.side],
    victim = currentScene.actors[cue.targetSide];
  const direction = nativeEffectDirection(angle(anchors.source, anchors.target));
  const hit = cue.outcome !== 'miss' && cue.outcome !== 'immune';
  const add = (
    key: string,
    assetId: string,
    role: EffectSpriteLayer['role'],
    position: EffectPoint,
    pixelScale: number,
    depth: EffectDepth,
    frameIndex: number,
    opacity = 1,
    facing = direction,
    pivot?: EffectPoint,
  ) => {
    const owner =
      role === 'impact'
        ? 'target'
        : ['self', 'release', 'transition'].includes(role)
          ? 'source'
          : undefined;
    const gridOrigin = getEffectGridOrigin(currentScene, cue, pixelScale, owner, position);
    const p = snapNativePoint(position, pixelScale, gridOrigin);
    sprites.push({
      key,
      assetId,
      role,
      depth,
      pivot,
      paint: { x: p.x, y: p.y, pixelScale, gridOrigin, direction: facing, frameIndex, opacity },
    });
  };
  if (reducedMotion) {
    const self = anchors.self || !hit;
    const id = self ? art.self || art.release : art.impact;
    add(
      'reduced',
      id,
      self ? (anchors.self ? 'self' : 'release') : 'impact',
      self ? anchors.source : anchors.target,
      Math.max(1, Math.round((self ? caster : victim).pixelScale)),
      self ? behind(cue.side) : front(cue.targetSide),
      Math.min(2, getNativeEffectAsset(id).frameCount - 1),
      0.8,
    );
    return { sprites, beams, tethers };
  }

  // Native beams are one connected cross-section with a single leading sprite.
  // They replace the old row of repeated flame/water stamps completely.
  if (art.beam && !anchors.self && phase >= script.releaseAt && phase < 0.91) {
    const travel = timeline.layers.find((layer) => layer.role === 'travel') || timeline.layers[0];
    const progress = clamp(
      (phase - script.releaseAt) / Math.max(0.1, script.impactAt - script.releaseAt),
    );
    const style: NativeBeamPaint['style'] =
      script.name === 'Flamethrower'
        ? 'fire'
        : ['Water Gun', 'Hydro Pump'].includes(script.name)
          ? 'water'
          : script.name === 'Ice Beam'
            ? 'ice'
            : script.recipe === 'electric'
              ? 'electric'
              : 'energy';
    const opacity = phase > 0.84 ? clamp((0.91 - phase) / 0.07) : 1;
    beams.push({
      key: 'beam',
      assetId: art.beam.body,
      depthAt: (p) => getEffectDepth(travel, timeline, cue, currentScene, p),
      paint: {
        source: anchors.source,
        target: anchors.target,
        sourceScale: Math.max(1, Math.round(caster.pixelScale)),
        targetScale: Math.max(1, Math.round(victim.pixelScale)),
        sourceGrid: caster.origin,
        targetGrid: victim.origin,
        frameIndex: nativeEffectFrameAt(art.beam.body, elapsedMs),
        progress,
        phase: elapsedMs / 70,
        style,
        opacity,
      },
    });
    if (progress < 1) {
      const tip = {
        x: anchors.source.x + (anchors.target.x - anchors.source.x) * progress,
        y: anchors.source.y + (anchors.target.y - anchors.source.y) * progress,
      };
      const scale = getEffectPixelScale(travel, timeline, cue, currentScene, tip);
      const id = style === 'fire' ? 'ember' : art.travel;
      // Large native beam head caps obscure the muzzle; only a small authored leading particle is used.
      if (style !== 'water' && getNativeEffectAsset(id).frameWidth <= 40)
        add(
          'beam-head',
          id,
          'travel',
          tip,
          scale,
          getEffectDepth(travel, timeline, cue, currentScene, tip),
          nativeEffectFrameAt(id, elapsedMs),
          opacity,
        );
    }
  }

  const paired = !!art.back && !!art.front && !anchors.self;
  if (paired && hit && phase >= script.impactAt && phase < 0.98) {
    const ground = script.name === 'Rock Slide';
    const at = ground ? victim.ground : anchors.target;
    for (const [id, depth] of [
      [art.back!, behind(cue.targetSide)],
      [art.front!, front(cue.targetSide)],
    ] as const) {
      const clip = getNativeEffectAsset(id);
      add(
        id,
        id,
        'impact',
        at,
        Math.max(1, Math.round(victim.pixelScale)),
        depth,
        nativeEffectFrameAt(
          id,
          elapsedMs - script.impactAt * duration,
          (0.98 - script.impactAt) * duration,
        ),
        1,
        0,
        ground ? { x: clip.pivot.x, y: clip.frameHeight } : undefined,
      );
    }
  }

  if (script.name === 'Harden' && phase < 0.92) {
    const bounds = caster.activeBounds || caster.bounds;
    for (let i = 0; i < 3; i++) {
      const local = (phase + i * 0.21) % 0.8;
      const at = {
        x: bounds.x + bounds.width * (0.28 + i * 0.22),
        y: bounds.y + bounds.height * (0.3 + (2 - i) * 0.15),
      };
      add(
        `harden-shine-${i}`,
        art.self || 'ice_rse',
        'self',
        at,
        Math.max(1, Math.round(caster.pixelScale)),
        front(cue.side),
        nativeEffectFrameAt(art.self || 'ice_rse', local * duration, 0.8 * duration),
        local < 0.62 ? 1 : 0,
      );
      sprites[sprites.length - 1].clip = bounds;
    }
    return { sprites, beams, tethers };
  }
  if (script.name === 'Swords Dance' && phase < 0.95) {
    const id = 'sword_lightblue';
    const radius = Math.max(18, (caster.activeBounds || caster.bounds).width * 0.45);
    for (let i = 0; i < 3; i++) {
      const orbit = phase * Math.PI * 2 + (i * Math.PI * 2) / 3;
      const at = {
        x: caster.anchors.body.x + Math.cos(orbit) * radius,
        y: caster.anchors.body.y + Math.sin(orbit) * radius * 0.45,
      };
      add(
        `sword-${i}`,
        id,
        'self',
        at,
        Math.max(1, Math.round(caster.pixelScale)),
        Math.sin(orbit) < 0 ? behind(cue.side) : front(cue.side),
        nativeEffectFrameAt(id, elapsedMs + i * 90),
      );
    }
    return { sprites, beams, tethers };
  }
  // These sheets already contain a complete orbit, shield or whip. Repeating the whole
  // native canvas around the actor would multiply its scale and cover the battle.
  const wholeSelf = script.name === 'Agility' || cue.outcome === 'charge';
  if (wholeSelf && phase < 0.94) {
    const id = cue.outcome === 'charge' ? art.release : art.self || art.release;
    add(
      'whole-self',
      id,
      'self',
      anchors.source,
      Math.max(1, Math.round(caster.pixelScale)),
      behind(cue.side),
      nativeEffectFrameAt(id, elapsedMs, duration * 0.94),
    );
    return { sprites, beams, tethers };
  }
  const tether = ['Vine Whip', 'Lick', 'String Shot'].includes(script.name);
  if (tether && phase >= script.releaseAt && phase < 0.88) {
    const progress = clamp((phase - script.releaseAt) / (script.impactAt - script.releaseAt));
    const layer = timeline.layers.find((l) => l.role === 'travel')!;
    if (script.name === 'String Shot') {
      const from = timeline.releaseSource || timeline.source,
        to = timeline.releaseTarget || timeline.target;
      const target = {
        x: from.x + (to.x - from.x) * progress,
        y: from.y + (to.y - from.y) * progress,
      };
      const scale = getEffectPixelScale(layer, timeline, cue, currentScene, target);
      if (progress < 1)
        add(
          'whole-tether',
          art.travel,
          'travel',
          target,
          scale,
          getEffectDepth(layer, timeline, cue, currentScene, target),
          nativeEffectFrameAt(art.travel, elapsedMs - script.releaseAt * duration),
          1,
          direction,
        );
    } else {
      const reach = phase > 0.78 ? clamp((0.88 - phase) / 0.1) : progress;
      tethers.push({
        assetId: art.travel,
        source: anchors.source,
        target: anchors.target,
        sourceScale: Math.max(1, Math.round(caster.pixelScale)),
        targetScale: Math.max(1, Math.round(victim.pixelScale)),
        sourceGrid: caster.origin,
        targetGrid: victim.origin,
        progress: reach,
        phase: elapsedMs / 180,
        style: script.name === 'Vine Whip' ? 'vine' : 'tongue',
        depthAt: (p) => getEffectDepth(layer, timeline, cue, currentScene, p),
      });
    }
  }
  const seen = new Set<string>();
  for (const layer of timeline.layers) {
    if ((art.beam || tether) && layer.role === 'travel') continue;
    if (paired && layer.role === 'impact') continue;
    const sampled = sampleSpriteLayer(layer, timeline, cue, baseScene, currentScene, elapsedMs);
    if (sampled.opacity <= 0) continue;
    let id =
      layer.role === 'impact'
        ? art.impact
        : layer.role === 'release'
          ? art.release
          : layer.role === 'self'
            ? art.self || art.release
            : layer.role === 'return'
              ? 'synthesis_sparkle'
              : art.travel;
    const clip = getNativeEffectAsset(id);
    // Broad area sheets occur once; small sparks, powders and shots retain their staggered timing.
    if (
      (clip.frameWidth >= 64 || clip.frameHeight >= 80) &&
      !['travel', 'return'].includes(layer.role)
    ) {
      const key = `${id}:${layer.role}`;
      if (seen.has(key)) continue;
      seen.add(key);
    }
    if (script.name === 'Earthquake') id = 'rock_pieces';
    let at = sampled.position,
      depth = sampled.depth;
    if (script.name === 'Earthquake' && layer.role === 'impact') {
      at = victim.ground;
      depth = behind(cue.targetSide);
    }
    const facing =
      layer.role === 'return'
        ? nativeEffectDirection(angle(layer.from, layer.to))
        : layer.space === 'flight'
          ? nativeEffectDirection(angle(layer.from, layer.to))
          : direction;
    add(
      layer.key,
      id,
      layer.role,
      at,
      sampled.pixelScale,
      depth,
      nativeEffectFrameAt(id, elapsedMs - layer.delay, layer.duration),
      sampled.opacity,
      facing,
    );
    if (id === 'lick')
      sprites[sprites.length - 1].paint.forceRotation = angle(anchors.source, anchors.target) - 90;
  }
  return { sprites, beams, tethers };
}

/** The same painter is used in the UI and CPU-canvas screenshot verification. */
export function paintNativeEffectPlane(
  ctx: CanvasRenderingContext2D,
  compiled: NativeEffectScene,
  depth: EffectDepth,
  canvasFactory?: NativeCanvasFactory,
  imageFor: (assetId: string) => CanvasImageSource | undefined = getNativeEffectImage,
) {
  for (const tether of compiled.tethers) {
    const image = imageFor(tether.assetId);
    if (image) paintNativeTether(ctx, image, tether, depth, canvasFactory);
  }
  for (const beam of compiled.beams) {
    const image = imageFor(beam.assetId);
    if (image)
      paintNativeEffectBeam(
        ctx,
        image,
        getNativeEffectAsset(beam.assetId),
        {
          ...beam.paint,
          acceptPoint: (p) => beam.depthAt(p) === depth,
        },
        canvasFactory,
      );
  }
  for (const sprite of compiled.sprites) {
    if (sprite.depth !== depth) continue;
    const image = imageFor(sprite.assetId);
    const asset = getNativeEffectAsset(sprite.assetId);
    if (image) {
      if (sprite.clip) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(sprite.clip.x, sprite.clip.y, sprite.clip.width, sprite.clip.height);
        ctx.clip();
      }
      paintNativeEffectSprite(
        ctx,
        image,
        sprite.pivot ? { ...asset, pivot: sprite.pivot } : asset,
        sprite.paint,
        canvasFactory,
      );
      if (sprite.clip) ctx.restore();
    }
  }
}
