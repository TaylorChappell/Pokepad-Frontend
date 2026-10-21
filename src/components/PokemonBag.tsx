import { ItemSprite } from './ItemSprite';
import { useState } from 'react';
import { useApp } from '../state/AppContext';
import type { OwnedPokemon } from '../types';
import { getPokemonHealth } from '../data/stats';
import { pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
import { PC_ITEMS, pcItemHealth, type PcItem } from '../game/gym-policy';
import { Icon, TypeChip } from './UI';
import { ManualCatalogue } from './MoveManuals';
import { MoveInfoDialog } from './MovePreview';
import { TeachMoveDialog } from './MoveLearning';
export function PokemonBag({
  pokemon: p,
  section = 'all',
}: {
  pokemon: OwnedPokemon;
  section?: 'items' | 'manuals' | 'all';
}) {
  const { state, act, busy, toast } = useApp(),
    health = getPokemonHealth(p),
    bag = state.bag || { berry: 0, potion: 0, revive: 0 };
  const [teach, setTeach] = useState<string | null>(null),
    [info, setInfo] = useState<string | null>(null),
    [catalogue, setCatalogue] = useState(false);
  const manuals = Object.entries(state.gymProgress?.manuals || {}).filter(([, n]) => n > 0);
  return (
    <section className="pc-care-panel" aria-label="Pokémon care and move manuals">
      {section !== 'manuals' && (
        <>
          <div className="summary-section-heading">
            <div>
              <h2>Use an item</h2>
              <p>
                {health.current}/{health.max} HP
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
                    ? 'None in your bag'
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
                  <ItemSprite item={item} />
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
        </>
      )}
      {section !== 'items' && (
        <div className="gym-manual-panel">
          <header className="manual-inventory-heading">
            <h3>Move manuals</h3>
            <button className="text-link" onClick={() => setCatalogue(true)}>
              View all moves <Icon name="ArrowUpRight" size={14} />
            </button>
          </header>
          {!manuals.length ? (
            <p className="manual-empty">You don’t have any move manuals.</p>
          ) : (
            <>
              <p>Choose a manual to teach this Pokémon. Each manual is used once.</p>
              <div className="owned-manuals">
                {manuals.map(([move, count]) => (
                  <div className="owned-manual-row" key={move}>
                    <span className="manual-disc">
                      <Icon name="BookOpen" size={25} />
                    </span>
                    <div>
                      <strong>
                        {move} <small>×{count}</small>
                      </strong>
                      <TypeChip type={moveByName(move).type} />
                    </div>
                    <button
                      className="move-info-button"
                      aria-label={'Preview ' + move}
                      onClick={() => setInfo(move)}
                    >
                      <Icon name="Info" size={16} />
                    </button>
                    <button
                      className="button secondary"
                      disabled={busy || p.locked || p.moves.includes(move)}
                      onClick={() => setTeach(move)}
                    >
                      {p.moves.includes(move) ? 'Known' : 'Teach'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {catalogue && <ManualCatalogue onClose={() => setCatalogue(false)} />}
      {info && (
        <MoveInfoDialog
          name={info}
          speciesId={p.speciesId}
          shiny={p.shiny}
          onClose={() => setInfo(null)}
        />
      )}
      {teach && <TeachMoveDialog pokemonId={p.id} move={teach} onClose={() => setTeach(null)} />}
    </section>
  );
}
