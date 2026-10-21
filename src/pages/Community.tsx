import { useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { gymRankings } from '../state/gyms';
import { pokemonById } from '../data/pokemon';
import { GymBadge } from '../components/GymBadge';
import { Button, EmptyState, Icon, Modal, PokemonArt, TypeChip } from '../components/UI';
import { GYM_MANUALS, type GymDefender, type GymPrize } from '../game/gym-policy';

export function GymDefenders({
  defenders,
  compact = false,
}: {
  defenders: GymDefender[];
  compact?: boolean;
}) {
  return (
    <div className={'gym-defenders ' + (compact ? 'compact' : '')}>
      {[0, 1, 2].map((index) => {
        const p = defenders[index];
        return (
          <div className={'gym-defender ' + (!p ? 'empty' : '')} key={p?.id || index}>
            {p ? (
              <>
                <span className="gym-defender-level">Lv. {p.level}</span>
                <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
                <strong>{pokemonById(p.speciesId).name}</strong>
                {!compact && (
                  <>
                    <div className="type-row">
                      {pokemonById(p.speciesId).types.map((t) => (
                        <TypeChip key={t} type={t} />
                      ))}
                    </div>
                    <small>{p.strength.toLocaleString()} strength</small>
                    <a href={'#/trainer/' + p.trainerWallet}>{p.trainerName}</a>
                    <p>{p.moves.join(' · ')}</p>
                  </>
                )}
              </>
            ) : (
              <>
                <Icon name="Pokeball" size={35} />
                <strong>Open defender slot</strong>
                <small>Supporters’ Pokémon fill this automatically.</small>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
export function GymRewards({ prize }: { prize: GymPrize }) {
  return (
    <div className="gym-prizes">
      <span>
        <Icon name="Trophy" />
        <strong>{prize.points}</strong>
        <small>League points</small>
      </span>
      <span>
        <Icon name="Trophy" />
        <strong>{prize.medals}</strong>
        <small>Gym medals</small>
      </span>
      <span>
        <i className="battle-item-art item-berry" />
        <strong>×{prize.items.berry}</strong>
        <small>Sitrus Berries</small>
      </span>
      <span>
        <i className="battle-item-art item-revive" />
        <strong>×{prize.items.revive}</strong>
        <small>Revives</small>
      </span>
    </div>
  );
}
export function GymsPage() {
  const { state, mode } = useApp(),
    gyms = gymRankings(state);
  const [filter, setFilter] = useState('All gyms');
  const visible = gyms.filter(
    (g) =>
      filter === 'All gyms' ||
      (filter === 'Ready to challenge' && g.defenders.length === 3) ||
      (filter === 'My gym' && g.coinId === state.profile.supportedGym),
  );
  return (
    <div className="gym-league-page">
      <header className="gym-league-heading">
        <div>
          <span className="gym-eyebrow">KANTO LEAGUE</span>
          <h1>Take on the gyms.</h1>
          <p>
            Every community fields its three strongest Pokémon. Beat tougher defenders to earn more
            points, supplies and medals.
          </p>
        </div>
        <div className="trainer-league-total">
          <Icon name="Trophy" size={28} />
          <strong>{state.gymProgress?.medals || 0}</strong>
          <span>your medals</span>
        </div>
      </header>
      <div className="gym-season-strip">
        <span>
          <Icon name="Trophy" />
          Weekly league · resets Monday UTC
        </span>
        <span>
          {state.gymProgress?.points || 0} career points · {state.gymProgress?.wins || 0} rewarded
          wins
        </span>
        {state.gymProgress?.activeChallengeId && (
          <a
            className="button secondary"
            href={'#/battles?gym=resume&challenge=' + state.gymProgress.activeChallengeId}
          >
            Resume challenge
          </a>
        )}
        {mode === 'demo' && <small>Demo league</small>}
      </div>
      <div className="gym-filter-row">
        {['All gyms', 'Ready to challenge', 'My gym'].map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="gym-league-cards">
        {visible.map((g) => (
          <a
            href={'#/gym/' + g.coinId}
            className="gym-league-card"
            key={g.coinId}
            style={{ '--gym-color': g.color } as CSSProperties}
          >
            <header>
              <GymBadge coin={g.coin} size={52} />
              <div>
                <h2>{g.name}</h2>
                <p>
                  {g.supporters.toLocaleString()} supporting trainers
                  {g.coinId === state.profile.supportedGym ? ' · Your gym' : ''}
                </p>
              </div>
              <span className="gym-league-rank">#{gyms.indexOf(g) + 1}</span>
            </header>
            <GymDefenders defenders={g.defenders} compact />
            <footer>
              <span>
                <strong>{g.weeklyPoints.toLocaleString()}</strong> league points
              </span>
              <span>
                <strong>{g.strength.toLocaleString()}</strong> defence strength
              </span>
              <Icon name="ArrowRight" />
            </footer>
          </a>
        ))}
      </div>
      {!visible.length && (
        <EmptyState
          title="No gyms here yet"
          description="Choose another filter, or support an active coin to build its gym."
        />
      )}
      <section className="gym-badge-case">
        <header>
          <h2>Your badge case</h2>
          <p>Defeat an away gym to earn its coin badge.</p>
        </header>
        <div>
          {state.badges.map((id) => {
            const coin = state.coins.find((c) => c.id === id || c.ticker === id);
            return coin ? (
              <a key={id} href={'#/gym/' + coin.id} title={coin.name}>
                <GymBadge coin={coin} size={54} />
                <span>{coin.ticker}</span>
              </a>
            ) : null;
          })}
          {!state.badges.length && <p>Your first gym victory starts your collection.</p>}
        </div>
      </section>
    </div>
  );
}
export function GymDetailPage({ id }: { id: string }) {
  const { state, act, busy, toast, mode } = useApp(),
    gym = gymRankings(state).find((g) => g.coinId === id);
  const [confirm, setConfirm] = useState(false),
    [tab, setTab] = useState('Defenders');
  if (!gym)
    return (
      <EmptyState
        title="Gym unavailable"
        description="This coin needs to be active to run a gym."
      />
    );
  const own = state.profile.supportedGym === id,
    ready = gym.defenders.length === 3;
  const claimed = state.gymProgress?.claimedToday.includes(id),
    cap = (state.gymProgress?.claimedToday.length || 0) >= 5;
  return (
    <div className="gym-detail-v2" style={{ '--gym-color': gym.color } as CSSProperties}>
      <a className="pokemon-back-button" href="#/gyms">
        <Icon name="ArrowLeft" />
        Back to gyms
      </a>
      <header className="gym-detail-title">
        <GymBadge coin={gym.coin} size={82} />
        <div>
          <span className="gym-eyebrow">{own ? 'YOUR COMMUNITY' : 'KANTO GYM'}</span>
          <h1>{gym.name}</h1>
          <p>
            {gym.supporters} supporters · {gym.weeklyPoints.toLocaleString()} weekly league points
          </p>
        </div>
        <a className="button secondary" href={'#/coin/' + id}>
          View coin
        </a>
      </header>
      <div className="gym-detail-layout">
        <section className="gym-defence-desk">
          <div className="gym-panel-heading">
            <h2>Gym defence</h2>
            <span>{gym.strength.toLocaleString()} strength</span>
          </div>
          <div className="gym-detail-tabs">
            {['Defenders', 'How it works', 'Move rewards'].map((t) => (
              <button key={t} onClick={() => setTab(t)} className={tab === t ? 'active' : ''}>
                {t}
              </button>
            ))}
          </div>
          {tab === 'Defenders' ? (
            <>
              <GymDefenders defenders={gym.defenders} />
              <p className="gym-footnote">
                The three strongest Pokémon across eligible supporting holders. They defend as
                full-health copies; the originals stay with their trainers.
              </p>
            </>
          ) : tab === 'How it works' ? (
            <div className="gym-rules-copy">
              <h3>A community’s best three</h3>
              <p>
                Strength is the total of HP, Attack, Defense, Special Attack, Special Defense and
                Speed at each Pokémon’s current level. SOL value and shiny colour do not increase
                strength.
              </p>
              <h3>One fair battle bag</h3>
              <p>
                Both teams receive 2 Potions, 1 Revive and 1 Full Heal. An item uses a turn. Extra
                items from your PC cannot be brought into the fight.
              </p>
              <h3>Earn your place in the league</h3>
              <p>
                The first away-gym win each UTC day earns its badge and rewards, up to five
                different gyms per day. Points also help the gym you supported when the challenge
                began. Home-gym battles are practice.
              </p>
              <p>
                Your team is locked during a challenge. Injured Pokémon recover after 10 minutes, or
                you can use supplies in My PC. No Pokémon transfer or SOL wager.
              </p>
            </div>
          ) : (
            <div className="gym-manual-rewards">
              {GYM_MANUALS.map((m) => (
                <article key={m.move}>
                  <Icon name="BookOpen" size={28} />
                  <h3>{m.move}</h3>
                  <p>{m.wins} rewarded victories</p>
                  <span>
                    {state.gymProgress?.manuals.includes(m.move)
                      ? 'Unlocked'
                      : 'Keep challenging gyms'}
                  </span>
                </article>
              ))}
              <p>
                Unlocks belong to your trainer. Equip one manual on any Pokémon through its PC Bag,
                using one of its four move slots. Its original move returns when the manual is
                removed.
              </p>
            </div>
          )}
        </section>
        <aside className="gym-challenge-desk">
          <span className="gym-eyebrow">VICTORY REWARDS</span>
          <h2>Take the challenge</h2>
          <GymRewards prize={gym.prize} />
          <p>
            {own
              ? 'Your home gym is practice only.'
              : claimed
                ? 'You already earned this gym’s rewards today. You can still practice.'
                : cap
                  ? 'Daily rewards complete. You can still practice.'
                  : 'Win to add these supplies to your PC bag and claim the gym badge.'}
          </p>
          <a
            aria-disabled={!ready}
            className={'button primary ' + (!ready ? 'disabled' : '')}
            href={ready ? '#/battles?gym=' + encodeURIComponent(id) : undefined}
          >
            {ready
              ? own || claimed || cap
                ? 'Practice against this gym'
                : 'Choose your team'
              : 'Waiting for 3 defenders'}
            <Icon name="Swords" />
          </a>
          <small>{mode === 'demo' ? 'Local demo · ' : ' '}No SOL rewards · no entry fee</small>
          <hr />
          <Button
            variant="secondary"
            disabled={own || !gym.coin.holding || busy}
            onClick={() => setConfirm(true)}
          >
            {own
              ? 'You support this gym'
              : gym.coin.holding
                ? 'Support this gym'
                : 'Hold this coin to support'}
          </Button>
          <p className="gym-footnote">
            Support one gym at a time. Your strongest Pokémon can join its defence automatically.
          </p>
        </aside>
      </div>
      {confirm && (
        <Modal title={'Support ' + gym.name + '?'} onClose={() => setConfirm(false)}>
          <div className="modal-body">
            <p>
              Your Pokémon can represent this gym, and future challenge points will count toward its
              weekly league total. You can change gyms once every 24 hours.
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                if (await act({ type: 'gym.support', id })) {
                  setConfirm(false);
                  toast('You now support ' + gym.name + '.');
                }
              }}
            >
              Support gym
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
