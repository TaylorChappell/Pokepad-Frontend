import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { asset } from '../utils';
import { REVEAL_SOUNDS, type SoundLayer, type RevealKind, type RevealPhase } from './catalog';
import { runRevealTimeline, type RevealFrame, type RevealClock } from './reveal-timeline';

const MUTE_KEY = 'kanto-audio-muted';
const LEGACY_MUTE_KEY = 'pokepad-battle-muted';
const PREFERENCE_EVENT = 'kanto-audio-preference';

export function soundIsMuted() {
  try {
    return (localStorage.getItem(MUTE_KEY) ?? localStorage.getItem(LEGACY_MUTE_KEY)) === 'true';
  } catch {
    return false;
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(PREFERENCE_EVENT, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(PREFERENCE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}
let sessionMuted: boolean | undefined;
const getMuted = () => sessionMuted ?? soundIsMuted();
export function useSoundPreference() {
  const muted = useSyncExternalStore(subscribe, getMuted, () => true);
  const toggleMuted = useCallback(() => {
    const next = !getMuted();
    try {
      localStorage.setItem(MUTE_KEY, String(next));
      sessionMuted = undefined;
    } catch {
      sessionMuted = next;
    }
    window.dispatchEvent(new window.Event(PREFERENCE_EVENT));
  }, []);
  return { muted, toggleMuted };
}

/** One cancellable group of decoded, local sample players. No audio exists before unlock(). */
export function useSoundEffects(active = true) {
  const { muted, toggleMuted } = useSoundPreference();
  const context = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const sources = useRef(new Set<AudioBufferSourceNode>());
  const buffers = useRef(new Map<string, Promise<AudioBuffer | null>>());
  const unlocked = useRef(false);
  const generation = useRef(0);
  const mounted = useRef(true);
  const activeRef = useRef(active);
  activeRef.current = active;

  const stop = useCallback(() => {
    generation.current += 1;
    for (const source of sources.current) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
    }
    sources.current.clear();
  }, []);

  const ensureContext = useCallback(() => {
    if (!mounted.current || getMuted()) return null;
    if (context.current?.state === 'closed') context.current = null;
    if (!context.current) {
      const Constructor =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Constructor) return null;
      try {
        context.current = new Constructor();
        master.current = context.current.createGain();
        master.current.gain.value = 0.48;
        master.current.connect(context.current.destination);
      } catch {
        return null;
      }
    }
    if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
    return context.current;
  }, []);

  const load = useCallback((file: string, ctx: AudioContext) => {
    const existing = buffers.current.get(file);
    if (existing) return existing;
    const pending = fetch(asset(`audio/effects/${file}.mp3`))
      .then((response) =>
        response.ok ? response.arrayBuffer() : Promise.reject(new Error('Audio unavailable')),
      )
      .then((bytes) => ctx.decodeAudioData(bytes))
      .catch(() => {
        buffers.current.delete(file); // A later user gesture can retry transient loading failures.
        return null;
      });
    buffers.current.set(file, pending);
    return pending;
  }, []);

  const unlock = useCallback(
    (preload: readonly SoundLayer[] = []) => {
      unlocked.current = true;
      const ctx = ensureContext();
      if (ctx) for (const layer of preload) void load(layer.file, ctx);
    },
    [ensureContext, load],
  );

  const prepare = useCallback(
    async (layers: readonly SoundLayer[]) => {
      if (!unlocked.current || getMuted()) return false;
      const ctx = ensureContext();
      if (!ctx) return false;
      const loaded = await Promise.all(layers.map((layer) => load(layer.file, ctx)));
      return mounted.current && ctx.state === 'running' && loaded.every(Boolean);
    },
    [ensureContext, load],
  );

  const play = useCallback(
    (layers: readonly SoundLayer[]) => {
      if (!unlocked.current || getMuted() || !activeRef.current || document.hidden) return;
      const ctx = ensureContext();
      if (!ctx) return;
      const token = generation.current;
      const requestedAt = ctx.currentTime;
      for (const layer of layers) {
        void load(layer.file, ctx).then((buffer) => {
          if (
            !buffer ||
            !mounted.current ||
            generation.current !== token ||
            getMuted() ||
            !activeRef.current ||
            document.hidden ||
            ctx.state !== 'running' ||
            !master.current
          )
            return;
          // Never play a late attack over the following turn. Preloading normally makes this zero.
          if (ctx.currentTime - requestedAt > 0.45) return;
          const source = ctx.createBufferSource();
          const envelope = ctx.createGain();
          const at = Math.max(ctx.currentTime, requestedAt + (layer.delay ?? 0));
          const offset = Math.max(0, layer.offset ?? 0);
          const length = Math.min(
            Math.max(0, buffer.duration - offset),
            layer.duration ?? buffer.duration,
          );
          if (!length) return;
          source.buffer = buffer;
          const volume = layer.volume ?? 0.8;
          envelope.gain.setValueAtTime(volume, at);
          envelope.gain.setValueAtTime(volume, at + Math.max(0, length - 0.045));
          envelope.gain.linearRampToValueAtTime(0, at + length);
          source.connect(envelope);
          envelope.connect(master.current);
          sources.current.add(source);
          source.onended = () => {
            sources.current.delete(source);
            source.disconnect();
            envelope.disconnect();
          };
          source.start(at, offset);
          source.stop(at + length);
        });
      }
    },
    [ensureContext, load],
  );

  useEffect(() => {
    if (muted || !active) stop();
  }, [muted, active, stop]);
  useEffect(() => {
    mounted.current = true;
    const visibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', visibility);
      stop();
      if (context.current && context.current.state !== 'closed')
        void context.current.close().catch(() => {});
      context.current = null;
      master.current = null;
      buffers.current.clear();
    };
  }, [stop]);
  return { muted, toggleMuted, unlock, prepare, play, stop };
}

