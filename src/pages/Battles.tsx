import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { moveByName } from '../data/moves';
import { getPokemonHealth, getPokemonStats } from '../data/stats';
import {
  Avatar,
  Button,
  Icon,
  Modal,
  PageHeading,
  PokemonArt,
  Pokeball,
  Progress,
  TypeChip,
} from '../components/UI';
import { profileName } from '../state/model';
import { sol, TYPE_COLORS } from '../utils';
type Format = 'Friendly' | 'SOL' | 'Token' | 'Pokémon';
export function BattlesPage() {
  const { state } = useApp(),
    [phase, setPhase] = useState<'lobby' | 'team' | 'battle' | 'result'>('lobby'),
    [format, setFormat] = useState<Format>('Friendly'),
    [team, setTeam] = useState<string[]>([]),
    [stake, setStake] = useState('0.1'),
    [coin, setCoin] = useState('poke'),
    [review, setReview] = useState(false);
  const [hp, setHp] = useState<number[]>([]),
    [enemyHp, setEnemyHp] = useState<number[]>([]),
    [active, setActive] = useState(0),
    [enemy, setEnemy] = useState(0),
    [turn, setTurn] = useState(1),
    [log, setLog] = useState(''),
    [busy, setBusy] = useState(false),
    [attack, setAttack] = useState(''),
    [winner, setWinner] = useState(false),
    [pp, setPp] = useState<number[][]>([]),
    [switching, setSwitching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const available = state.pokemon.filter(
      (p) =>
        !p.listed &&
        !p.locked &&
        getPokemonHealth(p).current > 0 &&
        (format !== 'Pokémon' || !p.starter),
    ),
    chosen = team.map((id) => state.pokemon.find((p) => p.id === id)!).filter(Boolean),
    opponents = [9, 94, 149].slice(0, chosen.length),
    current = chosen[active],
    opponent = opponents[enemy],
    maxHp = chosen.map((p) => getPokemonStats(p).hp),
    enemyMaxHp = opponents.map(
      (speciesId, i) => getPokemonStats({ speciesId, level: chosen[i].level }).hp,
    ),
    ownPercent = current ? (hp[active] / maxHp[active]) * 100 : 0,
    enemyPercent = opponent ? (enemyHp[enemy] / enemyMaxHp[enemy]) * 100 : 0;
  const chooseFormat = (f: Format) => {
    setFormat(f);
    setTeam([]);
    setPhase('team');
  };
  const start = () => {
    setReview(false);
    setPhase('battle');
    setHp(chosen.map((p) => getPokemonHealth(p).current));
    setEnemyHp(enemyMaxHp);
    setPp(chosen.map((p) => p.moves.map((m) => moveByName(m).pp)));
    setActive(0);
    setEnemy(0);
    setTurn(1);
    setBusy(false);
    setAttack('');
    setLog('Leaf challenges you to a battle!');
  };
  const move = (index: number) => {
    if (busy || !current || pp[active]?.[index] === 0) return;
    setBusy(true);
    setAttack('player');
    const m = moveByName(current.moves[index]),
      ownName = pokemonById(current.speciesId).name,
      enemyName = pokemonById(opponent).name;
    setPp((p) => p.map((v, i) => (i === active ? v.map((x, j) => (j === index ? x - 1 : x)) : v)));
    // Keep the simplified practice pacing while displaying real species/level HP.
    const damage = m.power
        ? Math.max(
            1,
            Math.round((Math.min(65, Math.round(m.power * 0.43) + 9) * enemyMaxHp[enemy]) / 100),
          )
        : 0,
      nextEnemy = enemyHp.map((h, i) => (i === enemy ? Math.max(0, h - damage) : h));
    setEnemyHp(nextEnemy);
    setLog(
      ownName +
        ' used ' +
        m.name +
        '! ' +
        (damage ? 'It hit the opposing Pokémon.' : 'The Pokémon is preparing for the next attack.'),
    );
    const delay = state.profile.reducedMotion ? 180 : 1150;
    timer.current = setTimeout(() => {
      setAttack('');
      if (nextEnemy.every((h) => h <= 0)) {
        setWinner(true);
        setPhase('result');
        setBusy(false);
        return;
      }
      if (nextEnemy[enemy] === 0) {
        const next = nextEnemy.findIndex((h) => h > 0);
        setEnemy(next);
        setLog(
          enemyName + ' fainted. Your rival sends out ' + pokemonById(opponents[next]).name + '!',
        );
        setTurn((t) => t + 1);
        setBusy(false);
        return;
      }
      const retaliation = Math.max(
          1,
          Math.round(((m.power ? 17 + (turn % 3) * 4 : 9) * maxHp[active]) / 100),
        ),
        nextHp = hp.map((h, i) => (i === active ? Math.max(0, h - retaliation) : h));
      setAttack('enemy');
      setHp(nextHp);
      setLog(
        enemyName +
          ' used Tackle! ' +
          (nextHp[active] === 0
            ? ownName + ' fainted. Send out your next Pokémon.'
            : 'What will ' + ownName + ' do?'),
      );
      timer.current = setTimeout(
        () => {
          setAttack('');
          setBusy(false);
          setTurn((t) => t + 1);
          if (nextHp.every((h) => h <= 0)) {
            setWinner(false);
            setPhase('result');
          } else if (nextHp[active] === 0) setActive(nextHp.findIndex((h) => h > 0));
        },
        state.profile.reducedMotion ? 100 : 600,
      );
    }, delay);
  };
  const canReview =
    chosen.length > 0 &&
    (format === 'Friendly' ||
      format === 'Pokémon' ||
      (Number.isFinite(Number(stake)) && Number(stake) > 0));
  if (phase === 'result')
    return (
      <div className="battle-screen">
        <PageHeading title="Battle result" />
        <div className="panel battle-result">
          <div className="result-stamp">{winner ? 'VICTORY' : 'DEFEAT'}</div>
          <h1>{winner ? 'You defeated Leaf!' : 'Leaf won the battle.'}</h1>
          <p>
            {winner ? 'Your team won the practice match.' : 'Your Pokémon are ready for a rematch.'}
          </p>
          <div className="result-team">
            {chosen.map((p) => (
              <div key={p.id}>
                <PokemonArt id={p.speciesId} shiny={p.shiny} />
                <strong>{pokemonById(p.speciesId).name}</strong>
                <small>Lv. {p.level}</small>
              </div>
            ))}
          </div>
          <div className="result-stats">
            <span>
              <strong>{turn}</strong>turns
            </span>
            <span>
              <strong>
                {chosen.length} v {chosen.length}
              </strong>
              format
            </span>
            <span>
              <strong>{format === 'Friendly' ? 'Friendly' : 'Wager preview'}</strong>match type
            </span>
          </div>
          <div className="notice">
            <Icon name="Heart" />
            {format === 'Friendly'
              ? 'Your Pokémon are ready for another practice match.'
              : 'This was a simulated match. No SOL, tokens, or Pokémon were transferred.'}
          </div>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setPhase('lobby')}>
              Back to arena
            </Button>
            <Button onClick={start}>
              Play again
              <Icon name="RefreshCw" size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  if (phase === 'battle' && current && opponent)
    return (
      <div className="battle-screen">
        <div className="battle-page-heading">
          <a
            className="button secondary arena-back"
            href="#/battles"
            onClick={(e) => {
              e.preventDefault();
              if (!busy) {
                setPhase('lobby');
              }
            }}
          >
            <Icon name="ArrowLeft" size={15} />
            Leave practice
          </a>
          <span className="status-tag">
            {format === 'Friendly' ? 'Friendly practice' : 'Wager flow preview'}
          </span>
          <span className="muted small">Turn {turn} · Kanto moves</span>
        </div>
        <div className="battle-trainer-bar">
          <div>
            <Avatar profile={state.profile} size={39} />
            <span>
              <strong>{profileName(state)}</strong>
              <small>
                {chosen.map((p, i) => (
                  <Pokeball key={p.id} size={15} className={hp[i] <= 0 ? 'fainted' : ''} />
                ))}
              </small>
            </span>
          </div>
          <span className="versus">VS</span>
          <div>
            <span>
              <strong>Leaf</strong>
              <small>
                {opponents.map((p, i) => (
                  <Pokeball key={p} size={15} className={enemyHp[i] <= 0 ? 'fainted' : ''} />
                ))}
              </small>
            </span>
            <Avatar profile={{ character: 'leaf', accessoryColor: '#65b883' }} size={39} />
          </div>
        </div>
        <div className={'battle-field ' + attack}>
          <div className="battle-cloud cloud-one" />
          <div className="battle-cloud cloud-two" />
          <div className="battle-horizon" />
          <div className="combatant enemy-combatant">
            <div className="hp-card">
              <div>
                <strong>{pokemonById(opponent).name}</strong>
                <span>Lv. {chosen[enemy].level}</span>
              </div>
              <div className="hp-bar">
                <small>HP</small>
                <Progress value={enemyPercent} color={enemyPercent > 35 ? '#68b687' : '#e8ad57'} />
              </div>
              <small className="hp-number">
                {enemyHp[enemy]} / {enemyMaxHp[enemy]}
              </small>
            </div>
            <div className="battle-platform" />
            <PokemonArt id={opponent} />
          </div>
          <div className="combatant player-combatant">
            <div className="battle-platform" />
            <PokemonArt id={current.speciesId} shiny={current.shiny} />
            <div className="hp-card">
              <div>
                <strong>{pokemonById(current.speciesId).name}</strong>
                <span>Lv. {current.level}</span>
              </div>
              <div className="hp-bar">
                <small>HP</small>
                <Progress value={ownPercent} color={ownPercent > 35 ? '#68b687' : '#e8ad57'} />
              </div>
              <small className="hp-number">
                {hp[active]} / {maxHp[active]}
              </small>
            </div>
          </div>
          <div className="battle-grass grass-left" />
          <div className="battle-grass grass-right" />
        </div>
        <div className="battle-command-panel">
          <div className="battle-dialogue" aria-live="polite">
            <h3>{log}</h3>
            <small>Practice match · simplified battle rules</small>
          </div>
          <div className="battle-moves">
            {current.moves.map((name, i) => {
              const m = moveByName(name);
              return (
                <button
                  key={name}
                  disabled={busy || pp[active]?.[i] === 0}
                  onClick={() => move(i)}
                  style={{ borderColor: TYPE_COLORS[m.type] }}
                >
                  <span>
                    <strong>{name}</strong>
                    <small>
                      {m.type} · {m.power || '—'} power
                    </small>
                  </span>
                  <span>
                    {pp[active]?.[i]}/{m.pp}
                    <small>PP</small>
                  </span>
                </button>
              );
            })}
            <button
              className="battle-switch"
              disabled={busy || hp.filter((h) => h > 0).length < 2}
              onClick={() => setSwitching(true)}
            >
              <Pokeball size={18} />
              Switch Pokémon
              <Icon name="ChevronRight" size={15} />
            </button>
          </div>
        </div>
        {switching && (
          <Modal title="Choose a Pokémon" onClose={() => setSwitching(false)}>
            <div className="modal-body team-switch-list">
              {chosen.map((p, i) => (
                <button
                  key={p.id}
                  disabled={hp[i] <= 0 || i === active}
                  onClick={() => {
                    setActive(i);
                    setSwitching(false);
                    setLog('Go, ' + pokemonById(p.speciesId).name + '!');
                  }}
                >
                  <PokemonArt id={p.speciesId} shiny={p.shiny} />
                  <span>
                    <strong>{pokemonById(p.speciesId).name}</strong>
                    <small>
                      {hp[i]} / {maxHp[i]} HP {i === active ? '· On the field' : ''}
                    </small>
                  </span>
                  <Icon name="ArrowRight" />
                </button>
              ))}
            </div>
          </Modal>
        )}
      </div>
    );
  if (phase === 'team')
    return (
      <div className="battle-screen">
        <button className="button secondary arena-back" onClick={() => setPhase('lobby')}>
          <Icon name="ArrowLeft" size={16} />
          Back to arena
        </button>
        <PageHeading title="Choose your party" description="Select up to three Pokémon.">
          <span className="status-tag">
            <Icon name="Swords" size={14} />
            {format === 'Friendly' ? 'Friendly battle' : format + ' wager preview'}
          </span>
        </PageHeading>
        <div className="team-builder-layout">
          <div>
            <div className="team-slots">
              {[0, 1, 2].map((i) => (
                <div key={i} className={chosen[i] ? 'filled' : ''}>
                  {chosen[i] ? (
                    <>
                      <PokemonArt id={chosen[i].speciesId} shiny={chosen[i].shiny} />
                      <strong>{pokemonById(chosen[i].speciesId).name}</strong>
                      <button
                        aria-label={'Remove ' + pokemonById(chosen[i].speciesId).name}
                        onClick={() => setTeam(team.filter((id) => id !== chosen[i].id))}
                      >
                        <Icon name="X" size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Pokeball size={36} />
                      <span>{'Party slot ' + (i + 1)}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="section-heading">
              <h2>Available Pokémon</h2>
              <span className="muted small">{team.length}/3 selected</span>
            </div>
            <div className="team-pokemon-grid">
              {available.map((p) => (
                <button
                  key={p.id}
                  className={'team-select-card ' + (team.includes(p.id) ? 'selected' : '')}
                  disabled={!team.includes(p.id) && team.length >= 3}
                  onClick={() =>
                    setTeam(
                      team.includes(p.id) ? team.filter((id) => id !== p.id) : [...team, p.id],
                    )
                  }
                >
                  <span className="level-tag">Lv. {p.level}</span>
                  {team.includes(p.id) && (
                    <span className="team-check">
                      <Icon name="Check" size={14} />
                    </span>
                  )}
                  <PokemonArt id={p.speciesId} shiny={p.shiny} />
                  <strong>{pokemonById(p.speciesId).name}</strong>
                  <small>
                    {getPokemonHealth(p).current} / {getPokemonHealth(p).max} HP
                  </small>
                  <div className="type-row">
                    {pokemonById(p.speciesId).types.map((t) => (
                      <TypeChip key={t} type={t} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <aside className="panel battle-review">
            <h2>Your match</h2>
            <div className="ledger-row">
              <span>Format</span>
              <strong>
                {team.length || '1–3'} v {team.length || '1–3'}
              </strong>
            </div>
            <div className="ledger-row">
              <span>Mode</span>
              <strong>{format === 'Friendly' ? 'Friendly' : format + ' wager'}</strong>
            </div>
            {(format === 'SOL' || format === 'Token') && (
              <>
                <label className="field-label" htmlFor="battle-stake">
                  Your stake /{' '}
                  {format === 'SOL' ? 'SOL' : state.coins.find((c) => c.id === coin)?.ticker}
                </label>
                {format === 'Token' && (
                  <select
                    aria-label="Wager token"
                    className="text-input"
                    value={coin}
                    onChange={(e) => setCoin(e.target.value)}
                  >
                    {state.coins
                      .filter((c) => c.active)
                      .map((c) => (
                        <option value={c.id} key={c.id}>
                          {'$' + c.ticker}
                        </option>
                      ))}
                  </select>
                )}
                <input
                  id="battle-stake"
                  className="text-input"
                  type="number"
                  min=".0001"
                  step=".1"
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                />
              </>
            )}
            {format === 'Pokémon' && (
              <div className="notice wager-notice">
                <Icon name="Info" />
                <span>
                  The winner receives <strong>all {team.length || 'selected'} Pokémon</strong> from
                  the losing team. Starter Pokémon cannot be wagered.
                </span>
              </div>
            )}
            <div className="battle-review-art">
              <PokemonArt id={4} />
              <PokemonArt id={7} />
            </div>
            <p>
              {format === 'Friendly'
                ? 'No stakes. Your Pokémon stay in your inventory.'
                : 'Wager preview. No funds or Pokémon are transferred.'}
            </p>
            <Button
              className="full-width"
              disabled={!canReview}
              onClick={() => (format === 'Friendly' ? start() : setReview(true))}
            >
              {format === 'Friendly' ? 'Start battle' : 'Review wager preview'}
              <Icon name="Swords" size={17} />
            </Button>
            <small className="mini-note">Play against a practice rival.</small>
          </aside>
        </div>
        {review && (
          <Modal title="Review your stakes" onClose={() => setReview(false)}>
            <div className="modal-body">
              <div className="review-team">
                {chosen.map((p) => (
                  <div key={p.id}>
                    <PokemonArt id={p.speciesId} shiny={p.shiny} />
                    <strong>{pokemonById(p.speciesId).name}</strong>
                  </div>
                ))}
              </div>
              <h3>
                {format === 'Pokémon'
                  ? 'The entire selected team is at stake.'
                  : 'Each trainer stakes ' +
                    stake +
                    ' ' +
                    (format === 'SOL' ? 'SOL' : state.coins.find((c) => c.id === coin)?.ticker) +
                    '.'}
              </h3>
              <p>
                {format === 'Pokémon'
                  ? 'If you lose a live Pokémon wager, you lose all ' +
                    chosen.length +
                    ' selected Pokémon. Their total value is ' +
                    sol(chosen.reduce((n, p) => n + p.backing, 0)) +
                    ' SOL.'
                  : 'A live match would lock both stakes until the result is settled.'}
              </p>
              <div className="notice">
                <Icon name="Info" />
                This frontend simulates the match only. No assets are locked or transferred.
              </div>
              <Button className="full-width" onClick={start}>
                Start practice preview
                <Icon name="Swords" size={17} />
              </Button>
            </div>
          </Modal>
        )}
      </div>
    );
  return (
    <div className="battle-screen arena-lobby">
      <PageHeading
        title="Battle arena"
        description="Choose a match, select your party, and battle a practice rival."
      />
      <div className="arena-lobby-console">
        <section className="arena-hero">
          <div className="arena-room-label">BATTLE ROOM</div>
          <div className="arena-pixel-window window-left" />
          <div className="arena-pixel-window window-right" />
          <div className="arena-floor-mark" />
          <div className="arena-hero-art">
            <PokemonArt id={6} />
            <span>VS</span>
            <PokemonArt id={9} />
          </div>
          <div className="arena-room-dialogue">
            <Avatar profile={{ character: 'leaf', accessoryColor: '#65b883' }} size={62} />
            <div>
              <strong>LEAF</strong>
              <p>Ready for a battle? Bring your best team.</p>
            </div>
            <Button onClick={() => chooseFormat('Friendly')}>
              Battle
              <Icon name="ArrowRight" size={16} />
            </Button>
          </div>
        </section>
        <aside className="arena-game-menu">
          <div className="arena-menu-title">SELECT MATCH</div>
          {(
            [
              {
                name: 'Friendly',
                label: 'Friendly battle',
                note: 'Practice · no stakes',
                number: '01',
              },
              { name: 'SOL', label: 'SOL wager', note: 'Equal SOL stakes', number: '02' },
              {
                name: 'Token',
                label: 'Token wager',
                note: 'Choose a community token',
                number: '03',
              },
              {
                name: 'Pokémon',
                label: 'Pokémon wager',
                note: 'Winner takes the losing team',
                number: '04',
              },
            ] as const
          ).map((f) => (
            <button key={f.name} onClick={() => chooseFormat(f.name)} className="arena-menu-option">
              <span className="menu-cursor" aria-hidden="true">
                ▶
              </span>
              <span>
                <strong>{f.label}</strong>
                <small>{f.note}</small>
              </span>
              <span className="menu-option-number">{f.number}</span>
            </button>
          ))}
          <div className="arena-menu-foot">
            <Pokeball size={16} />
            <span>1–3 Pokémon per trainer</span>
          </div>
        </aside>
      </div>
      <section className="arena-party-bench">
        <div className="party-bench-heading">
          <h2>Your party</h2>
          <a href="#/pokemon">
            Manage Pokémon
            <Icon name="ArrowRight" size={15} />
          </a>
        </div>
        <div className="party-bench-roster">
          {available.slice(0, 6).map((p) => (
            <a href={'#/pokemon/' + p.id} key={p.id}>
              <PokemonArt id={p.speciesId} shiny={p.shiny} />
              <strong>{pokemonById(p.speciesId).name}</strong>
              <span>
                Lv. {p.level} · {getPokemonHealth(p).current}/{getPokemonHealth(p).max} HP
              </span>
            </a>
          ))}
        </div>
      </section>
      <p className="arena-practice-note">
        Friendly matches are playable in this preview. Wager matches use the same practice rules
        without locking assets.
      </p>
    </div>
  );
}
