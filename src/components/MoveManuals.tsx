import { useState } from 'react';
import { GYM_MANUALS, manualPool } from '../game/gym-policy';
import { moveByName } from '../data/moves';
import { useApp } from '../state/AppContext';
import { Icon, Modal, TypeChip } from './UI';
import { MoveInfoDialog } from './MovePreview';
export function ManualCatalogue({ strength, onClose }: { strength?: number; onClose: () => void }) {
  const { state } = useApp(),
    [query, setQuery] = useState(''),
    [filter, setFilter] = useState('All moves'),
    [info, setInfo] = useState<string | null>(null);
  const pool = strength === undefined ? GYM_MANUALS : manualPool(strength),
    owned = state.gymProgress?.manuals || {};
  const visible = pool.filter(
    (m) =>
      m.move.toLowerCase().includes(query.toLowerCase()) &&
      (filter !== 'Owned' || owned[m.move] > 0),
  );
  return (
    <Modal title="Move manuals" onClose={onClose} wide className="manual-catalogue-modal">
      <div className="manual-catalogue">
        <header>
          <p>
            {strength === undefined
              ? 'Discover all 30 manuals. Stronger gyms can drop rarer moves.'
              : 'Possible manual drops from this gym.'}{' '}
            Each manual teaches one Pokémon and is used up.
          </p>
          <div className="manual-catalogue-tools">
            <label className="small-search">
              <Icon name="Search" />
              <input
                aria-label="Search move manuals"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a move…"
              />
            </label>
            <select
              aria-label="Filter manuals"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option>All moves</option>
              <option>Owned</option>
            </select>
          </div>
        </header>
        <div className="manual-catalogue-grid">
          {visible.map((m) => {
            const move = moveByName(m.move);
            return (
              <article className="manual-catalogue-entry" key={m.move}>
                <span className={'manual-disc manual-' + move.type.toLowerCase()}>
                  <Icon name="BookOpen" size={26} />
                </span>
                <div>
                  <strong>{m.move}</strong>
                  <TypeChip type={move.type} />
                  <small>
                    {move.name === 'Dragon Rage'
                      ? '40 damage'
                      : move.name === 'Night Shade'
                        ? 'Damage = level'
                        : move.power
                          ? 'Power ' + move.power
                          : 'Status move'}{' '}
                    · {move.pp} PP
                  </small>
                  <small>
                    {m.minStrength === 1200
                      ? 'Challenger gyms'
                      : m.minStrength === 1800
                        ? 'Expert gyms'
                        : 'Master gyms'}
                    {owned[m.move] > 0 ? ' · Owned ×' + owned[m.move] : ''}
                  </small>
                </div>
                <button
                  className="move-info-button"
                  aria-label={'Preview ' + m.move}
                  onClick={() => setInfo(m.move)}
                >
                  <Icon name="Info" size={17} />
                </button>
              </article>
            );
          })}
          {!visible.length && (
            <p className="manual-empty">
              {filter === 'Owned'
                ? 'You don’t have any move manuals.'
                : 'This gym does not offer move manuals.'}
            </p>
          )}
        </div>
      </div>
      {info && (
        <MoveInfoDialog
          name={info}
          speciesId={state.pokemon.find((p) => p.id === state.profile.equippedId)?.speciesId || 25}
          onClose={() => setInfo(null)}
        />
      )}
    </Modal>
  );
}
