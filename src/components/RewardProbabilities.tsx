import { useEffect, useState } from 'react';
import type { Reward } from '../types';
import { pokemonById } from '../data/pokemon';
import { isLegendary, rewardPool } from '../data/rewardPools';
import { loadRewardOdds, type RewardOdds } from '../services/reward-odds';
import { ApiError } from '../services/http';
import { ContentSkeleton } from './Loading';
import { Button, Icon, PokemonArt, SolValue } from './UI';

export function RewardProbabilities({
  reward,
  mode,
  budget,
  wallet,
  load = loadRewardOdds,
}: {
  reward: Reward;
  mode: 'demo' | 'live';
  budget: number;
  wallet: string;
  load?: typeof loadRewardOdds;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(24);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: RewardOdds; error?: string } | null>(
    null,
  );
  const requestKey = wallet + ':' + reward.id + ':' + attempt;
  useEffect(() => {
    if (mode !== 'live') return;
    const controller = new AbortController();
    void load(reward.id, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key: requestKey, data });
      },
      (error) => {
        if (!controller.signal.aborted)
          setResult({
            key: requestKey,
            error:
              error instanceof ApiError && error.code === 'REWARD_ODDS_UNAVAILABLE'
                ? 'The chances for this reward are unavailable. You can still open it when ready.'
                : 'We couldn’t load the chances. Please try again.',
          });
      },
    );
    return () => controller.abort();
  }, [mode, requestKey, reward.id, load]);
  const current = result?.key === requestKey ? result : null;
  const loading = mode === 'live' && !current;
  const pool =
    mode === 'demo' ? rewardPool(reward.tier, reward.kind, budget) : current?.data?.entries || [];
  const filtered = pool.filter(
    (entry) =>
      (filter !== 'legendary' || isLegendary(entry.speciesId)) &&
      pokemonById(entry.speciesId).name.toLowerCase().includes(search.toLowerCase().trim()),
  );
  return (
    <div className="reward-v3-pool">
      <h3>Who could you discover?</h3>
      <p>
        {mode === 'demo'
          ? 'Every opening is a fresh demo draw. Only rewards this coin can fund are included.'
          : reward.gift
            ? 'Explore the Pokémon your gift could contain. Gift Pokémon cannot be sold or staked.'
            : 'These chances were set when you received this reward. Open it to discover who’s inside.'}
      </p>
      {loading ? (
        <ContentSkeleton kind="rows" label="Loading Pokémon and chances" />
      ) : current?.error ? (
        <div className="reward-v3-odds-error" role="alert">
          <p>{current.error}</p>
          <Button variant="secondary" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="reward-v3-pool-tabs">
            <button
              className={filter === 'all' ? 'active' : ''}
              aria-pressed={filter === 'all'}
              onClick={() => {
                setFilter('all');
                setLimit(24);
              }}
            >
              All Pokémon
            </button>
            <button
              className={filter === 'legendary' ? 'active' : ''}
              aria-pressed={filter === 'legendary'}
              onClick={() => {
                setFilter('legendary');
                setLimit(24);
              }}
            >
              Legendaries
            </button>
          </div>
          <input
            className="reward-v3-pool-search"
            aria-label="Search possible Pokémon"
            placeholder="Find a Pokémon…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(24);
            }}
          />
          <div className="reward-v3-pool-list">
            {filtered.length ? (
              filtered.slice(0, limit).map((entry) => (
                <div
                  className={'reward-v3-drop ' + (entry.shiny ? 'is-shiny' : '')}
                  key={entry.speciesId + '-' + entry.shiny}
                >
                  <PokemonArt id={entry.speciesId} shiny={entry.shiny} animated={false} />
                  <div>
                    <strong>{pokemonById(entry.speciesId).name}</strong>
                    {!reward.gift && <SolValue amount={entry.backing} />}
                  </div>
                  <span className="drop-chance">
                    {entry.chance * 100 < 0.01 ? '<0.01' : (entry.chance * 100).toFixed(2)}%
                  </span>
                </div>
              ))
            ) : (
              <p className="reward-v3-no-drops">
                {search.trim()
                  ? 'No Pokémon match your search.'
                  : filter === 'legendary'
                    ? mode === 'live'
                      ? 'This reward’s pool doesn’t include legendary Pokémon.'
                      : 'This pool needs more funding before a legendary can be drawn.'
                    : mode === 'live'
                      ? 'The chances for this reward are unavailable.'
                      : 'The coin’s reward pool needs more funding before this reward can open.'}
              </p>
            )}
          </div>
          {filtered.length > limit && (
            <button className="reward-v3-pool-more" onClick={() => setLimit((value) => value + 24)}>
              Show more Pokémon <Icon name="ChevronDown" size={15} />
            </button>
          )}
          <p className="reward-v3-odds-note">
            {mode === 'demo'
              ? 'Demo odds shown for the current funded pool. Odds can change as pool funding changes.'
              : 'Each colour variant has its own chance. Viewing chances does not change your reward.'}
          </p>
        </>
      )}
    </div>
  );
}
