import { useId, type CSSProperties, type ReactNode } from 'react';
import type { BattleCue } from '../battle/presentation';

const anchors = { player: { x: 270, y: 456 }, rival: { x: 730, y: 168 } };
const star = 'M0-24 7-7 25-7 11 5 16 23 0 13-16 23-11 5-25-7-7-7Z';
const flame =
  'M0-31C22-13 14-8 23 1 35 23 14 35 0 35-22 35-32 18-21 1-15 15-10 12-8 2-5-10 3-15 0-31Z';
const leaf = 'M-27 24C-38-9-2-34 31-27 35 10 8 39-27 24Z';
const diamond = 'M0-27 21 0 0 27-21 0Z';
const rock = 'M-29-16-7-31 24-19 34 6 16 29-19 25-35 3Z';
const sword = 'M-5-39 5-39 10 12 20 15 20 21 5 22 5 37-5 37-5 22-20 21-20 15-10 12Z';
const plus = 'M-5-17H5V-5H17V5H5V17H-5V5H-17V-5H-5Z';

type Point = { x: number; y: number };
function AnchoredEffect({
  transform,
  className,
  children,
}: {
  transform: string;
  className: string;
  children: ReactNode;
}) {
  // Keep fixed battlefield placement separate from the CSS animation transform.
  return (
    <g transform={transform}>
      <g className={className}>{children}</g>
    </g>
  );
}
function localStyle(values: Record<string, string | number>): CSSProperties {
  return values as CSSProperties;
}
function Sparkles({ center, color, count = 9 }: { center: Point; color: string; count?: number }) {
  return (
    <g transform={`translate(${center.x} ${center.y})`}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i * Math.PI * 2) / count;
        return (
          <path
            key={i}
            d={star}
            fill={color}
            className="battle-vfx-spark"
            style={localStyle({
              '--spark-x': Math.cos(angle) * 105 + 'px',
              '--spark-y': Math.sin(angle) * 80 + 'px',
              '--delay': i * 0.025 + 's',
            })}
          />
        );
      })}
    </g>
  );
}
function Impact({ center, cue }: { center: Point; cue: BattleCue }) {
  return (
    <AnchoredEffect transform={`translate(${center.x} ${center.y})`} className="battle-vfx-hit">
      <path
        d="M0-78 17-35 54-60 42-17 85-9 42 12 62 55 20 37 0 81-16 40-59 61-40 18-85 0-40-15-58-59-16-36Z"
        fill={cue.color}
        stroke={cue.accent}
        strokeWidth="8"
      />
      <path d="M0-40 11-12 39-10 18 9 22 37 0 23-23 37-17 10-38-10-11-12Z" fill={cue.accent} />
    </AnchoredEffect>
  );
}
/** Overlay uses battlefield coordinates so effects keep their direction and size as the screen scales. */
export function BattleEffects({
  cue,
  reducedMotion = false,
}: {
  cue: BattleCue | null;
  reducedMotion?: boolean;
}) {
  const id = useId().replace(/:/g, '');
  if (!cue) return null;
  const source = anchors[cue.side];
  const destination = anchors[cue.targetSide];
  const target =
    cue.outcome === 'miss'
      ? { x: destination.x + (cue.side === 'player' ? 90 : -90), y: destination.y - 70 }
      : destination;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const canImpact = cue.outcome === 'hit' && cue.target === 'opponent';
  const flightStyle = (i: number, count = 6) =>
    localStyle({
      '--flight-x': dx + 'px',
      '--flight-y': dy + 'px',
      '--delay': i * 0.045 + 's',
      '--spread': ((i % 3) - 1) * 13 + 'px',
      '--turn': (i % 2 ? -1 : 1) * 160 + 'deg',
      '--duration': Math.min(680, cue.durationMs - count * 45) + 'ms',
    });
  const projectiles = (shape: ReactNode, count = 6, reverse = false) => (
    <g transform={`translate(${reverse ? target.x : source.x} ${reverse ? target.y : source.y})`}>
      {Array.from({ length: count }, (_, i) => (
        <g
          key={i}
          className={'battle-vfx-flight' + (reverse ? ' reverse' : '')}
          style={flightStyle(i, count)}
        >
          <AnchoredEffect
            transform={`rotate(${angle}) scale(${0.6 + (i % 3) * 0.15})`}
            className="battle-vfx-projectile"
          >
            {shape}
          </AnchoredEffect>
        </g>
      ))}
    </g>
  );
  const rings = (center: Point, count = 3) => (
    <g transform={`translate(${center.x} ${center.y})`}>
      {Array.from({ length: count }, (_, i) => (
        <ellipse
          key={i}
          rx="74"
          ry="52"
          fill="none"
          stroke={i % 2 ? cue.accent : cue.color}
          strokeWidth="8"
          className="battle-vfx-ring"
          style={localStyle({ '--delay': i * 0.14 + 's' })}
        />
      ))}
    </g>
  );
  const beam = (
    <>
      <path
        className="battle-vfx-beam-aura"
        d={`M${source.x} ${source.y}L${target.x} ${target.y}`}
        fill="none"
        stroke={cue.color}
        strokeWidth={
          cue.variant === 'hyper-beam' || cue.variant === 'hydro-pump'
            ? 48
            : cue.variant === 'water-jet'
              ? 16
              : 30
        }
        strokeLinecap="round"
      />
      <path
        className="battle-vfx-beam-core"
        d={`M${source.x} ${source.y}L${target.x} ${target.y}`}
        fill="none"
        stroke={cue.accent}
        strokeWidth={cue.variant === 'hyper-beam' ? 23 : 9}
        strokeLinecap="round"
      />
      {projectiles(
        cue.variant === 'flame-stream' ? (
          <path d={flame} fill={cue.color} stroke={cue.accent} strokeWidth="3" />
        ) : cue.variant === 'ice-beam' ? (
          <path d={diamond} fill={cue.accent} stroke={cue.color} strokeWidth="3" />
        ) : (
          <circle r="10" fill={cue.accent} />
        ),
        7,
      )}
      {canImpact && <Sparkles center={target} color={cue.accent} />}
    </>
  );
  let effect: ReactNode;
  if (cue.kind === 'faint') {
    effect = (
      <AnchoredEffect transform={`translate(${target.x} ${target.y})`} className="battle-vfx-faint">
        <ellipse rx="90" ry="26" fill="#334462" opacity=".4" />
        {[-35, 0, 35].map((x) => (
          <path
            key={x}
            d={`M${x} 0Q${x - 20} -40 ${x} -85`}
            fill="none"
            stroke="#e6efff"
            strokeWidth="8"
          />
        ))}
      </AnchoredEffect>
    );
  } else if (cue.kind === 'switch') {
    effect = (
      <>
        {rings(target)}
        <Sparkles center={target} color="#fff6b7" count={12} />
        <AnchoredEffect
          transform={`translate(${target.x} ${target.y})`}
          className="battle-vfx-sendout"
        >
          <circle r="54" fill={`url(#${id}-sendout)`} />
          <circle r="28" fill="#fff" />
        </AnchoredEffect>
      </>
    );
  } else if (cue.outcome === 'charge') {
    effect = (
      <>
        {rings(source, 4)}
        <Sparkles center={source} color={cue.color} count={12} />
        {cue.moveName === 'Fly' && (
          <AnchoredEffect
            transform={`translate(${source.x} ${source.y})`}
            className="battle-vfx-rise"
          >
            <path
              d="M-40 30-40-90M0 40V-120M40 30V-90"
              stroke={cue.accent}
              strokeWidth="8"
              strokeLinecap="round"
            />
          </AnchoredEffect>
        )}
      </>
    );
  } else {
    switch (cue.family) {
      case 'beam':
        effect = beam;
        break;
      case 'projectile': {
        let shape: ReactNode = (
          <path d={star} fill={cue.color} stroke={cue.accent} strokeWidth="4" />
        );
        if (['embers', 'dragon-fire', 'fire-blast'].includes(cue.variant))
          shape = <path d={flame} fill={cue.color} stroke={cue.accent} strokeWidth="3" />;
        if (cue.variant === 'leaves')
          shape = (
            <>
              <path d={leaf} fill={cue.color} stroke={cue.accent} strokeWidth="3" />
              <path d="M-20 20 23-22" stroke={cue.accent} strokeWidth="3" />
            </>
          );
        if (cue.variant === 'feathers')
          shape = (
            <>
              <path d="M-35 15C-21-27 20-33 38-14L-21 23Z" fill={cue.color} />
              <path d="M-30 20 35-19" stroke={cue.accent} strokeWidth="4" />
            </>
          );
        if (cue.variant === 'stingers')
          shape = (
            <path d="M-30-9 35 0-30 9-17 0Z" fill={cue.accent} stroke={cue.color} strokeWidth="4" />
          );
        effect = (
          <>
            {projectiles(shape, cue.variant === 'fire-blast' ? 3 : 7)}
            {canImpact &&
              (cue.variant === 'fire-blast' ? (
                <AnchoredEffect
                  transform={`translate(${target.x} ${target.y})`}
                  className="battle-vfx-fireblast"
                >
                  <path
                    d="M0-87V20M-65-35H65M0-15-60 80M0-15 60 80"
                    stroke={cue.color}
                    strokeWidth="24"
                    strokeLinecap="round"
                  />
                  <path
                    d="M0-75V15M-58-35H58M0-12-52 70M0-12 52 70"
                    stroke={cue.accent}
                    strokeWidth="9"
                  />
                </AnchoredEffect>
              ) : (
                <Sparkles center={target} color={cue.color} count={6} />
              ))}
          </>
        );
        break;
      }
      case 'claw':
        effect = (
          <g transform={`translate(${target.x} ${target.y})`}>
            {[-1, 0, 1].map((i) => (
              <path
                key={i}
                d={
                  cue.variant === 'slash'
                    ? `M${-75 + i * 27} -75Q${-20 + i * 27} 20 ${75 + i * 27} 55`
                    : `M${-52 + i * 30} -60L${12 + i * 30} 65`
                }
                fill="none"
                stroke={i === 0 ? cue.accent : cue.color}
                strokeWidth={cue.variant === 'slash' ? 11 : 8}
                strokeLinecap="round"
                className="battle-vfx-slash"
                style={localStyle({ '--delay': (i + 1) * 0.1 + 's' })}
              />
            ))}
          </g>
        );
        break;
      case 'impact':
        effect = (
          <>
            {cue.variant === 'kick' && (
              <AnchoredEffect
                transform={`translate(${target.x - 15} ${target.y + 30})`}
                className="battle-vfx-hit"
              >
                <path
                  d="M-55-30-5-45 15-10 60-5 60 20-30 25Z"
                  fill={cue.color}
                  stroke={cue.accent}
                  strokeWidth="7"
                />
              </AnchoredEffect>
            )}
            <Impact center={target} cue={cue} />
            {cue.variant === 'body-slam' && rings(target)}
            {cue.variant === 'double-edge' && projectiles(<path d={star} fill={cue.accent} />, 4)}
          </>
        );
        break;
      case 'sound':
        effect = (
          <>
            {projectiles(
              <path
                d="M-10-46Q35 0-10 46M-35-32Q-3 0-35 32"
                fill="none"
                stroke={cue.color}
                strokeWidth="8"
              />,
              4,
            )}
            {rings(target, 2)}
          </>
        );
        break;
      case 'vortex':
        effect = (
          <g transform={`translate(${target.x} ${target.y})`}>
            {[-2, -1, 0, 1, 2].map((i) => (
              <ellipse
                key={i}
                cy={i * 24}
                rx={74 - Math.abs(i) * 8}
                ry="24"
                fill="none"
                stroke={i % 2 ? cue.accent : cue.color}
                strokeWidth="12"
                className="battle-vfx-vortex"
                style={localStyle({ '--delay': (i + 2) * 0.07 + 's' })}
              />
            ))}
          </g>
        );
        break;
      case 'wave':
        effect = (
          <AnchoredEffect
            transform={`translate(${target.x} ${target.y})`}
            className="battle-vfx-surf"
          >
            <path
              d="M-220 100V15C-120 90-94-85 0-70 69-59 41-2 10-3 91 51 142-55 220-8V110Z"
              fill={cue.color}
              stroke={cue.accent}
              strokeWidth="11"
            />
            <path
              d="M-200 70Q-110 28-30 68T200 49"
              fill="none"
              stroke={cue.accent}
              strokeWidth="9"
              opacity=".6"
            />
          </AnchoredEffect>
        );
        break;
      case 'fangs':
        effect = (
          <AnchoredEffect
            transform={`translate(${target.x} ${target.y})`}
            className="battle-vfx-bite"
          >
            <path
              className="battle-vfx-upper-jaw"
              d="M-82-55H82V-25L55 14 35-25 15 10-7-25-30 14-50-25-82 0Z"
              fill={cue.color}
              stroke={cue.accent}
              strokeWidth="5"
            />
            <path
              className="battle-vfx-lower-jaw"
              d="M-82 55H82V25L55-14 35 25 15-10-7 25-30-14-50 25-82 0Z"
              fill={cue.color}
              stroke={cue.accent}
              strokeWidth="5"
            />
          </AnchoredEffect>
        );
        break;
      case 'vine':
        effect = (
          <>
            <path
              d={`M${source.x} ${source.y}Q${source.x + dx * 0.4} ${source.y - 180} ${target.x} ${target.y}Q${target.x + 80} ${target.y + 70} ${target.x - 55} ${target.y + 15}`}
              fill="none"
              stroke={cue.color}
              strokeWidth="13"
              strokeLinecap="round"
              className="battle-vfx-vine"
            />
            <path
              d={`M${source.x} ${source.y}Q${source.x + dx * 0.5} ${source.y + 55} ${target.x} ${target.y}`}
              fill="none"
              stroke={cue.accent}
              strokeWidth="7"
              className="battle-vfx-vine"
            />
            {canImpact && <Sparkles center={target} color={cue.accent} count={4} />}
          </>
        );
        break;
      case 'powder':
        effect = (
          <>
            {projectiles(
              <circle
                r={cue.variant === 'sand' ? 9 : 13}
                fill={cue.color}
                stroke={cue.accent}
                strokeWidth="3"
              />,
              9,
            )}
            <AnchoredEffect
              transform={`translate(${target.x} ${target.y})`}
              className="battle-vfx-powder-cloud"
            >
              {Array.from({ length: 13 }, (_, i) => (
                <circle
                  key={i}
                  cx={((i % 5) - 2) * 29}
                  cy={Math.floor(i / 5) * 29 - 55}
                  r={12 + (i % 3) * 4}
                  fill={i % 2 ? cue.color : cue.accent}
                  opacity=".65"
                />
              ))}
            </AnchoredEffect>
          </>
        );
        break;
      case 'ghost':
        effect = (
          <>
            <rect width="1000" height="600" fill="#352453" className="battle-vfx-dim" />
            {rings(target, 4)}
            <AnchoredEffect
              transform={`translate(${target.x} ${target.y})`}
              className="battle-vfx-ghost"
            >
              <path
                d="M-75 50V-10C-75-98 75-98 75-10V50L50 35 25 59 0 38-25 59-50 35Z"
                fill={cue.color}
                opacity=".75"
              />
              <path d="M-44-17-10-5-15 17-42 6ZM44-17 10-5 15 17 42 6Z" fill={cue.accent} />
            </AnchoredEffect>
          </>
        );
        break;
      case 'psychic':
        effect = (
          <>
            <rect width="1000" height="600" fill={cue.color} className="battle-vfx-psychic-wash" />
            {cue.variant === 'hypnosis'
              ? projectiles(
                  <>
                    <circle r="32" fill="none" stroke={cue.color} strokeWidth="7" />
                    <circle r="17" fill="none" stroke={cue.accent} strokeWidth="5" />
                  </>,
                  4,
                )
              : rings(target, cue.variant === 'psychic' ? 4 : 3)}
            <AnchoredEffect
              transform={`translate(${target.x} ${target.y})`}
              className="battle-vfx-orbit"
            >
              <ellipse rx="95" ry="40" stroke={cue.accent} strokeWidth="7" fill="none" />
              <ellipse
                rx="95"
                ry="40"
                stroke={cue.color}
                strokeWidth="7"
                fill="none"
                transform="rotate(70)"
              />
            </AnchoredEffect>
          </>
        );
        break;
      case 'electric':
        effect = (
          <g transform={`translate(${target.x} ${target.y})`}>
            {cue.variant === 'thunder-wave' ? (
              <>
                {[-1, 0, 1].map((i) => (
                  <path
                    key={i}
                    d={`M${i * 65 - 20}-80 ${i * 65 + 10}-38 ${i * 65 - 10}-5 ${i * 65 + 18}30 ${i * 65 - 15}80`}
                    fill="none"
                    stroke={cue.color}
                    strokeWidth="8"
                    className="battle-vfx-electric"
                    style={localStyle({ '--delay': (i + 1) * 0.12 + 's' })}
                  />
                ))}
                {rings(target, 0)}
              </>
            ) : (
              <>
                <path
                  d={
                    cue.variant === 'thunderbolt'
                      ? 'M20-175-40-75 5-75-50 15-4 5-38 85 72-40 17-29 68-110 27-100Z'
                      : 'M8-90-37-17-2-24-20 67 45-30 12-26 36-90Z'
                  }
                  fill={cue.color}
                  stroke={cue.accent}
                  strokeWidth="7"
                  className="battle-vfx-electric"
                />
                <path
                  d="M-65-25-95-50-80-5-110 15M70 5 102-22 86 28 115 49"
                  fill="none"
                  stroke={cue.color}
                  strokeWidth="7"
                  className="battle-vfx-electric"
                />
              </>
            )}
          </g>
        );
        break;
      case 'speed':
        effect =
          cue.variant === 'agility' ? (
            <>
              {rings(source, 3)}
              <AnchoredEffect
                transform={`translate(${source.x} ${source.y})`}
                className="battle-vfx-agility"
              >
                {[-2, -1, 1, 2].map((i) => (
                  <path
                    key={i}
                    d={`M${i * 40}-70V70`}
                    stroke={cue.color}
                    strokeWidth="8"
                    opacity={0.8 - Math.abs(i) * 0.18}
                  />
                ))}
              </AnchoredEffect>
            </>
          ) : (
            <>
              {projectiles(
                <path
                  d="M-95-12H25M-70 2H48M-100 16H12"
                  stroke={cue.color}
                  strokeWidth="7"
                  strokeLinecap="round"
                />,
                cue.variant === 'dive' ? 5 : 3,
              )}
              {canImpact && <Impact center={target} cue={cue} />}
            </>
          );
        break;
      case 'recovery':
        effect = (
          <>
            {rings(source, 2)}
            <g transform={`translate(${source.x} ${source.y})`}>
              {Array.from({ length: 7 }, (_, i) => (
                <g key={i} transform={`translate(${((i % 4) - 1.5) * 42} ${25 + (i % 2) * 35})`}>
                  <g className="battle-vfx-heal" style={localStyle({ '--delay': i * 0.07 + 's' })}>
                    {cue.variant === 'rest' ? (
                      <path
                        d="M-14-14H14L-14 14H14"
                        fill="none"
                        stroke={cue.accent}
                        strokeWidth="7"
                      />
                    ) : (
                      <path d={plus} fill={i % 2 ? cue.accent : cue.color} />
                    )}
                  </g>
                </g>
              ))}
            </g>
          </>
        );
        break;
      case 'earth':
        effect = (
          <g transform={`translate(${target.x} ${target.y})`}>
            {cue.variant === 'earthquake' && (
              <path
                d="M-185 55-123 35-84 68-25 38 12 80 61 42 112 75 181 48"
                fill="none"
                stroke="#6a604d"
                strokeWidth="12"
                className="battle-vfx-crack"
              />
            )}
            {Array.from({ length: cue.variant === 'earthquake' ? 7 : 9 }, (_, i) => (
              <g key={i} transform={`translate(${((i % 5) - 2) * 47} ${(i % 3) * 16})`}>
                <path
                  d={rock}
                  fill={cue.color}
                  stroke={cue.accent}
                  strokeWidth="4"
                  className={
                    cue.variant === 'earthquake' ? 'battle-vfx-rock-burst' : 'battle-vfx-rock-fall'
                  }
                  style={localStyle({ '--delay': i * 0.045 + 's', '--turn': i * 34 + 'deg' })}
                />
              </g>
            ))}
          </g>
        );
        break;
      case 'shield':
        effect = (
          <AnchoredEffect
            transform={`translate(${source.x} ${source.y})`}
            className="battle-vfx-shield"
          >
            <path
              d="M0-100 79-62 66 37 0 100-66 37-79-62Z"
              fill={cue.color}
              fillOpacity=".2"
              stroke={cue.accent}
              strokeWidth="9"
            />
            <path
              d="M0-78 58-50 49 27 0 76-49 27-58-50Z"
              fill="none"
              stroke={cue.color}
              strokeWidth="5"
            />
            <path d="M-40 13 0-23 40 13M0-23V48" fill="none" stroke={cue.accent} strokeWidth="8" />
          </AnchoredEffect>
        );
        break;
      case 'swords':
        effect = (
          <AnchoredEffect
            transform={`translate(${source.x} ${source.y})`}
            className="battle-vfx-swords"
          >
            {[0, 90, 180, 270].map((a) => (
              <g key={a} transform={`rotate(${a}) translate(0 -79)`}>
                <path d={sword} fill={cue.color} stroke={cue.accent} strokeWidth="3" />
              </g>
            ))}
          </AnchoredEffect>
        );
        break;
      case 'silk':
        effect = (
          <>
            {[0, 1, 2].map((i) => (
              <path
                key={i}
                d={`M${source.x} ${source.y}Q${source.x + dx * 0.4} ${source.y - 50 - i * 35} ${target.x} ${target.y}`}
                fill="none"
                stroke={i % 2 ? cue.accent : cue.color}
                strokeWidth="5"
                className="battle-vfx-vine"
              />
            ))}
            <AnchoredEffect
              transform={`translate(${target.x} ${target.y})`}
              className="battle-vfx-web"
            >
              {[0, 30, 60, 90, 120, 150].map((a) => (
                <path
                  key={a}
                  d="M-70 0H70"
                  transform={`rotate(${a})`}
                  stroke={cue.accent}
                  strokeWidth="4"
                />
              ))}
              {[25, 48, 70].map((r) => (
                <circle key={r} r={r} fill="none" stroke={cue.color} strokeWidth="4" />
              ))}
            </AnchoredEffect>
          </>
        );
        break;
      case 'drain':
        effect = (
          <>
            {rings(target, 2)}
            {projectiles(
              <>
                <circle r="16" fill={cue.color} />
                <circle r="8" fill={cue.accent} />
              </>,
              7,
              true,
            )}
            <Sparkles center={source} color={cue.accent} count={6} />
          </>
        );
        break;
      case 'tongue':
        effect = (
          <>
            <path
              d={`M${source.x} ${source.y}Q${source.x + dx * 0.6} ${source.y + 50} ${target.x} ${target.y}`}
              fill="none"
              stroke={cue.color}
              strokeWidth="22"
              strokeLinecap="round"
              className="battle-vfx-vine"
            />
            <path
              d={`M${source.x} ${source.y}Q${source.x + dx * 0.6} ${source.y + 50} ${target.x} ${target.y}`}
              fill="none"
              stroke={cue.accent}
              strokeWidth="5"
              className="battle-vfx-vine"
            />
          </>
        );
        break;
    }
  }
  return (
    <svg
      key={cue.id}
      className={
        'battle-vfx vfx-' +
        cue.variant +
        (reducedMotion ? ' reduced' : '') +
        ' outcome-' +
        cue.outcome
      }
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      aria-hidden="true"
      data-effect={cue.variant}
      data-source={cue.side}
      data-target={cue.targetSide}
    >
      <defs>
        <radialGradient id={`${id}-sendout`}>
          <stop stopColor="#fff" />
          <stop offset=".4" stopColor="#fff7a5" />
          <stop offset="1" stopColor="#fff7a5" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g className="battle-vfx-full">{effect}</g>
      <ellipse
        className="battle-vfx-reduced"
        cx={target.x}
        cy={target.y}
        rx="80"
        ry="65"
        fill={cue.color}
        opacity=".22"
      />
    </svg>
  );
}