export interface RevealStartOptions {
  reducedMotion?: boolean;
  canReveal?(): boolean;
  onFrame(frame: RevealFrame): void;
  onReveal(): void;
  /** Injectable clock for deterministic timing tests. */
  clock?: RevealClock;
}

/** Unlock on the initiating gesture. Start only after the result and its scene are mounted. */
export function useRevealAudio() {
  const {
    unlock: unlockEffects,
    prepare,
    play: playEffects,
    stop: stopEffects,
    muted,
    toggleMuted,
  } = useSoundEffects();
  const sequence = useRef<ReturnType<typeof runRevealTimeline> | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const silent = useRef(false);
  const cancelPreparation = useRef<(() => void) | null>(null);
  const stop = useCallback(() => {
    generation.current += 1;
    cancelPreparation.current?.();
    cancelPreparation.current = null;
    sequence.current?.cancel();
    sequence.current = null;
    stopEffects();
  }, [stopEffects]);
  const unlock = useCallback(
    (kind?: RevealKind) => {
      const phases = kind ? [REVEAL_SOUNDS[kind]] : Object.values(REVEAL_SOUNDS);
      unlockEffects(phases.flatMap((value) => Object.values(value).flat()));
    },
    [unlockEffects],
  );
  const play = useCallback(
    (kind: RevealKind, phase: RevealPhase) => {
      stop();
      playEffects(REVEAL_SOUNDS[kind][phase]);
    },
    [playEffects, stop],
  );
  const start = useCallback(
    async (kind: RevealKind, options: RevealStartOptions) => {
      stop();
      const token = generation.current;
      silent.current = getMuted();
      const layers = Object.values(REVEAL_SOUNDS[kind]).flat();
      // Decode before the first frame so downloads cannot make a crack arrive after its visual.
      // A slow/unavailable audio device never blocks the owned reward: continue the scene silently.
      const ready = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          cancelPreparation.current = null;
          resolve(ok);
        };
        const timeout = window.setTimeout(() => finish(false), 1200);
        cancelPreparation.current = () => finish(false);
        void prepare(layers).then(finish, () => finish(false));
      });
      if (!mounted.current || generation.current !== token) return false;
      const reducedMotion =
        options.reducedMotion ||
        (typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      sequence.current = runRevealTimeline(
        kind,
        {
          reducedMotion,
          canReveal: options.canReveal,
          onFrame: options.onFrame,
          onReveal: options.onReveal,
          onSound: (cue) => {
            if (ready && !silent.current && generation.current === token) playEffects(cue);
          },
        },
        options.clock,
      );
      if (document.hidden) sequence.current.finishSilently();
      return true;
    },
    [prepare, playEffects, stop],
  );
  useEffect(() => {
    // Muting cancels every remaining cue in this reveal. Unmuting cannot replay an old cue.
    if (muted) {
      silent.current = true;
      stopEffects();
    }
  }, [muted, stopEffects]);
  useEffect(() => {
    mounted.current = true;
    const visibility = () => {
      if (!document.hidden) return;
      silent.current = true;
      stopEffects();
      sequence.current?.finishSilently();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', visibility);
      stop();
    };
  }, [stop, stopEffects]);
  return { unlock, start, play, stop, muted, toggleMuted };
}
