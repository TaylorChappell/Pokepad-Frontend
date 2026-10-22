import { useId } from 'react';
import { asset } from '../utils';

/** Scalable reward illustration using the current Kanto brand assets. */
export function PortfolioRewardsArt() {
  const id = useId();
  return (
    <svg
      className="portfolio-rewards-illustration"
      viewBox="0 0 250 215"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={id + '-foil'}
          x1="130"
          y1="35"
          x2="220"
          y2="193"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffe8ab" />
          <stop offset=".38" stopColor="#eabe61" />
          <stop offset=".56" stopColor="#ffefbb" />
          <stop offset="1" stopColor="#d6a34d" />
        </linearGradient>
        <radialGradient id={id + '-shell'} cx=".3" cy=".25" r=".85">
          <stop stopColor="#fffef5" />
          <stop offset=".65" stopColor="#f1ecd4" />
          <stop offset="1" stopColor="#d0d6ba" />
        </radialGradient>
        <clipPath id={id + '-egg'}>
          <path d="M111 143c0 29-17 48-42 48s-42-19-42-48 23-75 42-75 42 46 42 75Z" />
        </clipPath>
        <pattern id={id + '-crimp'} width="5" height="9" patternUnits="userSpaceOnUse">
          <path d="M2 0v9" stroke="#aa7b38" strokeOpacity=".5" />
        </pattern>
      </defs>
      <ellipse cx="130" cy="195" rx="105" ry="10" fill="#415d42" opacity=".11" />
      <g transform="rotate(-10 152 100)">
        <rect
          x="103"
          y="15"
          width="87"
          height="123"
          rx="9"
          fill="#edf4e9"
          stroke="#233e51"
          strokeWidth="3"
        />
        <rect
          x="110"
          y="22"
          width="73"
          height="109"
          rx="5"
          fill="#83ada5"
          stroke="#d8e9dd"
          strokeWidth="2"
        />
        <image href={asset('brand/kanto-emblem.png')} x="122" y="45" width="49" height="49" />
      </g>
      <g transform="rotate(9 175 114)">
        <rect
          x="122"
          y="37"
          width="102"
          height="152"
          rx="7"
          fill={'url(#' + id + '-foil)'}
          stroke="#94713f"
          strokeWidth="2.5"
        />
        <path d="M124 51h98M124 176h98" stroke="#b58c45" strokeWidth="2" />
        <path d="M128 40h91v10h-91zM128 177h91v9h-91z" fill={'url(#' + id + '-crimp)'} />
        <rect x="130" y="58" width="86" height="111" rx="5" fill="#19394d" />
        <path d="M130 64a6 6 0 0 1 6-6h74a6 6 0 0 1 6 6v36h-86Z" fill="#fbf1d6" />
        <image href={asset('brand/kanto-lockup.png')} x="132" y="64" width="82" height="30" />
        <circle cx="173" cy="130" r="24" stroke="#e6c477" strokeWidth="1.5" />
        <image href={asset('brand/kanto-emblem.png')} x="151" y="108" width="44" height="44" />
        <path d="M143 159h60" stroke="#6b8c8b" strokeWidth="2" strokeLinecap="round" />
        <path d="m130 61 27-3 59 91v16l-12 4Z" fill="white" opacity=".07" />
        <path d="M126 54v118" stroke="#fff5cf" strokeWidth="2" opacity=".6" />
      </g>
      <path
        d="M111 143c0 29-17 48-42 48s-42-19-42-48 23-75 42-75 42 46 42 75Z"
        fill={'url(#' + id + '-shell)'}
        stroke="#536d66"
        strokeWidth="3"
      />
      <g clipPath={'url(#' + id + '-egg)'} fill="#74b4a4">
        <path d="m58 72 17-2 7 13-6 13-17-2-8-13Z" />
        <path d="m27 117 17-5 12 13-4 17-19 5-9-14Z" />
        <path d="m87 111 17-4 12 14-8 15-17-2-9-13Z" />
        <path d="m62 153 17-5 12 12-4 15-18 6-12-13Z" />
        <path d="m30 169 14-5 9 15-8 15H30Z" />
      </g>
      <path
        d="M46 109c4-11 10-20 15-23"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        opacity=".8"
      />
      <path
        d="M42 156c4 17 14 25 28 26"
        stroke="#a7bca5"
        strokeWidth="3"
        strokeLinecap="round"
        opacity=".4"
      />
    </svg>
  );
}
