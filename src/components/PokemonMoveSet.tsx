import { useId, useRef, useState } from 'react';
import { moveByName } from '../data/moves';
import { TypeChip } from './UI';
import { MoveDetails } from './MoveDetails';

export function PokemonMoveSet({
  moves,
  speciesId,
  shiny,
}: {
  moves: string[];
  speciesId: number;
  shiny?: boolean;
}) {
  const [choice, setChoice] = useState(moves[0]);
  const selectedName = moves.includes(choice) ? choice : moves[0];
  const selected = selectedName ? moveByName(selectedName) : null;
  const detailId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    setChoice(moves[index]);
    buttons.current[index]?.focus();
  };
  return (
    <section className="pokemon-move-set" aria-label="Moves">
      <header className="move-screen-heading">
        <h2>Moves</h2>
        <span>
          {moves.length}
          <small> / 4</small>
        </span>
      </header>
      <div className="move-screen-body">
        <div className="game-move-list" role="group" aria-label="Known moves">
          {Array.from({ length: 4 }, (_, index) => {
            const name = moves[index];
            if (!name)
              return (
                <div className="game-move-row is-empty" key={'empty-' + index}>
                  <span aria-hidden="true">—</span>
                  <span>Empty slot</span>
                </div>
              );
            const move = moveByName(name),
              active = name === selectedName;
            return (
              <div className={'game-move-row' + (active ? ' is-selected' : '')} key={name}>
                <button
                  className="game-move-select"
                  ref={(el) => {
                    buttons.current[index] = el;
                  }}
                  aria-label={'Select ' + name}
                  aria-pressed={active}
                  aria-controls={detailId}
                  onClick={() => setChoice(name)}
                  onKeyDown={(event) => {
                    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    select(
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? moves.length - 1
                          : (index + (event.key === 'ArrowUp' ? -1 : 1) + moves.length) %
                            moves.length,
                    );
                  }}
                >
                  <span className="game-move-cursor" aria-hidden="true" />
                  <span className="game-move-name">{name}</span>
                  <TypeChip type={move.type} />
                  <span className="game-move-pp">
                    <small>PP</small> {move.pp}
                    <span>/{move.pp}</span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="game-move-detail" id={detailId}>
          {selected ? (
            <MoveDetails name={selected.name} speciesId={speciesId} shiny={shiny} />
          ) : (
            <p>No moves learned yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
