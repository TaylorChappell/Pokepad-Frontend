# Poképad frontend · interface v6

A Pokémon launchpad frontend built with React, TypeScript, Vite, and Pokémon game artwork. This is a frontend preview: the future Railway backend belongs in a separate repository.

## Try the preview

Build a single-file preview with `npm run preview:file`, then open `artifacts/Pokepad-Preview.html` in a modern browser. It embeds the app, fonts, trainers, normal artwork, and pixel sprites for all 151 Gen 1 Pokémon, including their shiny palettes. Drawn shiny artwork and shiny battle back sprites load from PokeAPI’s public sprite repository and need a network connection. Demo changes persist in that browser when local storage is available.

For development, use Node.js 24:

    npm ci
    npm run dev

The preview starts with sample coins, Pokémon, eggs, and packs. No wallet is connected. Trading, wagering, redemption, and walking use labelled preview flows.

## What changed in interface v6

Discover now gives each coin a separate token image, a Pokémon mascot that animates on hover or keyboard focus, market cap, social links, launch age, and a watchlist button. The main token stays prominent; gym rankings live on the Gyms page. Watchlists are saved on this device for each trainer wallet. Market cap and volume use explicit USD quote fields when available, with correctly labelled SOL fallbacks.

The Pokédex-style search panel finds coins and registered trainer profiles by wallet or name. Its orange, yellow, and green lights animate in sequence. The startup screen uses a single Poké Ball, while cleaner Poké Ball icons, a brighter Electric badge, centered collection sprites, and fuller trainer portraits improve the shared interface.

Analytics shows market and reward-pool totals from the available account snapshot, plus separate account activity and clearly labelled community examples. The expanded How-to guide groups explanations by topic and includes links to the relevant screens. Community examples illustrate pack openings, hatches, purchases, and evolutions; they are not real transactions or inputs to the totals.

Offline battles now offer Easy, Medium, Hard, and Master bot teams scaled to the selected party, with different species, type matchups, status effects, setup moves, PP, switching, and turn feedback. These matches are for fun and never change owned Pokémon or balances. Online friendly and wager formats have a preparation screen, but matchmaking and settlement remain disconnected.

Pokémon summaries now put HP, battle stats, moves, value, and evolution together. Owned Pokémon have normal or shiny appearances rather than inheriting their egg’s tier. Genuine shiny palettes identify the variant visually. Both eggs and packs draw from varied, funded Gen 1 pools, with legendary and mythical possibilities and distinct shiny values. Reward tiers affect odds; they do not become Pokémon variants.

The launch page is a five-step wizard: details, Pokémon, rewards, links, and review. Choose an available Pokémon you own, or launch as your trainer when your inventory is empty. Mascot previews animate, and tickers keep case and internal spaces within a ten-character input limit. Uploaded coin images and website, X, Telegram, and Discord links remain independent of that Pokémon. Trainer preferences preview immediately and save automatically.

Rare Candy still funds progression: evolution requires 1,000 Candy and sufficient reward-pool funding for the value increase. Eevee’s three Kanto evolutions each have an equal one-third chance. Earned move prompts allow learning, replacing one of four moves, or permanently declining the opportunity.

## Pages and interactions

| Area           | Included                                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Discover       | Main token, market-cap cards, separate coin images and mascots, socials, launch age, watchlist and sorting |
| Search         | Coin name/ticker/contract search, trainer name/wallet lookup, public trainer profiles                      |
| Analytics      | Snapshot totals, volume ranking, reward-mode breakdown, account activity and labelled community examples   |
| Coin           | Illustrative chart, trades, holders, rewards, gym, buy/sell review                                         |
| Create coin    | Five-step wizard, owned Pokémon or trainer identity, separate image, social links and local draft          |
| Portfolio      | Holdings, holding streaks, Pokémon value, equipped partner's Rare Candy                                    |
| Rewards        | Eggs/Packs/Opened tabs, source coin badges, timers, walking equivalents, reward tables                     |
| Reveals        | Animated pack opening, egg hatching and evolution, looping reveal stars, reduced-motion setting            |
| Walking        | Illustrated map, partner, simulated sessions, egg timer acceleration                                       |
| Inventory      | Current Pokémon, search, filters, equip action, evolution and move notifications                           |
| Pokémon detail | HP, species/level stats, expandable move records, funded evolution, learn/forget/decline and sale previews |
| Pokédex        | All 151 Gen 1 species and permanent discovery history                                                      |
| Marketplace    | Sample listings, asking prices, own listings and purchase review                                           |
| Battles        | Offline teams of up to three, four bot difficulties, type/status strategy, moves/PP/HP and switching       |
| Online setup   | Friendly/SOL/token/Pokémon format selection, whole-team loss explanation; no matchmaking or settlement     |
| Gyms           | One supported gym, ticker badges, inventory-value leaderboard and trainer views                            |
| Account        | Autosaving trainer appearance, shoulder portrait, display name, art preference and notifications           |
| How-to         | Categorized guide to coins, rewards, collection, progression, funding, gyms, battles and account settings  |
| Other          | Starter selection, creator console, wallet placeholder, How-to in account help and error states            |

The sidebar fits the viewport and becomes a mobile drawer. The header search button opens a keyboard-accessible Pokédex-style panel for coin names, tickers, contract addresses, and trainer names or wallets (Ctrl/⌘ K). Unread notifications show a red dot. A small, complete static partner sprite overlays the avatar’s bottom-left without a circular background. Settings are reached through the account menu. A Poké Ball startup screen appears on full page loads and clears after the account state is ready.

