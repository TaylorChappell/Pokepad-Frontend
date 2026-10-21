import {
  battleMove,
  predictedDamage,
  effectiveness,
  type BattleState,
  type Fighter,
  type BattleAction,
} from './engine';
import { legalBattleItem } from './rules';

/** A public-position policy shared verbatim by practice and authoritative gym battles.
 * It never reads the trainer's pending command or consumes the combat RNG. Difficulty changes rosters, not information. */
function speed(p: Fighter) {
  const stage = p.stages.speed;
  return (
    p.stats.speed *
    (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage)) *
    (p.status === 'paralysis' ? 0.5 : 1)
  );
}
function usable(p: Fighter) {
  const moves = p.moves.map((name, index) => ({ name, index })).filter((m) => p.pp[m.index] > 0);
  return moves.length ? moves : [{ name: 'Struggle', index: -1 }];
}
function accuracy(p: Fighter, name: string) {
  const stage = p.stages.accuracy;
  return Math.min(
    1,
    ((battleMove(name).accuracy ?? 100) / 100) * (stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage)),
  );
}
function damage(p: Fighter, target: Fighter, name: string) {
  return predictedDamage(p, target, name) * accuracy(p, name);
}
function threat(p: Fighter, target: Fighter) {
  return Math.max(1, ...usable(p).map((m) => damage(p, target, m.name)));
}
function matchup(p: Fighter, target: Fighter) {
  const output = threat(p, target),
    incoming = threat(target, p);
  return (
    Math.min(2, output / Math.max(1, target.hp)) * 90 +
    Math.min(4, p.hp / incoming) * 22 +
    (speed(p) > speed(target) ? 12 : 0) -
    (p.status !== 'none' ? 12 : 0)
  );
}
function moveUtility(p: Fighter, target: Fighter, name: string) {
  const m = battleMove(name),
    raw = predictedDamage(p, target, name),
    hit = accuracy(p, name),
    incoming = threat(target, p);
  const first = name === 'Quick Attack' || speed(p) >= speed(target);
  if (raw > 0) {
    const charge =
      ['Fly', 'Dig', 'Solar Beam', 'Sky Attack', 'Skull Bash', 'Razor Wind'].includes(name) &&
      !p.charging;
    let value = (Math.min(raw, target.hp) / Math.max(1, target.hp)) * 100 * hit;
    if (raw >= target.hp) value += (first ? 110 : 65) * hit;
    if (charge) value *= 0.55;
    if (name === 'Hyper Beam' && raw < target.hp) value *= 0.62;
    if (['Explosion', 'Self-Destruct'].includes(name)) value -= raw >= target.hp ? 30 : 100;
    if (['Double-Edge', 'Take Down', 'Submission', 'Struggle'].includes(name) && p.hp < raw / 3)
      value -= 30;
    if (['Absorb', 'Mega Drain', 'Leech Life', 'Dream Eater'].includes(name))
      value += (Math.min(p.stats.hp - p.hp, raw / 2) / p.stats.hp) * 55;
    if (!first && incoming >= p.hp) value *= 0.25;
    return value;
  }
  if (['Recover', 'Soft-Boiled', 'Rest'].includes(name)) {
    const healed = Math.min(p.stats.hp - p.hp, p.stats.hp * (name === 'Rest' ? 1 : 0.5));
    if (healed < incoming * 0.8 || (!first && incoming >= p.hp)) return -20;
    return (healed / p.stats.hp) * 100 + (p.hp <= incoming ? 50 : 0) - (name === 'Rest' ? 25 : 0);
  }
  if (
    target.status === 'none' &&
    [
      'Sleep Powder',
      'Hypnosis',
      'Spore',
      'Sing',
      'Lovely Kiss',
      'Thunder Wave',
      'Stun Spore',
      'Poison Powder',
      'Toxic',
      'Will-O-Wisp',
    ].includes(name)
  ) {
    if (effectiveness(m.type, target.speciesId) === 0) return -50;
    return (
      (['Spore', 'Hypnosis', 'Sleep Powder', 'Sing', 'Lovely Kiss'].includes(name) ? 65 : 40) *
      hit *
      (incoming >= p.hp && !first ? 0.15 : 1)
    );
  }
  const boosts: Record<string, keyof Fighter['stages']> = {
    'Swords Dance': 'attack',
    Growth: 'specialAttack',
    Amnesia: 'specialDefense',
    Harden: 'defense',
    Withdraw: 'defense',
    'Defense Curl': 'defense',
    Barrier: 'defense',
    'Acid Armor': 'defense',
    Agility: 'speed',
  };
  if (boosts[name]) {
    const stage = p.stages[boosts[name]],
      safe = p.hp > incoming * 2.2;
    if (stage >= 6 || !safe) return -10;
    if (name === 'Agility' && speed(p) >= speed(target)) return -10;
    return 43 - stage * 6;
  }
  const lowers: Record<string, keyof Fighter['stages']> = {
    Growl: 'attack',
    Charm: 'attack',
    'Tail Whip': 'defense',
    Leer: 'defense',
    Screech: 'defense',
    'Sand Attack': 'accuracy',
    Smokescreen: 'accuracy',
    Flash: 'accuracy',
    'String Shot': 'speed',
  };
  if (lowers[name]) return target.stages[lowers[name]] <= -4 || p.hp < incoming * 2 ? -10 : 24;
  if (name === 'Splash' || name === 'Teleport') return -100;
  if (['Leech Seed', 'Reflect', 'Light Screen', 'Substitute'].includes(name))
    return p.hp > incoming * 3 ? 27 : 0;
  return 4;
}
export function chooseRivalAction(
  state: BattleState,
  _random: () => number = Math.random,
): BattleAction {
  const actor = state.rival[state.active.rival],
    target = state.player[state.active.player];
  if (state.replacementRequired?.rival)
    return { kind: 'replace', index: chooseRivalReplacement(state) };
  if (actor.charging) return { kind: 'move', index: actor.moves.indexOf(actor.charging) };
  if (actor.recharge)
    return {
      kind: 'move',
      index: Math.max(
        0,
        actor.moves.findIndex((_, i) => actor.pp[i] > 0),
      ),
    };
  const options: { action: BattleAction; score: number }[] = usable(actor).map((m) => ({
    action: { kind: 'move', index: m.index },
    score: moveUtility(actor, target, m.name),
  }));
  const incoming = threat(target, actor),
    active = state.active.rival;
  if (legalBattleItem(state, 'rival', 'potion', active)) {
    const healed = Math.min(actor.stats.hp - actor.hp, Math.floor(actor.stats.hp * 0.3));
    const survives = actor.hp + healed > incoming;
    options.push({
      action: { kind: 'item', item: 'potion', index: active },
      score:
        survives && healed >= incoming * 0.75
          ? (healed / actor.stats.hp) * 100 + (incoming >= actor.hp ? 85 : 20)
          : -20,
    });
  }
  if (legalBattleItem(state, 'rival', 'full-heal', active))
    options.push({
      action: { kind: 'item', item: 'full-heal', index: active },
      score:
        actor.hp > incoming
          ? actor.status === 'sleep' || actor.status === 'freeze'
            ? 85
            : 32
          : -10,
    });
  state.rival.forEach((candidate, index) => {
    if (legalBattleItem(state, 'rival', 'revive', index)) {
      const restored = {
        ...candidate,
        hp: Math.max(1, Math.floor(candidate.stats.hp / 2)),
        status: 'none' as const,
      };
      options.push({
        action: { kind: 'item', item: 'revive', index },
        score:
          35 +
          matchup(restored, target) * 0.28 +
          (state.rival.filter((p) => p.hp > 0).length === 1 ? 30 : 0),
      });
    }
    if (
      index === active ||
      candidate.hp <= 0 ||
      actor.trapped ||
      state.turn - state.lastRivalSwitch < 2
    )
      return;
    const entryDamage = threat(target, candidate);
    if (candidate.hp <= entryDamage) return; // Don't switch a healthy reserve into an immediate knockout.
    const afterEntry = { ...candidate, hp: candidate.hp - entryDamage };
    const gain = matchup(afterEntry, target) - matchup(actor, target);
    if (gain > 25)
      options.push({
        action: { kind: 'switch', index },
        score: gain + 25 + (incoming >= actor.hp ? 35 : 0),
      });
  });
  return options.sort((a, b) => b.score - a.score)[0].action;
}
export function chooseRivalReplacement(state: BattleState): number {
  const active = state.player[state.active.player],
    targets = active.hp > 0 ? [active] : state.player.filter((p) => p.hp > 0);
  return (
    state.rival
      .map((p, index) => ({
        p,
        index,
        score: targets.reduce((n, t) => n + matchup(p, t), 0) / Math.max(1, targets.length),
      }))
      .filter((x) => x.p.hp > 0 && x.index !== state.active.rival)
      .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.index ?? -1
  );
}
