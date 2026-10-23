import { apiRequest } from './http';
export interface AdminPageResult<T> {
  items: T[];
  next: string | null;
}
export interface AdminTrainer {
  wallet: string;
  display_name: string;
  character: string;
  accessory_color: string;
  restricted: boolean;
  created_at: string;
  last_active_at: string | null;
  pokemon_count?: number;
}
export interface AdminUser {
  trainer: AdminTrainer;
  stats: {
    pokemon: number;
    gift_pokemon: number;
    backing_lamports: string;
    unopened_rewards: number;
    holdings: number;
    sessions: number;
  };
  admin: boolean;
}
export interface AdminLog {
  id: string;
  created_at: string;
  source?: string;
  level?: string;
  code?: string;
  operation?: string;
  request_id?: string;
  actor_wallet?: string;
  target_wallet?: string;
  action?: string;
  reason?: string;
  details?: { quantity?: number; kind?: string; tier?: string; mint?: string };
}
export type ServiceState = 'healthy' | 'attention' | 'stale' | 'unknown' | 'disabled';
export interface AdminOverview {
  at: string;
  network: string;
  metrics: {
    trainers: number;
    active_trainers: number;
    restricted_trainers: number;
    active_coins: number;
    volume_lamports: string;
    pokemon: number;
    gifts: number;
    battles: number;
    pending_payouts: number;
    failed_payouts: number;
    rewards_received_lamports: string;
    rewards_available_lamports: string;
    rewards_paid_lamports: string;
    rewards_reserved_lamports: string;
    oldest_pending_payout_at: string | null;
  };
  services: {
    id: string;
    name: string;
    state: ServiceState;
    detail: string;
    checkedAt: string | null;
  }[];
  jobs: {
    name: string;
    state: ServiceState;
    checkedAt: string | null;
    durationMs: number | null;
    code: string | null;
  }[];
  treasury: {
    balanceLamports: string | null;
    expectedLamports: string | null;
    discrepancyCount: number;
  };
}
export interface MainTokenPreview {
  currentMint: string | null;
  coin: {
    mint: string;
    creatorWallet: string;
    name: string;
    symbol: string;
    signature: string;
    launchSlot: number;
    launchedAt: number;
    image?: string;
    description: string;
    verifiedAt: string;
    splits: { creator: number; platform: number; rewards: number };
  };
}
export interface MainTokenSetting {
  mint: string | null;
  coin: {
    id: string;
    name: string;
    ticker: string;
    creator_wallet: string;
    mode: string;
    status: string;
    indexed_slot: string;
    launch_slot: string;
  } | null;
}
export const adminApi = {
  overview: () => apiRequest<AdminOverview>('/v1/admin/overview'),
  users: (q: string, status: string, after?: string) =>
    apiRequest<AdminPageResult<AdminTrainer>>(
      '/v1/admin/users?' + new URLSearchParams({ q, status, ...(after ? { after } : {}) }),
    ),
  user: (wallet: string) => apiRequest<AdminUser>('/v1/admin/users/' + encodeURIComponent(wallet)),
  logs: (kind: string, level: string, before?: string) =>
    apiRequest<AdminPageResult<AdminLog>>(
      '/v1/admin/logs?' + new URLSearchParams({ kind, level, ...(before ? { before } : {}) }),
    ),
  mutate: adminMutation,
  main: () => apiRequest<MainTokenSetting>('/v1/admin/main-token'),
  preview: (mint: string, signature: string) =>
    apiRequest<MainTokenPreview>('/v1/admin/main-token/preview', {
      method: 'POST',
      json: { mint, ...(signature.trim() ? { signature: signature.trim() } : {}) },
      timeoutMs: 45000,
    }),
};
/** A network retry reuses the same operation ID, including after a page reload. */
export async function adminMutation<T>(
  wallet: string,
  path: string,
  body: unknown,
  transport: typeof apiRequest = apiRequest,
): Promise<T> {
  const storageKey = 'kanto:admin:' + wallet + ':' + path,
    fingerprint = JSON.stringify(body);
  let id = crypto.randomUUID();
  try {
    const prior = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
    if (prior?.fingerprint === fingerprint && typeof prior.id === 'string') id = prior.id;
    sessionStorage.setItem(storageKey, JSON.stringify({ id, fingerprint }));
  } catch {}
  const result = await transport<T>('/v1/admin' + path, {
    method: 'POST',
    json: body,
    headers: { 'Idempotency-Key': id },
    timeoutMs: path === '/main-token' ? 45000 : 15000,
  });
  try {
    sessionStorage.removeItem(storageKey);
  } catch {}
  return result;
}
