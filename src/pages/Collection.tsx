import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { POKEMON, pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
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
export function PokemonCard({ pokemon }: { pokemon: OwnedPokemon }) {
  const { state } = useApp(),
    species = pokemonById(pokemon.speciesId),
    equipped = state.profile.equippedId === pokemon.id,
    offer = pendingMove(pokemon),
    evolution = getEvolutionStatus(state, pokemon);
  return (
    <a
      href={'#/pokemon/' + pokemon.id}
      className={'pokemon-card pc-slot ' + (equipped ? 'equipped' : '')}
      style={{ '--pokemon-color': TYPE_COLORS[species.types[0]] } as CSSProperties}
    >
      <div className="pokemon-card-image">
        <span className="pc-index">No. {String(species.id).padStart(3, '0')}</span>
        <span className="level-tag">Lv.{pokemon.level}</span>
        <PokemonArt id={species.id} />
        {equipped && <span className="pc-partner">PARTNER</span>}
      </div>
      <div className="pokemon-card-body">
        <h3>{species.name}</h3>
        <div className="type-row">
          {species.types.map((t) => (
            <TypeChip key={t} type={t} />
          ))}
        </div>
        <div className="pc-alerts">
          {offer ? (
            <span className="pc-move-alert">NEW MOVE</span>
          ) : evolution.canEvolve ? (
            <span className="pc-evolve-alert">EVOLUTION READY</span>
          ) : pokemon.listed ? (
            <span>LISTED</span>
          ) : (
            <span>{pokemon.starter ? 'STARTER' : pokemon.rarity.toUpperCase()}</span>
          )}
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
    [sort, setSort] = useState('Newest'),
    [search, setSearch] = useState('');
  const list = state.pokemon
    .filter(
      (p) =>
        (filter === 'All' ||
          (filter === 'Partner' && p.id === state.profile.equippedId) ||
          (filter === 'Battle ready' && !p.listed && !p.locked) ||
          (filter === 'Listed' && !!p.listed) ||
          (filter === 'Can evolve' && getEvolutionStatus(state, p).canEvolve) ||
          (filter === 'New move' && !!pendingMove(p))) &&
        pokemonById(p.speciesId).name.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === 'Highest value'
        ? b.backing - a.backing
        : sort === 'Highest level'
          ? b.level - a.level
          : b.acquiredAt - a.acquiredAt,
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
          {['All', 'Battle ready', 'Partner', 'Can evolve', 'New move', 'Listed'].map((f) => (
            <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
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
            {['Newest', 'Highest value', 'Highest level'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <section className="pc-storage">
        <div className="pc-storage-bar">
          <span className="pc-screen-light" />
          <strong>POKÉMON STORAGE</strong>
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
            description="Change your filters or open a reward to add Pokémon."
          >
            <a className="button primary" href="#/rewards">
              View rewards
            </a>
          </EmptyState>
        )}
        <div className="pc-storage-footer">
          <span>Select a Pokémon to view its summary.</span>
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
  const { state, act, busy, toast } = useApp(),
    p = state.pokemon.find((p) => p.id === id),
    [dialog, setDialog] = useState<'learn' | 'evolve' | 'sell' | 'redeem' | null>(null),
    [replaceIndex, setReplaceIndex] = useState<number | null>(null),
    [declining, setDeclining] = useState(false),
    [price, setPrice] = useState(''),
    [evolution, setEvolution] = useState<EvolutionScene | null>(null),
    timer = useRef<ReturnType<typeof setTimeout>>(undefined);
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
    unavailable = !!p.listed || !!p.locked,
    newMove = offer ? moveByName(offer.move) : null;
  const closeDialog = () => {
    setDialog(null);
    setDeclining(false);
    setReplaceIndex(null);
  };
  const startEvolution = async () => {
    if (!evolution || busy) return;
    const before = { ...evolution, phase: 'evolving' as const };
    setEvolution(before);
    const result = await act({ type: 'pokemon.evolve', id: p.id }),
      changed = result?.pokemon.find((x) => x.id === p.id);
    if (!changed) {
      setEvolution({ ...before, phase: 'ready' });
      return;
    }
    const scene = { ...before, to: changed.speciesId, after: changed.backing };
    setEvolution(scene);
    timer.current = setTimeout(
      () => setEvolution({ ...scene, phase: 'complete' }),
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
  const sell = async () => {
    if (await act({ type: 'pokemon.list', id: p.id, amount: Number(price) })) {
      toast('Demo listing created.');
      closeDialog();
    }
  };
  const redeem = async () => {
    if (await act({ type: 'pokemon.redeem', id: p.id })) {
      toast('Demo Pokémon redeemed. No SOL was sent.');
      closeDialog();
      navigate('/pokemon');
    }
  };
  return (
    <div className="pokemon-summary-page">
      <a href="#/pokemon" className="pokemon-back-button">
        <Icon name="ArrowLeft" size={19} />
        Back to My Pokémon
      </a>
      <div className="summary-device">
        <div className="summary-device-top">
          <span className="summary-blue-lens" />
          <span className="summary-status-lights">
            <i />
            <i />
            <i />
          </span>
          <strong>POKÉMON SUMMARY</strong>
          <span>No.{String(species.id).padStart(3, '0')}</span>
        </div>
        <div className="summary-device-body">
          <section
            className="summary-mon-screen"
            style={{ '--pokemon-color': TYPE_COLORS[species.types[0]] } as CSSProperties}
          >
            <div className="summary-screen-label">
              <span>
                {equipped ? 'YOUR PARTNER' : p.starter ? 'STARTER' : p.rarity.toUpperCase()}
              </span>
              <strong>Lv.{p.level}</strong>
            </div>
            <div className="summary-pokemon-stage">
              <PokemonArt id={p.speciesId} eager />
              <div className="summary-ground" />
            </div>
            <h1>{species.name}</h1>
            <div className="type-row">
              {species.types.map((t) => (
                <TypeChip type={t} key={t} />
              ))}
            </div>
            <div className="summary-value">
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
                {equipped ? 'Equipped' : 'Equip Pokémon'}
              </Button>
              {p.listed ? (
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (await act({ type: 'pokemon.unlist', id: p.id })) toast('Listing removed.');
                  }}
                >
                  Unlist
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  disabled={!!p.starter || !!p.locked}
                  onClick={() => {
                    setPrice(String(Math.round(p.backing * 1.2 * 100) / 100));
                    setDialog('sell');
                  }}
                >
                  Sell
                </Button>
              )}
            </div>
            {origin && (
              <a href={'#/coin/' + origin.id} className="summary-origin">
                <CoinAvatar coin={origin} size={25} />
                <span>{'$' + origin.ticker}</span>
                <Icon name="ArrowUpRight" size={13} />
              </a>
            )}
          </section>
          <div className="summary-data">
            <section className="summary-candy">
              <div className="row-between">
                <h2>
                  <CandySprite />
                  Rare Candy
                </h2>
                <strong>
                  {p.rareCandy.toLocaleString()}
                  <small> / {EVOLUTION_CANDY.toLocaleString()}</small>
                </strong>
              </div>
              <Progress value={(p.rareCandy / EVOLUTION_CANDY) * 100} color="#6d9fc1" />
              <p>
                {species.evolvesTo.length
                  ? 'Earn Rare Candy while this Pokémon is equipped and you hold active coins.'
                  : 'Final evolution in the Kanto Pokédex.'}
              </p>
              {species.evolvesTo.length > 0 && (
                <>
                  <div className="evolution-funding-row">
                    <span>After evolution</span>
                    <SolValue amount={evoStatus.nextValue} />
                  </div>
                  {evoStatus.fundingNeeded > 0 ? (
                    <p className="evolution-funding-note">
                      {sol(evoStatus.fundingNeeded)} SOL will be allocated from the reward pool when
                      you evolve.
                    </p>
                  ) : (
                    <p className="evolution-funding-note">
                      The {sol(evoStatus.valueIncrease)} SOL increase is already funded.
                    </p>
                  )}
                  <Button
                    className="full-width"
                    disabled={!evoStatus.canEvolve || busy}
                    onClick={() => {
                      setEvolution({ from: p.speciesId, before: p.backing, phase: 'ready' });
                      setDialog('evolve');
                    }}
                  >
                    Evolve Pokémon
                  </Button>
                  {!evoStatus.canEvolve && (
                    <small className="evolution-unavailable">
                      {evoStatus.reason || 'Evolution is not ready.'}
                    </small>
                  )}
                </>
              )}
            </section>
            <section className="summary-moves">
              <div className="row-between">
                <h2>Moves</h2>
                <span>{p.moves.length}/4</span>
              </div>
              {p.moves.map((name, i) => {
                const move = moveByName(name);
                return (
                  <div className="summary-move-row" key={name}>
                    <span className="move-slot">{i + 1}</span>
                    <div>
                      <strong>{name}</strong>
                      <TypeChip type={move.type} />
                    </div>
                    <span>
                      {move.pp}
                      <small>PP</small>
                    </span>
                    <span>
                      {move.power ?? '—'}
                      <small>POWER</small>
                    </span>
                  </div>
                );
              })}
              {Array.from({ length: Math.max(0, 4 - p.moves.length) }, (_, i) => (
                <div className="summary-move-row empty" key={'empty' + i}>
                  <span className="move-slot">{p.moves.length + i + 1}</span>
                  <span>Empty move slot</span>
                </div>
              ))}
              {offer ? (
                <button
                  className="pending-move-prompt"
                  disabled={unavailable}
                  onClick={() => {
                    setReplaceIndex(null);
                    setDeclining(false);
                    setDialog('learn');
                  }}
                >
                  <span className="move-prompt-pointer">▶</span>
                  <span>
                    <strong>
                      {species.name} wants to learn {offer.move}!
                    </strong>
                    <small>Learned at Lv.{offer.level} · Choose what to do</small>
                  </span>
                  <Icon name="ArrowRight" size={18} />
                </button>
              ) : (
                <p className="moves-footnote">
                  New moves appear when a level-up opportunity is earned.
                </p>
              )}
            </section>
          </div>
        </div>
        <div className="summary-device-bottom">
          <span className="device-grip">
            <i />
            <i />
            <i />
          </span>
          <span>
            {p.starter
              ? 'Starter Pokémon cannot be sold until a funded evolution.'
              : p.listed
                ? 'Listed Pokémon cannot battle or evolve.'
                : 'Stored in your Pokémon inventory.'}
          </span>
        </div>
      </div>
      {species.evolvesTo.length > 0 && (
        <section className="evolution-line">
          <div>
            <h2>Evolution</h2>
            {species.id === 133 && (
              <p>Vaporeon, Jolteon, or Flareon. Each has an equal 1-in-3 chance.</p>
            )}
          </div>
          <div className="evolution-line-sprites">
            <div>
              <PokemonArt id={p.speciesId} />
              <strong>{species.name}</strong>
            </div>
            <span className="evolution-arrow">→</span>
            {species.evolvesTo.map((next) => (
              <div key={next}>
                <PokemonArt id={next} />
                <strong>{pokemonById(next).name}</strong>
                {species.evolvesTo.length > 1 && <small>33⅓%</small>}
              </div>
            ))}
          </div>
        </section>
      )}
      {dialog === 'learn' && offer && newMove && (
        <Modal
          title={declining ? 'Do not learn ' + offer.move + '?' : 'A new move!'}
          onClose={closeDialog}
        >
          <div className="move-decision-dialog">
            <div className="move-decision-title">
              <PokemonArt id={p.speciesId} />
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
                <PokemonArt id={evolution.from} />
              </div>
              {evolution.to && (
                <div className="evolution-new">
                  <PokemonArt id={evolution.to} />
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
                      Vaporeon · Jolteon · Flareon
                      <br />
                      <strong>Equal 1-in-3 chance. The result is random.</strong>
                    </p>
                  )}
                  <div className="evolution-value-change">
                    <SolValue amount={evolution.before} />
                    <span>→</span>
                    <SolValue amount={evoStatus.nextValue} />
                  </div>
                  <p className="evolution-reserve-copy">
                    The increase is funded by this Pokémon’s reward pool.
                  </p>
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
        <Modal title={'Sell ' + species.name} onClose={closeDialog}>
          <div className="modal-body sell-modal">
            <PokemonArt id={p.speciesId} />
            <div className="sale-value">
              <SolValue amount={p.backing} />
            </div>
            <label className="field-label" htmlFor="listing-price">
              Asking price / SOL
            </label>
            <input
              id="listing-price"
              className="text-input"
              type="number"
              min=".0001"
              step=".01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
            <p className="small muted">
              A buyer must accept your asking price. Listed Pokémon cannot be equipped or battled.
            </p>
            <Button
              className="full-width"
              disabled={busy || !Number(price) || Number(price) <= 0}
              onClick={sell}
            >
              Create demo listing
            </Button>
            <button className="text-link redeem-link" onClick={() => setDialog('redeem')}>
              Redeem for {sol(p.backing)} SOL →
            </button>
          </div>
        </Modal>
      )}
      {dialog === 'redeem' && (
        <Modal title={'Redeem ' + species.name + '?'} onClose={closeDialog}>
          <div className="modal-body">
            <p>Redemption removes this Pokémon from your inventory. Its Pokédex discovery stays.</p>
            <div className="notice">This is a frontend preview. No SOL is transferred.</div>
            <SolValue amount={p.backing} />
            <div className="modal-actions">
              <Button variant="secondary" onClick={closeDialog}>
                Keep Pokémon
              </Button>
              <Button variant="danger" disabled={busy} onClick={redeem}>
                Redeem in demo
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
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
                ? 'Discovered. This entry remains even after you trade this Pokémon.'
                : 'Undiscovered. Obtain this Pokémon from a reward or marketplace listing.'}
            </p>
            <Button
              onClick={() => {
                const owned = state.pokemon.find((p) => p.speciesId === selected);
                navigate(owned ? '/pokemon/' + owned.id : '/marketplace');
                setSelected(null);
              }}
            >
              {state.pokemon.some((p) => p.speciesId === selected)
                ? 'View in my inventory'
                : 'Explore the marketplace'}
              <Icon name="ArrowRight" />
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
function PokeballMini() {
  return <span className="pokeball-mark" />;
}
export function MarketplacePage() {
  const { state, act, busy, toast } = useApp(),
    [type, setType] = useState('All'),
    [sort, setSort] = useState('Featured'),
    [selected, setSelected] = useState<{ speciesId: number; ask: number; backing: number } | null>(
      null,
    ),
    [tab, setTab] = useState('Browse');
  const listings = [
    { speciesId: 6, ask: 0.48, backing: 0.3 },
    { speciesId: 94, ask: 0.36, backing: 0.22 },
    { speciesId: 131, ask: 0.34, backing: 0.2 },
    { speciesId: 143, ask: 0.32, backing: 0.18 },
    { speciesId: 149, ask: 0.44, backing: 0.28 },
    { speciesId: 25, ask: 0.18, backing: 0.1 },
    { speciesId: 133, ask: 0.16, backing: 0.09 },
    { speciesId: 150, ask: 0.95, backing: 0.6 },
  ];
  let results = listings.filter(
    (l) => type === 'All' || pokemonById(l.speciesId).types.includes(type),
  );
  results = [...results].sort((a, b) =>
    sort === 'Price: low to high'
      ? a.ask - b.ask
      : sort === 'Price: high to low'
        ? b.ask - a.ask
        : 0,
  );
  const own = state.pokemon.filter((p) => p.listed);
  return (
    <>
      <PageHeading title="Marketplace">
        <a href="#/pokemon" className="button primary">
          <Icon name="Plus" />
          List a Pokémon
        </a>
      </PageHeading>
      <div className="tab-bar marketplace-tabs">
        {['Browse', 'My listings'].map((t) => (
          <button className={tab === t ? 'active' : ''} onClick={() => setTab(t)} key={t}>
            {t}
            {t === 'My listings' && <span>{own.length}</span>}
          </button>
        ))}
      </div>
      {tab === 'Browse' ? (
        <>
          <div className="collection-toolbar">
            <div className="filter-pills">
              {['All', 'Fire', 'Water', 'Grass', 'Electric', 'Ghost', 'Psychic'].map((t) => (
                <button className={type === t ? 'active' : ''} onClick={() => setType(t)} key={t}>
                  {t}
                </button>
              ))}
            </div>
            <select
              value={sort}
              className="sort-select"
              aria-label="Sort listings"
              onChange={(e) => setSort(e.target.value)}
            >
              {['Featured', 'Price: low to high', 'Price: high to low'].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="pokemon-grid market-grid">
            {results.map((l) => {
              const p = pokemonById(l.speciesId);
              return (
                <button
                  className="pokemon-card market-card"
                  onClick={() => setSelected(l)}
                  key={p.id}
                  style={{ '--pokemon-color': TYPE_COLORS[p.types[0]] } as CSSProperties}
                >
                  <div className="pokemon-card-image">
                    <span className="card-status">Kanto collection</span>
                    <PokemonArt id={p.id} />
                    <span className="level-tag">Lv. {18 + (p.id % 24)}</span>
                  </div>
                  <div className="pokemon-card-body">
                    <h3>{p.name}</h3>
                    <div className="type-row">
                      {p.types.map((t) => (
                        <TypeChip key={t} type={t} />
                      ))}
                    </div>
                    <div className="market-price">
                      <span>Asking price</span>
                      <SolValue amount={l.ask} />
                    </div>
                    <div className="market-backing">
                      Redeem: {sol(l.backing)} SOL
                      <Icon name="ArrowUpRight" size={15} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : own.length ? (
        <div className="pokemon-grid">
          {own.map((p) => (
            <div key={p.id}>
              <PokemonCard pokemon={p} />
              <Button
                className="full-width"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  if (await act({ type: 'pokemon.unlist', id: p.id })) toast('Listing removed.');
                }}
              >
                Unlist · {sol(p.listed!)} SOL
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No Pokémon listed"
          description="Choose a tradeable Pokémon in your inventory to create a listing."
        >
          <a className="button primary" href="#/pokemon">
            My Pokémon
          </a>
        </EmptyState>
      )}
      {selected && (
        <Modal title={pokemonById(selected.speciesId).name} onClose={() => setSelected(null)}>
          <div className="modal-body market-purchase">
            <PokemonArt id={selected.speciesId} />
            <div className="row-between">
              <span>Asking price</span>
              <SolValue amount={selected.ask} />
            </div>
            <div className="row-between">
              <span>Redeem for</span>
              <strong>{sol(selected.backing)} SOL</strong>
            </div>
            <div className="notice">
              <Icon name="Info" />
              This is a sample marketplace listing. Purchasing and ownership transfer will be
              connected to the backend.
            </div>
            <Button
              className="full-width"
              onClick={() => {
                setSelected(null);
                toast('Purchase preview complete. No funds were used.');
              }}
            >
              Preview purchase
              <Icon name="ArrowRight" />
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
