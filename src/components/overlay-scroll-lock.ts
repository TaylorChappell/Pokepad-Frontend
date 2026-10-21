type StyleValue = { value: string; priority: string };
type LockState = { count: number; restore: () => void };

const locks = new WeakMap<Document, LockState>();

function remember(style: CSSStyleDeclaration, name: string): StyleValue {
  return { value: style.getPropertyValue(name), priority: style.getPropertyPriority(name) };
}

function restore(style: CSSStyleDeclaration, name: string, previous: StyleValue) {
  if (previous.value) style.setProperty(name, previous.value, previous.priority);
  else style.removeProperty(name);
}

/** Keeps the page and fixed header at the same width while any overlay is open. */
export function lockPageScroll(document: Document): () => void {
  let state = locks.get(document);
  if (!state) {
    const root = document.documentElement;
    const body = document.body;
    const view = document.defaultView;
    const rootOverflow = remember(root.style, 'overflow');
    const bodyOverflow = remember(body.style, 'overflow');
    const gutter = remember(root.style, 'scrollbar-gutter');
    const padding = remember(root.style, 'padding-right');
    const gapProperty = remember(root.style, '--overlay-scrollbar-gap');
    const gap = view ? Math.max(0, view.innerWidth - root.clientWidth) : 0;
    const supportsStableGutter = view?.CSS?.supports?.('scrollbar-gutter', 'stable') ?? false;

    if (supportsStableGutter) {
      // The same gutter is reserved by shared-v3.css before opening the overlay.
      // Do not also add padding: that would cause a second horizontal jump.
      root.style.setProperty('scrollbar-gutter', 'stable');
    } else if (gap > 0) {
      const existingPadding = parseFloat(view?.getComputedStyle(root).paddingRight || '0') || 0;
      root.style.setProperty('padding-right', `${existingPadding + gap}px`);
      root.style.setProperty('--overlay-scrollbar-gap', `${gap}px`);
    }
    root.style.setProperty('overflow', 'hidden');
    body.style.setProperty('overflow', 'hidden');

    state = {
      count: 0,
      restore() {
        restore(root.style, 'overflow', rootOverflow);
        restore(body.style, 'overflow', bodyOverflow);
        restore(root.style, 'scrollbar-gutter', gutter);
        restore(root.style, 'padding-right', padding);
        restore(root.style, '--overlay-scrollbar-gap', gapProperty);
      },
    };
    locks.set(document, state);
  }
  state.count += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.count -= 1;
    if (state.count === 0) {
      state.restore();
      locks.delete(document);
    }
  };
}
