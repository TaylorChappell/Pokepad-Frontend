import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { useRevealAudio } from '../audio/sound';
import { POKEMON, pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
import { getPokemonHealth, getPokemonStats } from '../data/stats';
import { collectionValue, EVOLUTION_CANDY, getEvolutionStatus, pendingMove } from '../state/model';
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
  const hp = getPokemonHealth(pokemon);
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
export function PokemonCard({ pokemon }: { pokemon: OwnedPokemon }) {
  const { state } = useApp(),
    species = pokemonById(pokemon.speciesId),
    equipped = state.profile.equippedId === pokemon.id,
    offer = pendingMove(pokemon),
    evolution = getEvolutionStatus(state, pokemon),
    canLearn = !!offer && !pokemon.locked,
    needsAttention = evolution.canEvolve || canLearn;
  return (
    <a
      href={'#/pokemon/' + pokemon.id}
      className={
        'pokemon-card pc-slot ' +
        (equipped ? 'equipped ' : '') +
        (pokemon.shiny ? 'variant-glow ' : '') +
        (needsAttention ? 'pc-attention ' : '') +
        (evolution.canEvolve ? 'pc-evolution-ready ' : '') +
        (canLearn ? 'pc-move-ready' : '')
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
        <PokemonArt id={species.id} shiny={pokemon.shiny} />
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
          <SolValue amount={pokemon.backing} />
          {pokemon.starter && <small>Starter</small>}
        </div>
      </div>
    </a>
  );
}
export function InventoryPage() {
  const { state } = useApp(),
    [filter, setFilter] = useState('All'),
    [sort, setSort] = useState('Ready first'),
    [search, setSearch] = useState('');
  const attention = new Map(
    state.pokemon.map((p) => [
      p.id,
      Number(getEvolutionStatus(state, p).canEvolve) + Number(!!pendingMove(p) && !p.locked),
    ]),
  );
  const list = state.pokemon
    .filter(
      (p) =>
        (filter === 'All' ||
          (filter === 'Shiny' && !!p.shiny) ||
          (filter === 'Partner' && p.id === state.profile.equippedId) ||
          (filter === 'Battle ready' && !p.locked && getPokemonHealth(p).current > 0) ||
          (filter === 'Can evolve' && getEvolutionStatus(state, p).canEvolve) ||
          (filter === 'New move' && !!pendingMove(p) && !p.locked)) &&
        pokemonById(p.speciesId).name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'Highest value'
        ? b.backing - a.backing
        : sort === 'Highest level'
          ? b.level - a.level
          : (sort === 'Ready first'
              ? (attention.get(b.id) || 0) - (attention.get(a.id) || 0)
              : 0) || b.acquiredAt - a.acquiredAt,
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
          {['All', 'Shiny', 'Battle ready', 'Partner', 'Can evolve', 'New move'].map((f) => (
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
            {['Ready first', 'Newest', 'Highest value', 'Highest level'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <section className="pc-storage">
        <div className="pc-storage-bar">
          <span className="pc-screen-light" />
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
type EvolutionScene = {
  from: number;
  to?: number;
  before: number;
  after?: number;
  phase: 'ready' | 'evolving' | 'complete';
};
export function PokemonDetailPage({ id }: { id: string }) {
  const { state, mode, act, busy, toast } = useApp(),
    p = state.pokemon.find((p) => p.id === id),
    [dialog, setDialog] = useState<'learn' | 'evolve' | 'sell' | null>(null),
    [section, setSection] = useState<'stats' | 'moves' | 'evolution' | 'details'>('stats'),
    [replaceIndex, setReplaceIndex] = useState<number | null>(null),
    [declining, setDeclining] = useState(false),
    [evolution, setEvolution] = useState<EvolutionScene | null>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const revealAudio = useRevealAudio();
  useEffect(() => () => clearTimeout(timer.current), []);
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
    stats = getPokemonStats(p),
    health = getPokemonHealth(p);
  const statRows = [
    { name: 'Attack', value: stats.attack, color: '#e77966' },
    { name: 'Defense', value: stats.defense, color: '#e4b650' },
    { name: 'Sp. Attack', value: stats.specialAttack, color: '#6c94d4' },
    { name: 'Sp. Defense', value: stats.specialDefense, color: '#62ad92' },
    { name: 'Speed', value: stats.speed, color: '#c581ac' },
  ];
  const statScale = Math.max(...statRows.map((stat) => stat.value), stats.hp) * 1.12;
  const closeDialog = () => {
    clearTimeout(timer.current);
    revealAudio.stop();
    setDialog(null);
    setDeclining(false);
    setReplaceIndex(null);
  };
  const startEvolution = async () => {
    if (!evolution || busy) return;
    revealAudio.unlock();
    const before = { ...evolution, phase: 'evolving' as const };
    setEvolution(before);
    const result = await act({ type: 'pokemon.evolve', id: p.id }),
      changed = result?.pokemon.find((x) => x.id === p.id);
    if (!changed) {
      revealAudio.stop();
      setEvolution({ ...before, phase: 'ready' });
      return;
    }
    const scene = { ...before, to: changed.speciesId, after: changed.backing };
    setEvolution(scene);
    revealAudio.play('evolve', 'opening');
    timer.current = setTimeout(
      () => {
        setEvolution({ ...scene, phase: 'complete' });
        revealAudio.play('evolve', 'revealed');
      },
      state.profile.reducedMotion ? 150 : 4200,
    );
  };
  const learn = async () => {
    if (!offer) return;
    const result = await act({
      type: 'pokemon.learn',
      id: p.id,
      offerId: offer.id,
      ...(p.moves.length >= 4 ? { replaceIndex: replaceIndex ?? 0 } : {}),
    });
    if (result) {
      toast(species.name + ' learned ' + offer.move + '.');
      closeDialog();
    }
  };
  const decline = async () => {
    if (offer && (await act({ type: 'pokemon.declineMove', id: p.id, offerId: offer.id }))) {
      toast(species.name + ' did not learn ' + offer.move + '.');
      closeDialog();
    }
  };
  const redeem = async () => {
    if (await act({ type: 'pokemon.redeem', id: p.id })) {
      toast(
        mode === 'demo'
          ? 'Pokémon sold in demo. No SOL was sent.'
          : species.name + ' sold for ' + sol(p.backing) + ' SOL.',
      );
      closeDialog();
      navigate('/pokemon');
    }
  };
  return (
    <div className="pokemon-summary-page summary-v7">
      <div className="summary-toolbar">
        <a href="#/pokemon" className="pokemon-back-button">
          <Icon name="ArrowLeft" size={18} />
          Back to My PC
        </a>
        <span
          className={
            'summary-battle-status ' + (unavailable || health.current === 0 ? 'unavailable' : '')
          }
        >
          <span />
          {p.locked ? 'In battle' : health.current === 0 ? 'Needs healing' : 'Ready for battle'}
        </span>
      </div>
      <div className="summary-workspace">
        <section
          className={'summary-mon-screen ' + (p.shiny ? 'variant-glow' : '')}
          style={{ '--pokemon-color': TYPE_COLORS[species.types[0]] } as CSSProperties}
          aria-label={species.name + ' summary'}
        >
          <header className="summary-identity">
            <div>
              <span>No. {String(species.id).padStart(3, '0')}</span>
              <h1>{species.name}</h1>
            </div>
            <strong>Lv. {p.level}</strong>
          </header>
          <div className="summary-pokemon-stage">
            <div className="summary-pokeball-watermark" aria-hidden="true" />
            <PokemonArt id={p.speciesId} shiny={p.shiny} eager />
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
          <div className="summary-value">
            <span>Pokémon value</span>
            <SolValue amount={p.backing} />
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
              disabled={!!p.starter || !!p.locked || busy}
              onClick={() => setDialog('sell')}
            >
              Sell
            </Button>
          </div>
          {p.starter && (
            <p className="summary-starter-note">
              Your starter can be sold after its first funded evolution.
            </p>
          )}
        </section>
        <div className="summary-command-panel">
          <nav className="summary-menu" aria-label="Pokémon information">
            {(
              [
                { id: 'stats', label: 'Stats', icon: 'Activity' },
                { id: 'moves', label: 'Moves', icon: 'Swords' },
                { id: 'evolution', label: 'Evolution', icon: 'Sparkles' },
                { id: 'details', label: 'Details', icon: 'Info' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                aria-pressed={section === item.id}
                aria-controls={'summary-panel-' + id}
                onClick={() => setSection(item.id)}
              >
                {item.id === 'evolution' ? <CandySprite /> : <Icon name={item.icon} size={17} />}
                <span>{item.label}</span>
                {item.id === 'moves' && offer && (
                  <i className="summary-menu-dot" aria-label="New move available" />
                )}
                {item.id === 'evolution' && evoStatus.canEvolve && (
                  <i className="summary-menu-dot" aria-label="Evolution ready" />
                )}
              </button>
            ))}
          </nav>
          {offer && newMove && (
            <button
              className="pending-move-prompt"
              aria-label={species.name + ' can learn ' + offer.move + '. Review move'}
              disabled={unavailable || busy}
              onClick={() => {
                setReplaceIndex(null);
                setDeclining(false);
                setDialog('learn');
              }}
            >
              <span className="move-prompt-symbol">
                <Icon name="BookOpen" size={21} />
              </span>
              <span className="move-prompt-copy">
                <small>Move ready at Lv. {offer.level}</small>
                <strong>{offer.move}</strong>
              </span>
              <TypeChip type={newMove.type} />
              <span className="move-prompt-review">
                Review <Icon name="ChevronRight" size={15} />
              </span>
            </button>
          )}
          <div className="summary-information" id={'summary-panel-' + id}>
            {section === 'stats' && (
              <section className="summary-stats" aria-label="Battle stats">
                <div className="summary-section-heading">
                  <div>
                    <h2>Battle stats</h2>
                    <p>A closer look at your Pokémon’s strengths.</p>
                  </div>
                  <span className="stat-level">Lv. {p.level}</span>
                </div>
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
                <div className="summary-training-strip">
                  <CandySprite />
                  <span>
                    <strong>{p.rareCandy.toLocaleString()} Rare Candy</strong>
                    <small>
                      {equipped ? 'Your equipped partner' : 'Equip this Pokémon to collect Candy'}
                    </small>
                  </span>
                  <button
                    onClick={() => setSection('evolution')}
                    aria-label="View evolution progress"
                  >
                    <Icon name="ArrowRight" size={18} />
                  </button>
                </div>
                <p className="stat-note">Stats reflect this Pokémon’s species and current level.</p>
              </section>
            )}
            {section === 'moves' && (
              <section className="summary-moves" aria-label="Moves">
                <div className="row-between">
                  <h2>Move set</h2>
                  <span className="move-count">{p.moves.length} / 4 moves</span>
                </div>
                <div className="summary-move-grid">
                  {p.moves.map((name, index) => {
                    const move = moveByName(name);
                    return (
                      <details
                        className="summary-move-card"
                        key={name}
                        style={{ '--move-color': TYPE_COLORS[move.type] } as CSSProperties}
                      >
                        <summary>
                          <div className="move-card-identity">
                            <span className="move-slot">{index + 1}</span>
                            <strong>{name}</strong>
                            <Icon name="ChevronDown" size={16} />
                          </div>
                          <TypeChip type={move.type} />
                          <dl>
                            <div>
                              <dt>POWER</dt>
                              <dd>{move.power ?? '—'}</dd>
                            </div>
                            <div>
                              <dt>ACCURACY</dt>
                              <dd>{move.accuracy === null ? '—' : move.accuracy + '%'}</dd>
                            </div>
                            <div>
                              <dt>PP</dt>
                              <dd>{move.pp}</dd>
                            </div>
                          </dl>
                        </summary>
                        <p>{move.description}</p>
                      </details>
                    );
                  })}
                  {Array.from({ length: Math.max(0, 4 - p.moves.length) }, (_, index) => (
                    <div className="summary-move-card empty" key={'empty' + index}>
                      <span className="move-slot">{p.moves.length + index + 1}</span>
                      <strong>Open move slot</strong>
                      <p>For the next move you learn.</p>
                    </div>
                  ))}
                </div>
                <p className="moves-footnote">
                  Select a move for its effect. New moves appear when a level-up opportunity is
                  earned.
                </p>
              </section>
            )}
            {section === 'evolution' && (
              <section className="summary-candy" aria-label="Evolution">
                <div className="row-between">
                  <h2>
                    <CandySprite />
                    Evolution
                  </h2>
                  <strong>
                    {p.rareCandy.toLocaleString()}
                    <small>
                      {species.evolvesTo.length
                        ? ' / ' + EVOLUTION_CANDY.toLocaleString()
                        : ' Candy'}
                    </small>
                  </strong>
                </div>
                {species.evolvesTo.length ? (
                  <>
                    <Progress value={(p.rareCandy / EVOLUTION_CANDY) * 100} color="#7f8ddb" />
                    <div className="evolution-line-sprites">
                      <div>
                        <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
                        <strong>{species.name}</strong>
                        <small>Current</small>
                      </div>
                      <span className="evolution-arrow">
                        <Icon name="ArrowRight" size={18} />
                      </span>
                      {species.evolvesTo.map((next) => (
                        <div key={next} className="evolution-mystery">
                          <span
                            className="evolution-mystery-art"
                            role="img"
                            aria-label="Unknown evolution"
                          >
                            <span aria-hidden="true">
                              <PokemonArt id={next} animated={false} />
                            </span>
                          </span>
                          <strong aria-label="Unknown Pokémon">???</strong>
                          {species.evolvesTo.length > 1 && <small>33⅓%</small>}
                        </div>
                      ))}
                    </div>
                    {species.id === 133 && (
                      <p className="summary-evolution-odds">
                        Each evolution has an equal 1-in-3 chance.
                      </p>
                    )}
                    <div className="evolution-funding-row">
                      <span>After evolution</span>
                      <SolValue amount={evoStatus.nextValue} />
                    </div>
                    <Button
                      className="full-width evolve-action"
                      disabled={!evoStatus.canEvolve || busy}
                      onClick={() => {
                        setEvolution({ from: p.speciesId, before: p.backing, phase: 'ready' });
                        setDialog('evolve');
                      }}
                    >
                      <CandySprite />
                      Evolve Pokémon
                    </Button>
                    {!evoStatus.canEvolve && (
                      <small className="evolution-unavailable">
                        {evoStatus.reason || 'Evolution is not ready.'}
                      </small>
                    )}
                  </>
                ) : (
                  <div className="summary-final-evolution">
                    <PokemonArt id={p.speciesId} shiny={p.shiny} animated={false} />
                    <h3>Fully evolved</h3>
                    <p>
                      This Pokémon has no further Kanto evolution. Your equipped partner can keep
                      collecting Rare Candy from active coins.
                    </p>
                  </div>
                )}
              </section>
            )}
            {section === 'details' && (
              <section className="summary-details" aria-label="Collection details">
                <h2>Collection record</h2>
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
                      {p.locked ? 'In battle' : p.starter ? 'Starter Pokémon' : 'In your inventory'}
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
                      ) : (
                        'Starter selection'
                      )}
                    </dd>
                  </div>
                </dl>
                <a href={'#/pokedex?species=' + species.id} className="summary-record-link">
                  <Icon name="BookOpen" size={18} />
                  Open Pokédex entry
                  <Icon name="ArrowUpRight" size={15} />
                </a>
                <p>Your Pokédex remembers this species even after you sell this Pokémon.</p>
              </section>
            )}
          </div>
        </div>
      </div>
      {dialog === 'learn' && offer && newMove && (
        <Modal
          title={declining ? 'Do not learn ' + offer.move + '?' : 'A new move!'}
          onClose={closeDialog}
        >
          <div className="move-decision-dialog">
            <div className="move-decision-title">
              <PokemonArt id={p.speciesId} shiny={p.shiny} />
              <p>
                <strong>{species.name}</strong> wants to learn <strong>{offer.move}</strong>.
              </p>
            </div>
            {declining ? (
              <>
                <p className="move-final-warning">
                  This opportunity will be declined permanently. {species.name} will not be offered
                  this move again.
                </p>
                <div className="modal-actions">
                  <Button variant="secondary" disabled={busy} onClick={() => setDeclining(false)}>
                    Go back
                  </Button>
                  <Button variant="danger" disabled={busy} onClick={decline}>
                    Do not learn
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="new-move-record">
                  <div>
                    <h3>{offer.move}</h3>
                    <TypeChip type={newMove.type} />
                  </div>
                  <p>{newMove.description}</p>
                  <dl>
                    <div>
                      <dt>POWER</dt>
                      <dd>{newMove.power ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>ACCURACY</dt>
                      <dd>{newMove.accuracy === null ? '—' : newMove.accuracy + '%'}</dd>
                    </div>
                    <div>
                      <dt>PP</dt>
                      <dd>{newMove.pp}</dd>
                    </div>
                  </dl>
                </div>
                {p.moves.length >= 4 ? (
                  <>
                    <p className="move-forget-label">
                      A Pokémon can only know four moves. Which should it forget?
                    </p>
                    <div className="move-forget-options">
                      {p.moves.map((move, index) => (
                        <button
                          key={move}
                          className={replaceIndex === index ? 'selected' : ''}
                          onClick={() => setReplaceIndex(index)}
                        >
                          <span>{index + 1}</span>
                          <strong>{move}</strong>
                          <span>{replaceIndex === index ? '◀' : ''}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="move-forget-label">
                    An empty move slot is available. No move needs to be forgotten.
                  </p>
                )}
                <div className="modal-actions">
                  <Button variant="secondary" disabled={busy} onClick={() => setDeclining(true)}>
                    Do not learn
                  </Button>
                  <Button
                    disabled={busy || (p.moves.length >= 4 && replaceIndex === null)}
                    onClick={learn}
                  >
                    Learn {offer.move}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
      {dialog === 'evolve' && evolution && (
        <Modal
          title={
            evolution.phase === 'complete'
              ? 'Evolution complete'
              : evolution.phase === 'evolving'
                ? pokemonById(evolution.from).name + ' is evolving!'
                : 'Evolve ' + pokemonById(evolution.from).name + '?'
          }
          onClose={closeDialog}
          wide
          closeDisabled={evolution.phase === 'evolving'}
        >
          <div className={'evolution-sequence ' + evolution.phase}>
            <div className="evolution-stage">
              <div className="evolution-pixel-grid" />
              <div className="evolution-rays" />
              <div className="evolution-ring one" />
              <div className="evolution-ring two" />
              <div className="evolution-orbit-stars" aria-hidden="true">
                {Array.from({ length: 20 }, (_, i) => (
                  <i
                    key={i}
                    style={{ '--star-i': i, '--star-delay': i * -0.19 + 's' } as CSSProperties}
                  />
                ))}
              </div>
              <div className="evolution-old">
                <PokemonArt id={evolution.from} shiny={p.shiny} animated={false} />
              </div>
              {evolution.to && (
                <div className="evolution-new">
                  <PokemonArt id={evolution.to} shiny={p.shiny} animated={false} />
                </div>
              )}
              <div className="evolution-flash" />
            </div>
            <div className="evolution-dialogue" aria-live="polite">
              {evolution.phase === 'ready' ? (
                <>
                  <p>
                    Use <strong>{EVOLUTION_CANDY.toLocaleString()} Rare Candy</strong> to evolve{' '}
                    {pokemonById(evolution.from).name}.
                  </p>
                  {evolution.from === 133 && (
                    <p>
                      <strong>Three possible evolutions, each with an equal 1-in-3 chance.</strong>
                    </p>
                  )}
                  <div className="evolution-value-change">
                    <SolValue amount={evolution.before} />
                    <span>→</span>
                    <SolValue amount={evoStatus.nextValue} />
                  </div>
                  <Button disabled={busy || !evoStatus.canEvolve} onClick={startEvolution}>
                    Evolve
                  </Button>
                </>
              ) : evolution.phase === 'evolving' ? (
                <p>
                  What? <strong>{pokemonById(evolution.from).name}</strong> is evolving!
                </p>
              ) : (
                <>
                  <p>
                    Congratulations! Your <strong>{pokemonById(evolution.from).name}</strong>
                    <br />
                    evolved into <strong>{pokemonById(evolution.to!).name}</strong>!
                  </p>
                  <div className="evolution-value-change">
                    <SolValue amount={evolution.before} />
                    <span>→</span>
                    <SolValue amount={evolution.after!} />
                  </div>
                  <Button onClick={closeDialog}>Continue</Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
      {dialog === 'sell' && (
        <Modal title={'Sell ' + species.name + '?'} onClose={closeDialog} closeDisabled={busy}>
          <div className="modal-body sell-modal">
            <PokemonArt id={p.speciesId} shiny={p.shiny} />
            <div className="sale-value">
              <span>You receive</span>
              <SolValue amount={p.backing} />
            </div>
            <p>
              Selling redeems this Pokémon’s full value and removes it from your inventory. Its
              discovery stays in your Pokédex.
            </p>
            {mode === 'demo' && (
              <div className="notice">This is a demo sale. No SOL is transferred.</div>
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
function PokeballMini() {
  return <span className="pokeball-mark" />;
}
export function PokedexPage({ selectedId }: { selectedId?: number }) {
  const { state } = useApp(),
    [search, setSearch] = useState(''),
    [type, setType] = useState('All types'),
    [filter, setFilter] = useState('All'),
    [selected, setSelected] = useState<number | null>(selectedId || null);
  const found = new Set(state.discovered),
    filtered = POKEMON.filter(
      (p) =>
        (p.name.toLowerCase().includes(search.toLowerCase()) || String(p.id) === search) &&
        (type === 'All types' || p.types.includes(type)) &&
        (filter === 'All' ||
          (filter === 'Discovered' && found.has(p.id)) ||
          (filter === 'Undiscovered' && !found.has(p.id))),
    );
  return (
    <>
      <PageHeading title="Pokédex">
        <span className="pokedex-count">
          <Icon name="BookOpen" />
          <strong>
            {found.size} <small>/ 151</small>
          </strong>
          discovered
        </span>
      </PageHeading>
      <div className="panel dex-progress">
        <div>
          <PokeballMini />
          <span>
            <strong>Your Kanto collection</strong>
            <small>Species stay discovered after a sale or transfer.</small>
          </span>
        </div>
        <Progress value={(found.size / 151) * 100} color="#e9bf55" />
        <span>{Math.round((found.size / 151) * 100)}% complete</span>
      </div>
      <div className="collection-toolbar">
        <div className="filter-pills">
          {['All', 'Discovered', 'Undiscovered'].map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
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
              placeholder="Name or Pokédex number…"
            />
          </div>
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
      <div className="dex-grid">
        {filtered.map((p) => (
          <button
            key={p.id}
            className={'dex-card ' + (!found.has(p.id) ? 'undiscovered' : '')}
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
            <PokemonArt id={p.id} />
            <h3>{p.name}</h3>
            <div className="type-row">
              {p.types.map((t) => (
                <TypeChip type={t} key={t} />
              ))}
            </div>
            <small>{found.has(p.id) ? 'Discovered' : 'Still to discover'}</small>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <EmptyState title="No Pokémon found" description="Try another name, number or type." />
      )}
      {selected && (
        <Modal
          title={pokemonById(selected).name + ' #' + String(selected).padStart(3, '0')}
          onClose={() => setSelected(null)}
        >
          <div className="modal-body dex-modal">
            <PokemonArt id={selected} />
            <div className="type-row">
              {pokemonById(selected).types.map((t) => (
                <TypeChip type={t} key={t} />
              ))}
            </div>
            <p>
              {found.has(selected)
                ? 'Discovered. This entry remains even after you sell this Pokémon.'
                : 'Undiscovered. Hatch an egg or open a pack for a chance to meet this Pokémon.'}
            </p>
            <Button
              onClick={() => {
                const owned = state.pokemon.find((p) => p.speciesId === selected);
                navigate(owned ? '/pokemon/' + owned.id : '/rewards');
                setSelected(null);
              }}
            >
              {state.pokemon.some((p) => p.speciesId === selected)
                ? 'View in my inventory'
                : 'View rewards'}
              <Icon name="ArrowRight" />
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
