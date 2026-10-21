import type { OwnedPokemon, Move } from '../types';
import { POKEMON, pokemonById } from '../data/pokemon';
import { BASE_STATS, getPokemonStats } from '../data/stats';
import { MOVES, MOVE_OPTIONS } from '../data/moves';

export type Difficulty = 'Easy' | 'Medium' | 'Hard' | 'Master';
export type Side = 'player' | 'rival';
export type Status = 'none' | 'burn' | 'poison' | 'paralysis' | 'sleep' | 'freeze';
type Stats = ReturnType<typeof getPokemonStats>;
type Stage = 'attack' | 'defense' | 'specialAttack' | 'specialDefense' | 'speed' | 'accuracy';
export interface Fighter {
  id: string;
  speciesId: number;
  level: number;
  shiny: boolean;
  stats: Stats;
  hp: number;
  moves: string[];
  pp: number[];
  stages: Record<Stage, number>;
  status: Status;
  statusTurns: number;
  trapped: number;
  charging: string | null;
  recharge: boolean;
  trainingScale: number;
}
export interface BattleEvent {
  text: string;
  side?: Side;
  kind: 'move' | 'damage' | 'status' | 'switch' | 'faint' | 'result' | 'info';
  /** Presentation metadata is independent of translated battle messages. */
  moveName?: string;
  movePhase?: 'charge' | 'release';
  targetSide?: Side;
  outcome?: 'miss' | 'immune';
  frame?: Pick<BattleState, 'player' | 'rival' | 'active' | 'winner' | 'replacementRequired'>;
}
export interface BattleState {
  player: Fighter[];
  rival: Fighter[];
  active: Record<Side, number>;
  replacementRequired: Record<Side, boolean>;
  difficulty: Difficulty;
  turn: number;
  winner: Side | 'draw' | null;
  events: BattleEvent[];
  history: BattleEvent[];
  lastRivalSwitch: number;
}
export type BattleAction =
  | { kind: 'move'; index: number }
  | { kind: 'switch'; index: number }
  | { kind: 'replace'; index: number };
export const DIFFICULTIES: Record<Difficulty, { ratio: number; detail: string; trainer: string }> =
  {
    Easy: {
      ratio: 0.76,
      detail: 'A weaker team. A relaxed place to try new moves.',
      trainer: 'Leaf',
    },
    Medium: {
      ratio: 1,
      detail: 'A team matched to your strength. Read the matchup.',
      trainer: 'Brock',
    },
    Hard: {
      ratio: 1.2,
      detail: 'A stronger team that looks for type advantages.',
      trainer: 'Blue',
    },
    Master: {
      ratio: 1.42,
      detail: 'An elite team that switches and plans its attacks.',
      trainer: 'Red',
    },
  };

const extraMoves: Move[] = [
  {
    name: 'Low Kick',
    type: 'Fighting',
    power: 50,
    accuracy: 100,
    pp: 20,
    description: 'A reliable Fighting attack.',
  },
  {
    name: 'Wing Attack',
    type: 'Flying',
    power: 60,
    accuracy: 100,
    pp: 35,
    description: 'Strikes with wings.',
  },
  {
    name: 'Poison Sting',
    type: 'Poison',
    power: 15,
    accuracy: 100,
    pp: 35,
    description: 'May poison the target.',
  },
  {
    name: 'Earthquake',
    type: 'Ground',
    power: 100,
    accuracy: 100,
    pp: 10,
    description: 'A powerful Ground attack.',
  },
  {
    name: 'Rock Slide',
    type: 'Rock',
    power: 75,
    accuracy: 90,
    pp: 10,
    description: 'Hurls rocks at the target.',
  },
  {
    name: 'Leech Life',
    type: 'Bug',
    power: 20,
    accuracy: 100,
    pp: 15,
    description: 'Restores half the damage dealt as HP.',
  },
  {
    name: 'Confusion',
    type: 'Psychic',
    power: 50,
    accuracy: 100,
    pp: 25,
    description: 'A reliable Psychic attack.',
  },
  {
    name: 'Harden',
    type: 'Normal',
    power: null,
    accuracy: null,
    pp: 30,
    description: 'Raises Defense by one stage.',
  },
  {
    name: 'Swords Dance',
    type: 'Normal',
    power: null,
    accuracy: null,
    pp: 20,
    description: 'Raises Attack by two stages.',
  },
  {
    name: 'String Shot',
    type: 'Bug',
    power: null,
    accuracy: 95,
    pp: 40,
    description: 'Lowers the target’s Speed by two stages.',
  },
  {
    name: 'Poison Powder',
    type: 'Poison',
    power: null,
    accuracy: 75,
    pp: 35,
    description: 'Poisons the target.',
  },
  {
    name: 'Struggle',
    type: 'Normal',
    power: 50,
    accuracy: null,
    pp: 1,
    description: 'Used when PP is exhausted. Causes recoil.',
  },
];
const moveMap = new Map([...MOVES, ...extraMoves].map((move) => [move.name, move]));
export const battleMove = (name: string): Move => moveMap.get(name) || moveMap.get('Scratch')!;
const specialTypes = new Set(['Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Psychic', 'Dragon']);
export const moveCategory = (move: Move) =>
  !move.power && !['Night Shade', 'Dragon Rage'].includes(move.name)
    ? 'Status'
    : specialTypes.has(move.type)
      ? 'Special'
      : 'Physical';

