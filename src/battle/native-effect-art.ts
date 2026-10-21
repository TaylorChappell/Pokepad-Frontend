import catalogue from './native-effect-catalogue.json';

/** Native PMD pixels are kept at the same integer scene scale as the battlers. */
export interface NativeEffectFrame {
  x: number;
  y: number;
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  sourceX: number;
  sourceY: number;
}
export type NativeDirectionMode = 'None' | 'Dir1' | 'Dir2' | 'Dir5' | 'Dir8' | 'Flip';
export interface NativeEffectAsset {
  id: string;
  path: string;
  width: number;
  height: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  pivot: { x: number; y: number };
  directionMode: NativeDirectionMode;
  directions: number;
  directionOrder: string[];
  frameMs: number;
  timingSource: string;
  frames: NativeEffectFrame[][];
  sourcePath: string;
}
export interface NativeBeamArt {
  head: string;
  body: string;
  tail: string;
}
export interface NativeMoveArt {
  release: string;
  travel: string;
  impact: string;
  self?: string;
  back?: string;
  front?: string;
  beam?: NativeBeamArt;
  releasePivot?: readonly [number, number];
}
type NativeRoleProfile = Partial<NativeMoveArt>;

export const NATIVE_EFFECT_ASSETS = catalogue as unknown as Readonly<
  Record<string, NativeEffectAsset>
>;
export const NATIVE_EFFECT_SOURCE = {
  repository: 'PMDCollab/RawAsset',
  commit: '03c80dad937911572f8fb19903771a47956fc696',
  formatSource:
    'https://github.com/RogueCollab/RogueEssence/blob/master/RogueEssence/Content/DirSheet.cs',
  beamFormatSource:
    'https://github.com/RogueCollab/RogueEssence/blob/master/RogueEssence/Content/BeamSheet.cs',
} as const;

/**
 * Original PMD effect sheets, composed for this battle scene. Shared impact/spark
 * sheets are intentional; this mapping does not claim original per-move timing.
 * Front/back pairs must straddle the target body rather than share one overlay.
 */
