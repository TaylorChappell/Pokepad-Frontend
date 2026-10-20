import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import {
  Avatar,
  Button,
  Icon,
  Modal,
  PageHeading,
  PokemonArt,
  Pokeball,
  TypeChip,
} from '../components/UI';
import { profileName } from '../state/model';
import { TYPE_COLORS } from '../utils';
import {
  DIFFICULTIES,
  battleMove,
  createBattle,
  createPlayerTeam,
  createSeededRandom,
  effectiveSpeed,
  generateRivalTeam,
  getMoveHint,
  moveCategory,
  resolveTurn,
  teamStrength,
  type BattleAction,
  type BattleState,
  type Difficulty,
  type Fighter,
} from '../battle/engine';

const difficultyNames = Object.keys(DIFFICULTIES) as Difficulty[];
const trainerCharacters = { Easy: 'leaf', Medium: 'brock', Hard: 'blue', Master: 'red' } as const;
const statusLabels = {
  burn: 'BRN',
  poison: 'PSN',
  paralysis: 'PAR',
  sleep: 'SLP',
  freeze: 'FRZ',
  none: '',
};

function Health({ fighter }: { fighter: Fighter }) {
  const percent = Math.max(0, (fighter.hp / fighter.stats.hp) * 100);
  return (
    <div className="duel-health">
      <div>
        <strong>{pokemonById(fighter.speciesId).name}</strong>
        <span>Lv. {fighter.level}</span>
      </div>
      <div className="duel-health-line">
        <b>HP</b>
        <span className="duel-health-track">
          <i
            style={{
              width: percent + '%',
              background: percent > 50 ? '#65b48b' : percent > 20 ? '#e7b74d' : '#df6b61',
            }}
          />
        </span>
      </div>
      <div className="duel-health-foot">
        <small>
          {fighter.hp} / {fighter.stats.hp}
        </small>
        {fighter.status !== 'none' && (
          <b className={'battle-condition condition-' + fighter.status}>
            {statusLabels[fighter.status]}
          </b>
        )}
      </div>
    </div>
  );
}
function DifficultyPicker({
  value,
  onChange,
}: {
  value: Difficulty;
  onChange: (value: Difficulty) => void;
}) {
  return (
    <div className="difficulty-picker" aria-label="Bot difficulty">
      {difficultyNames.map((name, index) => (
        <button
          key={name}
          aria-pressed={value === name}
          onClick={() => onChange(name)}
          className={value === name ? 'selected' : ''}
        >
          <span className="difficulty-pips" aria-hidden="true">
            {[0, 1, 2, 3].map((pip) => (
              <i key={pip} className={pip <= index ? 'lit' : ''} />
            ))}
          </span>
          <strong>{name}</strong>
          <small>{['Warm up', 'Matched', 'Challenge', 'Elite'][index]}</small>
        </button>
      ))}
    </div>
  );
}

