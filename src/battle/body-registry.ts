import { asset } from '../utils';
import {
  PMD_CATALOGUE,
  normalizeBodyManifest,
  type BodyManifest,
  type PmdManifest,
  type PmdCatalogueEntry,
} from './body-animation';

export interface BodyAssetState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  manifest?: BodyManifest;
  error?: string;
}
export interface BodyAssetSpec {
  speciesId: number;
  shiny?: boolean;
}
export interface BodyAssetDependencies {
  fetchManifest: (url: string) => Promise<unknown>;
  decodeImage: (url: string) => Promise<void>;
}
const EMPTY: BodyAssetState = Object.freeze({ status: 'idle' });

async function fetchManifest(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('Animation metadata could not load. Please try again.');
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function decodeImage(url: string): Promise<void> {
  if (typeof Image === 'undefined') return;
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      error ? reject(error) : resolve();
    };
    const failed = () => finish(new Error('Pokémon sprites could not load. Please try again.'));
    const timer = setTimeout(failed, 15000);
    image.onerror = failed;
    image.onload = () => {
      if (typeof image.decode !== 'function') finish();
    };
    image.src = url;
    if (typeof image.decode === 'function') image.decode().then(() => finish(), failed);
    else if (image.complete && image.naturalWidth > 0) finish();
  });
}

/** One cache per species; failed requests are evicted so the visible Retry action works. */
export function createBodyAssetStore(
  dependencies: BodyAssetDependencies = { fetchManifest, decodeImage },
  catalogue: Record<string, PmdCatalogueEntry> = PMD_CATALOGUE,
) {
  const states = new Map<number, BodyAssetState>();
  const pending = new Map<number, Promise<BodyManifest>>();
  const images = new Map<string, Promise<void>>();
  const listeners = new Map<number, Set<() => void>>();
  const update = (id: number, state: BodyAssetState) => {
    states.set(id, state);
    listeners.get(id)?.forEach((listener) => listener());
  };
  const getState = (id: number) => states.get(id) || EMPTY;
  const subscribe = (id: number, listener: () => void) => {
    let group = listeners.get(id);
    if (!group) listeners.set(id, (group = new Set()));
    group.add(listener);
    return () => {
      group!.delete(listener);
      if (!group!.size) listeners.delete(id);
    };
  };
  const load = (id: number): Promise<BodyManifest> => {
    const state = getState(id);
    if (state.manifest) return Promise.resolve(state.manifest);
    const existing = pending.get(id);
    if (existing) return existing;
    const entry = catalogue[String(id)];
    if (!entry) return Promise.reject(new Error(`Pokémon ${id} has no animation assets.`));
    update(id, { status: 'loading' });
    const request = dependencies
      .fetchManifest(asset(entry.manifest))
      .then((raw) => {
        const manifest = normalizeBodyManifest(raw as PmdManifest, entry);
        update(id, { status: 'ready', manifest });
        return manifest;
      })
      .catch((error) => {
        update(id, {
          status: 'error',
          error: error instanceof Error ? error.message : 'Pokémon animation could not load.',
        });
        throw error;
      })
      .finally(() => {
        pending.delete(id);
      });
    pending.set(id, request);
    return request;
  };
  const preload = async (specs: readonly BodyAssetSpec[]) => {
    const ids = [...new Set(specs.map((spec) => spec.speciesId))];
    await Promise.all(
      ids.map(async (id) => {
        const manifest = await load(id);
        await Promise.all(
          manifest.sheets.map((sheet) => {
            const url = asset(sheet.src);
            const cached = images.get(url);
            if (cached) return cached;
            const request = dependencies
              .decodeImage(url)
              .catch((error) => {
                images.delete(url);
                update(id, {
                  status: 'error',
                  manifest,
                  error: error instanceof Error ? error.message : 'Pokémon sprites could not load.',
                });
                throw error;
              })
              .then(() => {
                update(id, { status: 'ready', manifest });
              });
            images.set(url, request);
            return request;
          }),
        );
      }),
    );
  };
  return { getState, subscribe, load, preload };
}

const store = createBodyAssetStore();
export const getBodyAssetState = store.getState;
export const subscribeBodyAsset = store.subscribe;
export const loadBodyManifest = store.load;
export const preloadBattleBodies = store.preload;
