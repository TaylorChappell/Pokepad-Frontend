import type { Profile } from '../types';
import { apiRequest, ApiError } from './http';

export type AnalyticsEventKind = 'egg' | 'pack' | 'redeem' | 'evolve' | 'launch' | 'other';

export interface AnalyticsEvent {
  id: string;
  kind: AnalyticsEventKind;
  trainer: string;
  trainerWallet?: string;
  avatar: Pick<Profile, 'character' | 'accessoryColor'>;
  title: string;
  detail: string;
  createdAt: number;
  pokemonId?: number;
  shiny?: boolean;
  href: string;
}

/** Backend ledger totals; never inferred from an account's collection or available vault funds. */
export interface PlatformAnalytics {
  metrics: {
    totalRewardsSol: number;
    platformTradingVolumeSol: number;
    activeUsers24h: number;
  };
  updatedAt: number;
  events: AnalyticsEvent[];
}

const kinds = new Set<AnalyticsEventKind>(['egg', 'pack', 'redeem', 'evolve', 'launch', 'other']);
const characters = new Set<Profile['character']>(['red', 'leaf', 'misty', 'brock', 'blue']);
const object = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim().length && value.length <= max ? value : null;
const amount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;
const timestamp = (value: unknown): value is number => amount(value) && value <= 8.64e15;

function parseEvent(input: unknown): AnalyticsEvent | null {
  const event = object(input);
  if (!event) return null;
  const id = text(event.id, 200);
  const trainer = text(event.trainer, 100);
  const title = text(event.title, 240);
  const kind = event.kind as AnalyticsEventKind;
  if (!id || !trainer || !title || !kinds.has(kind) || !timestamp(event.createdAt)) return null;
  const avatar = object(event.avatar);
  const character = avatar?.character as Profile['character'];
  const color = avatar?.accessoryColor;
  // Feed destinations stay inside the app, including when the API is misconfigured.
  const href =
    typeof event.href === 'string' &&
    /^\/(?:pokemon|coin|gym|trainer|rewards|activity|create)(?:[/?][\w%?=&.-]*)?$/.test(event.href)
      ? event.href
      : '/activity';
  return {
    id,
    kind,
    trainer,
    trainerWallet: text(event.trainerWallet, 100) ?? undefined,
    avatar: {
      character: characters.has(character) ? character : 'red',
      accessoryColor: typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color : '#ef5357',
    },
    title,
    detail: typeof event.detail === 'string' ? event.detail.slice(0, 400) : '',
    createdAt: event.createdAt,
    pokemonId:
      Number.isInteger(event.pokemonId) &&
      Number(event.pokemonId) >= 1 &&
      Number(event.pokemonId) <= 151
        ? Number(event.pokemonId)
        : undefined,
    shiny: event.shiny === true,
    href,
  };
}

export function parsePlatformAnalytics(input: unknown): PlatformAnalytics {
  const response = object(input);
  const metrics = object(response?.metrics);
  if (
    !response ||
    !metrics ||
    !amount(metrics.totalRewardsSol) ||
    !amount(metrics.platformTradingVolumeSol) ||
    !amount(metrics.activeUsers24h) ||
    !Number.isSafeInteger(metrics.activeUsers24h) ||
    !timestamp(response.updatedAt) ||
    !Array.isArray(response.events)
  ) {
    throw new Error('Analytics returned an invalid response.');
  }
  return {
    metrics: {
      totalRewardsSol: metrics.totalRewardsSol,
      platformTradingVolumeSol: metrics.platformTradingVolumeSol,
      activeUsers24h: metrics.activeUsers24h,
    },
    updatedAt: response.updatedAt,
    events: mergeAnalyticsEvents(
      response.events
        .slice(0, 500)
        .map(parseEvent)
        .filter((event): event is AnalyticsEvent => !!event),
    ),
  };
}

/** Newest first; the first feed wins when server and account contain the same event ID. */
export function mergeAnalyticsEvents(...feeds: AnalyticsEvent[][]): AnalyticsEvent[] {
  const unique = new Map<string, AnalyticsEvent>();
  for (const events of feeds) {
    for (const event of events) if (!unique.has(event.id)) unique.set(event.id, event);
  }
  return [...unique.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100);
}

/** GET /v1/analytics. The page polls every 10 seconds and aborts work on unmount. */
export async function loadPlatformAnalytics(
  baseUrl: string,
  signal?: AbortSignal,
): Promise<PlatformAnalytics> {
  try {
    return parsePlatformAnalytics(
      await apiRequest('/v1/analytics', {
        base: baseUrl.replace(/\/+$/, ''),
        signal,
        timeoutMs: 12000,
        cache: 'no-store',
      }),
    );
  } catch (error) {
    if (error instanceof ApiError) throw new Error('Analytics is temporarily unavailable.');
    throw error;
  }
}
