import { useEffect, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { useRevealAudio } from '../audio/sound';
import type { RevealFrame } from '../audio/reveal-timeline';
import { pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
import { availableMoveOffers, getEvolutionStatus, pendingMove } from '../state/model';
import { Button, Modal, PokemonArt, SolValue, TypeChip } from './UI';
import type { OwnedPokemon } from '../types';
import { API_BASE } from '../services/http';
import { deferTrainerPrompt } from '../state/trainer-prompts';
export function EvolutionValue({
  preview,
  fallback,
}: {
  preview?: OwnedPokemon['evolutionPreview'];
  fallback: number;
}) {
  return preview?.nextValueMin !== undefined &&
    preview.nextValueMax !== undefined &&
    preview.nextValueMin < preview.nextValueMax ? (
    <span className="evolution-value-range">
      <SolValue amount={preview.nextValueMin} />
      <span>–</span>
      <SolValue amount={preview.nextValueMax} />
    </span>
  ) : (
    <SolValue amount={fallback} />
  );
}
type EvolutionScene = {
  from: number;
  to?: number;
  before: number;
  after?: number;
  phase: 'ready' | 'evolving' | 'complete';
};
export function PokemonProgressDialog({
  id,
  kind: dialog,
  offerId,
  onClose,
}: {
  id: string;
  kind: 'learn' | 'evolve';
  offerId?: string;
  onClose: () => void;
}) {
  const { state, act, busy, toast } = useApp();
  const p = state.pokemon.find((pokemon) => pokemon.id === id);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [declining, setDeclining] = useState(false);
  const [evolution, setEvolution] = useState<EvolutionScene | null>(() =>
    p && dialog === 'evolve' ? { from: p.speciesId, before: p.backing, phase: 'ready' } : null,
  );
  const [revealFrame, setRevealFrame] = useState<RevealFrame>({
    elapsedMs: 0,
    durationMs: 4200,
    progress: 0,
    revealed: false,
  });
  const revealAudio = useRevealAudio();
  // This key changes only for a committed new evolution or a closed dialog. The
  // completion phase deliberately keeps it stable so the reveal fanfare can finish.
  useEffect(() => {
    if (dialog !== 'evolve' || !evolution?.to || evolution.phase !== 'evolving') return;
    const scene = evolution;
    void revealAudio.start('evolve', {
      reducedMotion: state.profile.reducedMotion,
      onFrame: setRevealFrame,
      onReveal: () => setEvolution({ ...scene, phase: 'complete' }),
    });
    return revealAudio.stop;
  }, [
    dialog,
    evolution?.to,
    evolution?.from,
    revealAudio.start,
    revealAudio.stop,
    state.profile.reducedMotion,
  ]);
  if (!p) return null;
  const species = pokemonById(p.speciesId);
  const pending = pendingMove(p);
  const offer = offerId ? availableMoveOffers(p).find((item) => item.id === offerId) : pending;
  const newMove = offer ? moveByName(offer.move) : null;
  const evoStatus = getEvolutionStatus(state, p);
  const closeDialog = () => {
    revealAudio.stop();
    const key =
      dialog === 'evolve'
        ? `evolve:${id}:${evolution?.from ?? p.speciesId}`
        : `move:${id}:${offerId ?? offer?.id}`;
    deferTrainerPrompt(API_BASE, state.profile.wallet, key);
    onClose();
  };
  const startEvolution = async () => {
    if (!evolution || evolution.from !== p.speciesId || busy || p.locked || !evoStatus.canEvolve)
      return;
    revealAudio.unlock('evolve');
    const before = { ...evolution, phase: 'evolving' as const };
    const result = await act({ type: 'pokemon.evolve', id: p.id }),
      changed = result?.pokemon.find((x) => x.id === p.id);
    if (!changed) {
      revealAudio.stop();
      setEvolution({ ...before, phase: 'ready' });
      return;
    }
    const scene = { ...before, to: changed.speciesId, after: changed.backing };
    setRevealFrame({
      elapsedMs: 0,
      durationMs: state.profile.reducedMotion ? 180 : 4200,
      progress: 0,
      revealed: false,
    });
    setEvolution(scene);
  };
  const learn = async () => {
    if (!offer || busy || p.locked || (p.moves.length >= 4 && replaceIndex === null)) return;
    const result = await act({
      type: 'pokemon.learn',
      id: p.id,
      offerId: offer.id,
      ...(p.moves.length >= 4 ? { replaceIndex: replaceIndex ?? 0 } : {}),
    });
    if (result) {
      toast(species.name + ' learned ' + offer.move + '.');
      closeDialog();
    }
  };
  const decline = async () => {
    if (
      !busy &&
      !p.locked &&
      offer &&
      (await act({ type: 'pokemon.declineMove', id: p.id, offerId: offer.id }))
    ) {
      toast(species.name + ' did not learn ' + offer.move + '.');
      closeDialog();
    }
  };
  return (
    <>
      {dialog === 'learn' && offer && newMove && (
        <Modal
          title={declining ? 'Do not learn ' + offer.move + '?' : 'A new move!'}
          onClose={closeDialog}
          closeDisabled={busy}
        >
          <div className="move-decision-dialog">
            <div className="move-decision-title">
              <PokemonArt id={p.speciesId} shiny={p.shiny} />
              <p>
                <strong>{species.name}</strong> wants to learn <strong>{offer.move}</strong>.
              </p>
            </div>
            {declining ? (
              <>
                <p className="move-final-warning">
                  This opportunity will be declined permanently. {species.name} will not be offered
                  this move again.
                </p>
                <div className="modal-actions">
                  <Button variant="secondary" disabled={busy} onClick={() => setDeclining(false)}>
                    Go back
                  </Button>
                  <Button variant="danger" disabled={busy || p.locked} onClick={decline}>
                    Do not learn
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="new-move-record">
                  <div>
                    <h3>{offer.move}</h3>
                    <TypeChip type={newMove.type} />
                  </div>
                  <p>{newMove.description}</p>
                  <dl>
                    <div>
                      <dt>POWER</dt>
                      <dd>{newMove.power ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>ACCURACY</dt>
                      <dd>{newMove.accuracy === null ? '—' : newMove.accuracy + '%'}</dd>
                    </div>
                    <div>
                      <dt>PP</dt>
                      <dd>{newMove.pp}</dd>
                    </div>
                  </dl>
                </div>
                {p.moves.length >= 4 ? (
                  <>
                    <p className="move-forget-label">
                      A Pokémon can only know four moves. Which should it forget?
                    </p>
                    <div className="move-forget-options">
                      {p.moves.map((move, index) => (
                        <button
                          key={move}
                          disabled={busy || p.locked}
                          className={replaceIndex === index ? 'selected' : ''}
                          onClick={() => setReplaceIndex(index)}
                        >
                          <span>{index + 1}</span>
                          <strong>{move}</strong>
                          <span>{replaceIndex === index ? '◀' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="move-forget-label">
                    An empty move slot is available. No move needs to be forgotten.
                  </p>
                )}
                <div className="modal-actions">
                  <Button variant="secondary" disabled={busy} onClick={closeDialog}>
                    Later
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={busy || p.locked}
                    onClick={() => setDeclining(true)}
                  >
                    Do not learn
                  </Button>
                  <Button
                    disabled={busy || p.locked || (p.moves.length >= 4 && replaceIndex === null)}
                    onClick={learn}
                  >
                    Learn {offer.move}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
      {dialog === 'evolve' && evolution && (
        <Modal
          title={
            evolution.phase === 'complete'
              ? 'Evolution complete'
              : evolution.phase === 'evolving'
                ? pokemonById(evolution.from).name + ' is evolving!'
                : 'Evolve ' + pokemonById(evolution.from).name + '?'
          }
          onClose={closeDialog}
          wide
          closeDisabled={busy || evolution.phase === 'evolving'}
        >
          <div
            className={'evolution-sequence ' + evolution.phase}
            data-reveal-synced
            data-reveal-reduced={revealFrame.durationMs === 180 || undefined}
            style={
              {
                '--reveal-elapsed': `-${revealFrame.elapsedMs}ms`,
                '--reveal-duration': `${revealFrame.durationMs}ms`,
              } as CSSProperties
            }
          >
            <div className="evolution-stage">
              <div className="evolution-pixel-grid" />
              <div className="evolution-rays" />
              <div className="evolution-ring one" />
              <div className="evolution-ring two" />
              <div className="evolution-orbit-stars" aria-hidden="true">
                {Array.from({ length: 20 }, (_, i) => (
                  <i
                    key={i}
                    style={{ '--star-i': i, '--star-delay': i * -0.19 + 's' } as CSSProperties}
                  />
                ))}
              </div>
              <div className="evolution-old">
                <PokemonArt id={evolution.from} shiny={p.shiny} animated={false} />
              </div>
              {evolution.to && (
                <div className="evolution-new">
                  <PokemonArt id={evolution.to} shiny={p.shiny} animated={false} />
                </div>
              )}
              <div className="evolution-flash" />
            </div>
            <div className="evolution-dialogue" aria-live="polite">
              {evolution.phase === 'ready' ? (
                <>
                  <p>
                    Use <strong>{evoStatus.candyRequired.toLocaleString()} Rare Candy</strong> to
                    evolve {pokemonById(evolution.from).name}.
                  </p>
                  {evolution.from === 133 && (
                    <p>
                      <strong>Three possible evolutions, each with an equal 1-in-3 chance.</strong>
                    </p>
                  )}
                  <div className="evolution-value-change">
                    <SolValue amount={evolution.before} />
                    <span>→</span>
                    <EvolutionValue preview={p.evolutionPreview} fallback={evoStatus.nextValue} />
                  </div>
                  <div className="modal-actions">
                    <Button variant="secondary" disabled={busy} onClick={closeDialog}>
                      Later
                    </Button>
                    <Button
                      disabled={busy || !evoStatus.canEvolve || evolution.from !== p.speciesId}
                      onClick={startEvolution}
                    >
                      Evolve
                    </Button>
                  </div>
                  {evolution.from !== p.speciesId ? (
                    <p className="notice">
                      This Pokémon has already evolved. Press Later to review its latest evolution.
                    </p>
                  ) : (
                    !evoStatus.canEvolve && <p className="notice">{evoStatus.reason}</p>
                  )}
                </>
              ) : evolution.phase === 'evolving' ? (
                <p>
                  What? <strong>{pokemonById(evolution.from).name}</strong> is evolving!
                </p>
              ) : (
                <>
                  <p>
                    Congratulations! Your <strong>{pokemonById(evolution.from).name}</strong>
                    <br />
                    evolved into <strong>{pokemonById(evolution.to!).name}</strong>!
                  </p>
                  <div className="evolution-value-change">
                    <SolValue amount={evolution.before} />
                    <span>→</span>
                    <SolValue amount={evolution.after!} />
                  </div>
                  <Button onClick={closeDialog}>Continue</Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
