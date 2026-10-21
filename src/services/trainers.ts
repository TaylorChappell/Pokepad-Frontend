import type { AppSnapshot, Profile } from '../types';
import { apiRequest, ApiError } from './http';

export interface PublicPokemon {
  id: string;
  speciesId: number;
  level: number;
  shiny: boolean;
  value: number;
}
export interface PublicTrainer {
  avatarImage?: string | null;
  bannerImage?: string | null;
  bannerPreset?: Profile['bannerPreset'];
  wallet: string;
  displayName: string;
  character: Profile['character'];
  accessoryColor: string;
  partnerId?: string;
  pokemon: PublicPokemon[];
  discovered: number;
  badges: string[];
  supportedGym?: string;
  demo?: boolean;
}

/** Public directory fixtures; these are sample profiles, not on-chain account data. */
export const DEMO_TRAINERS: PublicTrainer[] = [
  {
    wallet: '8Qbz6V9mR3xW2nK7sY5pF4cA1hD9uJ6eT3gN8rB5qZ2',
    displayName: 'Leaf',
    character: 'leaf',
    accessoryColor: '#65b883',
    partnerId: 'leaf-3',
    discovered: 58,
    badges: ['BULB', 'SQUIRT'],
    supportedGym: 'bulb',
    demo: true,
    pokemon: [
      { id: 'leaf-3', speciesId: 3, level: 42, shiny: false, value: 0.34 },
      { id: 'leaf-25', speciesId: 25, level: 27, shiny: true, value: 0.16 },
      { id: 'leaf-36', speciesId: 36, level: 31, shiny: false, value: 0.14 },
      { id: 'leaf-134', speciesId: 134, level: 35, shiny: false, value: 0.26 },
      { id: 'leaf-12', speciesId: 12, level: 26, shiny: false, value: 0.1 },
      { id: 'leaf-144', speciesId: 144, level: 48, shiny: false, value: 1.1 },
    ],
  },
  {
    wallet: '4Hn8rQ2kV6bT9mF3xW5sY7pA1cD8uJ4eR6gN2zB9qK5',
    displayName: 'Blue',
    character: 'blue',
    accessoryColor: '#4e9ee8',
    partnerId: 'blue-9',
    discovered: 74,
    badges: ['SQUIRT', 'CHAR', 'GENG'],
    supportedGym: 'squirt',
    demo: true,
    pokemon: [
      { id: 'blue-9', speciesId: 9, level: 46, shiny: false, value: 0.4 },
      { id: 'blue-65', speciesId: 65, level: 42, shiny: false, value: 0.35 },
      { id: 'blue-149', speciesId: 149, level: 51, shiny: false, value: 0.8 },
      { id: 'blue-94', speciesId: 94, level: 39, shiny: true, value: 0.6 },
      { id: 'blue-130', speciesId: 130, level: 43, shiny: true, value: 0.7 },
      { id: 'blue-59', speciesId: 59, level: 40, shiny: false, value: 0.3 },
    ],
  },
];

export function ownTrainer(state: AppSnapshot, demo = false): PublicTrainer {
  return {
    wallet: state.profile.wallet,
    avatarImage: state.profile.avatarImage,
    bannerImage: state.profile.bannerImage,
    bannerPreset: state.profile.bannerPreset,
    displayName:
      state.profile.displayName ||
      state.profile.wallet.slice(0, 4) + '…' + state.profile.wallet.slice(-4),
    character: state.profile.character,
    accessoryColor: state.profile.accessoryColor,
    partnerId: state.profile.equippedId || undefined,
    pokemon: state.pokemon.map((p) => ({
      id: p.id,
      speciesId: p.speciesId,
      level: p.level,
      shiny: !!p.shiny,
      value: p.backing,
    })),
    discovered: state.discovered.length,
    badges: state.badges,
    supportedGym: state.profile.supportedGym,
    demo,
  };
}

export function matchesTrainer(trainer: PublicTrainer, query: string) {
  const term = query.trim();
  return (
    !term ||
    trainer.wallet.includes(term) ||
    trainer.displayName.toLowerCase().includes(term.toLowerCase())
  );
}

export function searchDemoTrainers(query: string, own?: PublicTrainer) {
  const trainers = own
    ? [own, ...DEMO_TRAINERS.filter((trainer) => trainer.wallet !== own.wallet)]
    : DEMO_TRAINERS;
  return trainers.filter((trainer) => matchesTrainer(trainer, query)).slice(0, 8);
}

function validTrainer(value: unknown): value is PublicTrainer {
  if (!value || typeof value !== 'object') return false;
  const trainer = value as PublicTrainer;
  return (
    typeof trainer.wallet === 'string' &&
    typeof trainer.displayName === 'string' &&
    ['red', 'leaf', 'misty', 'brock', 'blue'].includes(trainer.character) &&
    /^#[\da-f]{6}$/i.test(trainer.accessoryColor) &&
    Number.isFinite(trainer.discovered) &&
    Array.isArray(trainer.badges) &&
    trainer.badges.every((badge) => typeof badge === 'string') &&
    Array.isArray(trainer.pokemon) &&
    trainer.pokemon.every(
      (p) =>
        typeof p.id === 'string' &&
        Number.isInteger(p.speciesId) &&
        p.speciesId >= 1 &&
        p.speciesId <= 151 &&
        Number.isFinite(p.level) &&
        p.level >= 1 &&
        p.level <= 100 &&
        Number.isFinite(p.value) &&
        p.value >= 0,
    )
  );
}

/** Railway contract: GET /v1/trainers?query=... -> {trainers}; GET /v1/trainers/:wallet -> {trainer}. */
export function createTrainerDirectory(base?: string) {
  async function request(path: string, signal?: AbortSignal): Promise<unknown> {
    try {
      return await apiRequest('/v1/trainers' + path, { base, signal, timeoutMs: 12000 });
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return null;
      if (error instanceof ApiError)
        throw new Error('Trainer search is unavailable. Try again shortly.');
      throw error;
    }
  }
  return {
    mode: base ? ('live' as const) : ('demo' as const),
    async search(
      query: string,
      own?: PublicTrainer,
      signal?: AbortSignal,
    ): Promise<PublicTrainer[]> {
      if (!base) return searchDemoTrainers(query, own);
      const local = own && matchesTrainer(own, query) ? [own] : [];
      if (query.trim().length < 2) return local;
      const data = (await request('?query=' + encodeURIComponent(query.trim()), signal)) as {
        trainers?: unknown[];
      } | null;
      if (!data || !Array.isArray(data.trainers) || !data.trainers.every(validTrainer))
        throw new Error('Trainer search returned an unexpected response.');
      return [...local, ...data.trainers.filter((t) => t.wallet !== own?.wallet)].slice(0, 8);
    },
    async get(
      wallet: string,
      own?: PublicTrainer,
      signal?: AbortSignal,
    ): Promise<PublicTrainer | null> {
      if (own?.wallet === wallet) return own;
      if (!base) return DEMO_TRAINERS.find((trainer) => trainer.wallet === wallet) || null;
      const data = (await request('/' + encodeURIComponent(wallet), signal)) as {
        trainer?: unknown;
      } | null;
      if (!data) return null;
      if (!validTrainer(data.trainer) || data.trainer.wallet !== wallet)
        throw new Error('This trainer profile could not be loaded.');
      return data.trainer;
    },
  };
}

export const trainerDirectory = createTrainerDirectory(import.meta.env?.VITE_API_BASE_URL);
