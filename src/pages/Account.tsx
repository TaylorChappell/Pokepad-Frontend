import { holdingStreakLabel } from '../services/holdings';
import { TrainerBanner, TrainerImageEditor } from '../components/TrainerImages';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSoundPreference } from '../audio/sound';
import { useApp } from '../state/AppContext';
import { WalletConnection } from '../components/WalletConnection';
import { GymBadge, coinForBadge } from '../components/GymBadge';
import { gymRankings } from '../state/gyms';
import { collectionValue, profileName, shortWallet } from '../state/model';
import { ACCENT_COLORS, CHARACTERS } from '../data/demo';
import { pokemonById } from '../data/pokemon';
import {
  Avatar,
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
  const { state, mode } = useApp(),
    held = state.coins.filter((c) => c.holding > 0),
    syncing = held.some((c) => c.holdingStatus === 'syncing'),
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
        </div>
        <div className="stat-card pale-green">
          <span>
            <Icon name="Pokeball" />
            Pokémon value
          </span>
          <strong>
            {sol(collectionValue(state))} <small>SOL</small>
          </strong>
        </div>
        <div className="stat-card pale-yellow">
          <span>
            <Icon name="Flame" />
            Longest hold streak
          </span>
          <strong>
            {Math.floor(Math.max(0, ...held.map((c) => c.holdingDays)))} <small>days</small>
          </strong>
        </div>
      </div>
      {mode === 'live' && !!state.redemptions?.length && (
        <section className="panel inset panels-margin">
          <h2>Redemptions</h2>
          {state.redemptions.map((payout) => (
            <div className="redemption-status-row" key={payout.id}>
              <PokemonArt id={payout.speciesId} animated={false} />
              <div>
                <strong>{pokemonById(payout.speciesId).name}</strong>
                <small>
                  {payout.status === 'confirmed'
                    ? 'Paid on Solana'
                    : payout.status === 'failed'
                      ? 'Payout needs attention'
                      : 'Payment pending confirmation'}
                </small>
              </div>
              <SolValue amount={payout.amountSol} />
              {payout.signature && (
                <a
                  href={'https://solscan.io/tx/' + encodeURIComponent(payout.signature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction
                </a>
              )}
            </div>
          ))}
        </section>
      )}
      <div className="section-heading">
        <h2>
          Your communities <span className="count-pill">{held.length}</span>
        </h2>
        <a className="text-link" href="#/discover">
          Find a new coin
          <Icon name="ArrowRight" size={15} />
        </a>
      </div>
      {syncing && (
        <p className="holding-sync-note" role="status">
          <Icon name="Clock" size={16} />
          Your token balance is confirmed. We’re checking your holding history for rewards.
        </p>
      )}
      {!held.length && state.coins.some((c) => c.holdingStatus === 'unavailable') && (
        <p className="holding-sync-note" role="status">
          <Icon name="Clock" size={16} />
          Your wallet balances couldn’t be refreshed. We’ll try again shortly.
        </p>
      )}
      <div className="panel table-wrap portfolio-holdings">
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
                <td data-label="Holdings">
                  <strong>{compact(c.holding)}</strong>
                  <small>{c.ticker}</small>
                </td>
                <td data-label="Est. value">{sol(c.holding * c.price)} SOL</td>
                <td data-label="Hold streak">
                  <span className="streak-chip">
                    <Icon
                      name={
                        c.holdingStatus === 'syncing' || c.holdingStatus === 'unavailable'
                          ? 'Clock'
                          : 'Flame'
                      }
                      size={14}
                    />
                    {holdingStreakLabel(c)}
                  </span>
                </td>
                <td data-label="Rewards">
                  {c.active ? (
                    <ModeBadge mode={c.mode} />
                  ) : (
                    <span className="status-tag">Paused · inactive</span>
                  )}
                </td>
                <td data-label="Last 24h" className={c.change >= 0 ? 'positive' : 'negative'}>
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
                <PokemonArt id={p.speciesId} shiny={p.shiny} />
                <div>
                  <h2>{pokemonById(p.speciesId).name}</h2>
                  <p>
                    {mode === 'live' && p.starter && p.backing === 0
                      ? p.originCoin
                        ? `Rare Candy from holding $${state.coins.find((c) => c.id === p.originCoin)?.ticker || 'your starter’s coin'} until its first evolution.`
                        : 'Hold an active coin to begin earning funded Rare Candy.'
                      : 'Rare Candy from holding active coins.'}
                  </p>
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
  const { state, mode } = useApp(),
    gym = gymRankings(state).find((g) => g.coinId === state.profile.supportedGym),
    partner = state.pokemon.find((p) => p.id === state.profile.equippedId);
  return (
    <>
      <TrainerBanner profile={state.profile} />
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
          <small>
            {mode === 'live' ? 'Server-accepted walking distance' : 'Walking preview distance'}
          </small>
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
              <PokemonArt id={partner.speciesId} shiny={partner.shiny} />
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
              <GymBadge coin={gym.coin} />
              <span>
                <h3>{gym.name}</h3>
                <small>Supporting this community</small>
              </span>
              <Icon name="ArrowRight" />
            </a>
          )}
          <div className="badge-shelf">
            {state.badges.map((badge) => {
              const coin = coinForBadge(state.coins, badge);
              return coin ? (
                <a key={badge} href={'#/gym/' + coin.id} title={coin.name + ' gym'}>
                  <GymBadge coin={coin} size={61} />
                  <small>{coin.ticker}</small>
                </a>
              ) : null;
            })}
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

const editableProfile = (profile: Profile) => ({
  avatarImage: profile.avatarImage || null,
  bannerImage: profile.bannerImage || null,
  bannerPreset: profile.bannerPreset || 'meadow',
  displayName: profile.displayName.trim(),
  character: profile.character,
  accessoryColor: profile.accessoryColor,
  artStyle: profile.artStyle,
  reducedMotion: profile.reducedMotion,
  rewardNotifications: profile.rewardNotifications,
  evolutionNotifications: profile.evolutionNotifications,
});

export function SettingsPage({ tab: initial = 'profile' }: { tab?: string }) {
  const { muted, toggleMuted } = useSoundPreference();
  const { state, act, toast, busy, mode } = useApp();
  const [tab, setTab] = useState(initial);
  const [draft, setDraft] = useState<Profile>(state.profile);
  const [reset, setReset] = useState(false);
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved');
  const [saveDelay, setSaveDelay] = useState(0);
  const [revision, setRevision] = useState(0);
  const latestAct = useRef(act);
  const latestDraft = useRef(draft);
  const latestProfile = useRef(state.profile);
  const failedPatch = useRef('');
  latestAct.current = act;
  latestDraft.current = draft;
  latestProfile.current = state.profile;
  useEffect(() => setTab(initial), [initial]);
  const update = (patch: Partial<Profile>, delayed = false) => {
    failedPatch.current = '';
    setDraft((previous) => ({ ...previous, ...patch }));
    setSaveDelay(delayed ? 550 : 0);
    setSaveState('saving');
    setRevision((value) => value + 1);
  };
  useEffect(() => {
    const patch = editableProfile(draft);
    const serialized = JSON.stringify(patch);
    if (serialized === JSON.stringify(editableProfile(state.profile))) {
      setSaveState('saved');
      return;
    }
    if (busy || failedPatch.current === serialized) return;
    const timer = window.setTimeout(async () => {
      setSaveState('saving');
      const saved = await latestAct.current({ type: 'profile.update', patch });
      if (!saved) {
        failedPatch.current = serialized;
        setSaveState('error');
      } else if (
        JSON.stringify(editableProfile(latestDraft.current)) ===
        JSON.stringify(editableProfile(saved.profile))
      ) {
        setSaveState('saved');
      }
    }, saveDelay);
    return () => window.clearTimeout(timer);
  }, [draft, state.profile, busy, saveDelay, revision]);
  // Preserve a name still inside the debounce window when navigating away.
  useEffect(
    () => () => {
      const patch = editableProfile(latestDraft.current);
      if (JSON.stringify(patch) !== JSON.stringify(editableProfile(latestProfile.current))) {
        void latestAct.current({ type: 'profile.update', patch });
      }
    },
    [],
  );
  const retry = () => {
    failedPatch.current = '';
    setSaveState('saving');
    setRevision((value) => value + 1);
  };
  const saveStatus = (
    <span className={'autosave-status ' + saveState} role="status" aria-live="polite">
      <span className="autosave-indicator" aria-hidden="true" />
      {saveState === 'saving'
        ? 'Saving…'
        : saveState === 'error'
          ? 'Could not save'
          : 'All changes saved'}
      {saveState === 'error' && <button onClick={retry}>Retry</button>}
    </span>
  );
  return (
    <div className="account-settings">
      <PageHeading title="Settings">{saveStatus}</PageHeading>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Settings sections">
          {[
            { id: 'profile', name: 'Trainer profile', icon: 'Users' as const },
            { id: 'notifications', name: 'Preferences', icon: 'Bell' as const },
            { id: 'wallet', name: 'Wallet', icon: 'Wallet' as const },
            { id: 'help', name: 'Trainer handbook', icon: 'HelpCircle' as const },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={tab === item.id ? 'active' : ''}
              aria-current={tab === item.id ? 'page' : undefined}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.name}</span>
              <Icon name="ChevronRight" size={14} />
            </button>
          ))}
        </nav>
        <div className="panel settings-content">
          {tab === 'profile' && (
            <>
              <div className="settings-section-heading">
                <div>
                  <h2>Make it your trainer.</h2>
                  <p>Choose a face, pick a colour, and you’re ready.</p>
                </div>
              </div>
              <div className="avatar-editor">
                <div
                  className="avatar-preview-frame"
                  style={{ '--trainer-accent': draft.accessoryColor } as CSSProperties}
                >
                  <Avatar profile={draft} size={132} />
                  <span className="avatar-preview-label">TRAINER CARD</span>
                </div>
                <div>
                  <h3>{draft.displayName.trim() || shortWallet(state.profile.wallet)}</h3>
                  <p>
                    {draft.character[0].toUpperCase() + draft.character.slice(1)} · Kanto trainer
                  </p>
                  <button
                    className="button secondary randomise-trainer"
                    onClick={() =>
                      update({
                        avatarImage: null,
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
              <div className="editor-label-row">
                <h3>Trainer</h3>
                <span>Choose your look</span>
              </div>
              <div className="character-options" role="group" aria-label="Trainer appearance">
                {CHARACTERS.map((character) => (
                  <button
                    className={draft.character === character ? 'selected' : ''}
                    key={character}
                    aria-pressed={draft.character === character}
                    onClick={() => update({ character, avatarImage: null })}
                  >
                    <Avatar profile={{ ...draft, character, avatarImage: null }} size={76} />
                    <span>{character[0].toUpperCase() + character.slice(1)}</span>
                    {draft.character === character && (
                      <span className="trainer-selected-check">
                        <Icon name="Check" size={12} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <TrainerImageEditor section="avatar" profile={draft} onChange={update} />
              <div className="editor-label-row">
                <h3>Accessory colour</h3>
              </div>
              <div className="colour-options" role="group" aria-label="Accessory colour">
                {ACCENT_COLORS.map((colour, index) => (
                  <button
                    key={colour}
                    className={draft.accessoryColor === colour ? 'selected' : ''}
                    aria-label={
                      'Choose accessory colour ' +
                      ['Coral', 'Ocean', 'Leaf', 'Lilac', 'Golden', 'Rose'][index]
                    }
                    aria-pressed={draft.accessoryColor === colour}
                    style={{ background: colour }}
                    onClick={() => update({ accessoryColor: colour })}
                  >
                    {draft.accessoryColor === colour && <Icon name="Check" size={19} />}
                  </button>
                ))}
              </div>
              <TrainerImageEditor section="banner" profile={draft} onChange={update} />
              <div className="editor-display-name">
                <label className="field-label" htmlFor="display-name">
                  Display name
                </label>
                <input
                  className="text-input"
                  id="display-name"
                  maxLength={24}
                  value={draft.displayName}
                  placeholder={shortWallet(state.profile.wallet)}
                  onChange={(e) => update({ displayName: e.target.value }, true)}
                  onBlur={() => {
                    setSaveDelay(0);
                    setRevision((value) => value + 1);
                  }}
                />
                <p className="field-help">
                  <span>Leave blank to use your wallet address.</span>
                  <span>{draft.displayName.length}/24</span>
                </p>
              </div>
              <div className="art-setting">
                <div className="editor-label-row">
                  <h3>Pokémon artwork</h3>
                  <span>Your choice, everywhere</span>
                </div>
                <div className="art-style-options">
                  {(['pixel', 'drawn'] as const).map((style) => (
                    <button
                      type="button"
                      className={draft.artStyle === style ? 'selected' : ''}
                      key={style}
                      onClick={() => update({ artStyle: style })}
                      aria-pressed={draft.artStyle === style}
                    >
                      <PokemonArt id={6} animated={false} styleOverride={style} />
                      <span className="art-style-copy">
                        <strong>{style === 'pixel' ? 'Game sprites' : 'Illustrations'}</strong>
                        <small>
                          {style === 'pixel'
                            ? 'Classic pixels, full of character'
                            : 'Official Pokémon artwork'}
                        </small>
                      </span>
                      <span className="art-choice-check">
                        {draft.artStyle === style && <Icon name="Check" size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {tab === 'notifications' && (
            <>
              <div className="settings-section-heading">
                <h2>Just the updates you want.</h2>
                <p>These preferences save as soon as you change them.</p>
              </div>
              <div className="toggle-row">
                <div>
                  <strong>Game sound</strong>
                  <p>Battle music, attack effects, hatching, packs, and evolution.</p>
                </div>
                <button
                  className={'toggle ' + (!muted ? 'on' : '')}
                  role="switch"
                  aria-checked={!muted}
                  aria-label="Game sound"
                  onClick={toggleMuted}
                >
                  <span />
                </button>
              </div>
              {[
                {
                  key: 'rewardNotifications' as const,
                  title: 'Eggs & packs',
                  description: 'Know when an egg is ready or a new reward arrives.',
                },
                {
                  key: 'evolutionNotifications' as const,
                  title: 'Evolution updates',
                  description: 'See when your Pokémon is ready to evolve.',
                },
                {
                  key: 'reducedMotion' as const,
                  title: 'Reduce motion',
                  description: 'Still artwork, shorter reveals, and less movement.',
                },
              ].map((item) => (
                <div className="toggle-row" key={item.key}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                  <button
                    className={'toggle ' + (draft[item.key] ? 'on' : '')}
                    role="switch"
                    aria-checked={draft[item.key]}
                    aria-label={item.title}
                    onClick={() => update({ [item.key]: !draft[item.key] })}
                  >
                    <span />
                  </button>
                </div>
              ))}
            </>
          )}
          {tab === 'wallet' && (
            <>
              <div className="settings-section-heading">
                <h2>Your wallet</h2>
                <p>Account and connection details.</p>
              </div>
              <div className="wallet-card">
                <Icon name="Wallet" size={28} />
                <span className="status-tag">
                  {mode === 'demo'
                    ? 'Demo wallet'
                    : state.profile.wallet
                      ? 'Authenticated Solana account'
                      : 'Not connected'}
                </span>
                <label>Wallet address</label>
                <code>{state.profile.wallet || 'Connect a wallet to create your trainer.'}</code>
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
                    : 'Your wallet signs in to your trainer account. Every token launch or trade requires a separate transaction approval in your wallet.'}
                </span>
              </div>
              <WalletConnection />
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
        <Modal title="Reset demo data?" onClose={() => setReset(false)}>
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
                  const next = await act({ type: 'demo.reset' });
                  if (next) {
                    latestDraft.current = next.profile;
                    latestProfile.current = next.profile;
                    setDraft(next.profile);
                    setReset(false);
                    navigate('/discover');
                    toast('Demo reset.');
                  }
                }}
              >
                Reset demo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function StarterPage() {
  return (
    <>
      <PageHeading title="Choose your starter" />
      <StarterChoice onChosen={() => navigate('/pokemon')} />
    </>
  );
}
export function StarterChoice({ onChosen }: { onChosen?: () => void }) {
  const { state, act, busy, toast, mode } = useApp(),
    [choice, setChoice] = useState(4),
    main = state.coins.find((c) => c.main && c.totalSupply > 0),
    freeAccess = mode === 'live' ? state.starterEligibility?.requiresMainToken === false : !main,
    pikachu =
      mode === 'live'
        ? state.starterEligibility?.canChoosePikachu === true
        : freeAccess || (!!main && main.holding / main.totalSupply > 0.01);
  return (
    <>
      <div className="starter-intro">
        <Icon name="Heart" size={22} />
        <span>
          {freeAccess
            ? 'Your first partner is on us! Choose any of the four starters. No main token is needed before it launches.'
            : `Choose your first partner with your $${main?.ticker || 'KANTO'} holding.`}
          {' Your starter begins with no SOL value.'}
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
              disabled={locked || busy || state.profile.starterChosen}
              aria-pressed={choice === id}
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
              {locked && (
                <span className="status-tag">Unlock above 1% of ${main?.ticker || 'KANTO'}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="starter-confirm">
        {mode === 'live' && state.starterEligibility?.reason && (
          <p className="notice">{state.starterEligibility.reason}</p>
        )}
        <p>
          {state.profile.starterChosen
            ? 'Your starter has already been chosen.'
            : 'Choose one starter. This choice is permanent.'}
        </p>
        <Button
          disabled={
            busy ||
            state.profile.starterChosen ||
            (choice === 25 && !pikachu) ||
            (mode === 'live' ? !state.starterEligibility?.canChoose : !freeAccess && !main?.holding)
          }
          onClick={async () => {
            if (await act({ type: 'starter.choose', speciesId: choice })) {
              toast(pokemonById(choice).name + ' is now in your PC.');
              onChosen?.();
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
