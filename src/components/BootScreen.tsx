/** The shell lives in index.html so it is visible before React or API data arrive. */
export function dismissBootScreen({ immediate = false }: { immediate?: boolean } = {}) {
  const screen = document.getElementById('boot-screen');
  if (!screen || screen.dataset.dismissing) return;
  screen.dataset.dismissing = 'true';
  window.clearTimeout(Number(screen.dataset.retryTimer));
  const startedAt = Number(screen.dataset.startedAt) || 0;
  const reducedMotion =
    document.documentElement.dataset.motion === 'reduced' ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const remaining =
    immediate || reducedMotion ? 0 : Math.max(0, 650 - (performance.now() - startedAt));
  window.setTimeout(() => {
    screen.classList.add('boot-screen--leaving');
    window.setTimeout(
      () => {
        const root = document.getElementById('root');
        root?.removeAttribute('inert');
        root?.removeAttribute('aria-hidden');
        document.body.classList.remove('is-booting');
        screen.remove();
      },
      reducedMotion ? 0 : 340,
    );
  }, remaining);
}
