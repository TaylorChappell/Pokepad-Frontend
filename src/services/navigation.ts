/** Use History API routes so embedded browsers never treat a Kanto tab as a page load. */
export function navigate(path: string, replace = false) {
  const route = path.startsWith('#') ? path : '#' + path;
  if (!route.startsWith('#/')) return;
  const before = window.location.href;
  const next = new URL(window.location.href);
  next.hash = route;
  if (next.href === before) return;
  window.history[replace ? 'replaceState' : 'pushState'](window.history.state, '', next.href);
  window.dispatchEvent(
    new window.HashChangeEvent('hashchange', { oldURL: before, newURL: next.href }),
  );
}
export function installClientNavigation() {
  const onClick = (event: MouseEvent) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor =
      event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!anchor || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self'))
      return;
    const next = new URL(anchor.href, window.location.href);
    if (
      next.origin !== window.location.origin ||
      next.pathname !== window.location.pathname ||
      next.search !== window.location.search ||
      !next.hash.startsWith('#/')
    )
      return;
    event.preventDefault();
    navigate(next.hash);
  };
  document.addEventListener('click', onClick);
  return () => document.removeEventListener('click', onClick);
}
