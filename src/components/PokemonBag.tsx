import { useState } from 'react';
import { useApp } from '../state/AppContext';
import type { OwnedPokemon } from '../types';
import { getPokemonHealth } from '../data/stats';
import { pokemonById } from '../data/pokemon';
import { PC_ITEMS, GYM_MANUALS, pcItemHealth, type PcItem } from '../game/gym-policy';
import { Icon, Button } from './UI';
export function PokemonBag({ pokemon: p }: { pokemon: OwnedPokemon }) {
  const { state, act, busy, toast } = useApp();
  const health = getPokemonHealth(p),
    bag = state.bag || { berry: 0, potion: 0, revive: 0 };
  const [move, setMove] = useState('Thunder Wave'),
    [slot, setSlot] = useState(0);
  return (
    <section className="pc-care-panel" aria-label="Pokémon care and gym moves">
      <div className="summary-section-heading">
        <div>
          <h2>Trainer bag</h2>
          <p>
            {health.current}/{health.max} HP · Items are consumed only when used.
          </p>
        </div>
        <Icon name="Backpack" size={25} />
      </div>
      <div className="pc-care-items">
        {(Object.keys(PC_ITEMS) as PcItem[]).map((item) => {
          const meta = PC_ITEMS[item],
            next = pcItemHealth(item, health.current, health.max),
            reason = p.locked
              ? 'Unavailable while in battle'
              : !bag[item]
                ? 'Win gym challenges to earn supplies'
                : next === null
                  ? item === 'revive'
                    ? 'Only for a fainted Pokémon'
                    : health.current === 0
                      ? 'Use a Revive first'
                      : 'HP is full'
                  : `Restore to ${next}/${health.max} HP`;
          return (
            <button
              key={item}
              disabled={busy || p.locked || !bag[item] || next === null}
              title={reason}
              onClick={async () => {
                if (await act({ type: 'pokemon.item', id: p.id, item }))
                  toast(meta.name + ' used on ' + pokemonById(p.speciesId).name + '.');
              }}
            >
              <span className={'battle-item-art item-' + item} aria-hidden="true" />
              <span>
                <strong>
                  {meta.name} <b>×{bag[item]}</b>
                </strong>
                <small>{reason}</small>
              </span>
            </button>
          );
        })}
      </div>
      <div className="gym-manual-panel">
        <h3>Gym move manuals</h3>
        <p>
          One gym move per Pokémon, within its four move slots. Manuals stay with your trainer and
          do not change SOL value.
        </p>
        <div className="manual-unlocks">
          {GYM_MANUALS.map((m) => (
            <span
              key={m.move}
              className={state.gymProgress?.manuals.includes(m.move) ? 'unlocked' : ''}
            >
              {m.move}
              <small>
                {state.gymProgress?.manuals.includes(m.move)
                  ? 'Unlocked'
                  : m.wins + ' rewarded gym wins'}
              </small>
            </span>
          ))}
        </div>
        {!!state.gymProgress?.manuals.length && (
          <>
            <div className="manual-controls">
              <label>
                Move
                <select
                  aria-label="Gym move"
                  value={move}
                  onChange={(e) => setMove(e.target.value)}
                >
                  {state.gymProgress.manuals.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                Move slot
                <select
                  aria-label="Replace move slot"
                  value={slot}
                  onChange={(e) => setSlot(Number(e.target.value))}
                >
                  {Array.from({ length: Math.min(4, (p.baseMoves || p.moves).length) }, (_, i) => (
                    <option key={i} value={i}>
                      {i + 1}: {(p.baseMoves || p.moves)[i] || 'Open slot'}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Button
              disabled={
                busy ||
                p.locked ||
                (p.baseMoves || p.moves).includes(move) ||
                !state.gymProgress.manuals.includes(move)
              }
              onClick={async () => {
                if (await act({ type: 'pokemon.manual', id: p.id, move, slot }))
                  toast(
                    move + ' equipped. The original move is kept for when you remove the manual.',
                  );
              }}
            >
              Equip gym move
            </Button>
          </>
        )}
        {p.gymManual && (
          <button
            className="text-link"
            disabled={busy || p.locked}
            onClick={() => act({ type: 'pokemon.manual', id: p.id, move: null })}
          >
            Remove {p.gymManual.move} · restore original move
          </button>
        )}
      </div>
    </section>
  );
}
