import { getWallets } from '@wallet-standard/app';

/** Universal links must be opened directly from the user's tap, before any await. */
export function phantomBrowseUrl(href: string) {
  const page = new URL(href);
  if (!['http:', 'https:'].includes(page.protocol)) return null;
  return `https://phantom.com/ul/browse/${encodeURIComponent(page.href)}?ref=${encodeURIComponent(page.origin)}`;
}

export function isMobileBrowser(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>) {
  return (
    /Android|iPhone|iPad|iPod/i.test(nav.userAgent) ||
    (/Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1)
  );
}

export function phantomMobileLink() {
  if (typeof window === 'undefined' || !isMobileBrowser(window.navigator)) return null;
  // Stay in this browser when Phantom can already connect here (including its in-app browser).
  const injected = (window as Window & { phantom?: { solana?: { isPhantom?: boolean } } }).phantom
    ?.solana?.isPhantom;
  const registered = getWallets()
    .get()
    .some(
      (wallet) =>
        wallet.name.toLowerCase() === 'phantom' &&
        wallet.chains.some((chain) => chain.startsWith('solana:')),
    );
  return injected || registered ? null : phantomBrowseUrl(window.location.href);
}
