import { useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '../utils';
import { useSoundEffects } from '../audio/sound';
import { BATTLE_PRELOAD, BATTLE_SOUNDS, MOVE_SOUNDS, type BattleSoundCue } from '../audio/catalog';
export type { BattleSoundCue } from '../audio/catalog';

const MUSIC_VOLUME = 0.24;

/** Original local samples and music start only after a battle-button gesture. */
export function useBattleAudio(active: boolean) {
  const { muted, toggleMuted, unlock: unlockEffects, play, stop } = useSoundEffects(active);
  const [musicUnavailable, setMusicUnavailable] = useState(false);
  const mutedRef = useRef(muted);
  const activeRef = useRef(active);
  const unlocked = useRef(false);
  const mounted = useRef(true);
  const music = useRef<HTMLAudioElement | null>(null);
  activeRef.current = active;
  mutedRef.current = muted;

  const ensureMusic = useCallback(() => {
    if (!music.current && typeof Audio !== 'undefined') {
      const audio = new Audio();
      if (!audio.canPlayType('audio/mpeg')) return null;
      audio.preload = 'none';
      audio.src = asset('battle/audio/kanto-trainer.mp3');
      audio.loop = true;
      audio.volume = MUSIC_VOLUME;
      // The original intro plays once, then loop Showdown's HGSS Kanto trainer recording.
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
    if (mutedRef.current || !unlocked.current || !activeRef.current || document.hidden) return;
    const audio = ensureMusic();
    if (!audio) return;
    audio.muted = false;
    void audio.play().catch(() => {
      /* Another gesture may be needed after returning from background. */
    });
  }, [ensureMusic]);

  const unlock = useCallback(() => {
    unlocked.current = true;
    unlockEffects(BATTLE_PRELOAD);
    playMusic();
  }, [unlockEffects, playMusic]);

  const playMove = useCallback(
    (name: string) => {
      const layers = MOVE_SOUNDS[name];
      if (layers) play(layers);
    },
    [play],
  );
  const playCue = useCallback((cue: BattleSoundCue) => play(BATTLE_SOUNDS[cue]), [play]);

  useEffect(() => {
    if (active && !muted) {
      if (unlocked.current) unlockEffects(BATTLE_PRELOAD);
      playMusic();
    } else {
      music.current?.pause();
      if (!active && music.current) music.current.currentTime = 0;
      stop();
    }
  }, [active, muted, playMusic, stop, unlockEffects]);

  useEffect(() => {
    mounted.current = true;
    const visibility = () => {
      if (document.hidden) music.current?.pause();
      else playMusic();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false;
      document.removeEventListener('visibilitychange', visibility);
      music.current?.pause();
      if (music.current) music.current.src = '';
      music.current = null;
    };
  }, [playMusic]);

  return { muted, toggleMuted, unlock, playMove, playCue, musicUnavailable };
}
