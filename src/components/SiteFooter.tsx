import { useApp } from '../state/AppContext';
import { mainCoinPumpUrl, officialXUrl } from '../site-config';
import { Icon } from './UI';

export function SiteFooter() {
  const { state, mode } = useApp();
  const pumpUrl = mainCoinPumpUrl(state.coins, mode);
  const xUrl = officialXUrl();
  return (
    <footer className="page-footer site-footer" role="contentinfo" aria-label="Kanto footer">
      <span className="footer-copyright">
        © {new Date().getFullYear()} <strong>Kanto.</strong> All rights reserved.
      </span>
      <nav className="footer-legal" aria-label="Help and legal">
        <a href="#/terms">Terms of Service</a>
        <a href="#/privacy">Privacy Policy</a>
        <a href="#/guide">Handbook</a>
      </nav>
      <nav className="footer-socials" aria-label="Kanto links">
        <a
          href={xUrl || 'https://x.com'}
          target="_blank"
          rel="noopener noreferrer"
          title={xUrl ? 'Kanto on X' : 'X profile coming soon'}
          aria-label={
            xUrl ? 'Kanto on X (opens in a new tab)' : 'X placeholder (opens X in a new tab)'
          }
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.2-8.3L1.8 2h6.5l4.5 6.8L18.9 2ZM17.8 20h1.7L7.3 3.9H5.5L17.8 20Z" />
          </svg>
          <span>X</span>
          <Icon name="ArrowUpRight" size={12} />
        </a>
        {pumpUrl ? (
          <a
            href={pumpUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Kanto main coin on Pump.fun (opens in a new tab)"
          >
            <span className="footer-pump-mark" aria-hidden="true" />
            Pump.fun
            <Icon name="ArrowUpRight" size={12} />
          </a>
        ) : (
          <span
            className="footer-pending-link"
            aria-label="Pump.fun main coin link coming soon"
            title="Main coin address coming soon"
          >
            <span className="footer-pump-mark" aria-hidden="true" />
            Pump.fun<small>Soon</small>
          </span>
        )}
      </nav>
    </footer>
  );
}