export function BattlesPage() {
  const { state } = useApp();
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [phase, setPhase] = useState<'lobby' | 'team' | 'battle'>('lobby');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [matchSeed, setMatchSeed] = useState(() => Date.now());
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [streak, setStreak] = useState(0);
  const [effect, setEffect] = useState('');
  const [onlineFormat, setOnlineFormat] = useState('Friendly');
  const [stake, setStake] = useState('0.1');
  const [coin, setCoin] = useState('poke');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const available = state.pokemon.filter((pokemon) => !pokemon.listed && !pokemon.locked);
  const chosen = useMemo(
    () =>
      selectedIds
        .map((id) => state.pokemon.find((pokemon) => pokemon.id === id))
        .filter((pokemon) => !!pokemon),
    [selectedIds, state.pokemon],
  );
  const rivals = useMemo(
    () => generateRivalTeam(chosen, difficulty, createSeededRandom(matchSeed)),
    [chosen, difficulty, matchSeed],
  );
  const ownPreview = useMemo(() => createPlayerTeam(chosen), [chosen]);
  const relativeStrength = ownPreview.length
    ? Math.round((teamStrength(rivals) / teamStrength(ownPreview)) * 100)
    : Math.round(DIFFICULTIES[difficulty].ratio * 100);
  const start = (fresh = false) => {
    if (!chosen.length) return;
    const nextRivals = fresh ? generateRivalTeam(chosen, difficulty) : rivals;
    setBattle(createBattle(chosen, nextRivals, difficulty));
    setPhase('battle');
    setBusy(false);
    setEffect('');
    setShowSwitch(false);
  };
  const play = (action: BattleAction) => {
    if (!battle || busy || battle.winner) return;
    const next = resolveTurn(battle, action);
    if (next === battle) return;
    setShowSwitch(false);
    setBusy(true);
    const openingSide = next.events.find(
      (event) => event.kind === 'move' || event.kind === 'switch',
    )?.side;
    setEffect(openingSide || 'player');
    setBattle(next);
    if (next.winner) setStreak((value) => (next.winner === 'player' ? value + 1 : 0));
    timer.current = setTimeout(
      () => {
        setBusy(false);
        setEffect('');
      },
      state.profile.reducedMotion ? 220 : 740,
    );
  };
  const leave = () => {
    clearTimeout(timer.current);
    setBusy(false);
    setBattle(null);
    setPhase('lobby');
  };

  if (phase === 'battle' && battle) {
    const current = battle.player[battle.active.player];
    const opponent = battle.rival[battle.active.rival];
    const exhausted = current.pp.every((value) => value <= 0);
    const lockedMove = current.charging;
    return (
      <div className="battle-screen arena-v6">
        <div className="battle-page-heading duel-page-heading">
          <button className="button secondary" onClick={leave}>
            <Icon name="ArrowLeft" size={15} />
            Back to arena
          </button>
          <span className="practice-chip">Offline · {battle.difficulty}</span>
          <strong>Turn {Math.max(1, battle.turn - (battle.winner ? 1 : 0))}</strong>
        </div>
        {battle.winner && !busy ? (
          <section className="duel-result panel">
            <span className={'duel-result-seal ' + (battle.winner === 'player' ? 'won' : '')}>
              <Pokeball size={54} />
            </span>
            <p className="duel-eyebrow">{battle.difficulty} practice complete</p>
            <h1>
              {battle.winner === 'player'
                ? 'Victory!'
                : battle.winner === 'draw'
                  ? 'An even finish.'
                  : 'One more round?'}
            </h1>
            <p>
              {battle.winner === 'player'
                ? `You outplayed ${DIFFICULTIES[battle.difficulty].trainer}.`
                : battle.winner === 'draw'
                  ? 'Both teams gave it everything.'
                  : 'A new matchup is a fresh chance to change your strategy.'}
            </p>
            <div className="duel-result-team">
              {battle.player.map((fighter) => (
                <div key={fighter.id}>
                  <PokemonArt id={fighter.speciesId} shiny={fighter.shiny} />
                  <strong>{pokemonById(fighter.speciesId).name}</strong>
                  <small>{fighter.hp > 0 ? `${fighter.hp} HP remaining` : 'Fainted'}</small>
                </div>
              ))}
            </div>
            <div className="duel-result-facts">
              <span>
                <strong>{battle.turn - 1}</strong>turns
              </span>
              <span>
                <strong>{streak}</strong>session win streak
              </span>
              <span>
                <strong>
                  {battle.player.length} v {battle.rival.length}
                </strong>
                team size
              </span>
            </div>
            <p className="practice-safety">
              Practice only. Your Pokémon, HP, Rare Candy and balances are unchanged.
            </p>
            <div className="duel-result-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setPhase('team');
                  setBattle(null);
                  setMatchSeed((seed) => seed + 1);
                }}
              >
                Change your team
              </Button>
              <Button onClick={() => start(true)}>
                New opponent
                <Icon name="RefreshCw" size={16} />
              </Button>
            </div>
          </section>
        ) : (
          <>
            <div className="duel-trainers">
              <div>
                <Avatar profile={state.profile} size={42} />
                <span>
                  <strong>{profileName(state)}</strong>
                  <small>
                    {battle.player.map((fighter) => (
                      <Pokeball
                        key={fighter.id}
                        size={13}
                        className={fighter.hp <= 0 ? 'fainted' : ''}
                      />
                    ))}
                  </small>
                </span>
              </div>
              <span>VS</span>
              <div>
                <span>
                  <strong>{DIFFICULTIES[battle.difficulty].trainer}</strong>
                  <small>
                    {battle.rival.map((fighter) => (
                      <Pokeball
                        key={fighter.id}
                        size={13}
                        className={fighter.hp <= 0 ? 'fainted' : ''}
                      />
                    ))}
                  </small>
                </span>
                <Avatar
                  profile={{
                    character: trainerCharacters[battle.difficulty],
                    accessoryColor: '#65b883',
                  }}
                  size={42}
                />
              </div>
            </div>
            <div className={'battle-field duel-field ' + effect}>
              <div className="duel-field-lines" aria-hidden="true" />
              <div className="duel-fighter duel-player">
                <Health fighter={current} />
                <div className="duel-stage">
                  <span className="duel-stage-shadow" />
                  <PokemonArt id={current.speciesId} shiny={current.shiny} eager />
                </div>
                <div className="duel-type-row">
                  {pokemonById(current.speciesId).types.map((type) => (
                    <TypeChip key={type} type={type} />
                  ))}
                </div>
              </div>
              <div className="duel-center-mark" aria-hidden="true">
                <Pokeball size={74} />
              </div>
              <div className="duel-fighter duel-rival">
                <Health fighter={opponent} />
                <div className="duel-stage">
                  <span className="duel-stage-shadow" />
                  <PokemonArt id={opponent.speciesId} eager />
                </div>
                <div className="duel-type-row">
                  {pokemonById(opponent.speciesId).types.map((type) => (
                    <TypeChip key={type} type={type} />
                  ))}
                </div>
              </div>
              <div className="duel-matchup">
                {effectiveSpeed(current) === effectiveSpeed(opponent)
                  ? 'Speed tie'
                  : effectiveSpeed(current) > effectiveSpeed(opponent)
                    ? `${pokemonById(current.speciesId).name} is faster`
                    : `${pokemonById(opponent.speciesId).name} is faster`}
                <span>Priority moves can change the order.</span>
              </div>
            </div>
            <div className="duel-console">
              <div className="duel-command-heading">
                <div>
                  <h2>
                    {busy
                      ? 'Turn resolved'
                      : current.recharge
                        ? 'Time to recharge'
                        : lockedMove
                          ? `${lockedMove} is ready`
                          : `What will ${pokemonById(current.speciesId).name} do?`}
                  </h2>
                  <p>
                    {current.recharge
                      ? 'Recover this turn before moving or switching again.'
                      : lockedMove
                        ? `Finish ${lockedMove} before choosing another action.`
                        : current.trapped
                          ? 'Trapped: switching is unavailable until the vortex ends.'
                          : 'Pick a move or spend your turn switching Pokémon.'}
                  </p>
                </div>
                <button className="text-link" onClick={() => setShowRules(true)}>
                  <Icon name="Info" size={16} />
                  Battle guide
                </button>
              </div>
              <div className="battle-moves duel-moves">
                {(lockedMove
                  ? [lockedMove]
                  : current.recharge
                    ? [current.moves[0]]
                    : exhausted
                      ? ['Struggle']
                      : current.moves
                ).map((name) => {
                  const move = battleMove(name),
                    index = current.moves.indexOf(name),
                    realIndex = name === 'Struggle' ? -1 : index;
                  const disabled =
                    busy ||
                    !!battle.winner ||
                    (!current.recharge && !lockedMove && current.pp[index] <= 0 && !exhausted) ||
                    (!!lockedMove && name !== lockedMove);
                  return (
                    <button
                      key={name}
                      disabled={disabled}
                      onClick={() => play({ kind: 'move', index: realIndex })}
                      style={
                        { '--move-color': TYPE_COLORS[move.type] || '#718797' } as CSSProperties
                      }
                    >
                      <span className="duel-move-top">
                        <strong>{current.recharge ? 'Recharge' : name}</strong>
                        <small>{exhausted ? '—' : `${current.pp[index]}/${move.pp}`} PP</small>
                      </span>
                      <span className="duel-move-meta">
                        <TypeChip type={move.type} />
                        <small>
                          {moveCategory(move)}
                          {move.power ? ` · ${move.power} power` : ''}
                        </small>
                      </span>
                      <span className="duel-move-hint">
                        {current.recharge
                          ? 'Recover after Hyper Beam.'
                          : getMoveHint(current, opponent, name)}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="duel-bench">
                {battle.player.map((fighter, index) => (
                  <button
                    key={fighter.id}
                    disabled={
                      busy ||
                      !!battle.winner ||
                      fighter.hp <= 0 ||
                      index === battle.active.player ||
                      current.trapped > 0 ||
                      !!current.charging ||
                      current.recharge
                    }
                    onClick={() => setShowSwitch(true)}
                    aria-label={`Switch to ${pokemonById(fighter.speciesId).name}`}
                    className={index === battle.active.player ? 'active' : ''}
                  >
                    <PokemonArt id={fighter.speciesId} shiny={fighter.shiny} animated={false} />
                    <span>
                      <strong>{pokemonById(fighter.speciesId).name}</strong>
                      <small>
                        {fighter.hp}/{fighter.stats.hp} HP
                        {index === battle.active.player ? ' · Active' : ''}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <details className="duel-history" open>
              <summary>
                Battle log <span>{battle.events.length} events this turn</span>
              </summary>
              <div className="duel-current-events" aria-live="polite">
                {battle.events.map((event, index) => (
                  <p className={'event-' + event.kind} key={`${battle.turn}-${index}`}>
                    {event.text}
                  </p>
                ))}
              </div>
              {battle.history.length > battle.events.length && (
                <details>
                  <summary>Earlier turns</summary>
                  <div>
                    {battle.history.slice(0, -battle.events.length).map((event, index) => (
                      <p key={index}>{event.text}</p>
                    ))}
                  </div>
                </details>
              )}
            </details>
          </>
        )}
        {showSwitch && (
          <Modal title="Switch Pokémon" onClose={() => setShowSwitch(false)}>
            <div className="modal-body">
              <p>Switching uses this turn. Your opponent can attack the Pokémon you send in.</p>
              <div className="duel-switch-list">
                {battle.player.map((fighter, index) => (
                  <button
                    key={fighter.id}
                    disabled={
                      fighter.hp <= 0 ||
                      index === battle.active.player ||
                      current.trapped > 0 ||
                      !!current.charging ||
                      current.recharge
                    }
                    onClick={() => play({ kind: 'switch', index })}
                  >
                    <PokemonArt id={fighter.speciesId} shiny={fighter.shiny} animated={false} />
                    <span>
                      <strong>{pokemonById(fighter.speciesId).name}</strong>
                      <small>
                        {fighter.hp}/{fighter.stats.hp} HP
                      </small>
                    </span>
                    <Icon name="ArrowRight" />
                  </button>
                ))}
              </div>
            </div>
          </Modal>
        )}
        {showRules && (
          <Modal title="Win the matchup" onClose={() => setShowRules(false)}>
            <div className="modal-body duel-rules">
              <p>
                <strong>Plan around types.</strong> Your own type adds a 1.5× bonus. Dual types can
                multiply weaknesses and resistances.
              </p>
              <p>
                <strong>Control the turn.</strong> Faster Pokémon act first; Quick Attack has
                priority. Switching takes a turn and resets stat boosts.
              </p>
              <p>
                <strong>Set up a finish.</strong> Growl lowers Attack, Agility raises Speed, and
                status moves can force your opponent to lose momentum. Recover and Rest restore
                battle HP.
              </p>
              <p>
                <strong>Watch your resources.</strong> Moves have limited PP. Fly and Solar Beam
                take two turns; Hyper Beam needs a recharge. Struggle is available when all PP is
                spent.
              </p>
              <p className="muted">
                Practice uses a curated move set and Kanto type matchups with modern
                physical/special stat displays. It is not an exact original-game simulator.
              </p>
            </div>
          </Modal>
        )}
      </div>
    );
  }

  if (phase === 'team')
    return (
      <div className="battle-screen arena-v6">
        <button className="button secondary arena-back" onClick={() => setPhase('lobby')}>
          <Icon name="ArrowLeft" size={16} />
          Back to arena
        </button>
        <PageHeading
          title="Build your battle party"
          description="Choose a lead, then up to two partners. Your first selection goes out first."
        />
        <div className="duel-team-layout">
          <section>
            <div className="duel-party-slots">
              {[0, 1, 2].map((index) => (
                <div key={index} className={chosen[index] ? 'filled' : ''}>
                  {chosen[index] ? (
                    <>
                      <PokemonArt id={chosen[index].speciesId} shiny={chosen[index].shiny} />
                      <strong>{pokemonById(chosen[index].speciesId).name}</strong>
                      <small>{index === 0 ? 'Lead Pokémon' : 'Partner'}</small>
                      <button
                        aria-label={'Remove ' + pokemonById(chosen[index].speciesId).name}
                        onClick={() =>
                          setSelectedIds((ids) => ids.filter((id) => id !== chosen[index].id))
                        }
                      >
                        <Icon name="X" size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Pokeball size={32} />
                      <span>{index === 0 ? 'Choose your lead' : 'Add a partner'}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="section-heading">
              <h2>Your Pokémon</h2>
              <span>{chosen.length}/3 selected</span>
            </div>
            <div className="duel-team-grid">
              {available.map((pokemon) => (
                <button
                  className={
                    'team-select-card duel-team-card ' +
                    (selectedIds.includes(pokemon.id) ? 'selected' : '')
                  }
                  key={pokemon.id}
                  disabled={!selectedIds.includes(pokemon.id) && chosen.length >= 3}
                  aria-pressed={selectedIds.includes(pokemon.id)}
                  onClick={() =>
                    setSelectedIds((ids) =>
                      ids.includes(pokemon.id)
                        ? ids.filter((id) => id !== pokemon.id)
                        : [...ids, pokemon.id],
                    )
                  }
                >
                  <span className="duel-team-level">Lv. {pokemon.level}</span>
                  <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} animated={false} />
                  <strong>{pokemonById(pokemon.speciesId).name}</strong>
                  <div>
                    {pokemonById(pokemon.speciesId).types.map((type) => (
                      <TypeChip key={type} type={type} />
                    ))}
                  </div>
                  {selectedIds.includes(pokemon.id) && (
                    <span className="duel-selection-check">
                      <Icon name="Check" size={15} />
                    </span>
                  )}
                </button>
              ))}
            </div>
            {!available.length && (
              <div className="duel-empty">
                <Pokeball size={40} />
                <h3>Your party is waiting.</h3>
                <p>Choose a starter or hatch a Pokémon to begin.</p>
                <a className="button primary" href="#/starter">
                  Choose a starter
                </a>
              </div>
            )}
          </section>
          <aside className="battle-review duel-team-review">
            <h2>Your opponent</h2>
            <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            <p>{DIFFICULTIES[difficulty].detail}</p>
            <div className="duel-rival-preview">
              {rivals.length ? (
                rivals.map((fighter) => (
                  <div key={fighter.id}>
                    <PokemonArt id={fighter.speciesId} animated={false} />
                    <strong>{pokemonById(fighter.speciesId).name}</strong>
                    <small>
                      Lv. {fighter.level}
                      {fighter.trainingScale !== 1 ? ' · Practice scaling' : ''}
                    </small>
                  </div>
                ))
              ) : (
                <div className="duel-rival-placeholder">
                  <Pokeball size={42} />
                  <p>Select your team to meet your opponent.</p>
                </div>
              )}
            </div>
            {!!rivals.length && (
              <>
                <div className="duel-strength">
                  <span>Rival stat strength</span>
                  <strong>{relativeStrength}% of yours</strong>
                </div>
                <button
                  className="text-link duel-reroll"
                  onClick={() => setMatchSeed((seed) => seed + 1)}
                >
                  <Icon name="RefreshCw" size={15} />
                  New matchup
                </button>
              </>
            )}
            <Button disabled={!chosen.length} className="full-width" onClick={() => start()}>
              Start battle
              <Icon name="Swords" size={16} />
            </Button>
            <small className="practice-safety">
              For fun only. Everyone starts at full battle HP. Your inventory and balances stay
              unchanged.
            </small>
          </aside>
        </div>
      </div>
    );

  return (
    <div className="battle-screen arena-v6 arena-lobby">
      <PageHeading
        title="Battle arena"
        description="Build your team. Read the matchup. Make every turn count."
      />
      <div className="arena-mode-tabs" aria-label="Battle mode">
        <button
          className={mode === 'offline' ? 'active' : ''}
          aria-pressed={mode === 'offline'}
          onClick={() => setMode('offline')}
        >
          <Icon name="Swords" size={18} />
          Offline<span>Practice with a bot</span>
        </button>
        <button
          className={mode === 'online' ? 'active' : ''}
          aria-pressed={mode === 'online'}
          onClick={() => setMode('online')}
        >
          <Icon name="Users" size={18} />
          Online<span>Challenge a trainer</span>
        </button>
      </div>
      {mode === 'offline' ? (
        <section className="duel-lobby-card">
          <div className="arena-hero duel-lobby-art">
            <div className="duel-lobby-pair">
              <PokemonArt id={6} eager />
              <span>VS</span>
              <PokemonArt id={9} eager />
            </div>
            <div className="duel-lobby-copy">
              <span className="practice-chip">Offline · Just for fun</span>
              <h2>A fresh rival. Your next move.</h2>
              <p>
                Outsmart a team built around your strength. Try a new lead, find a type advantage,
                or set up the perfect finish.
              </p>
              <Button onClick={() => setPhase('team')}>
                Build your party
                <Icon name="ArrowRight" size={16} />
              </Button>
            </div>
          </div>
          <aside className="duel-lobby-settings">
            <h3>Choose your challenge</h3>
            <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            <div className="duel-coach">
              <Avatar
                profile={{ character: trainerCharacters[difficulty], accessoryColor: '#65b883' }}
                size={56}
              />
              <div>
                <strong>
                  {DIFFICULTIES[difficulty].trainer} · {difficulty}
                </strong>
                <p>{DIFFICULTIES[difficulty].detail}</p>
              </div>
            </div>
            <p className="duel-offline-note">
              No stakes, no rewards, no lost Pokémon. Try as many teams as you like.
            </p>
            {streak > 0 && (
              <span className="duel-streak">
                {streak} practice win{streak === 1 ? '' : 's'} in a row
              </span>
            )}
          </aside>
        </section>
      ) : (
        <section className="duel-online-card">
          <div className="duel-online-heading">
            <span className="online-unavailable">
              <i />
              Server not connected
            </span>
            <h2>Your next rival is another trainer.</h2>
            <p>
              Set up a friendly match or choose your stakes. Matchmaking will be available when
              Poképad’s battle server is connected.
            </p>
          </div>
          <div className="duel-online-form">
            <div>
              <label>Match type</label>
              <div className="online-formats">
                {['Friendly', 'SOL', 'Token', 'Pokémon'].map((format) => (
                  <button
                    key={format}
                    className={onlineFormat === format ? 'active' : ''}
                    aria-pressed={onlineFormat === format}
                    onClick={() => setOnlineFormat(format)}
                  >
                    {format === 'Friendly' ? 'Free battle' : format + ' wager'}
                  </button>
                ))}
              </div>
              {onlineFormat === 'Token' && (
                <label>
                  Community token
                  <select value={coin} onChange={(event) => setCoin(event.target.value)}>
                    {state.coins
                      .filter((entry) => entry.active)
                      .map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          ${entry.ticker}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {['SOL', 'Token'].includes(onlineFormat) && (
                <label>
                  Stake per trainer
                  <input
                    aria-label="Online wager amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={stake}
                    onChange={(event) => setStake(event.target.value)}
                  />
                  <small>
                    {onlineFormat === 'SOL'
                      ? 'SOL'
                      : '$' + state.coins.find((entry) => entry.id === coin)?.ticker}
                  </small>
                </label>
              )}
              {onlineFormat === 'Pokémon' && (
                <div className="duel-stake-note">
                  In a live Pokémon wager, the winner receives the loser’s entire selected team.
                  Starter Pokémon cannot be wagered.
                </div>
              )}
              <p className="duel-online-status">
                No matchmaking request is sent and no stake is locked.
              </p>
              <Button disabled className="full-width">
                Find a trainer
                <Icon name="Users" size={17} />
              </Button>
            </div>
            <div className="duel-online-art">
              <PokemonArt id={25} animated={false} />
              <PokemonArt id={133} animated={false} />
              <strong>1–3 Pokémon per trainer</strong>
              <p>Live turn validation and wager settlement belong on the server.</p>
            </div>
          </div>
        </section>
      )}
      <section className="duel-tactics">
        <div>
          <strong>Know your types</strong>
          <p>A favourable switch can turn the whole battle around.</p>
        </div>
        <div>
          <strong>Use your setup moves</strong>
          <p>Lower Attack, raise Speed, or create an opening with status.</p>
        </div>
        <div>
          <strong>Make your PP count</strong>
          <p>Big attacks have trade-offs. Keep a reliable move in reserve.</p>
        </div>
      </section>
    </div>
  );
}
