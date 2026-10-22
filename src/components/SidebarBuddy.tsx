import { useEffect, useRef, useState } from 'react';
import { useApp } from '../state/AppContext';
import { pokemonById } from '../data/pokemon';
import { PokemonArt, RareCandyIcon } from './UI';
export function SidebarBuddy({ path }: { path: string }) {
  const { state, mode, session } = useApp(),
    partner = state.pokemon.find((p) => p.id === state.profile.equippedId),
    [reaction, setReaction] = useState('idle'),
    [message, setMessage] = useState(''),
    [tip, setTip] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined),
    previous = useRef(state.activity[0]?.id);
  const tips = [
    'Walking speeds up every incubating egg.',
    'Check your PC for a Pokémon with a new move.',
    'Your Pokédex keeps every discovery.',
    'Support one gym with your current collection.',
    'Packs can be opened whenever you want.',
  ];
  const react = (text: string, mood = 'happy') => {
    clearTimeout(timer.current);
    setMessage(text);
    setReaction(mood);
    timer.current = setTimeout(() => {
      setReaction('idle');
      setMessage('');
    }, 4200);
  };
  useEffect(() => {
    if (state.activity[0]?.id !== previous.current) {
      previous.current = state.activity[0]?.id;
      const kind = state.activity[0]?.kind;
      if (kind === 'reward') react('A new Pokémon! Check your PC.', 'celebrate');
      else if (kind === 'evolve') react('Evolution complete!', 'celebrate');
      else if (kind === 'gym') react('We’re on a new team!', 'happy');
    }
  }, [state.activity[0]?.id]);
  useEffect(() => {
    const t = setInterval(() => setTip((n) => (n + 1) % tips.length), 22000);
    return () => {
      clearInterval(t);
      clearTimeout(timer.current);
    };
  }, []);
  if (
    !partner ||
    (mode === 'live' &&
      (session.status !== 'authenticated' || session.wallet !== state.profile.wallet))
  )
    return null;
  const name = pokemonById(partner.speciesId).name;
  return (
    <section className={'sidebar-buddy buddy-v2 mood-' + reaction}>
      <div className="buddy-dialogue" aria-live="polite">
        {message || (path === '/walk' ? 'Ready when you are. Let’s walk!' : tips[tip])}
        <span className="dialogue-cursor" />
      </div>
      <button
        className="buddy-pet"
        aria-label={'Pet ' + name}
        onClick={() => react(name + ' liked that!', 'petted')}
        title={'Pet ' + name}
      >
        <PokemonArt id={partner.speciesId} shiny={partner.shiny} styleOverride="pixel" eager />
        {reaction === 'petted' && (
          <span className="pet-hearts" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        )}
        <span className="buddy-shadow" />
      </button>
      <a className="buddy-name" href={'#/pokemon/' + partner.id}>
        {name}
        <span>Lv. {partner.level}</span>
      </a>
      <div className="buddy-candy">
        <RareCandyIcon size={18} />
        {partner.rareCandy.toLocaleString()}
        <small>Rare Candy</small>
      </div>
    </section>
  );
}
