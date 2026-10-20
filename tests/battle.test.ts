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
  return createBattle(player, createPlayerTeam(enemy), difficulty);
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
