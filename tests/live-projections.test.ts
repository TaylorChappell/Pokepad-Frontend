import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/data/demo';
import { getEvolutionStatus } from '../src/state/model';
import { gymRankings } from '../src/state/gyms';
import { createHttpApi } from '../src/services/api';
test('live evolution uses authoritative full-path funding and never the demo minimum', () => {
  const state = createInitialState();
  state.features = { rewards: true };
  const pokemon = state.pokemon.find((p) => p.speciesId === 4)!;
  pokemon.backing = 0;
  pokemon.evolutionPreview = {
    policyVersion: 1,
    candyRequired: 1000,
    valueIncrease: 0.06,
    nextValue: 0.06,
    reserved: 0,
    fundingNeeded: 0.09,
    canEvolve: false,
    reason: 'Waiting for funding.',
  };
  assert.deepEqual(getEvolutionStatus(state, pokemon), pokemon.evolutionPreview);
  delete pokemon.evolutionPreview;
  assert.equal(getEvolutionStatus(state, pokemon).canEvolve, false);
  assert.equal(getEvolutionStatus(state, pokemon).valueIncrease, 0);
});
test('live gym rankings use server totals once and empty live gyms never inherit demo scores', () => {
  const state = createInitialState();
  const coin = state.coins.find((c) => c.active)!;
  state.profile.supportedGym = coin.id;
  state.gyms = [
    {
      coinId: coin.id,
      name: 'Live gym',
      badge: coin.ticker,
      supporters: 2,
      score: 0.5,
      color: coin.color,
    },
  ];
  const ranking = gymRankings(state).find((gym) => gym.coinId === coin.id)!;
  assert.equal(ranking.score, 0.5);
  assert.equal(ranking.supporters, 2);
  state.gyms = [];
  assert.ok(gymRankings(state).every((gym) => gym.score === 0 && gym.supporters === 0));
});
test('live API rejects simulated walking and unsigned coin creation before any request', async () => {
  const api = createHttpApi('https://example.test');
  await assert.rejects(api.dispatch({ type: 'walk.progress', km: 1 }), /walking|session/i);
  await assert.rejects(
    api.dispatch({
      type: 'coin.create',
      name: 'Test',
      ticker: 'TEST',
      description: '',
      mode: 'Eggs',
      launchKind: 'trainer',
    }),
    /signed|transaction/i,
  );
});
