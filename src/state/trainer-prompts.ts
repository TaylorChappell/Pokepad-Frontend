import type { AppSnapshot } from '../types';
import { availableMoveOffers, getEvolutionStatus } from './model';

export interface TrainerPrompt {
  key: string;
  pokemonId: string;
  kind: 'learn' | 'evolve';
  offerId?: string;
}
export function readyTrainerPrompts(state: AppSnapshot): TrainerPrompt[] {
  const prompts: TrainerPrompt[] = [];
  for (const pokemon of state.pokemon) {
    if (pokemon.locked) continue;
    for (const offer of availableMoveOffers(pokemon)) {
      prompts.push({
        key: `move:${pokemon.id}:${offer.id}`,
        pokemonId: pokemon.id,
        kind: 'learn',
        offerId: offer.id,
      });
    }
    if (state.profile.evolutionNotifications && getEvolutionStatus(state, pokemon).canEvolve) {
      prompts.push({
        key: `evolve:${pokemon.id}:${pokemon.speciesId}`,
        pokemonId: pokemon.id,
        kind: 'evolve',
      });
    }
  }
  return prompts;
}
export function promptStorageKey(apiBase: string, wallet: string) {
  return `kanto.trainer-prompts.v1:${apiBase}:${wallet}`;
}
export function readDeferredPrompts(
  storage: Pick<Storage, 'getItem'> | undefined,
  key: string,
): Set<string> {
  try {
    const saved: unknown = JSON.parse(storage?.getItem(key) || '[]');
    return new Set(
      Array.isArray(saved)
        ? saved.filter((value): value is string => typeof value === 'string')
        : [],
    );
  } catch {
    return new Set();
  }
}

export const PROMPT_DEFERRED_EVENT = 'kanto:prompt-deferred';
export function deferTrainerPrompt(apiBase: string, wallet: string, prompt: string) {
  const storageKey = promptStorageKey(apiBase, wallet);
  try {
    const deferred = readDeferredPrompts(window.localStorage, storageKey).add(prompt);
    window.localStorage.setItem(storageKey, JSON.stringify([...deferred]));
  } catch {
    /* The event also preserves the decision in the mounted queue. */
  }
  window.dispatchEvent(
    new window.CustomEvent(PROMPT_DEFERRED_EVENT, { detail: { storageKey, prompt } }),
  );
}
