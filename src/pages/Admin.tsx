import { POKEMON, pokemonById } from '../data/pokemon';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../state/AppContext';
import { Avatar, EggArt, PackArt, PokemonArt, Icon } from '../components/UI';
import {
  adminApi,
  type AdminOverview,
  type AdminUser,
  type AdminTrainer,
  type AdminLog,
  type ServiceState,
  type MainTokenPreview,
  type MainTokenSetting,
} from '../services/admin';
import { ApiError } from '../services/http';
import type { EggTier, Profile } from '../types';
import { asset } from '../utils';
const short = (wallet: string) => wallet.slice(0, 5) + '…' + wallet.slice(-5);
const date = (value: string | number | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not checked yet';
export const adminSol = (value: string | null) =>
  value === null
    ? '—'
    : (Number(value) / 1e9).toLocaleString(undefined, { maximumFractionDigits: 4 });
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'Could not load this information.';
function StateBadge({ state }: { state: ServiceState }) {
  return (
    <span className={'admin-status ' + state}>
      <span />
      {
        {
          healthy: 'Healthy',
          attention: 'Needs attention',
          stale: 'Out of date',
          unknown: 'Not checked',
          disabled: 'Switched off',
        }[state]
      }
    </span>
  );
}
function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="admin-alert" role="alert">
      <Icon name="Info" size={19} />
      <span>{children}</span>
    </div>
  );
}
function Skeleton() {
  return (
    <div className="admin-skeleton" role="status" aria-label="Loading admin data">
      <span />
      <span />
      <span />
    </div>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="admin-empty">
      <img src={asset('pixel/items/poke-ball.png')} alt="" />
      <p>{children}</p>
    </div>
  );
}
function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="admin-section">
      <header>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}
