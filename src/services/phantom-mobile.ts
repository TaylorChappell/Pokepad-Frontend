export function isMobileBrowser(nav: Pick<Navigator, 'userAgent' | 'maxTouchPoints'>) {
  return (
    /Android|iPhone|iPad|iPod/i.test(nav.userAgent) ||
    (/Macintosh/i.test(nav.userAgent) && nav.maxTouchPoints > 1)
  );
}
