import { useEffect, useState } from 'react';
import { useApp } from '../state/AppContext';
import type { useOnlineBattle } from './OnlineBattle';
import { BattleTeamPicker } from './BattleTeamPicker';
import { Button, Icon, PokemonArt, TypeChip } from './UI';
import { pokemonById } from '../data/pokemon';
import { teamStrength, type Fighter } from '../battle/engine';
import type { BattleRules } from '../battle/rules';
import { battleWagerLabel, formatRawAmount, type BattleRoom } from '../services/battles';
import { decimalToRaw } from '../services/transactions';

export function BattleRoomReview({
  room,
  online,
}: {
  room: BattleRoom;
  online: ReturnType<typeof useOnlineBattle>;
}) {
  const { state, now } = useApp();
  const review = room.review!;
  const [tab, setTab] = useState<'review' | 'team' | 'rules' | 'chat'>('review');
  const [ids, setIds] = useState(room.yourPokemonIds);
  const [rules, setRules] = useState<BattleRules>(review.rules);
  const [amount, setAmount] = useState(
    room.wagerAmount && room.wagerDecimals !== null && room.wagerDecimals !== undefined
      ? formatRawAmount(room.wagerAmount, room.wagerDecimals)
      : '',
  );
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [detail, setDetail] = useState<Fighter | null>(null);
  const [localError, setLocalError] = useState('');
  useEffect(() => {
    setConfirmed(false);
    setIds(room.yourPokemonIds);
    setRules(review.rules);
    setAmount(
      room.wagerAmount && typeof room.wagerDecimals === 'number'
        ? formatRawAmount(room.wagerAmount, room.wagerDecimals)
        : '',
    );
    setDetail(null);
  }, [review.version]);
  const own = review.teams.find((team) => team.seat === room.yourSeat)!;
  const other = review.teams.find((team) => team.seat !== room.yourSeat)!;
  const strength =
    own && other
      ? Math.round((teamStrength(other.pokemon) / Math.max(1, teamStrength(own.pokemon))) * 100)
      : 100;
  const monetary = room.wager === 'sol' || room.wager === 'token';
  const submitRules = async () => {
    try {
      setLocalError('');
      const wagerAmount = monetary ? decimalToRaw(amount, room.wagerDecimals!) : undefined;
      if (await online.propose(review.version, { rules, ...(wagerAmount ? { wagerAmount } : {}) }))
        setTab('review');
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Check the proposed rules.');
    }
  };
  return (
    <section className="battle-room-review" aria-label="Review battle terms">
      <header className="battle-review-heading">
        <div>
          <span>LINK ROOM · REVIEW {review.version}</span>
          <h2>Meet your rival</h2>
          <p>
            Review both teams. Agree the rules. Then accept.
            {room.deadlineAt &&
              ` · ${Math.max(0, Math.ceil((Date.parse(room.deadlineAt) - now - (online.clockOffset || 0)) / 1000))}s remaining`}
          </p>
        </div>
        <div className="battle-review-stake">
          <strong>{battleWagerLabel(room)}</strong>
          <small>
            {monetary
              ? 'Each trainer’s stake'
              : room.wager === 'pokemon'
                ? 'Your selected team is at stake'
                : 'No wager'}
          </small>
        </div>
      </header>
      <nav className="battle-review-tabs" aria-label="Room preparation">
        {(['review', 'team', 'rules', 'chat'] as const).map((value) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value);
              setDetail(null);
            }}
          >
            {
              { review: 'Matchup', team: 'Your team', rules: 'Propose rules', chat: 'Room chat' }[
                value
              ]
            }
            {value === 'chat' && review.messages.length > 0 && <b>{review.messages.length}</b>}
          </button>
        ))}
      </nav>
      <div className="battle-review-content">
        {tab === 'review' && (
          <>
            <div className="battle-review-rule-strip">
              <span>
                {review.rules.levels === 'level50' ? 'All Pokémon at Lv. 50' : 'Original levels'}
              </span>
              <span>
                {review.rules.items === 'standard'
                  ? 'Each: 2 Potions · 1 Revive · 1 Full Heal'
                  : 'Items disabled'}
              </span>
              <span>60s per turn</span>
            </div>
            {detail ? (
              <div className="battle-review-detail">
                <button onClick={() => setDetail(null)}>
                  <Icon name="ArrowLeft" size={16} />
                  Back to teams
                </button>
                <PokemonArt id={detail.speciesId} shiny={detail.shiny} animated={false} />
                <h3>
                  {pokemonById(detail.speciesId).name} · Lv. {detail.level}
                </h3>
                <div>
                  {pokemonById(detail.speciesId).types.map((type) => (
                    <TypeChip key={type} type={type} />
                  ))}
                </div>
                <dl>
                  {Object.entries(detail.stats).map(([name, value]) => (
                    <div key={name}>
                      <dt>
                        {(
                          {
                            hp: 'HP',
                            attack: 'Attack',
                            defense: 'Defence',
                            specialAttack: 'Sp. Attack',
                            specialDefense: 'Sp. Defence',
                            speed: 'Speed',
                          } as Record<string, string>
                        )[name] || name}
                      </dt>
                      <dd>
                        {name === 'hp' ? detail.hp + '/' : ''}
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p>{detail.moves.join(' · ')}</p>
              </div>
            ) : (
              <div className="battle-review-teams">
                {[own, other].filter(Boolean).map((team) => (
                  <article key={team.wallet}>
                    <header>
                      <div>
                        <strong>
                          {room.trainers.find((trainer) => trainer.wallet === team.wallet)
                            ?.displayName || 'Trainer'}
                        </strong>
                        <small>{team.seat === room.yourSeat ? 'Your team' : 'Rival team'}</small>
                      </div>
                      <span className={team.accepted ? 'accepted' : ''}>
                        {team.accepted ? 'Accepted' : 'Reviewing'}
                      </span>
                    </header>
                    <div>
                      {team.pokemon.map((pokemon) => (
                        <button
                          key={pokemon.id}
                          onClick={() => setDetail(pokemon)}
                          aria-label={'Inspect ' + pokemonById(pokemon.speciesId).name}
                        >
                          <PokemonArt
                            id={pokemon.speciesId}
                            shiny={pokemon.shiny}
                            animated={false}
                          />
                          <strong>{pokemonById(pokemon.speciesId).name}</strong>
                          <small>
                            Lv. {pokemon.level} · {pokemon.hp}/{pokemon.stats.hp} HP
                          </small>
                          <span>{pokemon.moves.join(' · ')}</span>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            )}
            <p className="battle-strength-note">
              Rival’s total stats: <b>{strength}% of yours</b>. Types and moves also matter; this is
              not a win prediction.
            </p>
          </>
        )}
        {tab === 'team' && (
          <div className="battle-review-team-editor">
            <BattleTeamPicker
              pokemon={state.pokemon.map((pokemon) =>
                room.yourPokemonIds.includes(pokemon.id) ? { ...pokemon, locked: false } : pokemon,
              )}
              selected={ids}
              onChange={setIds}
              teamSize={room.teamSize}
              pokemonWager={room.wager === 'pokemon'}
              disabled={online.pending}
            />
            <Button
              disabled={online.pending || ids.length !== room.teamSize}
              onClick={async () => {
                if (await online.propose(review.version, { pokemonIds: ids })) setTab('review');
              }}
            >
              Propose this team
            </Button>
          </div>
        )}
        {tab === 'rules' && (
          <div className="battle-review-rules">
            <label>
              Pokémon levels
              <select
                value={rules.levels}
                onChange={(event) =>
                  setRules({ ...rules, levels: event.target.value as BattleRules['levels'] })
                }
              >
                <option value="original">Original levels</option>
                <option value="level50">Equal levels · Lv. 50</option>
              </select>
            </label>
            <label>
              Battle bag
              <select
                value={rules.items}
                onChange={(event) =>
                  setRules({ ...rules, items: event.target.value as BattleRules['items'] })
                }
              >
                <option value="standard">Equal bag · 2 Potions, 1 Revive, 1 Full Heal each</option>
                <option value="none">No items</option>
              </select>
            </label>
            <p>
              Both trainers receive identical match supplies. Personal inventories cannot add extra
              items. Each item takes a turn; unused supplies expire with the match.
            </p>
            {monetary && (
              <label>
                Stake per trainer ({room.wagerSymbol || 'SOL'})
                <input
                  value={amount}
                  inputMode="decimal"
                  onChange={(event) => setAmount(event.target.value)}
                />
              </label>
            )}
            <p>
              Any change clears both acceptances. The wager type and team size stay fixed for this
              room.
            </p>
            <Button disabled={online.pending} onClick={() => void submitRules()}>
              Propose changes
            </Button>
          </div>
        )}
        {tab === 'chat' && (
          <div className="battle-room-chat">
            <div className="battle-room-messages" role="log" aria-label="Room discussion">
              {review.messages.length === 0 ? (
                <p>Discuss teams or rules here before accepting.</p>
              ) : (
                review.messages.map((entry) => (
                  <p key={entry.id}>
                    <strong>
                      {room.trainers.find((trainer) => trainer.wallet === entry.wallet)
                        ?.displayName || 'Trainer'}
                    </strong>
                    <span>{entry.body}</span>
                  </p>
                ))
              )}
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (message.trim() && (await online.message(message.trim()))) setMessage('');
              }}
            >
              <input
                aria-label="Message to your rival"
                placeholder="Suggest a change…"
                value={message}
                maxLength={280}
                onChange={(event) => setMessage(event.target.value)}
              />
              <Button disabled={online.pending || !message.trim()} type="submit">
                Send
              </Button>
            </form>
          </div>
        )}
      </div>
      {(online.error || localError) && (
        <p className="online-error" role="alert">
          {localError || online.error}
        </p>
      )}
      <footer className="battle-review-footer">
        <div>
          {own?.accepted ? (
            <p>You accepted review {review.version}. Waiting for your rival.</p>
          ) : (
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I reviewed both teams, the item limits and{' '}
              {room.wager === 'friendly'
                ? 'the rules'
                : room.wager === 'pokemon'
                  ? 'the full team I can lose'
                  : 'my ' + battleWagerLabel(room) + ' stake'}
              .
            </label>
          )}
          <small>
            {monetary
              ? 'Deposits become available only after both accept.'
              : 'The battle starts only after both trainers accept.'}{' '}
            Leaving now costs nothing.
          </small>
        </div>
        <div>
          <Button variant="ghost" disabled={online.pending} onClick={() => void online.leave()}>
            Leave room
          </Button>
          <Button
            disabled={online.pending || (!confirmed && !own?.accepted) || !online.connected}
            onClick={() => void online.ready(review.version, !own?.accepted)}
          >
            {own?.accepted ? 'Undo acceptance' : 'Accept battle'}
          </Button>
        </div>
      </footer>
    </section>
  );
}
