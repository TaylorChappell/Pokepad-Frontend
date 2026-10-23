import { useState, type CSSProperties } from 'react';
import { useOptionalApp } from '../state/AppContext';
import { EggArt, Icon, PackArt, PokemonArt, RareCandyIcon, type IconName } from '../components/UI';

interface GuideTopic {
  id: string;
  label: string;
  icon: IconName;
  title: string;
  intro: string;
  pokemon: number;
  color: string;
  sections: { title: string; text: string[]; note?: string }[];
  links: { label: string; path: string }[];
}
const topics: GuideTopic[] = [
  {
    id: 'start',
    label: 'Getting started',
    icon: 'Compass',
    title: 'Your first steps in Kanto',
    intro: 'A coin community, a growing collection, and a Pokémon to call your partner.',
    pokemon: 25,
    color: '#fff1bd',
    sections: [
      {
        title: 'Find your community',
        text: [
          'Discover lists community coins with their market cap, activity, reward mode, and social links. Open a coin to inspect its details and reward pool. A watchlist keeps favourites together; watching a coin does not buy it.',
          'Use the search button or Ctrl/⌘ K to find a ticker, contract address, or registered trainer wallet. Names can be similar, so check the address before deciding which coin or trainer you mean.',
        ],
      },
      {
        title: 'Choose a starter',
        text: [
          'Before the main Kanto token launches, all four starters are free to choose, including Pikachu. Once it launches, holding it unlocks one starter choice: Bulbasaur, Charmander, or Squirtle. A balance strictly above 1% of the main token’s supply also unlocks Pikachu. On your first eligible wallet connection, the choice opens automatically and remains until you choose.',
          'Your chosen starter is saved to your account, so connecting again does not give another choice. It appears in My PC, starts with no redemption value, and can become a funded Pokémon through its first funded evolution.',
        ],
      },
      {
        title: 'Know what is connected',
        text: [
          'With no live service connected, Kanto opens a local demo account. Demo coins, Pokémon and balances are sample data saved in this browser. Creating a demo coin or redeeming a demo Pokémon does not move real funds.',
          'Live mode uses connected wallet and backend services for real launches, trading, rewards and settlement. Features can be unavailable while those services are offline. A pending transaction is not a confirmed payment.',
        ],
        note: 'Resetting demo data clears this browser’s saved collection and settings. It does not affect a blockchain wallet.',
      },
    ],
    links: [
      { label: 'Discover coins', path: '/discover' },
      { label: 'Choose a starter', path: '/starter' },
    ],
  },
  {
    id: 'coins',
    label: 'Coins & launching',
    icon: 'Plus',
    title: 'Give your community its own coin',
    intro: 'Choose its identity, a Pokémon partner, and the way it rewards holders.',
    pokemon: 6,
    color: '#ffe6da',
    sections: [
      {
        title: 'A coin image and a Pokémon have different jobs',
        text: [
          'The coin image is the token’s identity beside its name and ticker. Its Pokémon is the mascot on the card and launch preview. Upload an image independently of the Pokémon you choose.',
          'Launch with an available Pokémon from your inventory or choose your own trainer. Locked Pokémon cannot be selected. Your trainer is available even when you already own Pokémon. One copy of a paired Pokémon can also join that coin’s gym if it has fewer than three defenders.',
        ],
      },
      {
        title: 'Choose a reward mode',
        text: [
          'Eggs focus on delayed reveals and better chances of rarer finds. Packs open immediately and have lower chances of the most valuable outcomes. Mixed mode can distribute both.',
          'The mode appears on the coin card. Holding does not promise an immediate reward or a specific Pokémon: distributions depend on eligibility and available funding.',
        ],
      },
      {
        title: 'Complete the launch wizard',
        text: [
          'The four steps are Details, Partner, Rewards, and Review. Enter your name, ticker, image and description. Optional Website, X, Telegram and Discord fields are always visible below the description. Choose your partner and rewards, then review.',
          'Use full links and check them in Review. Edit takes you back to the relevant step without clearing your entries. Demo mode creates a local coin draft; a live launch requires a separate wallet transaction.',
        ],
      },
    ],
    links: [{ label: 'Create a coin', path: '/create' }],
  },
  {
    id: 'rewards',
    label: 'Eggs, packs & walking',
    icon: 'Gift',
    title: 'Every reward has a source',
    intro: 'Open now, incubate for later, or take your eggs out for a walk.',
    pokemon: 113,
    color: '#ffe6ef',
    sections: [
      {
        title: 'Holding and reward tiers',
        text: [
          'There is no minimum holding time. Once your holding is confirmed, your wallet can receive rewards, even if you have never signed in to Kanto. Awards are saved to that wallet and appear in Rewards when you connect it.',
          'The wallet that launched a coin does not earn holder eggs, packs or Rare Candy from that coin. Creators can earn from other coins they hold, and still receive their 30% creator fee share.',
          'Funded draws happen in hourly batches. Your balance and holding streak influence your chances and reward tier; an award is not guaranteed every hour. Selling resets the streak. The coin must stay active and have enough reward funds.',
          'Better eggs take longer and make rarer outcomes more likely. Lower-tier rewards can still reveal valuable Pokémon. The tier belongs to the egg or pack, not to the individual Pokémon.',
        ],
      },
      {
        title: 'Open a pack or hatch an egg',
        text: [
          'Rewards has separate Eggs and Packs tabs, with a source coin shown on every reward. Packs can open immediately. New Standard eggs take 20 minutes, Rare eggs 1 hour and Epic eggs 4 hours before walking boosts.',
          'Inspect possible outcomes before opening. All 151 Kanto species, including legendaries and shiny variants, can appear in the configured pools when the source coin can fund them. A reveal adds the result to My PC and records its species in the Pokédex.',
        ],
      },
      {
        title: 'Walking helps the timer',
        text: [
          'Each egg shows its remaining hatch time and how much farther you can walk to finish it now. Every 100 metres of accepted walking takes 12 minutes off all incubating eggs, while their normal timers continue.',
          'Open Kanto in your phone’s default browser, connect your wallet, then tap Enable location & start and allow location access. Phantom opens only for approval and returns you to your browser. You can browse any Kanto page while walking. Switching away from Kanto or locking your phone pauses tracking; returning resumes automatically. A manually paused walk stays paused until you resume it. Demo walking only simulates progress.',
        ],
        note: 'An egg being ready does not reveal its Pokémon. The reveal happens when you choose to hatch it.',
      },
    ],
    links: [
      { label: 'Open Rewards', path: '/rewards' },
      { label: 'Walking', path: '/walk' },
    ],
  },
  {
    id: 'collection',
    label: 'My PC & Pokédex',
    icon: 'BookOpen',
    title: 'Know every member of your team',
    intro: 'Your PC is what you own today. Your Pokédex remembers every discovery.',
    pokemon: 133,
    color: '#f2e8d8',
    sections: [
      {
        title: 'My PC is your current inventory',
        text: [
          'Select a Pokémon to open its summary. Stats and Moves are separate tabs. The circular i button opens collection details; Use item and Teach move are direct actions. An obvious Evolve button appears when its evolution is ready.',
          'Your first Pokémon automatically becomes your partner and appears in the sidebar. Choose a different partner in My PC whenever you like. You always have a partner while you own a Pokémon; if yours leaves your collection, another takes its place. My PC starts with your partner, then favourites, then strongest to weakest. Change the sort for SOL value, readiness or other views. Move and evolution markers highlight available actions. The three-dot menu beside Favourite gives quick access to items and manuals.',
        ],
      },
      {
        title: 'Care for your Pokémon',
        text: [
          'Use item in the summary or the PC’s three-dot menu opens your supplies. Sitrus Berries restore 25% of maximum HP, Potions restore 30%, and Revives bring a fainted Pokémon back at 50% HP. Each use consumes one item.',
          'Only usable items are enabled. Berries and Potions cannot revive a fainted Pokémon, and a Revive needs a fainted target. Locked Pokémon cannot use PC items during a battle.',
          'Fainted Pokémon appear grey with a red outline in My PC. Their countdown ends with full HP after ten minutes of recovery. If you own a Revive, use it directly on the card to restore 50% HP immediately; the remaining recovery timer still restores full HP.',
        ],
      },
      {
        title: 'Shiny is a colour variant',
        text: [
          'A shiny uses an alternate palette. There is no separate “Rare Pikachu” or “Standard Pikachu” tier attached to the individual Pokémon.',
          'Normal and shiny variants can have different funded values. The demo gives shinies a higher issuance value. Shiny colour is preserved through the supported evolution flow.',
        ],
      },
      {
        title: 'The Pokédex keeps your history',
        text: [
          'A species stays discovered after you sell, redeem, or lose your last Pokémon of that species. A Pokédex entry is a record, not an extra Pokémon to equip or battle with.',
          'The Pokédex has separate normal and shiny sections. Sort by Pokémon number or SOL value and inspect the total reference value of the catalogue. That total is not your owned balance or an amount you can redeem. Artwork settings change presentation, not stats or value.',
        ],
      },
    ],
    links: [
      { label: 'Open My PC', path: '/pokemon' },
      { label: 'Open Pokédex', path: '/pokedex' },
    ],
  },
  {
    id: 'training',
    label: 'Candy, evolution & moves',
    icon: 'Flame',
    title: 'Build a partner worth keeping',
    intro: 'Train your partner, evolve, and discover new moves.',
    pokemon: 5,
    color: '#ffeadb',
    sections: [
      {
        title: 'Rare Candy and active holdings',
        text: [
          'Your equipped partner gains Rare Candy from eligible active coins launched by other trainers. Your own coins do not generate Candy. Inactive coins do not generate progress. Candy that would advance an evolution is granted only with its share of evolution funding reserved.',
          'If the reward pool cannot reserve the next Candy increase, progress pauses. Reaching the evolution threshold means its value increase is already covered.',
        ],
      },
      {
        title: 'Evolution must be funded',
        text: [
          'The current demo policy consumes 1,000 Rare Candy and raises value by 50%, with a minimum increase of 0.02 SOL. Its evolution budget is reserved as Candy is granted.',
          'Candy pauses before the threshold if more backing is needed. These demo amounts are provisional economy settings. Eevee randomly becomes Vaporeon, Jolteon, or Flareon, each with a one-third chance.',
        ],
        note: 'A ready evolution opens a popup. Choose Evolve or Later; the summary keeps an Evolve button available. Evolution silhouettes keep the reveal a mystery. Eevee’s three outcomes each have a one-third chance.',
      },
      {
        title: 'Moves are earned opportunities',
        text: [
          'A new earned move opens a popup. Preview its looping battle animation and description, then choose to learn it, decline, or come back Later. If all four slots are full, accepting Learn opens a separate choice of which move to forget; you can still choose not to learn it.',
          'Later keeps the offer available in My PC. Declining permanently resolves that opportunity. Circular i buttons beside moves reopen their animation and details. A successful learn plays a sound when effects are enabled. Gym manuals are separate, consumable items that you must own before teaching their move.',
        ],
      },
    ],
    links: [
      { label: 'Check your Pokémon', path: '/pokemon' },
      { label: 'My activity', path: '/activity' },
    ],
  },
  {
    id: 'value',
    label: 'Value & redemption',
    icon: 'Wallet',
    title: 'Rewards come from real funding',
    intro: 'Sell a Pokémon back for its displayed redeemable SOL value.',
    pokemon: 52,
    color: '#fff0ca',
    sections: [
      {
        title: 'The 30 / 20 / 50 fee split',
        text: [
          'Collected creator fees are allocated 30% to the creator, 20% to the platform, and 50% to holder rewards. The reward pool can only issue values that its collected funds support.',
          'Randomness chooses among affordable outcomes. A pool does not need to distribute everything at once, and cannot select an outcome whose value and required evolution budget exceed its funding. A rising token chart does not create reward cash.',
        ],
      },
      {
        title: 'Current value and evolution budget',
        text: [
          'The SOL value on an owned Pokémon is its current funded amount. Future evolution money is separate; it is not added to current value.',
          'Selling redeems the Pokémon for exactly its displayed value. There are no asking prices or player listings.',
        ],
      },
      {
        title: 'Selling your Pokémon',
        text: [
          'Open a Pokémon in My PC, choose Sell, and review its redeemable value before confirming. A Pokémon locked in battle must finish its battle first.',
          'Redemption removes the Pokémon from inventory in exchange for its current funded amount, while its Pokédex discovery stays. Unused evolution funds return to the source pool. Starter restrictions apply until a funded evolution makes it a regular funded instance.',
        ],
        note: 'Payouts, signing, and transfers are previews here. No real SOL changes hands in this frontend.',
      },
    ],
    links: [
      { label: 'My PC', path: '/pokemon' },
      { label: 'My portfolio', path: '/portfolio' },
    ],
  },
  {
    id: 'gyms',
    label: 'Gyms & badges',
    icon: 'Shield',
    title: 'Take on the Kanto league',
    intro:
      'Each coin has a gym and a badge made from its coin image. Support a community, strengthen its defence and challenge other gyms.',
    pokemon: 68,
    color: '#e7edf9',
    sections: [
      {
        title: 'Support one gym',
        text: [
          'Choose one active coin community to support. You must hold its coin to join. Moving gyms moves your contribution rather than adding it to several teams.',
          'The three strongest Pokémon owned by supporting holders lead its defence. If fewer than three are available, one Lv. 20 battle-only copy of the coin’s paired Pokémon joins the defence. A new paired gym can start with that one defender. A trainer-led coin has no fallback and shows only its actual defenders.',
        ],
      },
      {
        title: 'How defence and league points work',
        text: [
          'A gym needs at least one defender before it can be challenged; your challenge team still has three Pokémon. All defence copies start at full HP; originals stay with their owners, and gym partners cannot be collected or redeemed. Strength is the sum of the defenders’ combat stats. SOL value and shiny colour do not add strength.',
          'Your first win against each away gym per UTC day earns one badge, points and supplies, up to five different gyms per day. Home-gym and repeat battles are practice. Tougher defences give more points and supplies. Weekly points reset on Monday; career points and badges remain.',
        ],
      },
      {
        title: 'Badges and progress',
        text: [
          'Each gym uses its coin’s image as its badge. Your profile shows the badges you have earned and the gym you support. A badge is a trainer achievement and team identity, not another tradeable Pokémon.',
          'Each rewarded win earns exactly one badge. Gyms below 1,200 strength do not drop manuals. At 1,200 strength, a 25% chance draws from 10 moves; at 1,800, 40% draws from 20; at 2,400, 60% draws from all 30. The manual catalogue lists every possible move with an i button for its preview. You might receive no manual or another copy of one you already own.',
        ],
      },
    ],
    links: [
      { label: 'Visit Gyms', path: '/gyms' },
      { label: 'Trainer profile', path: '/profile' },
    ],
  },
  {
    id: 'battles',
    label: 'Offline & online battles',
    icon: 'Swords',
    title: 'Bring a team. Make every turn count.',
    intro: 'Choose up to three Pokémon. Think about matchups, moves, and when to switch.',
    pokemon: 9,
    color: '#dfefff',
    sections: [
      {
        title: 'Offline is always for fun',
        text: [
          'Offline battles are against a bot. Choose Easy, Medium, Hard, or Master. Its different Pokémon are selected relative to your team: weaker, comparable, stronger, or a master-level challenge.',
          'Offline matches never wager SOL, tokens, or Pokémon, and do not pay rewards. A practice result does not remove your collection or permanently injure it.',
        ],
      },
      {
        title: 'Choose your team',
        text: [
          'Press one of the three team spaces to open the Pokémon picker. Favourites appear first, then combat strength. You can change the same sorting and filters used in My PC. Use i to inspect a Pokémon and its moves before choosing.',
          'Previous team shows the Pokémon it will reuse. Offline matches accept up to three Pokémon; online rooms specify their team size, and gym challenges use three.',
        ],
      },
      {
        title: 'Play the matchup',
        text: [
          'Check the opponent’s types. Type advantages, your own typing, speed, PP, and the move’s effect all matter. A useful status move or a well-timed switch can beat the strongest-looking attack.',
          'Fight selects a move and Pokémon switches a teammate. A voluntary switch uses your turn. When a Pokémon faints, choose its living replacement before attacks resume. Bots can choose moves, switch and use their allowed items; gym defenders use the same tactical AI.',
        ],
      },
      {
        title: 'Bag, recovery and surrender',
        text: [
          'The standard battle bag gives both players 2 Potions, 1 Revive and 1 Full Heal. Online players can agree to disable items instead. Extra items owned in My PC cannot be brought into a match. An item use takes a turn.',
          'Bag keeps Back available even when no items can be used. Surrender asks for confirmation and ends a started battle as a loss, including any agreed wager. Offline practice does not change your collection’s HP; online and gym battles can leave Pokémon needing recovery.',
        ],
      },
      {
        title: 'Online and wagers',
        text: [
          'Challenge another trainer in a friendly or wagered match. Review both teams and agree the levels, item limits and stake before you both accept.',
          'A lost Pokémon wager transfers the selected team—up to all three Pokémon—to the winner. Live SOL or coin-token stakes also require confirmed deposits and settlement. Changes to teams, rules or stakes reset both acceptances. Check the exact agreement before accepting.',
        ],
        note: 'Demo mode does not connect online matchmaking or real wagers. An offline practice match never becomes a wager.',
      },
      {
        title: 'Leaving and reconnecting',
        text: [
          'Your online battle is saved. Refreshing or returning to Battle arena restores the same teams, health, moves and payment status. A banner on other pages takes you back to your room.',
          'If you leave the arena, switch browser tabs or lose connection during a battle, your rival sees that you are away. Once your absence is detected, you have 60 seconds to return before forfeiting. Return in time and that countdown disappears. A lost connection can take a few seconds to detect.',
          'Turn timers never pause or reset while you are away. Missing your normal move deadline can lose the match before the reconnect countdown ends. Surrender is a separate action and ends the battle immediately after confirmation.',
        ],
      },
    ],
    links: [
      { label: 'Open Battle arena', path: '/battles' },
      { label: 'Build your team', path: '/pokemon' },
    ],
  },
  {
    id: 'analytics',
    label: 'Analytics & activity',
    icon: 'Activity',
    title: 'See what is happening across Kanto',
    intro: 'Platform totals and recent trainer discoveries in one place.',
    pokemon: 137,
    color: '#e2f2ef',
    sections: [
      {
        title: 'Read the platform totals',
        text: [
          'Analytics shows total SOL rewards, platform trading volume and active users. These are platform-wide measures, not your personal balance. Use Portfolio for your own holdings, Pokémon value and redemption status.',
        ],
      },
      {
        title: 'Trainer Activity',
        text: [
          'Trainer Activity refreshes with supported events such as packs being opened, eggs hatching and Pokémon evolving. Open the linked trainer or coin for more context. Demo activity is sample data; live activity comes from the connected service.',
        ],
      },
    ],
    links: [
      { label: 'Open Analytics', path: '/analytics' },
      { label: 'My portfolio', path: '/portfolio' },
    ],
  },
  {
    id: 'account',
    label: 'Trainer & preferences',
    icon: 'Settings',
    title: 'Make Kanto feel like yours',
    intro: 'Your trainer identity, preferred artwork, and collection travel together.',
    pokemon: 7,
    color: '#e0f1f4',
    sections: [
      {
        title: 'Your trainer profile',
        text: [
          'Open the account menu beside the bell for your profile and Settings. Choose a display name, classic trainer and accessory colour, or upload a custom profile picture under Trainer. Pick a preset banner or upload your own. Without a display name, your shortened wallet address is used.',
          'Appearance saves automatically. Searching a registered trainer’s wallet opens their profile; an unknown address is not automatically a Kanto account.',
        ],
      },
      {
        title: 'Artwork and motion',
        text: [
          'Pixel artwork is the default. Choose drawn Pokémon or reduced motion in settings. Small interface companions can retain pixel art for clarity.',
          'Your main Pokémon is the equipped individual in My PC. Artwork changes do not create another Pokémon or change its variant, stats, or value.',
        ],
      },
      {
        title: 'Notifications and your wallet',
        text: [
          'The bell’s red dot means unread notifications. The Rewards count includes unopened packs and eggs ready to hatch, not eggs still incubating. New earned moves and evolutions also open decision popups; Later keeps those actions available in My PC.',
          'The wallet area contains connection settings. This demo cannot sign real transactions. Balances, purchases, and payouts become live only when the backend and wallet flow are connected.',
        ],
      },
    ],
    links: [
      { label: 'Trainer settings', path: '/settings' },
      { label: 'My activity', path: '/activity' },
      { label: 'Terms of Service', path: '/terms' },
      { label: 'Privacy Policy', path: '/privacy' },
    ],
  },
];

