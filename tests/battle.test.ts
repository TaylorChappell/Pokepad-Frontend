import test from 'node:test';
import assert from 'node:assert/strict';
import type { OwnedPokemon } from '../src/types';
import {
  createBattle,
  createPlayerTeam,
  createSeededRandom,
  generateRivalTeam,
  teamStrength,
  resolveTurn,
  predictedDamage,
  effectiveness,
  chooseRivalAction,
  chooseRivalReplacement,
  resolveReplacements,
  battlePhase,
  type Difficulty,
} from '../src/battle/engine';

function owned(
  speciesId: number,
  moves = ['Tackle'],
  level = 30,
  id = 'p-' + speciesId,
): OwnedPokemon {
  return {
    id,
    speciesId,
    level,
    moves,
    rareCandy: 420,
    backing: 0.5,
    evolutionReserve: 0.25,
    moveOffers: [],
    originCoin: 'poke',
    rarity: 'Standard',
    acquiredAt: 1,
    health: 1,
  };
}
function match(player: OwnedPokemon[], enemy: OwnedPokemon[], difficulty: Difficulty = 'Easy') {
  // These move and replacement fixtures explicitly exercise the no-items ruleset.
  return createBattle(player, createPlayerTeam(enemy), difficulty, {
    items: 'none',
    levels: 'original',
  });
}
const calm = () => 0.5;

test('all bot difficulties create different species with the requested relative team strength', () => {
  const parties = [
    [owned(4, ['Ember'], 12), owned(25, ['Thunder Shock'], 19), owned(7, ['Water Gun'], 16)],
    [
      owned(150, ['Psychic'], 100),
      owned(149, ['Dragon Rage'], 100),
      owned(143, ['Body Slam'], 100),
    ],
    [owned(129, ['Tackle'], 1)],
  ];
  const ranges = {
    Easy: [0.68, 0.84],
    Medium: [0.94, 1.06],
    Hard: [1.13, 1.27],
    Master: [1.34, 1.51],
  };
  for (const party of parties) {
    const playerRating = teamStrength(createPlayerTeam(party));
    for (const difficulty of Object.keys(ranges) as Difficulty[]) {
      const variants = new Set<string>();
      for (let seed = 1; seed <= 8; seed++) {
        const rivals = generateRivalTeam(party, difficulty, createSeededRandom(seed));
        assert.equal(rivals.length, party.length);
        assert.equal(new Set(rivals.map((pokemon) => pokemon.speciesId)).size, party.length);
        for (const rival of rivals) {
          assert.ok(!party.some((pokemon) => pokemon.speciesId === rival.speciesId));
          assert.ok(rival.level >= 1 && rival.level <= 100);
          assert.ok(rival.moves.length > 0 && rival.moves.length <= 4);
        }
        const ratio = teamStrength(rivals) / playerRating;
        assert.ok(
          ratio >= ranges[difficulty][0] && ratio <= ranges[difficulty][1],
          `${difficulty}: ${ratio}`,
        );
        variants.add(rivals.map((pokemon) => pokemon.speciesId).join(','));
      }
      assert.ok(variants.size > 1, 'New matches are not a fixed opposing team');
    }
  }
});

test('damage respects type immunity, dual types, STAB and the physical/special stats', () => {
  assert.equal(effectiveness('Electric', 50), 0);
  assert.equal(effectiveness('Normal', 94), 0);
  assert.equal(effectiveness('Ice', 149), 4);
  const [charmander, bulbasaur, squirtle] = createPlayerTeam([owned(4), owned(1), owned(7)]);
  assert.ok(
    predictedDamage(charmander, bulbasaur, 'Ember') >
      predictedDamage(charmander, squirtle, 'Ember'),
  );
  const normal = predictedDamage(charmander, squirtle, 'Scratch');
  charmander.stages.attack = -2;
  assert.ok(predictedDamage(charmander, squirtle, 'Scratch') < normal);
  const special = predictedDamage(charmander, squirtle, 'Ember');
  charmander.stages.attack = 6;
  assert.equal(predictedDamage(charmander, squirtle, 'Ember'), special);
});

test('speed determines turn order, while Quick Attack takes priority', () => {
  const normal = resolveTurn(
    match([owned(143, ['Tackle'])], [owned(25, ['Scratch'])]),
    { kind: 'move', index: 0 },
    calm,
  );
  assert.equal(normal.events.find((event) => event.kind === 'move')?.side, 'rival');
  const priority = resolveTurn(
    match([owned(143, ['Quick Attack'])], [owned(25, ['Scratch'])]),
    { kind: 'move', index: 0 },
    calm,
  );
  assert.equal(priority.events.find((event) => event.kind === 'move')?.side, 'player');
});

