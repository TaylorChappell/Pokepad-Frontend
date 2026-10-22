import { moveCategory } from '../battle/engine';
import { moveByName } from '../data/moves';
import { TypeChip } from './UI';
import { MovePreview } from './MovePreview';

/** The move's animation and battle data stay together wherever it is being learned or inspected. */
export function MoveDetails({
  name,
  speciesId,
  shiny = false,
}: {
  name: string;
  speciesId: number;
  shiny?: boolean;
}) {
  const move = moveByName(name);
  return (
    <div className="move-detail-record">
      <div className="move-detail-title" aria-live="polite">
        <h3>{move.name}</h3>
        <div className="game-move-detail-heading">
          <TypeChip type={move.type} />
          <span>{moveCategory(move)}</span>
        </div>
      </div>
      <MovePreview key={name} name={name} speciesId={speciesId} shiny={shiny} />
      <dl className="game-move-stats">
        <div>
          <dt>Power</dt>
          <dd>
            {move.name === 'Dragon Rage'
              ? '40 fixed'
              : move.name === 'Night Shade'
                ? 'Level'
                : (move.power ?? '—')}
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{move.accuracy === null ? '—' : move.accuracy + '%'}</dd>
        </div>
        <div>
          <dt>PP</dt>
          <dd>{move.pp}</dd>
        </div>
      </dl>
      <p className="move-detail-description">{move.description}</p>
    </div>
  );
}
