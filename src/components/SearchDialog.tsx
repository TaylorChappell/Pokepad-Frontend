import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Coin } from '../types';
import { compact, navigate } from '../utils';
import { useOptionalApp } from '../state/AppContext';
import { CoinAvatar, Icon, Pokeball } from './UI';

export function SearchDialog({ coins, onClose }: { coins: Coin[]; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [closing, setClosing] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  const app = useOptionalApp();
  const reducedMotion =
    app?.state.profile.reducedMotion ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const term = query.trim().toLowerCase();
  const tickerTerm = term.replace(/^\$/, '');
  const matches = term
    ? coins.filter(
        (coin) =>
          coin.ticker.toLowerCase().includes(tickerTerm) ||
          coin.name.toLowerCase().includes(term) ||
          coin.ca.toLowerCase().includes(term),
      )
    : [...coins].sort(
        (a, b) => Number(Boolean(b.main)) - Number(Boolean(a.main)) || b.volume - a.volume,
      );
  const results = matches.slice(0, 8);

  function dismiss(afterClose?: () => void) {
    if (closeTimer.current !== undefined || closing) return;
    const finish = () => {
      afterClose?.();
      closeRef.current();
    };
    if (reducedMotion) finish();
    else {
      setClosing(true);
      closeTimer.current = setTimeout(finish, 160);
    }
  }

  function select(coin: Coin) {
    dismiss(() => navigate('/coin/' + coin.id));
  }

  // Keep background navigation out of the focus order while the search device is open.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    const appRoot = document.getElementById('root');
    const wasInert = appRoot?.hasAttribute('inert');
    appRoot?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    input.current?.focus();
    return () => {
      clearTimeout(closeTimer.current);
      document.body.style.overflow = previousOverflow;
      if (!wasInert) appRoot?.removeAttribute('inert');
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        dismiss();
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const focusable = [
        ...panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [tabindex="0"]',
        ),
      ];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) return;
      if (
        event.shiftKey &&
        (document.activeElement === first || !panel.current.contains(document.activeElement))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  });

  useEffect(() => {
    document.getElementById(`${id}-coin-${active}`)?.scrollIntoView?.({ block: 'nearest' });
  }, [active, id]);

  return createPortal(
    <div
      className={'coin-search-backdrop' + (closing ? ' is-closing' : '')}
      data-reduced-motion={reducedMotion ? 'true' : undefined}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        ref={panel}
        className="coin-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
      >
        <div className="coin-search-device-top">
          <div className="search-device-lights" aria-hidden="true">
            <span className="search-device-lens" />
            <i />
            <i />
            <i />
          </div>
          <button className="coin-search-close" aria-label="Close search" onClick={() => dismiss()}>
            <Icon name="X" size={18} />
          </button>
        </div>
        <div className="coin-search-screen">
          <header className="coin-search-heading">
            <div>
              <h2 id={`${id}-title`}>Find a coin</h2>
              <p id={`${id}-description`}>Search by ticker, name or contract address.</p>
            </div>
            <Pokeball size={32} />
          </header>
          <div className="coin-search-field">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              ref={input}
              id={`${id}-input`}
              type="search"
              aria-label="Search coins by name, ticker or contract address"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-results`}
              aria-activedescendant={results[active] ? `${id}-coin-${active}` : undefined}
              placeholder="$TICKER or contract address"
              value={query}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (results.length) {
                    setActive(
                      (index) =>
                        (index + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
                        results.length,
                    );
                  }
                } else if (event.key === 'Enter' && results[active]) {
                  event.preventDefault();
                  select(results[active]);
                }
              }}
            />
            {query && (
              <button
                className="coin-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('');
                  setActive(0);
                  input.current?.focus();
                }}
              >
                <Icon name="X" size={14} />
              </button>
            )}
          </div>
          <div className="coin-search-results-heading">
            <span>{term ? 'Search results' : 'Explore coins'}</span>
            <small aria-live="polite">{term ? `${matches.length} found` : 'Around Kanto'}</small>
          </div>
          <div
            className="coin-search-results"
            id={`${id}-results`}
            role="listbox"
            aria-label="Coins"
          >
            {results.map((coin, index) => (
              <button
                key={coin.id}
                id={`${id}-coin-${index}`}
                className={
                  'coin-search-result search-dialog-result' + (active === index ? ' is-active' : '')
                }
                role="option"
                aria-selected={active === index}
                tabIndex={-1}
                onMouseEnter={() => setActive(index)}
                onClick={() => select(coin)}
              >
                <CoinAvatar coin={coin} size={46} />
                <span className="coin-search-result-name">
                  <strong>{coin.name}</strong>
                  <small>
                    ${coin.ticker}
                    <span>{coin.mode === 'Mixed' ? 'Eggs + packs' : coin.mode}</span>
                  </small>
                </span>
                <span className="coin-search-result-detail">
                  <strong>{compact(coin.holders)}</strong>
                  <small>holders</small>
                </span>
                <span className="coin-search-result-arrow">
                  <Icon name="ArrowRight" size={18} />
                </span>
              </button>
            ))}
          </div>
          {!results.length && (
            <div className="coin-search-empty" role="status">
              <Pokeball size={48} />
              <h3>No coins found</h3>
              <p>Try a different ticker, or paste the full contract address.</p>
              <button
                onClick={() => {
                  setQuery('');
                  input.current?.focus();
                }}
              >
                Explore coins
              </button>
            </div>
          )}
        </div>
        <footer className="coin-search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Browse
          </span>
          <span>
            <kbd>↵</kbd> Open coin
          </span>
          <span>
            <kbd>esc</kbd> Close
          </span>
          <div className="search-device-speaker" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
