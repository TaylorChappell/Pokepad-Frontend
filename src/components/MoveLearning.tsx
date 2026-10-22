import { useState } from 'react';
import type { OwnedPokemon } from '../types';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
import { Button, Modal, PokemonArt, TypeChip } from './UI';
import { MoveDetails } from './MoveDetails';

export function MoveLearningPanel({
  pokemon: p,
  move,
  manual = false,
  busy,
  onLearn,
  onDecline,
  onLater,
}: {
  pokemon: OwnedPokemon;
  move: string;
  manual?: boolean;
  busy: boolean;
  onLearn: (slot?: number) => void;
  onDecline: () => void;
  onLater: () => void;
}) {
  const [step, setStep] = useState<'preview' | 'replace' | 'decline'>('preview');
  const [slot, setSlot] = useState<number | null>(null);
  const name = pokemonById(p.speciesId).name;
  return (
    <div className="move-decision-dialog move-learning-screen" data-step={step}>
      <div className="move-decision-title">
        <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
        <p>
          <strong>{name}</strong>
          {manual ? ' can learn ' : ' wants to learn '}
          <strong>{move}</strong>.
        </p>
      </div>
      {step === 'preview' ? (
        <>
          <div className="learning-move-detail">
            <MoveDetails name={move} speciesId={p.speciesId} shiny={p.shiny} />
          </div>
          {manual && <p className="manual-consumption-note">Uses 1 {move} manual when learned.</p>}
          <div className="modal-actions move-command-menu">
            <Button variant="secondary" disabled={busy} onClick={onLater}>
              Later
            </Button>
            <Button
              variant="secondary"
              disabled={busy || p.locked}
              onClick={() => (manual ? onDecline() : setStep('decline'))}
            >
              Do not learn
            </Button>
            <Button
              disabled={busy || p.locked}
              onClick={() => (p.moves.length >= 4 ? setStep('replace') : onLearn())}
            >
              Learn {move}
            </Button>
          </div>
        </>
      ) : step === 'replace' ? (
        <>
          <h3 className="move-step-title">Which move should {name} forget?</h3>
          <p className="move-forget-label">A Pokémon can know four moves.</p>
          <div className="move-forget-options">
            {p.moves.map((m, i) => (
              <div className="forget-move-row" key={m}>
                <button
                  disabled={busy || p.locked}
                  className={slot === i ? 'selected' : ''}
                  aria-pressed={slot === i}
                  onClick={() => setSlot(i)}
                >
                  <span className="game-command-cursor" aria-hidden="true" />
                  <strong>{m}</strong>
                  <TypeChip type={moveByName(m).type} />
                </button>
              </div>
            ))}
          </div>
          {slot !== null && (
            <div className="learning-move-detail replacement-move-detail">
              <MoveDetails name={p.moves[slot]} speciesId={p.speciesId} shiny={p.shiny} />
            </div>
          )}
          <div className="modal-actions move-command-menu">
            <Button variant="secondary" disabled={busy} onClick={() => setStep('preview')}>
              Back
            </Button>
            <Button
              variant="secondary"
              disabled={busy || p.locked}
              onClick={() => (manual ? onDecline() : setStep('decline'))}
            >
              Do not learn
            </Button>
            <Button disabled={busy || p.locked || slot === null} onClick={() => onLearn(slot!)}>
              Learn {move}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="move-final-warning">
            This opportunity will be declined permanently. {name} will not be offered this move
            again.
          </p>
          <div className="modal-actions move-command-menu">
            <Button variant="secondary" disabled={busy} onClick={() => setStep('preview')}>
              Go back
            </Button>
            <Button variant="danger" disabled={busy || p.locked} onClick={onDecline}>
              Do not learn
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
export function TeachMoveDialog({
  pokemonId,
  move,
  onClose,
}: {
  pokemonId: string;
  move: string;
  onClose: () => void;
}) {
  const { state, act, busy, toast } = useApp(),
    p = state.pokemon.find((p) => p.id === pokemonId);
  if (!p) return null;
  const learn = async (slot?: number) => {
    if (
      await act({ type: 'pokemon.manual', id: p.id, move, ...(slot !== undefined ? { slot } : {}) })
    ) {
      toast(pokemonById(p.speciesId).name + ' learned ' + move + '.');
      onClose();
    }
  };
  return (
    <Modal title={'Teach ' + move} onClose={onClose} closeDisabled={busy}>
      <MoveLearningPanel
        pokemon={p}
        move={move}
        manual
        busy={busy}
        onLearn={learn}
        onDecline={onClose}
        onLater={onClose}
      />
    </Modal>
  );
}
