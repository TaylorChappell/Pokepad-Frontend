import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { profileName } from '../state/model';
import { Icon, Pokeball, Wordmark, Avatar, PokemonArt, type IconName } from './UI';
import { asset, navigate, relativeTime } from '../utils';
import { SidebarBuddy } from './SidebarBuddy';
import { SearchDialog } from './SearchDialog';
const nav: { path: string; label: string; icon: IconName; group?: string }[] = [
  { path: '/discover', label: 'Discover', icon: 'Compass' },
  { path: '/create', label: 'Create Coin', icon: 'Plus' },
  { path: '/portfolio', label: 'Portfolio', icon: 'Wallet' },
  { path: '/rewards', label: 'Rewards', icon: 'Candy' },
  { path: '/analytics', label: 'Analytics', icon: 'Activity' },
  { path: '/pokemon', label: 'My PC', icon: 'Pokeball', group: 'TRAINER' },
  { path: '/pokedex', label: 'Pokédex', icon: 'BookOpen' },
  { path: '/marketplace', label: 'Marketplace', icon: 'Grid2X2' },
  { path: '/battles', label: 'Battle arena', icon: 'Swords', group: 'LEAGUE' },
  { path: '/gyms', label: 'Gyms', icon: 'Gym' },
  { path: '/guide', label: 'How-to', icon: 'BookOpen' },
];
export function Layout({ path, children }: { path: string; children: ReactNode }) {
  const { state, act, mode } = useApp(),
    [panel, setPanel] = useState<'notifications' | 'account' | null>(null),
    [mobile, setMobile] = useState(false),
    [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const header = useRef<HTMLElement>(null);
  const unread = state.notifications.filter((n) => !n.read).length;
  useEffect(() => {
    setPanel(null);
    setMobile(false);
    setSearchOpen(false);
    window.scrollTo(0, 0);
  }, [path]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (!header.current?.contains(e.target as Node)) {
        setPanel(null);
      }
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanel(null);
        setMobile(false);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPanel(null);
        setMobile(false);
        setSearchOpen(true);
      }
    };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', click);
      document.removeEventListener('keydown', key);
    };
  }, []);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="topbar" ref={header}>
        <div className="brand-area">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Icon name="Menu" />
          </button>
          <a href="#/discover" className="brand" aria-label="Poképad home">
            <Wordmark />
          </a>
        </div>
        <div className="topbar-middle" />
        <div className="topbar-actions">
          <button
            className="search-trigger"
            aria-label="Search coins and trainers"
            aria-haspopup="dialog"
            aria-expanded={searchOpen}
            onClick={() => {
              setPanel(null);
              setMobile(false);
              setSearchOpen(true);
            }}
          >
            <img
              className="search-trigger-art"
              src={asset('brand/search.png')}
              alt=""
              width={29}
              height={29}
              aria-hidden="true"
            />
            <span>Search Poképad</span>
            <kbd>⌘ / Ctrl K</kbd>
          </button>
          <button
            className={
              'icon-button notification-button ' + (panel === 'notifications' ? 'selected' : '')
            }
            aria-label={'Notifications, ' + unread + ' unread'}
            aria-expanded={panel === 'notifications'}
            onClick={() => {
              setPanel(panel === 'notifications' ? null : 'notifications');
              setSearchOpen(false);
            }}
          >
            <Icon name="Bell" size={24} />
            {unread > 0 && <span className="unread-dot" />}
          </button>
          <div className="header-separator" />
          <button
            className="account-button"
            aria-label="Open account menu"
            aria-expanded={panel === 'account'}
            onClick={() => {
              setPanel(panel === 'account' ? null : 'account');
              setSearchOpen(false);
            }}
          >
            <span className="avatar-wrap">
              <Avatar profile={state.profile} size={54} />
            </span>
            <span className="account-name">
              {profileName(state)}
              <small>Pokémon trainer</small>
            </span>
            <Icon name="ChevronDown" size={14} />
          </button>
          {panel === 'notifications' && (
            <div className="header-dropdown notification-dropdown">
              <div className="dropdown-heading">
                <h3>
                  Notifications <span className="count-pill">{unread}</span>
                </h3>
                <button onClick={() => act({ type: 'notification.read' })}>Mark all read</button>
              </div>
              {state.notifications.length ? (
                state.notifications.slice(0, 8).map((n) => (
                  <button
                    className={'notification-item ' + (!n.read ? 'unread' : '')}
                    key={n.id}
                    onClick={async () => {
                      await act({ type: 'notification.read', id: n.id });
                      navigate(n.href);
                      setPanel(null);
                    }}
                  >
                    <span className={'notification-symbol ' + n.kind}>
                      {n.pokemonId ? (
                        <PokemonArt id={n.pokemonId} />
                      ) : (
                        <Icon
                          name={
                            n.kind === 'egg' ? 'Egg' : n.kind === 'pack' ? 'Package' : 'Sparkles'
                          }
                          size={22}
                        />
                      )}
                    </span>
                    <span>
                      <strong>{n.title}</strong>
                      <small>{n.description}</small>
                      <time>{relativeTime(n.createdAt)}</time>
                    </span>
                    {!n.read && <i />}
                  </button>
                ))
              ) : (
                <p className="muted">You’re all caught up.</p>
              )}
              <a className="dropdown-footer" href="#/activity">
                View all activity <Icon name="ArrowRight" size={14} />
              </a>
            </div>
          )}
          {panel === 'account' && (
            <div className="header-dropdown account-dropdown" onClick={() => setPanel(null)}>
              <div className="dropdown-profile">
                <Avatar profile={state.profile} size={46} />
                <span>
                  <strong>{profileName(state)}</strong>
                  <small>{mode === 'demo' ? 'Demo trainer' : 'Trainer account'}</small>
                </span>
              </div>
              <a href="#/profile">
                <Icon name="Users" />
                Trainer profile
              </a>
              <a href="#/settings">
                <Icon name="Settings" />
                Settings & appearance
              </a>
              <a href="#/activity">
                <Icon name="Activity" />
                Your activity
              </a>
              <div className="menu-divider" />
              <a href="#/settings?tab=wallet">
                <Icon name="Wallet" />
                Wallet & connection
              </a>
            </div>
          )}
        </div>
      </header>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={'sidebar ' + (mobile ? 'mobile-open' : '')}>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <div key={item.path}>
              {item.group && <span className="nav-group">{item.group}</span>}
              <a
                href={'#' + item.path}
                className={
                  path === item.path ||
                  path.startsWith(item.path + '/') ||
                  (item.path === '/discover' &&
                    ['/coin', '/explore'].some((p) => path.startsWith(p)))
                    ? 'nav-link active'
                    : 'nav-link'
                }
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                {item.path === '/rewards' && (
                  <span className="nav-count">
                    {state.rewards.filter((r) => !r.openedAt).length}
                  </span>
                )}
              </a>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <SidebarBuddy path={path} />
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="main-content">
        {children}
        <footer className="page-footer">
          <Pokeball size={17} />
          <span>POKéPAD · KANTO</span>
          <a href="#/guide">
            Trainer handbook <Icon name="ArrowUpRight" size={12} />
          </a>
        </footer>
      </main>
      {searchOpen && <SearchDialog coins={state.coins} onClose={closeSearch} />}
    </div>
  );
}
