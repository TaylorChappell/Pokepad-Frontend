import { useId } from 'react';
import { Avatar, EggArt, PackArt, PokemonArt, RareCandyIcon } from './UI';
import { useApp } from '../state/AppContext';
function Tree({ x, y }: { x: number; y: number }) {
  return (
    <g transform={'translate(' + x + ' ' + y + ')'}>
      <path d="M8 39h28v7H8z" fill="#7d9b5f" />
      <path d="M19 27h7v18h-7z" fill="#8d7852" />
      <path d="M12 0h19v5h8v7h5v20h-6v7H5v-7H0V12h5V5h7z" fill="#467650" />
      <path d="M12 3h16v5h9v10h3v10h-8v5H9v-5H4V14h5V7h3z" fill="#6e9f59" />
      <path d="M13 6h13v5H13zM8 13h15v5H8zM12 19h7v4h-7z" fill="#94bd6b" />
      <path d="M28 20h9v8h-9zM20 29h12v4H20z" fill="#578a4c" />
    </g>
  );
}
function House({
  x,
  y,
  label,
  blue = false,
}: {
  x: number;
  y: number;
  label: string;
  blue?: boolean;
}) {
  return (
    <g transform={'translate(' + x + ' ' + y + ')'}>
      <path d="M2 70h116v10H2z" fill="#72965d" />
      <path d="M8 28h104v42H8z" fill="#f6e9bb" />
      <path d="M8 64h104v9H8zM8 28h7v36H8zM105 28h7v36h-7z" fill="#c1ad83" />
      <path d="M14 0h92v6h7v7h7v26H0V13h7V6h7z" fill={blue ? '#477aa5' : '#a74943'} />
      <path d="M14 5h92v6h7v7h3v13H4V18h3v-7h7z" fill={blue ? '#71a3bc' : '#dc7056'} />
      <path
        d="M9 14h100v3H9zM4 23h112v3H4zM20 5v25m20-25v25m20-25v25m20-25v25m20-25v25"
        stroke={blue ? '#548aa8' : '#ba584a'}
        strokeWidth="2"
      />
      <path d="M44 43h31v30H44z" fill="#4c6160" />
      <path d="M49 47h21v26H49z" fill="#76a4a3" />
      <path d="M58 47h3v26H58zM17 44h19v15H17zM84 44h18v15H84z" fill="#426168" />
      <path d="M20 47h13v9H20zM87 47h12v9H87z" fill="#9fc5bd" />
      <path d="M42 72h35v6H42z" fill="#d3c698" />
      <path d="M35 30h51v13H35z" fill="#f7eed4" stroke="#6b6d59" strokeWidth="2" />
      <text
        x="60"
        y="39"
        textAnchor="middle"
        fontSize="7"
        fontFamily="monospace"
        fontWeight="bold"
        fill="#5c675e"
      >
        {label}
      </text>
    </g>
  );
}
export function PixelWorld({
  variant = 'home',
  pokemonId = 25,
}: {
  variant?: 'home' | 'hold' | 'rewards' | 'evolve';
  pokemonId?: number;
}) {
  const id = useId().replaceAll(':', ''),
    { state } = useApp();
  return (
    <div
      className={'pixel-world world-' + variant}
      role="img"
      aria-label={
        variant === 'home'
          ? 'A Pokémon town with a trading post, gym, trainer, and Pokémon'
          : variant === 'hold'
            ? 'A trainer visiting the coin trading post'
            : variant === 'rewards'
              ? 'Egg incubators and packs beside a walking route'
              : 'Eevee evolving and a Pokémon battle'
      }
    >
      <svg
        className="world-map"
        viewBox="0 0 760 310"
        preserveAspectRatio="xMidYMid slice"
        shapeRendering="crispEdges"
        aria-hidden="true"
      >
        <defs>
          <pattern id={id + 'grass'} width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#b7ce89" />
            <path d="M3 5h2v2H3zM5 3h2v2H5zM15 16h2v2h-2zM17 14h2v2h-2z" fill="#98b879" />
          </pattern>
          <pattern id={id + 'roof'} width="15" height="10" patternUnits="userSpaceOnUse">
            <rect width="15" height="10" fill="#c78464" />
            <path d="M0 8h15M13 0v8" stroke="#a4604e" strokeWidth="2" />
          </pattern>
          <pattern id={id + 'water'} width="40" height="20" patternUnits="userSpaceOnUse">
            <rect width="40" height="20" fill="#78b7c3" />
            <path d="M5 7h12M26 15h10" stroke="#b0d5cb" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="760" height="310" fill={'url(#' + id + 'grass)'} />
        <path
          d="M0 250H166V180H360V215H525V120H760"
          stroke="#a3ac75"
          strokeWidth="61"
          fill="none"
        />
        <path
          d="M0 250H166V180H360V215H525V120H760"
          stroke="#eadfb4"
          strokeWidth="51"
          fill="none"
        />
        <path
          d="M0 257H166V187H360V222H525V127H760"
          stroke="#d6c99c"
          strokeWidth="2"
          strokeDasharray="5 18"
          fill="none"
        />
        <path d="M592 310V245h20v-20h34v-16h114v101z" fill="#6fa7a3" />
        <path d="M600 310v-60h20v-17h32v-16h108v93z" fill={'url(#' + id + 'water)'} />
        <House x={99} y={64} label="TRADE" />
        <House x={450} y={15} label="GYM" blue />
        <path d="M255 115h72v37h-72z" fill="#91ad6c" />
        <path d="M259 119h64v29h-64z" fill="#dfbd67" />
        {[0, 1, 2, 3].map((n) => (
          <g key={n}>
            <path d={'M' + (263 + n * 15) + ' 121v23'} stroke="#6c9c59" strokeWidth="6" />
            <rect x={261 + n * 15} y={123 + (n % 2) * 8} width="6" height="5" fill="#f1df93" />
          </g>
        ))}
        {[
          [18, 17],
          [66, 18],
          [17, 63],
          [668, 27],
          [715, 27],
          [677, 68],
          [708, 153],
          [8, 139],
          [51, 138],
          [218, 252],
          [268, 267],
          [315, 263],
          [386, 23],
          [347, 17],
        ].map(([x, y], i) => (
          <Tree x={x} y={y} key={i} />
        ))}
        <g fill="#799f5c">
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={'M' + (28 + i * 23) + ' 290v-7h4v5h4v-4h4v6z'} />
          ))}
        </g>
        <g fill="#e68168">
          <path d="M64 219h5v5h-5zM60 223h13v5H60zM65 229h5v4h-5z" />
          <path d="M415 264h5v5h-5zM411 268h13v5h-13zM416 274h5v4h-5z" />
        </g>
        <path d="M613 96h30v5h-30zM623 101h5v19h-5z" fill="#7c735a" />
        <path d="M616 87h24v13h-24z" fill="#f8e9b7" stroke="#7c735a" strokeWidth="2" />
        <path d="M621 92h13v2h-13z" fill="#8b956a" />
      </svg>
      <div className="world-trainer">
        <Avatar profile={state.profile} size={64} />
      </div>
      {variant === 'home' || variant === 'hold' ? (
        <>
          <PokemonArt id={pokemonId} className="world-pokemon one" />
          <PokemonArt id={1} className="world-pokemon two" />
          <PokemonArt id={7} className="world-pokemon three" />
          <span className="world-sign">KANTO • ROUTE 01</span>
        </>
      ) : variant === 'rewards' ? (
        <>
          <div className="world-incubators">
            <EggArt />
            <EggArt tier="Rare" />
            <EggArt tier="Epic" />
          </div>
          <div className="world-pack">
            <PackArt />
          </div>
          <PokemonArt id={25} className="world-pokemon three" />
          <span className="world-sign">DAY CARE</span>
        </>
      ) : (
        <>
          <PokemonArt id={133} className="world-evolve before" />
          <PokemonArt id={134} className="world-evolve after" />
          <div className="world-candy">
            <RareCandyIcon size={50} />
          </div>
          <PokemonArt id={6} className="world-battle left" />
          <PokemonArt id={9} className="world-battle right" />
          <span className="world-sign">POKéMON LEAGUE</span>
        </>
      )}
    </div>
  );
}
