import type { BattleState } from '../battle/engine';
import { PokemonArt, Icon } from './UI';
export function BattleResult({
  battle,
  gym = false,
  reducedMotion = false,
}: {
  battle: BattleState;
  gym?: boolean;
  reducedMotion?: boolean;
}) {
  const victory = battle.winner === 'player',
    draw = battle.winner === 'draw';
  return (
    <div
      className={
        'battle-finish-scene ' +
        (victory ? 'victory' : draw ? 'draw' : 'defeat') +
        (reducedMotion ? ' still' : '')
      }
      role="status"
      aria-live="polite"
    >
      <div className="battle-finish-ribbon">
        <Icon name={victory ? 'Trophy' : 'Pokeball'} size={28} />
        <span>{gym ? 'GYM CHALLENGE' : 'BATTLE COMPLETE'}</span>
      </div>
      <h2>{victory ? 'Victory!' : draw ? 'A draw.' : 'Defeat.'}</h2>
      <p>
        {victory
          ? gym
            ? 'You defeated the gym’s best.'
            : 'Your team takes the win.'
          : draw
            ? 'Both teams gave it everything.'
            : 'Your team fought bravely.'}
      </p>
      <div className="battle-finish-party">
        {battle.player.map((p) => (
          <div key={p.id} className={p.hp <= 0 ? 'fainted' : ''}>
            <PokemonArt
              id={p.speciesId}
              shiny={p.shiny}
              animated={victory && !reducedMotion && p.hp > 0}
            />
            <span>{p.hp > 0 ? p.hp + '/' + p.stats.hp + ' HP' : 'Fainted'}</span>
          </div>
        ))}
      </div>
      <span className="battle-finish-turns">{Math.max(0, battle.turn - 1)} turns</span>
    </div>
  );
}
