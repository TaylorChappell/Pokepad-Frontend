import { PokemonRecovery } from '../components/PokemonRecovery';
import { PokemonMoveSet } from '../components/PokemonMoveSet';
import { ItemSprite } from '../components/ItemSprite';
import { PokemonBag } from '../components/PokemonBag';
import { POKEMON_SORTS, sortPokemon } from '../state/pokemon-sort';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { PokemonProgressDialog } from '../components/PokemonProgressDialog';
import { POKEMON, pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
import { getPokemonHealth, getPokemonStats } from '../data/stats';
import { collectionValue, getEvolutionStatus, pendingMove } from '../state/model';
import {
  compareBattlePokemon,
  comparePokemonStrength,
  demoPokemonCatalogue,
  pokemonStrength,
  variantDiscoveries,
} from '../state/collection';
import {
  Button,
  Icon,
  PokemonArt,
  PageHeading,
  TypeChip,
  SolValue,
  Progress,
  Modal,
  EmptyState,
  CoinAvatar,
} from '../components/UI';
import type { OwnedPokemon } from '../types';
import { asset, navigate, sol, TYPE_COLORS } from '../utils';

function CandySprite() {
  return (
    <img
      className="rare-candy-sprite"
      src={asset('pixel/rare-candy.png')}
      width="32"
      height="32"
      alt="Rare Candy"
    />
  );
}
function SpeciesDistinction({ id }: { id: number }) {
  if (![144, 145, 146, 150, 151].includes(id)) return null;
  return <span className="species-distinction">{id === 151 ? 'Mythical' : 'Legendary'}</span>;
}
function HealthMeter({ pokemon, compact = false }: { pokemon: OwnedPokemon; compact?: boolean }) {
  const { now } = useApp();
  const hp = getPokemonHealth(pokemon, now);
  return (
    <div className={'pokemon-health ' + (compact ? 'compact' : '')}>
      <div className="health-caption">
        <span>HP</span>
        <strong>
          {hp.current}
          <small> / {hp.max}</small>
        </strong>
      </div>
      <div
        className="health-meter"
        role="meter"
        aria-label="Health"
        aria-valuenow={hp.current}
        aria-valuemin={0}
        aria-valuemax={hp.max}
      >
        <span
          style={{
            width: hp.percent + '%',
            background: hp.percent < 25 ? '#dc595a' : hp.percent < 50 ? '#e4aa42' : undefined,
          }}
        />
      </div>
    </div>
  );
}
function FavouriteButton({
  pokemon,
  showLabel = false,
}: {
  pokemon: OwnedPokemon;
  showLabel?: boolean;
}) {
  const { act, busy } = useApp();
  const name = pokemonById(pokemon.speciesId).name;
  return (
    <button
      type="button"
      className={
        'pokemon-favourite ' +
        (pokemon.favourite ? 'is-favourite ' : '') +
        (showLabel ? 'with-label' : '')
      }
      aria-label={
        (pokemon.favourite ? 'Remove ' : 'Add ') +
        name +
        (pokemon.favourite ? ' from favourites' : ' to favourites')
      }
      aria-pressed={!!pokemon.favourite}
      disabled={busy}
      onClick={() =>
        void act({ type: 'pokemon.favourite', id: pokemon.id, favourite: !pokemon.favourite })
      }
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
      </svg>
      {showLabel && <span>{pokemon.favourite ? 'Favourited' : 'Favourite'}</span>}
    </button>
  );
}
function PokemonActions({ pokemon: p }: { pokemon: OwnedPokemon }) {
  const { state, act, busy, toast } = useApp(),
    [open, setOpen] = useState(false),
    [panel, setPanel] = useState<'items' | 'manuals' | 'learn' | 'evolve' | null>(null),
    root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', key);
    };
  }, [open]);
  const pick = (p: typeof panel) => {
    setOpen(false);
    setPanel(p);
  };
  return (
    <div className="pokemon-actions" ref={root}>
      <button
        className="pokemon-more-button"
        aria-label={'More actions for ' + pokemonById(p.speciesId).name}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="MoreHorizontal" size={20} />
      </button>
      {open && (
        <div className="pokemon-action-menu" role="menu">
          <button role="menuitem" onClick={() => pick('items')}>
            <Icon name="Backpack" size={16} />
            Use item
          </button>
          <button role="menuitem" onClick={() => pick('manuals')}>
            <Icon name="BookOpen" size={16} />
            Teach move
          </button>
          {pendingMove(p) && (
            <button role="menuitem" disabled={p.locked} onClick={() => pick('learn')}>
              <Icon name="Swords" size={16} />
              Learn new move
            </button>
          )}
          {getEvolutionStatus(state, p).canEvolve && (
            <button role="menuitem" onClick={() => pick('evolve')}>
              <Icon name="ChevronUp" size={16} />
              Evolve
            </button>
          )}
          <button
            role="menuitem"
            disabled={busy || p.locked || state.profile.equippedId === p.id}
            onClick={async () => {
              setOpen(false);
              if (await act({ type: 'pokemon.equip', id: p.id })) toast('Partner equipped.');
            }}
          >
            <Icon name="Heart" size={16} />
            Equip partner
          </button>
          <a role="menuitem" href={'#/pokemon/' + p.id}>
            <Icon name="Info" size={16} />
            View summary
          </a>
        </div>
      )}
      {(panel === 'items' || panel === 'manuals') && (
        <Modal
          title={
            (panel === 'items' ? 'Use item · ' : 'Teach move · ') + pokemonById(p.speciesId).name
          }
          onClose={() => setPanel(null)}
        >
          <div className="pc-action-dialog">
            <PokemonBag pokemon={p} section={panel} />
          </div>
        </Modal>
      )}
      {(panel === 'learn' || panel === 'evolve') && (
        <PokemonProgressDialog id={p.id} kind={panel} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}
export function PokemonCard({ pokemon }: { pokemon: OwnedPokemon }) {
  const { state, now } = useApp(),
    fainted = getPokemonHealth(pokemon, now).current === 0,
    species = pokemonById(pokemon.speciesId),
    equipped = state.profile.equippedId === pokemon.id,
    offer = pendingMove(pokemon),
    evolution = getEvolutionStatus(state, pokemon),
    canLearn = !!offer && !pokemon.locked,
    needsAttention = evolution.canEvolve || canLearn;
  return (
    <div className={'pc-slot-wrapper' + (fainted ? ' is-fainted' : '')}>
      <div className="pc-card-actions">
        <FavouriteButton pokemon={pokemon} />
        <PokemonActions pokemon={pokemon} />
      </div>
      <a
        href={'#/pokemon/' + pokemon.id}
        className={
          'pokemon-card pc-slot ' +
          (equipped ? 'equipped ' : '') +
          (pokemon.shiny ? 'variant-glow ' : '') +
          (needsAttention ? 'pc-attention ' : '') +
          (evolution.canEvolve ? 'pc-evolution-ready ' : '') +
          (canLearn ? 'pc-move-ready ' : '') +
          (fainted ? 'pc-fainted' : '')
        }
        style={{ '--pokemon-color': TYPE_COLORS[species.types[0]] } as CSSProperties}
        data-variant={pokemon.shiny ? 'shiny' : 'original'}
        data-attention={needsAttention || undefined}
      >
        {needsAttention && (
          <span className="pc-ready-ribbon">
            {evolution.canEvolve ? <CandySprite /> : <Icon name="BookOpen" size={13} />}
            {evolution.canEvolve && canLearn
              ? 'Evolve + new move'
              : evolution.canEvolve
                ? 'Evolution ready'
                : 'New move ready'}
          </span>
        )}
        <div className="pokemon-card-image">
          <span className="pc-index">No. {String(species.id).padStart(3, '0')}</span>
          <span className="level-tag">Lv. {pokemon.level}</span>
          <PokemonArt id={species.id} shiny={pokemon.shiny} animated={!fainted} />
          {equipped && (
            <span className="pc-partner">
              <span aria-hidden="true">●</span> Partner
            </span>
          )}
        </div>
        <div className="pokemon-card-body">
          <div className="pc-name-line">
            <h3>{species.name}</h3>
            <SpeciesDistinction id={species.id} />
          </div>
          <div className="type-row">
            {species.types.map((t) => (
              <TypeChip key={t} type={t} />
            ))}
          </div>
          <HealthMeter pokemon={pokemon} compact />
          <div className="pc-alerts">
            {offer && (
              <span className={'pc-move-alert' + (!canLearn ? ' pc-alert-waiting' : '')}>
                <Icon name="BookOpen" size={13} />
                {canLearn ? 'New move' : 'Move waiting'}
              </span>
            )}
            {evolution.canEvolve && (
              <span className="pc-evolve-alert">
                <CandySprite />
                Can evolve
              </span>
            )}
            {pokemon.locked && <span>In battle</span>}
          </div>
          <div className="pokemon-card-value">
            {pokemon.gift ? (
              <span className="gift-badge">Gift · unsellable</span>
            ) : (
              <SolValue amount={pokemon.backing} />
            )}
            <small
              className="pc-strength"
              title="Combined HP, Attack, Defense, Special Attack, Special Defense and Speed"
            >
              {pokemonStrength(pokemon)} stats
            </small>
            {pokemon.starter && <small>Starter</small>}
          </div>
        </div>
      </a>
      <PokemonRecovery pokemon={pokemon} />
    </div>
  );
}
export function InventoryPage() {
  const { state, now } = useApp(),
    [filter, setFilter] = useState('All'),
    [sort, setSort] = useState('Strongest first'),
    [search, setSearch] = useState('');
  const list = sortPokemon(
    state.pokemon.filter(
      (p) =>
        (filter === 'All' ||
          (filter === 'Shiny' && !!p.shiny) ||
          (filter === 'Favourites' && !!p.favourite) ||
          (filter === 'Partner' && p.id === state.profile.equippedId) ||
          (filter === 'Battle ready' && !p.locked && getPokemonHealth(p, now).current > 0) ||
          (filter === 'Can evolve' && getEvolutionStatus(state, p).canEvolve) ||
          (filter === 'New move' && !!pendingMove(p) && !p.locked)) &&
        pokemonById(p.speciesId).name.toLowerCase().includes(search.toLowerCase()),
    ),
    sort,
    state,
  );
  return (
    <>
      <PageHeading title="My Pokémon">
        <div className="collection-total">
          <strong>{state.pokemon.length}</strong>
          <span>owned</span>
          <i />
          <SolValue amount={collectionValue(state)} />
        </div>
      </PageHeading>
      <div className="collection-toolbar">
        <div className="filter-pills">
          {['All', 'Favourites', 'Shiny', 'Battle ready', 'Partner', 'Can evolve', 'New move'].map(
            (f) => (
              <button
                key={f}
                className={filter === f ? 'active' : ''}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ),
          )}
        </div>
        <div className="toolbar-right">
          <div className="small-search">
            <Icon name="Search" size={16} />
            <input
              aria-label="Search your Pokémon"
              placeholder="Search Pokémon"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="sort-select"
            aria-label="Sort Pokémon"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {POKEMON_SORTS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <section className="pc-storage">
        <div className="pc-storage-bar">
          <strong>YOUR COLLECTION</strong>
          <span>
            {list.length} / {state.pokemon.length}
          </span>
        </div>
        {list.length ? (
          <div className="pokemon-grid pc-grid">
            {list.map((p) => (
              <PokemonCard pokemon={p} key={p.id} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="No Pokémon found"
            description={
              filter === 'Shiny'
                ? 'No shiny Pokémon match this search yet. Shiny variants can appear in eggs and packs.'
                : 'Change your filters or open a reward to add Pokémon.'
            }
          >
            <a className="button primary" href="#/rewards">
              View rewards
            </a>
          </EmptyState>
        )}
        <div className="pc-storage-footer">
          <span>Select a Pokémon to see its stats, moves, and evolution.</span>
          <a href="#/pokedex">OPEN POKÉDEX →</a>
        </div>
      </section>
    </>
  );
}
export function PokemonDetailPage({ id }: { id: string }) {
  const { state, mode, act, busy, toast, now } = useApp(),
    p = state.pokemon.find((p) => p.id === id),
    [dialog, setDialog] = useState<
      'learn' | 'evolve' | 'sell' | 'details' | 'items' | 'manuals' | null
    >(null);
  if (!p)
    return (
      <EmptyState
        title="Pokémon unavailable"
        description="It is no longer in your inventory. Its discovery remains in your Pokédex."
      >
        <a href="#/pokemon" className="button primary">
          ← Back to My Pokémon
        </a>
      </EmptyState>
    );
  const species = pokemonById(p.speciesId),
    origin = state.coins.find((c) => c.id === p.originCoin),
    equipped = state.profile.equippedId === id,
    offer = pendingMove(p),
    evoStatus = getEvolutionStatus(state, p),
    unavailable = !!p.locked,
    newMove = offer ? moveByName(offer.move) : null,
    stats = getPokemonStats(p);
  const statRows = [
    { name: 'Attack', value: stats.attack, color: '#e77966' },
    { name: 'Defense', value: stats.defense, color: '#e4b650' },
    { name: 'Sp. Attack', value: stats.specialAttack, color: '#6c94d4' },
    { name: 'Sp. Defense', value: stats.specialDefense, color: '#62ad92' },
    { name: 'Speed', value: stats.speed, color: '#c581ac' },
  ];
  const statScale = Math.max(...statRows.map((stat) => stat.value), stats.hp) * 1.12;
  const closeDialog = () => setDialog(null);
  const redeem = async () => {
    if (await act({ type: 'pokemon.redeem', id: p.id })) {
      toast(
        mode === 'demo'
          ? 'Pokémon sold in demo. No SOL was sent.'
          : 'Redemption requested. Payment is pending confirmation.',
      );
      closeDialog();
      navigate('/pokemon');
    }
  };
  return (
    <div className="pokemon-summary-page summary-v7 summary-v20 summary-v25">
      <div className="summary-toolbar">
        <a href="#/pokemon" className="pokemon-back-button">
          <Icon name="ArrowLeft" size={18} />
          Back to My PC
        </a>
        <div className="summary-quick-actions">
          <FavouriteButton pokemon={p} showLabel />
        </div>
      </div>
      <div className="summary-workspace">
        <section
          className={
            'summary-mon-screen ' +
            (p.shiny ? 'variant-glow ' : '') +
            (getPokemonHealth(p, now).current === 0 ? 'is-fainted' : '')
          }
          style={{ '--pokemon-color': TYPE_COLORS[species.types[0]] } as CSSProperties}
          aria-label={species.name + ' summary'}
        >
          <header className="summary-screen-heading">
            <h2>Pokémon</h2>
            <span>No. {String(species.id).padStart(3, '0')}</span>
          </header>
          <div className="summary-mon-body">
            <header className="summary-identity">
              <div>
                <h1>{species.name}</h1>
              </div>
              <div className="summary-identity-actions">
                <strong>Lv. {p.level}</strong>
                <button
                  className="move-info-button summary-details-button"
                  aria-label="Pokémon details"
                  title="Pokémon details"
                  onClick={() => setDialog('details')}
                >
                  <Icon name="Info" size={22} />
                </button>
              </div>
            </header>
            <div className="summary-pokemon-stage">
              <div className="summary-pokeball-watermark" aria-hidden="true" />
              <PokemonArt
                id={p.speciesId}
                shiny={p.shiny}
                eager
                animated={getPokemonHealth(p, now).current > 0}
              />
              <div className="summary-ground" />
            </div>
            <div className="summary-species-line">
              <div className="type-row">
                {species.types.map((type) => (
                  <TypeChip type={type} key={type} />
                ))}
              </div>
              {equipped && (
                <span className="summary-partner-mark">
                  <Icon name="Heart" size={13} />
                  Partner
                </span>
              )}
              <SpeciesDistinction id={species.id} />
            </div>
            <HealthMeter pokemon={p} />
            <PokemonRecovery pokemon={p} />
            <div className="summary-care-actions">
              <button onClick={() => setDialog('items')}>
                <ItemSprite item="potion" size={28} />
                Use item
              </button>
              <button onClick={() => setDialog('manuals')}>
                <Icon name="BookOpen" size={19} />
                Teach move
              </button>
            </div>
            {evoStatus.canEvolve && !unavailable && (
              <button
                className="summary-evolve-button"
                aria-label="Evolve Pokémon"
                disabled={busy}
                onClick={() => setDialog('evolve')}
              >
                <CandySprite />
                <span>
                  <small>Evolution ready</small>
                  <strong>Evolve Pokémon</strong>
                </span>
                <Icon name="ChevronRight" size={22} />
              </button>
            )}
            <div className="summary-value">
              <span>{p.gift ? 'Kanto gift' : 'Pokémon value'}</span>
              {p.gift ? (
                <span className="gift-badge">Cannot be sold</span>
              ) : (
                <SolValue amount={p.backing} />
              )}
            </div>
            <div className="summary-main-actions">
              <Button
                disabled={equipped || unavailable || busy}
                onClick={async () => {
                  if (await act({ type: 'pokemon.equip', id: p.id }))
                    toast(species.name + ' equipped.');
                }}
              >
                <Icon name="Heart" size={16} />
                {equipped ? 'Equipped' : 'Equip Pokémon'}
              </Button>
              <Button
                variant="secondary"
                disabled={!!p.gift || !!p.starter || !!p.locked || p.backing <= 0 || busy}
                onClick={() => setDialog('sell')}
              >
                Sell
              </Button>
            </div>
            {p.gift && (
              <p className="summary-starter-note">
                Train and evolve this Pokémon as usual. It remains a gift and cannot be sold or
                staked.
              </p>
            )}
            {p.starter && (
              <p className="summary-starter-note">
                Your starter can be sold after its first funded evolution.
                {mode === 'live' &&
                  (p.originCoin
                    ? ` Until then, it earns Rare Candy from holding $${origin?.ticker || 'its originating coin'}.`
                    : ' Hold an active coin to begin earning funded Rare Candy.')}
              </p>
            )}
          </div>
        </section>
        <div className="summary-command-panel">
          {offer && newMove && (
            <button
              className="pending-move-prompt"
              aria-label={species.name + ' can learn ' + offer.move + '. Review move'}
              disabled={unavailable || busy}
              onClick={() => {
                setDialog('learn');
              }}
            >
              <span className="move-prompt-copy">
                <small>{species.name} wants to learn</small>
                <strong>
                  {offer.move}
                  <span className="move-prompt-type">
                    <TypeChip type={newMove.type} />
                  </span>
                </strong>
              </span>
              <span className="move-prompt-review">
                <span className="game-command-cursor" aria-hidden="true" />
                Learn move
              </span>
            </button>
          )}
          <div className="summary-information summary-moves-panel">
            <PokemonMoveSet moves={p.moves} speciesId={p.speciesId} shiny={p.shiny} />
          </div>
        </div>
        <div className="summary-information summary-stats-panel">
          <section className="summary-stats" aria-label="Battle stats">
            <div className="summary-section-heading summary-screen-heading">
              <div>
                <h2>Battle stats</h2>
              </div>
              <span className="stat-level">Lv. {p.level}</span>
            </div>
            <div className="summary-stats-body">
              <div className="stat-rows">
                {statRows.map((stat) => (
                  <div className="stat-row" key={stat.name}>
                    <span>{stat.name}</span>
                    <strong>{stat.value}</strong>
                    <div>
                      <i
                        style={{
                          width: (stat.value / statScale) * 100 + '%',
                          background: stat.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="summary-candy-meter">
                <CandySprite />
                <span>Rare Candy</span>
                <strong>
                  {p.rareCandy.toLocaleString()}
                  {species.evolvesTo.length > 0 && (
                    <small> / {evoStatus.candyRequired.toLocaleString()}</small>
                  )}
                </strong>
                {species.evolvesTo.length > 0 && (
                  <Progress value={(p.rareCandy / evoStatus.candyRequired) * 100} color="#8191d8" />
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
      {dialog === 'details' && (
        <Modal
          title={species.name + ' · Details'}
          onClose={closeDialog}
          className="pokemon-record-modal"
        >
          <section className="summary-details" aria-label="Collection details">
            <dl>
              <div>
                <dt>Pokédex entry</dt>
                <dd>
                  No. {String(species.id).padStart(3, '0')} · {species.name}
                </dd>
              </div>
              <div>
                <dt>Joined your collection</dt>
                <dd>
                  {new Date(p.acquiredAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  {p.locked
                    ? 'In battle'
                    : p.gift
                      ? 'Gift Pokémon'
                      : p.starter
                        ? 'Starter Pokémon'
                        : 'In your inventory'}
                </dd>
              </div>
              <div>
                <dt>From</dt>
                <dd>
                  {origin ? (
                    <a href={'#/coin/' + origin.id} className="summary-origin">
                      <CoinAvatar coin={origin} size={24} />
                      <strong>${origin.ticker}</strong>
                      <Icon name="ArrowUpRight" size={14} />
                    </a>
                  ) : p.gift ? (
                    'Kanto gift'
                  ) : (
                    'Starter selection'
                  )}
                </dd>
              </div>
            </dl>
            <a
              href={'#/pokedex?species=' + species.id + (p.shiny ? '&variant=shiny' : '')}
              className="summary-record-link"
            >
              <Icon name="BookOpen" size={18} />
              Open Pokédex entry
              <Icon name="ArrowUpRight" size={15} />
            </a>
          </section>
        </Modal>
      )}
      {(dialog === 'items' || dialog === 'manuals') && (
        <Modal
          title={(dialog === 'items' ? 'Use item · ' : 'Teach move · ') + species.name}
          onClose={closeDialog}
        >
          <div className="pc-action-dialog">
            <PokemonBag pokemon={p} section={dialog} />
          </div>
        </Modal>
      )}
      {(dialog === 'learn' || dialog === 'evolve') && (
        <PokemonProgressDialog id={id} kind={dialog} onClose={closeDialog} />
      )}
      {dialog === 'sell' && (
        <Modal title={'Sell ' + species.name + '?'} onClose={closeDialog} closeDisabled={busy}>
          <div className="modal-body sell-modal">
            <PokemonArt id={p.speciesId} shiny={p.shiny} />
            <div className="sale-value">
              <span>{mode === 'demo' ? 'You receive' : 'Redemption amount'}</span>
              <SolValue amount={p.backing} />
            </div>
            <p>
              Selling redeems this Pokémon’s full value and removes it from your inventory. Its
              discovery stays in your Pokédex.
            </p>
            {mode === 'demo' ? (
              <div className="notice">This is a demo sale. No SOL is transferred.</div>
            ) : (
              <div className="notice">
                This Pokémon is locked while your payout is processed. SOL is paid only after the
                transaction confirms.
              </div>
            )}
            <div className="modal-actions">
              <Button variant="secondary" disabled={busy} onClick={closeDialog}>
                Keep Pokémon
              </Button>
              <Button variant="danger" disabled={busy} onClick={redeem}>
                {busy ? 'Selling…' : 'Sell for ' + sol(p.backing) + ' SOL'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
export function PokedexPage({ selectedId }: { selectedId?: number }) {
  const { state, mode } = useApp();
  const [shiny, setShiny] = useState(
    () =>
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.hash.split('?')[1]).get('variant') === 'shiny',
  );
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All types');
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Pokédex number');
  const [selected, setSelected] = useState<number | null>(selectedId || null);
  const history = variantDiscoveries(state),
    found = new Set(shiny ? history.shiny : history.normal);
  const catalogue =
    state.pokemonCatalogue ?? (mode === 'demo' ? demoPokemonCatalogue() : undefined);
  const values = new Map(
    catalogue?.entries.map((entry) => [
      entry.speciesId,
      shiny ? entry.shinyValue : entry.normalValue,
    ]) ?? [],
  );
  const variant = shiny ? 'Shiny' : 'Normal';
  const total = catalogue?.totals[shiny ? 'shiny' : 'normal'];
  const owned = state.pokemon.filter((p) => !!p.shiny === shiny);
  const ownedTotal =
    Number(owned.reduce((sum, p) => sum + BigInt(Math.round(p.backing * 1e9)), 0n)) / 1e9;
  const filtered = POKEMON.filter(
    (p) =>
      (p.name.toLowerCase().includes(search.toLowerCase()) || String(p.id) === search) &&
      (type === 'All types' || p.types.includes(type)) &&
      (filter === 'All' ||
        (filter === 'Discovered' && found.has(p.id)) ||
        (filter === 'Undiscovered' && !found.has(p.id))),
  ).sort((a, b) =>
    sort === 'Highest SOL value'
      ? (values.get(b.id) ?? -1) - (values.get(a.id) ?? -1) || a.id - b.id
      : sort === 'Lowest SOL value'
        ? (values.get(a.id) ?? Infinity) - (values.get(b.id) ?? Infinity) || a.id - b.id
        : a.id - b.id,
  );
  const selectedOwned = selected
    ? owned.filter((p) => p.speciesId === selected).sort(compareBattlePokemon)
    : [];
  const value = (id: number) =>
    values.has(id) ? (
      <SolValue amount={values.get(id)!} />
    ) : (
      <span className="dex-unpriced">Unavailable</span>
    );
  return (
    <div className={'pokedex-v14 ' + (shiny ? 'dex-shiny' : 'dex-normal')}>
      <PageHeading title="Pokédex">
        <span className="dex-permanent-record">
          <Icon name="BookOpen" size={16} /> Your permanent collection record
        </span>
      </PageHeading>
      <section className="dex-console" aria-label="Pokédex collection overview">
        <div className="dex-section-tabs" role="tablist" aria-label="Pokédex variants">
          {([false, true] as const).map((isShiny) => (
            <button
              key={String(isShiny)}
              role="tab"
              aria-selected={shiny === isShiny}
              aria-controls="dex-records"
              className={shiny === isShiny ? 'active' : ''}
              onClick={() => setShiny(isShiny)}
            >
              <span className={'dex-variant-ball ' + (isShiny ? 'shiny' : '')} aria-hidden="true" />
              <span>
                <strong>{isShiny ? 'Shiny' : 'Normal'}</strong>
                <small>{(isShiny ? history.shiny : history.normal).length} / 151 discovered</small>
              </span>
            </button>
          ))}
        </div>
        <div className="dex-section-summary">
          <div className="dex-catalogue-total">
            <span>Full {variant.toLowerCase()} catalogue</span>
            <strong>{total !== undefined ? <SolValue amount={total} /> : <span>—</span>}</strong>
            <small>Reference total · all 151 species</small>
          </div>
          <div className="dex-owned-total">
            <span>Currently in your PC</span>
            <strong>
              <SolValue amount={ownedTotal} />
            </strong>
            <small>{owned.length} Pokémon · actual redeemable values</small>
          </div>
          <div className="dex-record-progress">
            <strong>
              {found.size}
              <span> / 151</span>
            </strong>
            <Progress value={(found.size / 151) * 100} color={shiny ? '#89a7d7' : '#65a687'} />
            <small>{Math.round((found.size / 151) * 100)}% discovered</small>
          </div>
        </div>
        <p className="dex-value-note">
          Catalogue values describe reward reference values. Your owned Pokémon keep their
          individual redeemable amounts. Discoveries stay after a sale or transfer.
        </p>
        {!!history.unknown.length && (
          <p className="dex-legacy-note">
            {history.unknown.length} older species records are preserved; their original colour was
            not recorded.
          </p>
        )}
      </section>
      <div className="collection-toolbar dex-controls">
        <div className="filter-pills">
          {['All', 'Discovered', 'Undiscovered'].map((f) => (
            <button
              key={f}
              className={filter === f ? 'active' : ''}
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="toolbar-right">
          <div className="small-search">
            <Icon name="Search" size={16} />
            <input
              aria-label="Search the Pokédex"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or Pokédex number"
            />
          </div>
          <select
            className="sort-select"
            aria-label="Sort the Pokédex"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {['Pokédex number', 'Highest SOL value', 'Lowest SOL value'].map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <select
            className="sort-select"
            aria-label="Filter Pokémon type"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            {['All types', ...Object.keys(TYPE_COLORS)].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <section id="dex-records" role="tabpanel" aria-label={variant + ' Pokédex'}>
        <div className="dex-grid">
          {filtered.map((p) => (
            <button
              key={p.id}
              className={'dex-card ' + (!found.has(p.id) ? 'undiscovered' : 'discovered')}
              data-species={p.id}
              data-shiny={shiny}
              onClick={() => setSelected(p.id)}
            >
              <div className="row-between">
                <span className="dex-number">#{String(p.id).padStart(3, '0')}</span>
                {found.has(p.id) ? (
                  <Icon name="CheckCircle2" size={15} />
                ) : (
                  <Icon name="Lock" size={13} />
                )}
              </div>
              <PokemonArt id={p.id} shiny={shiny} animated={false} defer />
              <h3>{p.name}</h3>
              <div className="type-row">
                {p.types.map((t) => (
                  <TypeChip type={t} key={t} />
                ))}
              </div>
              <div className="dex-entry-value">
                {value(p.id)}
                <small>Catalogue value</small>
              </div>
              <span className="dex-discovery-label">
                {found.has(p.id)
                  ? 'Discovered'
                  : history.unknown.includes(p.id)
                    ? 'Earlier record · colour unknown'
                    : 'Still to discover'}
              </span>
            </button>
          ))}
        </div>
        {!filtered.length && (
          <EmptyState title="No Pokémon found" description="Try another name, number or type." />
        )}
      </section>
      {selected && (
        <Modal
          title={pokemonById(selected).name + ' #' + String(selected).padStart(3, '0')}
          onClose={() => setSelected(null)}
        >
          <div className="modal-body dex-modal">
            <PokemonArt id={selected} shiny={shiny} />
            <div className="type-row">
              {pokemonById(selected).types.map((t) => (
                <TypeChip key={t} type={t} />
              ))}
            </div>
            <div className="dex-modal-value">
              <span>{variant} catalogue value</span>
              {value(selected)}
            </div>
            <p>
              {found.has(selected)
                ? 'You have discovered this colour variant. Its record stays even after a sale or transfer.'
                : 'This colour variant has not yet been recorded in your collection.'}
            </p>
            {selectedOwned.length ? (
              <div className="dex-owned-copies">
                <strong>Your current Pokémon</strong>
                {selectedOwned.map((p) => (
                  <a key={p.id} href={'#/pokemon/' + p.id} onClick={() => setSelected(null)}>
                    <span>
                      Lv. {p.level}
                      {p.favourite ? ' · Favourite' : ''}
                    </span>
                    <SolValue amount={p.backing} />
                    <Icon name="ArrowRight" size={16} />
                  </a>
                ))}
                <small>These are the actual redeemable amounts for your owned instances.</small>
              </div>
            ) : (
              <Button
                onClick={() => {
                  navigate('/rewards');
                  setSelected(null);
                }}
              >
                View rewards <Icon name="ArrowRight" />
              </Button>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
