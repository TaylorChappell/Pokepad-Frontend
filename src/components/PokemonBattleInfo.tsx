import { useState } from 'react';
import type { OwnedPokemon } from '../types';
import { pokemonById } from '../data/pokemon';
import { getPokemonHealth, getPokemonStats } from '../data/stats';
import { pokemonStrength } from '../state/collection';
import { moveByName } from '../data/moves';
import { Icon, Modal, PokemonArt, TypeChip } from './UI';
import { MoveInfoDialog } from './MovePreview';
export function PokemonBattleInfo({
  pokemon,
  onClose,
}: {
  pokemon: OwnedPokemon;
  onClose: () => void;
}) {
  const [info, setInfo] = useState<string | null>(null),
    species = pokemonById(pokemon.speciesId),
    hp = getPokemonHealth(pokemon),
    stats = getPokemonStats(pokemon);
  const labels: Record<string, string> = {
    hp: 'HP',
    attack: 'Attack',
    defense: 'Defense',
    specialAttack: 'Sp. Atk',
    specialDefense: 'Sp. Def',
    speed: 'Speed',
  };
  return (
    <Modal title={species.name} onClose={onClose} className="pokemon-battle-info-modal">
      <div className="pokemon-battle-info">
        <header>
          <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} animated={false} />
          <div>
            <h2>{species.name}</h2>
            <p>
              Lv. {pokemon.level} · {pokemonStrength(pokemon)} strength
            </p>
            <div className="type-row">
              {species.types.map((type) => (
                <TypeChip key={type} type={type} />
              ))}
            </div>
            <p>
              {hp.current}/{hp.max} HP{pokemon.locked ? ' · Busy' : ''}
            </p>
          </div>
        </header>
        <dl className="party-info-stats">
          {Object.entries(stats).map(([key, value]) => (
            <div key={key}>
              <dt>{labels[key] || key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <h3>Moves</h3>
        <div className="party-info-moves">
          {pokemon.moves.map((name) => {
            const move = moveByName(name);
            return (
              <div key={name}>
                <span>
                  <strong>{name}</strong>
                  <small>
                    {move.name === 'Dragon Rage'
                      ? '40 damage'
                      : move.name === 'Night Shade'
                        ? 'Damage = level'
                        : move.power
                          ? 'Power ' + move.power
                          : 'Status move'}{' '}
                    · {move.pp} PP
                  </small>
                </span>
                <TypeChip type={move.type} />
                <button
                  className="move-info-button"
                  aria-label={'Preview ' + name}
                  onClick={() => setInfo(name)}
                >
                  <Icon name="Info" size={17} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      {info && (
        <MoveInfoDialog
          name={info}
          speciesId={pokemon.speciesId}
          shiny={pokemon.shiny}
          onClose={() => setInfo(null)}
        />
      )}
    </Modal>
  );
}
