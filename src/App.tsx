import { Component, useEffect, useState, type ReactNode } from 'react';
import { LoadingCoordinator } from './components/Loading';
import { AppProvider } from './state/AppContext';
import { Layout } from './components/Layout';
import { TrainerPrompts } from './components/TrainerPrompts';
import { EmptyState } from './components/UI';
import { DiscoverPage, CoinPage } from './pages/Discover';
import { RewardsPage, WalkPage } from './pages/Rewards';
import { InventoryPage, PokemonDetailPage, PokedexPage } from './pages/Collection';
import {
  PortfolioPage,
  ProfilePage,
  SettingsPage,
  ActivityPage,
  StarterPage,
} from './pages/Account';
import { GymsPage, GymDetailPage } from './pages/Community';
import { CreateCoinPage } from './pages/CreateCoin';
import { GuidePage } from './pages/Guide';
import { LegalPage } from './pages/Legal';
import { BattlesPage } from './pages/Battles';
import { AnalyticsPage } from './pages/Analytics';
import { TrainerPage } from './pages/Trainer';
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
  else if (path === '/analytics') page = <AnalyticsPage />;
  else if (path.startsWith('/trainer/'))
    page = <TrainerPage wallet={path.slice('/trainer/'.length)} />;
  else if (path.startsWith('/coin/')) page = <CoinPage key={path} id={path.split('/')[2]} />;
  else if (path === '/guide') page = <GuidePage />;
  else if (path === '/terms' || path === '/privacy')
    page = <LegalPage kind={path === '/terms' ? 'terms' : 'privacy'} />;
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
  else if (path === '/marketplace') page = <InventoryPage />;
  else if (path === '/gyms') page = <GymsPage />;
  else if (path.startsWith('/gym/')) page = <GymDetailPage key={path} id={path.split('/')[2]} />;
  else if (path === '/battles' || path === '/battle') page = <BattlesPage />;
  else if (path === '/profile') page = <ProfilePage />;
  else if (path === '/settings') page = <SettingsPage tab={params.get('tab') || 'profile'} />;
  else if (path === '/activity') page = <ActivityPage />;
  else if (path === '/starter') page = <StarterPage />;
  else
    page = (
      <EmptyState
        title="Page not found"
        description="This page doesn’t exist. Return to Discover to continue."
      >
        <a href="#/discover" className="button primary">
          Back to Kanto
        </a>
      </EmptyState>
    );
  useEffect(() => {
    if (path === '/marketplace') {
      window.location.replace('#/pokemon');
      return;
    }
    const label =
      path === '/terms'
        ? 'Terms of Service'
        : path === '/privacy'
          ? 'Privacy Policy'
          : path.split('/')[1] || 'Discover';
    document.title = label.charAt(0).toUpperCase() + label.slice(1) + ' · Kanto';
  }, [path]);
  return (
    <>
      <Layout path={path}>{page}</Layout>
      {!['/terms', '/privacy'].includes(path) && <TrainerPrompts />}
    </>
  );
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
        <LoadingCoordinator />
      </AppProvider>
    </ErrorBoundary>
  );
}
