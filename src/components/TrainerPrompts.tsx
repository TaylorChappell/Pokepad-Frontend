import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { API_BASE } from '../services/http';
import { availableMoveOffers } from '../state/model';
import {
  PROMPT_DEFERRED_EVENT,
  promptStorageKey,
  readDeferredPrompts,
  readyTrainerPrompts,
  type TrainerPrompt,
} from '../state/trainer-prompts';
import { StarterChoice } from '../pages/Account';
import { PokemonProgressDialog } from './PokemonProgressDialog';
import { Modal } from './UI';

export function TrainerPrompts() {
  const { state, session, mode } = useApp();
  if (mode === 'demo')
    return state.demoPromptEpoch ? (
      <AccountPrompts
        key={state.profile.wallet + ':' + state.demoPromptEpoch}
        wallet={state.profile.wallet}
      />
    ) : null;
  // A stale snapshot from another wallet can never open a private prompt.
  if (
    mode !== 'live' ||
    session.status !== 'authenticated' ||
    !session.wallet ||
    state.profile.wallet !== session.wallet
  )
    return null;
  return <AccountPrompts key={session.wallet} wallet={session.wallet} />;
}
function AccountPrompts({ wallet }: { wallet: string }) {
  const { state, busy } = useApp();
  const root = useRef<HTMLDivElement>(null);
  const storageKey = promptStorageKey(API_BASE, wallet);
  const [deferred, setDeferred] = useState(() => {
    try {
      return readDeferredPrompts(window.localStorage, storageKey);
    } catch {
      return new Set<string>();
    }
  });
  const [starterRequired, setStarterRequired] = useState(
    state.starterEligibility?.canChoose === true,
  );
  const [active, setActive] = useState<TrainerPrompt | null>(null);
  const [blocked, setBlocked] = useState(true);

  useEffect(() => {
    const deferredInPage = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey: string; prompt: string }>).detail;
      if (detail?.storageKey === storageKey)
        setDeferred((previous) => new Set(previous).add(detail.prompt));
    };
    const deferredInAnotherTab = (event: StorageEvent) => {
      if (event.key === storageKey)
        setDeferred(readDeferredPrompts(window.localStorage, storageKey));
    };
    window.addEventListener(PROMPT_DEFERRED_EVENT, deferredInPage);
    window.addEventListener('storage', deferredInAnotherTab);
    return () => {
      window.removeEventListener(PROMPT_DEFERRED_EVENT, deferredInPage);
      window.removeEventListener('storage', deferredInAnotherTab);
    };
  }, [storageKey]);

  useEffect(() => {
    const inspect = () =>
      setBlocked(
        document.visibilityState === 'hidden' ||
          Boolean(document.querySelector('.classic-match, .classic-team-screen')) ||
          [...document.querySelectorAll('[role="dialog"]')].some(
            (dialog) => !root.current?.contains(dialog),
          ),
      );
    const observer = new MutationObserver(inspect);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('visibilitychange', inspect);
    inspect();
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', inspect);
    };
  }, []);
  useEffect(() => {
    if (state.starterEligibility?.canChoose) setStarterRequired(true);
  }, [state.starterEligibility?.canChoose]);
  const showStarter = starterRequired && !state.profile.starterChosen;
  useEffect(() => {
    if (blocked || busy || showStarter || active) return;
    const next = readyTrainerPrompts(state).find((prompt) => !deferred.has(prompt.key));
    if (next) setActive(next);
  }, [state, deferred, busy, blocked, showStarter, active]);

  // Ownership can change on another device. Never leave an empty, undismissable prompt.
  useEffect(() => {
    if (!active || busy) return;
    const pokemon = state.pokemon.find((pokemon) => pokemon.id === active.pokemonId);
    if (
      !pokemon ||
      (active.kind === 'learn' &&
        !availableMoveOffers(pokemon).some((offer) => offer.id === active.offerId))
    )
      setActive(null);
  }, [state.pokemon, active, busy]);
  const later = () => {
    if (!active) return;
    const next = new Set(deferred).add(active.key);
    setDeferred(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      /* Keep the acknowledgement for this session. */
    }
    setActive(null);
  };
  return (
    <div ref={root} className="trainer-prompts">
      {showStarter && !blocked ? (
        <Modal title="Choose your first Pokémon" onClose={() => {}} dismissible={false} wide>
          <div className="starter-welcome">
            <p className="starter-welcome-copy">
              Your first partner is waiting. Choose one to join your team.
            </p>
            <StarterChoice />
          </div>
        </Modal>
      ) : !showStarter && active ? (
        <PokemonProgressDialog
          key={active.key}
          id={active.pokemonId}
          kind={active.kind}
          offerId={active.offerId}
          onClose={later}
        />
      ) : null}
    </div>
  );
}
