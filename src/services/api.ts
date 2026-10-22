import { normalizeDemoRecovery } from '../state/recovery';
import { promptStorageKey } from '../state/trainer-prompts';
import type { Action, AppSnapshot, OwnedPokemon, Reward, Profile } from '../types';
import { COINS, createInitialState } from '../data/demo';
import {
  applyAction,
  assertSupportedAction,
  evolutionValueIncrease,
  STORAGE_KEY,
} from '../state/model';
import { decorateDemoCoins } from '../data/coin-presentation';
import {
  variantDiscoveries,
  demoPokemonCatalogue,
  recordVariantDiscovery,
} from '../state/collection';
import { apiRequest } from './http';
export interface KantoApi {
  mode: 'demo' | 'live';
  load(): Promise<AppSnapshot>;
  dispatch(action: Action): Promise<AppSnapshot>;
}
export function migrateSnapshot(input: unknown, now = Date.now()): AppSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Record<string, unknown>;
  if (![1, 2].includes(Number(raw.version)) || !raw.profile || typeof raw.profile !== 'object')
    return null;
  if (
    ![
      'coins',
      'pokemon',
      'rewards',
      'discovered',
      'notifications',
      'activity',
      'badges',
      'createdCoins',
    ].every((field) => Array.isArray(raw[field]))
  )
    return null;
  const s = structuredClone(raw) as unknown as AppSnapshot;
  if (typeof s.profile.wallet !== 'string' || typeof s.profile.displayName !== 'string')
    return null;
  const nonNegative = (value: unknown) =>
    typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0;
  s.bag ||= { berry: 3, revive: 1, potion: 2 };
  s.gymProgress ||= { badges: 0, points: 0, wins: 0, manuals: {}, claimedToday: [] };
  if (Array.isArray(s.gymProgress.manuals)) {
    s.gymProgress.manuals = Object.fromEntries(s.gymProgress.manuals.map((m: string) => [m, 1]));
    s.gymProgress.badges = s.gymProgress.wins;
  }
  s.gymProgress.badges ??= s.gymProgress.wins;
  s.version = 2;
  s.profile.artStyle = (s.profile as Profile).artStyle === 'drawn' ? 'drawn' : 'pixel';
  s.pokemon = s.pokemon.map((item) => {
    const p = item as OwnedPokemon & { stardust?: number };
    p.rareCandy = nonNegative(p.rareCandy ?? p.stardust);
    delete p.stardust;
    // Marketplace retirement releases every legacy listing without touching its funded value.
    delete p.listed;
    // Legacy saves did not fund evolution. A zero reserve must be topped up by an actual vault debit.
    p.evolutionReserve = nonNegative(p.evolutionReserve);
    p.moveOffers = Array.isArray(p.moveOffers) ? p.moveOffers : [];
    // Old reward tiers are not variants: never turn a legacy "Rare" Pokémon into a shiny
    // or re-price existing owned assets. Missing variants become normal, at their funded value.
    p.shiny = p.shiny === true;
    p.favourite = p.favourite === true;
    p.rarity = '';
    const evoCost = evolutionValueIncrease(p);
    if (evoCost > p.evolutionReserve)
      p.rareCandy = Math.min(p.rareCandy, Math.floor((p.evolutionReserve / evoCost) * 1000));
    delete p.baseMoves;
    delete p.gymManual;
    normalizeDemoRecovery(p, now);
    return p;
  });
  s.discoveredVariants = variantDiscoveries(s);
  // Older local reveals can prove an exact variant; species-only history cannot.
  for (const reward of s.rewards)
    if (reward.openedAt && reward.outcomeSpeciesId && typeof reward.shiny === 'boolean')
      recordVariantDiscovery(s, reward.outcomeSpeciesId, reward.shiny);
  for (const event of s.activity)
    if (
      event.pokemonId &&
      typeof event.shiny === 'boolean' &&
      ['reward', 'egg', 'pack', 'evolve'].includes(event.kind)
    )
      recordVariantDiscovery(s, event.pokemonId, event.shiny);
  s.pokemonCatalogue = demoPokemonCatalogue();
  s.rewards = s.rewards.map((r: Reward) => {
    const reward = { ...r, evolutionReserve: nonNegative(r.evolutionReserve) };
    if (reward.kind === 'egg' && !reward.openedAt) {
      const max = reward.tier === 'Epic' ? 14400000 : reward.tier === 'Rare' ? 3600000 : 1200000;
      reward.initialDuration = Math.min(reward.initialDuration, max);
      reward.readyAt = Math.min(reward.readyAt, reward.awardedAt + max);
    }
    // Local demo rewards now draw on opening. Keep their exact prior allocation until then.
    if (!reward.openedAt) {
      delete reward.outcomeSpeciesId;
      delete reward.shiny;
    } else if (typeof reward.shiny !== 'boolean') delete reward.shiny;
    return reward;
  });
  const currentCopy = (value: string) =>
    value
      .replace(/stardust/gi, 'Rare Candy')
      .replace(/\bPok[eé]pad\b/gi, 'Kanto')
      .replace(/\$POKE\b/g, '$KANTO')
      .replace(/\bTeam POKE\b/g, 'Team KANTO');
  s.notifications = s.notifications.map((n) => ({
    ...n,
    title: currentCopy(n.title),
    description: currentCopy(n.description),
    href: n.href.startsWith('/marketplace') ? '/pokemon' : n.href,
  }));
  s.activity = s.activity.map((a) => ({
    ...a,
    title: currentCopy(a.title),
    detail: currentCopy(a.detail),
    href: a.href.startsWith('/marketplace') ? '/pokemon' : a.href,
  }));
  return s;
}
const readLocal = (): AppSnapshot => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = migrateSnapshot(JSON.parse(raw));
      if (migrated)
        return {
          ...migrated,
          coins: decorateDemoCoins(
            migrated.coins.map((coin) => {
              // Only known local demo fixtures get demo creator identities; never guess live creators.
              const fixture = COINS.find((item) => item.id === coin.id && item.ca === coin.ca);
              return fixture
                ? {
                    ...coin,
                    ...(fixture.main
                      ? {
                          name: fixture.name,
                          ticker: fixture.ticker,
                          description: fixture.description,
                        }
                      : {}),
                    creatorWallet: coin.creatorWallet || fixture.creatorWallet,
                    creatorName: coin.creatorName || fixture.creatorName,
                  }
                : coin;
            }),
          ),
        };
    }
  } catch {
    /* Recover from corrupt or inaccessible local storage. */
  }
  return createInitialState();
};
let memory: AppSnapshot | undefined;
export const demoApi: KantoApi = {
  mode: 'demo',
  async load() {
    memory = readLocal();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
    } catch {
      /* Persistence is optional. */
    }
    return structuredClone(memory);
  },
  async dispatch(action) {
    const next = applyAction(memory || readLocal(), action);
    memory = next;
    if (action.type === 'demo.reset') {
      try {
        localStorage.removeItem(promptStorageKey('', next.profile.wallet));
      } catch {
        /* Queue still resets in memory. */
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* The frontend remains usable if browser persistence is unavailable. */
    }
    return structuredClone(next);
  },
};
export function createHttpApi(base: string): KantoApi {
  async function request(path: string, body?: unknown): Promise<AppSnapshot> {
    const data = await apiRequest<AppSnapshot>('/v1' + path, {
      base,
      method: body ? 'POST' : 'GET',
      ...(body ? { json: body, headers: { 'Idempotency-Key': crypto.randomUUID() } } : {}),
    });
    if (!data?.profile || !Array.isArray(data?.coins) || !Array.isArray(data?.pokemon))
      throw new Error('The API returned an unexpected response.');
    return data;
  }
  return {
    mode: 'live',
    load: () => request('/bootstrap'),
    dispatch: async (action) => {
      assertSupportedAction(action);
      if (action.type === 'gym.demo.finish')
        throw new Error('Gym victories are verified by the battle server.');
      if (action.type === 'walk.progress')
        throw new Error('Start a walking session on your phone to record progress.');
      if (action.type === 'coin.create')
        throw new Error('Live coins require a signed launch transaction.');
      return request('/actions', action);
    },
  };
}
export const api: KantoApi = import.meta.env?.VITE_API_BASE_URL
  ? createHttpApi(import.meta.env?.VITE_API_BASE_URL)
  : demoApi;