const chart: Record<string, Record<string, number>> = {
  Normal: { Rock: 0.5, Ghost: 0 },
  Fire: { Fire: 0.5, Water: 0.5, Grass: 2, Ice: 2, Bug: 2, Rock: 0.5, Dragon: 0.5 },
  Water: { Fire: 2, Water: 0.5, Grass: 0.5, Ground: 2, Rock: 2, Dragon: 0.5 },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Poison: 0.5,
    Ground: 2,
    Flying: 0.5,
    Bug: 0.5,
    Rock: 2,
    Dragon: 0.5,
  },
  Electric: { Water: 2, Electric: 0.5, Grass: 0.5, Ground: 0, Flying: 2, Dragon: 0.5 },
  Ice: { Water: 0.5, Ice: 0.5, Grass: 2, Ground: 2, Flying: 2, Dragon: 2, Fire: 0.5 },
  Fighting: {
    Normal: 2,
    Ice: 2,
    Poison: 0.5,
    Flying: 0.5,
    Psychic: 0.5,
    Bug: 0.5,
    Rock: 2,
    Ghost: 0,
  },
  Poison: { Grass: 2, Poison: 0.5, Ground: 0.5, Rock: 0.5, Ghost: 0.5 },
  Ground: { Fire: 2, Electric: 2, Grass: 0.5, Poison: 2, Flying: 0, Bug: 0.5, Rock: 2 },
  Flying: { Grass: 2, Fighting: 2, Bug: 2, Electric: 0.5, Rock: 0.5 },
  Psychic: { Fighting: 2, Poison: 2, Psychic: 0.5 },
  Bug: { Grass: 2, Psychic: 2, Fire: 0.5, Fighting: 0.5, Poison: 0.5, Flying: 0.5, Ghost: 0.5 },
  Rock: { Fire: 2, Ice: 2, Flying: 2, Bug: 2, Fighting: 0.5, Ground: 0.5 },
  Ghost: { Normal: 0, Psychic: 2, Ghost: 2 },
  Dragon: { Dragon: 2 },
};
export function effectiveness(type: string, targetId: number) {
  return pokemonById(targetId).types.reduce(
    (value, target) => value * (chart[type]?.[target] ?? 1),
    1,
  );
}
const stageMultiplier = (stage: number) => (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage));
const accuracyMultiplier = (stage: number) => (stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage));
const stat = (fighter: Fighter, key: Exclude<Stage, 'accuracy'>) =>
  fighter.stats[key] * stageMultiplier(fighter.stages[key]);
export const effectiveSpeed = (fighter: Fighter) =>
  stat(fighter, 'speed') * (fighter.status === 'paralysis' ? 0.5 : 1);
export const fighterStrength = (fighter: Pick<Fighter, 'stats'>) =>
  Object.values(fighter.stats).reduce((sum, value) => sum + value, 0);
export const teamStrength = (team: Pick<Fighter, 'stats'>[]) =>
  team.reduce((sum, fighter) => sum + fighterStrength(fighter), 0);
const baseStrength = (id: number) => BASE_STATS[id].reduce((sum, value) => sum + value, 0);
const blankStages = (): Record<Stage, number> => ({
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
  accuracy: 0,
});

