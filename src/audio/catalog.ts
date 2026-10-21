/** Original Pokémon Mystery Dungeon samples; provenance is in assets/audio/manifest.json. */
export interface SoundLayer {
  file: string;
  delay?: number;
  duration?: number;
  /** Start within the original recording, in seconds. */
  offset?: number;
  volume?: number;
}
const sample = (file: string, duration = 1.1, delay = 0, volume = 0.8): SoundLayer => ({
  file,
  duration,
  delay,
  volume,
});

// Explicit coverage is intentional. New engine moves must choose a fitting sample and timing.
// Shared samples mirror PMDO's move definitions, with named move clips preferred where present.
export const MOVE_SOUNDS: Record<string, readonly SoundLayer[]> = {
  Swift: [sample('DUN_Swift')],
  Recover: [sample('DUN_Heal', 0.85)],
  Scratch: [sample('DUN_Scratch', 0.5)],
  Tackle: [sample('DUN_Tackle', 0.5)],
  Growl: [sample('DUN_Growl', 0.75)],
  Ember: [sample('DUN_Ember', 0.65)],
  Flamethrower: [sample('DUN_Flamethrower_2', 1)],
  'Fire Blast': [sample('DUN_Fire_Blast_2', 1)],
  'Fire Spin': [sample('DUN_Fire_Spin', 1)],
  Slash: [sample('DUN_Slash', 0.6)],
  Fly: [sample('DUN_Fly', 0.7)],
  'Water Gun': [sample('DUN_Water_Gun_2', 0.8)],
  Surf: [sample('DUN_Surf', 1.1)],
  'Hydro Pump': [sample('DUN_Hydro_Pump', 1.1)],
  Bite: [sample('DUN_Bite', 0.65)],
  'Ice Beam': [sample('DUN_Ice_Beam', 1)],
  'Vine Whip': [sample('DUN_Vine_Whip', 0.65)],
  'Razor Leaf': [sample('DUN_Razor_Leaf', 0.8)],
  'Solar Beam': [sample('DUN_Protect', 0.4), sample('DUN_HP_Drain_2', 0.75, 0.25)],
  'Sleep Powder': [sample('DUN_Stun_Spore', 0.85)],
  Lick: [sample('DUN_Absorb', 0.6)],
  'Night Shade': [sample('DUN_Night_Shade_3', 0.9)],
  Hypnosis: [sample('DUN_Psybeam', 0.9)],
  'Dream Eater': [sample('DUN_Curse', 0.9)],
  Psychic: [sample('DUN_Confusion', 0.9)],
  'Thunder Shock': [sample('DUN_Thunder_Shock', 0.75)],
  Thunderbolt: [sample('DUN_Shock_Wave', 0.9)],
  'Thunder Wave': [sample('DUN_Zap_Cannon', 0.85)],
  'Quick Attack': [sample('DUN_Move_Start', 0.35), sample('DUN_Tackle', 0.4, 0.18, 0.7)],
  'Body Slam': [sample('EVT_Tackle', 0.8)],
  Rest: [sample('DUN_Rest', 0.85)],
  'Hyper Beam': [sample('DUN_Hyper_Beam', 1.15)],
  'Dragon Rage': [sample('DUN_Sacred_Fire', 0.95)],
  Agility: [sample('DUN_Double_Team', 0.75)],
  'Sand Attack': [sample('_UNK_DUN_Sneeze', 0.8)],
  'Double-Edge': [sample('DUN_Close_Combat', 0.85)],
  'Low Kick': [sample('DUN_Punch', 0.65)],
  'Wing Attack': [sample('DUN_Wing_Attack_2', 0.8)],
  'Poison Sting': [sample('DUN_Throw_Spike', 0.75)],
  Earthquake: [sample('DUN_Trapbust_Orb', 1)],
  'Rock Slide': [sample('DUN_Rock_Slide', 1)],
  'Leech Life': [sample('DUN_Leech_Life', 0.9)],
  Confusion: [sample('DUN_Confusion', 0.75)],
  Harden: [sample('DUN_Harden', 0.8)],
  'Swords Dance': [sample('DUN_Swords_Dance_2', 0.9)],
  'String Shot': [sample('DUN_String_Shot', 0.8)],
  'Poison Powder': [sample('DUN_Stun_Spore', 0.8)],
  Struggle: [sample('DUN_Two-Edge', 0.7)],
};
export type BattleSoundCue = 'select' | 'switch' | 'faint' | 'win' | 'lose';
export const BATTLE_SOUNDS: Record<BattleSoundCue, readonly SoundLayer[]> = {
  select: [sample('Select', 0.3, 0, 0.45)],
  switch: [sample('DUN_Send_Home', 0.45), sample('DUN_Summon_Trap', 0.6, 0.55)],
  faint: [sample('DUN_Deep_Fall', 0.8, 0, 0.6)],
  win: [sample('MissionClear', 4, 0, 0.6)],
  lose: [sample('MissionFail', 3.5, 0, 0.55)],
};
export type RevealKind = 'hatch' | 'pack' | 'evolve';
export type RevealPhase = 'opening' | 'revealed';
export interface RevealCue {
  atMs: number;
  name: 'crack' | 'rustle' | 'rip' | 'charge' | 'flash';
  layers: readonly SoundLayer[];
}
export interface RevealTimeline {
  durationMs: number;
  cues: readonly RevealCue[];
  revealed: readonly SoundLayer[];
}
// These timestamps also sample the visual keyframes. No sound is tied to a network request.
// EVT_Egg contains long intentional silences; its individual cracks use their original offsets.
export const REVEAL_TIMELINES: Record<RevealKind, RevealTimeline> = {
  hatch: {
    durationMs: 2400,
    cues: [
      { atMs: 350, name: 'crack', layers: [sample('EVT_Egg_Single', 0.13, 0, 0.9)] },
      { atMs: 900, name: 'crack', layers: [{ ...sample('EVT_Egg', 0.15, 0, 0.9), offset: 1.2 }] },
      {
        atMs: 1500,
        name: 'crack',
        layers: [{ ...sample('EVT_Egg', 0.16, 0, 0.95), offset: 3.39 }],
      },
      { atMs: 2050, name: 'flash', layers: [sample('EVT_Egg_Hatch', 0.9, 0, 0.7)] },
    ],
    revealed: [sample('JoinTeam', 1.57, 0.2, 0.65)],
  },
  pack: {
    durationMs: 1800,
    cues: [
      { atMs: 100, name: 'rustle', layers: [sample('_UNK_DUN_Rustle', 0.45, 0, 0.75)] },
      { atMs: 640, name: 'rip', layers: [sample('EVT_CH02_Box_Open', 0.23, 0, 0.85)] },
      { atMs: 1350, name: 'flash', layers: [sample('DUN_Summon_Trap', 0.5, 0, 0.35)] },
    ],
    revealed: [sample('Treasure', 1.7, 0, 0.65)],
  },
  evolve: {
    durationMs: 4200,
    cues: [
      { atMs: 0, name: 'charge', layers: [sample('EVT_Evolution_Start', 1.07, 0, 0.75)] },
      { atMs: 1250, name: 'charge', layers: [sample('DUN_Protect', 0.55, 0, 0.3)] },
      { atMs: 2300, name: 'charge', layers: [sample('DUN_Protect', 0.55, 0, 0.4)] },
      { atMs: 3250, name: 'flash', layers: [sample('DUN_Summon_Trap', 0.7, 0, 0.45)] },
    ],
    revealed: [sample('LevelUp', 1.81, 0, 0.65)],
  },
};
// Compatibility for callers that need an isolated phase; reveal screens use the shared timeline.
function revealPhases(timeline: RevealTimeline): Record<RevealPhase, readonly SoundLayer[]> {
  return {
    opening: timeline.cues.flatMap((cue) =>
      cue.layers.map((layer) => ({
        ...layer,
        delay: cue.atMs / 1000 + (layer.delay ?? 0),
      })),
    ),
    revealed: timeline.revealed,
  };
}
export const REVEAL_SOUNDS: Record<RevealKind, Record<RevealPhase, readonly SoundLayer[]>> = {
  hatch: revealPhases(REVEAL_TIMELINES.hatch),
  pack: revealPhases(REVEAL_TIMELINES.pack),
  evolve: revealPhases(REVEAL_TIMELINES.evolve),
};
export const BATTLE_PRELOAD = [
  ...Object.values(MOVE_SOUNDS),
  ...Object.values(BATTLE_SOUNDS),
].flat();

export const MOVE_LEARN_SOUND: readonly SoundLayer[] = [sample('LevelUp', 1.81, 0, 0.65)];
