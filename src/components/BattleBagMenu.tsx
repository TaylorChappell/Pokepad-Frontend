import { useState } from 'react';
import { BATTLE_ITEMS, legalBattleItem, type BattleItem } from '../battle/rules';
import type { BattleAction, BattleState } from '../battle/engine';
import { pokemonById } from '../data/pokemon';
import { Icon, PokemonArt } from './UI';

export function BattleBagMenu({
  state,
  disabled,
  onUse,
  onBack,
}: {
  state: BattleState;
  disabled: boolean;
  onUse: (action: BattleAction) => void;
  onBack: () => void;
}) {
  const [selected, setSelected] = useState<BattleItem | null>(null);
  const items = Object.keys(BATTLE_ITEMS) as BattleItem[];
  return (
    <div className="battle-bag-menu">
      <header>
        <strong>{selected ? 'Use ' + BATTLE_ITEMS[selected].name : 'Battle bag'}</strong>
        <span>
          {state.rules?.items === 'none'
            ? 'Items disabled by the agreed rules'
            : 'One item takes your turn'}
        </span>
      </header>
      {selected ? (
        <div className="battle-bag-targets">
          {state.player.map((pokemon, index) => (
            <button
              key={pokemon.id}
              disabled={disabled || !legalBattleItem(state, 'player', selected, index)}
              onClick={() => onUse({ kind: 'item', item: selected, index })}
            >
              <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} animated={false} />
              <span>
                <strong>{pokemonById(pokemon.speciesId).name}</strong>
                <small>
                  {pokemon.hp}/{pokemon.stats.hp} HP
                  {pokemon.hp === 0
                    ? ' · Fainted'
                    : pokemon.status !== 'none'
                      ? ' · ' + pokemon.status
                      : ''}
                </small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="battle-bag-items">
          {items.map((item) => (
            <button
              key={item}
              title={
                state.bags?.player[item]
                  ? 'Choose a Pokémon that needs this item'
                  : 'None remaining'
              }
              disabled={
                disabled ||
                !state.player.some((_, index) => legalBattleItem(state, 'player', item, index))
              }
              onClick={() => setSelected(item)}
            >
              <span className={'battle-item-art item-' + item} aria-hidden="true" />
              <span>
                <strong>
                  {BATTLE_ITEMS[item].name} <b>×{state.bags?.player[item] ?? 0}</b>
                </strong>
                <small>{BATTLE_ITEMS[item].description}</small>
              </span>
            </button>
          ))}
        </div>
      )}
      <footer>
        <button onClick={() => (selected ? setSelected(null) : onBack())}>
          <Icon name="ArrowLeft" size={16} />
          Back
        </button>
        <small>
          Rival:{' '}
          {items
            .map((item) => `${BATTLE_ITEMS[item].name} ×${state.bags?.rival[item] ?? 0}`)
            .join(' · ')}
        </small>
      </footer>
    </div>
  );
}