function liveGuideSection(section: GuideTopic['sections'][number]) {
  const replacements: Record<string, string[]> = {
    'Rare Candy and active holdings': [
      'Your equipped Pokémon earns Rare Candy from verified holdings in active coins launched by other trainers. Your own coins do not generate Candy. Selling can reset holding progress; inactive coins do not keep generating candy.',
      'Each Candy grant is covered by reserved evolution funding, so progress pauses if the next grant cannot be funded. Starters chosen before the main token launches can begin training with any eligible active coin. The first funded Candy grant links that starter to that coin’s reward pool. Until its first evolution, a starter earns Candy only from the coin funding it; afterwards, any eligible active coin counts.',
    ],
    'Complete the launch wizard': [
      'The four steps are Details, Partner, Rewards, and Review. Add your coin image, name, ticker and description. Website, X, Telegram and Discord fields stay visible below the description. Choose an available Pokémon or your trainer and a reward mode; Review lets you return to edit without losing entries.',
      'Review the wallet transaction before signing. Kanto saves the prepared operation for recovery and lists the coin only after its Solana transaction confirms.',
    ],
    'Open a pack or hatch an egg': [
      'Rewards has separate Eggs and Packs tabs. Packs open immediately. Standard eggs take 20 minutes, Rare eggs 1 hour, and Epic eggs 4 hours; walking can shorten these timers. The Rewards indicator counts only unopened packs and hatchable eggs.',
      'Your Pokémon and its full financial backing are sealed when the reward is awarded. Opening reveals that result without rerolling. A reveal adds the individual to My PC and its species to your Pokédex.',
    ],
    'Walking helps the timer': [
      'Open Walking on a phone, allow location access, and keep the page visible. Desktop directs you to your phone. Walking accelerates eggs already incubating; their timers also progress normally.',
      'The server checks sample timing, accuracy, speed, and distance, and applies daily and incubation caps. Browser GPS can still be spoofed; it does not provide cheat-proof verification.',
    ],
    'Selling your Pokémon': [
      'Open an eligible Pokémon, choose Sell, and review its displayed redemption amount. A locked Pokémon or free starter cannot be redeemed.',
      'The Pokémon is locked while the payout is processed. Check Redemptions in Portfolio: pending does not mean paid. The payment is complete only after its Solana transaction confirms. Your Pokédex discovery remains.',
    ],
    'Online and wagers': [
      'Online rooms use server-controlled teams, turns, and results. Inspect both teams, discuss changes in room chat, and accept the same team, rules and stake. Changes reset both acceptances. Reconnect to restore a running match.',
      'Friendly battles and Pokémon stakes are available when the battle service is ready. Losing a Pokémon wager transfers the selected team to the winner. If a Pokémon faints, choose a living teammate before the next attack turn.',
      'For SOL or supported token wagers, both trainers first accept the same matchup. When the payment screen is ready, tick the stake agreement and press Pay with wallet, then approve in Phantom or MetaMask. Never manually transfer to a battle account. The screen shows which trainer has paid and how long remains.',
      'After you pay, wait in the room for your rival. The battle begins automatically after both payments confirm. If the other stake does not arrive before the deadline, the payment panel offers a refund once the final status is confirmed. A win is paid only when its payout is confirmed.',
    ],
    'Know what is connected': [
      'Browse live coin data without signing in. Connect Phantom or MetaMask using a Solana account, then sign a one-time message to access your trainer.',
      'Launching and trading require a separate wallet transaction approval. Feature availability depends on the connected services; pending transactions remain pending until confirmed on Solana.',
    ],
    'Notifications and your wallet': [
      'The bell marks unread notifications. Rewards counts only unopened packs and hatchable eggs. An eligible first connection opens starter selection; that choice is saved. New moves and evolutions open their own popups, with Later keeping the action available in My PC.',
      'Login tokens stay in memory. A secure session cookie can restore your account after reloading; browsers that block it require a fresh sign-in. Changing wallet accounts signs you out.',
    ],
  };
  if (replacements[section.title])
    return { ...section, text: replacements[section.title], note: undefined };
  return {
    ...section,
    text: section.text.map((text) =>
      text.includes('current demo policy')
        ? 'The evolution screen shows the server’s current Rare Candy requirement, next value, and availability. Each Candy grant is covered by reserved funds for the full remaining evolution path. No extra payment is needed when you reach the threshold.'
        : text.includes('Every opening') ||
            (text.includes('at the moment') && text.includes('draw'))
          ? 'A reward is selected and fully funded when awarded. Opening reveals the sealed Pokémon; it does not reroll the outcome.'
          : text,
    ),
  };
}

