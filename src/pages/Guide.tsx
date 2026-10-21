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
          'Holding the main POKE token unlocks one starter choice: Bulbasaur, Charmander, or Squirtle. A balance strictly above 1% of the main token’s supply also unlocks Pikachu.',
          'Your starter appears in My PC and can be equipped as your partner. It begins with no redemption value; its first funded evolution can make it a funded Pokémon. You cannot repeatedly claim new starters.',
        ],
      },
      {
        title: 'Know what is connected',
        text: [
          'This version is a frontend with a local demo account. Explore rewards, collection management, coin creation, and offline battles. Demo progress is saved in this browser.',
          'Wallet transactions, live trading, verified walking, redemptions, and online settlement need the connected backend. A preview confirmation does not move real funds.',
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
          'Launch with an available Pokémon from your inventory or choose your own trainer. Listed or locked Pokémon cannot be selected. Your trainer is available even when you already own Pokémon.',
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
          'The four steps are Details, Partner, Rewards, and Review. Details contains your name, ticker, image, description, and social links. Choose a Pokémon or trainer partner, select rewards, then review. You can go back before submitting.',
          'Website, X, Telegram, and Discord links are optional. Use full links and check them in the review. Here, completion creates a local coin draft. Actual token creation will require a wallet transaction.',
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
          'Your token balance and holding streak determine the tier you qualify for. Selling affects that streak. A coin must meet activity requirements to generate new holder benefits.',
          'Better eggs take longer and make rarer outcomes more likely. Lower-tier rewards can still reveal valuable Pokémon. The tier belongs to the egg or pack, not to the individual Pokémon.',
        ],
      },
      {
        title: 'Open a pack or hatch an egg',
        text: [
          'Rewards has separate Eggs and Packs tabs. Each item shows its source coin. A pack opens whenever you are ready; an egg becomes hatchable when its timer reaches zero.',
          'Inspect possible outcomes before opening. All 151 Kanto species, including legendaries and shiny variants, can appear in the configured pools when the source coin can fund them. A reveal adds the result to My PC and records its species in the Pokédex.',
        ],
      },
      {
        title: 'Walking helps the timer',
        text: [
          'The egg screen shows time and walking progress. Walking speeds incubation; it is not required for the timer to finish.',
          'The current walking control is a demonstration. Production walking must be verified before it earns progress. Browser GPS alone cannot promise that cheating is impossible.',
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
          'Select a Pokémon to see its level, HP, typing, battle stats, moves, Rare Candy, and SOL value. Equip it as your partner or manage an available evolution, move, or redemption.',
          'Your equipped Pokémon appears beside your avatar and in the sidebar. Listed or locked Pokémon cannot take conflicting actions. Ownership is individual, so you can own several Pokémon of the same species.',
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
          'Use My PC for ownership and the Pokédex for all 151 species and discovery progress. Switching between pixel and drawn artwork changes presentation, not stats or value.',
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
          'Your equipped partner gains Rare Candy from eligible active coin holdings. Inactive coins do not generate progress. Candy that would advance an evolution is granted only with its share of evolution funding reserved.',
          'If the reward pool cannot reserve the next Candy increase, progress pauses. Reaching the evolution threshold means its value increase is already covered.',
        ],
      },
      {
        title: 'Evolution must be funded',
        text: [
          'The current demo policy consumes 1,000 Rare Candy and raises value by 50%, with a minimum increase of 0.02 SOL. Its evolution budget is reserved as Candy is granted.',
          'Candy pauses before the threshold if more backing is needed. These demo amounts are provisional economy settings. Eevee randomly becomes Vaporeon, Jolteon, or Flareon, each with a one-third chance.',
        ],
        note: 'You cannot choose an Eevee result. Each successful evolution updates that individual Pokémon and consumes its required candy and funding.',
      },
      {
        title: 'Moves are earned opportunities',
        text: [
          'When a move is available, a prompt appears on the Pokémon. With fewer than four moves, add it to an empty slot. With four, choose a move to forget.',
          'Declining permanently resolves that opportunity for the Pokémon. There is no unrestricted “learn anything” menu. The demo seeds a curated set of earned opportunities; full progression and learnsets need the live game system.',
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
      'Each coin fields its holders’ three strongest Pokémon, with its coin image as the gym badge.',
    pokemon: 68,
    color: '#e7edf9',
    sections: [
      {
        title: 'Support one gym',
        text: [
          'Choose one active coin community to support. You must hold its coin to join. Moving gyms moves your contribution rather than adding it to several teams.',
          'The defence updates from eligible holders’ current Pokémon. Battle copies start at full health; owners keep their originals.',
        ],
      },
      {
        title: 'How defence and league points work',
        text: [
          'Defence strength is the sum of each defender’s six combat stats at its current level. Shiny colour and SOL value do not make it stronger.',
          'The first away-gym victory each UTC day gives points and supplies, up to five different gyms per day. Tougher defences award more. Weekly league points reset every Monday; your career points and badges remain.',
        ],
      },
      {
        title: 'Badges and progress',
        text: [
          'Each gym uses its coin’s image as its badge. Your profile shows the badges you have earned and the gym you support. A badge is a trainer achievement and team identity, not another tradeable Pokémon.',
          'Each rewarded gym win earns one badge, points, berries and revives. Gyms below 1,200 strength do not drop move manuals. Stronger gyms have a 25%, 40% or 60% chance of dropping one random manual, from pools of 10, 20 or 30 moves. View every move and its preview in the gym manual catalogue. An owned manual teaches any Pokémon once and is consumed only when you confirm learning.',
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
        title: 'Play the matchup',
        text: [
          'Check the opponent’s types. Type advantages, your own typing, speed, PP, and the move’s effect all matter. A useful status move or a well-timed switch can beat the strongest-looking attack.',
          'Switching uses a turn. Save an answer for a difficult opponent and watch the whole team’s HP. The current rules are a strategic demo, not a complete cartridge-accurate reproduction of every original move and rule.',
        ],
      },
      {
        title: 'Online and wagers',
        text: [
          'Challenge another trainer in a friendly or wagered match. Review both teams and agree the levels, item limits and stake before you both accept.',
          'A lost Pokémon wager would transfer the selected team—up to all three Pokémon—to the winner. It would not merely start a healing timer. Review the exact team and stake before accepting.',
        ],
        note: 'Demo mode does not connect online matchmaking or real wagers. An offline practice match never becomes a wager.',
      },
    ],
    links: [
      { label: 'Open Battle arena', path: '/battles' },
      { label: 'Build your team', path: '/pokemon' },
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
          'Open the account menu beside the bell for profile and settings. Choose a display name, classic trainer avatar, and accessory colour. Without a display name, a shortened wallet address is used.',
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
          'The bell’s red dot means unread notifications. Open it for ready eggs, funded evolutions, and available actions, or mark the list as read.',
          'The wallet area contains connection settings. This demo cannot sign real transactions. Balances, purchases, and payouts become live only when the backend and wallet flow are connected.',
        ],
      },
    ],
    links: [
      { label: 'Trainer settings', path: '/settings' },
      { label: 'My activity', path: '/activity' },
    ],
  },
];

