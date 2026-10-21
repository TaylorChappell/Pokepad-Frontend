import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOVES, MOVE_OPTIONS } from '../src/data/moves';
import { BattleEffects } from '../src/components/BattleEffects';
import {
  createBattle,
  createPlayerTeam,
  resolveTurn,
  type BattleEvent,
} from '../src/battle/engine';
import {
  getMovePresentation,
  getBattleCue,
  createBattlePlayback,
  PRESENTED_MOVES,
} from '../src/battle/presentation';
import type { OwnedPokemon } from '../src/types';

const extras = [
  'Low Kick',
  'Wing Attack',
  'Poison Sting',
  'Earthquake',
  'Rock Slide',
  'Leech Life',
  'Confusion',
  'Harden',
  'Swords Dance',
  'String Shot',
  'Poison Powder',
  'Struggle',
];
const owned = (id: number, moves: string[], level = 30, tag = ''): OwnedPokemon => ({
  id: 'p-' + id + tag,
  speciesId: id,
  moves,
  level,
  rareCandy: 420,
  backing: 0.5,
  evolutionReserve: 0.25,
  moveOffers: [],
  originCoin: 'poke',
  rarity: 'Standard',
  acquiredAt: 1,
});
const battle = (players: OwnedPokemon[], rivals: OwnedPokemon[]) =>
  createBattle(players, createPlayerTeam(rivals), 'Easy');
const calm = () => 0.5;

test('every playable move has its own authored visual and renders in both directions', () => {
  const names = [
    ...new Set([
      ...MOVES.map((move) => move.name),
      ...Object.values(MOVE_OPTIONS).flat(),
      ...extras,
    ]),
  ];
  assert.equal(names.length, PRESENTED_MOVES.length);
  const variants = new Set<string>();
  for (const name of names) {
    const visual = getMovePresentation(name);
    assert.notEqual(visual.variant, 'future-move', name);
    assert.ok(visual.durationMs >= 500 && visual.durationMs <= 1200);
    variants.add(visual.variant);
    for (const side of ['player', 'rival'] as const) {
      const event: BattleEvent = {
        kind: 'move',
        side,
        moveName: name,
        movePhase: 'release',
        text: 'Localized message',
      };
      const cue = getBattleCue(event)!;
      assert.equal(cue.side, side);
      assert.equal(
        cue.targetSide,
        visual.target === 'self' ? side : side === 'player' ? 'rival' : 'player',
      );
      const markup = renderToStaticMarkup(createElement(BattleEffects, { cue }));
      assert.ok(markup.includes('data-effect="' + visual.variant + '"'));
      assert.ok(!markup.includes('undefined'));
    }
  }
  assert.equal(variants.size, names.length, 'Each move can be tuned independently');
});

test('miss and charge effects follow metadata without parsing translated messages', () => {
  const misses: BattleEvent[] = [
    {
      kind: 'move',
      side: 'player',
      moveName: 'Fire Blast',
      movePhase: 'release',
      targetSide: 'rival',
      text: 'A',
    },
    { kind: 'info', side: 'player', moveName: 'Fire Blast', outcome: 'miss', text: 'B' },
  ];
  assert.equal(getBattleCue(misses[0], 0, misses)?.outcome, 'miss');
  const charge: BattleEvent = {
    kind: 'move',
    side: 'rival',
    moveName: 'Solar Beam',
    movePhase: 'charge',
    targetSide: 'rival',
    text: 'C',
  };
  assert.equal(getBattleCue(charge)?.outcome, 'charge');
  assert.equal(getBattleCue(charge)?.targetSide, 'rival');
  const immune = { ...misses[1], outcome: 'immune' as const };
  assert.equal(getBattleCue(misses[0], 0, [misses[0], immune])?.outcome, 'immune');
});

test('playback uses immutable engine snapshots so HP changes on damage and sprites on switching', () => {
  const initial = battle(
    [owned(25, ['Thunder Shock']), owned(7, ['Water Gun'])],
    [owned(133, ['Tackle'])],
  );
  const next = resolveTurn(initial, { kind: 'move', index: 0 }, calm);
  const frames = createBattlePlayback(initial, next);
  const firstMove = frames.find((frame) => frame.event.kind === 'move')!;
  const firstDamage = frames.find((frame) => frame.event.kind === 'damage')!;
  const targetSide = firstMove.cue!.targetSide;
  assert.equal(firstMove.displayState[targetSide][0].hp, initial[targetSide][0].hp);
  assert.ok(firstDamage.displayState[targetSide][0].hp < initial[targetSide][0].hp);
  assert.equal(firstMove.cue?.moveName, firstMove.event.moveName);
  firstDamage.displayState[targetSide][0].hp = 0;
  assert.ok(
    firstDamage.event.frame![targetSide][0].hp > 0,
    'Display states do not mutate engine frames',
  );
  assert.ok(
    next.history.every((event) => !event.frame),
    'The text history does not retain large frame snapshots',
  );

  const switched = resolveTurn(initial, { kind: 'switch', index: 1 }, calm);
  const switchingFrames = createBattlePlayback(initial, switched);
  const switchFrame = switchingFrames.find((frame) => frame.event.kind === 'switch')!;
  assert.equal(switchFrame.displayState.active.player, 1);
  assert.equal(switchFrame.cue?.variant, 'switch');
  assert.equal(initial.active.player, 0);
});

test('charging, immune attacks and self recovery carry correct engine presentation metadata', () => {
  const charged = resolveTurn(
    battle([owned(1, ['Solar Beam'])], [owned(133, ['Growl'])]),
    { kind: 'move', index: 0 },
    calm,
  );
  const charge = charged.events.find(
    (event) => event.moveName === 'Solar Beam' && event.kind === 'move',
  )!;
  assert.equal(charge.movePhase, 'charge');
  assert.equal(charge.targetSide, 'player');
  const immune = resolveTurn(
    battle([owned(25, ['Thunderbolt'])], [owned(50, ['Growl'])]),
    { kind: 'move', index: 0 },
    calm,
  );
  assert.ok(
    immune.events.some((event) => event.moveName === 'Thunderbolt' && event.outcome === 'immune'),
  );
  const hurt = battle([owned(150, ['Recover'])], [owned(133, ['Growl'])]);
  hurt.player[0].hp = 20;
  const healed = resolveTurn(hurt, { kind: 'move', index: 0 }, calm);
  const healingFrames = createBattlePlayback(hurt, healed);
  const healingMove = healingFrames.find((frame) => frame.event.moveName === 'Recover')!;
  assert.equal(healingMove.cue?.targetSide, 'player');
  const recovery = healingFrames.find((frame) => frame.event.text.includes('recovered'))!;
  assert.ok(recovery.displayState.player[0].hp > healingMove.displayState.player[0].hp);
});
