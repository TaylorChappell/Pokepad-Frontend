import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import { collectionValue, profileName, shortWallet } from '../state/model';
import { ACCENT_COLORS, CHARACTERS, GYMS } from '../data/demo';
import { pokemonById } from '../data/pokemon';
import {
  Avatar,
  Badge,
  Button,
  CoinAvatar,
  EmptyState,
  Icon,
  Modal,
  ModeBadge,
  PageHeading,
  PokemonArt,
  Progress,
  SolValue,
  Sparkline,
  TypeChip,
} from '../components/UI';
import { GuideManual } from './Guide';
import { compact, navigate, relativeTime, sol } from '../utils';
import type { Profile } from '../types';

export function PortfolioPage() {
  const { state } = useApp(),
    held = state.coins.filter((c) => c.holding > 0),
    value = held.reduce((n, c) => n + c.holding * c.price, 0);
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE PROGRESS, EVERY DAY"
        title="My portfolio"
        description="Your coins, your communities, your next adventure."
      >
        <a className="button secondary" href="#/activity">
          <Icon name="Activity" />
          View activity
        </a>
      </PageHeading>
      <div className="stats-grid">
        <div className="stat-card lavender">
          <span>
            <Icon name="Wallet" />
            Token holdings
          </span>
          <strong>
            {sol(value)} <small>SOL</small>
          </strong>
          <small>Illustrative token prices</small>
        </div>
        <div className="stat-card pale-green">
          <span>
            <Icon name="Heart" />
            Pokémon value
          </span>
          <strong>
            {sol(collectionValue(state))} <small>SOL</small>
          </strong>
          <small>{state.pokemon.length} Pokémon in your inventory</small>
        </div>
        <div className="stat-card pale-yellow">
          <span>
            <Icon name="Flame" />
            Longest hold streak
          </span>
          <strong>
            {Math.max(0, ...held.map((c) => c.holdingDays))} <small>days</small>
          </strong>
          <small>Without selling</small>
        </div>
      </div>
      <div className="section-heading">
        <h2>
          Your communities <span className="count-pill">{held.length}</span>
        </h2>
        <a className="text-link" href="#/discover">
          Find a new coin
          <Icon name="ArrowRight" size={15} />
        </a>
      </div>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Coin</th>
              <th>Holdings</th>
              <th>Est. value</th>
              <th>Hold streak</th>
              <th>Rewards</th>
              <th>Last 24h</th>
            </tr>
          </thead>
          <tbody>
            {held.map((c) => (
              <tr key={c.id}>
                <td>
                  <a className="table-coin" href={'#/coin/' + c.id}>
                    <CoinAvatar coin={c} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>{'$' + c.ticker}</small>
                    </span>
                  </a>
                </td>
                <td>
                  <strong>{compact(c.holding)}</strong>
                  <small>{c.ticker}</small>
                </td>
                <td>{sol(c.holding * c.price)} SOL</td>
                <td>
                  <span className="streak-chip">
                    <Icon name="Flame" size={14} />
                    {c.holdingDays} days
                  </span>
                </td>
                <td>
                  {c.active ? (
                    <ModeBadge mode={c.mode} />
                  ) : (
                    <span className="status-tag">Paused · inactive</span>
                  )}
                </td>
                <td className={c.change >= 0 ? 'positive' : 'negative'}>
                  {c.change > 0 ? '+' : ''}
                  {c.change}%<Sparkline seed={c.pokemonId} negative={c.change < 0} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="two-column panels-margin">
        <div className="panel inset">
          <div className="section-heading">
            <h3>Equipped Pokémon</h3>
            <Icon name="Sparkles" />
          </div>
          {(() => {
            const p = state.pokemon.find((p) => p.id === state.profile.equippedId);
            return p ? (
              <div className="partner-summary">
                <PokemonArt id={p.speciesId} />
                <div>
                  <h2>{pokemonById(p.speciesId).name}</h2>
                  <p>Rare Candy from holding active coins.</p>
                  <Progress value={p.rareCandy / 10} color="#e5ba4c" />
                  <small>{p.rareCandy.toLocaleString()} / 1,000 Rare Candy</small>
                  <a className="text-link" href={'#/pokemon/' + p.id}>
                    Visit your partner
                    <Icon name="ArrowRight" size={14} />
                  </a>
                </div>
              </div>
            ) : (
              <EmptyState title="Choose a Pokémon" description="Choose a Pokémon from your PC.">
                <a href="#/pokemon" className="button secondary">
                  My Pokémon
                </a>
              </EmptyState>
            );
          })()}
        </div>
        <div className="panel inset holding-tip">
          <Icon name="Heart" size={28} />
          <h2>Holding rewards</h2>
          <p>
            Your balance and uninterrupted holding time help determine your reward tier. Inactive
            coins don’t earn Rare Candy.
          </p>
          <a className="text-link" href="#/rewards">
            See your rewards
            <Icon name="ArrowRight" />
          </a>
        </div>
      </div>
    </>
  );
}

export function ProfilePage() {
  const { state } = useApp(),
    gym = GYMS.find((g) => g.coinId === state.profile.supportedGym),
    partner = state.pokemon.find((p) => p.id === state.profile.equippedId);
  return (
    <>
      <div className="profile-cover">
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        <div className="profile-hills" />
        <PokemonArt id={25} />
      </div>
      <div className="profile-identity">
        <Avatar profile={state.profile} size={116} />
        <div>
          <span className="eyebrow">KANTO TRAINER</span>
          <h1>{profileName(state)}</h1>
          <span className="muted">{shortWallet(state.profile.wallet)}</span>
        </div>
        <a href="#/settings" className="button secondary">
          <Icon name="Settings" size={16} />
          Edit profile
        </a>
      </div>
      <div className="stats-grid profile-stats">
        <div className="stat-card">
          <span>Pokémon</span>
          <strong>{state.pokemon.length}</strong>
          <small>In your PC</small>
        </div>
        <div className="stat-card">
          <span>Pokédex</span>
          <strong>
            {state.discovered.length}
            <small> / 151</small>
          </strong>
          <small>Permanent discoveries</small>
        </div>
        <div className="stat-card">
          <span>Walking progress</span>
          <strong>
            {state.walkKm.toFixed(1)} <small>km</small>
          </strong>
          <small>Walking preview distance</small>
        </div>
      </div>
      <div className="two-column">
        <div className="panel inset">
          <div className="section-heading">
            <h2>My partner</h2>
            <Icon name="Heart" />
          </div>
          {partner ? (
            <div className="profile-partner">
              <PokemonArt id={partner.speciesId} />
              <div>
                <h2>{pokemonById(partner.speciesId).name}</h2>
                <div className="type-row">
                  {pokemonById(partner.speciesId).types.map((t) => (
                    <TypeChip key={t} type={t} />
                  ))}
                </div>
                <p>
                  Level {partner.level} · {partner.rareCandy} Rare Candy
                </p>
                <a href={'#/pokemon/' + partner.id} className="button secondary">
                  View Pokémon
                  <Icon name="ArrowRight" size={15} />
                </a>
              </div>
            </div>
          ) : (
            <p>Choose a partner in your inventory.</p>
          )}
        </div>
        <div className="panel inset">
          <div className="section-heading">
            <h2>My gym & badges</h2>
            <Icon name="Shield" />
          </div>
          {gym && (
            <a className="profile-gym" href={'#/gym/' + gym.coinId}>
              <Badge
                label={state.coins.find((c) => c.id === gym.coinId)?.ticker}
                color={gym.color}
              />
              <span>
                <h3>{gym.name}</h3>
                <small>Supporting this community</small>
              </span>
              <Icon name="ArrowRight" />
            </a>
          )}
          <div className="badge-shelf">
            {state.badges.map((b, i) => (
              <div key={b}>
                <Badge label={b} color={['#edaa69', '#7db9d2', '#92b694'][i % 3]} size={61} />
                <small>{b}</small>
              </div>
            ))}
            <div className="locked-badge">
              <Icon name="Lock" />
              <small>Undiscovered</small>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ActivityList({ limit }: { limit?: number }) {
  const { state, now } = useApp();
  return (
    <div className="panel activity-list">
      {state.activity.slice(0, limit).map((a) => (
        <a href={'#' + a.href} className="activity-item" key={a.id}>
          <span className={'activity-art ' + a.kind}>
            {a.pokemonId ? (
              <PokemonArt id={a.pokemonId} />
            ) : (
              <Icon
                name={a.kind === 'gym' ? 'Shield' : a.kind === 'trade' ? 'ArrowUpRight' : 'Gift'}
                size={22}
              />
            )}
          </span>
          <span>
            <strong>{a.title}</strong>
            <small>{a.detail}</small>
          </span>
          <time>{relativeTime(a.createdAt, now)}</time>
          <Icon name="ChevronRight" size={16} />
        </a>
      ))}
    </div>
  );
}
export function ActivityPage() {
  return (
    <>
      <PageHeading
        eyebrow="YOUR ADVENTURE JOURNAL"
        title="Activity"
        description="Hatches, evolutions, trades, and everything along the way."
      />
      <ActivityList />
    </>
  );
}

export function SettingsPage({ tab: initial = 'profile' }: { tab?: string }) {
  const { state, act, toast, busy, mode } = useApp(),
    [tab, setTab] = useState(initial),
    [draft, setDraft] = useState<Profile>(state.profile),
    [reset, setReset] = useState(false);
  useEffect(() => setTab(initial), [initial]);
  const save = async () => {
    if (
      await act({
        type: 'profile.update',
        patch: {
          displayName: draft.displayName,
          character: draft.character,
          accessoryColor: draft.accessoryColor,
          artStyle: draft.artStyle,
          reducedMotion: draft.reducedMotion,
          rewardNotifications: draft.rewardNotifications,
          evolutionNotifications: draft.evolutionNotifications,
        },
      })
    )
      toast('Settings saved.');
  };
  const toggle = (field: 'rewardNotifications' | 'evolutionNotifications' | 'reducedMotion') =>
    setDraft({ ...draft, [field]: !draft[field] });
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Settings"
        description="A trainer profile that feels a little more like you."
      />
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            { id: 'profile', name: 'Trainer profile', icon: 'Users' as const },
            { id: 'notifications', name: 'Notifications', icon: 'Bell' as const },
            { id: 'wallet', name: 'Wallet & connection', icon: 'Wallet' as const },
            { id: 'help', name: 'How it works', icon: 'HelpCircle' as const },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={tab === t.id ? 'active' : ''}
            >
              <Icon name={t.icon} />
              {t.name}
              <Icon name="ChevronRight" size={14} />
            </button>
          ))}
        </nav>
        <div className="panel settings-content">
          {tab === 'profile' && (
            <>
              <h2>Trainer appearance</h2>

              <div className="avatar-editor">
                <Avatar profile={draft} size={132} />
                <div>
                  <h3>Your trainer sprite</h3>
                  <p>Your trainer and accessory colour are randomly chosen on your first visit.</p>
                  <button
                    className="text-link"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        character: CHARACTERS[Math.floor(Math.random() * CHARACTERS.length)],
                        accessoryColor:
                          ACCENT_COLORS[Math.floor(Math.random() * ACCENT_COLORS.length)],
                      })
                    }
                  >
                    <Icon name="RefreshCw" size={15} />
                    Randomise
                  </button>
                </div>
              </div>
              <label className="field-label">Trainer</label>
              <div className="character-options">
                {CHARACTERS.map((c) => (
                  <button
                    className={draft.character === c ? 'selected' : ''}
                    key={c}
                    onClick={() => setDraft({ ...draft, character: c })}
                  >
                    <Avatar profile={{ ...draft, character: c }} size={66} />
                    <span>{c[0].toUpperCase() + c.slice(1)}</span>
                    {draft.character === c && <Icon name="CheckCircle2" size={16} />}
                  </button>
                ))}
              </div>
              <label className="field-label">Accessory colour</label>
              <div className="colour-options">
                {ACCENT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={draft.accessoryColor === c ? 'selected' : ''}
                    aria-label={'Choose accessory colour ' + c}
                    style={{ background: c }}
                    onClick={() => setDraft({ ...draft, accessoryColor: c })}
                  >
                    {draft.accessoryColor === c && <Icon name="Check" size={18} />}
                  </button>
                ))}
              </div>
              <div className="art-setting">
                <h3>Pokémon artwork</h3>
                <p>Pixel sprites are the default. Switch to illustrations at any time.</p>
                <div className="art-style-options">
                  {(['pixel', 'drawn'] as const).map((style) => (
                    <button
                      type="button"
                      className={draft.artStyle === style ? 'selected' : ''}
                      key={style}
                      onClick={() => setDraft({ ...draft, artStyle: style })}
                      aria-pressed={draft.artStyle === style}
                    >
                      <PokemonArt id={6} styleOverride={style} />
                      <span className="art-style-copy">
                        <strong>{style === 'pixel' ? 'Pixel sprites' : 'Drawn artwork'}</strong>
                        <small>
                          {style === 'pixel' ? 'Animated game sprites' : 'Official illustrations'}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <label className="field-label" htmlFor="display-name">
                Display name
              </label>
              <input
                className="text-input"
                id="display-name"
                maxLength={24}
                value={draft.displayName}
                placeholder={shortWallet(state.profile.wallet)}
                onChange={(e) => setDraft({ ...draft, displayName: e.target.value })}
              />
              <p className="field-help">
                Leave this blank to use your short wallet address. {draft.displayName.length}/24
              </p>
              <div className="settings-save">
                <Button disabled={busy} onClick={save}>
                  <Icon name="Check" size={16} />
                  Save changes
                </Button>
              </div>
            </>
          )}
          {tab === 'notifications' && (
            <>
              <h2>Notifications</h2>
              <p className="muted">Choose which updates appear in the notification bell.</p>
              {[
                {
                  key: 'rewardNotifications' as const,
                  title: 'Eggs & packs',
                  description: 'Know when an egg is ready or a new reward arrives.',
                },
                {
                  key: 'evolutionNotifications' as const,
                  title: 'Evolution updates',
                  description: 'Notify me when my Pokémon can evolve.',
                },
                {
                  key: 'reducedMotion' as const,
                  title: 'Reduce motion',
                  description: 'Shorter reward reveals and fewer decorative animations.',
                },
              ].map((t) => (
                <div className="toggle-row" key={t.key}>
                  <div>
                    <strong>{t.title}</strong>
                    <p>{t.description}</p>
                  </div>
                  <button
                    className={'toggle ' + (draft[t.key] ? 'on' : '')}
                    role="switch"
                    aria-checked={draft[t.key]}
                    aria-label={t.title}
                    onClick={() => toggle(t.key)}
                  >
                    <span />
                  </button>
                </div>
              ))}
              <div className="settings-save">
                <Button disabled={busy} onClick={save}>
                  Save preferences
                </Button>
              </div>
            </>
          )}
          {tab === 'wallet' && (
            <>
              <h2>Wallet</h2>
              <p className="muted">Account and connection details.</p>
              <div className="wallet-card">
                <Icon name="Wallet" size={28} />
                <span className="status-tag">
                  {mode === 'demo' ? 'Demo wallet' : 'Backend connected'}
                </span>
                <label>Wallet address</label>
                <code>{state.profile.wallet}</code>
                <button
                  className="text-link"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(state.profile.wallet);
                      toast('Wallet address copied');
                    } catch {
                      toast('Copy is unavailable in this browser. Select the address above.');
                    }
                  }}
                >
                  <Icon name="Copy" size={14} />
                  Copy address
                </button>
              </div>
              <div className="notice">
                <Icon name="Info" />
                <span>
                  {mode === 'demo'
                    ? 'This frontend uses a sample wallet and local demo data. No wallet is connected, and no real funds are used.'
                    : 'Your account data is supplied by the configured API. Wallet signing will be added with the backend integration.'}
                </span>
              </div>
              {mode === 'demo' && (
                <div className="reset-section">
                  <h3>Reset demo data</h3>
                  <p>Restore the sample collection, rewards, and profile on this browser.</p>
                  <Button variant="secondary" onClick={() => setReset(true)}>
                    <Icon name="RefreshCw" size={16} />
                    Reset demo
                  </Button>
                </div>
              )}
            </>
          )}
          {tab === 'help' && <GuideManual embedded />}
        </div>
      </div>
      {reset && (
        <Modal title="Reset the preview?" onClose={() => setReset(false)}>
          <div className="modal-body">
            <p>
              This clears your changes in this browser and restores the sample Pokémon, coins, and
              rewards.
            </p>
            <div className="modal-actions">
              <Button variant="secondary" onClick={() => setReset(false)}>
                Cancel
              </Button>
              <Button
                disabled={busy}
                onClick={async () => {
                  if (await act({ type: 'demo.reset' })) {
                    setReset(false);
                    navigate('/discover');
                    toast('Preview reset.');
                  }
                }}
              >
                Reset demo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function StarterPage() {
  const { state, act, busy, toast } = useApp(),
    [choice, setChoice] = useState(4),
    main = state.coins.find((c) => c.main),
    pikachu = !!main && main.holding / main.totalSupply > 0.01;
  return (
    <>
      <PageHeading
        eyebrow="EVERY ADVENTURE STARTS SOMEWHERE"
        title="Choose your starter"
        description="A first friend. A whole world of possibilities."
      />
      <div className="starter-intro">
        <Icon name="Heart" size={22} />
        <span>
          Hold the main $POKE token to choose your starter. Your first partner stays with you, with
          no redemption value.
        </span>
      </div>
      <div className="starter-grid">
        {[1, 4, 7, 25].map((id) => {
          const p = pokemonById(id),
            locked = id === 25 && !pikachu;
          return (
            <button
              className={
                'starter-card ' + (choice === id ? 'selected ' : '') + (locked ? 'locked' : '')
              }
              disabled={locked}
              onClick={() => setChoice(id)}
              key={id}
            >
              <span className="starter-choice">
                {locked ? (
                  <Icon name="Lock" />
                ) : choice === id ? (
                  <Icon name="CheckCircle2" />
                ) : (
                  <span />
                )}
              </span>
              <PokemonArt id={id} />
              <h2>{p.name}</h2>
              <div className="type-row">
                {p.types.map((t) => (
                  <TypeChip type={t} key={t} />
                ))}
              </div>
              <p>
                {id === 1 ? 'Grass / Poison' : id === 4 ? 'Fire' : id === 7 ? 'Water' : 'Electric'}
              </p>
              {locked && <span className="status-tag">Unlock above 1% of $POKE</span>}
            </button>
          );
        })}
      </div>
      <div className="starter-confirm">
        <p>
          {state.profile.starterChosen
            ? 'Your starter has already been chosen.'
            : 'Choose one starter. This choice is permanent.'}
        </p>
        <Button
          disabled={busy || state.profile.starterChosen || !main?.holding}
          onClick={async () => {
            if (await act({ type: 'starter.choose', speciesId: choice })) {
              toast(pokemonById(choice).name + ' is now in your PC.');
              navigate('/pokemon');
            }
          }}
        >
          {state.profile.starterChosen
            ? 'Starter already chosen'
            : 'I choose ' + pokemonById(choice).name + '!'}
          <Icon name="Heart" size={17} />
        </Button>
        {state.profile.starterChosen && (
          <a className="text-link" href="#/pokemon">
            Visit your Pokémon
            <Icon name="ArrowRight" size={15} />
          </a>
        )}
      </div>
    </>
  );
}

export function CreatorPage() {
  const { state } = useApp(),
    coins = state.coins.filter((c) => state.createdCoins.includes(c.id)),
    [selected, setSelected] = useState(coins[0]?.id || '');
  const coin = coins.find((c) => c.id === selected) || coins[0];
  if (!coin)
    return (
      <EmptyState
        title="Create your first coin"
        description="Create a coin draft to explore your creator console."
      >
        <a className="button primary" href="#/create">
          Create a coin
          <Icon name="Plus" />
        </a>
      </EmptyState>
    );
  const issued = state.pokemon
      .filter((p) => p.originCoin === coin.id)
      .reduce((a, p) => a + p.backing, 0),
    pending = state.rewards
      .filter((r) => r.originCoin === coin.id && !r.openedAt)
      .reduce((a, r) => a + r.backing, 0),
    evolutionReserved =
      state.pokemon
        .filter((p) => p.originCoin === coin.id)
        .reduce((a, p) => a + p.evolutionReserve, 0) +
      state.rewards
        .filter((r) => r.originCoin === coin.id && !r.openedAt)
        .reduce((a, r) => a + r.evolutionReserve, 0),
    total = coin.vault + issued + pending + evolutionReserved;
  return (
    <>
      <PageHeading
        eyebrow="GROW SOMETHING GOOD"
        title="Creator console"
        description="Your community, rewards, and little victories."
      >
        <select
          className="sort-select"
          aria-label="Choose your coin"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {coins.map((c) => (
            <option key={c.id} value={c.id}>
              {'$' + c.ticker + ' · ' + c.name}
            </option>
          ))}
        </select>
        <a href="#/create" className="button primary">
          <Icon name="Plus" />
          Create coin
        </a>
      </PageHeading>
      <div className="creator-coin panel inset">
        <CoinAvatar coin={coin} size={58} />
        <div>
          <h2>
            {coin.name}
            <span className="muted">{'$' + coin.ticker}</span>
          </h2>
          <p>{coin.description}</p>
        </div>
        <ModeBadge mode={coin.mode} />
        <a href={'#/coin/' + coin.id} className="button secondary">
          View coin
          <Icon name="ArrowUpRight" size={15} />
        </a>
      </div>
      <div className="stats-grid panels-margin">
        <div className="stat-card pale-yellow">
          <span>Creator allocation · 50%</span>
          <strong>
            {sol(total)} <small>SOL</small>
          </strong>
          <small>Illustrative fee ledger</small>
        </div>
        <div className="stat-card pale-green">
          <span>Rewards allocation · 50%</span>
          <strong>
            {sol(total)} <small>SOL</small>
          </strong>
          <small>Funded before rewards are issued</small>
        </div>
        <div className="stat-card lavender">
          <span>Community</span>
          <strong>{compact(coin.holders)}</strong>
          <small>Trainers holding your coin</small>
        </div>
      </div>
      <div className="two-column">
        <div className="panel inset">
          <h2>A clear picture of rewards.</h2>
          <p className="muted">Sample allocations for your selected coin.</p>
          <div className="ledger-row">
            <span>Available for new rewards</span>
            <SolValue amount={coin.vault} />
          </div>
          <div className="ledger-row">
            <span>Reserved in unopened rewards</span>
            <SolValue amount={pending} />
          </div>
          <div className="ledger-row">
            <span>Issued Pokémon in this sample account</span>
            <SolValue amount={issued} />
          </div>
          <div className="ledger-row">
            <span>Evolution budgets in Pokémon and unopened rewards</span>
            <SolValue amount={evolutionReserved} />
          </div>
          <div className="ledger-row total">
            <span>Total illustrated allocation</span>
            <SolValue amount={total} />
          </div>
          <p className="field-help">
            The backend will supply the complete vault ledger, including all holders and
            redemptions.
          </p>
        </div>
        <div className="panel inset holding-tip">
          <Icon name="Gift" size={29} />
          <h2>A healthy community rewards patience.</h2>
          <p>
            Reward mode: <strong>{coin.mode}</strong>. Each issued reward needs a funded reserve. If
            there isn’t enough available, rewards wait for the vault to refill.
          </p>
          <a className="text-link" href={'#/coin/' + coin.id}>
            View reward details
            <Icon name="ArrowRight" size={16} />
          </a>
        </div>
      </div>
    </>
  );
}