function liveGuideSection(section: GuideTopic['sections'][number]) {
  const replacements: Record<string, string[]> = {
    'Rare Candy and active holdings': [
      'Your equipped Pokémon earns Rare Candy from verified holdings in active coins. Selling can reset holding progress; inactive coins do not keep generating candy.',
      'A free starter with no SOL backing earns candy only from its originating main-token holding. After its first funded evolution, it can train from any eligible active coin.',
    ],
    'Complete the launch wizard': [
      'The four steps are Details, Partner, Rewards, and Review. Add your own PNG, JPG, or WebP coin image, name, ticker, description, and optional social links. Choose an available Pokémon or your trainer and a reward mode.',
      'Review the wallet transaction before signing. Kanto saves the prepared operation for recovery and lists the coin only after its Solana transaction confirms.',
    ],
    'Open a pack or hatch an egg': [
      'Rewards has separate Eggs and Packs tabs. Packs open immediately. Standard eggs take 20 minutes, Rare eggs 1 hour, and Epic eggs 4 hours; walking can shorten these timers.',
      'Your Pokémon and its full financial backing are sealed when the reward is awarded. Opening reveals that result without rerolling. A reveal adds the individual to My PC and its species to your Pokédex.',
    ],
    'Walking helps the timer': [
      'Open Walking on a phone, allow location access, and keep the page visible. Walking accelerates eggs that are already incubating; their timers also progress normally.',
      'The server checks sample timing, accuracy, speed, and distance, and applies daily and incubation caps. Browser GPS can still be spoofed; it does not provide cheat-proof verification.',
    ],
    'Selling your Pokémon': [
      'Open an eligible Pokémon, choose Sell, and review its displayed redemption amount. A locked Pokémon or free starter cannot be redeemed.',
      'The Pokémon is locked while the payout is processed. Check Redemptions in Portfolio: pending does not mean paid. The payment is complete only after its Solana transaction confirms. Your Pokédex discovery remains.',
    ],
    'How defence and league points work': [
      'The three strongest Pokémon owned by eligible supporting holders defend each gym. Combat stats determine strength; SOL value and shiny colour do not.',
      'The server selects each gym’s three strongest defenders and verifies victories. Weekly league points come from rewarded away-gym wins.',
    ],
    'Online and wagers': [
      'Online rooms use server-controlled teams, turns, and results. Inspect both teams, discuss changes in room chat, and accept the same team, rules and stake. Changes reset both acceptances. Reconnect to restore a running match.',
      'Friendly battles and Pokémon stakes are available when the battle service is ready. Losing a Pokémon wager transfers the selected team to the winner. If a Pokémon faints, choose a living teammate before the next attack turn.',
      'SOL and supported coin-token wagers appear when the connected service has verified its deployed escrow program and worker. Review the matching amount and asset, then approve your deposit in your wallet. Both deposits must confirm before battle; a win is not paid until settlement confirms.',
    ],
    'Know what is connected': [
      'Browse live coin data without signing in. Connect Phantom or MetaMask using a Solana account, then sign a one-time message to access your trainer.',
      'Launching and trading require a separate wallet transaction approval. Feature availability depends on the connected services; pending transactions remain pending until confirmed on Solana.',
    ],
    'Notifications and your wallet': [
      'The bell marks unread notifications for eggs, evolutions, and other available actions. Your wallet settings let you reconnect or disconnect.',
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
              <Icon name={topic.icon} size={17} />
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
                <span>{current.label}</span>
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
    <div className="howto-page">
      <header className="howto-page-heading">
        <div>
          <span className="howto-kicker">TRAINER HANDBOOK</span>
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
