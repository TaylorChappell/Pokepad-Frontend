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
import { asset, sol, TYPE_COLORS } from '../utils';
import { PIXEL_ICONS } from '../data/icons';
import { SPRITES } from '../data/sprites';
import { useOptionalApp } from '../state/AppContext';
export type IconName = keyof typeof PIXEL_ICONS;
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
      height={size + 4}
    />
  );
}
export function Wordmark() {
  return (
    <span className="pokemon-wordmark" aria-label="POKEPAD">
      <span aria-hidden="true" className="wordmark-shadow">
        POKéPAD
      </span>
      <span aria-hidden="true" className="wordmark-solid">
        POKéPAD
      </span>
      <span aria-hidden="true" className="wordmark-outline">
        POKéPAD
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
      <path d="M5 1h6v1h2v2h1v2h1v5h-1v2h-2v1H4v-1H2v-2H1V6h1V4h1V2h2z" fill="#30434c" />
      <path d="M5 2h6v1h2v3h1v2H2V6h1V4h2z" fill="#e95e55" />
      <path d="M2 9h4v2h4V9h4v2h-1v2h-2v1H5v-1H3v-2H2z" fill="#fff5d3" />
      <path d="M6 6h4v1h1v3h-1v1H6v-1H5V7h1z" fill="#30434c" />
      <path d="M7 7h2v3H7zM6 8h4v1H6z" fill="#fff5d3" />
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
}: {
  id: number;
  className?: string;
  back?: boolean;
  eager?: boolean;
  styleOverride?: 'pixel' | 'drawn';
  animated?: boolean;
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
    moving = animated && !app?.state.profile.reducedMotion && visible && sprite.frames > 1;
  if (style === 'pixel' && !back)
    return (
      <span
        ref={ref}
        role="img"
        aria-label={pokemonById(id).name}
        className={'pokemon-art sprite-art ' + className + (moving ? ' sprite-animated' : '')}
        style={
          {
            backgroundImage: 'url("' + asset(moving ? sprite.url : sprite.staticUrl) + '")',
            backgroundSize: moving ? sprite.frames * 100 + '% 100%' : '100% 100%',
            '--sprite-frames': sprite.frames,
            '--sprite-duration': sprite.frames * sprite.frameMs + 'ms',
            '--sprite-end': (sprite.frames / (sprite.frames - 1)) * 100 + '%',
          } as CSSProperties
        }
      />
    );
  return (
    <img
      className={
        'pokemon-art ' +
        (back ? 'pixel-art ' : 'drawn-art ' + (animated ? 'idle-drawn ' : '')) +
        className
      }
      src={asset('pokemon/' + (back ? 'back/' : '') + id + '.png')}
      alt={pokemonById(id).name}
      loading={eager ? 'eager' : 'lazy'}
      draggable={false}
      width={475}
      height={475}
    />
  );
}
export function TypeChip({ type }: { type: string }) {
  return (
    <span
      className="type-chip"
      style={{ '--type-color': TYPE_COLORS[type] || '#e2dfd8' } as CSSProperties}
    >
      {type}
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
      ) : coin.launchKind === 'trainer' && coin.trainer ? (
        <Avatar profile={coin.trainer} size={size} />
      ) : (
        <PokemonArt id={coin.pokemonId} animated={false} />
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
  return (
    <img
      className="trainer-avatar pixel-avatar"
      width={size}
      height={size}
      src={asset(
        'trainers/' + profile.character + '-' + profile.accessoryColor.replace('#', '') + '.png',
      )}
      alt={profile.character + ' trainer avatar'}
      draggable={false}
    />
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
    <img
      src={asset('pixel/egg-' + tier.toLowerCase() + '.png')}
      width={96}
      height={112}
      className={'egg-art pixel-item ' + className}
      alt={tier + ' egg'}
      draggable={false}
    />
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
    <div className={'pack-art pixel-pack ' + (tier === 'Rare' ? 'blue-pack ' : '') + className}>
      <div className="pack-crimp top" />
      <div className="pack-inner">
        <span className="pack-brand">POKéPAD</span>
        <span className="pack-edition">GEN I</span>
        <PokemonArt id={tier === 'Rare' ? 133 : 25} styleOverride="pixel" animated={false} />
        <span className="pack-tag">{tier.toUpperCase()} PACK</span>
        <Pokeball size={18} />
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