test('switching costs a turn and the incoming Pokémon takes the opposing attack', () => {
  const before = match([owned(1), owned(4)], [owned(25, ['Thunder Shock'])]);
  const snapshot = JSON.stringify(before);
  const next = resolveTurn(before, { kind: 'switch', index: 1 }, calm);
  assert.equal(next.active.player, 1);
  assert.equal(next.player[0].hp, before.player[0].hp);
  assert.ok(next.player[1].hp < before.player[1].hp);
  assert.equal(next.turn, 2);
  assert.equal(JSON.stringify(before), snapshot, 'Turns never mutate their input snapshot');
});

test('status and healing moves have effects, and PP prevents repeated empty moves', () => {
  const setup = match([owned(150, ['Growl', 'Recover'])], [owned(143, ['Tackle'])]);
  const growl = resolveTurn(setup, { kind: 'move', index: 0 }, calm);
  assert.equal(growl.rival[0].stages.attack, -1);
  assert.equal(growl.player[0].pp[0], setup.player[0].pp[0] - 1);
  growl.player[0].hp = 1;
  const healed = resolveTurn(growl, { kind: 'move', index: 1 }, calm);
  assert.ok(healed.player[0].hp > 1);
  healed.player[0].pp[0] = 0;
  assert.equal(resolveTurn(healed, { kind: 'move', index: 0 }, calm), healed);
  const sleep = resolveTurn(
    match([owned(150, ['Hypnosis'])], [owned(143, ['Tackle'])]),
    { kind: 'move', index: 0 },
    calm,
  );
  assert.equal(sleep.rival[0].status, 'sleep');
  assert.equal(sleep.player[0].hp, sleep.player[0].stats.hp, 'Sleeping target misses its action');
});

test('two-turn moves finish even when the charge consumed the last PP', () => {
  const battle = match([owned(6, ['Fly'])], [owned(143, ['Tackle'])]);
  battle.player[0].pp[0] = 1;
  const charge = resolveTurn(battle, { kind: 'move', index: 0 }, calm);
  assert.equal(charge.player[0].charging, 'Fly');
  assert.equal(charge.player[0].pp[0], 0);
  const strike = resolveTurn(charge, { kind: 'move', index: 0 }, calm);
  assert.equal(strike.player[0].charging, null);
  assert.ok(strike.rival[0].hp < charge.rival[0].hp);
  assert.equal(strike.player[0].pp[0], 0);
});

test('hard bot chooses the favourable attack, and practice does not change owned assets', () => {
  const ownedTeam = [owned(1, ['Tackle'])];
  const original = JSON.stringify(ownedTeam);
  const battle = match(ownedTeam, [owned(4, ['Water Gun', 'Ember'])], 'Hard');
  assert.deepEqual(chooseRivalAction(battle, calm), { kind: 'move', index: 1 });
  assert.equal(
    battle.player[0].hp,
    battle.player[0].stats.hp,
    'Only the simulated team starts healed',
  );
  resolveTurn(battle, { kind: 'move', index: 0 }, calm);
  assert.equal(JSON.stringify(ownedTeam), original);
});

test('switching cannot cancel a charge or Hyper Beam recharge', () => {
  for (const move of ['Fly', 'Solar Beam', 'Hyper Beam']) {
    const battle = match([owned(150, [move]), owned(4)], [owned(143, ['Growl'], 70)]);
    const locked = resolveTurn(battle, { kind: 'move', index: 0 }, calm);
    assert.ok(locked.player[0].charging || locked.player[0].recharge, move);
    assert.equal(resolveTurn(locked, { kind: 'switch', index: 1 }, calm), locked);
  }
});

test('Fire Spin releases its target when the source switches out or faints', () => {
  const battle = match([owned(6, ['Fire Spin']), owned(7)], [owned(143, ['Growl'])]);
  const trapped = resolveTurn(battle, { kind: 'move', index: 0 }, calm);
  assert.ok(trapped.rival[0].trapped > 0);
  const switched = resolveTurn(trapped, { kind: 'switch', index: 1 }, calm);
  assert.equal(switched.rival[0].trapped, 0);
  assert.equal(switched.rival[0].hp, trapped.rival[0].hp);

  const fainting = match([owned(150, ['Psychic'])], [owned(4, ['Growl']), owned(7)]);
  fainting.player[0].trapped = 2;
  fainting.rival[0].hp = 1;
  const released = resolveTurn(fainting, { kind: 'move', index: 0 }, calm);
  assert.equal(released.player[0].trapped, 0);
  assert.equal(released.player[0].hp, fainting.player[0].hp);
});

