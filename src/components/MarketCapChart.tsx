import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Coin } from '../types';
import { marketCapHistory, marketCapLabel, usdMarketCap } from '../data/market-chart';

export function MarketCapChart({ coin, demo }: { coin: Coin; demo: boolean }) {
  const gradient = useId();
  const description = useId();
  const plot = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 900, height: 320 });
  const [range, setRange] = useState<'all' | 'recent'>('all');
  const [hover, setHover] = useState<number | null>(null);
  const history = useMemo(() => marketCapHistory(coin, demo), [coin, demo]);
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0)
        setSize((previous) =>
          previous.width === width && previous.height === height ? previous : { width, height },
        );
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [!!history]);
  const values = history ? (range === 'recent' ? history.values.slice(-24) : history.values) : [];
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const padding = Math.max((high - low) * 0.2, high * 0.015, 0.0001);
  const floor = Math.max(0, low - padding);
  const ceiling = high + padding;
  const left = 14,
    right = Math.max(15, size.width - 16),
    top = 20,
    bottom = size.height - 35;
  const x = (index: number) => left + (index / Math.max(1, values.length - 1)) * (right - left);
  const y = (value: number) => top + (1 - (value - floor) / (ceiling - floor)) * (bottom - top);
  const path = values
    .map((value, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)} ${y(value).toFixed(2)}`)
    .join(' ');
  const active = hover === null ? null : Math.min(hover, values.length - 1);
  const rising = values.length > 0 && values.at(-1)! >= values[0];
  const currentValue = usdMarketCap(coin);
  return (
    <section
      className={'kanto-market-chart ' + (rising ? 'is-rising' : 'is-falling')}
      aria-label="Market cap chart"
    >
      <div className="kanto-market-chart-heading">
        <div>
          <span className="kanto-market-label">Market cap</span>
          <div className="kanto-market-price-row">
            <strong className="kanto-market-price">{marketCapLabel(currentValue)}</strong>
            <span className={'kanto-market-change ' + (coin.change >= 0 ? 'positive' : 'negative')}>
              {coin.change >= 0 ? '+' : ''}
              {coin.change.toFixed(2)}% <small>24h</small>
            </span>
          </div>
        </div>
        <div className="kanto-market-range" role="group" aria-label="Chart history range">
          {(['recent', 'all'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={range === option}
              disabled={!history || (option === 'recent' && history.values.length <= 24)}
              title={option === 'recent' ? 'Show recent history' : 'Show all history'}
              onClick={() => {
                setRange(option);
                setHover(null);
              }}
            >
              {option === 'recent' ? 'Recent' : 'All history'}
            </button>
          ))}
        </div>
      </div>
      {history ? (
        <>
          <div
            className="kanto-market-chart-screen"
            role="slider"
            tabIndex={0}
            aria-label="Explore market cap history"
            aria-valuemin={1}
            aria-valuemax={values.length}
            aria-valuenow={(active ?? values.length - 1) + 1}
            aria-valuetext={`${marketCapLabel(values[active ?? values.length - 1], true)} market cap, point ${(active ?? values.length - 1) + 1} of ${values.length}`}
            aria-describedby={description}
            onFocus={() => setHover(values.length - 1)}
            onBlur={() => setHover(null)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              setHover((previous) =>
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? values.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          values.length - 1,
                          (previous ?? values.length - 1) + (event.key === 'ArrowLeft' ? -1 : 1),
                        ),
                      ),
              );
            }}
          >
            <svg
              ref={plot}
              viewBox={`0 0 ${size.width} ${size.height}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                if (!bounds.width) return;
                const position = ((event.clientX - bounds.left) / bounds.width) * size.width;
                setHover(
                  Math.max(
                    0,
                    Math.min(
                      values.length - 1,
                      Math.round(((position - left) / (right - left)) * (values.length - 1)),
                    ),
                  ),
                );
              }}
              onPointerLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity=".23" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity=".015" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((tick) => (
                <g key={tick} className="kanto-market-gridline">
                  <path d={`M${left} ${y(ceiling - ((ceiling - floor) * tick) / 4)}H${right}`} />
                </g>
              ))}
              <path
                d={`${path} L${right} ${bottom} L${left} ${bottom}Z`}
                fill={`url(#${gradient})`}
              />
              <path className="kanto-market-chart-line" d={path} />
              <path
                className="kanto-market-last-line"
                d={`M${left} ${y(values.at(-1)!)}H${right}`}
              />
              <circle
                cx={x(values.length - 1)}
                cy={y(values.at(-1)!)}
                r="5"
                fill="currentColor"
                stroke="#fffef6"
                strokeWidth="2.5"
              />
              {active !== null && (
                <g className="kanto-market-crosshair">
                  <path
                    d={`M${x(active)} ${top}V${bottom} M${left} ${y(values[active])}H${right}`}
                  />
                  <circle cx={x(active)} cy={y(values[active])} r="5.5" />
                </g>
              )}
            </svg>
            <div className="kanto-market-value-axis" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((tick) => {
                const value = ceiling - ((ceiling - floor) * tick) / 4;
                return (
                  <span key={tick} style={{ top: (y(value) / size.height) * 100 + '%' }}>
                    {marketCapLabel(value)}
                  </span>
                );
              })}
            </div>
            <div className="kanto-market-history-axis" aria-hidden="true">
              <span>Earlier</span>
              <span>Latest</span>
            </div>
            {active !== null && (
              <div
                className="kanto-market-chart-tooltip"
                style={{ left: Math.max(18, Math.min(75, (x(active) / size.width) * 90)) + '%' }}
              >
                <span>Market cap</span>
                <strong>{marketCapLabel(values[active], true)}</strong>
              </div>
            )}
          </div>
          <p id={description} className="sr-only">
            Market cap in US dollars. Use the left and right arrow keys to explore history.
          </p>
          <div className="market-range-summary" aria-label="Displayed range">
            <span>
              Range low <strong>{marketCapLabel(low)}</strong>
            </span>
            <span>
              Range high <strong>{marketCapLabel(high)}</strong>
            </span>
            {history.source === 'demo' && <small>Demo</small>}
          </div>
        </>
      ) : (
        <div className="kanto-market-chart-empty">
          <svg viewBox="0 0 180 56" aria-hidden="true">
            <path d="M2 44h28l16-19 19 9 25-23 23 15 21-8 19 6h25" />
          </svg>
          <strong>
            {currentValue === null
              ? 'Dollar price temporarily unavailable'
              : 'Market history is on its way'}
          </strong>
          <p>
            {currentValue === null
              ? 'Please try again shortly.'
              : 'The chart will appear as trading history becomes available.'}
          </p>
        </div>
      )}
    </section>
  );
}