## Reward and evolution accounting

The proposed allocation is 50% of actually collected creator fees to the creator and 50% to holder rewards. The reward allocation has separate buckets: free pool funds, unopened reward values, issued Pokémon values, and evolution budgets. In the demo, opening uses that reward’s existing allocation plus its originating coin’s free pool to determine affordable outcomes. It assigns the selected species/variant value and next-evolution budget, returns any surplus to the free pool, and transfers those allocations to the new instance. Other unopened rewards’ allocations remain protected; the same liability is never counted twice.

The provisional demo evolution policy requires 1,000 Rare Candy and increases current value by 50%, with a minimum increase of 0.02 SOL. That exact increase must come from an already allocated evolution budget, then any remaining amount from the originating coin's free pool. If the pool cannot cover the shortfall, evolution waits. This is an example product policy, not a live payout promise or final economic model. See [the backend contract](docs/backend-contract.md) for the complete ledger and migration rules.

## Project layout

    src/
      components/   Shared shell, sprite rendering, controls and modal
      data/         Demo seed, reward pools, species stats, sprite bounds and sample moves
      battle/       Local practice engine and bot team generation
      pages/        Route screens
      services/     Demo and HTTP API adapters
      state/        App context, transitions and gym scoring
      types.ts      Frontend/API view models and actions
      styles.css    Theme, responsive layouts and animations
    public/assets/  Local artwork, sprite sheets, fonts and provenance
    tests/          State invariant and DOM interaction tests
    docs/           Backend contract and design notes

## GitHub Pages

1. Put this project at the root of the dedicated frontend repository.
2. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**.
3. The included workflow builds and deploys on **main**, or when manually dispatched. Pull requests and **staging** pushes run checks without deployment.
4. Routes use URL hashes. Direct links such as /#/rewards?tab=packs work under a repository subpath without server rewrites.
5. The Vite base defaults to ./, supporting both repository URLs and custom-domain roots.

Repository: https://github.com/TaylorChappell/Pokepad-Frontend. Development changes use the staging branch. Promote the frontend to main when you are ready to publish with the included Pages workflow.

## Connect the future Railway backend

Keep the backend in its own repository. Set the frontend repository variable **VITE_API_BASE_URL** to the Railway API's HTTPS origin once that service implements the contract, then rebuild.

For local development, copy .env.example to .env.local and set the same variable. An empty value selects the local demo adapter. With an API configured, failures are shown rather than silently replaced with sample data.

The snapshot and public trainer-directory adapters expect:

- GET /v1/bootstrap → authenticated account view state.
- POST /v1/actions → validate an action and return updated view state.
- GET /v1/trainers?query=... → { trainers: PublicTrainer[] }.
- GET /v1/trainers/:wallet → { trainer: PublicTrainer }, or 404.

`Coin.marketCap` and `Coin.volume` remain SOL amounts. Optional `marketCapUsd` and `volumeUsd` are separate display quotes; `launchedAt` is a Unix timestamp in milliseconds. Local fixtures use `DEMO_SOL_USD = 150` solely to produce sample USD figures. The HTTP adapter never applies this fixture conversion. Analytics currently summarizes the snapshot rather than calling a platform analytics endpoint; live community events need a separate server feed.

See [docs/backend-contract.md](docs/backend-contract.md). VITE-prefixed environment variables are public browser configuration; backend secrets belong in Railway.

## Build and check

    npm test
    npm run build

To recreate the single-file preview:

    npm run preview:file

The result is artifacts/Pokepad-Preview.html. Deploy the normal dist/ build to GitHub Pages. Formatting is available with npm run format.

Model tests cover funded random outcomes, shiny values, legendary availability, health, duplicate opening, egg timing, evolution conservation, all three Eevee outcomes, one-time moves, redemption, eligibility, ticker handling, and save migration. Additional tests cover practice battles, trainer-directory responses, watchlist persistence, and analytics. DOM tests cover the main interaction flows, including the wizard and autosaving settings.

## Frontend scope and remaining work

All 151 Gen 1 species are in the Pokédex. Animated sprites depict those species using the Black/White game art; they are not original Red/Blue animation frames. Trainers and eggs use FireRed/LeafGreen assets. Provenance is in public/assets/ASSET-SOURCES.md.

Practice battles use a curated move set and simplified damage, not a complete original-generation battle simulator. The future backend must implement complete rules and learnsets, level progression, movement verification, holding/indexer policy, Rare Candy accrual, funded reward issuance, wallet authentication, escrow, and settlement. No such backend is included.

Demo reward and Eevee randomness run locally and are not secure against a client owner. Reward odds are conditional on the currently affordable pool and may change before opening; live issuance needs immutable funded batches and authoritative server results. Save migration preserves existing owned values, defaults missing variants to normal, and does not invent evolution funds or move opportunities.

Displayed stats use actual species base stats with a consistent demo assumption of neutral nature, 31 IVs, and 0 EVs. HP derives from species and level; missing legacy HP defaults to full health. These are modern six-stat displays, not exact original Red/Blue stat rules. Practice battles remain simplified and do not provide a persistent healing or competitive rules system.

Build and interaction checks should be complemented by desktop and mobile visual review after deployment.
