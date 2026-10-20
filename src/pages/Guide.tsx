import { useEffect, useState } from 'react';
import {
  Button,
  Icon,
  PageHeading,
  PokepadLogo,
  PokemonArt,
  EggArt,
  PackArt,
  RareCandyIcon,
} from '../components/UI';
const pages = [
  {
    title: 'Choose a coin. Start collecting.',
    variant: 'hold' as const,
    text: 'Each coin rewards its holders with eggs, packs, or both. Your balance and how long you hold without selling determine the reward tier you qualify for.',
    note: 'Half of collected creator fees funds the rewards. The other half goes to the creator.',
    link: '/discover',
    action: 'Explore coins',
  },
  {
    title: 'Hatch eggs. Open packs.',
    variant: 'rewards' as const,
    text: 'Packs open immediately. Eggs hatch when their timer finishes, and walking speeds them up. Better eggs take longer, with stronger chances of rare Pokémon.',
    note: 'Each reward comes from a funded pool. You can see its source coin and possible rewards before opening.',
    link: '/rewards',
    action: 'View rewards',
  },
  {
    title: 'Train, evolve, and battle.',
    variant: 'evolve' as const,
    text: 'Equip a Pokémon to collect Rare Candy from active coin holdings. Evolving increases its SOL value when the reward pool funds the increase. New moves arrive as learn-or-skip prompts.',
    note: 'Trade your Pokémon, support a gym, or battle with up to three. Pokémon wagers put your whole selected team at stake.',
    link: '/pokemon',
    action: 'View Pokémon',
  },
];
export function GuideManual({ embedded = false }: { embedded?: boolean }) {
  const [page, setPage] = useState(0),
    entry = pages[page];
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.matches('input,textarea,select')) return;
      if (e.key === 'ArrowRight') setPage((p) => Math.min(2, p + 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(0, p - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <div className={'trainer-manual ' + (embedded ? 'embedded' : '')}>
      <div className="manual-binding">
        <PokepadLogo size={22} />
        <strong>Your trainer handbook</strong>
        <span>{page + 1} of 3</span>
      </div>
      <div key={page} className="manual-leaf">
        <div className="manual-picture">
          <div className={'handbook-art handbook-' + entry.variant}>
            <div className="handbook-art-orbit" aria-hidden="true" />
            {page === 0 ? (
              <>
                <PokemonArt
                  id={25}
                  animated={false}
                  styleOverride="drawn"
                  className="handbook-pikachu"
                />
                <div className="handbook-token">
                  <PokepadLogo size={44} />
                  <strong>POKE</strong>
                </div>
                <span className="handbook-art-label">Find a community you like.</span>
              </>
            ) : page === 1 ? (
              <>
                <EggArt tier="Rare" />
                <PackArt tier="Rare" />
                <span className="handbook-art-label">A surprise in every reward.</span>
              </>
            ) : (
              <>
                <PokemonArt
                  id={4}
                  animated={false}
                  styleOverride="drawn"
                  className="handbook-before"
                />
                <span className="handbook-evolve-arrow">
                  <RareCandyIcon size={40} />
                  <Icon name="ArrowRight" size={28} />
                </span>
                <PokemonArt
                  id={5}
                  animated={false}
                  styleOverride="drawn"
                  className="handbook-after"
                />
                <span className="handbook-art-label">Grow together.</span>
              </>
            )}
          </div>
        </div>
        <div className="manual-writing">
          <span className="manual-section-tag">{['Collect', 'Discover', 'Train'][page]}</span>
          <h2>{entry.title}</h2>
          <p>{entry.text}</p>
          <aside>{entry.note}</aside>
          <a className="text-link" href={'#' + entry.link}>
            {entry.action}
            <Icon name="ArrowRight" size={16} />
          </a>
        </div>
      </div>
      <div className="manual-controls">
        <Button
          variant="secondary"
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
          aria-label="Previous handbook page"
        >
          <Icon name="ArrowLeft" size={16} />
          Back
        </Button>
        <div className="manual-page-tabs">
          {pages.map((p, i) => (
            <button
              key={p.title}
              aria-label={'Handbook page ' + (i + 1)}
              aria-current={i === page ? 'page' : undefined}
              className={i === page ? 'active' : ''}
              onClick={() => setPage(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          disabled={page === 2}
          onClick={() => setPage((p) => p + 1)}
          aria-label="Next handbook page"
        >
          Next
          <Icon name="ArrowRight" size={16} />
        </Button>
      </div>
    </div>
  );
}
export function GuidePage() {
  return (
    <>
      <a href="#/discover" className="button secondary back-button">
        <Icon name="ArrowLeft" size={16} />
        Back to Discover
      </a>
      <PageHeading title="Trainer handbook" />
      <GuideManual />
    </>
  );
}
