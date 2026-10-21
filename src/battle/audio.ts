import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../utils';
import { getMovePresentation } from './presentation';

const MUTE_KEY = 'pokepad-battle-muted';
const MUSIC_VOLUME = 0.24;
export type BattleSoundCue = 'select' | 'switch' | 'faint' | 'win' | 'lose';

function initialMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Music starts only from a battle button gesture. Leaving the battle stops every audio source. */
export function useBattleAudio(active: boolean) {
  const [muted, setMuted] = useState(initialMuted);
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const mutedRef = useRef(muted);
  const activeRef = useRef(active);
  const unlocked = useRef(false);
  const mounted = useRef(true);
  const music = useRef<HTMLAudioElement | null>(null);
  const context = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const sources = useRef(new Set<AudioScheduledSourceNode>());
  activeRef.current = active;
  mutedRef.current = muted;

  const ensureContext = useCallback(() => {
    if (context.current?.state === 'closed') context.current = null;
    if (!context.current) {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      try {
        context.current = new AudioContextClass();
        master.current = context.current.createGain();
        master.current.gain.value = mutedRef.current ? 0 : 0.16;
        master.current.connect(context.current.destination);
      } catch {
        return null;
      }
    }
    if (context.current.state === 'suspended') void context.current.resume().catch(() => {});
    return context.current;
  }, []);

  const ensureMusic = useCallback(() => {
    if (!music.current && typeof Audio !== 'undefined') {
      const audio = new Audio();
      // Avoid starting unsupported media (including DOM-only test environments).
      if (!audio.canPlayType('audio/mpeg')) return null;
      audio.preload = 'none';
      audio.src = asset('battle/audio/kanto-trainer.mp3');
      audio.loop = true;
      audio.volume = MUSIC_VOLUME;
      // The original intro plays once, then loop the battle section before its fade-out.
      // Loop points match Pokémon Showdown's HGSS Kanto trainer recording.
      audio.addEventListener('timeupdate', () => {
        if (audio.currentTime >= 94.656) audio.currentTime = 13.003 + (audio.currentTime - 94.656);
      });
      audio.addEventListener('error', () => {
        if (mounted.current) setMusicUnavailable(true);
      });
      music.current = audio;
    }
    return music.current;
  }, []);

  const playMusic = useCallback(() => {
    if (mutedRef.current || !unlocked.current || document.hidden) return;
    const audio = ensureMusic();
    if (!audio) return;
    audio.muted = false;
    void audio.play().catch(() => {
      // A browser may require another gesture after returning from background.
      // The sound button can retry; do not falsely mark an autoplay block as a missing file.
    });
  }, [ensureMusic]);

  const unlock = useCallback(() => {
    unlocked.current = true;
    if (!mutedRef.current) {
      ensureContext();
      playMusic();
    }
  }, [ensureContext, playMusic]);

  const stopEffects = useCallback(() => {
    for (const source of sources.current) {
      try {
        source.stop();
      } catch {
        // An already-ended oscillator needs no further cleanup.
      }
    }
    sources.current.clear();
  }, []);

  const tone = useCallback(
    (
      frequency: number,
      end: number,
      length: number,
      delay = 0,
      waveform: OscillatorType = 'square',
      volume = 0.6,
    ) => {
      const ctx = context.current;
      if (!ctx || !master.current || mutedRef.current || ctx.state !== 'running') return;
      const at = ctx.currentTime + delay;
      const oscillator = ctx.createOscillator();
      const envelope = ctx.createGain();
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), at);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + length);
      envelope.gain.setValueAtTime(0.001, at);
      envelope.gain.exponentialRampToValueAtTime(volume, at + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.001, at + length);
      oscillator.connect(envelope);
      envelope.connect(master.current);
      sources.current.add(oscillator);
      oscillator.onended = () => {
        sources.current.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(at);
      oscillator.stop(at + length + 0.02);
    },
    [],
  );

  const noise = useCallback(
    (length: number, frequency: number, end: number, delay = 0, seed = 17) => {
      const ctx = context.current;
      if (!ctx || !master.current || mutedRef.current || ctx.state !== 'running') return;
      const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
      const samples = buffer.getChannelData(0);
      let random = seed;
      for (let i = 0; i < samples.length; i++) {
        random = (random * 1664525 + 1013904223) >>> 0;
        samples[i] = (random / 4294967296) * 2 - 1;
      }
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      const at = ctx.currentTime + delay;
      source.buffer = buffer;
      filter.type = 'bandpass';
      filter.Q.value = 0.6;
      filter.frequency.setValueAtTime(frequency, at);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, end), at + length);
      envelope.gain.setValueAtTime(0.001, at);
      envelope.gain.exponentialRampToValueAtTime(0.9, at + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.001, at + length);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(master.current);
      sources.current.add(source);
      source.onended = () => {
        sources.current.delete(source);
        source.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
      source.start(at);
      source.stop(at + length + 0.02);
    },
    [],
  );

  const playMove = useCallback(
    (moveName: string) => {
      if (!unlocked.current || mutedRef.current || !activeRef.current || document.hidden) return;
      ensureContext();
      const { family } = getMovePresentation(moveName);
      const seed = [...moveName].reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const pitch = 1 + (seed % 7) * 0.045;
      const chime = (notes: number[], duration = 0.13, waveform: OscillatorType = 'sine') =>
        notes.forEach((note, index) =>
          tone(note * pitch, note * pitch, duration * 1.6, index * duration, waveform, 0.45),
        );
      switch (family) {
        case 'electric':
          for (let i = 0; i < 5; i++) {
            tone((180 + i * 175) * pitch, 90, 0.08, i * 0.085, 'sawtooth');
            noise(0.06, 5000, 800, i * 0.085, seed + i);
          }
          break;
        case 'beam':
          tone(180 * pitch, 1100 * pitch, 0.2, 0, 'sawtooth', 0.4);
          tone(760 * pitch, 120 * pitch, 0.45, 0.16, 'square', 0.4);
          noise(0.4, 3500, 300, 0.18, seed);
          break;
        case 'projectile':
          for (let i = 0; i < 3; i++) {
            tone(480 * pitch, 150 * pitch, 0.15, i * 0.12, 'triangle');
            noise(0.12, 2600, 500, 0.08 + i * 0.12, seed + i);
          }
          break;
        case 'claw':
          [0, 0.11, 0.22].forEach((delay) => noise(0.12, 6000, 800, delay, seed));
          break;
        case 'impact':
          noise(0.2, 1300, 90, 0.06, seed);
          tone(120 * pitch, 35, 0.23, 0.04, 'triangle');
          break;
        case 'sound':
          [0, 0.12, 0.24].forEach((delay) => {
            tone(360 * pitch, 170 * pitch, 0.17, delay, 'sawtooth', 0.25);
            tone(500 * pitch, 300 * pitch, 0.17, delay, 'triangle', 0.3);
          });
          break;
        case 'vortex':
          [0, 0.11, 0.22, 0.33].forEach((delay) => noise(0.2, 300, 3500, delay, seed));
          break;
        case 'wave':
          noise(0.6, 500, 4200, 0, seed);
          chime([220, 260, 330, 390], 0.1, 'triangle');
          break;
        case 'fangs':
          tone(400, 90, 0.13, 0, 'square');
          noise(0.14, 2200, 150, 0.16, seed);
          break;
        case 'vine':
        case 'silk':
          [0, 0.13].forEach((delay) => {
            tone(150 * pitch, 900 * pitch, 0.1, delay, 'triangle');
            noise(0.12, 1800, 400, delay + 0.08, seed);
          });
          break;
        case 'powder':
          [0, 0.12, 0.24, 0.36].forEach((delay) => noise(0.12, 4800, 2200, delay, seed));
          break;
        case 'ghost':
          tone(190 * pitch, 85, 0.6, 0, 'sine', 0.7);
          tone(320 * pitch, 130, 0.55, 0.05, 'triangle', 0.3);
          break;
        case 'psychic':
          chime([440, 554, 659, 880, 659], 0.085);
          tone(110, 440, 0.5, 0, 'sine', 0.25);
          break;
        case 'speed':
          noise(0.3, 280, 6500, 0, seed);
          tone(220, 1200, 0.18, 0.04, 'triangle', 0.3);
          break;
        case 'recovery':
          chime([523, 659, 784, 1046], 0.14);
          break;
        case 'earth':
          [0, 0.14, 0.28].forEach((delay) => {
            noise(0.22, 500, 60, delay, seed);
            tone(70, 35, 0.2, delay, 'triangle');
          });
          break;
        case 'shield':
          chime([392, 523, 784], 0.11);
          tone(120, 240, 0.45, 0, 'triangle', 0.2);
          break;
        case 'swords':
          chime([659, 880, 1318], 0.13, 'square');
          break;
        case 'drain':
          chime([784, 659, 523, 392], 0.1);
          chime([392, 523, 659], 0.16, 'triangle');
          break;
        case 'tongue':
          tone(360 * pitch, 90, 0.14, 0, 'sine');
          tone(110, 480, 0.19, 0.14, 'triangle');
          break;
        default:
          tone(360 * pitch, 90, 0.2, 0, 'triangle');
          noise(0.16, 2200, 400, 0.08, seed);
      }
    },
    [ensureContext, noise, tone],
  );

  const playCue = useCallback(
    (cue: BattleSoundCue) => {
      if (!unlocked.current || mutedRef.current || document.hidden) return;
      ensureContext();
      if (cue === 'select') tone(880, 1046, 0.055, 0, 'square', 0.25);
      if (cue === 'switch')
        [440, 660, 880].forEach((note, i) => tone(note, note * 1.2, 0.12, i * 0.075, 'sine', 0.4));
      if (cue === 'faint') {
        tone(440, 55, 0.55, 0, 'triangle');
        noise(0.25, 1600, 100, 0.2);
      }
      if (cue === 'win')
        [523, 659, 784, 1046].forEach((note, i) =>
          tone(note, note, 0.24, i * 0.12, 'square', 0.35),
        );
      if (cue === 'lose')
        [392, 330, 262, 196].forEach((note, i) =>
          tone(note, note, 0.24, i * 0.15, 'triangle', 0.45),
        );
    },
    [ensureContext, noise, tone],
  );

  const toggleMuted = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, String(next));
    } catch {
      /* Private storage still permits session sound. */
    }
    if (master.current && context.current)
      master.current.gain.setValueAtTime(next ? 0 : 0.16, context.current.currentTime);
    if (next) {
      music.current?.pause();
      stopEffects();
    } else if (activeRef.current) unlock();
  }, [stopEffects, unlock]);

  useEffect(() => {
    if (active) playMusic();
    else {
      music.current?.pause();
      if (music.current) music.current.currentTime = 0;
      stopEffects();
    }
  }, [active, playMusic, stopEffects]);

  useEffect(() => {
    mounted.current = true;
    const visibility = () => {
      if (document.hidden) {
        music.current?.pause();
        stopEffects();
      } else if (activeRef.current) playMusic();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', visibility);
      music.current?.pause();
      if (music.current) music.current.src = '';
      music.current = null;
      stopEffects();
      if (context.current && context.current.state !== 'closed')
        void context.current.close().catch(() => {});
      context.current = null;
      master.current = null;
    };
  }, [playMusic, stopEffects]);

  return { muted, toggleMuted, unlock, playMove, playCue, musicUnavailable };
}
