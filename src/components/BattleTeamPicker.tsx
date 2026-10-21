import { useMemo, useRef, useState } from 'react';
import type { OwnedPokemon } from '../types';
import { pokemonById } from '../data/pokemon';
import { getPokemonHealth } from '../data/stats';
import { compareBattlePokemon, pokemonStrength } from '../state/collection';
import { Icon, PokemonArt, TypeChip } from './UI';
export function battleAvailability(
  pokemon: OwnedPokemon,
  pokemonWager: boolean,
): string | undefined {
  if (pokemon.locked) return 'Busy';
  if (getPokemonHealth(pokemon).current <= 0) return 'Recovering';
  if (pokemonWager && pokemon.starter) return 'Starter · cannot be staked';
  return undefined;
}
export function battleSelection(
  pokemon: OwnedPokemon[],
  selected: string[],
  pokemonWager: boolean,
  limit = 3,
) {
  const allowed = new Set(
    pokemon.filter((item) => !battleAvailability(item, pokemonWager)).map((item) => item.id),
  );
  return [...new Set(selected)].filter((id) => allowed.has(id)).slice(0, limit);
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
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const search = useRef<HTMLInputElement>(null);
  const limit = teamSize || 3;
  const ids = battleSelection(pokemon, selected, pokemonWager, limit);
  const sorted = useMemo(() => [...pokemon].sort(compareBattlePokemon), [pokemon]);
  const types = [...new Set(pokemon.flatMap((item) => pokemonById(item.speciesId).types))].sort();
  const visible = sorted.filter((item) => {
    const species = pokemonById(item.speciesId);
    const matches =
      species.name.toLowerCase().includes(query.trim().toLowerCase()) ||
      String(item.speciesId) === query.trim();
    return (
      matches &&
      (filter === 'all' ||
        (filter === 'ready' && !battleAvailability(item, pokemonWager)) ||
        (filter === 'favourite' && item.favourite) ||
        (filter.startsWith('type:') && species.types.includes(filter.slice(5))))
    );
  });
  function toggle(id: string) {
    if (disabled) return;
    onChange(
      ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id].slice(0, limit),
    );
  }
  return (
    <section className="battle-party-desk" aria-label="Choose your online battle team">
      <header className="battle-party-heading">
        <div>
          <span className="battle-desk-label">YOUR PARTY</span>
          <h2>
            Choose your team{' '}
            <small>
              {ids.length}/{teamSize || 3}
            </small>
          </h2>
        </div>
        <button
          type="button"
          disabled={disabled || !pokemon.length}
          onClick={() =>
            onChange(
              sorted
                .filter((item) => !battleAvailability(item, pokemonWager))
                .slice(0, limit)
                .map((item) => item.id),
            )
          }
        >
          Quick pick <Icon name="ArrowRight" size={14} />
        </button>
      </header>
      <div className="battle-party-slots">
        {Array.from({ length: 3 }, (_, index) => {
          const item = pokemon.find((value) => value.id === ids[index]);
          const hp = item && getPokemonHealth(item);
          return (
            <button
              type="button"
              key={index}
              className={
                'battle-party-slot ' + (item ? 'filled' : '') + (index >= limit ? ' unused' : '')
              }
              disabled={disabled || index >= limit}
              onClick={() => (item ? toggle(item.id) : search.current?.focus())}
              aria-label={
                item
                  ? 'Remove ' + pokemonById(item.speciesId).name + ' from team'
                  : index >= limit
                    ? 'Not used in this room'
                    : 'Choose Pokémon for slot ' + (index + 1)
              }
            >
              <span className="battle-slot-label">
                {index === 0 ? 'LEAD' : 'PARTY ' + (index + 1)}
              </span>
              {item ? (
                <>
                  <PokemonArt id={item.speciesId} shiny={item.shiny} animated={false} />
                  <div>
                    <strong>{pokemonById(item.speciesId).name}</strong>
                    <small>
                      Lv. {item.level} · {hp!.current}/{hp!.max} HP
                    </small>
                  </div>
                  <span className="battle-slot-remove">
                    <Icon name="X" size={11} />
                  </span>
                </>
              ) : (
                <>
                  <span className="battle-slot-empty">
                    <Icon name="Pokeball" size={28} />
                  </span>
                  <small>{index >= limit ? 'Not needed' : 'Add Pokémon'}</small>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="battle-picker-tools">
        <label className="battle-picker-search">
          <Icon name="Search" size={16} />
          <input
            ref={search}
            aria-label="Search battle Pokémon"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a Pokémon…"
          />
          {query && (
            <button type="button" aria-label="Clear Pokémon search" onClick={() => setQuery('')}>
              <Icon name="X" size={13} />
            </button>
          )}
        </label>
        <select
          aria-label="Filter battle Pokémon"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All Pokémon</option>
          <option value="ready">Battle ready</option>
          <option value="favourite">Favourites</option>
          {types.map((type) => (
            <option key={type} value={'type:' + type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div className="battle-picker-grid" aria-label="Your Pokémon inventory">
        {visible.map((item) => {
          const species = pokemonById(item.speciesId),
            hp = getPokemonHealth(item),
            reason = battleAvailability(item, pokemonWager),
            chosen = ids.includes(item.id),
            blocked = disabled || Boolean(reason) || (!chosen && ids.length >= limit);
          return (
            <button
              type="button"
              className={
                'battle-picker-pokemon ' +
                (chosen ? 'is-selected ' : '') +
                (reason ? 'is-unavailable' : '')
              }
              key={item.id}
              aria-pressed={chosen}
              disabled={blocked}
              onClick={() => toggle(item.id)}
              aria-label={
                species.name +
                ', level ' +
                item.level +
                (reason ? ', ' + reason : chosen ? ', selected' : ', add to team')
              }
            >
              <span className="battle-picker-number">
                {chosen ? (
                  <Icon name="Check" size={13} />
                ) : (
                  '#' + String(item.speciesId).padStart(3, '0')
                )}
              </span>
              {item.favourite && (
                <span className="battle-picker-favourite" aria-label="Favourite">
                  ★
                </span>
              )}
              <PokemonArt id={item.speciesId} shiny={item.shiny} animated={false} />
              <div className="battle-picker-identity">
                <strong>{species.name}</strong>
                <span>Lv. {item.level}</span>
              </div>
              <div className="battle-picker-types">
                {species.types.map((type) => (
                  <TypeChip key={type} type={type} />
                ))}
              </div>
              <div className="battle-picker-health">
                <span>
                  HP{' '}
                  <b>
                    {hp.current}/{hp.max}
                  </b>
                </span>
                <i>
                  <b style={{ width: hp.percent + '%' }} />
                </i>
              </div>
              <span className="battle-picker-strength">
                {reason || (
                  <>
                    <Icon name="Swords" size={12} />
                    {pokemonStrength(item)} strength
                  </>
                )}
              </span>
            </button>
          );
        })}
        {!visible.length && (
          <div className="battle-picker-empty">
            <Icon name="Pokeball" size={36} />
            <strong>{pokemon.length ? 'No Pokémon match' : 'Your party starts in My PC'}</strong>
            <p>
              {pokemon.length
                ? 'Try another name or filter.'
                : 'Choose your starter or open a reward to meet your first partner.'}
            </p>
            {!pokemon.length && (
              <a href="#/pokemon">
                Visit My PC <Icon name="ArrowRight" size={13} />
              </a>
            )}
          </div>
        )}
      </div>
      <footer className="battle-picker-footer">
        <span>Favourites first · strongest next</span>
        <button type="button" disabled={!ids.length || disabled} onClick={() => onChange([])}>
          Clear team
        </button>
      </footer>
    </section>
  );
}
