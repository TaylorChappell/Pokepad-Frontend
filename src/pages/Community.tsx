import { useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { collectionValue } from '../state/model';
import { gymRankings } from '../state/gyms';
import { DEMO_TRAINERS, ownTrainer } from '../services/trainers';
import {
  Avatar,
  Badge,
  Button,
  CoinAvatar,
  EmptyState,
  Icon,
  Modal,
  PokemonArt,
  SolValue,
} from '../components/UI';
import { compact, sol } from '../utils';

type Gym = ReturnType<typeof gymRankings>[number];
function GymPartner({ gym }: { gym: Gym }) {
  const { state } = useApp();
  return (
    <div className="league-partner-stage" aria-label={gym.name + ' partner'}>
      <div className="league-stage-ring" aria-hidden="true" />
      {gym.coin.pokemonId > 0 ? (
        <PokemonArt id={gym.coin.pokemonId} shiny={gym.coin.pokemonShiny} animated={false} />
      ) : (
        <Avatar profile={gym.coin.trainer || state.profile} size={110} />
      )}
    </div>
  );
}

export function GymsPage() {
  const { state } = useApp();
  const ranked = gymRankings(state);
  const champion =
    ranked.find((gym) => gym.score > 0) || ranked.find((gym) => gym.coin.main) || ranked[0];
  const supported = ranked.find((gym) => gym.coinId === state.profile.supportedGym);
  const [filter, setFilter] = useState('All gyms');
  const rows = ranked.filter(
    (gym) =>
      filter === 'All gyms' ||
      (filter === 'My gym' && gym.coinId === state.profile.supportedGym) ||
      (filter === 'My communities' && gym.coin.holding > 0),
  );
  return (
    <div className="league-page">
      <header className="league-page-heading">
        <div>
          <h1>Gyms</h1>
          <p>Choose your community. Put your collection behind it.</p>
        </div>
        <a className="league-help-link" href="#/guide?topic=gyms">
          How gyms work <Icon name="ArrowUpRight" size={15} />
        </a>
      </header>
      {champion && (
        <div className="league-overview">
          <section
            className="league-champion"
            style={{ '--league-color': champion.color } as CSSProperties}
          >
            <div className="league-champion-copy">
              <span className="league-leader-label">
                <Icon name="Trophy" size={15} /> Leading gym
              </span>
              <div className="league-champion-name">
                <Badge label={champion.badge} color={champion.color} size={58} />
                <div>
                  <h2>{champion.name}</h2>
                  <span>${champion.coin.ticker} community</span>
                </div>
              </div>
              <div className="league-champion-stats">
                <div>
                  <SolValue amount={champion.score} />
                  <small>Supported Pokémon value</small>
                </div>
                <div>
                  <strong>{compact(champion.supporters)}</strong>
                  <small>Trainers</small>
                </div>
              </div>
              <a className="league-visit-link" href={'#/gym/' + champion.coinId}>
                Visit the gym <Icon name="ArrowRight" size={16} />
              </a>
            </div>
            <GymPartner gym={champion} />
          </section>
          <aside className="league-your-gym">
            <span className="league-section-label">Your gym</span>
            {supported ? (
              <>
                <div className="league-support-identity">
                  <Badge label={supported.badge} color={supported.color} size={48} />
                  <div>
                    <strong>{supported.name}</strong>
                    <span>Rank #{ranked.indexOf(supported) + 1}</span>
                  </div>
                  <span className="league-support-check">
                    <Icon name="Check" size={14} />
                  </span>
                </div>
                <div className="league-your-contribution">
                  <span>Your contribution</span>
                  <SolValue amount={collectionValue(state)} />
                </div>
                <a href={'#/gym/' + supported.coinId}>
                  Open your gym <Icon name="ArrowRight" size={15} />
                </a>
              </>
            ) : (
              <>
                <div className="league-no-support">
                  <Icon name="Pokeball" size={32} />
                  <strong>Find your team</strong>
                </div>
                <p>
                  Support one of the coins you hold. Your Pokémon collection counts towards its
                  rank.
                </p>
                <button onClick={() => setFilter('My communities')}>
                  See my communities <Icon name="ArrowRight" size={15} />
                </button>
              </>
            )}
          </aside>
        </div>
      )}
      <section className="league-board" aria-labelledby="league-board-title">
        <header className="league-board-heading">
          <div>
            <h2 id="league-board-title">Gym leaderboard</h2>
            <span>{ranked.length} active communities</span>
          </div>
          <div className="league-filters" aria-label="Filter gyms">
            {['All gyms', 'My communities', 'My gym'].map((item) => (
              <button
                key={item}
                className={filter === item ? 'active' : ''}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </header>
        <div className="league-table">
          <div className="league-table-heading" aria-hidden="true">
            <span>Rank</span>
            <span>Community</span>
            <span>Trainers</span>
            <span>Pokémon value</span>
            <span />
          </div>
          {rows.map((gym) => (
            <a
              className={
                'league-row' + (gym.coinId === state.profile.supportedGym ? ' is-supported' : '')
              }
              href={'#/gym/' + gym.coinId}
              key={gym.coinId}
            >
              <span className={'league-rank' + (ranked.indexOf(gym) === 0 ? ' is-first' : '')}>
                {String(ranked.indexOf(gym) + 1).padStart(2, '0')}
              </span>
              <div className="league-row-community">
                <Badge label={gym.badge} color={gym.color} size={45} />
                <span>
                  <strong>{gym.name}</strong>
                  <small>
                    ${gym.coin.ticker}
                    {state.profile.supportedGym === gym.coinId && <em>Your gym</em>}
                  </small>
                </span>
              </div>
              <span className="league-row-trainers">
                <Icon name="Users" size={14} />
                {compact(gym.supporters)}
              </span>
              <div className="league-row-value">
                <SolValue amount={gym.score} />
                <span className="league-score-track" aria-hidden="true">
                  <i
                    style={{
                      width:
                        (champion?.score ? Math.max(0, (gym.score / champion.score) * 100) : 0) +
                        '%',
                    }}
                  />
                </span>
              </div>
              <Icon name="ChevronRight" size={16} />
            </a>
          ))}
          {!rows.length && (
            <EmptyState
              title="No gyms match this filter"
              description="Hold an active coin and choose the gym you’d like to support."
            />
          )}
        </div>
      </section>
      <p className="league-ranking-note">
        <Icon name="Info" size={14} />
        One trainer, one gym. Rankings use Pokémon’s funded value; listing prices do not change the
        score.
      </p>
    </div>
  );
}

export function GymDetailPage({ id }: { id: string }) {
  const { state, mode, act, busy, toast } = useApp();
  const ranked = gymRankings(state);
  const gym = ranked.find((item) => item.coinId === id);
  const [tab, setTab] = useState('Overview');
  const [confirm, setConfirm] = useState(false);
  if (!gym)
    return (
      <EmptyState
        title="Gym unavailable"
        description="This coin does not currently have an active gym."
      >
        <a href="#/gyms" className="button primary">
          Explore gyms
        </a>
      </EmptyState>
    );
  const supporting = state.profile.supportedGym === id;
  const rank = ranked.indexOf(gym) + 1;
  const trainers = [
    ...(supporting ? [ownTrainer(state, mode === 'demo')] : []),
    ...(mode === 'demo'
      ? DEMO_TRAINERS.filter(
          (trainer) => trainer.supportedGym === id && trainer.wallet !== state.profile.wallet,
        )
      : []),
  ];
  return (
    <div className="league-page league-detail-page">
      <a className="league-back-link" href="#/gyms">
        <Icon name="ArrowLeft" size={16} />
        Back to gyms
      </a>
      <section
        className="league-team-header"
        style={{ '--league-color': gym.color } as CSSProperties}
      >
        <div className="league-team-identity">
          <Badge label={gym.badge} color={gym.color} size={78} />
          <div>
            <span className="league-leader-label">
              <Icon name="Trophy" size={14} />
              Rank #{rank}
              {rank === 1 ? ' · Leading gym' : ''}
            </span>
            <h1>{gym.name}</h1>
            <a href={'#/coin/' + gym.coinId}>
              ${gym.coin.ticker} community <Icon name="ArrowUpRight" size={13} />
            </a>
          </div>
        </div>
        <GymPartner gym={gym} />
        <div className="league-team-action">
          <Button
            variant={supporting ? 'secondary' : 'primary'}
            disabled={supporting || !gym.coin.holding}
            onClick={() => setConfirm(true)}
          >
            <Icon name={supporting ? 'Check' : 'Plus'} size={16} />
            {supporting ? 'Your gym' : 'Support this gym'}
          </Button>
          <small>
            {supporting
              ? 'Your collection is supporting this team.'
              : gym.coin.holding
                ? 'Choose this team as your one supported gym.'
                : 'Hold $' + gym.coin.ticker + ' to support this gym.'}
          </small>
        </div>
        <div className="league-team-metrics">
          <div>
            <span>Supported Pokémon value</span>
            <SolValue amount={gym.score} />
          </div>
          <div>
            <span>Supporting trainers</span>
            <strong>{compact(gym.supporters)}</strong>
          </div>
          <div>
            <span>Your contribution</span>
            <SolValue amount={supporting ? collectionValue(state) : 0} />
          </div>
        </div>
      </section>
      <nav className="league-detail-tabs" aria-label="Gym information">
        {['Overview', 'Trainers', 'Gym badge'].map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={tab === item ? 'active' : ''}
            aria-pressed={tab === item}
          >
            {item}
          </button>
        ))}
      </nav>
      {tab === 'Overview' ? (
        <div className="league-detail-content league-about-grid">
          <section className="league-about">
            <h2>About {gym.name}</h2>
            <p>{gym.coin.description}</p>
            <div className="league-contribution-note">
              <Icon name="Pokeball" size={22} />
              <div>
                <strong>Your collection makes the difference</strong>
                <p>
                  Support one gym at a time. Your Pokémon’s current funded value counts towards its
                  rank. Changing gyms moves your contribution with you.
                </p>
              </div>
            </div>
            <a className="league-coin-link" href={'#/coin/' + gym.coinId}>
              <CoinAvatar coin={gym.coin} size={40} />
              <span>
                <strong>{gym.coin.name}</strong>
                <small>${gym.coin.ticker}</small>
              </span>
              <Icon name="ArrowUpRight" size={17} />
            </a>
          </section>
          <aside className="league-badge-preview">
            <Badge label={gym.badge} color={gym.color} size={88} />
            <div>
              <h2>The {gym.badge} badge</h2>
              <p>Your team identity, displayed on your trainer profile.</p>
              <button onClick={() => setTab('Gym badge')}>
                View badge <Icon name="ArrowRight" size={15} />
              </button>
            </div>
          </aside>
        </div>
      ) : tab === 'Trainers' ? (
        <section className="league-detail-content league-roster">
          <header>
            <h2>Supporting trainers</h2>
            <span>
              {mode === 'demo'
                ? 'Trainers available in this preview'
                : 'Available trainer profiles'}
            </span>
          </header>
          {trainers.map((trainer) => (
            <a
              className="league-trainer-row"
              key={trainer.wallet}
              href={
                trainer.wallet === state.profile.wallet
                  ? '#/profile'
                  : '#/trainer/' + encodeURIComponent(trainer.wallet)
              }
            >
              <Avatar profile={trainer} size={46} />
              <span>
                <strong>
                  {trainer.displayName}
                  {trainer.wallet === state.profile.wallet && <em>You</em>}
                </strong>
                <small>
                  {trainer.wallet.slice(0, 6)}…{trainer.wallet.slice(-4)}
                </small>
              </span>
              <SolValue amount={trainer.pokemon.reduce((sum, pokemon) => sum + pokemon.value, 0)} />
              <Icon name="ChevronRight" size={15} />
            </a>
          ))}
          {!trainers.length && (
            <EmptyState
              title="No trainer profiles to show yet"
              description="Support this gym to add your trainer profile to the roster."
            />
          )}
        </section>
      ) : (
        <section className="league-detail-content league-badge-detail">
          <div
            className="league-badge-display"
            style={{ '--league-color': gym.color } as CSSProperties}
          >
            <Badge label={gym.badge} color={gym.color} size={148} />
          </div>
          <div>
            <span className="league-section-label">${gym.coin.ticker} community</span>
            <h2>{gym.badge} badge</h2>
            <p>
              Every coin has a badge based on its ticker. Support this gym to show its identity on
              your trainer profile.
            </p>
            <a className="button secondary" href="#/profile">
              View trainer profile <Icon name="ArrowRight" size={15} />
            </a>
          </div>
        </section>
      )}
      {confirm && (
        <Modal title={'Join ' + gym.name + '?'} onClose={() => setConfirm(false)}>
          <div className="modal-body support-modal league-support-modal">
            <Badge label={gym.badge} color={gym.color} size={80} />
            <h3>{state.profile.supportedGym ? 'Change supported gym' : 'Choose your gym'}</h3>
            <p>
              Your {sol(collectionValue(state))} SOL of Pokémon value will support {gym.name}.
              {state.profile.supportedGym ? ' Your previous gym will lose that contribution.' : ''}
            </p>
            <div className="league-modal-note">
              <Icon name="Pokeball" size={18} />
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
              Support this gym <Icon name="Check" size={16} />
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
