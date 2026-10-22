import { REVEAL_TIMELINES, type RevealKind, type SoundLayer } from './catalog';

export interface RevealFrame {
  elapsedMs: number;
  durationMs: number;
  progress: number;
  revealed: boolean;
}
export interface RevealClock {
  now(): number;
  request(callback: () => void): number;
  cancel(id: number): void;
}
export interface RevealTimelineOptions {
  reducedMotion?: boolean;
  /** Hold before the final flash until the result's artwork has decoded. */
  canReveal?(): boolean;
  onFrame(frame: RevealFrame): void;
  onSound(layers: readonly SoundLayer[]): void;
  onReveal(): void;
}
export const browserRevealClock: RevealClock = {
  now: () => performance.now(),
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (id) => window.cancelAnimationFrame(id),
};

/** A single presentation clock drives both the sampled CSS pose and its sound cues. */
export function runRevealTimeline(
  kind: RevealKind,
  options: RevealTimelineOptions,
  clock: RevealClock = browserRevealClock,
) {
  const timeline = REVEAL_TIMELINES[kind];
  const durationMs = options.reducedMotion ? 180 : timeline.durationMs;
  const cues = options.reducedMotion ? [] : timeline.cues;
  let lastFrame = clock.now();
  let elapsed = 0;
  let quiet = false;
  const holdAt = options.reducedMotion
    ? durationMs - 1
    : (timeline.cues.find((cue) => cue.name === 'flash')?.atMs ?? durationMs) - 1;
  let request: number | undefined;
  let cancelled = false;
  let complete = false;
  let nextCue = 0;
  const frame = (elapsedMs: number): RevealFrame => ({
    elapsedMs,
    durationMs,
    progress: elapsedMs / durationMs,
    revealed: elapsedMs >= durationMs,
  });
  const tick = () => {
    if (cancelled || complete) return;
    const now = clock.now();
    const nextElapsed = quiet ? durationMs : elapsed + Math.max(0, now - lastFrame);
    lastFrame = now;
    elapsed = Math.min(options.canReveal?.() === false ? holdAt : durationMs, nextElapsed);
    // Paint the same sampled pose before starting its associated sound in this frame.
    options.onFrame(frame(elapsed));
    if (cancelled) return;
    while (nextCue < cues.length && cues[nextCue].atMs <= elapsed) {
      const cue = cues[nextCue++];
      // A blocked frame must not replay several old cracks/rips over an already-revealed Pokémon.
      if (!quiet && elapsed - cue.atMs <= 100) options.onSound(cue.layers);
      if (cancelled) return;
    }
    if (elapsed === durationMs) {
      complete = true;
      if (!quiet) options.onSound(timeline.revealed);
      if (!cancelled) options.onReveal();
    } else request = clock.request(tick);
  };
  tick();
  return {
    cancel() {
      cancelled = true;
      if (request !== undefined) clock.cancel(request);
    },
    // Backgrounding reveals the already-owned result quietly; no stale sound resumes on return.
    finishSilently() {
      if (cancelled || complete) return;
      if (request !== undefined) clock.cancel(request);
      quiet = true;
      nextCue = cues.length;
      tick();
    },
  };
}
