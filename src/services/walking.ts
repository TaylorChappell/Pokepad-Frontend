import { apiRequest, ApiError } from './http';
export type WalkSession = {
  sessionId: string;
  challenge: string;
  nextSeq: number;
  expiresAt: number | string;
  acceptedMeters: number;
};
export type SampleResult = {
  accepted: boolean;
  reason?: string;
  creditedMeters: number;
  sessionMeters: number;
  dailyMeters: number;
  nextSeq: number;
  readyEggIds: string[];
  timeSavedMs?: number;
  eggUpdates?: { id: string; readyAt: number; walkingBoostMs: number }[];
};
export function isMobileWalkingDevice(device: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>) {
  return (
    /Android|iPhone|iPad|iPod/i.test(device.userAgent) ||
    (/Macintosh/i.test(device.userAgent) && device.maxTouchPoints > 1)
  );
}
/** Retry an ambiguous sample with the exact sequence and location, never a fresh location. */
export async function postWalkingSample(
  session: WalkSession,
  position: Pick<GeolocationPosition, 'coords' | 'timestamp'>,
  request: typeof apiRequest = apiRequest,
  resume = false,
) {
  const json = {
    challenge: session.challenge,
    seq: session.nextSeq,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
    ...(resume ? { resume: true } : {}),
  };
  const send = () =>
    request<SampleResult>(`/v1/walking/${encodeURIComponent(session.sessionId)}/samples`, {
      method: 'POST',
      json,
    });
  let result: SampleResult;
  try {
    result = await send();
  } catch (error) {
    if (error instanceof ApiError && error.status > 0 && error.status < 500 && error.status !== 408)
      throw error;
    result = await send();
  }
  if (
    !Number.isInteger(result.nextSeq) ||
    result.nextSeq <= session.nextSeq ||
    !Number.isFinite(result.sessionMeters) ||
    result.sessionMeters < 0
  )
    throw new Error(
      'Walking verification returned an invalid response. End this session and try again.',
    );
  // Filtered samples consume their sequence as well as accepted samples.
  session.nextSeq = result.nextSeq;
  return result;
}