function Overview() {
  const [data, setData] = useState<AdminOverview | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const alive = useRef(true),
    inFlight = useRef(false);
  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const next = await adminApi.overview();
      if (alive.current) {
        setData(next);
        setError('');
      }
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void load();
    const tick = setInterval(() => {
      if (!document.hidden) void load();
    }, 30000);
    return () => {
      alive.current = false;
      clearInterval(tick);
    };
  }, [load]);
  const m = data?.metrics;
  return (
    <>
      <div className="admin-toolbar">
        <span>
          {data ? 'Updated ' + date(data.at) + ' · ' + data.network : 'Checking platform health'}
        </span>
        <button className="button secondary" disabled={busy} onClick={() => void load()}>
          <Icon name="RefreshCw" size={16} />
          {busy ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      {error && (
        <Alert>
          {error} {data && 'The figures below are from the last successful check.'}
        </Alert>
      )}
      {!data ? (
        <Skeleton />
      ) : (
        <>
          <div className="admin-metrics">
            {[
              ['Trainers', m!.trainers.toLocaleString(), m!.active_trainers + ' active in 24h'],
              ['Trading volume', adminSol(m!.volume_lamports) + ' SOL', 'Last 24 hours'],
              [
                'Funded rewards',
                adminSol(m!.rewards_received_lamports) + ' SOL',
                'Total credited to holder rewards',
              ],
              [
                'Battles in progress',
                m!.battles.toLocaleString(),
                m!.active_coins + ' active coins',
              ],
            ].map(([label, value, note]) => (
              <div key={label}>
                <small>{label}</small>
                <strong>{value}</strong>
                <span>{note}</span>
              </div>
            ))}
          </div>
          <div className="admin-overview-grid">
            <Section title="System check" aside={<small>Refreshes every 30 seconds</small>}>
              <div className="admin-service-list">
                {data.services.map((s) => (
                  <article key={s.id}>
                    <div>
                      <h3>{s.name}</h3>
                      <p>{s.detail}</p>
                      <small>{date(s.checkedAt)}</small>
                    </div>
                    <StateBadge state={error ? 'stale' : s.state} />
                  </article>
                ))}
              </div>
            </Section>
            <div className="admin-side-stack">
              <Section title="Reward reserves">
                <dl className="admin-values">
                  {[
                    ['Available for rewards', m!.rewards_available_lamports],
                    ['Reserved for players', m!.rewards_reserved_lamports],
                    ['Paid to players', m!.rewards_paid_lamports],
                    ['Last treasury balance', data.treasury.balanceLamports],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{adminSol(value)} SOL</dd>
                    </div>
                  ))}
                </dl>
                <p className="admin-note">
                  Gift Pokémon have no SOL claim and are excluded from these reserves.
                </p>
              </Section>
              <Section title="Payment queue">
                <div className="admin-queue">
                  <strong>
                    {m!.pending_payouts}
                    <small>pending</small>
                  </strong>
                  <strong>
                    {m!.failed_payouts}
                    <small>need review</small>
                  </strong>
                </div>
                <p className="admin-note">
                  {m!.oldest_pending_payout_at
                    ? 'Oldest pending: ' + date(m!.oldest_pending_payout_at)
                    : 'No Pokémon payments are waiting.'}
                </p>
              </Section>
              <Section title="Collection">
                <dl className="admin-values">
                  <div>
                    <dt>Owned Pokémon</dt>
                    <dd>{m!.pokemon}</dd>
                  </div>
                  <div>
                    <dt>Gifts sent</dt>
                    <dd>{m!.gifts}</dd>
                  </div>
                  <div>
                    <dt>Restricted trainers</dt>
                    <dd>{m!.restricted_trainers}</dd>
                  </div>
                </dl>
              </Section>
            </div>
          </div>
          <Section title="Worker jobs">
            <div className="admin-jobs">
              {data.jobs.map((j) => (
                <article key={j.name}>
                  <div>
                    <strong>{j.name.replaceAll('-', ' ')}</strong>
                    <small>
                      {date(j.checkedAt)}
                      {j.durationMs !== null ? ' · ' + (j.durationMs / 1000).toFixed(1) + 's' : ''}
                    </small>
                    {j.code && <code>{j.code}</code>}
                  </div>
                  <StateBadge state={error ? 'stale' : j.state} />
                </article>
              ))}
            </div>
          </Section>
        </>
      )}
    </>
  );
}
const actionLabels = {
  restrict: 'Restrict new activity',
  restore: 'Restore account',
  'revoke-sessions': 'Sign out all sessions',
  'reset-name': 'Reset display name',
};
type UserAction = keyof typeof actionLabels;
function TrainerDetail({
  wallet,
  onGift,
  onChange,
}: {
  wallet: string;
  onGift: (wallet: string) => void;
  onChange: () => void;
}) {
  const { session } = useApp(),
    [data, setData] = useState<AdminUser | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [action, setAction] = useState<UserAction>('restrict'),
    [reason, setReason] = useState(''),
    [review, setReview] = useState(false),
    [success, setSuccess] = useState('');
  useEffect(() => {
    let alive = true;
    setData(null);
    setError('');
    void adminApi
      .user(wallet)
      .then((v) => {
        if (alive) {
          setData(v);
          setAction(v.trainer.restricted ? 'restore' : 'restrict');
        }
      })
      .catch((e) => {
        if (alive) setError(message(e));
      });
    return () => {
      alive = false;
    };
  }, [wallet]);
  async function apply() {
    setBusy(true);
    setError('');
    try {
      await adminApi.mutate(session.wallet!, '/users/' + wallet, { action, reason: reason.trim() });
      setData(await adminApi.user(wallet));
      setSuccess(actionLabels[action] + ' completed.');
      setReason('');
      setReview(false);
      onChange();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Section title="Trainer record">
      {error && <Alert>{error}</Alert>}
      {!data ? (
        !error && <Skeleton />
      ) : (
        <>
          <div className="admin-trainer-head">
            <Avatar
              profile={
                {
                  character: data.trainer.character,
                  accessoryColor: data.trainer.accessory_color,
                } as Profile
              }
              size={68}
            />
            <div>
              <h3>{data.trainer.display_name || short(wallet)}</h3>
              <span
                className={'admin-status ' + (data.trainer.restricted ? 'attention' : 'healthy')}
              >
                {data.trainer.restricted ? 'Restricted' : 'Active'}
              </span>
            </div>
          </div>
          <a className="admin-wallet" href={'#/trainer/' + wallet}>
            {wallet}
            <Icon name="ArrowRight" size={15} />
          </a>
          <dl className="admin-values">
            <div>
              <dt>Pokémon</dt>
              <dd>
                {data.stats.pokemon} <small>({data.stats.gift_pokemon} gifts)</small>
              </dd>
            </div>
            <div>
              <dt>Pokémon value</dt>
              <dd>{adminSol(data.stats.backing_lamports)} SOL</dd>
            </div>
            <div>
              <dt>Unopened rewards</dt>
              <dd>{data.stats.unopened_rewards}</dd>
            </div>
            <div>
              <dt>Coin holdings</dt>
              <dd>{data.stats.holdings}</dd>
            </div>
            <div>
              <dt>Active sessions</dt>
              <dd>{data.stats.sessions}</dd>
            </div>
            <div>
              <dt>Joined</dt>
              <dd>{date(data.trainer.created_at)}</dd>
            </div>
            <div>
              <dt>Last active</dt>
              <dd>
                {data.trainer.last_active_at
                  ? date(data.trainer.last_active_at)
                  : 'Not signed in yet'}
              </dd>
            </div>
          </dl>
          <button className="button primary" onClick={() => onGift(wallet)}>
            <Icon name="Gift" size={17} />
            Send a gift
          </button>
          {data.admin ? (
            <p className="admin-note">
              Admin access is managed through the server wallet allowlist.
            </p>
          ) : (
            <form
              className="admin-manage"
              onSubmit={(e) => {
                e.preventDefault();
                if (review) void apply();
                else setReview(true);
              }}
            >
              <h3>Manage account</h3>
              <label>
                Action
                <select
                  value={action}
                  disabled={busy}
                  onChange={(e) => {
                    setAction(e.target.value as UserAction);
                    setReview(false);
                    setSuccess('');
                  }}
                >
                  {Object.entries(actionLabels)
                    .filter(([key]) => key !== (data.trainer.restricted ? 'restrict' : 'restore'))
                    .map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                </select>
              </label>
              <p className="admin-note">
                {action === 'restrict'
                  ? 'Stops new launches, trades, battles, profile edits and new reward accrual. Existing assets, sales, refunds and battles stay accessible.'
                  : action === 'restore'
                    ? 'Allows this trainer to start new activity again.'
                    : action === 'revoke-sessions'
                      ? 'Ends current sign-ins. The trainer can sign in again with their wallet.'
                      : 'Restores the shortened wallet address as their display name.'}
              </p>
              <label>
                Reason
                <textarea
                  required
                  minLength={3}
                  maxLength={280}
                  value={reason}
                  disabled={busy}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReview(false);
                    setSuccess('');
                  }}
                  placeholder="Saved privately in the admin audit log"
                />
              </label>
              {review && (
                <div className="admin-confirm">
                  <strong>{actionLabels[action]}?</strong>
                  <span>{data.trainer.display_name || short(wallet)}</span>
                  <small>{wallet}</small>
                </div>
              )}
              <div className="admin-actions">
                <button className="button secondary" disabled={busy || reason.trim().length < 3}>
                  {busy ? 'Saving…' : review ? 'Confirm change' : 'Review change'}
                </button>
                {review && (
                  <button
                    type="button"
                    className="button ghost"
                    disabled={busy}
                    onClick={() => setReview(false)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
          {success && (
            <p className="admin-success" role="status">
              {success}
            </p>
          )}
        </>
      )}
    </Section>
  );
}
function Trainers({ onGift }: { onGift: (wallet: string) => void }) {
  const [query, setQuery] = useState(''),
    [search, setSearch] = useState(''),
    [status, setStatus] = useState('all'),
    [items, setItems] = useState<AdminTrainer[]>([]),
    [next, setNext] = useState<string | null>(null),
    [selected, setSelected] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const id = ++generation.current;
    setBusy(true);
    setError('');
    setItems([]);
    setNext(null);
    void adminApi
      .users(search, status)
      .then((r) => {
        if (id === generation.current) {
          setItems(r.items);
          setNext(r.next);
        }
      })
      .catch((e) => {
        if (id === generation.current) setError(message(e));
      })
      .finally(() => {
        if (id === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, [search, status, version]);
  async function more() {
    const id = generation.current;
    setBusy(true);
    try {
      const r = await adminApi.users(search, status, next!);
      if (id === generation.current) {
        setItems((old) => [...old, ...r.items]);
        setNext(r.next);
      }
    } catch (e) {
      if (id === generation.current) setError(message(e));
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <label className="admin-search">
          <Icon name="Search" size={19} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a trainer or wallet address"
            aria-label="Search trainers"
          />
        </label>
        <select
          aria-label="Filter account status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All trainers</option>
          <option value="active">Active accounts</option>
          <option value="restricted">Restricted accounts</option>
        </select>
      </div>
      {error && <Alert>{error}</Alert>}
      <div className="admin-trainers-grid">
        <Section title="Trainers">
          <div className="admin-trainer-list">
            {items.map((t) => (
              <button
                className={selected === t.wallet ? 'selected' : ''}
                key={t.wallet}
                onClick={() => setSelected(t.wallet)}
              >
                <Avatar
                  profile={{ character: t.character, accessoryColor: t.accessory_color } as Profile}
                  size={48}
                />
                <span>
                  <strong>{t.display_name || short(t.wallet)}</strong>
                  <small>
                    {short(t.wallet)} · {t.pokemon_count} Pokémon
                  </small>
                </span>
                {t.restricted && <span className="admin-status attention">Restricted</span>}
                <Icon name="ChevronRight" size={17} />
              </button>
            ))}
          </div>
          {busy && !items.length ? (
            <Skeleton />
          ) : (
            !items.length && <Empty>No trainers match this search.</Empty>
          )}
          {next && (
            <button
              className="button secondary admin-more"
              disabled={busy}
              onClick={() => void more()}
            >
              {busy ? 'Loading…' : 'Load more trainers'}
            </button>
          )}
        </Section>
        {selected ? (
          <TrainerDetail
            key={selected}
            wallet={selected}
            onGift={onGift}
            onChange={() => setVersion((v) => v + 1)}
          />
        ) : (
          <Section title="Trainer record">
            <Empty>Select a trainer to view their account or send a gift.</Empty>
          </Section>
        )}
      </div>
    </>
  );
}
function SendPokemon({ recipient }: { recipient: string }) {
  const { session } = useApp();
  const [wallet, setWallet] = useState(recipient);
  const [speciesId, setSpeciesId] = useState(25);
  const [shiny, setShiny] = useState(false);
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const species = pokemonById(speciesId);
  function change() {
    setReview(false);
    setError('');
    setSuccess('');
  }
  async function send() {
    setBusy(true);
    setError('');
    try {
      await adminApi.mutate(session.wallet!, '/pokemon', {
        wallet: wallet.trim(),
        speciesId,
        shiny,
        reason: reason.trim(),
      });
      setSuccess(species.name + ' sent to ' + short(wallet.trim()) + '.');
      setReview(false);
      setReason('');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-gifts-grid">
      <div className="admin-gift-stage">
        <span className="admin-gift-label">DIRECT TO THEIR PC</span>
        <div className="admin-gift-art">
          <PokemonArt id={speciesId} shiny={shiny} animated={false} />
        </div>
        <h2>{species.name}</h2>
        <p>{shiny ? 'Shiny' : 'Normal'} · Level 5</p>
        <div className="admin-gift-foot">
          <Icon name="Pokeball" size={20} />
          <span>Collection Pokémon · no SOL backing</span>
        </div>
      </div>
      <Section title="Send a Pokémon">
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (review) void send();
            else setReview(true);
          }}
        >
          <label>
            Trainer wallet
            <input
              required
              minLength={32}
              maxLength={44}
              pattern="[1-9A-HJ-NP-Za-km-z]{32,44}"
              placeholder="Paste their Solana wallet address"
              disabled={busy}
              value={wallet}
              onChange={(e) => {
                setWallet(e.target.value);
                change();
              }}
            />
          </label>
          <p className="admin-note">Works even if this wallet has not joined Kanto yet.</p>
          <label>
            Pokémon
            <select
              value={speciesId}
              disabled={busy}
              onChange={(e) => {
                setSpeciesId(Number(e.target.value));
                change();
              }}
            >
              {POKEMON.map((p) => (
                <option key={p.id} value={p.id}>
                  #{String(p.id).padStart(3, '0')} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Appearance
            <select
              value={shiny ? 'shiny' : 'normal'}
              disabled={busy}
              onChange={(e) => {
                setShiny(e.target.value === 'shiny');
                change();
              }}
            >
              <option value="normal">Normal</option>
              <option value="shiny">Shiny</option>
            </select>
          </label>
          <label>
            Admin note
            <input
              required
              minLength={3}
              maxLength={280}
              disabled={busy}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                change();
              }}
              placeholder="Reason for sending (admin log only)"
            />
          </label>
          <p className="admin-note">
            Appears normally in their PC with no Gift badge. It can be trained and evolved, but
            cannot be sold for SOL or staked as a Pokémon.
          </p>
          {review && (
            <div className="admin-review">
              Send {shiny ? 'shiny ' : ''}
              {species.name} to {wallet.trim()}?
            </div>
          )}
          {error && <Alert>{error} Retrying the same request will not send it twice.</Alert>}
          {success && (
            <p className="admin-success" role="status">
              {success}
            </p>
          )}
          <button className="button primary" disabled={busy} type="submit">
            {busy ? 'Sending…' : review ? 'Confirm & send Pokémon' : 'Review Pokémon'}
          </button>
        </form>
      </Section>
    </div>
  );
}

function Gifts({ recipient }: { recipient: string }) {
  const { session } = useApp(),
    [wallet, setWallet] = useState(recipient),
    [kind, setKind] = useState<'egg' | 'pack'>('egg'),
    [tier, setTier] = useState<EggTier>('Standard'),
    [quantity, setQuantity] = useState(1),
    [reason, setReason] = useState(''),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const change = () => {
    setReview(false);
    setSuccess('');
    setError('');
  };
  async function send() {
    setBusy(true);
    setError('');
    try {
      await adminApi.mutate(session.wallet!, '/gifts', {
        wallet: wallet.trim(),
        kind,
        tier,
        quantity,
        reason: reason.trim(),
      });
      setSuccess(
        `${quantity} ${tier.toLowerCase()} ${kind}${quantity === 1 ? '' : 's'} sent to ${short(wallet.trim())}.`,
      );
      setReview(false);
      setReason('');
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-gifts-grid">
      <div className="admin-gift-stage">
        <span className="admin-gift-label">A GIFT FROM KANTO</span>
        <div className="admin-gift-art">
          {kind === 'egg' ? <EggArt tier={tier} /> : <PackArt tier={tier} />}
        </div>
        <h2>
          {tier} {kind}
        </h2>
        <span className="gift-badge">Gift · cannot be sold</span>
        <p>
          {kind === 'egg'
            ? (tier === 'Epic'
                ? 'Hatches in 4 hours'
                : tier === 'Rare'
                  ? 'Hatches in 1 hour'
                  : 'Hatches in 20 minutes') + '. Walking speeds it up.'
            : 'Ready to open as soon as it arrives.'}
        </p>
        <div className="admin-gift-foot">
          <img src={asset('pixel/items/rare-candy.png')} alt="" />
          <span>
            Train, battle and evolve.
            <br />
            Always a gift. Never a SOL claim.
          </span>
        </div>
      </div>
      <Section title="Send eggs & packs">
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (review) void send();
            else setReview(true);
          }}
        >
          <label>
            Trainer wallet
            <input
              required
              value={wallet}
              disabled={busy}
              minLength={32}
              maxLength={44}
              pattern="[1-9A-HJ-NP-Za-km-z]{32,44}"
              onChange={(e) => {
                setWallet(e.target.value);
                change();
              }}
              placeholder="Paste their Solana wallet address"
            />
          </label>
          <p className="admin-note">
            Works for existing trainers and wallets that haven’t joined yet.
          </p>
          <div className="admin-kind-picker">
            {(['egg', 'pack'] as const).map((k) => (
              <button
                key={k}
                type="button"
                aria-label={k === 'egg' ? 'Eggs' : 'Packs'}
                disabled={busy}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  change();
                }}
              >
                {k === 'egg' ? <EggArt tier={tier} /> : <PackArt tier={tier} />}
                <strong>{k === 'egg' ? 'Eggs' : 'Packs'}</strong>
              </button>
            ))}
          </div>
          <div className="admin-field-row">
            <label>
              Tier
              <select
                disabled={busy}
                value={tier}
                onChange={(e) => {
                  setTier(e.target.value as EggTier);
                  change();
                }}
              >
                {['Standard', 'Rare', 'Epic'].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              Quantity
              <input
                type="number"
                min={1}
                max={25}
                required
                disabled={busy}
                value={quantity}
                onChange={(e) => {
                  setQuantity(Number(e.target.value));
                  change();
                }}
              />
            </label>
          </div>
          <label>
            Reason
            <textarea
              required
              minLength={3}
              maxLength={280}
              value={reason}
              disabled={busy}
              onChange={(e) => {
                setReason(e.target.value);
                change();
              }}
              placeholder="For your private audit log"
            />
          </label>
          {review && (
            <div className="admin-confirm">
              <strong>
                Send {quantity} {tier.toLowerCase()} {kind}
                {quantity === 1 ? '' : 's'}?
              </strong>
              <span className="admin-wallet">{wallet}</span>
              <p>
                The Pokémon are random and permanently unsellable. This does not use the reward
                treasury.
              </p>
            </div>
          )}
          {error && (
            <Alert>
              {error} If the connection was interrupted, retrying this same gift won’t send it
              twice.
            </Alert>
          )}
          {success && (
            <p className="admin-success" role="status">
              {success}
            </p>
          )}
          <div className="admin-actions">
            <button className="button primary" disabled={busy || reason.trim().length < 3}>
              {busy ? 'Sending…' : review ? 'Confirm & send gift' : 'Review gift'}
            </button>
            {review && (
              <button
                type="button"
                className="button ghost"
                disabled={busy}
                onClick={() => setReview(false)}
              >
                Back
              </button>
            )}
          </div>
        </form>
      </Section>
    </div>
  );
}
function Logs() {
  const [kind, setKind] = useState('system'),
    [level, setLevel] = useState('all'),
    [items, setItems] = useState<AdminLog[]>([]),
    [next, setNext] = useState<string | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [refresh, setRefresh] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    const id = ++generation.current;
    setBusy(true);
    setItems([]);
    setNext(null);
    setError('');
    void adminApi
      .logs(kind, level)
      .then((r) => {
        if (id === generation.current) {
          setItems(r.items);
          setNext(r.next);
        }
      })
      .catch((e) => {
        if (id === generation.current) setError(message(e));
      })
      .finally(() => {
        if (id === generation.current) setBusy(false);
      });
    return () => {
      generation.current++;
    };
  }, [kind, level, refresh]);
  async function more() {
    const id = generation.current;
    setBusy(true);
    try {
      const r = await adminApi.logs(kind, level, next!);
      if (id === generation.current) {
        setItems((old) => [...old, ...r.items]);
        setNext(r.next);
      }
    } catch (e) {
      if (id === generation.current) setError(message(e));
    } finally {
      if (id === generation.current) setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-toolbar">
        <div className="admin-segments">
          <button aria-pressed={kind === 'system'} onClick={() => setKind('system')}>
            System events
          </button>
          <button aria-pressed={kind === 'audit'} onClick={() => setKind('audit')}>
            Admin audit
          </button>
        </div>
        {kind === 'system' && (
          <select
            aria-label="Filter log severity"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="all">All events</option>
            <option value="error">Errors</option>
            <option value="info">Recoveries</option>
          </select>
        )}
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setRefresh((v) => v + 1)}
        >
          Refresh
        </button>
      </div>
      <p className="admin-note">
        {kind === 'system'
          ? 'API failures and worker failures/recoveries, retained for 30 days (up to 50,000 events). Server console output and secrets are not included.'
          : 'Every gift, account change and main-token update is recorded here. Audit records cannot be edited or removed.'}
      </p>
      {error && <Alert>{error}</Alert>}
      <Section title={kind === 'system' ? 'System events' : 'Admin audit'}>
        <div className="admin-log-list">
          {items.map((log) => (
            <article key={log.id}>
              <div className={'admin-event-dot ' + (log.level === 'error' ? 'error' : '')} />
              <div>
                <div className="admin-log-heading">
                  <strong>
                    {kind === 'system'
                      ? log.operation
                      : log.action === 'pokemon.issue'
                        ? 'Pokémon sent'
                        : log.action === 'gift'
                          ? `${log.details?.quantity} ${log.details?.tier} ${log.details?.kind}${log.details?.quantity === 1 ? '' : 's'} sent`
                          : log.action?.replaceAll('-', ' ')}
                  </strong>
                  <time>{date(log.created_at)}</time>
                </div>
                {kind === 'system' ? (
                  <>
                    <code>{log.code}</code>
                    {log.request_id && <small>Request {log.request_id}</small>}
                  </>
                ) : (
                  <>
                    <p>{log.reason}</p>
                    <small>
                      By {short(log.actor_wallet!)} →{' '}
                      <a href={'#/trainer/' + log.target_wallet}>{short(log.target_wallet!)}</a>
                    </small>
                    {log.details?.mint && <code>{log.details.mint}</code>}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
        {busy && !items.length ? (
          <Skeleton />
        ) : (
          !items.length && (
            <Empty>
              {kind === 'system'
                ? 'No matching events have been recorded.'
                : 'Admin actions will appear here.'}
            </Empty>
          )
        )}
        {next && (
          <button
            className="button secondary admin-more"
            disabled={busy}
            onClick={() => void more()}
          >
            {busy ? 'Loading…' : 'Load more events'}
          </button>
        )}
      </Section>
    </>
  );
}
function MainToken() {
  const { session, reload } = useApp(),
    [current, setCurrent] = useState<MainTokenSetting | null>(null),
    [mint, setMint] = useState(''),
    [signature, setSignature] = useState(''),
    [mode, setMode] = useState<'Eggs' | 'Packs' | 'Mixed'>('Mixed'),
    [preview, setPreview] = useState<MainTokenPreview | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState(''),
    [advanced, setAdvanced] = useState(false);
  useEffect(() => {
    let alive = true;
    void adminApi
      .main()
      .then((r) => {
        if (alive) setCurrent(r);
      })
      .catch((e) => {
        if (alive) setError(message(e));
      });
    return () => {
      alive = false;
    };
  }, []);
  async function check() {
    setBusy(true);
    setError('');
    setPreview(null);
    setSuccess('');
    try {
      setPreview(await adminApi.preview(mint.trim(), signature));
    } catch (e) {
      setError(message(e));
      if (e instanceof ApiError && e.code === 'LAUNCH_SIGNATURE_REQUIRED') setAdvanced(true);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    if (!preview) return;
    setBusy(true);
    setError('');
    try {
      await adminApi.mutate(session.wallet!, '/main-token', {
        mint: preview.coin.mint,
        signature: preview.coin.signature,
        mode,
        expectedMint: preview.currentMint,
        reason: 'Set main token from the admin panel',
      });
      setCurrent(await adminApi.main());
      setPreview(null);
      setSuccess(
        'Main token connected. Pikachu is paired, and the worker will index its history before issuing funded rewards.',
      );
      void reload();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-main-grid">
      <div className="admin-main-pokemon">
        <PokemonArt id={25} animated />
        <h2>Kanto’s main token</h2>
        <p>Pikachu is its partner. The original launching wallet remains the creator.</p>
        <div className="admin-splits">
          <span>
            <strong>30%</strong>Creator
          </span>
          <span>
            <strong>20%</strong>Platform
          </span>
          <span>
            <strong>50%</strong>Rewards
          </span>
        </div>
        <p className="admin-note">
          The existing, locked Pump fee split is verified on-chain. This setup sends no transaction
          and does not change recipients.
        </p>
      </div>
      <div className="admin-side-stack">
        <Section title="Connected token">
          {!current ? (
            <Skeleton />
          ) : current.mint ? (
            <>
              <a
                className="admin-wallet"
                href={
                  current.coin
                    ? '#/coin/' + current.coin.id
                    : 'https://pump.fun/coin/' + current.mint
                }
              >
                {current.coin?.name || 'Configured token'} ·{' '}
                {current.coin?.ticker || short(current.mint)}
                <Icon name="ArrowRight" size={16} />
              </a>
              <code className="admin-wallet">{current.mint}</code>
              {current.coin && (
                <p className="admin-note">
                  {current.coin.mode} rewards · {current.coin.status} · Creator{' '}
                  {short(current.coin.creator_wallet)}
                </p>
              )}
            </>
          ) : (
            <p>No main token is connected yet.</p>
          )}
        </Section>
        <Section title="Set up main token">
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              void check();
            }}
          >
            <label>
              Token contract address
              <input
                required
                minLength={32}
                maxLength={44}
                disabled={busy}
                value={mint}
                onChange={(e) => {
                  setMint(e.target.value);
                  setPreview(null);
                  setSuccess('');
                }}
                placeholder="Paste the Pump coin CA"
              />
            </label>
            <button
              className="admin-text-button"
              type="button"
              onClick={() => setAdvanced((v) => !v)}
              aria-expanded={advanced}
            >
              Have its creation transaction? {advanced ? 'Hide' : 'Add signature'}
            </button>
            {advanced && (
              <label>
                Creation transaction signature <small>(optional)</small>
                <input
                  value={signature}
                  disabled={busy}
                  onChange={(e) => {
                    setSignature(e.target.value);
                    setPreview(null);
                  }}
                  placeholder="Useful for coins with a long history"
                />
              </label>
            )}
            <label>
              Holder rewards
              <select
                disabled={busy}
                value={mode}
                onChange={(e) => setMode(e.target.value as typeof mode)}
              >
                <option value="Mixed">Eggs & packs</option>
                <option value="Eggs">Eggs</option>
                <option value="Packs">Packs</option>
              </select>
            </label>
            <button className="button secondary" disabled={busy || !mint.trim()}>
              {busy ? 'Checking…' : 'Check coin & fee split'}
            </button>
          </form>
          {preview && (
            <div className="admin-main-preview">
              <div>
                {preview.coin.image && (
                  <img src={preview.coin.image} alt="Coin" referrerPolicy="no-referrer" />
                )}
                <h3>
                  {preview.coin.name}
                  <small>{preview.coin.symbol}</small>
                </h3>
                <span className="admin-status healthy">Split verified</span>
              </div>
              <dl className="admin-values">
                <div>
                  <dt>Launched by</dt>
                  <dd>
                    <a href={'#/trainer/' + preview.coin.creatorWallet}>
                      {short(preview.coin.creatorWallet)}
                    </a>
                  </dd>
                </div>
                <div>
                  <dt>Launch date</dt>
                  <dd>{date(preview.coin.launchedAt)}</dd>
                </div>
                <div>
                  <dt>Paired Pokémon</dt>
                  <dd>Pikachu</dd>
                </div>
                <div>
                  <dt>Rewards</dt>
                  <dd>{mode === 'Mixed' ? 'Eggs & packs' : mode}</dd>
                </div>
              </dl>
              <code className="admin-wallet">{preview.coin.mint}</code>
              {preview.currentMint && preview.currentMint !== preview.coin.mint && (
                <Alert>
                  This replaces the current main token. Existing coins and funded rewards stay
                  intact.
                </Alert>
              )}
              <p className="admin-note">
                The coin is added to Discover. Rewards begin only after its history and received
                reward funds are verified.
              </p>
              <button className="button primary" disabled={busy} onClick={() => void save()}>
                {busy ? 'Connecting…' : 'Confirm main token'}
              </button>
            </div>
          )}
          {error && <Alert>{error}</Alert>}
          {success && (
            <p className="admin-success" role="status">
              {success}
            </p>
          )}
        </Section>
      </div>
    </div>
  );
}
const tabs = [
  ['overview', 'Overview', 'Activity'],
  ['trainers', 'Trainers', 'Users'],
  ['gifts', 'Gifts', 'Gift'],
  ['pokemon', 'Send Pokémon', 'Pokeball'],
  ['main-token', 'Main token', 'Pokeball'],
  ['logs', 'Logs', 'BookOpen'],
] as const;
export function AdminPage() {
  const { state, mode, session } = useApp(),
    [tab, setTab] = useState<(typeof tabs)[number][0]>('overview'),
    [recipient, setRecipient] = useState('');
  if (
    mode !== 'live' ||
    session.status !== 'authenticated' ||
    session.wallet !== state.profile.wallet ||
    !state.admin
  )
    return (
      <section className="admin-access">
        <img src={asset('brand/kanto-emblem.png')} alt="Kanto" />
        <h1>Admin access only</h1>
        <p>This area is available to approved admin wallets.</p>
        <a className="button secondary" href="#/discover">
          Back to Kanto
        </a>
      </section>
    );
  return (
    <div className="admin-page" key={session.wallet}>
      <header className="admin-hero">
        <div className="admin-hero-emblem">
          <img src={asset('brand/kanto-emblem.png')} alt="" />
        </div>
        <div>
          <span className="admin-eyebrow">KANTO OPERATIONS</span>
          <h1>Control room</h1>
          <p>Your trainers, rewards and platform health.</p>
        </div>
        <span className="admin-access-badge">Admin · {short(session.wallet!)}</span>
      </header>
      <nav className="admin-tabs" aria-label="Admin sections">
        {tabs.map(([id, label, icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-current={tab === id ? 'page' : undefined}
          >
            <Icon name={icon} size={18} />
            {label}
          </button>
        ))}
      </nav>
      {tab === 'overview' ? (
        <Overview />
      ) : tab === 'trainers' ? (
        <Trainers
          onGift={(wallet) => {
            setRecipient(wallet);
            setTab('gifts');
          }}
        />
      ) : tab === 'gifts' ? (
        <Gifts key={recipient} recipient={recipient} />
      ) : tab === 'pokemon' ? (
        <SendPokemon key={recipient} recipient={recipient} />
      ) : tab === 'main-token' ? (
        <MainToken />
      ) : (
        <Logs />
      )}
    </div>
  );
}
