import type { CSSProperties } from 'react';
import { pokemonById } from '../data/pokemon';
import { asset } from '../utils';
import type { Side } from './engine';

/** Native FRLG sprites share a 64px grid; never mirror a front sprite to fake a back view. */
export function BattleSprite({
  speciesId,
  shiny = false,
  side,
  className = '',
  style,
}: {
  speciesId: number;
  shiny?: boolean;
  side: Side;
  className?: string;
  style?: CSSProperties;
}) {
  const species = pokemonById(speciesId);
  const facing = side === 'player' ? 'back' : 'front';
  const index = species.id - 1;
  const column = index % 13;
  const row = Math.floor(index / 13);
  return (
    <span
      className={'battle-native-sprite ' + className}
      role="img"
      aria-label={species.name + (shiny ? ', shiny' : '')}
      data-facing={facing}
      data-species={species.id}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        aspectRatio: '1 / 1',
        backgroundImage: `url("${asset(`battle/sprites/${facing}${shiny ? '-shiny' : ''}.svg`)}")`,
        backgroundSize: '1300% 1200%',
        backgroundPosition: `${(column / 12) * 100}% ${(row / 11) * 100}%`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        ...style,
      }}
    />
  );
}
