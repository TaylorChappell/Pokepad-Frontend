export const LOCATION_DEADLINE_MS = 15000;
const FALLBACK_AFTER_MS = 5000;
export class WalkingLocationError extends Error {
  constructor(
    readonly code: number,
    readonly reason: 'denied' | 'no-response' | 'cancelled' | 'unavailable',
  ) {
    super(reason);
    this.name = 'WalkingLocationError';
  }
}
/** Bound permission + acquisition time independently of the browser's GPS timeout. */
export function requestWalkingLocation(
  geo: Geolocation,
  options: {
    permissions?: Pick<Permissions, 'query'>;
    onPermission?: (state: PermissionState) => void;
  } = {},
) {
  let settled = false;
  let fallbackStarted = false;
  let watch: number | null = null;
  let permission: PermissionStatus | undefined;
  let permissionListener: (() => void) | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  let resolve!: (value: GeolocationPosition) => void;
  let reject!: (reason: WalkingLocationError) => void;
  const promise = new Promise<GeolocationPosition>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  function cleanup() {
    clearTimeout(deadline);
    clearTimeout(fallbackTimer);
    if (watch !== null) geo.clearWatch(watch);
    watch = null;
    if (permissionListener) permission?.removeEventListener('change', permissionListener);
  }
  function success(position: GeolocationPosition) {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(position);
  }
  function fail(error: WalkingLocationError) {
    if (settled) return;
    settled = true;
    cleanup();
    reject(error);
  }
  function fallback() {
    if (settled || fallbackStarted) return;
    fallbackStarted = true;
    try {
      const id = geo.watchPosition(
        success,
        (error) => {
          if (error.code === 1) fail(new WalkingLocationError(1, 'denied'));
          // Other watch errors can recover; the independent deadline remains authoritative.
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 8000 },
      );
      // Handles adapters that invoke a callback synchronously during registration.
      if (settled) geo.clearWatch(id);
      else watch = id;
    } catch {
      fail(new WalkingLocationError(2, 'unavailable'));
    }
  }
  deadline = setTimeout(
    () => fail(new WalkingLocationError(3, 'no-response')),
    LOCATION_DEADLINE_MS,
  );
  fallbackTimer = setTimeout(fallback, FALLBACK_AFTER_MS);
  try {
    // Begin inside the tap handler. A recent coarse fix can establish permission quickly;
    // the walking controller still requires accurate, fresh fixes before crediting distance.
    geo.getCurrentPosition(
      success,
      (error) => {
        if (error.code === 1) fail(new WalkingLocationError(1, 'denied'));
        else fallback();
      },
      { enableHighAccuracy: false, maximumAge: 5000, timeout: 8000 },
    );
  } catch {
    fallback();
  }
  try {
    void options.permissions
      ?.query({ name: 'geolocation' })
      .then((status) => {
        if (settled) return;
        permission = status;
        permissionListener = () => {
          if (settled) return;
          options.onPermission?.(status.state);
          if (status.state === 'denied') fail(new WalkingLocationError(1, 'denied'));
        };
        status.addEventListener('change', permissionListener);
        permissionListener();
      })
      .catch(() => {
        /* Permissions API is optional in embedded browsers. */
      });
  } catch {
    /* A missing Permissions API must not block native geolocation. */
  }
  return { promise, cancel: () => fail(new WalkingLocationError(0, 'cancelled')) };
}