export function createSeededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}
function fighter(
  speciesId: number,
  level: number,
  moves: string[],
  id: string,
  shiny = false,
  trainingScale = 1,
): Fighter {
  const raw = getPokemonStats({ speciesId, level });
  const stats = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [
      key,
      Math.max(1, Math.round(value * trainingScale)),
    ]),
  ) as Stats;
  const selected = [...new Set(moves)].filter((name) => moveMap.has(name)).slice(0, 4);
  if (!selected.length) selected.push('Tackle');
  return {
    id,
    speciesId,
    level,
    shiny,
    stats,
    hp: stats.hp,
    moves: selected,
    pp: selected.map((name) => battleMove(name).pp),
    stages: blankStages(),
    status: 'none',
    statusTurns: 0,
    trapped: 0,
    charging: null,
    recharge: false,
    trainingScale,
  };
}
export function createPlayerTeam(team: OwnedPokemon[]) {
  return team
    .slice(0, 3)
    .map((pokemon) =>
      fighter(pokemon.speciesId, pokemon.level, pokemon.moves, pokemon.id, !!pokemon.shiny),
    );
}
const fallbackMoves: Record<string, string[]> = {
  Normal: ['Tackle', 'Body Slam', 'Quick Attack', 'Growl'],
  Fire: ['Ember', 'Flamethrower', 'Fire Blast', 'Growl'],
  Water: ['Water Gun', 'Surf', 'Hydro Pump', 'Harden'],
  Grass: ['Vine Whip', 'Razor Leaf', 'Sleep Powder', 'Solar Beam'],
  Electric: ['Thunder Shock', 'Thunderbolt', 'Thunder Wave', 'Agility'],
  Ice: ['Ice Beam', 'Body Slam', 'Rest'],
  Fighting: ['Low Kick', 'Body Slam', 'Swords Dance'],
  Poison: ['Poison Sting', 'Poison Powder', 'Body Slam'],
  Ground: ['Earthquake', 'Sand Attack', 'Body Slam'],
  Flying: ['Wing Attack', 'Quick Attack', 'Fly', 'Agility'],
  Psychic: ['Confusion', 'Psychic', 'Recover', 'Hypnosis'],
  Bug: ['Leech Life', 'String Shot', 'Poison Sting', 'Harden'],
  Rock: ['Rock Slide', 'Harden', 'Earthquake'],
  Ghost: ['Lick', 'Night Shade', 'Hypnosis', 'Dream Eater'],
  Dragon: ['Dragon Rage', 'Agility', 'Hyper Beam'],
};
function practiceMoves(speciesId: number, level: number, difficulty: Difficulty) {
  const types = pokemonById(speciesId).types;
  const pool = [
    ...new Set(MOVE_OPTIONS[speciesId] || types.flatMap((type) => fallbackMoves[type] || [])),
  ];
  const attacks = pool.filter((name) => moveCategory(battleMove(name)) !== 'Status');
  const cap = difficulty === 'Easy' ? Math.max(45, level * 2.1) : Math.max(60, level * 3.5);
  const usable = attacks.filter(
    (name) => (battleMove(name).power || 45) <= cap && (name !== 'Dragon Rage' || level >= 20),
  );
  const sorted = (usable.length ? usable : ['Tackle']).sort((a, b) => {
    const score = (name: string) =>
      (battleMove(name).power || 50) * (types.includes(battleMove(name).type) ? 1.5 : 1);
    return score(b) - score(a);
  });
  const status = pool.filter((name) => moveCategory(battleMove(name)) === 'Status');
  return [
    ...new Set([
      sorted[0] || 'Tackle',
      sorted.find((name) => battleMove(name).type !== battleMove(sorted[0] || 'Tackle').type) ||
        'Quick Attack',
      status[0] || 'Growl',
      status[1] || sorted[1] || 'Harden',
    ]),
  ].slice(0, 4);
}
/** Rival stat totals follow difficulty, with different species and fresh matchups.
 * At extreme levels, transparent practice scaling keeps the requested strength tier possible.
 */
