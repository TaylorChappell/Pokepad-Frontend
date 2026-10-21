import bs58 from 'bs58';
import type { Coin } from './types';

const env = import.meta.env;
export const siteConfig = {
  mainTokenMint: (env?.VITE_MAIN_TOKEN_MINT || '').trim(),
  xUrl: (env?.VITE_KANTO_X_URL || '').trim(),
  operator: (env?.VITE_LEGAL_OPERATOR || '').trim(),
  contactEmail: (env?.VITE_LEGAL_CONTACT_EMAIL || '').trim(),
};

export function mainCoinPumpUrl(
  coins: Pick<Coin, 'main' | 'ca'>[],
  mode: 'demo' | 'live',
  configuredMint = siteConfig.mainTokenMint,
): string | null {
  // Demo addresses are illustrations, never destinations for real transactions.
  const mint =
    configuredMint.trim() || (mode === 'live' ? coins.find((coin) => coin.main)?.ca : '');
  if (!mint || mint.startsWith('PokePad') || /^1+$/.test(mint)) return null;
  try {
    return bs58.decode(mint).length === 32 ? 'https://pump.fun/coin/' + mint : null;
  } catch {
    return null;
  }
}

export function officialXUrl(value = siteConfig.xUrl): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      ['x.com', 'www.x.com'].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      !url.port
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function legalContactEmail(value = siteConfig.contactEmail): string | null {
  return /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value) ? value : null;
}
