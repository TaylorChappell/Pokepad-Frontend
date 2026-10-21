import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { Avatar, Button, Icon, PokemonArt, Pokeball, TypeChip } from '../components/UI';
import { profileName } from '../state/model';
import { TYPE_COLORS } from '../utils';
import { BattleSprite } from '../battle/BattleSprite';
import {
  createBattleScene,
  getBattleMotionVector,
  type BattleActorGeometry,
  type BattlePoseOptions,
  type BattleScene,
} from '../battle/geometry';
import { getMoveSpriteScript, preloadEffectSprites } from '../battle/effect-sprites';
import { useBattleAudio } from '../battle/audio';
import { BattleEffects } from '../components/BattleEffects';
import { createBattlePlayback, type BattleCue } from '../battle/presentation';
import {
  DIFFICULTIES,
  battleMove,
  createBattle,
  createPlayerTeam,
  createSeededRandom,
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
const trainerColors = {
  Easy: '#65b883',
  Medium: '#efb13f',
  Hard: '#4e9ee8',
  Master: '#ef5357',
} as const;
const statusLabels = {
  burn: 'BRN',
  poison: 'PSN',
  paralysis: 'PAR',
  sleep: 'SLP',
  freeze: 'FRZ',
  none: '',
};

function Health({
  fighter,
  side,
  team,
}: {
  fighter: Fighter;
  side: 'player' | 'rival';
  team: Fighter[];
}) {
  const percent = Math.max(0, (fighter.hp / fighter.stats.hp) * 100);
  return (
    <section
      className={'classic-health classic-health-' + side}
      aria-label={`${pokemonById(fighter.speciesId).name}, ${fighter.hp} of ${fighter.stats.hp} HP`}
    >
      <div className="classic-health-name">
        <strong>{pokemonById(fighter.speciesId).name}</strong>
        <span>Lv.{fighter.level}</span>
      </div>
      <div className="classic-health-bar">
        <b>HP</b>
        <span>
          <i
            style={{
              width: percent + '%',
              background: percent > 50 ? '#43b16d' : percent > 20 ? '#efc34c' : '#e65e58',
            }}
          />
        </span>
      </div>
      <div className="classic-health-bottom">
        <span className="classic-team-balls">
          {team.map((member) => (
            <Pokeball key={member.id} size={12} className={member.hp <= 0 ? 'fainted' : ''} />
          ))}
        </span>
        {fighter.status !== 'none' && (
          <b className={'battle-condition condition-' + fighter.status}>
            {statusLabels[fighter.status]}
          </b>
        )}
        {side === 'player' && (
          <span>
            {fighter.hp}/{fighter.stats.hp}
          </span>
        )}
      </div>
    </section>
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
    <div className="classic-difficulties" aria-label="Bot difficulty">
      {difficultyNames.map((name, index) => (
        <button
          key={name}
          aria-label={name + ' difficulty'}
          aria-pressed={value === name}
          className={value === name ? 'selected' : ''}
          onClick={() => onChange(name)}
        >
          <Avatar
            profile={{ character: trainerCharacters[name], accessoryColor: trainerColors[name] }}
            size={42}
          />
          <span>
            <strong>{name}</strong>
            <small>{DIFFICULTIES[name].trainer}</small>
          </span>
          <span className="classic-difficulty-stars" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <i key={i} className={i <= index ? 'lit' : ''} />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}

function FieldGround({ scene }: { scene: BattleScene }) {
  return (
    <svg
      className="classic-ground"
      viewBox={`0 0 ${scene.width} ${scene.height}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="battle-grass" x2="0" y2="1">
          <stop stopColor="#a3eaa0" />
          <stop offset="1" stopColor="#56b66e" />
        </linearGradient>
        <pattern id="battle-grass-blades" width="28" height="14" patternUnits="userSpaceOnUse">
          <path
            d="M2 12 1 6 6 9 8 3 11 9 16 6 14 12M20 11l2-7 3 6"
            stroke="#4c9c5b"
            strokeWidth="2"
            fill="none"
          />
        </pattern>
      </defs>
      {(['rival', 'player'] as const).map((side) => {
        const { x, y, rx, ry } = scene.actors[side].ground;
        return (
          <g className={'classic-ground-' + side} key={side}>
            <ellipse cx={x} cy={y + ry * 0.14} rx={rx} ry={ry} fill="#a3ad56" />
            <ellipse
              cx={x}
              cy={y}
              rx={rx}
              ry={ry}
              fill="url(#battle-grass)"
              stroke="#668d4e"
              strokeWidth="2"
            />
            <ellipse
              cx={x}
              cy={y - ry * 0.08}
              rx={rx * 0.94}
              ry={ry * 0.78}
              fill="url(#battle-grass-blades)"
              opacity=".65"
            />
          </g>
        );
      })}
    </svg>
  );
}

function actorStyle(actor: BattleActorGeometry): CSSProperties {
  return {
    left: actor.rect.x,
    top: actor.rect.y,
    width: actor.rect.size,
    height: actor.rect.size,
    right: 'auto',
    bottom: 'auto',
  };
}

function actorPose(
  scene: BattleScene,
  side: 'player' | 'rival',
  cue: BattleCue | null,
): BattlePoseOptions | undefined {
  if (!cue) return;
  const script = getMoveSpriteScript(cue.moveName);
  let motion: BattlePoseOptions['motion'];
  if (cue.side === side) {
    if (cue.kind === 'switch') motion = 'arrive';
    else if (cue.kind === 'faint') motion = 'faint';
    else if (cue.kind === 'move') motion = cue.outcome === 'charge' ? 'charge' : script.motion;
  } else if (cue.targetSide === side && cue.kind === 'move' && cue.outcome === 'hit') {
    motion = 'hit';
  }
  return motion
    ? {
        motion,
        vector: getBattleMotionVector(scene, side, motion),
        durationMs: cue.durationMs,
        impactAt: script.impactAt,
      }
    : undefined;
}

export function BattlesPage() {
  const { state } = useApp();
  const [mode, setMode] = useState<'offline' | 'online'>('offline');
  const [phase, setPhase] = useState<'lobby' | 'team' | 'battle'>('lobby');
  const [difficulty, setDifficulty] = useState<Difficulty>('Medium');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [matchSeed, setMatchSeed] = useState(() => Date.now());
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [displayBattle, setDisplayBattle] = useState<BattleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const launchAttempt = useRef(0);
  const [command, setCommand] = useState<'root' | 'fight' | 'pokemon' | 'log'>('root');
  const [streak, setStreak] = useState(0);
  const [cue, setCue] = useState<BattleCue | null>(null);
  const [dialogue, setDialogue] = useState('');
  const [page, setPage] = useState(0);
  const [compactHeight, setCompactHeight] = useState(() => window.innerHeight <= 560);
  const field = useRef<HTMLDivElement>(null);
  const [fieldSize, setFieldSize] = useState({ width: 1000, height: 600 });
  useLayoutEffect(() => {
    const element = field.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0)
        setFieldSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [phase, mode]);
  useEffect(() => {
    const resize = () => setCompactHeight(window.innerHeight <= 560);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const [query, setQuery] = useState('');
  const [onlineFormat, setOnlineFormat] = useState('Friendly');
  const [stake, setStake] = useState('0.1');
  const [coin, setCoin] = useState('poke');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const audio = useBattleAudio(phase === 'battle');
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    launchAttempt.current += 1;
    setLaunching(false);
    setLaunchError(null);
    if (phase === 'team') void preloadEffectSprites().catch(() => {});
  }, [phase, mode, selectedIds, difficulty]);
  useEffect(
    () => () => {
      launchAttempt.current += 1;
    },
    [],
  );
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
  const lobbyParty = chosen.length ? chosen : available.slice(0, 3);
  const lobbyRivals = useMemo(
    () => generateRivalTeam(lobbyParty, difficulty, createSeededRandom(matchSeed)),
    [chosen, state.pokemon, difficulty, matchSeed],
  );
  const visibleBattle = phase === 'battle' ? displayBattle || battle : null;
  const visiblePlayer = visibleBattle?.player[visibleBattle.active.player] || lobbyParty[0];
  const visibleRival = visibleBattle?.rival[visibleBattle.active.rival] || lobbyRivals[0];
  const scene = useMemo(
    () =>
      createBattleScene({
        ...fieldSize,
        player: { speciesId: visiblePlayer?.speciesId || 4, shiny: visiblePlayer?.shiny },
        rival: { speciesId: visibleRival?.speciesId || 7, shiny: visibleRival?.shiny },
      }),
    [
      fieldSize,
      visiblePlayer?.speciesId,
      visiblePlayer?.shiny,
      visibleRival?.speciesId,
      visibleRival?.shiny,
    ],
  );
  const relativeStrength = ownPreview.length
    ? Math.round((teamStrength(rivals) / teamStrength(ownPreview)) * 100)
    : Math.round(DIFFICULTIES[difficulty].ratio * 100);
  const filtered = available.filter((pokemon) =>
    pokemonById(pokemon.speciesId).name.toLowerCase().includes(query.toLowerCase()),
  );
  const pageSize = compactHeight ? 3 : 6;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const start = async (fresh = false) => {
    if (!chosen.length || launching) return;
    const attempt = ++launchAttempt.current;
    setLaunching(true);
    setLaunchError(null);
    clearTimeout(timer.current);
    audio.unlock();
    try {
      await preloadEffectSprites();
    } catch {
      if (launchAttempt.current === attempt) {
        setLaunching(false);
        setLaunchError('Battle effects could not load. Check your connection and try again.');
      }
      return;
    }
    if (launchAttempt.current !== attempt) return;
    const next = createBattle(
      chosen,
      fresh ? generateRivalTeam(chosen, difficulty) : rivals,
      difficulty,
    );
    setBattle(next);
    setDisplayBattle(next);
    setPhase('battle');
    setBusy(false);
    setCue(null);
    setCommand('root');
    setDialogue('');
    setLaunching(false);
  };
  const play = (action: BattleAction) => {
    if (!battle || busy || battle.winner) return;
    const next = resolveTurn(battle, action);
    if (next === battle) return;
    audio.unlock();
    setCommand('root');
    setBusy(true);
    const frames = createBattlePlayback(battle, next);
    let index = 0;
    const advance = () => {
      const frame = frames[index++];
      if (!frame) {
        setBattle(next);
        setDisplayBattle(next);
        setBusy(false);
        setCue(null);
        setDialogue('');
        if (next.winner) {
          setStreak((value) => (next.winner === 'player' ? value + 1 : 0));
          if (next.winner !== 'draw') audio.playCue(next.winner === 'player' ? 'win' : 'lose');
        }
        return;
      }
      setDisplayBattle(frame.displayState);
      setDialogue(frame.event.text);
      setCue(frame.cue);
      if (frame.cue?.moveName) audio.playMove(frame.cue.moveName);
      else if (frame.event.kind === 'switch') audio.playCue('switch');
      else if (frame.event.kind === 'faint') audio.playCue('faint');
      timer.current = setTimeout(
        advance,
        state.profile.reducedMotion ? Math.min(frame.durationMs, 450) : frame.durationMs,
      );
    };
    advance();
  };
  const leave = () => {
    clearTimeout(timer.current);
    setBusy(false);
    setBattle(null);
    setDisplayBattle(null);
    setCue(null);
    setPhase('lobby');
  };
  const heading = (
    <header className="classic-page-heading battle-page-heading">
      <div>
        <h1>Battle arena</h1>
        <span>
          {phase === 'battle'
            ? 'Offline · ' + difficulty
            : phase === 'team'
              ? 'Choose your party'
              : 'Kanto practice league'}
        </span>
      </div>
      {phase === 'battle' ? (
        <div className="classic-match-tools">
          <span>Turn {Math.max(1, (displayBattle || battle)?.turn || 1)}</span>
          <button
            className="classic-sound"
            onClick={audio.toggleMuted}
            aria-label={audio.muted ? 'Enable battle sound' : 'Mute battle sound'}
            title={
              audio.musicUnavailable
                ? 'Music unavailable. Tap to retry sound.'
                : audio.muted
                  ? 'Sound off'
                  : 'Sound on'
            }
            data-audio-unavailable={audio.musicUnavailable || undefined}
            aria-pressed={!audio.muted}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 9h4l5-4v14l-5-4H4Z" />
              {audio.muted ? (
                <path d="m17 9 5 6m0-6-5 6" />
              ) : (
                <>
                  <path d="M16 8a6 6 0 0 1 0 8M19 5a10 10 0 0 1 0 14" />
                </>
              )}
            </svg>
          </button>
          <button className="classic-exit" onClick={leave} aria-label="Leave practice battle">
            <Icon name="X" size={18} />
          </button>
        </div>
      ) : (
        <div className="arena-mode-tabs">
          <button
            className={mode === 'offline' ? 'active' : ''}
            aria-pressed={mode === 'offline'}
            onClick={() => {
              setMode('offline');
              setPhase('lobby');
            }}
          >
            Offline
          </button>
          <button
            className={mode === 'online' ? 'active' : ''}
            aria-pressed={mode === 'online'}
            onClick={() => {
              setMode('online');
              setPhase('lobby');
            }}
          >
            Online
          </button>
        </div>
      )}
    </header>
  );

  if (phase === 'battle' && battle) {
    const view = displayBattle || battle;
    const current = view.player[view.active.player],
      opponent = view.rival[view.active.rival];
    const exhausted = current.pp.every((value) => value <= 0),
      lockedMove = current.charging;
    const playerPose = actorPose(scene, 'player', cue);
    const rivalPose = actorPose(scene, 'rival', cue);
    const prompt = busy
      ? dialogue
      : battle.winner
        ? battle.winner === 'player'
          ? 'You won the battle!'
          : battle.winner === 'draw'
            ? 'Both teams gave it everything.'
            : 'Your team has fainted.'
        : current.recharge
          ? `${pokemonById(current.speciesId).name} needs to recharge.`
          : lockedMove
            ? `${lockedMove} is ready!`
            : `What will ${pokemonById(current.speciesId).name} do?`;
    return (
      <div className="battle-v8 battle-screen classic-match">
        {heading}
        <section
          className="classic-handheld"
          aria-label="Pokémon battle"
          aria-busy={busy}
          data-state={busy ? 'playing' : battle.winner ? 'result' : command}
        >
          <div ref={field} className="battle-field classic-field" data-effect={cue?.family || ''}>
            <FieldGround scene={scene} />
            <Health fighter={opponent} side="rival" team={view.rival} />
            <Health fighter={current} side="player" team={view.player} />
            <div
              className={
                'classic-fighter classic-rival battle-placed-actor' +
                (opponent.hp <= 0 ? ' is-fainted' : '')
              }
              style={actorStyle(scene.actors.rival)}
            >
              <BattleSprite
                speciesId={opponent.speciesId}
                shiny={opponent.shiny}
                side="rival"
                actor={scene.actors.rival}
                pose={rivalPose}
                poseKey={cue?.id}
                paused={opponent.hp <= 0 || (busy && !rivalPose)}
                reducedMotion={state.profile.reducedMotion}
              />
            </div>
            <div
              className={
                'classic-fighter classic-player battle-placed-actor' +
                (current.hp <= 0 ? ' is-fainted' : '')
              }
              style={actorStyle(scene.actors.player)}
            >
              <BattleSprite
                speciesId={current.speciesId}
                shiny={current.shiny}
                side="player"
                actor={scene.actors.player}
                pose={playerPose}
                poseKey={cue?.id}
                paused={current.hp <= 0 || (busy && !playerPose)}
                reducedMotion={state.profile.reducedMotion}
              />
            </div>
            <BattleEffects cue={cue} scene={scene} reducedMotion={state.profile.reducedMotion} />
          </div>
          <div className={'classic-console command-' + command}>
            {battle.winner && !busy ? (
              <div className="classic-result">
                <div>
                  <strong>
                    {battle.winner === 'player'
                      ? 'Victory!'
                      : battle.winner === 'draw'
                        ? 'A draw!'
                        : 'A good battle!'}
                  </strong>
                  <span>
                    {battle.turn - 1} turns · {streak} wins in a row
                  </span>
                  <small>Your collection is unchanged.</small>
                </div>
                <div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setBattle(null);
                      setDisplayBattle(null);
                      setPhase('team');
                      setMatchSeed((seed) => seed + 1);
                    }}
                  >
                    Change party
                  </Button>
                  <Button disabled={launching} onClick={() => start(true)}>
                    {launching ? 'Preparing battle…' : launchError ? 'Retry battle' : 'Play again'}
                    <Icon name="RefreshCw" size={15} />
                  </Button>
                  {launchError && (
                    <p className="battle-load-error" role="alert">
                      {launchError}
                    </p>
                  )}
                </div>
              </div>
            ) : busy || command === 'root' ? (
              <>
                <div className="classic-dialogue" role="status" aria-live="polite">
                  <p>{prompt}</p>
                  {busy ? (
                    <span className="classic-dialogue-cursor" aria-hidden="true" />
                  ) : (
                    <small>
                      {current.trapped
                        ? 'Trapped · switching unavailable'
                        : lockedMove
                          ? 'Finish the charged move'
                          : current.recharge
                            ? 'Take a recovery turn'
                            : 'Choose an action'}
                    </small>
                  )}
                </div>
                <div className="classic-root-actions">
                  <button
                    className="classic-fight"
                    disabled={busy}
                    onClick={() => {
                      audio.playCue('select');
                      setCommand('fight');
                    }}
                  >
                    <span aria-hidden="true">▶</span>Fight
                  </button>
                  <button
                    className="classic-pokemon"
                    disabled={busy || current.trapped > 0 || !!current.charging || current.recharge}
                    onClick={() => {
                      audio.playCue('select');
                      setCommand('pokemon');
                    }}
                  >
                    <Pokeball size={24} />
                    Pokémon
                  </button>
                </div>
              </>
            ) : command === 'fight' ? (
              <>
                <div className="battle-moves classic-moves">
                  {(lockedMove
                    ? [lockedMove]
                    : current.recharge
                      ? [current.moves[0]]
                      : exhausted
                        ? ['Struggle']
                        : current.moves
                  ).map((name) => {
                    const move = battleMove(name),
                      index = current.moves.indexOf(name);
                    return (
                      <button
                        key={name}
                        style={
                          { '--move-color': TYPE_COLORS[move.type] || '#718797' } as CSSProperties
                        }
                        disabled={
                          busy ||
                          (!current.recharge && !lockedMove && current.pp[index] <= 0 && !exhausted)
                        }
                        onClick={() =>
                          play({ kind: 'move', index: name === 'Struggle' ? -1 : index })
                        }
                        title={
                          current.recharge
                            ? 'Recover this turn'
                            : getMoveHint(current, opponent, name)
                        }
                      >
                        <strong>{current.recharge ? 'Recharge' : name}</strong>
                        <span>
                          <b>{move.type}</b>
                          <small>{exhausted ? '—' : `${current.pp[index]}/${move.pp}`} PP</small>
                        </span>
                        <small className="classic-move-detail">
                          {moveCategory(move)}
                          {move.power ? ` · ${move.power}` : ''}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <button className="classic-menu-back" onClick={() => setCommand('root')}>
                  <Icon name="ArrowLeft" size={18} />
                  <span>Back</span>
                </button>
              </>
            ) : command === 'pokemon' ? (
              <>
                <div className="classic-party-menu">
                  {view.player.map((fighter, index) => (
                    <button
                      key={fighter.id}
                      disabled={
                        fighter.hp <= 0 ||
                        index === view.active.player ||
                        current.trapped > 0 ||
                        !!current.charging ||
                        current.recharge
                      }
                      onClick={() => play({ kind: 'switch', index })}
                      aria-label={`Switch to ${pokemonById(fighter.speciesId).name}`}
                    >
                      <PokemonArt id={fighter.speciesId} shiny={fighter.shiny} animated={false} />
                      <span>
                        <strong>{pokemonById(fighter.speciesId).name}</strong>
                        <small>
                          {fighter.hp}/{fighter.stats.hp} HP
                          {index === view.active.player ? ' · In battle' : ''}
                        </small>
                        <i>
                          <b
                            style={{
                              width: Math.max(0, (fighter.hp / fighter.stats.hp) * 100) + '%',
                            }}
                          />
                        </i>
                      </span>
                    </button>
                  ))}
                </div>
                <button className="classic-menu-back" onClick={() => setCommand('root')}>
                  <Icon name="ArrowLeft" size={18} />
                  <span>Back</span>
                </button>
              </>
            ) : (
              <div className="classic-log">
                <div>
                  {battle.history.slice(-6).map((event, index) => (
                    <p key={index}>{event.text}</p>
                  ))}
                </div>
                <button onClick={() => setCommand('root')}>Back</button>
              </div>
            )}
          </div>
        </section>
        <footer className="classic-match-footer">
          <span>
            {profileName(state)} <b>vs</b> {DIFFICULTIES[difficulty].trainer}
          </span>
          <span>Practice · no stakes</span>
        </footer>
      </div>
    );
  }

  if (phase === 'team')
    return (
      <div className="battle-v8 battle-screen classic-team-screen">
        {heading}
        <div className="classic-team-desk">
          <section className="classic-team-pick">
            <div className="classic-team-top">
              <button className="text-link" onClick={() => setPhase('lobby')}>
                <Icon name="ArrowLeft" size={15} />
                Arena
              </button>
              <h2>Build your party</h2>
              <span>{chosen.length}/3</span>
            </div>
            <div className="classic-party-slots">
              {[0, 1, 2].map((index) => (
                <div className={chosen[index] ? 'filled' : ''} key={index}>
                  {chosen[index] ? (
                    <>
                      <PokemonArt
                        id={chosen[index].speciesId}
                        shiny={chosen[index].shiny}
                        animated={false}
                      />
                      <span>
                        <strong>{pokemonById(chosen[index].speciesId).name}</strong>
                        <small>{index === 0 ? 'Lead Pokémon' : 'Partner'}</small>
                      </span>
                      <button
                        aria-label={'Remove ' + pokemonById(chosen[index].speciesId).name}
                        onClick={() =>
                          setSelectedIds((ids) => ids.filter((id) => id !== chosen[index].id))
                        }
                      >
                        <Icon name="X" size={13} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Pokeball size={28} />
                      <span>{index === 0 ? 'Choose a lead' : 'Add a partner'}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <label className="classic-party-search">
              <Icon name="Search" size={17} />
              <input
                aria-label="Find a battle Pokémon"
                placeholder="Find a Pokémon…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPage(0);
                }}
              />
            </label>
            <div className="classic-selection-grid">
              {filtered
                .slice(currentPage * pageSize, (currentPage + 1) * pageSize)
                .map((pokemon) => (
                  <button
                    className={
                      'team-select-card classic-select-card ' +
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
                    <span className="classic-select-level">Lv.{pokemon.level}</span>
                    <PokemonArt id={pokemon.speciesId} shiny={pokemon.shiny} animated={false} />
                    <strong>{pokemonById(pokemon.speciesId).name}</strong>
                    <div>
                      {pokemonById(pokemon.speciesId).types.map((type) => (
                        <TypeChip key={type} type={type} />
                      ))}
                    </div>
                    {selectedIds.includes(pokemon.id) && (
                      <span className="classic-selected-tick">
                        <Icon name="Check" size={14} />
                      </span>
                    )}
                  </button>
                ))}
            </div>
            {!filtered.length && (
              <div className="classic-no-pokemon">
                <Pokeball size={34} />
                <p>
                  {available.length
                    ? 'No matching Pokémon.'
                    : 'Choose a starter or hatch a Pokémon.'}
                </p>
                {!available.length && (
                  <a href="#/starter" className="button primary">
                    Choose a starter
                  </a>
                )}
              </div>
            )}
            <div className="classic-pagination">
              <button
                aria-label="Previous Pokémon page"
                disabled={currentPage === 0}
                onClick={() => setPage((page) => page - 1)}
              >
                <Icon name="ChevronLeft" size={16} />
              </button>
              <span>
                {currentPage + 1} / {pageCount}
              </span>
              <button
                aria-label="Next Pokémon page"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage((page) => page + 1)}
              >
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          </section>
          <aside className="battle-review classic-team-review">
            <div className="classic-rival-heading">
              <Avatar
                profile={{
                  character: trainerCharacters[difficulty],
                  accessoryColor: trainerColors[difficulty],
                }}
                size={48}
              />
              <div>
                <small>Your opponent</small>
                <h2>{DIFFICULTIES[difficulty].trainer}</h2>
              </div>
            </div>
            <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            <div className="classic-rival-party">
              {rivals.length ? (
                rivals.map((fighter) => (
                  <div key={fighter.id}>
                    <PokemonArt id={fighter.speciesId} animated={false} />
                    <strong>{pokemonById(fighter.speciesId).name}</strong>
                    <small>Lv.{fighter.level}</small>
                  </div>
                ))
              ) : (
                <p>Select your first Pokémon to meet the rival team.</p>
              )}
            </div>
            <div className="classic-rival-strength">
              <span>
                {rivals.length
                  ? `Rival strength: ${relativeStrength}% of yours`
                  : 'Your opponent scales to your party'}
              </span>
              <button aria-label="New matchup" onClick={() => setMatchSeed((seed) => seed + 1)}>
                <Icon name="RefreshCw" size={16} />
              </button>
            </div>
            <Button disabled={!chosen.length || launching} onClick={() => start()}>
              {launching ? 'Preparing battle…' : launchError ? 'Retry battle' : 'Start battle'}
              <Icon name="Swords" size={17} />
            </Button>
            {launchError && (
              <p className="battle-load-error" role="alert">
                {launchError}
              </p>
            )}
            <small className="classic-practice-note">Full battle HP · no stakes</small>
          </aside>
        </div>
      </div>
    );

  return (
    <div className="battle-v8 battle-screen arena-lobby">
      {heading}
      {mode === 'offline' ? (
        <div className="classic-lobby-grid">
          <section className="arena-hero classic-lobby-board">
            <div ref={field} className="classic-preview-field">
              <FieldGround scene={scene} />
              <div className="classic-preview-caption">
                <span>OFFLINE BATTLE</span>
                <h2>Your next challenger.</h2>
                <p>Pick a rival. Build your party. Make your move.</p>
              </div>
              <div
                className="classic-preview-player battle-placed-actor"
                style={actorStyle(scene.actors.player)}
              >
                <BattleSprite
                  speciesId={lobbyParty[0]?.speciesId || 4}
                  shiny={lobbyParty[0]?.shiny}
                  side="player"
                  actor={scene.actors.player}
                  reducedMotion={state.profile.reducedMotion}
                />
              </div>
              <div
                className="classic-preview-rival battle-placed-actor"
                style={actorStyle(scene.actors.rival)}
              >
                <BattleSprite
                  speciesId={lobbyRivals[0]?.speciesId || 7}
                  side="rival"
                  actor={scene.actors.rival}
                  reducedMotion={state.profile.reducedMotion}
                />
              </div>
              <span className="classic-preview-versus">VS</span>
            </div>
            <div className="classic-lobby-party">
              <div>
                <h3>Your party starts here</h3>
                <span>Choose up to 3 Pokémon</span>
              </div>
              <div>
                {[0, 1, 2].map((index) => (
                  <button
                    key={index}
                    onClick={() => setPhase('team')}
                    aria-label="Choose your battle party"
                  >
                    {lobbyParty[index] ? (
                      <>
                        <PokemonArt
                          id={lobbyParty[index].speciesId}
                          shiny={lobbyParty[index].shiny}
                          animated={false}
                        />
                        <span>{pokemonById(lobbyParty[index].speciesId).name}</span>
                      </>
                    ) : (
                      <Pokeball size={28} />
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="classic-lobby-actions">
              <span>
                Just for fun<small>Your collection stays unchanged.</small>
              </span>
              <Button onClick={() => setPhase('team')}>
                Build your party
                <Icon name="ArrowRight" size={16} />
              </Button>
            </div>
          </section>
          <aside className="classic-rival-desk">
            <h2>Choose a rival</h2>
            <p>How tough should the match be?</p>
            <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            <div className="classic-difficulty-note">
              <strong>{difficulty} challenge</strong>
              <p>{DIFFICULTIES[difficulty].detail}</p>
              {streak > 0 && <span>{streak} wins in a row</span>}
            </div>
            <a href="#/guide?topic=battles">
              <Icon name="BookOpen" size={16} />
              Battle guide
              <Icon name="ArrowUpRight" size={14} />
            </a>
          </aside>
        </div>
      ) : (
        <section className="classic-online">
          <div>
            <span className="classic-offline-label">
              <i />
              Server not connected
            </span>
            <h2>A trainer is your next rival.</h2>
            <p>
              Prepare your match. Online battles become available when the battle server is
              connected.
            </p>
            <label>Match type</label>
            <div className="classic-online-formats">
              {['Friendly', 'SOL', 'Token', 'Pokémon'].map((format) => (
                <button
                  key={format}
                  className={onlineFormat === format ? 'selected' : ''}
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
              </label>
            )}
            {onlineFormat === 'Pokémon' && (
              <p className="classic-stake-note">
                The winner receives the loser’s selected team. Starter Pokémon cannot be wagered.
              </p>
            )}
            <Button disabled>
              Find a trainer
              <Icon name="Users" size={17} />
            </Button>
            <small>No matchmaking request is sent and no stake is locked.</small>
          </div>
          <div className="classic-online-art">
            <BattleSprite speciesId={25} side="player" />
            <BattleSprite speciesId={133} side="rival" />
            <span>1–3 Pokémon per trainer</span>
          </div>
        </section>
      )}
    </div>
  );
}
