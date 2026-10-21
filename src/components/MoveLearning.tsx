import { useState } from 'react';
import type { OwnedPokemon } from '../types';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
import { Button, Icon, Modal, PokemonArt, TypeChip } from './UI';
import { MovePreview, MoveInfoDialog } from './MovePreview';

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
  const [slot, setSlot] = useState<number | null>(null),
    [info, setInfo] = useState<string | null>(null);
  const meta = moveByName(move),
    name = pokemonById(p.speciesId).name;
  return (
    <div className="move-decision-dialog" data-step={step}>
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
          <MovePreview name={move} speciesId={p.speciesId} shiny={p.shiny} />
          <div className="new-move-record">
            <div>
              <h3>{move}</h3>
              <TypeChip type={meta.type} />
            </div>
            <p>{meta.description}</p>
            <dl>
              <div>
                <dt>POWER</dt>
                <dd>{meta.power ?? '—'}</dd>
              </div>
              <div>
                <dt>ACCURACY</dt>
                <dd>{meta.accuracy === null ? '—' : meta.accuracy + '%'}</dd>
              </div>
              <div>
                <dt>PP</dt>
                <dd>{meta.pp}</dd>
              </div>
            </dl>
          </div>
          {manual && <p className="manual-consumption-note">Uses 1 {move} manual when learned.</p>}
          <div className="modal-actions">
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
                  onClick={() => setSlot(i)}
                >
                  <span>{i + 1}</span>
                  <strong>{m}</strong>
                  <TypeChip type={moveByName(m).type} />
                </button>
                <button
                  className="move-info-button"
                  aria-label={'Preview ' + m}
                  onClick={() => setInfo(m)}
                >
                  <Icon name="Info" size={16} />
                </button>
              </div>
            ))}
          </div>
          <div className="modal-actions">
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
          <div className="modal-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setStep('preview')}>
              Go back
            </Button>
            <Button variant="danger" disabled={busy || p.locked} onClick={onDecline}>
              Do not learn
            </Button>
          </div>
        </>
      )}
      {info && (
        <MoveInfoDialog
          name={info}
          speciesId={p.speciesId}
          shiny={p.shiny}
          onClose={() => setInfo(null)}
        />
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
