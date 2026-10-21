import type { Action, AppSnapshot, OwnedPokemon, Reward, Profile } from '../types';
import { COINS, createInitialState } from '../data/demo';
import { applyAction, assertSupportedAction, STORAGE_KEY } from '../state/model';
import { getPokemonHealth } from '../data/stats';
import { decorateDemoCoins } from '../data/coin-presentation';
export interface KantoApi {
  mode: 'demo' | 'live';
  load(): Promise<AppSnapshot>;
  dispatch(action: Action): Promise<AppSnapshot>;
}
export function migrateSnapshot(input: unknown): AppSnapshot | null {
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
    p.rarity = '';
    p.health = getPokemonHealth(p).current;
    return p;
  });
  s.rewards = s.rewards.map((r: Reward) => {
    const reward = { ...r, evolutionReserve: nonNegative(r.evolutionReserve) };
    // Local demo rewards now draw on opening. Keep their exact prior allocation until then.
    if (!reward.openedAt) {
      delete reward.outcomeSpeciesId;
      delete reward.shiny;
    } else reward.shiny = reward.shiny === true;
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* The frontend remains usable if browser persistence is unavailable. */
    }
    return structuredClone(next);
  },
};
export function createHttpApi(base: string): KantoApi {
  const root = base.replace(/\/$/, '');
  async function request(path: string, body?: unknown): Promise<AppSnapshot> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(root + '/v1' + path, {
        method: body ? 'POST' : 'GET',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body
            ? { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!response.ok) {
        const problem = await response.json().catch(() => null);
        throw new Error(
          problem?.message || 'The server could not complete that request. Please try again.',
        );
      }
      const data = await response.json();
      if (!data?.profile || !Array.isArray(data?.coins))
        throw new Error('The API returned an unexpected response.');
      return data as AppSnapshot;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError')
        throw new Error('The server took too long to respond. Please try again.');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return {
    mode: 'live',
    load: () => request('/bootstrap'),
    dispatch: async (action) => {
      assertSupportedAction(action);
      return request('/actions', action);
    },
  };
}
export const api: KantoApi = import.meta.env?.VITE_API_BASE_URL
  ? createHttpApi(import.meta.env?.VITE_API_BASE_URL)
  : demoApi;
