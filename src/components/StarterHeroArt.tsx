import { useId } from 'react';
import { asset } from '../utils';

/** A single responsive scene, using the same original artwork as the collection. */
export function StarterHeroArt() {
  const id = 'starter-scene-' + useId().replace(/:/g, '');
  return (
    <svg
      className="kanto-starter-hero-art"
      viewBox="0 0 720 350"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Bulbasaur, Charmander and Squirtle beside a Pokémon egg and unopened reward packs"
    >
      <defs>
        <linearGradient id={id + '-platform'} x2="0" y2="1">
          <stop stopColor="#f4faff" />
          <stop offset="1" stopColor="#d4e6f6" />
        </linearGradient>
        <linearGradient id={id + '-egg'} x1="0" y1="0" x2="1" y2=".8">
          <stop stopColor="#fffef5" />
          <stop offset=".5" stopColor="#f6f5df" />
          <stop offset="1" stopColor="#d8dec4" />
        </linearGradient>
        <linearGradient id={id + '-red'} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#ffb3a5" />
          <stop offset=".3" stopColor="#f8756c" />
          <stop offset=".65" stopColor="#e95754" />
          <stop offset="1" stopColor="#b83a46" />
        </linearGradient>
        <linearGradient id={id + '-blue'} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#b2e5ff" />
          <stop offset=".35" stopColor="#69b6e3" />
          <stop offset=".7" stopColor="#418fc0" />
          <stop offset="1" stopColor="#286693" />
        </linearGradient>
        <linearGradient id={id + '-foil'} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#fff" stopOpacity=".6" />
          <stop offset=".45" stopColor="#fff" stopOpacity=".04" />
          <stop offset=".65" stopColor="#fff" stopOpacity=".24" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id + '-egg-clip'}>
          <path d="M70 8C43 8 16 66 12 111C7 155 29 179 70 179S133 155 128 111C124 66 97 8 70 8Z" />
        </clipPath>
        <filter id={id + '-shadow'} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <g id={id + '-pack-ball'}>
          <circle r="26" fill="#fffaf0" stroke="#304359" strokeWidth="3" />
          <path d="M-25 0a25 25 0 0 1 50 0Z" fill="#f57b70" />
          <path d="M-25 0h50" stroke="#304359" strokeWidth="4" />
          <circle r="9" fill="#fffef7" stroke="#304359" strokeWidth="3" />
          <circle r="4" fill="#edf2f5" />
        </g>
      </defs>

      <circle cx="351" cy="167" r="139" fill="#dfedfa" opacity=".62" />
      <ellipse
        cx="361"
        cy="317"
        rx="325"
        ry="17"
        fill="#adc9e0"
        opacity=".22"
        filter={'url(#' + id + '-shadow)'}
      />
      <path d="M31 293v12c0 20 148 33 330 33s328-13 328-33v-12Z" fill="#c8deef" />
      <ellipse cx="360" cy="294" rx="329" ry="29" fill={'url(#' + id + '-platform)'} />
      <g fill="#7794aa" opacity=".2" filter={'url(#' + id + '-shadow)'}>
        <ellipse cx="118" cy="292" rx="51" ry="9" />
        <ellipse cx="317" cy="288" rx="90" ry="10" />
        <ellipse cx="449" cy="297" rx="61" ry="10" />
        <ellipse cx="605" cy="292" rx="64" ry="9" />
      </g>

      <g transform="translate(550 112) rotate(10 65 90)">
        <rect
          x="33"
          y="-11"
          width="93"
          height="175"
          rx="3"
          fill={'url(#' + id + '-blue)'}
          stroke="#406784"
          strokeWidth="2"
        />
        <path d="M36 0h87M36 152h87" stroke="#d3effc" strokeWidth="7" opacity=".65" />
        <path
          d="M40-6v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m-72 143v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12"
          stroke="#427fa7"
          strokeWidth="1.4"
          opacity=".7"
        />
        <use href={'#' + id + '-pack-ball'} transform="translate(79 79)" />
        <path d="M37 8h33L48 145H37Z" fill={'url(#' + id + '-foil)'} />
      </g>
      <g transform="translate(541 129) rotate(13 49 88)">
        <rect
          width="93"
          height="173"
          rx="3"
          fill={'url(#' + id + '-red)'}
          stroke="#a85960"
          strokeWidth="2"
        />
        <path d="M3 10h87M3 162h87" stroke="#ffdad0" strokeWidth="7" opacity=".65" />
        <path
          d="M8 4v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m8-10v10m-72 142v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12m8-12v12"
          stroke="#c7696b"
          strokeWidth="1.4"
          opacity=".7"
        />
        <use href={'#' + id + '-pack-ball'} transform="translate(46 86)" />
        <path d="M4 18h35L15 151H4Z" fill={'url(#' + id + '-foil)'} />
        <path d="m85 24-7 49 6 36-8 42" fill="none" stroke="#ffd0c6" strokeWidth="2" opacity=".4" />
      </g>

      <g transform="translate(46 133) rotate(-10 70 90) scale(.91)">
        <path
          d="M70 8C43 8 16 66 12 111C7 155 29 179 70 179S133 155 128 111C124 66 97 8 70 8Z"
          fill={'url(#' + id + '-egg)'}
          stroke="#7e8b77"
          strokeWidth="2"
        />
        <g clipPath={'url(#' + id + '-egg-clip)'} fill="#a7bf7f">
          <ellipse cx="31" cy="92" rx="25" ry="30" transform="rotate(-19 31 92)" />
          <ellipse cx="97" cy="62" rx="13" ry="15" transform="rotate(18 97 62)" />
          <ellipse cx="94" cy="152" rx="24" ry="30" transform="rotate(24 94 152)" />
          <ellipse cx="22" cy="157" rx="15" ry="12" />
        </g>
        <path
          d="M63 22c-12 5-23 18-29 33"
          fill="none"
          stroke="#fff"
          strokeWidth="8"
          strokeLinecap="round"
          opacity=".7"
        />
        <path d="m96 111-9 8 8 9-6 7" fill="none" stroke="#aeb79f" strokeWidth="1.6" />
      </g>
      <g fill="#f7f8e9" stroke="#96a58e" strokeWidth="1.3" strokeLinejoin="round">
        <path d="m64 293 6-11 8 5 4 10-12 2Z" />
        <path d="m147 299 8-7 7 4 3 6-11 1Z" />
        <path d="m92 307 5-6 9 6-7 3Z" />
      </g>

      <image href={asset('pokemon/4.png')} x="240" y="32" width="251" height="251" />
      <image href={asset('pokemon/1.png')} x="159" y="156" width="218" height="163" />
      <image href={asset('pokemon/7.png')} x="419" y="145" width="181" height="181" />

      <g stroke="#f3cc52" strokeWidth="4" strokeLinecap="round" opacity=".85">
        <path d="m87 126-7-8m21 4-2-12m546-11 3-12m9 18 8-5" />
      </g>
    </svg>
  );
}
