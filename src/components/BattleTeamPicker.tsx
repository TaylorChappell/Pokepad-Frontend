import { useState, type CSSProperties } from 'react';
import { PokemonBattleInfo } from './PokemonBattleInfo';
import type { OwnedPokemon } from '../types';
import { pokemonById } from '../data/pokemon';
import { getPokemonHealth } from '../data/stats';
import { pokemonStrength } from '../state/collection';
import { POKEMON_SORTS, sortPokemon } from '../state/pokemon-sort';
import { useOptionalApp } from '../state/AppContext';
import { Icon, Modal, PokemonArt, Pokeball, TypeChip } from './UI';

export function battleAvailability(pokemon: OwnedPokemon, pokemonWager = false): string | null {
  if (pokemon.locked) return 'Busy';
  if (getPokemonHealth(pokemon).current <= 0) return 'Needs a Revive';
  if (pokemonWager && pokemon.starter) return 'Starters cannot be wagered';
  return null;
}
export function battleSelection(
  pokemon: OwnedPokemon[],
  selected: string[],
  pokemonWager = false,
  limit = 3,
): string[] {
  return [...new Set(selected)]
    .filter((id) => pokemon.some((p) => p.id === id && !battleAvailability(p, pokemonWager)))
    .slice(0, limit);
}
const previousKey = (wallet: string) => 'kanto:previous-team:' + wallet;
export function rememberBattleTeam(wallet: string, pokemon: OwnedPokemon[]) {
  try {
    localStorage.setItem(
      previousKey(wallet),
      JSON.stringify(
        pokemon.map(({ id, speciesId, shiny, level }) => ({ id, speciesId, shiny, level })),
      ),
    );
  } catch {
    /* Optional local convenience. */
  }
}
function previousTeam(
  wallet: string,
): Pick<OwnedPokemon, 'id' | 'speciesId' | 'shiny' | 'level'>[] {
  try {
    const p = JSON.parse(localStorage.getItem(previousKey(wallet)) || '[]');
    return Array.isArray(p)
      ? p
          .filter(
            (x) =>
              x &&
              typeof x.id === 'string' &&
              Number.isInteger(x.speciesId) &&
              x.speciesId >= 1 &&
              x.speciesId <= 151,
          )
          .slice(0, 3)
      : [];
  } catch {
    return [];
  }
}
export function BattleTeamPicker({
  pokemon,
  selected,
  onChange,
  pokemonWager = false,
  teamSize,
  disabled = false,
}: {
  pokemon: OwnedPokemon[];
  selected: string[];
  onChange: (ids: string[]) => void;
  pokemonWager?: boolean;
  teamSize?: number;
  disabled?: boolean;
}) {
  const app = useOptionalApp();
  const [infoId, setInfoId] = useState<string | null>(null);
  const [slotOrder, setSlotOrder] = useState<string[]>([]);
  const [slot, setSlot] = useState<number | null>(null),
    [query, setQuery] = useState(''),
    [sort, setSort] = useState('Favourites first'),
    [filter, setFilter] = useState('All');
  const limit = teamSize || 3,
    ids = battleSelection(pokemon, selected, pokemonWager, limit);
  const slots = Array.from({ length: 3 }, (_, i) =>
    i < limit && ids.includes(slotOrder[i]) ? slotOrder[i] : '',
  );
  for (const id of ids) if (!slots.includes(id)) slots[slots.indexOf('')] = id;
  const leadSlot = Math.max(0, slots.findIndex(Boolean));
  const previous = previousTeam(app?.state.profile.wallet || 'demo');
  const previousIds = battleSelection(
    pokemon,
    previous.map((p) => p.id),
    pokemonWager,
    limit,
  );
  const types = [...new Set(pokemon.flatMap((p) => pokemonById(p.speciesId).types))].sort();
  const visible = sortPokemon(pokemon, sort, app?.state).filter(
    (p) =>
      pokemonById(p.speciesId).name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === 'All' || filter === 'Favourites'
        ? filter === 'All' || p.favourite
        : filter === 'Shiny'
          ? p.shiny
          : pokemonById(p.speciesId).types.includes(filter)),
  );
  const choose = (id: string) => {
    if (slot === null) return;
    const next = [...slots];
    const old = next.indexOf(id);
    if (old >= 0) {
      [next[old], next[slot]] = [next[slot], next[old]];
    } else next[slot] = id;
    setSlotOrder(next);
    onChange(next.filter(Boolean));
    setSlot(null);
  };
  return (
    <section
      className="battle-party-desk slot-party-desk party-console"
      aria-label="Choose your battle team"
    >
      <header className="battle-party-heading">
        <div>
          <h2>Choose your team</h2>
          <p>Your first Pokémon leads the battle.</p>
        </div>
        <span className="party-count" aria-label={`${ids.length} of ${limit} Pokémon selected`}>
          {Array.from({ length: limit }, (_, i) => (
            <span key={i} className={i < ids.length ? 'occupied' : ''}>
              <Pokeball size={18} />
            </span>
          ))}
          <b>
            {ids.length}/{limit}
          </b>
        </span>
      </header>
      <div className="battle-party-slots">
        {Array.from({ length: 3 }, (_, index) => {
          const p = pokemon.find((p) => p.id === slots[index]);
          const hp = p ? getPokemonHealth(p) : null;
          return (
            <button
              type="button"
              key={index}
              className={'battle-party-slot ' + (p ? 'filled' : 'empty')}
              disabled={disabled || index >= limit}
              aria-label={'Choose Pokémon for slot ' + (index + 1)}
              onClick={() => {
                setQuery('');
                setSlot(index);
              }}
            >
              <span className="party-slot-number">
                {index === leadSlot ? 'Lead' : '0' + (index + 1)}
              </span>
              <span className="party-slot-art">
                {p ? (
                  <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
                ) : (
                  <Pokeball size={38} />
                )}
              </span>
              <span className="party-slot-copy">
                <strong>
                  {p
                    ? pokemonById(p.speciesId).name
                    : index >= limit
                      ? 'Not used'
                      : 'Choose Pokémon'}
                  {p && <em>Lv. {p.level}</em>}
                </strong>
                {p && hp ? (
                  <>
                    <span className="type-row">
                      {pokemonById(p.speciesId).types.map((type) => (
                        <TypeChip key={type} type={type} />
                      ))}
                    </span>
                    <span className="party-hp">
                      <b>HP</b>
                      <span className="party-hp-track">
                        <i
                          style={
                            {
                              width: `${(hp.current / hp.max) * 100}%`,
                              '--hp-color':
                                hp.current / hp.max > 0.5
                                  ? '#60ae84'
                                  : hp.current / hp.max > 0.2
                                    ? '#d4ae4a'
                                    : '#d86b60',
                            } as CSSProperties
                          }
                        />
                      </span>
                      <small>
                        {hp.current}/{hp.max}
                      </small>
                    </span>
                  </>
                ) : (
                  <small>{index >= limit ? 'Room limit' : 'Choose from your PC'}</small>
                )}
              </span>
              <span className="party-slot-action" aria-hidden="true">
                <Icon name={p ? 'ChevronRight' : 'Plus'} size={20} />
              </span>
            </button>
          );
        })}
      </div>
      {previous.length > 0 && (
        <div className="previous-party">
          <span>
            <strong>Previous team</strong>
            <small>
              {previousIds.length === previous.length
                ? 'Ready to use'
                : previousIds.length + ' available · unavailable slots are left empty'}
            </small>
          </span>
          <div className="previous-party-preview">
            {previous.map((p) => (
              <span
                key={p.id}
                title={pokemonById(p.speciesId).name}
                className={previousIds.includes(p.id) ? '' : 'unavailable'}
              >
                <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
                <small>{pokemonById(p.speciesId).name}</small>
              </span>
            ))}
          </div>
          <button
            className="button secondary"
            disabled={disabled || !previousIds.length}
            onClick={() => {
              setSlotOrder(previousIds);
              onChange(previousIds);
            }}
          >
            Use previous team
          </button>
        </div>
      )}
      <footer>
        <p>
          {ids.length ? (
            <>
              <strong>
                {pokemon
                  .filter((p) => ids.includes(p.id))
                  .reduce((total, p) => total + pokemonStrength(p), 0)
                  .toLocaleString()}
              </strong>{' '}
              team strength
            </>
          ) : (
            'Up to 3 Pokémon'
          )}
        </p>
        <button
          className="text-link"
          disabled={disabled || !ids.length}
          onClick={() => {
            setSlotOrder([]);
            onChange([]);
          }}
        >
          Clear team
        </button>
      </footer>
      {slot !== null && (
        <Modal
          title={'Choose ' + (slot === 0 ? 'your lead' : 'partner ' + (slot + 1))}
          onClose={() => setSlot(null)}
          className="party-picker-modal pc-party-browser"
        >
          <nav className="pc-party-targets" aria-label="Team slots">
            {Array.from({ length: limit }, (_, index) => {
              const member = pokemon.find((p) => p.id === slots[index]);
              return (
                <button key={index} aria-pressed={slot === index} onClick={() => setSlot(index)}>
                  {member ? (
                    <PokemonArt id={member.speciesId} shiny={member.shiny} animated={false} />
                  ) : (
                    <Pokeball size={22} />
                  )}
                  <span>
                    <small>{index === 0 ? 'Lead' : 'Slot ' + (index + 1)}</small>
                    <strong>{member ? pokemonById(member.speciesId).name : 'Empty'}</strong>
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="party-picker-tools">
            <label className="small-search">
              <Icon name="Search" />
              <input
                aria-label="Find a battle Pokémon"
                placeholder="Find a Pokémon…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Sort Pokémon"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              {POKEMON_SORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              aria-label="Filter Pokémon"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {['All', 'Favourites', 'Shiny', ...types].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="party-picker-grid">
            {visible.map((p) => {
              const reason = battleAvailability(p, pokemonWager),
                hp = getPokemonHealth(p);
              return (
                <article className="party-picker-entry" key={p.id}>
                  <button
                    className={'battle-picker-pokemon ' + (ids.includes(p.id) ? 'selected' : '')}
                    disabled={disabled || !!reason}
                    onClick={() => choose(p.id)}
                    aria-label={
                      'Choose ' + pokemonById(p.speciesId).name + (reason ? ', ' + reason : '')
                    }
                  >
                    <span className="picker-sprite">
                      <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
                    </span>
                    <span className="picker-copy">
                      <strong>
                        {pokemonById(p.speciesId).name}
                        {p.favourite && <Icon name="Heart" size={12} />}
                      </strong>
                      <span className="picker-level">
                        Lv. {p.level} · {pokemonStrength(p)} strength
                      </span>
                      <span className="type-row">
                        {pokemonById(p.speciesId).types.map((t) => (
                          <TypeChip key={t} type={t} />
                        ))}
                      </span>
                      <span className="party-hp">
                        <b>HP</b>
                        <span className="party-hp-track">
                          <i style={{ width: `${(hp.current / hp.max) * 100}%` }} />
                        </span>
                        <small>
                          {hp.current}/{hp.max}
                        </small>
                      </span>
                      {reason ? (
                        <small className="picker-unavailable">{reason}</small>
                      ) : (
                        ids.includes(p.id) && (
                          <small className="picker-in-team">In your team · tap to swap</small>
                        )
                      )}
                    </span>
                  </button>
                  <button
                    className="picker-info move-info-button"
                    aria-label={'View ' + pokemonById(p.speciesId).name + ' battle info'}
                    onClick={() => setInfoId(p.id)}
                  >
                    <Icon name="Info" size={16} />
                  </button>
                </article>
              );
            })}
          </div>
          {!visible.length && <p>No Pokémon match your filters.</p>}
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setSlot(null)}>
              Back to team
            </button>
            {slots[slot] && (
              <button
                className="button secondary"
                onClick={() => {
                  const next = slots.map((id, i) => (i === slot ? '' : id));
                  setSlotOrder(next);
                  onChange(next.filter(Boolean));
                  setSlot(null);
                }}
              >
                Clear this slot
              </button>
            )}
          </div>
        </Modal>
      )}
      {infoId && pokemon.find((p) => p.id === infoId) && (
        <PokemonBattleInfo
          pokemon={pokemon.find((p) => p.id === infoId)!}
          onClose={() => setInfoId(null)}
        />
      )}
    </section>
  );
}
