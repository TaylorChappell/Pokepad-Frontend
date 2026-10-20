import { useState, type CSSProperties } from 'react';
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
    title: 'Your first steps in Poképad',
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
          'Wallet transactions, live trading, verified walking, marketplace purchases, and online settlement need the connected backend. A preview confirmation does not move real funds.',
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
          'When you own Pokémon, launching requires an available Pokémon from your inventory. Listed or locked Pokémon cannot be selected. If your inventory is empty, launch as your trainer instead.',
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
          'Enter the name, ticker, and description; select your Pokémon; choose rewards; add an image and social links; then review the launch. You can go back between steps before submitting.',
          'Website, X, Telegram, and Discord links are optional. Use full links and check them in the review. Here, completion creates a local coin draft. Actual token creation will require a wallet transaction.',
        ],
      },
    ],
    links: [
      { label: 'Create a coin', path: '/create' },
      { label: 'Creator console', path: '/creator' },
    ],
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
          'Select a Pokémon to see its level, HP, typing, battle stats, moves, Rare Candy, and SOL value. Equip it as your partner or manage an available evolution, move, or listing.',
          'Your equipped Pokémon appears beside your avatar and in the sidebar. Listed or locked Pokémon cannot take conflicting actions. Ownership is individual, so you can own several Pokémon of the same species.',
        ],
      },
      {
        title: 'Shiny is a colour variant',
        text: [
          'A shiny uses an alternate palette. There is no separate “Rare Pikachu” or “Standard Pikachu” tier attached to the individual Pokémon.',
          'Normal and shiny variants can have different funded values. The demo gives shinies a higher issuance value; a marketplace asking price is separate. Shiny colour is preserved through the supported evolution flow.',
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
    intro: 'Progress belongs to the Pokémon, and an evolution needs more than candy.',
    pokemon: 5,
    color: '#ffeadb',
    sections: [
      {
        title: 'Rare Candy and active holdings',
        text: [
          'The intended system gives your equipped partner Rare Candy from eligible active coin holdings. A dead coin should not generate ongoing progress. This frontend displays sample candy balances; continuous holding-based accrual needs the backend.',
          'The evolution panel tells you when that Pokémon has enough candy and whether the source coin can cover the value increase.',
        ],
      },
      {
        title: 'Evolution must be funded',
        text: [
          'The current demo policy consumes 1,000 Rare Candy and raises value by 50%, with a minimum increase of 0.02 SOL. It uses an allocated evolution budget first, then the source coin’s available reward pool.',
          'If funding is short, evolution waits. These amounts are provisional economy settings. Eevee randomly becomes Vaporeon, Jolteon, or Flareon, each with a one-third chance.',
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
    label: 'Value & marketplace',
    icon: 'Wallet',
    title: 'Rewards come from real funding',
    intro: 'A Pokémon’s funded value and a seller’s asking price are separate numbers.',
    pokemon: 52,
    color: '#fff0ca',
    sections: [
      {
        title: 'The 50 / 50 fee split',
        text: [
          'The proposed allocation splits collected creator fees equally: 50% to the creator and 50% to holder rewards. The reward pool can only issue values that its collected funds support.',
          'Randomness chooses among affordable outcomes. A pool does not need to distribute everything at once, and cannot select an outcome whose value and required evolution budget exceed its funding. A rising token chart does not create reward cash.',
        ],
      },
      {
        title: 'Value, evolution budget, and asking price',
        text: [
          'The SOL value on an owned Pokémon is its current funded amount. Future evolution money is separate; it is not added to current value or gym contribution.',
          'A listing can have a different asking price. A seller’s chosen price does not increase the underlying funded amount. Compare both before buying.',
        ],
      },
      {
        title: 'Listing and redemption',
        text: [
          'Listing makes the Pokémon unavailable for equipping and conflicting actions. Unlist it to make it available again.',
          'Redemption removes the Pokémon from inventory in exchange for its current funded amount, while its Pokédex discovery stays. Unused evolution funds return to the source pool. Starter restrictions apply until a funded evolution makes it a regular funded instance.',
        ],
        note: 'Marketplace purchases, payouts, signing, and transfers are previews here. No real SOL changes hands in this frontend.',
      },
    ],
    links: [
      { label: 'Marketplace', path: '/marketplace' },
      { label: 'My portfolio', path: '/portfolio' },
    ],
  },
  {
    id: 'gyms',
    label: 'Gyms & badges',
    icon: 'Shield',
    title: 'Put your collection behind a gym',
    intro: 'Each coin has a team identity and a badge built around its ticker.',
    pokemon: 68,
    color: '#e7edf9',
    sections: [
      {
        title: 'Support one gym',
        text: [
          'Choose one active coin community to support. You must hold its coin to join. Moving gyms moves your contribution rather than adding it to several teams.',
          'Gym pages show the team, badge, supporting trainers, and collection-value ranking. Gym support is separate from offline battle difficulty.',
        ],
      },
      {
        title: 'How your collection contributes',
        text: [
          'The contribution uses the current funded value of eligible owned Pokémon. Asking prices and unused evolution budgets do not inflate it.',
          'Scores should follow confirmed ownership and eligibility. External sample scores illustrate this preview; production rankings need a complete view of all supporters.',
        ],
      },
      {
        title: 'Badges and progress',
        text: [
          'Your profile shows badges and the gym you support. A badge is a trainer achievement and team identity, not another tradeable Pokémon.',
          'Featured-gym promotion has been removed from Discover. Rankings remain on the Gyms page.',
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
          'Online is intended for another trainer, with friendly play and optional SOL, coin-token, or Pokémon stakes. It needs a live opponent, authoritative rules, and backend settlement.',
          'A lost Pokémon wager would transfer the selected team—up to all three Pokémon—to the winner. It would not merely start a healing timer. Review the exact team and stake before accepting.',
        ],
        note: 'Online matchmaking and real wagers are not connected here. An offline practice match never becomes a wager.',
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
    title: 'Make Poképad feel like yours',
    intro: 'Your trainer identity, preferred artwork, and collection travel together.',
    pokemon: 7,
    color: '#e0f1f4',
    sections: [
      {
        title: 'Your trainer profile',
        text: [
          'Open the account menu beside the bell for profile and settings. Choose a display name, classic trainer avatar, and accessory colour. Without a display name, a shortened wallet address is used.',
          'Appearance saves automatically. Searching a registered trainer’s wallet opens their profile; an unknown address is not automatically a Poképad account.',
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

function initialTopic() {
  if (typeof window === 'undefined') return 'start';
  const topic = new URLSearchParams(window.location.hash.split('?')[1]).get('topic');
  return topics.some((item) => item.id === topic) ? topic! : 'start';
}
export function GuideManual({ embedded = false }: { embedded?: boolean }) {
  const [selected, setSelected] = useState(initialTopic);
  const [query, setQuery] = useState('');
  const term = query.trim().toLowerCase();
  const matching = topics.filter((topic) =>
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
          <h1>How Poképad works</h1>
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
