import type { ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { Avatar, Pokeball } from './UI';
import { WalletConnection } from './WalletConnection';
import { asset } from '../utils';

const destinations: Record<string, { title: string; description: string; item: string }> = {
  admin: {
    title: 'Kanto control room',
    description: 'Connect an approved admin wallet to manage Kanto.',
    item: 'poke-ball',
  },
  portfolio: {
    title: 'Your portfolio awaits',
    description: 'Connect your wallet to see your coins, holdings and Pokémon value.',
    item: 'coin-case',
  },
  rewards: {
    title: 'Your next discovery awaits',
    description:
      'Any rewards you earn are saved to your wallet, even before your first visit. Connect to open your packs and hatch your eggs.',
    item: 'lucky-egg',
  },
  pokemon: {
    title: 'Your PC is ready',
    description: 'Connect your wallet to meet your Pokémon, choose a partner and build your team.',
    item: 'poke-ball',
  },
  battles: {
    title: 'Every battle starts with a trainer',
    description: 'Connect your wallet to choose your team and enter the arena.',
    item: 'great-ball',
  },
  create: {
    title: 'Start something of your own',
    description: 'Connect your wallet to launch a coin and give your community a home.',
    item: 'amulet-coin',
  },
};
export function walletDestination(path: string) {
  const root = path.split('/')[1];
  if (['battle'].includes(root)) return destinations.battles;
  if (['walk', 'walking'].includes(root)) return destinations.rewards;
  if (root === 'marketplace') return destinations.pokemon;
  if (['profile', 'settings', 'activity', 'starter'].includes(root))
    return {
      title: 'Your trainer journey starts here',
      description: 'Connect your wallet to open your trainer profile.',
      item: 'poke-ball',
    };
  return destinations[root];
}
export function WalletGate({ path, children }: { path: string; children: ReactNode }) {
  const { mode, session, state } = useApp();
  const destination = walletDestination(path);
  if (
    mode === 'demo' ||
    !destination ||
    (session.status === 'authenticated' && session.wallet === state.profile.wallet)
  )
    return children;
  return (
    <section className="trainer-gate" aria-labelledby="trainer-gate-title">
      <div className="trainer-pass" aria-hidden="true">
        <div className="trainer-pass-heading">
          <img src={asset('brand/kanto-emblem.png')} alt="" />
          <span>KANTO TRAINER CARD</span>
          <span className="trainer-pass-chip" />
        </div>
        <div className="trainer-pass-screen">
          <Avatar
            profile={{ ...state.profile, character: 'red', accessoryColor: '#ef5357' }}
            size={148}
          />
          <div>
            <small>TRAINER</small>
            <strong>You?</strong>
            <span>Wallet not linked</span>
          </div>
        </div>
        <div className="trainer-pass-footer">
          <span>Your team starts here</span>
          <div>
            <Pokeball size={21} />
            <Pokeball size={21} />
            <Pokeball size={21} />
          </div>
        </div>
      </div>
      <div className="trainer-gate-copy">
        <div className="trainer-gate-item" aria-hidden="true">
          <img src={asset('pixel/items/' + destination.item + '.png')} alt="" />
        </div>
        <h1 id="trainer-gate-title">{destination.title}</h1>
        <p>{destination.description}</p>
        <WalletConnection />
        <a className="trainer-gate-explore" href="#/discover">
          Keep exploring Kanto <span aria-hidden="true">→</span>
        </a>
      </div>
    </section>
  );
}