function initialTopic() {
  if (typeof window === 'undefined') return 'start';
  const topic = new URLSearchParams(window.location.hash.split('?')[1]).get('topic');
  return topics.some((item) => item.id === topic) ? topic! : 'start';
}
export function GuideManual({ embedded = false }: { embedded?: boolean }) {
  const app = useOptionalApp();
  const live = app?.mode === 'live';
  const displayedTopics = live
    ? topics.map((topic) => ({
        ...topic,
        sections: topic.sections.map((section) => liveGuideSection(section)),
      }))
    : topics;
  const [selected, setSelected] = useState(initialTopic);
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const matching = displayedTopics.filter((topic) =>
    [
      topic.label,
      topic.title,
      topic.intro,
      ...topic.sections.flatMap((section) => [section.title, ...section.text, section.note || '']),
    ]
      .join(' ')
      .toLowerCase()
      .includes(term),
  );
  const current = matching.find((topic) => topic.id === selected) || matching[0];
  const choose = (id: string) => {
    setSelected(id);
    if (!embedded) window.history.replaceState(null, '', '#/guide?topic=' + id);
  };
  return (
    <div className={'howto-manual' + (embedded ? ' is-embedded' : '')}>
      <div className="howto-search">
        <Icon name="Search" size={18} />
        <input
          aria-label="Search the how-to"
          placeholder="What would you like to know?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button aria-label="Clear how-to search" onClick={() => setQuery('')}>
            <Icon name="X" size={16} />
          </button>
        )}
      </div>
      <div className="howto-layout">
        <nav className="howto-topics" aria-label="How-to categories">
          <span>IN THIS GUIDE</span>
          {matching.map((topic) => (
            <button
              className={'howto-topic-button' + (topic.id === current?.id ? ' active' : '')}
              key={topic.id}
              onClick={() => choose(topic.id)}
              aria-pressed={topic.id === current?.id}
            >
              <span
                className="handbook-chapter"
                aria-hidden="true"
                data-chapter={String(topics.findIndex((item) => item.id === topic.id) + 1).padStart(
                  2,
                  '0',
                )}
              />
              <span>{topic.label}</span>
              <Icon name="ChevronRight" size={12} />
            </button>
          ))}
          <a className="howto-analytics-link" href="#/analytics">
            Launchpad analytics <Icon name="ArrowUpRight" size={14} />
          </a>
        </nav>
        {current ? (
          <article className="howto-article" key={current.id} aria-label={current.label}>
            <header
              className="howto-article-heading"
              style={{ '--guide-color': current.color } as CSSProperties}
            >
              <div>
                <span className="handbook-page-label">
                  Chapter{' '}
                  {String(topics.findIndex((item) => item.id === current.id) + 1).padStart(2, '0')}{' '}
                  · {current.label}
                </span>
                <h2>{current.title}</h2>
                <p>{current.intro}</p>
              </div>
              <div className="howto-topic-art" aria-hidden="true">
                {current.id === 'rewards' ? (
                  <>
                    <EggArt tier="Rare" />
                    <PackArt tier="Standard" />
                  </>
                ) : (
                  <PokemonArt id={current.pokemon} animated={false} styleOverride="drawn" />
                )}
                {current.id === 'training' && <RareCandyIcon size={38} />}
              </div>
            </header>
            <div className="howto-sections">
              {current.sections.map((section) => (
                <section key={section.title}>
                  <h3>{section.title}</h3>
                  {section.text.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.note && <aside>{section.note}</aside>}
                </section>
              ))}
            </div>
            <footer className="howto-next-links">
              {current.links.map((link) => (
                <a href={'#' + link.path} key={link.path}>
                  {link.label}
                  <Icon name="ArrowRight" size={16} />
                </a>
              ))}
            </footer>
          </article>
        ) : (
          <div className="howto-no-results">
            <h2>No matching topics</h2>
            <p>Try “eggs”, “evolution”, “wallet”, or “battle”.</p>
            <button className="button secondary" onClick={() => setQuery('')}>
              Show all topics
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
export function GuidePage() {
  return (
    <div className="howto-page trainer-theme">
      <header className="howto-page-heading">
        <div>
          <h1>How Kanto works</h1>
          <p>From your first starter to a fully trained team. Find the details here.</p>
        </div>
        <a className="button secondary" href="#/discover">
          <Icon name="ArrowLeft" size={15} />
          Back to Discover
        </a>
      </header>
      <GuideManual />
    </div>
  );
}