test('a fainted active Pokémon waits for the chosen living replacement without spending a turn', () => {
  const before = match(
    [owned(4, ['Growl']), owned(7), owned(25)],
    [owned(150, ['Quick Attack']), owned(1), owned(133)],
  );
  before.player[0].hp = 1;
  const fainted = resolveTurn(before, { kind: 'move', index: 0 }, calm);
  assert.equal(battlePhase(fainted), 'replacement');
  assert.deepEqual(fainted.replacementRequired, { player: true, rival: false });
  assert.equal(fainted.active.player, 0);
  assert.equal(
    fainted.events.some((event) => event.kind === 'switch'),
    false,
  );
  assert.equal(resolveTurn(fainted, { kind: 'move', index: 0 }, calm), fainted);
  assert.equal(resolveTurn(fainted, { kind: 'switch', index: 1 }, calm), fainted);
  assert.equal(resolveTurn(fainted, { kind: 'replace', index: 0 }, calm), fainted);
  assert.equal(resolveTurn(fainted, { kind: 'replace', index: 9 }, calm), fainted);
  const beforeChoice = JSON.stringify(fainted);
  const ready = resolveTurn(fainted, { kind: 'replace', index: 2 }, calm);
  assert.equal(
    ready.active.player,
    2,
    'The trainer picks a specific reserve instead of the first one',
  );
  assert.equal(ready.turn, fainted.turn);
  assert.equal(battlePhase(ready), 'turn');
  assert.deepEqual(
    [...ready.player, ...ready.rival].map((p) => [p.hp, p.pp]),
    [...fainted.player, ...fainted.rival].map((p) => [p.hp, p.pp]),
  );
  assert.deepEqual(
    ready.events.map((event) => event.kind),
    ['switch'],
  );
  assert.equal(JSON.stringify(fainted), beforeChoice);
});

test('simultaneous residual faints require both choices and neither side gets a free attack', () => {
  const initial = match(
    [owned(4, ['Growl']), owned(7), owned(25)],
    [owned(133, ['Growl']), owned(1, ['Vine Whip']), owned(6, ['Flamethrower'])],
  );
  for (const side of ['player', 'rival'] as const) {
    initial[side][0].hp = 1;
    initial[side][0].status = 'poison';
  }
  const pending = resolveTurn(initial, { kind: 'move', index: 0 }, calm);
  assert.deepEqual(pending.replacementRequired, { player: true, rival: true });
  assert.deepEqual(pending.active, { player: 0, rival: 0 });
  assert.equal(
    resolveReplacements(pending, { player: 2 }),
    pending,
    'No side is revealed before the other required choice exists',
  );
  const botChoice = chooseRivalReplacement(pending);
  const ready = resolveTurn(pending, { kind: 'replace', index: 2 }, calm);
  assert.deepEqual(ready.active, { player: 2, rival: botChoice });
  assert.equal(ready.turn, pending.turn);
  assert.deepEqual(
    ready.events.map((event) => event.kind),
    ['switch', 'switch'],
  );
  assert.equal(ready.player[2].hp, pending.player[2].hp);
  assert.equal(ready.rival[botChoice].hp, pending.rival[botChoice].hp);
});

test('bot replacement considers the type matchup and cannot read a future trainer choice', () => {
  const pending = match(
    [owned(7, ['Water Gun']), owned(1), owned(25)],
    [owned(133), owned(4, ['Ember']), owned(1, ['Vine Whip'])],
  );
  pending.rival[0].hp = 0;
  pending.replacementRequired.rival = true;
  assert.equal(
    chooseRivalReplacement(pending),
    2,
    'Bulbasaur is a better choice against Squirtle than Charmander',
  );
  const onlyBot = match([owned(150, ['Quick Attack']), owned(7)], [owned(4, ['Growl']), owned(1)]);
  onlyBot.rival[0].hp = 1;
  const ready = resolveTurn(onlyBot, { kind: 'move', index: 0 }, calm);
  assert.equal(ready.active.rival, 1);
  assert.equal(ready.rival[1].hp, onlyBot.rival[1].hp);
  assert.equal(ready.turn, 2);
  assert.equal(battlePhase(ready), 'turn');
});

test('the final faint ends the battle instead of asking for an impossible replacement', () => {
  const initial = match([owned(4, ['Growl'])], [owned(150, ['Quick Attack'])]);
  initial.player[0].hp = 1;
  const ended = resolveTurn(initial, { kind: 'move', index: 0 }, calm);
  assert.equal(ended.winner, 'rival');
  assert.equal(battlePhase(ended), 'turn');
  assert.equal(resolveTurn(ended, { kind: 'replace', index: 1 }, calm), ended);
});