export function generateRivalTeam(
  team: OwnedPokemon[],
  difficulty: Difficulty,
  random = Math.random,
) {
  const excluded = new Set(team.map((pokemon) => pokemon.speciesId));
  const baseRatio = { Easy: 0.82, Medium: 1, Hard: 1.15, Master: 1.28 }[difficulty];
  return team.slice(0, 3).map((pokemon, index) => {
    const targetBase = baseStrength(pokemon.speciesId) * baseRatio;
    const candidates = POKEMON.filter((species) => !excluded.has(species.id))
      .sort(
        (a, b) =>
          Math.abs(baseStrength(a.id) - targetBase) - Math.abs(baseStrength(b.id) - targetBase),
      )
      .slice(0, 20);
    const speciesId =
      candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))].id;
    excluded.add(speciesId);
    const target =
      fighterStrength({ stats: getPokemonStats(pokemon) }) * DIFFICULTIES[difficulty].ratio;
    let level = 1;
    let distance = Infinity;
    for (let candidate = 1; candidate <= 100; candidate++) {
      const score = fighterStrength({ stats: getPokemonStats({ speciesId, level: candidate }) });
      if (Math.abs(score - target) < distance) {
        level = candidate;
        distance = Math.abs(score - target);
      }
    }
    const rawScore = fighterStrength({ stats: getPokemonStats({ speciesId, level }) });
    const scale = Math.abs(rawScore - target) / target > 0.04 ? target / rawScore : 1;
    return fighter(
      speciesId,
      level,
      practiceMoves(speciesId, level, difficulty),
      `rival-${index}`,
      false,
      scale,
    );
  });
}
export function createBattle(
  team: OwnedPokemon[],
  rivals: Fighter[],
  difficulty: Difficulty,
): BattleState {
  if (!team.length || !rivals.length) throw new Error('Both teams need a Pokémon.');
  const player = createPlayerTeam(team);
  const rival = structuredClone(rivals.slice(0, player.length));
  const opening: BattleEvent = {
    kind: 'info',
    text: `${DIFFICULTIES[difficulty].trainer} sends out ${pokemonById(rival[0].speciesId).name}. Choose your opening move!`,
  };
  return {
    player,
    rival,
    active: { player: 0, rival: 0 },
    replacementRequired: { player: false, rival: false },
    difficulty,
    turn: 1,
    winner: null,
    events: [opening],
    history: [opening],
    lastRivalSwitch: -10,
  };
}
export function predictedDamage(attacker: Fighter, defender: Fighter, name: string) {
  const move = battleMove(name);
  const multiplier = name === 'Struggle' ? 1 : effectiveness(move.type, defender.speciesId);
  if (!multiplier) return 0;
  if (name === 'Night Shade') return attacker.level;
  if (name === 'Dragon Rage') return 40;
  if (!move.power || (name === 'Dream Eater' && defender.status !== 'sleep')) return 0;
  const special = moveCategory(move) === 'Special';
  const offense =
    stat(attacker, special ? 'specialAttack' : 'attack') *
    (!special && attacker.status === 'burn' ? 0.5 : 1);
  const defense = stat(defender, special ? 'specialDefense' : 'defense');
  const stab =
    name !== 'Struggle' && pokemonById(attacker.speciesId).types.includes(move.type) ? 1.5 : 1;
  return Math.max(
    1,
    Math.floor(
      (Math.floor((((2 * attacker.level) / 5 + 2) * move.power * offense) / defense / 50) + 2) *
        stab *
        multiplier,
    ),
  );
}
export function getMoveHint(attacker: Fighter, defender: Fighter, name: string) {
  const move = battleMove(name);
  if (moveCategory(move) === 'Status') return move.description;
  const value = name === 'Struggle' ? 1 : effectiveness(move.type, defender.speciesId);
  if (!value) return 'No effect';
  if (name === 'Dream Eater' && defender.status !== 'sleep') return 'Target must be asleep';
  return value > 1
    ? `${value}× effective`
    : value < 1
      ? `${value}× effective`
      : 'Normal effectiveness';
}
function moveScore(actor: Fighter, target: Fighter, name: string) {
  const move = battleMove(name);
  const damage = predictedDamage(actor, target, name);
  if (damage)
    return (
      damage *
        ((move.accuracy ?? 100) / 100) *
        (name === 'Hyper Beam' ? 0.65 : ['Fly', 'Solar Beam'].includes(name) ? 0.6 : 1) +
      (damage >= target.hp ? 45 : 0)
    );
  if (['Recover', 'Rest'].includes(name))
    return actor.hp < actor.stats.hp * 0.45 ? actor.stats.hp * 0.55 : 0;
  if (['Sleep Powder', 'Hypnosis', 'Thunder Wave', 'Poison Powder'].includes(name)) {
    if (target.status !== 'none' || effectiveness(move.type, target.speciesId) === 0) return 0;
    return target.hp * 0.3 * ((move.accuracy ?? 100) / 100);
  }
  if (name === 'Swords Dance')
    return actor.stages.attack < 2 && actor.hp > actor.stats.hp * 0.65
      ? actor.stats.attack * 0.45
      : 0;
  if (name === 'Agility')
    return effectiveSpeed(actor) < effectiveSpeed(target) && actor.stages.speed < 2
      ? actor.stats.speed * 0.3
      : 0;
  if (name === 'Growl') return target.stages.attack > -2 ? target.stats.attack * 0.2 : 0;
  if (name === 'Harden') return actor.stages.defense < 2 ? actor.stats.defense * 0.2 : 0;
  if (name === 'Sand Attack') return target.stages.accuracy > -2 ? 12 : 0;
  return 8;
}
export function chooseRivalAction(state: BattleState, random = Math.random): BattleAction {
  const actor = state.rival[state.active.rival];
  const target = state.player[state.active.player];
  const choices = actor.moves
    .map((name, index) => ({ name, index }))
    .filter(({ index }) => actor.pp[index] > 0);
  if (!choices.length) return { kind: 'move', index: -1 };
  if (
    !actor.charging &&
    !actor.recharge &&
    !actor.trapped &&
    ['Hard', 'Master'].includes(state.difficulty) &&
    state.turn - state.lastRivalSwitch > 2
  ) {
    const score = (pokemon: Fighter) =>
      Math.max(...pokemon.moves.map((name) => predictedDamage(pokemon, target, name))) /
        pokemon.stats.hp +
      1 /
        Math.max(
          0.1,
          Math.max(...target.moves.map((name) => predictedDamage(target, pokemon, name))) /
            pokemon.stats.hp,
        );
    const best = state.rival
      .map((pokemon, index) => ({ pokemon, index }))
      .filter(({ pokemon, index }) => pokemon.hp > 0 && index !== state.active.rival)
      .sort((a, b) => score(b.pokemon) - score(a.pokemon))[0];
    if (
      best &&
      score(best.pokemon) > score(actor) * (state.difficulty === 'Master' ? 1.35 : 1.8) &&
      random() < (state.difficulty === 'Master' ? 0.8 : 0.35)
    )
      return { kind: 'switch', index: best.index };
  }
  if (state.difficulty === 'Easy' || (state.difficulty === 'Medium' && random() < 0.25)) {
    const damaging = choices.filter(({ name }) => predictedDamage(actor, target, name) > 0);
    const pool = damaging.length && random() < 0.8 ? damaging : choices;
    return { kind: 'move', index: pool[Math.floor(random() * pool.length)].index };
  }
  const ranked = choices
    .map((choice) => ({ ...choice, score: moveScore(actor, target, choice.name) }))
    .sort((a, b) => b.score - a.score);
  return { kind: 'move', index: ranked[0].index };
}
export type BattlePhase = 'turn' | 'replacement';
export function battlePhase(state: BattleState): BattlePhase {
  return !state.winner && (state.replacementRequired?.player || state.replacementRequired?.rival)
    ? 'replacement'
    : 'turn';
}
/** All mandatory choices are validated before either becomes visible. This is not a combat turn. */
export function resolveReplacements(
  previous: BattleState,
  choices: Partial<Record<Side, number>>,
): BattleState {
  if (battlePhase(previous) !== 'replacement') return previous;
  for (const side of ['player', 'rival'] as const) {
    const required = previous.replacementRequired[side];
    const index = choices[side];
    if (
      required
        ? !Number.isInteger(index) ||
          index === previous.active[side] ||
          !previous[side][index!]?.hp ||
          previous[side][index!].hp <= 0
        : index !== undefined
    )
      return previous;
  }
  const state = structuredClone(previous);
  state.events = [];
  for (const side of ['player', 'rival'] as const) {
    if (!previous.replacementRequired[side]) continue;
    const outgoing = state[side][state.active[side]];
    outgoing.stages = blankStages();
    outgoing.trapped = 0;
    outgoing.charging = null;
    outgoing.recharge = false;
    const other = side === 'player' ? 'rival' : 'player';
    state[other][state.active[other]].trapped = 0;
    state.active[side] = choices[side]!;
    state.replacementRequired[side] = false;
    if (side === 'rival') state.lastRivalSwitch = state.turn;
    state.events.push({
      kind: 'switch',
      side,
      text: `${pokemonById(state[side][state.active[side]].speciesId).name} entered the battle!`,
      frame: structuredClone({
        player: state.player,
        rival: state.rival,
        active: state.active,
        winner: state.winner,
        replacementRequired: state.replacementRequired,
      }),
    });
  }
  state.history = [
    ...state.history,
    ...state.events.map(({ frame: _frame, ...entry }) => entry),
  ].slice(-80);
  return state;
}
/** The bot chooses from the current public position, never a trainer's pending replacement. */
export function chooseRivalReplacement(state: BattleState): number {
  const activeTarget = state.player[state.active.player];
  const targets =
    activeTarget.hp > 0 ? [activeTarget] : state.player.filter((pokemon) => pokemon.hp > 0);
  const score = (candidate: Fighter) =>
    targets.reduce((total, target) => {
      const usable = candidate.moves.filter((_, index) => candidate.pp[index] > 0);
      const outgoing = Math.max(
        0,
        ...(usable.length ? usable : ['Struggle']).map((name) =>
          predictedDamage(candidate, target, name),
        ),
      );
      const incoming = Math.max(
        1,
        ...target.moves.map((name) => predictedDamage(target, candidate, name)),
      );
      return total + outgoing / Math.max(1, target.hp) + candidate.hp / incoming;
    }, 0) / Math.max(1, targets.length);
  return (
    state.rival
      .map((pokemon, index) => ({ pokemon, index }))
      .filter(({ pokemon, index }) => pokemon.hp > 0 && index !== state.active.rival)
      .sort((a, b) => score(b.pokemon) - score(a.pokemon) || a.index - b.index)[0]?.index ?? -1
  );
}