const nativeRoleProfiles: Readonly<Record<string, NativeRoleProfile>> = {
  Ember: {
    release: 'ember',
    travel: 'ember',
    impact: 'burned',
  },
  Flamethrower: {
    release: 'ember',
    travel: 'ember',
    impact: 'flamethrower',
    beam: {
      head: 'beam_column_red_head',
      body: 'beam_column_red_body',
      tail: 'beam_column_red_tail',
    },
  },
  'Fire Blast': {
    travel: 'ember',
    impact: 'fire_blast',
  },
  'Fire Spin': {
    travel: 'fire_spin_fireball',
    back: 'fire_spin_back',
    front: 'fire_spin_front',
  },
  'Dragon Rage': {
    release: 'dragon_pulse_charge',
    travel: 'dragon_pulse_ball',
    impact: 'fire_blast',
  },
  'Hyper Beam': {
    release: 'charge_beam_start',
    impact: 'explosion',
    beam: {
      head: 'beam_column_yellow_head',
      body: 'beam_column_yellow_body',
      tail: 'beam_column_yellow_tail',
    },
  },
  'Water Gun': {
    release: 'water_spout_splash',
    impact: 'water_spout_splash',
    beam: {
      head: 'beam_column_blue_head',
      body: 'beam_column_blue_body',
      tail: 'beam_column_blue_tail',
    },
  },
  Surf: {
    travel: 'aqua_tail_wave',
    impact: 'water_spout_splash',
  },
  'Hydro Pump': {
    release: 'water_spout_splash',
    impact: 'hydro_cannon',
    beam: {
      head: 'beam_column_blue_head',
      body: 'beam_column_blue_body',
      tail: 'beam_column_blue_tail',
    },
  },
  'Ice Beam': {
    release: 'icy_wind_particle',
    impact: 'ice_rse',
    beam: {
      head: 'beam_column_white_head',
      body: 'beam_column_white_body',
      tail: 'beam_column_white_tail',
    },
  },
  'Thunder Shock': {
    release: 'shock_wave',
    impact: 'spark',
    beam: {
      head: 'beam_lightning_head',
      body: 'beam_lightning_body',
      tail: 'beam_lightning_tail',
    },
  },
  Thunderbolt: {
    release: 'charge_up',
    impact: 'discharge_hit',
    beam: {
      head: 'beam_lightning_head',
      body: 'beam_lightning_body',
      tail: 'beam_lightning_tail',
    },
  },
  'Thunder Wave': {
    travel: 'wave_circle_yellow',
    impact: 'shock_wave',
  },
  Psychic: {
    release: 'confuse_ray',
    travel: 'wave_circle_pink',
    impact: 'circle_purple_out',
  },
  Confusion: {
    travel: 'wave_circle_pink',
    impact: 'confuse_ray',
  },
  Hypnosis: {
    travel: 'wave_circle_purple',
    impact: 'sleep_z',
  },
  'Night Shade': {
    release: 'grudge_lights',
    back: 'dark_pulse_back',
    front: 'dark_pulse_front',
  },
  'Dream Eater': {
    release: 'confuse_ray',
    travel: 'wave_circle_purple',
    impact: 'absorb',
  },
  'Vine Whip': {
    travel: 'vine_whip',
    impact: 'vine_whip_2',
  },
  'Razor Leaf': {
    release: 'razor_leaf_charge',
    travel: 'razor_leaf',
    impact: 'hit_neutral',
  },
  'Solar Beam': {
    release: 'solar_beam_charge',
    travel: 'solar_beam_particle',
    impact: 'hit_super_effective',
    beam: {
      head: 'beam_column_green_head',
      body: 'beam_column_green_body',
      tail: 'beam_column_green_tail',
    },
  },
  'Sleep Powder': {
    travel: 'spores_rse_green',
    impact: 'sleep_z',
  },
  'Poison Powder': {
    travel: 'spores_rse_purple',
    impact: 'bubbles_purple',
  },
  'Poison Sting': {
    travel: 'thorn_pink',
    impact: 'hit_neutral',
  },
  Scratch: {
    impact: 'scratch',
  },
  Slash: {
    impact: 'slash',
  },
  Bite: {
    impact: 'bite',
  },
  Lick: {
    travel: 'lick',
    impact: 'hit_neutral',
  },
  'Low Kick': {
    impact: 'print_foot',
  },
  'Wing Attack': {
    travel: 'wing_attack',
    impact: 'hit_neutral',
  },
  Tackle: {
    impact: 'hit_neutral',
  },
  'Body Slam': {
    impact: 'hit_super_effective',
  },
  'Double-Edge': {
    release: 'charge_beam_glow',
    impact: 'hit_super_effective',
  },
  'Quick Attack': {
    travel: 'tailwind',
    impact: 'hit_neutral',
  },
  Fly: {
    travel: 'sky_attack',
    impact: 'hit_super_effective',
  },
  Struggle: {
    impact: 'hit_neutral',
  },
  Growl: {
    travel: 'growl',
  },
  Swift: {
    travel: 'swift_star',
    impact: 'sparkle_rse',
  },
  'Sand Attack': {
    travel: 'sand_tomb_sand',
    impact: 'puff_brown',
  },
  Earthquake: {
    impact: 'earthquake_ranger',
    front: 'rock_pieces',
  },
  'Rock Slide': {
    travel: 'rock_pieces',
    back: 'rock_slide_back',
    front: 'rock_slide_front',
  },
  'String Shot': {
    travel: 'string_shot_ball',
    impact: 'string_shot_web',
  },
  Recover: {
    self: 'synthesis_sparkle',
    impact: 'materialize',
  },
  Rest: {
    self: 'sleep_z',
  },
  Agility: {
    self: 'tailwind',
  },
  Harden: {
    self: 'ice_rse',
    release: 'ice_rse',
  },
  'Swords Dance': {
    self: 'sword_lightblue',
    release: 'sword_lightblue',
    travel: 'sword_lightblue',
    impact: 'sword_lightblue',
  },
  'Leech Life': {
    release: 'bite',
    travel: 'absorb',
    impact: 'synthesis_sparkle',
  },
};

export const NATIVE_MOVE_ART: Readonly<Record<string, NativeMoveArt>> = Object.freeze(
  Object.fromEntries(
    Object.entries(nativeRoleProfiles).map(([name, profile]) => {
      const travel =
        profile.travel ||
        profile.impact ||
        profile.self ||
        profile.front ||
        profile.release ||
        'hit_neutral';
      return [
        name,
        {
          ...profile,
          release: profile.release || travel,
          travel,
          impact: profile.impact || profile.front || travel,
        } satisfies NativeMoveArt,
      ];
    }),
  ),
);

export function getNativeMoveArt(moveName?: string): NativeMoveArt {
  return NATIVE_MOVE_ART[moveName || ''] || NATIVE_MOVE_ART.Struggle;
}

export function nativeMoveAssetIds(moveName: string): string[] {
  const art = getNativeMoveArt(moveName);
  return [
    ...new Set(
      [
        art.release,
        art.travel,
        art.impact,
        art.self,
        art.back,
        art.front,
        art.beam?.head,
        art.beam?.body,
        art.beam?.tail,
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
}

/** Materialize is a native star → white orb → ring sheet; recall reverses it. */
export const NATIVE_TRANSITION_ART = {
  sendOut: { asset: 'materialize', reverse: false, ring: 'circle_white_out' },
  recall: { asset: 'materialize', reverse: true, ring: 'circle_white_in' },
} as const;
