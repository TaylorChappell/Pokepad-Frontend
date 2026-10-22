import type { OwnedPokemon } from '../types';
import { useApp } from '../state/AppContext';
import { getPokemonHealth } from '../data/stats';
import { pokemonById } from '../data/pokemon';
import { ItemSprite } from './ItemSprite';

export function PokemonRecovery({ pokemon }: { pokemon: OwnedPokemon }) {
  const { state, now, act, busy, toast } = useApp();
  const hp = getPokemonHealth(pokemon, now);
  if (hp.current > 0) return null;
  const name = pokemonById(pokemon.speciesId).name;
  const revives = state.bag?.revive || 0;
  const seconds = Math.ceil((hp.remainingMs || 0) / 1000);
  const countdown =
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0') +
    ':' +
    (seconds % 60).toString().padStart(2, '0');
  return (
    <section className="pokemon-recovery" aria-label={name + ' recovery'}>
      <div className="pokemon-recovery-status">
        <strong>
          <span className="fainted-status-mark" aria-hidden="true">
            FNT
          </span>
          Fainted
        </strong>
        {pokemon.locked ? (
          <span>In battle</span>
        ) : hp.remainingMs !== null ? (
          <span
            className="pokemon-recovery-timer"
            role="timer"
            aria-label={'Full health in ' + countdown}
          >
            <span>Full HP in</span> <b>{countdown}</b>
          </span>
        ) : (
          <span>Recovery time syncing…</span>
        )}
      </div>
      {!pokemon.locked &&
        (revives > 0 ? (
          <button
            className="pokemon-revive-button"
            disabled={busy}
            aria-label={'Use Revive on ' + name}
            title="Use 1 Revive to restore 50% HP immediately"
            onClick={async () => {
              if (await act({ type: 'pokemon.item', id: pokemon.id, item: 'revive' }))
                toast(name + ' revived with 50% HP.');
            }}
          >
            <ItemSprite item="revive" size={26} />
            <span>Use Revive</span>
            <small>×{revives}</small>
          </button>
        ) : (
          <p className="pokemon-revive-empty">No Revives in your bag</p>
        ))}
    </section>
  );
}
