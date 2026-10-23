import { ListMore, useListWindow } from './ListMore';
import { ContentSkeleton } from './Loading';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Coin } from '../types';
import { compact, navigate } from '../utils';
import { useOptionalApp } from '../state/AppContext';
import { Avatar, CoinAvatar, Icon, Pokeball, PokemonArt } from './UI';
import { lockPageScroll } from './overlay-scroll-lock';
import {
  matchesTrainer,
  ownTrainer,
  searchDemoTrainers,
  trainerDirectory,
  type PublicTrainer,
} from '../services/trainers';

export type SearchCoin = Pick<Coin, 'id' | 'name' | 'ticker' | 'ca'> &
  Partial<Pick<Coin, 'image' | 'color' | 'mode' | 'main' | 'volume' | 'holders'>>;
type SearchEntry = { kind: 'coin'; coin: SearchCoin } | { kind: 'trainer'; trainer: PublicTrainer };

export function SearchDialog({
  coins,
  onClose,
  onSelectCoin,
  selectedCoinCa,
}: {
  coins: SearchCoin[];
  onClose: () => void;
  onSelectCoin?: (coin: SearchCoin) => void;
  selectedCoinCa?: string;
}) {
  const pickingCoin = Boolean(onSelectCoin);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [closing, setClosing] = useState(false);
  const [trainers, setTrainers] = useState<PublicTrainer[]>([]);
  const [trainerLoading, setTrainerLoading] = useState(false);
  const [trainerError, setTrainerError] = useState('');
  const keyboardSelection = useRef(false);
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
  const own = useMemo(
    () => (app ? ownTrainer(app.state, app.mode === 'demo') : undefined),
    [app?.state, app?.mode],
  );
  const term = query.trim().toLowerCase();
  const tickerTerm = term.replace(/^\$/, '');
  const matches = term
    ? coins.filter(
        (coin) =>
          coin.ticker.toLowerCase().includes(tickerTerm) ||
          coin.name.toLowerCase().includes(term) ||
          coin.ca.includes(query.trim()),
      )
    : [...coins].sort(
        (a, b) =>
          Number(Boolean(b.main)) - Number(Boolean(a.main)) || (b.volume || 0) - (a.volume || 0),
      );
  const coinPage = useListWindow(matches, term, term ? 8 : 5);
  const coinResults = coinPage.items;
  const results: SearchEntry[] = [
    ...coinResults.map((coin) => ({ kind: 'coin' as const, coin })),
    ...trainers.map((trainer) => ({ kind: 'trainer' as const, trainer })),
  ];

  useEffect(() => {
    setTrainerError('');
    if (pickingCoin) {
      setTrainers([]);
      setTrainerLoading(false);
      return;
    }
    if (trainerDirectory.mode === 'demo') {
      setTrainers(searchDemoTrainers(query, own));
      setTrainerLoading(false);
      return;
    }
    setTrainers(own && matchesTrainer(own, query) ? [own] : []);
    if (query.trim().length < 2) {
      setTrainerLoading(false);
      return;
    }
    const controller = new AbortController();
    setTrainerLoading(true);
    const timer = setTimeout(() => {
      trainerDirectory
        .search(query, own, controller.signal)
        .then((found) => {
          if (!controller.signal.aborted) setTrainers(found);
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setTrainerError(
              error instanceof Error ? error.message : 'Trainer search is unavailable.',
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setTrainerLoading(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, own, pickingCoin]);

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

  function select(result: SearchEntry) {
    if (result.kind === 'coin' && onSelectCoin) {
      dismiss(() => onSelectCoin(result.coin));
      return;
    }
    dismiss(() =>
      navigate(
        result.kind === 'coin'
          ? '/coin/' + result.coin.id
          : '/trainer/' + encodeURIComponent(result.trainer.wallet),
      ),
    );
  }

  // Keep background navigation out of the focus order while the search device is open.
  useLayoutEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const unlockScroll = lockPageScroll(document);
    const appRoot = document.getElementById('root');
    const wasInert = appRoot?.hasAttribute('inert');
    appRoot?.setAttribute('inert', '');
    input.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(closeTimer.current);
      unlockScroll();
      if (!wasInert) appRoot?.removeAttribute('inert');
      if (previous?.isConnected) previous.focus({ preventScroll: true });
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
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  });

  useEffect(() => {
    if (keyboardSelection.current)
      document.getElementById(`${id}-result-${active}`)?.scrollIntoView?.({ block: 'nearest' });
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
              <h2 id={`${id}-title`}>{pickingCoin ? 'Choose your wager coin' : 'Search Kanto'}</h2>
              <p id={`${id}-description`}>
                {pickingCoin
                  ? 'Find a coin available for token battles.'
                  : 'Find a coin or visit another trainer.'}
              </p>
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
              aria-label={
                pickingCoin
                  ? 'Search wager coins by name, ticker or contract address'
                  : 'Search coins or trainers by name, ticker, contract or wallet address'
              }
              role="combobox"
              aria-autocomplete="list"
              aria-expanded="true"
              aria-controls={`${id}-results`}
              aria-activedescendant={results[active] ? `${id}-result-${active}` : undefined}
              placeholder={
                pickingCoin
                  ? 'Name, $ticker or contract address'
                  : 'Name, $ticker, contract or wallet address'
              }
              value={query}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => {
                keyboardSelection.current = false;
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  if (results.length) {
                    keyboardSelection.current = true;
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
            <span>
              {term ? 'Search results' : pickingCoin ? 'Available coins' : 'Explore Kanto'}
            </span>
            <small aria-live="polite">
              {trainerLoading
                ? 'Finding trainers…'
                : term
                  ? `${matches.length + trainers.length} found`
                  : pickingCoin
                    ? `${matches.length} available`
                    : 'Coins & trainers'}
            </small>
          </div>
          <div
            className="coin-search-results"
            id={`${id}-results`}
            role="listbox"
            aria-label={pickingCoin ? 'Available wager coins' : 'Coins and trainers'}
          >
            {coinResults.length > 0 && (
              <div className="search-result-group" role="presentation">
                Coins
              </div>
            )}
            {coinResults.map((coin, index) => (
              <button
                key={coin.id}
                id={`${id}-result-${index}`}
                className={
                  'coin-search-result search-dialog-result' + (active === index ? ' is-active' : '')
                }
                role="option"
                aria-selected={active === index}
                tabIndex={-1}
                onMouseEnter={() => {
                  keyboardSelection.current = false;
                  setActive(index);
                }}
                onClick={() => select({ kind: 'coin', coin })}
              >
                <CoinAvatar coin={coin} size={46} />
                <span className="coin-search-result-name">
                  <strong>{coin.name}</strong>
                  <small>
                    ${coin.ticker}
                    <span>
                      {pickingCoin
                        ? coin.ca.slice(0, 5) + '…' + coin.ca.slice(-5)
                        : coin.mode === 'Mixed'
                          ? 'Eggs + packs'
                          : coin.mode}
                    </span>
                  </small>
                </span>
                <span className="coin-search-result-detail">
                  {pickingCoin ? (
                    <small>{selectedCoinCa === coin.ca ? 'Selected' : 'Select coin'}</small>
                  ) : (
                    <>
                      <strong>{compact(coin.holders || 0)}</strong>
                      <small>holders</small>
                    </>
                  )}
                </span>
                <span className="coin-search-result-arrow">
                  <Icon
                    name={pickingCoin && selectedCoinCa === coin.ca ? 'Check' : 'ArrowRight'}
                    size={18}
                  />
                </span>
              </button>
            ))}
            {trainers.length > 0 && (
              <div className="search-result-group" role="presentation">
                Trainers
              </div>
            )}
            {trainers.map((trainer, offset) => {
              const index = coinResults.length + offset;
              const partner = trainer.pokemon.find((pokemon) => pokemon.id === trainer.partnerId);
              return (
                <button
                  key={trainer.wallet}
                  id={`${id}-result-${index}`}
                  className={
                    'coin-search-result trainer-search-result search-dialog-result' +
                    (active === index ? ' is-active' : '')
                  }
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  onMouseEnter={() => {
                    keyboardSelection.current = false;
                    setActive(index);
                  }}
                  onClick={() => select({ kind: 'trainer', trainer })}
                >
                  <Avatar profile={trainer} size={46} />
                  <span className="coin-search-result-name">
                    <strong>
                      {trainer.displayName}
                      {trainer.wallet === own?.wallet && <em>You</em>}
                    </strong>
                    <small className="trainer-search-wallet">
                      {trainer.wallet.slice(0, 8)}…{trainer.wallet.slice(-6)}
                      {trainer.demo && trainer.wallet !== own?.wallet && (
                        <span>Sample trainer</span>
                      )}
                    </small>
                  </span>
                  {partner && (
                    <span className="trainer-search-partner">
                      <PokemonArt
                        id={partner.speciesId}
                        shiny={partner.shiny}
                        animated={false}
                        frameFill={88}
                      />
                    </span>
                  )}
                  <span className="coin-search-result-arrow">
                    <Icon name="ArrowRight" size={18} />
                  </span>
                </button>
              );
            })}
            {trainerError && (
              <p className="trainer-search-error" role="status">
                {trainerError}
              </p>
            )}
            {trainerLoading && !results.length && (
              <ContentSkeleton kind="rows" label="Looking for a trainer" />
            )}
            {!results.length && !trainerLoading && (
              <div className="coin-search-empty" role="status">
                <Pokeball size={48} />
                <h3>{trainerLoading ? 'Looking for a trainer…' : 'No matches found'}</h3>
                <p>
                  {pickingCoin
                    ? 'Try another name, ticker or contract address. Only supported wager coins appear here.'
                    : trainerDirectory.mode === 'demo'
                      ? 'Try a coin, your wallet, or a sample trainer such as Leaf. The demo directory only includes these profiles.'
                      : 'Try a different name, ticker, contract address or registered trainer wallet.'}
                </p>
                <button
                  onClick={() => {
                    setQuery('');
                    setActive(0);
                    input.current?.focus();
                  }}
                >
                  {pickingCoin ? 'Show available coins' : 'Explore coins & trainers'}
                </button>
              </div>
            )}
          </div>
          <ListMore {...coinPage} label="Load more matching coins" />
        </div>
        <footer className="coin-search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> Browse
          </span>
          <span>
            <kbd>↵</kbd> {pickingCoin ? 'Select coin' : 'Open result'}
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
