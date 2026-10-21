export type RewardMode = 'Eggs' | 'Packs' | 'Mixed';
export type EggTier = 'Standard' | 'Rare' | 'Epic';
export type TrainerCharacter = 'red' | 'leaf' | 'misty' | 'brock' | 'blue';
export interface CoinSocials {
  website?: string;
  x?: string;
  telegram?: string;
  discord?: string;
}
export interface Coin {
  decimals?: number;
  id: string;
  name: string;
  ticker: string;
  ca: string;
  pokemonId: number;
  pokemonShiny?: boolean;
  launchKind?: 'pokemon' | 'trainer';
  launchPokemonId?: string;
  /** Launching wallet and optional public trainer name, supplied by the backend. */
  creatorWallet?: string;
  creatorName?: string;
  trainer?: Pick<Profile, 'character' | 'accessoryColor'>;
  image?: string;
  socials?: CoinSocials;
  color: string;
  mode: RewardMode;
  price: number;
  change: number;
  marketCap: number;
  volume: number;
  /** Optional USD quotes from the market-data service; base figures above are SOL. */
  marketCapUsd?: number;
  volumeUsd?: number;
  launchedAt?: number;
  /** Ordered price samples for the compact, unlabelled card trend. Never inferred in live mode. */
  priceHistory?: number[];
  totalSupply: number;
  holders: number;
  vault: number;
  description: string;
  main?: boolean;
  active: boolean;
  holding: number;
  holdingDays: number;
}
export interface Move {
  name: string;
  type: string;
  power: number | null;
  accuracy: number | null;
  pp: number;
  description: string;
}
export interface EvolutionPreview {
  nextValueMin?: number;
  nextValueMax?: number;
  valueIncreaseMin?: number;
  valueIncreaseMax?: number;
  branches?: { speciesId: number; nextValue: number; valueIncrease: number; chance: number }[];
  policyVersion: number;
  candyRequired: number;
  valueIncrease: number;
  nextValue: number;
  reserved: number;
  fundingNeeded: number;
  canEvolve: boolean;
  reason?: string;
}
export interface OwnedPokemon {
  favourite?: boolean;
  evolutionPreview?: EvolutionPreview;
  id: string;
  speciesId: number;
  level: number;
  rareCandy: number;
  backing: number;
  evolutionReserve: number;
  moveOffers: MoveOffer[];
  originCoin: string;
  /** Legacy reward tier; retained for older APIs, never an individual Pokémon variant. */
  rarity: string;
  shiny?: boolean;
  /** Current HP. Missing on older saves means full health. */
  health?: number;
  starter?: boolean;
  moves: string[];
  acquiredAt: number;
  /** Legacy save input only; migration removes old marketplace listings. */
  listed?: number;
  locked?: boolean;
}
export interface MoveOffer {
  id: string;
  move: string;
  level: number;
  status: 'pending' | 'learned' | 'declined';
}
export interface Reward {
  pokemonInstanceId?: string;
  id: string;
  kind: 'egg' | 'pack';
  tier: EggTier;
  originCoin: string;
  awardedAt: number;
  readyAt: number;
  initialDuration: number;
  walkedKm: number;
  openedAt?: number;
  outcomeSpeciesId?: number;
  shiny?: boolean;
  backing: number;
  evolutionReserve: number;
}
export interface Notification {
  id: string;
  title: string;
  description: string;
  kind: 'egg' | 'evolve' | 'gym' | 'pack' | 'move';
  href: string;
  read: boolean;
  createdAt: number;
  pokemonId?: number;
}
export interface Profile {
  wallet: string;
  displayName: string;
  character: TrainerCharacter;
  accessoryColor: string;
  artStyle: 'pixel' | 'drawn';
  equippedId: string | null;
  supportedGym: string;
  starterChosen: boolean;
  reducedMotion: boolean;
  rewardNotifications: boolean;
  evolutionNotifications: boolean;
}
export interface Activity {
  id: string;
  title: string;
  detail: string;
  kind: string;
  createdAt: number;
  pokemonId?: number;
  shiny?: boolean;
  href: string;
}
export interface Gym {
  coinId: string;
  name: string;
  badge: string;
  supporters: number;
  externalScore: number;
  color: string;
}
export interface PokemonCatalogue {
  /** Versioned reward reference values, not owned redemption claims. */
  policyVersion: number;
  entries: { speciesId: number; normalValue: number; shinyValue: number }[];
  totals: { normal: number; shiny: number };
}
export interface VariantDiscoveries {
  normal: number[];
  shiny: number[];
  /** Species in legacy history whose original colour was not recorded. */
  unknown: number[];
}
export interface AppSnapshot {
  discoveredVariants?: VariantDiscoveries;
  pokemonCatalogue?: PokemonCatalogue;
  starterEligibility?: { canChoose: boolean; canChoosePikachu: boolean; reason?: string };
  redemptions?: {
    id: string;
    pokemonId: string;
    speciesId: number;
    amountSol: number;
    status: string;
    signature?: string;
  }[];
  gyms?: {
    coinId: string;
    name: string;
    badge: string;
    supporters: number;
    score: number;
    color: string;
  }[];
  watchlist?: string[];
  features?: {
    launching?: boolean;
    trading?: boolean;
    rewards?: boolean;
    walking?: boolean;
    walkingMobileOnly?: boolean;
    battles?: boolean;
    payouts?: boolean;
  };
  version: 2;
  profile: Profile;
  coins: Coin[];
  pokemon: OwnedPokemon[];
  discovered: number[];
  rewards: Reward[];
  notifications: Notification[];
  activity: Activity[];
  walkKm: number;
  badges: string[];
  createdCoins: string[];
}
export type Action =
  | {
      type: 'profile.update';
      patch: Partial<
        Pick<
          Profile,
          | 'displayName'
          | 'character'
          | 'accessoryColor'
          | 'artStyle'
          | 'reducedMotion'
          | 'rewardNotifications'
          | 'evolutionNotifications'
        >
      >;
    }
  | { type: 'notification.read'; id?: string }
  | { type: 'reward.open'; id: string }
  | { type: 'pokemon.equip'; id: string }
  | { type: 'pokemon.favourite'; id: string; favourite: boolean }
  | { type: 'pokemon.evolve'; id: string }
  | { type: 'pokemon.learn'; id: string; offerId: string; replaceIndex?: number }
  | { type: 'pokemon.declineMove'; id: string; offerId: string }
  | { type: 'pokemon.redeem'; id: string }
  | { type: 'gym.support'; id: string }
  | { type: 'walk.progress'; km: number }
  | { type: 'starter.choose'; speciesId: number }
  | {
      type: 'coin.create';
      launchKind?: 'pokemon' | 'trainer';
      name: string;
      ticker: string;
      description: string;
      mode: RewardMode;
      pokemonInstanceId?: string;
      image?: string;
      socials?: CoinSocials;
    }
  | { type: 'sync' }
  | { type: 'demo.reset' };
