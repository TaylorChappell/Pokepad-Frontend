import { Component, useEffect, useState, type ReactNode } from 'react';
import { AppProvider } from './state/AppContext';
import { Layout } from './components/Layout';
import { EmptyState } from './components/UI';
import { DiscoverPage, CoinPage } from './pages/Discover';
import { RewardsPage, WalkPage } from './pages/Rewards';
import { InventoryPage, PokemonDetailPage, PokedexPage, MarketplacePage } from './pages/Collection';
import {
  PortfolioPage,
  ProfilePage,
  SettingsPage,
  ActivityPage,
  StarterPage,
  CreatorPage,
} from './pages/Account';
import { GymsPage, GymDetailPage } from './pages/Community';
import { CreateCoinPage } from './pages/CreateCoin';
import { GuidePage } from './pages/Guide';
import { BattlesPage } from './pages/Battles';
import { dismissBootScreen } from './components/BootScreen';
function useRoute() {
  const read = () => window.location.hash.slice(1) || '/discover';
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const update = () => setRoute(read());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  const [path, query] = route.split('?');
  return { path, params: new URLSearchParams(query) };
}
function Routes() {
  const { path, params } = useRoute();
  let page: ReactNode;
  if (path === '/' || path === '/discover') page = <DiscoverPage />;
  else if (path === '/explore') page = <DiscoverPage explore />;
  else if (path.startsWith('/coin/')) page = <CoinPage key={path} id={path.split('/')[2]} />;
  else if (path === '/guide') page = <GuidePage />;
  else if (path === '/create') page = <CreateCoinPage />;
  else if (path === '/portfolio') page = <PortfolioPage />;
  else if (path === '/rewards') page = <RewardsPage initialTab={params.get('tab') || 'eggs'} />;
  else if (path === '/walking' || path === '/walk') page = <WalkPage />;
  else if (path === '/pokemon') page = <InventoryPage />;
  else if (path.startsWith('/pokemon/'))
    page = <PokemonDetailPage key={path} id={path.split('/')[2]} />;
  else if (path === '/pokedex')
    page = (
      <PokedexPage
        key={params.get('species') || 'all'}
        selectedId={Number(params.get('species')) || undefined}
      />
    );
  else if (path === '/marketplace') page = <MarketplacePage />;
  else if (path === '/gyms') page = <GymsPage />;
  else if (path.startsWith('/gym/')) page = <GymDetailPage key={path} id={path.split('/')[2]} />;
  else if (path === '/battles' || path === '/battle') page = <BattlesPage />;
  else if (path === '/profile') page = <ProfilePage />;
  else if (path === '/settings') page = <SettingsPage tab={params.get('tab') || 'profile'} />;
  else if (path === '/activity') page = <ActivityPage />;
  else if (path === '/starter') page = <StarterPage />;
  else if (path === '/creator') page = <CreatorPage />;
  else
    page = (
      <EmptyState
        title="Page not found"
        description="This page doesn’t exist. Return to Discover to continue."
      >
        <a href="#/discover" className="button primary">
          Back to Poképad
        </a>
      </EmptyState>
    );
  useEffect(() => {
    const label = path.split('/')[1] || 'Discover';
    document.title = label.charAt(0).toUpperCase() + label.slice(1) + ' · Poképad';
  }, [path]);
  return <Layout path={path}>{page}</Layout>;
}
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch() {
    dismissBootScreen({ immediate: true });
  }
  render() {
    return this.state.error ? (
      <div className="app-loading">
        <div className="pokeball-mark" />
        <h1>Unable to load this page</h1>
        <p>Please reload to try again.</p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Routes />
      </AppProvider>
    </ErrorBoundary>
  );
}
