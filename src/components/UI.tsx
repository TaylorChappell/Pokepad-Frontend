import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type CSSProperties,
} from 'react';
import type { Coin, Profile, RewardMode } from '../types';
import { pokemonById } from '../data/pokemon';
import { asset, sol } from '../utils';
import { PIXEL_ICONS } from '../data/icons';
import { SPRITES } from '../data/sprites';
import { ART_BOUNDS } from '../data/art-bounds';
import { useOptionalApp } from '../state/AppContext';
export type IconName = keyof typeof PIXEL_ICONS | 'Pokeball';
export function Icon({
  name,
  size = 18,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  if (name === 'Sparkles') return null;
  if (name === 'Pokeball')
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={'pokeball-icon ' + className}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h6m6 0h6" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  if (name === 'Bell')
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={'notification-bell ' + className}
        aria-hidden="true"
      >
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4M12 2V1" />
      </svg>
    );
  if (name === 'Egg')
    return (
      <img
        className={'pixel-item ui-item ' + className}
        width={size}
        height={size}
        src={asset('pixel/egg.png')}
        alt=""
        aria-hidden="true"
      />
    );
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={'pixel-icon ' + className}
      aria-hidden="true"
      shapeRendering="crispEdges"
    >
      <path d={PIXEL_ICONS[name]} />
    </svg>
  );
}
export function PokepadLogo({ size = 38 }: { size?: number }) {
  return (
    <img
      src={asset('brand/pokepad.svg')}
      className="pokepad-logo"
      alt=""
      width={size}
      height={size}
    />
  );
}
export function Wordmark() {
  return (
    <span className="pokemon-wordmark" aria-label="POKEPAD">
      <span aria-hidden="true" className="wordmark-solid">
        POKÉPAD
      </span>
    </span>
  );
}
export function RareCandyIcon({ size = 24 }: { size?: number }) {
  return (
    <img
      src={asset('pixel/rare-candy.png')}
      width={size}
      height={size}
      alt="Rare Candy"
      className="pixel-item rare-candy-icon"
    />
  );
}
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'yellow' | 'danger';
}) {
  return (
    <button className={'button ' + variant + ' ' + className} {...props}>
      {children}
    </button>
  );
}
export function Pokeball({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      className={'pokeball ' + className}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <path d="M5 1h6v1h2v2h1v2h1v4h-1v2h-1v2h-2v1H5v-1H3v-2H2v-2H1V6h1V4h1V2h2z" fill="#30434c" />
      <path d="M5 2h6v1h2v3h1v4h-1v2h-2v2H5v-1H3v-3H2V6h1V4h2z" fill="#fff6df" />
      <path d="M5 2h6v1h2v3h1v1H2V6h1V4h2z" fill="#e95e55" />
      <path d="M2 7h12v2H2zM6 5h4v1h1v4h-1v1H6v-1H5V6h1z" fill="#30434c" />
      <path d="M7 6h2v1h1v2H9v1H7V9H6V7h1z" fill="#fff6df" />
      <path d="M4 4h3v1H4z" fill="#ffaaa0" />
    </svg>
  );
}
export function PokemonArt({
  id,
  className = '',
  back = false,
  eager = false,
  styleOverride,
  animated = true,
  shiny = false,
  frameFill,
}: {
  id: number;
  className?: string;
  back?: boolean;
  eager?: boolean;
  styleOverride?: 'pixel' | 'drawn';
  animated?: boolean;
  shiny?: boolean;
  /** Percentage occupied by the complete silhouette; useful for uniform thumbnails. */
  frameFill?: number;
}) {
  const app = useOptionalApp(),
    style = styleOverride || app?.state.profile.artStyle || 'pixel',
    ref = useRef<HTMLSpanElement>(null),
    [visible, setVisible] = useState(eager);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '120px',
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [style]);
  const sprite = SPRITES[id] || SPRITES[1],
    moving =
      animated && !shiny && !app?.state.profile.reducedMotion && visible && sprite.frames > 1;
  const bounds = ART_BOUNDS[id] || ART_BOUNDS[1];
  const box = shiny ? bounds.shiny : moving ? bounds.animated : bounds.static;
  const span = Math.max(box[2] - box[0], box[3] - box[1]);
  // Normalize transparent source canvases, using every animation frame's union.
  // The whole silhouette fits inside the art window, including wings and tails.
  const fit = frameFill ?? (id === 146 ? 80 : 88);
  const canvas = shiny ? bounds.shinyCanvas : moving ? bounds.canvas : bounds.staticCanvas;
  const centerX = (box[0] + box[2]) / 2;
  const centerY = (box[1] + box[3]) / 2;
  const label = pokemonById(id).name + (shiny ? ', shiny colour variant' : '');
  if (style === 'pixel' && !back)
    return (
      <span
        ref={ref}
        role="img"
        aria-label={label}
        className={
          'pokemon-art sprite-art normalized-art ' + className + (shiny ? ' shiny-art' : '')
        }
      >
        {moving && bounds.animatedUrl ? (
          <img
            className="sprite-gif"
            alt=""
            src={asset(bounds.animatedUrl)}
            style={{
              width: (canvas[0] / span) * fit + '%',
              height: (canvas[1] / span) * fit + '%',
              left: 50 - (centerX / span) * fit + '%',
              top: 50 - (centerY / span) * fit + '%',
            }}
          />
        ) : (
          <span
            aria-hidden="true"
            className={'sprite-pixels' + (moving ? ' sprite-pixels-moving' : '')}
            style={
              {
                width: (canvas[0] / span) * fit + '%',
                height: (canvas[1] / span) * fit + '%',
                left: 50 - (centerX / span) * fit + '%',
                top: 50 - (centerY / span) * fit + '%',
                backgroundImage:
                  'url("' +
                  asset(
                    shiny
                      ? 'shiny/' + id + '.png'
                      : moving
                        ? sprite.url
                        : bounds.staticUrl || sprite.staticUrl,
                  ) +
                  '")',
                backgroundSize: moving ? sprite.frames * 100 + '% 100%' : '100% 100%',
                '--sprite-frames': sprite.frames,
                '--sprite-duration': sprite.frames * sprite.frameMs + 'ms',
                '--sprite-end': (sprite.frames / (sprite.frames - 1)) * 100 + '%',
              } as CSSProperties
            }
          />
        )}
        {shiny && (
          <span
            className={
              'shiny-glint' + (!animated || app?.state.profile.reducedMotion ? ' static-glint' : '')
            }
            aria-hidden="true"
          />
        )}
      </span>
    );
  return (
    <img
      className={
        'pokemon-art ' +
        (back
          ? 'pixel-art '
          : 'drawn-art ' + (animated && !app?.state.profile.reducedMotion ? 'idle-drawn ' : '')) +
        className +
        (shiny ? ' shiny-art' : '')
      }
      src={
        shiny
          ? 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' +
            (back ? 'back/shiny/' : 'other/official-artwork/shiny/') +
            id +
            '.png'
          : asset('pokemon/' + (back ? 'back/' : '') + id + '.png')
      }
      alt={label}
      loading={eager ? 'eager' : 'lazy'}
      draggable={false}
      width={475}
      height={475}
    />
  );
}
export function TypeChip({ type }: { type: string }) {
  const colors: Record<string, string> = {
    Fire: '#bd3f24',
    Water: '#286aa6',
    Grass: '#357b3b',
    Poison: '#864196',
    Electric: '#ffdb45',
    Normal: '#686960',
    Flying: '#53679c',
    Bug: '#596e20',
    Psychic: '#ab336a',
    Ice: '#479fba',
    Ghost: '#69528c',
    Dragon: '#5943ac',
    Ground: '#86602d',
    Rock: '#786b36',
    Fighting: '#aa5746',
    Steel: '#536e82',
    Fairy: '#9c487a',
  };
  const glyphs: Record<string, string> = {
    Fire: 'M12 2c2 5-3 5-1 9 2 0 3-2 3-4 5 4 6 7 4 11-3 6-12 5-14 0-2-5 1-8 5-11-1 3 1 4 2 4-1-4 2-6 1-9z',
    Water: 'M12 2C9 7 4 11 4 15a8 8 0 0 0 16 0c0-4-5-8-8-13z',
    Grass: 'M21 3C8 2 2 7 3 14c1 6 8 9 13 4 4-4 3-10 5-15ZM7 17l10-10-7 12z',
    Electric: 'M13 1 4 14h7l-1 9 10-14h-7z',
    Normal: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
    Flying: 'M22 3C7 3 2 8 3 17l7-8-4 10c3 0 6-1 7-3H9c3-1 6-2 7-5h-5c4-1 8-4 11-8Z',
    Poison: 'M12 2a7 7 0 0 0-7 7c0 5 3 5 3 8v3h8v-3c0-3 3-3 3-8a7 7 0 0 0-7-7ZM7 22h10v-2H7Z',
    Bug: 'M8 3 5 1 4 3l4 3h8l4-3-1-2-3 2v3H8ZM5 7c-2 9 1 15 6 15V7Zm8 0v15c5 0 8-6 6-15Z',
    Psychic:
      'M12 2a10 10 0 1 0 10 10h-3a7 7 0 1 1-7-7c4 0 6 6 2 8-2 1-4-1-3-3H8c-2 6 6 9 9 4 4-6-1-12-5-12Z',
    Ice: 'M11 1h2v7l5-5 2 2-5 5h8v2h-8l5 5-2 2-5-5v9h-2v-9l-5 5-2-2 5-5H1v-2h8L4 5l2-2 5 5z',
    Ghost: 'M12 2C6 2 3 6 3 12v9l4-2 3 3 3-3 3 3 5-2v-8c0-6-3-10-9-10ZM7 9h3v4H7Zm7 0h3v4h-3Z',
    Dragon: 'm3 19 6-5-3-4 6-7 9-1-3 7-5-2-2 4 5 3-3 8-6-3-4 3z',
    Ground: 'M7 4h11l5 17H1Zm1 5L4 19h3l3-10Zm7-3 4 13h2L17 6Z',
    Rock: 'm4 4 11-2 7 9-5 10H7l-6-9Zm8 1-6 3 4 5 8-2Z',
    Fighting: 'M4 9V4h3v5h1V2h3v7h1V3h3v6h1V5h3v8l3-2v7l-6 4H7l-4-6V9Z',
    Steel: 'm6 2 12 0 6 10-6 10H6L0 12Zm6 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
    Fairy: 'm12 1 3 7 8 4-8 3-3 8-3-8-8-3 8-4Z',
  };
  return (
    <span
      className={'type-chip type-badge type-' + type.toLowerCase()}
      style={{ '--type-color': colors[type] || '#8a8880' } as CSSProperties}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d={glyphs[type] || glyphs.Normal} fill="currentColor" fillRule="evenodd" />
      </svg>
      <span>{type}</span>
    </span>
  );
}
export function ModeBadge({ mode }: { mode: RewardMode }) {
  return (
    <span className={'mode-badge ' + mode.toLowerCase()}>
      <Icon name={mode === 'Eggs' ? 'Egg' : mode === 'Packs' ? 'Package' : 'Sparkles'} size={13} />
      {mode}
    </span>
  );
}
export function CoinAvatar({ coin, size = 38 }: { coin: Coin; size?: number }) {
  return (
    <span className="coin-avatar" style={{ background: coin.color, width: size, height: size }}>
      {coin.image ? (
        <img src={coin.image} alt={coin.name} className="coin-image" />
      ) : (
        <span className="coin-monogram" aria-label={coin.name + ' coin'}>
          {coin.ticker.trim().slice(0, 2)}
        </span>
      )}
    </span>
  );
}
export function SolValue({ amount, label }: { amount: number; label?: string }) {
  return (
    <span className="sol-value">
      <img
        className="solana-icon"
        src={asset('brand/solana.svg')}
        width={18}
        height={15}
        alt="Solana"
      />
      <strong>{sol(amount)} SOL</strong>
      {label && <small>{label}</small>}
    </span>
  );
}
export function Avatar({
  profile,
  size = 44,
}: {
  profile: Pick<Profile, 'character' | 'accessoryColor'>;
  size?: number;
}) {
  // Source-pixel head bounds keep hair intact while allowing shoulders to crop.
  const crops = {
    red: { left: 24, right: 39, top: 8, headHeight: 16 },
    leaf: { left: 23, right: 49, top: 8, headHeight: 22 },
    misty: { left: 25, right: 49, top: 2, headHeight: 24 },
    brock: { left: 22, right: 41, top: 1, headHeight: 18 },
    blue: { left: 25, right: 46, top: 6, headHeight: 17 },
  };
  const crop = crops[profile.character] || crops.red;
  const innerSize = size - 2;
  const scale = Math.max(
    1,
    Math.min(
      Math.round(innerSize / 24),
      Math.floor(innerSize / (crop.right - crop.left)),
      Math.floor((innerSize - 2) / crop.headHeight),
    ),
  );
  return (
    <span
      className={'trainer-avatar pixel-avatar trainer-portrait trainer-' + profile.character}
      style={
        { width: size, height: size, '--trainer-accent': profile.accessoryColor } as CSSProperties
      }
    >
      <img
        className="trainer-portrait-pixels"
        style={{
          width: 64 * scale,
          height: 64 * scale,
          left: Math.round(innerSize / 2 - ((crop.left + crop.right) / 2) * scale),
          top: 2 - crop.top * scale,
          clipPath: `inset(${crop.top * scale}px 0 ${(64 - crop.top - 26) * scale}px 0)`,
        }}
        src={asset(
          'trainers/' + profile.character + '-' + profile.accessoryColor.replace('#', '') + '.png',
        )}
        alt={profile.character + ' trainer avatar'}
        draggable={false}
      />
    </span>
  );
}
export function EggArt({
  tier = 'Standard',
  className = '',
}: {
  tier?: string;
  className?: string;
}) {
  return (
    <span
      className={'egg-art pixel-item normalized-egg ' + className}
      role="img"
      aria-label={tier + ' egg'}
    >
      <img src={asset('pixel/egg-' + tier.toLowerCase() + '.png')} alt="" draggable={false} />
    </span>
  );
}
export function PackArt({
  tier = 'Standard',
  className = '',
}: {
  tier?: string;
  className?: string;
}) {
  return (
    <div
      className={
        'pack-art collector-pack pack-' +
        tier.toLowerCase() +
        ' ' +
        (tier === 'Rare' ? 'blue-pack ' : '') +
        className
      }
    >
      <div className="pack-crimp top" />
      <div className="pack-inner">
        <span className="pack-brand">POKéPAD</span>
        <span className="pack-edition">KANTO COLLECTION</span>
        <span className="pack-ball-emblem">
          <svg viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="33" fill="#fff9e4" stroke="currentColor" strokeWidth="4" />
            <path d="M7 40a33 33 0 0 1 66 0Z" fill="currentColor" />
            <path d="M8 40h64" stroke="#283b4a" strokeWidth="4" />
            <circle cx="40" cy="40" r="11" fill="#fffaf0" stroke="#283b4a" strokeWidth="4" />
            <circle cx="40" cy="40" r="5" fill="#e5e9e4" />
          </svg>
        </span>
        <span className="pack-tag">{tier.toUpperCase()}</span>
        <span className="pack-contents">1 mystery Pokémon</span>
      </div>
      <div className="pack-crimp bottom" />
    </div>
  );
}
export function Sparkline({
  seed = 1,
  negative = false,
  className = '',
}: {
  seed?: number;
  negative?: boolean;
  className?: string;
}) {
  const points = Array.from({ length: 30 }, (_, i) => [
    i * 5,
    38 - (i * 0.8 + Math.sin(i * seed * 0.7) * 7 + Math.cos(i * 2.1) * 4),
  ]);
  if (negative) points.forEach((p) => (p[1] = 48 - p[1]));
  return (
    <svg
      className={'sparkline ' + className}
      viewBox="0 0 150 50"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={'M' + points.map((p) => p.join(',')).join(' L')}
        fill="none"
        stroke={negative ? '#e66f76' : '#53b893'}
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress-track">
      <span style={{ width: Math.max(0, Math.min(100, value)) + '%', background: color }} />
    </div>
  );
}
export function PageHeading({
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function EmptyState({
  icon = 'Pokeball',
  title,
  description,
  children,
}: {
  icon?: IconName | 'Pokeball';
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon === 'Pokeball' ? <Pokeball size={54} /> : <Icon name={icon} size={40} />}
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  closeDisabled = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  closeDisabled?: boolean;
}) {
  const id = useId(),
    panel = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) closeRef.current();
      if (e.key === 'Tab') {
        const focusable = panel.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]),a,input,select,textarea,[tabindex="0"]',
        );
        if (!focusable?.length) {
          e.preventDefault();
          return;
        }
        const first = focusable[0],
          last = focusable[focusable.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === panel.current)
        ) {
          last.focus();
          e.preventDefault();
        } else if (!e.shiftKey && document.activeElement === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [closeDisabled]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={'modal-panel ' + (wide ? 'wide' : '')}
      >
        <div className="modal-header">
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close dialog"
          >
            <Icon name="X" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Badge({
  label = 'CHAR',
  color = '#d79958',
  size = 66,
}: {
  label?: string;
  color?: string;
  size?: number;
}) {
  return (
    <div
      className="gym-badge pixel-badge"
      style={{ '--badge-color': color, width: size, height: size } as CSSProperties}
    >
      <svg viewBox="0 0 32 36" shapeRendering="crispEdges" aria-hidden="true">
        <path d="M8 0h16v4h4v4h4v20h-4v4h-8v4h-8v-4H4v-4H0V8h4V4h4z" fill="#4a5050" />
        <path d="M8 4h16v4h4v20h-8v4h-8v-4H4V8h4z" fill={color} />
        <path d="M8 6h16v3H8zM6 9h3v16H6z" fill="#fff0b5" />
        <path d="M23 9h3v16h-3zM10 26h12v3H10z" fill="#8d713f" />
        <path d="M13 9h6v3h3v8h-3v3h-6v-3h-3v-8h3z" fill="#fff4cf" />
        <path d="M14 12h4v8h-4zM12 14h8v4h-8z" fill="#d8aa55" />
      </svg>
      <span>
        <small>{label}</small>
      </span>
    </div>
  );
}
