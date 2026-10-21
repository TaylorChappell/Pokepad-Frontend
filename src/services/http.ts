export const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
let bearer: string | null = null;
let sessionEnabled = true;
let sessionGeneration = 0;
const unauthorized = new Set<() => void>();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
export function setAccessToken(token: string | null) {
  if (bearer !== token) sessionGeneration++;
  bearer = token;
}
export function setSessionEnabled(enabled: boolean) {
  if (sessionEnabled !== enabled) sessionGeneration++;
  sessionEnabled = enabled;
}
export function onUnauthorized(listener: () => void) {
  unauthorized.add(listener);
  return () => {
    unauthorized.delete(listener);
  };
}
export type ApiRequestOptions = RequestInit & {
  json?: unknown;
  base?: string;
  auth?: boolean;
  timeoutMs?: number;
};

/** Shared live transport. Bearers exist in memory only; secrets never enter Vite configuration. */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { json, base = API_BASE, auth = true, timeoutMs = 15000, ...init } = options;
  if (!base) throw new ApiError('The backend is not configured. This is a local demo.', 503);
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid API path.');
  const controller = new AbortController();
  const cancel = () => controller.abort();
  init.signal?.addEventListener('abort', cancel, { once: true });
  if (init.signal?.aborted) cancel();
  const timeout = setTimeout(cancel, timeoutMs);
  const headers = new Headers(init.headers);
  const requestGeneration = sessionGeneration;
  headers.set('Accept', 'application/json');
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (auth && sessionEnabled && bearer) headers.set('Authorization', 'Bearer ' + bearer);
  try {
    const response = await fetch(base.replace(/\/$/, '') + path, {
      ...init,
      credentials: init.credentials ?? (sessionEnabled ? 'include' : 'omit'),
      signal: controller.signal,
      headers,
      ...(json === undefined ? {} : { body: JSON.stringify(json) }),
    });
    const payload = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401 && auth && requestGeneration === sessionGeneration)
        unauthorized.forEach((listener) => listener());
      const problem = payload?.error && typeof payload.error === 'object' ? payload.error : payload;
      throw new ApiError(
        (typeof problem?.message === 'string' && problem.message) ||
          (response.status === 401
            ? 'Connect your wallet to continue.'
            : 'The server could not complete this request. Please try again.'),
        response.status,
        typeof problem?.code === 'string' ? problem.code : undefined,
      );
    }
    return payload as T;
  } catch (error) {
    if (controller.signal.aborted && !init.signal?.aborted)
      throw new ApiError(
        'The server took too long to respond. Your transaction may still be pending.',
        408,
      );
    if (error instanceof TypeError)
      throw new ApiError('Cannot reach the backend. Check your connection and try again.', 0);
    throw error;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener('abort', cancel);
  }
}
