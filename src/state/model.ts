import type { Action, AppSnapshot, Activity, OwnedPokemon, CoinSocials, Reward } from '../types';
import { createInitialState, ACCENT_COLORS, CHARACTERS } from '../data/demo';
import { pokemonById } from '../data/pokemon';
import { MOVE_OPTIONS } from '../data/moves';
import { drawReward } from '../data/rewardPools';
import { getPokemonHealth, getPokemonStats } from '../data/stats';
export const EVOLUTION_CANDY = 1000;
export const WALK_BOOST_MS_PER_KM = 2 * 60 * 60 * 1000;
export const STORAGE_KEY = 'pokepad.frontend.v1';
const LAMPORTS_PER_SOL = 1_000_000_000;
const lamports = (sol: number) => Math.round(sol * LAMPORTS_PER_SOL);
const fromLamports = (n: number) => n / LAMPORTS_PER_SOL;
export function shortWallet(wallet: string) {
  return wallet.slice(0, 4) + '…' + wallet.slice(-4);
}
export function profileName(s: AppSnapshot) {
  return s.profile.displayName.trim() || shortWallet(s.profile.wallet);
}
/** Pump's creation form limits ticker text to ten characters without forcing uppercase. */
export function isValidCoinTicker(value: string) {
  return value.trim().length > 0 && value.length <= 10 && !/[\u0000-\u001f\u007f]/.test(value);
}
export function collectionValue(s: AppSnapshot) {
  return fromLamports(s.pokemon.reduce((sum, p) => sum + lamports(p.backing), 0));
}
/** Existing reward reserves plus the origin coin's available, unallocated reward funds. */
export function rewardBudget(s: AppSnapshot, r: Reward) {
  const vault = s.coins.find((coin) => coin.id === r.originCoin)?.vault || 0;
  return fromLamports(lamports(r.backing) + lamports(r.evolutionReserve) + lamports(vault));
}
export function pendingMove(p: OwnedPokemon) {
  return p.moveOffers.find(
    (offer) =>
      offer.status === 'pending' &&
      offer.level <= p.level &&
      !p.moves.includes(offer.move) &&
      !p.moveOffers.some(
        (previous) => previous.move === offer.move && previous.status === 'declined',
      ),
  );
}
/** Demo funding policy: every evolution raises value by 50%, with a 0.02 SOL minimum. */
export function evolutionValueIncrease(p: Pick<OwnedPokemon, 'speciesId' | 'backing'>) {
  if (!pokemonById(p.speciesId).evolvesTo.length) return 0;
  return fromLamports(Math.max(20_000_000, Math.round(lamports(p.backing) / 2)));
}
export function getEvolutionStatus(state: AppSnapshot, p: OwnedPokemon) {
  if (p.evolutionPreview) return p.evolutionPreview;
  // Live snapshots must never invent an evolution quote from the local demo policy.
  if (state.features)
    return {
      candyRequired: EVOLUTION_CANDY,
      valueIncrease: 0,
      nextValue: p.backing,
      reserved: p.evolutionReserve,
      fundingNeeded: 0,
      canEvolve: false,
      reason: 'Evolution details are unavailable. Refresh your collection.',
    };
  const valueIncrease = evolutionValueIncrease(p);
  const reserved = p.evolutionReserve;
  const fundingNeeded = fromLamports(Math.max(0, lamports(valueIncrease) - lamports(reserved)));
  const available = state.coins.find((c) => c.id === p.originCoin)?.vault || 0;
  let reason: string | undefined;
  if (!pokemonById(p.speciesId).evolvesTo.length)
    reason = 'This Pokémon has reached its final Kanto evolution.';
  else if (p.locked) reason = 'Finish this Pokémon’s battle first.';
  else if (p.rareCandy < EVOLUTION_CANDY) reason = 'Collect more Rare Candy to evolve.';
  else if (lamports(available) < lamports(fundingNeeded))
    reason = 'Waiting for this coin’s reward pool to fund the evolution.';
  return {
    candyRequired: EVOLUTION_CANDY,
    valueIncrease,
    nextValue: fromLamports(lamports(p.backing) + lamports(valueIncrease)),
    reserved,
    fundingNeeded,
    canEvolve: !reason,
    reason,
  };
}
/** Rejection sampling gives each branch exactly equal probability, unlike raw modulo. */
export function secureRandomIndex(length: number) {
  if (!Number.isInteger(length) || length < 1 || length > 0xffffffff)
    throw new Error('Invalid random range.');
  const range = 0x100000000,
    limit = range - (range % length),
    word = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(word);
  } while (word[0] >= limit);
  return word[0] % length;
}
function reserveNextEvolution(s: AppSnapshot, p: OwnedPokemon) {
  const coin = s.coins.find((c) => c.id === p.originCoin);
  if (!coin) return;
  const needed = Math.max(0, lamports(evolutionValueIncrease(p)) - lamports(p.evolutionReserve));
  const allocated = Math.min(needed, Math.max(0, lamports(coin.vault)));
  coin.vault = fromLamports(lamports(coin.vault) - allocated);
  p.evolutionReserve = fromLamports(lamports(p.evolutionReserve) + allocated);
}
function cleanSocials(input: CoinSocials = {}): CoinSocials {
  const result: CoinSocials = {};
  for (const key of ['website', 'x', 'telegram', 'discord'] as const) {
    const value = input[key]?.trim();
    if (!value) continue;
    if (value.length > 500) throw new Error('Use a shorter ' + key + ' link.');
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error('Enter a full https:// link for ' + key + '.');
    }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new Error('Use an http:// or https:// link for ' + key + '.');
    result[key] = url.href;
  }
  return result;
}
/** Reject removed or unknown actions before they can alter local state or reach the live API. */
export function assertSupportedAction(action: Action): void {
  const supported: ReadonlySet<string> = new Set<Action['type']>([
    'profile.update',
    'notification.read',
    'reward.open',
    'pokemon.equip',
    'pokemon.evolve',
    'pokemon.learn',
    'pokemon.declineMove',
    'pokemon.redeem',
    'gym.support',
    'walk.progress',
    'starter.choose',
    'coin.create',
    'sync',
    'demo.reset',
  ]);
  if (!action || !supported.has(action.type))
    throw new Error(
      'This action is no longer supported. Pokémon can only be sold for their redeemable value.',
    );
}
export function applyAction(
  original: AppSnapshot,
  action: Action,
  now = Date.now(),
  randomIndex: (length: number) => number = secureRandomIndex,
): AppSnapshot {
  assertSupportedAction(action);
  if (action.type === 'demo.reset') return createInitialState(now);
  const s = structuredClone(original);
  const activity = (entry: Omit<Activity, 'id' | 'createdAt'>) =>
    s.activity.unshift({ ...entry, id: crypto.randomUUID(), createdAt: now });
  const owned = (id: string) => {
    const p = s.pokemon.find((p) => p.id === id);
    if (!p) throw new Error('This Pokémon is no longer in your inventory.');
    return p;
  };
  if (action.type === 'profile.update') {
    if (action.patch.displayName !== undefined && action.patch.displayName.trim().length > 24)
      throw new Error('Choose a display name with 24 characters or fewer.');
    if (action.patch.artStyle && !['pixel', 'drawn'].includes(action.patch.artStyle))
      throw new Error('Choose pixel or drawn Pokémon.');
    if (action.patch.character && !CHARACTERS.includes(action.patch.character))
      throw new Error('Choose an available trainer.');
    if (action.patch.accessoryColor && !ACCENT_COLORS.includes(action.patch.accessoryColor))
      throw new Error('Choose an available accessory colour.');
    s.profile = {
      ...s.profile,
      ...action.patch,
      displayName: action.patch.displayName?.trim() ?? s.profile.displayName,
    };
  }
  if (action.type === 'notification.read')
    s.notifications.forEach((n) => {
      if (!action.id || n.id === action.id) n.read = true;
    });
  if (action.type === 'reward.open') {
    const r = s.rewards.find((r) => r.id === action.id);
    if (!r) throw new Error('We could not find this reward.');
    if (r.openedAt) throw new Error('This reward has already been opened.');
    if (r.readyAt > now) throw new Error('This egg is still incubating.');
    // Demo only: draw from the currently funded table. The live API owns this operation.
    const budget = rewardBudget(s, r);
    const result = drawReward(r.tier, r.kind, budget, randomIndex);
    const coin = s.coins.find((coin) => coin.id === r.originCoin);
    if (!coin) throw new Error('This reward’s funding pool is unavailable.');
    coin.vault = fromLamports(
      lamports(budget) - lamports(result.backing) - lamports(result.evolutionReserve),
    );
    r.outcomeSpeciesId = result.speciesId;
    r.shiny = result.shiny;
    r.backing = result.backing;
    r.evolutionReserve = result.evolutionReserve;
    r.openedAt = now;
    const id = 'hatched-' + r.id,
      species = pokemonById(r.outcomeSpeciesId);
    s.pokemon.push({
      id,
      speciesId: species.id,
      level: 5,
      rareCandy: 0,
      backing: r.backing,
      evolutionReserve: r.evolutionReserve,
      moveOffers: [],
      originCoin: r.originCoin,
      rarity: '',
      shiny: result.shiny,
      health: getPokemonStats({ speciesId: species.id, level: 5 }).hp,
      moves: (MOVE_OPTIONS[species.id] || ['Tackle', 'Growl']).slice(0, 4),
      acquiredAt: now,
    });
    if (!s.discovered.includes(species.id)) s.discovered.push(species.id);
    s.notifications.forEach((n) => {
      if (n.id === 'ready-' + r.id || n.id === 'pack-' + r.id) n.read = true;
    });
    activity({
      title: species.name + (r.kind === 'egg' ? ' hatched!' : ' joined your team!'),
      detail: r.tier + ' ' + r.kind + ' opened.',
      kind: 'reward',
      pokemonId: species.id,
      shiny: !!r.shiny,
      href: '/pokemon/' + id,
    });
  }
  if (action.type === 'pokemon.equip') {
    const p = owned(action.id);
    if (p.locked) throw new Error('Finish this Pokémon’s battle before equipping it.');
    s.profile.equippedId = p.id;
  }
  if (action.type === 'pokemon.evolve') {
    const p = owned(action.id),
      status = getEvolutionStatus(s, p);
    if (!status.canEvolve) throw new Error(status.reason);
    const options = pokemonById(p.speciesId).evolvesTo;
    const index = options.length === 1 ? 0 : randomIndex(options.length);
    if (!Number.isInteger(index) || index < 0 || index >= options.length)
      throw new Error('The evolution result was invalid. Please retry.');
    const previousHealth = getPokemonHealth(p);
    const target = options[index],
      coin = s.coins.find((c) => c.id === p.originCoin);
    if (status.fundingNeeded > 0 && coin)
      coin.vault = fromLamports(lamports(coin.vault) - lamports(status.fundingNeeded));
    p.evolutionReserve = fromLamports(
      Math.max(0, lamports(p.evolutionReserve) - lamports(status.valueIncrease)),
    );
    p.backing = status.nextValue;
    p.speciesId = target;
    p.health = Math.max(0, getPokemonStats(p).hp - (previousHealth.max - previousHealth.current));
    p.rareCandy -= EVOLUTION_CANDY;
    // A zero-value starter becomes an ordinary funded asset after its first funded evolution.
    if (p.starter && p.backing > 0) p.starter = false;
    reserveNextEvolution(s, p);
    if (!s.discovered.includes(target)) s.discovered.push(target);
    s.notifications.forEach((n) => {
      if (n.id.startsWith('evolve-' + p.id)) n.read = true;
    });
    activity({
      title: 'Your Pokémon evolved into ' + pokemonById(target).name + '!',
      detail: 'Value increased by ' + status.valueIncrease + ' SOL from the funded reward pool.',
      kind: 'evolve',
      pokemonId: target,
      shiny: !!p.shiny,
      href: '/pokemon/' + p.id,
    });
  }
  if (action.type === 'pokemon.learn' || action.type === 'pokemon.declineMove') {
    const p = owned(action.id);
    if (p.locked) throw new Error('This Pokémon is currently unavailable.');
    const offer = pendingMove(p);
    if (!offer || offer.id !== action.offerId)
      throw new Error('This move-learning opportunity is no longer available.');
    if (action.type === 'pokemon.declineMove') {
      offer.status = 'declined';
      activity({
        title: pokemonById(p.speciesId).name + ' did not learn ' + offer.move,
        detail: 'This opportunity has been declined permanently.',
        kind: 'move',
        pokemonId: p.speciesId,
        href: '/pokemon/' + p.id,
      });
    } else {
      if (p.moves.includes(offer.move)) throw new Error('This Pokémon already knows that move.');
      if (offer.level > p.level)
        throw new Error('This Pokémon has not reached the required level.');
      if (p.moves.length < 4) p.moves.push(offer.move);
      else {
        if (
          !Number.isInteger(action.replaceIndex) ||
          action.replaceIndex! < 0 ||
          action.replaceIndex! >= p.moves.length
        )
          throw new Error('Choose a current move to forget.');
        p.moves[action.replaceIndex!] = offer.move;
      }
      offer.status = 'learned';
      activity({
        title: pokemonById(p.speciesId).name + ' learned ' + offer.move + '!',
        detail: 'Learned at level ' + offer.level + '.',
        kind: 'move',
        pokemonId: p.speciesId,
        href: '/pokemon/' + p.id,
      });
    }
    s.notifications.forEach((n) => {
      if (n.id === 'move-' + offer.id) n.read = true;
    });
  }
  if (action.type === 'pokemon.redeem') {
    const p = owned(action.id);
    if (p.starter || p.locked) throw new Error('This Pokémon cannot currently be redeemed.');
    const coin = s.coins.find((c) => c.id === p.originCoin);
    if (!coin && p.evolutionReserve > 0)
      throw new Error('This Pokémon’s funding pool is unavailable. Please try again later.');
    if (coin) coin.vault = fromLamports(lamports(coin.vault) + lamports(p.evolutionReserve));
    activity({
      title: 'Redeemed ' + pokemonById(p.speciesId).name,
      detail: p.backing + ' SOL · local preview, no payment sent',
      kind: 'redeem',
      pokemonId: p.speciesId,
      shiny: !!p.shiny,
      href: '/activity',
    });
    s.pokemon = s.pokemon.filter((x) => x.id !== p.id);
    if (s.profile.equippedId === p.id) s.profile.equippedId = null;
  }
  if (action.type === 'gym.support') {
    if (!s.coins.find((c) => c.id === action.id && c.active && c.holding > 0))
      throw new Error('Hold an active gym’s coin to support it.');
    s.profile.supportedGym = action.id;
    activity({
      title: 'Joined Team ' + s.coins.find((c) => c.id === action.id)?.ticker,
      detail: 'Your Pokémon now support this gym.',
      kind: 'gym',
      href: '/gym/' + action.id,
    });
  }
  if (action.type === 'walk.progress') {
    if (!Number.isFinite(action.km) || action.km <= 0 || action.km > 1)
      throw new Error('Invalid walking preview distance.');
    s.walkKm += action.km;
    s.rewards
      .filter((r) => r.kind === 'egg' && !r.openedAt && r.readyAt > now)
      .forEach((r) => {
        r.walkedKm += action.km;
        r.readyAt = Math.max(now, r.readyAt - action.km * WALK_BOOST_MS_PER_KM);
      });
  }
  if (action.type === 'starter.choose') {
    if (s.profile.starterChosen) throw new Error('Your starter has already been chosen.');
    if (![1, 4, 7, 25].includes(action.speciesId)) throw new Error('Choose a starter.');
    const main = s.coins.find((c) => c.main);
    if (!main || main.holding <= 0) throw new Error('Hold the main token to choose a starter.');
    if (action.speciesId === 25 && main.holding / main.totalSupply <= 0.01)
      throw new Error('Pikachu needs a holding above 1% of the main token.');
    s.profile.starterChosen = true;
    const id = 'starter-' + crypto.randomUUID();
    const p: OwnedPokemon = {
      id,
      speciesId: action.speciesId,
      level: 5,
      rareCandy: 0,
      backing: 0,
      evolutionReserve: 0,
      moveOffers: [],
      originCoin: main.id,
      rarity: '',
      shiny: false,
      health: getPokemonStats({ speciesId: action.speciesId, level: 5 }).hp,
      starter: true,
      moves: (MOVE_OPTIONS[action.speciesId] || ['Tackle', 'Growl']).slice(0, 2),
      acquiredAt: now,
    };
    reserveNextEvolution(s, p);
    s.pokemon.push(p);
    s.profile.equippedId = id;
    if (!s.discovered.includes(action.speciesId)) s.discovered.push(action.speciesId);
    activity({
      title: 'You chose ' + pokemonById(action.speciesId).name + '!',
      detail: 'Your starter is now in your party.',
      kind: 'reward',
      pokemonId: action.speciesId,
      href: '/pokemon/' + id,
    });
  }
  if (action.type === 'coin.create') {
    const name = action.name.trim(),
      ticker = action.ticker.trim();
    if (name.length < 3 || name.length > 32 || !isValidCoinTicker(action.ticker))
      throw new Error('Use a name of 3–32 characters and a ticker of 1–10 printable characters.');
    if (action.description.length > 280)
      throw new Error('Keep the description under 281 characters.');
    if (!['Eggs', 'Packs', 'Mixed'].includes(action.mode)) throw new Error('Choose a reward mode.');
    if (action.launchKind !== undefined && !['pokemon', 'trainer'].includes(action.launchKind))
      throw new Error('Choose your trainer or an owned Pokémon to represent this coin.');
    let launchPokemon: OwnedPokemon | undefined;
    if (action.launchKind === 'trainer') {
      if (action.pokemonInstanceId) throw new Error('Choose either your trainer or a Pokémon.');
    } else if (action.pokemonInstanceId) {
      launchPokemon = owned(action.pokemonInstanceId);
      if (launchPokemon.locked)
        throw new Error('Finish this Pokémon’s battle before launching a coin.');
    } else if (s.pokemon.length || action.launchKind === 'pokemon') {
      throw new Error('Choose a Pokémon from your inventory or launch as your trainer.');
    }
    if (action.image) {
      if (!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(action.image))
        throw new Error('Upload a PNG, JPEG, WebP or GIF image.');
      if (action.image.split(',')[1].length * 0.75 > 2 * 1024 * 1024)
        throw new Error('Choose a coin image smaller than 2 MB.');
    }
    const socials = cleanSocials(action.socials),
      id = 'created-' + crypto.randomUUID();
    s.coins.unshift({
      id,
      name,
      ticker,
      ca: 'Demo' + crypto.randomUUID().replaceAll('-', ''),
      pokemonId: launchPokemon?.speciesId || 0,
      pokemonShiny: !!launchPokemon?.shiny,
      launchKind: launchPokemon ? 'pokemon' : 'trainer',
      launchPokemonId: launchPokemon?.id,
      creatorWallet: s.profile.wallet,
      creatorName: s.profile.displayName.trim() || undefined,
      trainer: { character: s.profile.character, accessoryColor: s.profile.accessoryColor },
      image: action.image || undefined,
      socials,
      color: '#fff0b1',
      mode: action.mode,
      price: 0,
      change: 0,
      marketCap: 0,
      marketCapUsd: 0,
      volume: 0,
      volumeUsd: 0,
      launchedAt: now,
      totalSupply: 1000000000,
      holders: 0,
      vault: 0,
      description: action.description.trim(),
      active: true,
      holding: 0,
      holdingDays: 0,
    });
    s.createdCoins.push(id);
    activity({
      title: 'Created ' + name,
      detail: 'Your coin draft is saved locally.',
      kind: 'coin',
      href: '/coin/' + id,
    });
  }
  for (const p of s.pokemon) {
    const evolutionId = 'evolve-' + p.id + '-' + p.speciesId;
    if (
      s.profile.evolutionNotifications &&
      getEvolutionStatus(s, p).canEvolve &&
      !s.notifications.some(
        (n) => n.id === evolutionId || (n.id === 'evolve-' + p.id && n.pokemonId === p.speciesId),
      )
    )
      s.notifications.unshift({
        id: evolutionId,
        title: pokemonById(p.speciesId).name + ' is ready to evolve',
        description: 'Rare Candy and evolution funding are ready.',
        kind: 'evolve',
        href: '/pokemon/' + p.id,
        read: false,
        createdAt: now,
        pokemonId: p.speciesId,
      });
    const offer = pendingMove(p);
    if (offer && !s.notifications.some((n) => n.id === 'move-' + offer.id))
      s.notifications.unshift({
        id: 'move-' + offer.id,
        title: pokemonById(p.speciesId).name + ' wants to learn ' + offer.move,
        description: 'Choose to learn the move or decline it permanently.',
        kind: 'move',
        href: '/pokemon/' + p.id,
        read: false,
        createdAt: now,
        pokemonId: p.speciesId,
      });
  }
  for (const r of s.rewards) {
    if (
      r.kind === 'egg' &&
      !r.openedAt &&
      r.readyAt <= now &&
      s.profile.rewardNotifications &&
      !s.notifications.some((n) => n.id === 'ready-' + r.id)
    )
      s.notifications.unshift({
        id: 'ready-' + r.id,
        title: 'Your egg is ready to hatch!',
        description: r.tier + ' egg from $' + s.coins.find((c) => c.id === r.originCoin)?.ticker,
        kind: 'egg',
        href: '/rewards?tab=eggs',
        read: false,
        createdAt: now,
      });
  }
  return s;
}
