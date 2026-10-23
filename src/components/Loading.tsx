import { useEffect } from 'react';
import { dismissBootScreen } from './BootScreen';

export function ContentSkeleton({
  kind = 'cards',
  label = 'Loading content',
}: {
  kind?: 'cards' | 'profile' | 'rows';
  label?: string;
}) {
  return (
    <div
      className={'content-skeleton skeleton-' + kind}
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      {kind === 'profile' && <div className="skeleton-banner" />}
      <div className="skeleton-heading" />
      <div className="skeleton-grid">
        {Array.from({ length: kind === 'rows' ? 3 : 6 }, (_, i) => (
          <div className="skeleton-card" key={i}>
            <span className="skeleton-art" />
            <span className="skeleton-line" />
            <span className="skeleton-line short" />
          </div>
        ))}
      </div>
    </div>
  );
}
export function PageSkeleton() {
  return (
    <div className="page-skeleton">
      <div className="skeleton-topbar" />
      <div className="skeleton-sidebar" />
      <ContentSkeleton label="Loading your trainer" />
    </div>
  );
}

/** Watches actual image decoding and asynchronous route content, including CSS sprite sheets. */
export function watchPageReadiness(root: HTMLElement, onReady: () => void) {
  let stopped = false,
    fontsReady = !document.fonts,
    frame = 0,
    settleTimer = 0,
    bootComplete = false;
  const images = new Map<
    HTMLImageElement,
    { src: string; status: 'loading' | 'ready' | 'error'; cleanup: () => void }
  >();
  const backgrounds = new Map<
    HTMLElement,
    { src: string; status: 'loading' | 'ready' | 'error'; image: HTMLImageElement }
  >();
  const decodedSources = new Set<string>();
  const inView = (el: Element) => {
    const r = el.getBoundingClientRect();
    return (
      r.width > 0 &&
      r.height > 0 &&
      r.bottom >= 0 &&
      r.top < window.innerHeight &&
      r.right >= 0 &&
      r.left < window.innerWidth &&
      getComputedStyle(el).visibility !== 'hidden'
    );
  };
  const marker = (el: HTMLElement, status: string) => {
    el.dataset.mediaState = status;
    const target =
      el.closest<HTMLElement>(
        '.pokemon-art,.coin-avatar,.trainer-avatar,.trainer-banner,.egg-art',
      ) || el;
    target.dataset.mediaState = status;
  };
  const request = () => {
    if (!stopped && !frame) frame = requestAnimationFrame(scan);
  };
  const scan = () => {
    frame = 0;
    if (stopped) return;
    for (const img of root.querySelectorAll<HTMLImageElement>('img')) {
      const src = img.src || img.currentSrc;
      if (!src) continue;
      const previous = images.get(img);
      if (previous?.src === src) continue;
      previous?.cleanup();
      const ready = img.complete && img.naturalWidth > 0 && decodedSources.has(src);
      const entry = {
        src,
        status: (ready ? 'ready' : 'loading') as 'loading' | 'ready' | 'error',
        cleanup: () => {},
      };
      images.set(img, entry);
      marker(img, entry.status);
      const finish = async () => {
        try {
          if (!img.naturalWidth) throw Error('Image unavailable');
          if (img.decode) await img.decode();
          if (stopped || images.get(img) !== entry) return;
          entry.status = 'ready';
          decodedSources.add(src);
          marker(img, 'ready');
        } catch {
          if (stopped || images.get(img) !== entry) return;
          entry.status = 'error';
          marker(img, 'error');
        }
        request();
      };
      const failed = () => {
        if (stopped || images.get(img) !== entry) return;
        entry.status = 'error';
        marker(img, 'error');
        request();
      };
      img.addEventListener('load', finish);
      img.addEventListener('error', failed);
      entry.cleanup = () => {
        img.removeEventListener('load', finish);
        img.removeEventListener('error', failed);
      };
      if (img.complete && !ready) void finish();
    }
    for (const el of root.querySelectorAll<HTMLElement>('[style*="background-image"]')) {
      if (!inView(el)) continue;
      const src = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      if (!src || backgrounds.get(el)?.src === src) continue;
      const image = new Image(),
        entry = {
          src,
          status: (decodedSources.has(src) ? 'ready' : 'loading') as 'loading' | 'ready' | 'error',
          image,
        };
      backgrounds.set(el, entry);
      marker(el, entry.status);
      if (entry.status === 'ready') continue;
      image.onload = async () => {
        try {
          if (image.decode) await image.decode();
          if (stopped || backgrounds.get(el) !== entry) return;
          entry.status = 'ready';
          decodedSources.add(src);
          marker(el, 'ready');
        } catch {
          if (stopped || backgrounds.get(el) !== entry) return;
          entry.status = 'error';
          marker(el, 'error');
        }
        request();
      };
      image.onerror = () => {
        if (stopped || backgrounds.get(el) !== entry) return;
        entry.status = 'error';
        marker(el, 'error');
        request();
      };
      image.src = src;
    }
    for (const [img, entry] of images)
      if (!root.contains(img)) {
        entry.cleanup();
        images.delete(img);
      }
    for (const [el] of backgrounds) if (!root.contains(el)) backgrounds.delete(el);
    if (bootComplete || !document.getElementById('boot-screen')) return;
    const visibleImages = [...images].filter(([el]) => inView(el));
    const visibleBackgrounds = [...backgrounds].filter(([el]) => inView(el));
    const pending =
      !fontsReady ||
      visibleImages.some(([, x]) => x.status === 'loading') ||
      visibleBackgrounds.some(([, x]) => x.status === 'loading') ||
      [
        ...root.querySelectorAll(
          '[aria-busy="true"], [data-body-status="loading"], [data-body-status="idle"]',
        ),
      ].some(inView);
    const failed =
      visibleImages.some(([, x]) => x.status === 'error') ||
      visibleBackgrounds.some(([, x]) => x.status === 'error') ||
      [...root.querySelectorAll('[data-body-status="error"]')].some(inView);
    if (pending || failed) {
      clearTimeout(settleTimer);
      settleTimer = 0;
      if (failed) {
        const screen = document.getElementById('boot-screen');
        screen?.classList.add('is-stalled');
        const status = document.getElementById('boot-status');
        if (status) status.textContent = 'Some artwork could not load. Please reload to try again.';
      }
      return;
    }
    if (!settleTimer)
      settleTimer = window.setTimeout(() => {
        settleTimer = 0;
        bootComplete = true;
        onReady();
      }, 160);
  };
  const observer = new MutationObserver((records) => {
    if (
      records.some(
        (r) =>
          r.type === 'childList' ||
          r.attributeName !== 'style' ||
          (r.target instanceof HTMLElement &&
            r.target.style.backgroundImage &&
            r.target.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] !==
              backgrounds.get(r.target)?.src),
      )
    )
      request();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['src', 'style', 'aria-busy', 'data-body-status'],
  });
  window.addEventListener('scroll', request, true);
  window.addEventListener('resize', request);
  if (document.fonts)
    void document.fonts.ready.then(() => {
      fontsReady = true;
      request();
    });
  request();
  return () => {
    stopped = true;
    observer.disconnect();
    cancelAnimationFrame(frame);
    clearTimeout(settleTimer);
    for (const entry of images.values()) entry.cleanup();
    for (const entry of backgrounds.values()) {
      entry.image.onload = null;
      entry.image.onerror = null;
    }
    window.removeEventListener('scroll', request, true);
    window.removeEventListener('resize', request);
  };
}
export function LoadingCoordinator() {
  useEffect(() => {
    const root = document.body;
    return watchPageReadiness(root, () => dismissBootScreen());
  }, []);
  return null;
}
