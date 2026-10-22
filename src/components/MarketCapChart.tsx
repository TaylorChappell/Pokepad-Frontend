import { useId, useMemo, useState } from 'react';
import type { Coin } from '../types';
import { marketCapHistory, marketCapLabel, usdMarketCap } from '../data/market-chart';

export function MarketCapChart({ coin, demo }: { coin: Coin; demo: boolean }) {
  const gradient = useId();
  const description = useId();
  const [range, setRange] = useState<'all' | 'recent'>('all');
  const [hover, setHover] = useState<number | null>(null);
  const history = useMemo(() => marketCapHistory(coin, demo), [coin, demo]);
  const values = history ? (range === 'recent' ? history.values.slice(-24) : history.values) : [];
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const padding = Math.max((high - low) * 0.2, high * 0.015, 0.0001);
  const floor = Math.max(0, low - padding);
  const ceiling = high + padding;
  const x = (index: number) => 18 + (index / Math.max(1, values.length - 1)) * 856;
  const y = (value: number) => 22 + (1 - (value - floor) / (ceiling - floor)) * 228;
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
              {coin.change.toFixed(1)}% <small>24h</small>
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
              title={
                option === 'recent'
                  ? 'Show the latest 24 available samples'
                  : 'Show all available samples'
              }
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
            aria-valuetext={`Sample ${(active ?? values.length - 1) + 1} of ${values.length}: ${marketCapLabel(values[active ?? values.length - 1], true)}`}
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
              viewBox="0 0 900 290"
              preserveAspectRatio="none"
              aria-hidden="true"
              onPointerMove={(event) => {
                const bounds = event.currentTarget.getBoundingClientRect();
                const position = ((event.clientX - bounds.left) / bounds.width) * 900;
                setHover(
                  Math.max(
                    0,
                    Math.min(
                      values.length - 1,
                      Math.round(((position - 18) / 856) * (values.length - 1)),
                    ),
                  ),
                );
              }}
              onPointerLeave={() => setHover(null)}
            >
              <defs>
                <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity=".18" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity=".015" />
                </linearGradient>
              </defs>
              {[0, 1, 2, 3, 4].map((tick) => {
                const value = ceiling - ((ceiling - floor) * tick) / 4;
                return (
                  <g key={tick} className="kanto-market-gridline">
                    <path d={`M18 ${y(value)}H874`} />
                  </g>
                );
              })}
              <path d={`${path} L874 250 L18 250Z`} fill={`url(#${gradient})`} />
              <path className="kanto-market-chart-line" d={path} />
              <circle
                cx={x(values.length - 1)}
                cy={y(values.at(-1)!)}
                r="4.5"
                fill="currentColor"
                stroke="white"
                strokeWidth="2"
              />
              {active !== null && (
                <g className="kanto-market-crosshair">
                  <path d={`M${x(active)} 12V250 M18 ${y(values[active])}H874`} />
                  <circle cx={x(active)} cy={y(values[active])} r="6" />
                </g>
              )}
            </svg>
            <div className="kanto-market-value-axis" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((tick) => {
                const value = ceiling - ((ceiling - floor) * tick) / 4;
                return (
                  <span key={tick} style={{ top: (y(value) / 290) * 100 + '%' }}>
                    {marketCapLabel(value)}
                  </span>
                );
              })}
            </div>
            <div className="kanto-market-sample-axis" aria-hidden="true">
              <span>{range === 'recent' ? 'Recent samples' : 'First sample'}</span>
              <span>Latest</span>
            </div>
            {active !== null && (
              <div
                className="kanto-market-chart-tooltip"
                style={{ left: Math.max(14, Math.min(77, (x(active) / 960) * 100)) + '%' }}
              >
                <span>
                  Sample {active + 1} / {values.length}
                </span>
                <strong>{marketCapLabel(values[active], true)}</strong>
              </div>
            )}
          </div>
          <p id={description} className="kanto-market-chart-source">
            <span className="kanto-market-source-dot" aria-hidden="true" />
            {history.source === 'demo' ? 'Demo market history' : 'Recorded market cap'}
            <span>
              {values.length} samples
              {' · current USD quote'}
            </span>
          </p>
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
              : 'A line chart will appear when price samples are available.'}
          </p>
        </div>
      )}
    </section>
  );
}
