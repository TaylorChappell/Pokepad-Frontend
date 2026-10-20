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
  id: string;
  name: string;
  ticker: string;
  ca: string;
  pokemonId: number;
  launchKind?: 'pokemon' | 'trainer';
  launchPokemonId?: string;
  trainer?: Pick<Profile, 'character' | 'accessoryColor'>;
  image?: string;
  socials?: CoinSocials;
  color: string;
  mode: RewardMode;
  price: number;
  change: number;
  marketCap: number;
  volume: number;
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
export interface OwnedPokemon {
  id: string;
  speciesId: number;
  level: number;
  rareCandy: number;
  backing: number;
  evolutionReserve: number;
  moveOffers: MoveOffer[];
  originCoin: string;
  rarity: string;
  starter?: boolean;
  moves: string[];
  acquiredAt: number;
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
export interface AppSnapshot {
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
  | { type: 'pokemon.evolve'; id: string }
  | { type: 'pokemon.learn'; id: string; offerId: string; replaceIndex?: number }
  | { type: 'pokemon.declineMove'; id: string; offerId: string }
  | { type: 'pokemon.list'; id: string; amount: number }
  | { type: 'pokemon.unlist'; id: string }
  | { type: 'pokemon.redeem'; id: string }
  | { type: 'gym.support'; id: string }
  | { type: 'walk.progress'; km: number }
  | { type: 'starter.choose'; speciesId: number }
  | {
      type: 'coin.create';
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
