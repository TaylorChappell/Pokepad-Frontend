export const asset = (path: string) =>
  (globalThis as typeof globalThis & { __POKEPAD_ASSETS__?: Record<string, string> })
    .__POKEPAD_ASSETS__?.[path] || (import.meta.env?.BASE_URL || './') + 'assets/' + path;
export { navigate } from './services/navigation';
export const sol = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 4 });
export const compact = (n: number) =>
  Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
export const duration = (ms: number) => {
  if (ms <= 0) return 'Ready to hatch';
  const minutes = Math.ceil(ms / 60000),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h > 24 ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h' : h > 0 ? h + 'h ' + m + 'm' : m + 'm';
};
export const relativeTime = (time: number, now = Date.now()) => {
  const minutes = Math.max(0, Math.floor((now - time) / 60000));
  return minutes < 1
    ? 'Just now'
    : minutes < 60
      ? minutes + 'm ago'
      : minutes < 1440
        ? Math.floor(minutes / 60) + 'h ago'
        : Math.floor(minutes / 1440) + 'd ago';
};
export const TYPE_COLORS: Record<string, string> = {
  Fire: '#f5ac90',
  Water: '#a6d7fa',
  Grass: '#b9e2b4',
  Poison: '#d6b9eb',
  Electric: '#ffe48b',
  Normal: '#e3dfd7',
  Flying: '#c5d3f7',
  Bug: '#d6e7a4',
  Psychic: '#f5b7d5',
  Ice: '#b9e7ed',
  Ghost: '#c8b9e4',
  Dragon: '#c1b9f2',
  Ground: '#e7cea4',
  Rock: '#d7cead',
  Fighting: '#e9b4a6',
};