export function resolveTurn(
  previous: BattleState,
  action: BattleAction,
  random = Math.random,
): BattleState {
  if (previous.winner) return previous;
  if (battlePhase(previous) === 'replacement') {
    if (action.kind !== 'replace' || !previous.replacementRequired.player) return previous;
    return resolveReplacements(previous, {
      player: action.index,
      ...(previous.replacementRequired.rival ? { rival: chooseRivalReplacement(previous) } : {}),
    });
  }
  if (action.kind === 'replace') return previous;
  const player = previous.player[previous.active.player];
  if (action.kind === 'switch') {
    if (
      player.trapped ||
      player.charging ||
      player.recharge ||
      action.index === previous.active.player ||
      !previous.player[action.index] ||
      previous.player[action.index].hp <= 0
    )
      return previous;
  } else if (
    !player.charging &&
    !player.recharge &&
    (action.index === -1
      ? player.pp.some((pp) => pp > 0)
      : !player.moves[action.index] || player.pp[action.index] <= 0)
  )
    return previous;
  const state: BattleState = structuredClone(previous);
  state.events = [];
  const events = state.events;
  const flinched = new Set<string>();
  const foeAction = chooseRivalAction(state, random);
  const queue = (
    [
      ['player', action],
      ['rival', foeAction],
    ] as [Side, BattleAction][]
  )
    .map(([side, choice]) => {
      const actor = state[side][state.active[side]];
      const name =
        actor.charging || (choice.kind === 'move' ? actor.moves[choice.index] || 'Struggle' : '');
      return {
        side,
        choice,
        actorId: actor.id,
        priority: choice.kind === 'switch' ? 6 : name === 'Quick Attack' ? 1 : 0,
        speed: effectiveSpeed(actor),
        tie: random(),
      };
    })
    .sort((a, b) => b.priority - a.priority || b.speed - a.speed || b.tie - a.tie);
  const log = (
    text: string,
    side: Side | undefined,
    kind: BattleEvent['kind'],
    detail: Pick<BattleEvent, 'moveName' | 'movePhase' | 'targetSide' | 'outcome'> = {},
  ) =>
    events.push({
      text,
      side,
      kind,
      ...detail,
      frame: structuredClone({
        player: state.player,
        rival: state.rival,
        active: state.active,
        winner: state.winner,
        replacementRequired: state.replacementRequired,
      }),
    });
  const status = (target: Fighter, value: Status, side: Side, turns = 0) => {
    if (
      target.status !== 'none' ||
      (value === 'burn' && pokemonById(target.speciesId).types.includes('Fire')) ||
      (value === 'poison' && pokemonById(target.speciesId).types.includes('Poison'))
    ) {
      log('But it had no effect.', side, 'info');
      return;
    }
    target.status = value;
    target.statusTurns = turns;
    log(
      `${pokemonById(target.speciesId).name} is ${value === 'sleep' ? 'asleep' : value === 'freeze' ? 'frozen' : value === 'paralysis' ? 'paralysed' : value === 'burn' ? 'burned' : 'poisoned'}!`,
      side,
      'status',
    );
  };
  for (const { side, choice, actorId } of queue) {
    const other: Side = side === 'player' ? 'rival' : 'player';
    const actor = state[side][state.active[side]];
    const target = state[other][state.active[other]];
    if (actor.hp <= 0 || target.hp <= 0 || actor.id !== actorId) continue;
    const actorName = pokemonById(actor.speciesId).name;
    if (choice.kind === 'switch') {
      target.trapped = 0;
      actor.stages = blankStages();
      actor.charging = null;
      actor.recharge = false;
      state.active[side] = choice.index;
      if (side === 'rival') state.lastRivalSwitch = state.turn;
      log(
        `${side === 'player' ? 'You send' : DIFFICULTIES[state.difficulty].trainer + ' sends'} out ${pokemonById(state[side][choice.index].speciesId).name}!`,
        side,
        'switch',
      );
      continue;
    }
    if (flinched.has(actor.id)) {
      log(`${actorName} flinched and could not move!`, side, 'status');
      continue;
    }
    if (actor.status === 'sleep' || actor.status === 'freeze') {
      actor.statusTurns -= 1;
      if (actor.statusTurns <= 0) {
        const wasFrozen = actor.status === 'freeze';
        actor.status = 'none';
        log(`${actorName} ${wasFrozen ? 'thawed out' : 'woke up'}!`, side, 'status');
      } else {
        log(
          `${actorName} is ${actor.status === 'sleep' ? 'fast asleep' : 'frozen'}.`,
          side,
          'status',
        );
        continue;
      }
    }
    if (actor.status === 'paralysis' && random() < 0.25) {
      log(`${actorName} is paralysed and cannot move!`, side, 'status');
      continue;
    }
    if (actor.recharge) {
      actor.recharge = false;
      log(`${actorName} needs to recharge.`, side, 'info');
      continue;
    }
    const name = actor.charging || actor.moves[choice.index] || 'Struggle';
    const move = battleMove(name);
    const releasing = Boolean(actor.charging);
    actor.charging = null;
    if (!releasing && name !== 'Struggle')
      actor.pp[choice.index] = Math.max(0, actor.pp[choice.index] - 1);
    if (['Fly', 'Solar Beam'].includes(name) && !releasing) {
      actor.charging = name;
      log(
        `${actorName} ${name === 'Fly' ? 'flew high into the air' : 'is gathering sunlight'}!`,
        side,
        'move',
        { moveName: name, movePhase: 'charge', targetSide: side },
      );
      continue;
    }
    const selfMoves = ['Recover', 'Rest', 'Agility', 'Harden', 'Swords Dance'];
    log(`${actorName} used ${name}!`, side, 'move', {
      moveName: name,
      movePhase: 'release',
      targetSide: selfMoves.includes(name) ? side : other,
    });
    if (
      (!selfMoves.includes(name) && target.charging === 'Fly') ||
      (move.accuracy !== null &&
        random() * 100 >= move.accuracy * accuracyMultiplier(actor.stages.accuracy))
    ) {
      log('The attack missed.', side, 'info', {
        moveName: name,
        outcome: 'miss',
        targetSide: other,
      });
      continue;
    }
    if (
      (moveCategory(move) !== 'Status' || name === 'Thunder Wave') &&
      name !== 'Struggle' &&
      effectiveness(move.type, target.speciesId) === 0
    ) {
      log(`It does not affect ${pokemonById(target.speciesId).name}.`, side, 'info', {
        moveName: name,
        outcome: 'immune',
        targetSide: other,
      });
      continue;
    }
    const change = (who: Fighter, key: Stage, amount: number) => {
      const before = who.stages[key];
      who.stages[key] = Math.max(-6, Math.min(6, before + amount));
      log(
        before === who.stages[key]
          ? 'That stat cannot change further.'
          : `${pokemonById(who.speciesId).name}’s ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} ${amount > 0 ? 'rose' : 'fell'}!`,
        side,
        'status',
      );
    };
    if (name === 'Growl') {
      change(target, 'attack', -1);
      continue;
    }
    if (name === 'Sand Attack') {
      change(target, 'accuracy', -1);
      continue;
    }
    if (name === 'Agility') {
      change(actor, 'speed', 2);
      continue;
    }
    if (name === 'String Shot') {
      change(target, 'speed', -2);
      continue;
    }
    if (name === 'Harden') {
      change(actor, 'defense', 1);
      continue;
    }
    if (name === 'Swords Dance') {
      change(actor, 'attack', 2);
      continue;
    }
    if (['Recover', 'Rest'].includes(name)) {
      const healed = Math.min(
        actor.stats.hp - actor.hp,
        name === 'Rest' ? actor.stats.hp : Math.floor(actor.stats.hp / 2),
      );
      actor.hp += healed;
      if (name === 'Rest') {
        actor.status = 'sleep';
        actor.statusTurns = 3;
      }
      log(
        `${actorName} recovered ${healed} HP${name === 'Rest' ? ' and fell asleep' : ''}.`,
        side,
        'status',
      );
      continue;
    }
    if (['Sleep Powder', 'Hypnosis'].includes(name)) {
      status(target, 'sleep', side, 2 + Math.floor(random() * 2));
      continue;
    }
    if (name === 'Thunder Wave') {
      status(target, 'paralysis', side);
      continue;
    }
    if (name === 'Poison Powder') {
      status(target, 'poison', side);
      continue;
    }
    if (name === 'Dream Eater' && target.status !== 'sleep') {
      log('Dream Eater needs a sleeping target.', side, 'info', {
        moveName: name,
        outcome: 'immune',
        targetSide: other,
      });
      continue;
    }
    const fixed = ['Night Shade', 'Dragon Rage'].includes(name);
    const critical = !fixed && random() < (['Slash', 'Razor Leaf'].includes(name) ? 0.125 : 0.0625);
    const damage = Math.min(
      target.hp,
      Math.max(
        1,
        Math.floor(
          predictedDamage(actor, target, name) *
            (fixed ? 1 : (0.85 + random() * 0.15) * (critical ? 1.5 : 1)),
        ),
      ),
    );
    target.hp = Math.max(0, target.hp - damage);
    const multiplier = name === 'Struggle' ? 1 : effectiveness(move.type, target.speciesId);
    log(
      `${damage} damage.${critical ? ' Critical hit!' : ''}${!fixed && multiplier > 1 ? ' Super effective!' : !fixed && multiplier < 1 ? ' Not very effective.' : ''}`,
      side,
      'damage',
    );
    if (name === 'Hyper Beam') actor.recharge = true;
    if (['Dream Eater', 'Leech Life'].includes(name))
      actor.hp = Math.min(actor.stats.hp, actor.hp + Math.max(1, Math.floor(damage / 2)));
    if (['Double-Edge', 'Struggle'].includes(name)) {
      const recoil = Math.max(1, Math.floor(damage / 4));
      actor.hp = Math.max(0, actor.hp - recoil);
      log(`${actorName} took ${recoil} recoil damage.`, side, 'damage');
    }
    if (target.hp > 0) {
      if (name === 'Bite' && random() < 0.1) flinched.add(target.id);
      if (move.type === 'Fire' && random() < 0.1) status(target, 'burn', side);
      if (
        ['Thunder Shock', 'Thunderbolt', 'Lick', 'Body Slam'].includes(name) &&
        random() < (name === 'Body Slam' ? 0.3 : 0.1)
      )
        status(target, 'paralysis', side);
      if (name === 'Ice Beam' && random() < 0.1) status(target, 'freeze', side, 3);
      if (name === 'Poison Sting' && random() < 0.3) status(target, 'poison', side);
      if (name === 'Psychic' && random() < 0.1) change(target, 'specialDefense', -1);
      if (name === 'Fire Spin') {
        target.trapped = 3;
        log(`${pokemonById(target.speciesId).name} is trapped in the vortex!`, side, 'status');
      }
      if (target.status === 'freeze' && move.type === 'Fire') {
        target.status = 'none';
        log(`${pokemonById(target.speciesId).name} thawed out.`, side, 'status');
      }
    }
  }
  for (const side of ['player', 'rival'] as const) {
    const actor = state[side][state.active[side]];
    if (actor.hp > 0 && (actor.status === 'burn' || actor.status === 'poison')) {
      const damage = Math.min(
        actor.hp,
        Math.max(1, Math.floor(actor.stats.hp / (actor.status === 'burn' ? 16 : 8))),
      );
      actor.hp -= damage;
      log(
        `${pokemonById(actor.speciesId).name} lost ${damage} HP to ${actor.status}.`,
        side,
        'damage',
      );
    }
  }
  for (const side of ['player', 'rival'] as const) {
    const actor = state[side][state.active[side]];
    const other: Side = side === 'player' ? 'rival' : 'player';
    if (state[other][state.active[other]].hp <= 0) actor.trapped = 0;
    if (actor.hp > 0 && actor.trapped) {
      actor.trapped -= 1;
      const damage = Math.max(1, Math.floor(actor.stats.hp / 16));
      actor.hp = Math.max(0, actor.hp - damage);
      log(`${pokemonById(actor.speciesId).name} lost ${damage} HP in the vortex.`, side, 'damage');
    }
    if (actor.hp <= 0) log(`${pokemonById(actor.speciesId).name} fainted!`, side, 'faint');
  }
  const playerOut = state.player.every((pokemon) => pokemon.hp <= 0);
  const rivalOut = state.rival.every((pokemon) => pokemon.hp <= 0);
  if (playerOut || rivalOut) {
    state.winner = playerOut && rivalOut ? 'draw' : rivalOut ? 'player' : 'rival';
    log(
      state.winner === 'draw'
        ? 'Both teams are out. It is a draw!'
        : state.winner === 'player'
          ? 'You won the practice battle!'
          : `${DIFFICULTIES[state.difficulty].trainer} won the practice battle.`,
      undefined,
      'result',
    );
  } else {
    state.replacementRequired = {
      player: state.player[state.active.player].hp <= 0,
      rival: state.rival[state.active.rival].hp <= 0,
    };
  }
  state.turn += 1;
  // Frame snapshots are transient playback data; keep the history lightweight.
  state.history = [...state.history, ...events.map(({ frame: _frame, ...event }) => event)].slice(
    -80,
  );
  // A sole bot replacement needs no trainer input; retain the faint and send-out playback.
  if (state.replacementRequired.rival && !state.replacementRequired.player) {
    const replaced = resolveReplacements(state, { rival: chooseRivalReplacement(state) });
    replaced.events = [...state.events, ...replaced.events];
    return replaced;
  }
  return state;
}
