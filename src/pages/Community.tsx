import { ItemSprite } from '../components/ItemSprite';
import { useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { gymRankings } from '../state/gyms';
import { pokemonById } from '../data/pokemon';
import { GymBadge, coinForBadge } from '../components/GymBadge';
import { Button, EmptyState, Icon, Modal, PokemonArt, TypeChip } from '../components/UI';
import { ManualCatalogue } from '../components/MoveManuals';
import { MoveInfoDialog } from '../components/MovePreview';
import { type GymDefender, type GymPrize } from '../game/gym-policy';

export function GymDefenders({
  defenders,
  compact = false,
}: {
  defenders: GymDefender[];
  compact?: boolean;
}) {
  const [preview, setPreview] = useState<{ move: string; pokemon: GymDefender } | null>(null);
  return (
    <>
      {defenders.length ? (
        <div className={'gym-defenders ' + (compact ? 'compact' : '')}>
          {defenders.map((p) => (
            <div
              className={'gym-defender' + (p.source === 'partner' ? ' gym-partner-defender' : '')}
              key={p.id}
            >
              <span className="gym-defender-level">Lv. {p.level}</span>
              <div className="gym-sprite-stage">
                <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
              </div>
              <strong>{pokemonById(p.speciesId).name}</strong>
              {p.source === 'partner' && <span className="gym-partner-label">Gym partner</span>}
              {!compact && (
                <>
                  <div className="type-row">
                    {pokemonById(p.speciesId).types.map((t) => (
                      <TypeChip key={t} type={t} />
                    ))}
                  </div>
                  <small>{p.strength.toLocaleString()} strength</small>
                  {p.source !== 'partner' && p.trainerWallet && (
                    <a href={'#/trainer/' + p.trainerWallet}>{p.trainerName}</a>
                  )}
                  <div className="gym-defender-moves">
                    {p.moves.map((move) => (
                      <button
                        key={move}
                        onClick={() => setPreview({ move, pokemon: p })}
                        aria-label={'Preview ' + move}
                      >
                        <span>{move}</span>
                        <Icon name="Info" size={14} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={'gym-defence-empty' + (compact ? ' compact' : '')}>
          <Icon name="Gym" size={compact ? 22 : 32} />
          <span>No defenders yet</span>
          {!compact && <p>Supporters’ Pokémon will form this gym’s team.</p>}
        </div>
      )}
      {preview && (
        <MoveInfoDialog
          name={preview.move}
          speciesId={preview.pokemon.speciesId}
          shiny={preview.pokemon.shiny}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  );
}
export function GymRewards({ prize }: { prize: GymPrize }) {
  return (
    <div className="gym-prizes">
      <span>
        <Icon name="Gym" />
        <strong>1</strong>
        <small>Gym badge</small>
      </span>
      <span>
        <Icon name="Trophy" />
        <strong>{prize.points}</strong>
        <small>League points</small>
      </span>
      <span>
        <ItemSprite item="berry" size={32} />
        <strong>×{prize.items.berry}</strong>
        <small>Sitrus Berries</small>
      </span>
      <span>
        <ItemSprite item="revive" size={32} />
        <strong>×{prize.items.revive}</strong>
        <small>Revives</small>
      </span>
    </div>
  );
}
export function GymsPage() {
  const { state } = useApp(),
    gyms = gymRankings(state),
    [filter, setFilter] = useState('All gyms'),
    [catalogue, setCatalogue] = useState(false);
  const visible = gyms.filter(
    (g) =>
      filter === 'All gyms' ||
      (filter === 'Ready to challenge' && g.defenders.length === 3) ||
      (filter === 'My gym' && g.coinId === state.profile.supportedGym),
  );
  return (
    <div className="gyms-refresh">
      <header className="gyms-heading">
        <div>
          <h1>Gyms</h1>
          <p>Three defenders. One badge. A new challenge in every community.</p>
        </div>
        <button className="button secondary" onClick={() => setCatalogue(true)}>
          <Icon name="BookOpen" />
          Move manuals
        </button>
      </header>
      <section className="gym-passport">
        <div className="gym-passport-total">
          <Icon name="Gym" size={32} />
          <strong>
            {state.gymProgress?.badges || 0}
            <small>Badges earned</small>
          </strong>
        </div>
        <div className="gym-passport-collection">
          <span>Your badge case</span>
          <div>
            {state.badges.map((id) => {
              const coin = coinForBadge(state.coins, id);
              return coin ? (
                <a key={id} href={'#/gym/' + coin.id} title={coin.name}>
                  <GymBadge coin={coin} size={42} />
                </a>
              ) : null;
            })}
            {!state.badges.length && <p>Defeat your first away gym to start collecting.</p>}
          </div>
        </div>
        <div className="gym-passport-points">
          <strong>{(state.gymProgress?.points || 0).toLocaleString()}</strong>
          <span>Career points</span>
          <small>{state.gymProgress?.claimedToday.length || 0}/5 rewards today</small>
        </div>
      </section>
      {state.gymProgress?.activeChallengeId && (
        <a
          className="button secondary"
          href={'#/battles?gym=resume&challenge=' + state.gymProgress.activeChallengeId}
        >
          Resume challenge
        </a>
      )}
      <div className="gym-directory-toolbar">
        <div className="gym-filter-row">
          {['All gyms', 'Ready to challenge', 'My gym'].map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
        <span>Weekly league · resets Monday UTC</span>
      </div>
      <div className="gym-directory">
        {visible.map((g) => (
          <a
            href={'#/gym/' + g.coinId}
            className="gym-directory-row"
            key={g.coinId}
            style={{ '--gym-color': g.color } as CSSProperties}
          >
            <div className="gym-directory-identity">
              <span className="gym-directory-rank">{gyms.indexOf(g) + 1}</span>
              <GymBadge coin={g.coin} size={52} />
              <div>
                <h2>{g.name}</h2>
                <p>
                  {g.supporters.toLocaleString()} supporters
                  {g.coinId === state.profile.supportedGym ? ' · Your gym' : ''}
                </p>
              </div>
            </div>
            <GymDefenders defenders={g.defenders} compact />
            <div className="gym-directory-stat">
              <strong>{g.strength.toLocaleString()}</strong>
              <span>Team strength</span>
              <small>
                {g.prize.manualChance
                  ? Math.round(g.prize.manualChance * 100) + '% manual chance'
                  : 'No manual drops'}
              </small>
            </div>
            <div className="gym-directory-stat">
              <strong>{g.weeklyPoints.toLocaleString()}</strong>
              <span>Weekly points</span>
            </div>
            <Icon name="ChevronRight" size={22} />
          </a>
        ))}
      </div>
      {!visible.length && (
        <EmptyState
          title="No gyms here yet"
          description="Choose another filter, or support an active coin to build its gym."
        />
      )}
      <p className="gym-directory-note">
        Each rewarded win earns one badge. Tougher gyms award more points and supplies, with a
        chance of a move manual.
      </p>
      {catalogue && <ManualCatalogue onClose={() => setCatalogue(false)} />}
    </div>
  );
}
export function GymDetailPage({ id }: { id: string }) {
  const { state, act, busy, toast } = useApp(),
    gym = gymRankings(state).find((g) => g.coinId === id),
    [confirm, setConfirm] = useState(false),
    [rules, setRules] = useState(false),
    [catalogue, setCatalogue] = useState(false);
  if (!gym)
    return (
      <EmptyState
        title="Gym unavailable"
        description="This coin needs to be active to run a gym."
      />
    );
  const own = state.profile.supportedGym === id,
    ready = gym.defenders.length === 3,
    claimed = state.gymProgress?.claimedToday.includes(id),
    cap = (state.gymProgress?.claimedToday.length || 0) >= 5;
  return (
    <div className="gym-detail-refresh" style={{ '--gym-color': gym.color } as CSSProperties}>
      <a className="pokemon-back-button" href="#/gyms">
        <Icon name="ArrowLeft" />
        Back to gyms
      </a>
      <header className="gym-detail-header">
        <GymBadge coin={gym.coin} size={72} />
        <div>
          <h1>{gym.name}</h1>
          <p>
            {gym.supporters} supporters · {gym.weeklyPoints.toLocaleString()} weekly points
            {own ? ' · Your gym' : ''}
          </p>
        </div>
        <a className="button secondary" href={'#/coin/' + id}>
          View coin
        </a>
      </header>
      <div className="gym-challenge-layout">
        <section className="gym-defence-panel">
          <header>
            <div>
              <h2>The defending team</h2>
              <p>
                {gym.defenders.some((p) => p.source === 'partner')
                  ? 'Supporters lead the team. The coin’s paired Pokémon fills any remaining places.'
                  : 'The three strongest Pokémon from this gym’s supporters.'}
              </p>
            </div>
            <span className="gym-strength-pill">{gym.strength.toLocaleString()} strength</span>
          </header>
          <GymDefenders defenders={gym.defenders} />
          <button
            className="gym-rules-toggle"
            aria-expanded={rules}
            onClick={() => setRules(!rules)}
          >
            <Icon name="Info" size={17} />
            Battle rules
            <Icon name={rules ? 'ChevronUp' : 'ChevronDown'} size={16} />
          </button>
          {rules && (
            <div className="gym-rules-copy">
              <p>
                Missing defenders are filled by Lv. 20 copies of the coin’s paired Pokémon.
                Trainer-led coins have no fallback. A complete team of three is needed to challenge.
                These copies cannot be owned or redeemed.
              </p>
              <p>
                Defenders are full-health copies. Your team uses its current HP and stays locked
                during the challenge. Injured Pokémon recover afterward or can use items in My PC.
              </p>
              <p>
                Both teams receive 2 Potions, 1 Revive and 1 Full Heal. An item uses a turn. Extra
                PC items cannot be brought into the fight.
              </p>
              <p>
                Your first win against each away gym per UTC day earns one badge and rewards, up to
                five different gyms per day. Home-gym battles and repeat wins are practice. Points
                contribute to the gym you supported when the challenge began.
              </p>
              <p>
                Team strength comes from combat stats at each Pokémon’s level. SOL value and shiny
                colour do not increase strength.
              </p>
            </div>
          )}
        </section>
        <aside className="gym-reward-panel">
          <h2>Victory rewards</h2>
          <GymRewards prize={gym.prize} />
          <div className={'gym-manual-drop ' + (!gym.prize.manualChance ? 'no-drop' : '')}>
            <Icon name="BookOpen" size={26} />
            <div>
              <strong>
                {gym.prize.manualChance
                  ? Math.round(gym.prize.manualChance * 100) + '% chance of a manual'
                  : 'No move manual drops'}
              </strong>
              <p>
                {gym.prize.manualChance
                  ? 'One random move from this gym’s pool. Use it once on any Pokémon.'
                  : 'Challenge a gym with at least 1,200 strength for a chance to earn manuals.'}
              </p>
              {gym.prize.manualChance > 0 && (
                <button className="text-link" onClick={() => setCatalogue(true)}>
                  View possible moves
                  <Icon name="ArrowRight" size={14} />
                </button>
              )}
            </div>
          </div>
          <p className="gym-reward-eligibility">
            {own
              ? 'Your home gym is practice only.'
              : claimed
                ? 'Rewards already claimed here today. You can still practice.'
                : cap
                  ? 'Daily rewards complete. You can still practice.'
                  : 'Win to claim one badge, points and supplies.'}
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
              : 'Waiting for defenders'}
            <Icon name="Swords" />
          </a>
          <small>No entry fee · no SOL rewards</small>
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
          <p className="gym-support-note">
            Support one gym at a time. Your strongest Pokémon can join its defence automatically.
          </p>
        </aside>
      </div>
      {catalogue && <ManualCatalogue strength={gym.strength} onClose={() => setCatalogue(false)} />}
      {confirm && (
        <Modal title={'Support ' + gym.name + '?'} onClose={() => setConfirm(false)}>
          <div className="modal-body">
            <p>
              Your Pokémon can represent this gym, and future challenge points count toward its
              weekly total. You can change gyms once every 24 hours.
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
