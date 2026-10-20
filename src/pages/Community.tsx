import { useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { collectionValue, profileName } from '../state/model';
import { gymRankings } from '../state/gyms';
import {
  Avatar,
  Badge,
  Button,
  CoinAvatar,
  EmptyState,
  Icon,
  Modal,
  PageHeading,
  PokemonArt,
  SolValue,
} from '../components/UI';
import { sol } from '../utils';
export function GymsPage() {
  const { state } = useApp(),
    ranked = gymRankings(state),
    champion = ranked.find((g) => g.score > 0) || ranked.find((g) => g.coin.main)!,
    [filter, setFilter] = useState('All gyms');
  const rows = ranked.filter(
    (g) =>
      filter === 'All gyms' ||
      (filter === 'My gym' && g.coinId === state.profile.supportedGym) ||
      (filter === 'My communities' && g.coin.holding > 0),
  );
  return (
    <div className="gym-screen">
      <PageHeading
        title="Gyms"
        description="Support one coin’s gym with the Pokémon in your inventory."
      />
      <section className="gym-spotlight">
        <div className="gym-spotlight-copy">
          <span className="gym-hall-plate">CHAMPION GYM</span>
          <h1>{champion.name}</h1>
          <p>Gym rankings are based on the Pokémon value supported by their trainers.</p>
          <div className="featured-stats">
            <span>
              <strong>{sol(champion.score)} SOL</strong>supported inventory
            </span>
            <span>
              <strong>{champion.supporters}</strong>supporters
            </span>
          </div>
          <a className="button primary" href={'#/gym/' + champion.coinId}>
            Visit the gym
            <Icon name="ArrowRight" size={16} />
          </a>
        </div>
        <div className="gym-illustration">
          <div className="gym-cloud" />
          <div className="gym-building">
            <div className="gym-roof" />
            <div className="gym-sign">GYM</div>
            <div className="gym-window left" />
            <div className="gym-window right" />
            <div className="gym-door" />
            <Badge label={champion.badge} color={champion.color} size={72} />
          </div>
          {champion.coin.pokemonId > 0 ? (
            <PokemonArt id={champion.coin.pokemonId} animated={false} />
          ) : (
            <Avatar profile={champion.coin.trainer || state.profile} size={150} />
          )}
          <span className="gym-bush bush-one" />
          <span className="gym-bush bush-two" />
        </div>
      </section>
      <div className="gym-rule-strip">
        <span>
          Each trainer supports one gym. Your Pokémon’s funded value counts towards its rank.
        </span>
        <a href="#/guide">
          How it works
          <Icon name="ArrowRight" size={14} />
        </a>
      </div>
      <div className="section-heading">
        <h2>Gym leaderboard</h2>
        <div className="filter-pills">
          {['All gyms', 'My communities', 'My gym'].map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="panel gym-leaderboard">
        <div className="gym-table-header">
          <span>RANK</span>
          <span>COMMUNITY</span>
          <span>TRAINERS</span>
          <span>SUPPORTED INVENTORY</span>
          <span />
        </div>
        {rows.map((g) => (
          <a
            className={
              'gym-leaderboard-row ' + (g.coinId === state.profile.supportedGym ? 'my-gym' : '')
            }
            href={'#/gym/' + g.coinId}
            key={g.coinId}
          >
            <span className={'rank ' + (ranked.indexOf(g) === 0 ? 'gold' : '')}>
              {String(ranked.indexOf(g) + 1).padStart(2, '0')}
            </span>
            <div className="gym-row-name">
              <Badge label={g.badge} color={g.color} size={50} />
              <span>
                <strong>{g.name}</strong>
                <small>
                  {'$' + g.coin.ticker}
                  {state.profile.supportedGym === g.coinId && <em>Your gym</em>}
                </small>
              </span>
            </div>
            <span>
              <Icon name="Users" size={14} />
              {g.supporters}
            </span>
            <SolValue amount={g.score} />
            <Icon name="ChevronRight" size={18} />
          </a>
        ))}
        {!rows.length && (
          <EmptyState
            title="No gyms match this filter"
            description="Hold an active coin and choose the gym you’d like to support."
          />
        )}
      </div>
      <p className="ranking-note">
        <Icon name="Info" size={14} />
        Ranked by the funded SOL backing of current supporter inventories. Listing prices don’t
        count. If no gym qualifies, $POKE takes the spotlight.
      </p>
    </div>
  );
}
export function GymDetailPage({ id }: { id: string }) {
  const { state, act, busy, toast } = useApp(),
    ranked = gymRankings(state),
    gym = ranked.find((g) => g.coinId === id),
    [tab, setTab] = useState('Overview'),
    [confirm, setConfirm] = useState(false);
  if (!gym)
    return (
      <EmptyState
        title="Gym unavailable"
        description="Only active coin communities can compete for the spotlight."
      >
        <a href="#/gyms" className="button primary">
          Explore gyms
        </a>
      </EmptyState>
    );
  const supporting = state.profile.supportedGym === id,
    rank = ranked.indexOf(gym) + 1;
  return (
    <div className="gym-screen">
      <a className="button secondary arena-back" href="#/gyms">
        <Icon name="ArrowLeft" size={16} />
        Back to gyms
      </a>
      <section className="gym-detail-hero" style={{ '--gym-color': gym.color } as CSSProperties}>
        <Badge label={gym.badge} color={gym.color} size={96} />
        <div>
          <span className="gym-hall-plate">{rank === 1 ? 'CHAMPION GYM' : 'KANTO GYM'}</span>
          <h1>{gym.name}</h1>
          <p>{'$' + gym.coin.ticker} community gym</p>
          <span className="status-tag">
            <Icon name="Trophy" size={13} />
            Rank #{rank}
          </span>
        </div>
        {gym.coin.pokemonId > 0 ? (
          <PokemonArt id={gym.coin.pokemonId} animated={false} />
        ) : (
          <Avatar profile={gym.coin.trainer || state.profile} size={150} />
        )}
        <Button
          variant={supporting ? 'secondary' : 'primary'}
          disabled={supporting || !gym.coin.holding}
          onClick={() => setConfirm(true)}
        >
          <Icon name={supporting ? 'Check' : 'Heart'} size={16} />
          {supporting
            ? 'Your gym'
            : gym.coin.holding
              ? 'Support this gym'
              : 'Hold $' + gym.coin.ticker + ' to support'}
        </Button>
      </section>
      <div className="stats-grid panels-margin">
        <div className="stat-card">
          <span>
            <Icon name="Heart" />
            Supported inventory
          </span>
          <strong>
            {sol(gym.score)} <small>SOL</small>
          </strong>
          <small>Funded backing of supporters’ Pokémon</small>
        </div>
        <div className="stat-card">
          <span>
            <Icon name="Users" />
            Our community
          </span>
          <strong>{gym.supporters}</strong>
          <small>Current supporters</small>
        </div>
        <div className="stat-card">
          <span>
            <Icon name="Shield" />
            Your contribution
          </span>
          <strong>
            {supporting ? sol(collectionValue(state)) : '0'} <small>SOL</small>
          </strong>
          <small>
            {supporting ? 'Your current Pokémon inventory' : 'Choose this gym to contribute'}
          </small>
        </div>
      </div>
      <div className="tab-bar">
        {['Overview', 'Trainers', 'Gym badge'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Overview' ? (
        <div className="two-column panels-margin">
          <div className="panel inset">
            <h2>About this gym</h2>
            <p>{gym.coin.description}</p>
            <p>
              Support one gym at a time. Your current Pokémon collection contributes its reserved
              SOL value to that team. Changing teams moves your contribution with you.
            </p>
            <a className="gym-coin-link" href={'#/coin/' + gym.coinId}>
              <CoinAvatar coin={gym.coin} />
              <span>
                <strong>{gym.coin.name}</strong>
                <small>{'$' + gym.coin.ticker}</small>
              </span>
              <Icon name="ArrowUpRight" />
            </a>
          </div>
          <div className="panel inset gym-badge-panel">
            <Badge label={gym.badge} color={gym.color} size={110} />
            <h2>The {gym.badge} badge</h2>
            <p>Displayed on the profiles of this gym’s supporters.</p>
            <Button variant="secondary" onClick={() => setTab('Gym badge')}>
              View badge
              <Icon name="Eye" size={15} />
            </Button>
          </div>
        </div>
      ) : tab === 'Trainers' ? (
        <div className="panel gym-trainers panels-margin">
          {[...(supporting ? [profileName(state)] : []), 'Leaf', 'Red', 'Misty', 'Brock'].map(
            (n, i) => (
              <div className="trainer-row" key={n + i}>
                <span className="rank">{i + 1}</span>
                <Avatar
                  profile={{
                    character: (['leaf', 'red', 'misty', 'brock'] as const)[i % 4],
                    accessoryColor: ['#65b883', '#ef5357', '#efb13f', '#4e9ee8'][i % 4],
                  }}
                />
                <span>
                  <strong>{n}</strong>
                  <small>
                    {supporting && i === 0 ? 'Your contribution' : 'Sample community trainer'}
                  </small>
                </span>
                <SolValue
                  amount={
                    supporting && i === 0 ? collectionValue(state) : [12.4, 9.8, 8.6, 7.2, 4.8][i]
                  }
                />
              </div>
            ),
          )}
        </div>
      ) : (
        <div className="panel badge-detail panels-margin">
          <Badge label={gym.badge} color={gym.color} size={170} />
          <h2>{gym.badge} badge</h2>
          <p>
            Every coin has a gym badge based on its ticker. Your supported gym appears on your
            trainer profile.
          </p>
          <a href="#/profile" className="button secondary">
            View trainer profile
            <Icon name="ArrowRight" size={15} />
          </a>
        </div>
      )}
      {confirm && (
        <Modal title={'Join ' + gym.name + '?'} onClose={() => setConfirm(false)}>
          <div className="modal-body support-modal">
            <Badge label={gym.badge} color={gym.color} size={94} />
            <h3>Change supported gym</h3>
            <p>
              Your {sol(collectionValue(state))} SOL of Pokémon backing will support {gym.name}.
              Your previous gym will lose that contribution.
            </p>
            <div className="notice">
              <Icon name="Heart" />
              Your Pokémon stay in your inventory.
            </div>
            <Button
              className="full-width"
              disabled={busy}
              onClick={async () => {
                if (await act({ type: 'gym.support', id })) {
                  toast('Welcome to ' + gym.name + '!');
                  setConfirm(false);
                }
              }}
            >
              Support this gym
              <Icon name="Check" size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
