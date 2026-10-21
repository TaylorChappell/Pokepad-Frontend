# Poképad frontend · interface v11

A Pokémon launchpad frontend built with React, TypeScript, Vite, and Pokémon game artwork. This is a frontend preview: the future Railway backend belongs in a separate repository.

## Try the preview

Build a single-file preview with `npm run preview:file`, then open `artifacts/Pokepad-Preview.html` in a modern browser. It embeds the app, fonts, trainers, normal artwork, and pixel sprites for all 151 Gen 1 Pokémon, including their shiny palettes. Battle front/back animation frames, their metadata for every normal and shiny species, and the battle soundtrack are local project assets. Drawn shiny artwork still loads from PokeAPI’s public sprite repository and needs a network connection. Demo changes persist in that browser when local storage is available.

For development, use Node.js 24:

    npm ci
    npm run dev

The preview starts with sample coins, Pokémon, eggs, and packs. No wallet is connected. Trading, wagering, redemption, and walking use labelled preview flows.

## What changed in interface v11

Battles now use a viewport-constrained, Gen III-inspired battlefield: the rival faces forward at the upper right, while the player's Pokémon uses its actual back sprite at the lower left. Opposing HP panels and a fixed command area keep the action together. The root menu offers only Fight and Pokémon; moves and party choices replace that command area. Team selection is paginated. The layout is intended to avoid document scrolling, with responsive rules for short and narrow screens; browser visual verification remains outstanding.

Battle characters now use full-body PMDCollab Mystery Dungeon animation frames for all 151 Kanto species, including authentic normal and shiny palettes. The player uses the up-right rear direction and the rival uses the down-left front direction. Real Idle, Attack, Shoot, Strike, Kick and other available source action families replace the transformed static FRLG battle art. Each of the 48 playable moves explicitly selects an appropriate available character action; these are reusable source action families, not 151 newly drawn animations for each named move. Some original source clips hold a pose while moving it through their authored frames. Persian and Arcanine have one-frame source idles, so their idle presentation includes a short fidget using actual Walk frames.

The existing eight VFX atlases provide 288 distinct effect frames. Character actions and effects share the cue clock, with emission and impact anchors derived from the selected source frame. Full action bounds and ground markers determine a stable scale and platform position. Normal and shiny artwork is bundled locally, with per-species animation metadata loaded and cached for the selected parties before a match starts. Failed loads can be retried. Reduced motion simplifies playback. This covers the current 48-move frontend catalogue, not all 165 original Gen 1 moves or cartridge-perfect battle mechanics.

The battle soundtrack is the classic Kanto trainer battle recording from HeartGold/SoulSilver. It begins after a battle-button interaction, loops, and has a persistent mute control. Move sounds are synthesized by effect family with move-specific variations. Audio pauses when the page is hidden and stops when leaving the battle. Reduced-motion settings simplify the visual playback.

The header uses the approved coral, cream and navy Poké Ball-on-a-pad symbol and rounded Poképad lettering as one combined lockup. Its matching standalone emblem appears in the favicon and main-token artwork. The generated magnifying-glass search icon remains. The trainer portrait remains separate from the equipped Pokémon. Navigation retains Discover, Create Coin, Portfolio, Rewards and Analytics as its first destinations.

My PC defaults to Ready first: Pokémon with actionable evolution or move-learning opportunities appear before the rest, with coloured outlines and readiness ribbons. Newest, value and level sorts remain available. Summary pages retain the Stats/Moves/Evolution/Details menu, while future evolutions appear as grey silhouettes and question marks until revealed. The extra funding explanation is removed from the evolution interface; affordability and eligibility checks still apply. Eevee retains three equally likely outcomes.

Create coin remains a four-step wizard: Details, Partner, Rewards and Review. Optional social links now expand directly below the description in Details. Entered values persist while collapsed, invalid links stay visible, and the Review edit control returns to the expanded fields. Choose an eligible owned Pokémon or the current trainer. Back/Next controls remain separate from the step content, and reward artwork stays inside its choices.

Discover retains separate coin artwork and mascots, stable hover animation, compact trends, market-cap figures, social links, launch age, reward mode and a wallet-scoped watchlist. Gym leaderboards, analytics, the categorized How-to and autosaving trainer preferences remain available. Creator console is absent. Offline battles never change owned Pokémon or balances; online friendly/wager setup remains disconnected from matchmaking and settlement.

## Pages and interactions

| Area           | Included                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Discover       | Main token, market-cap cards, stable hover mascots, compact trends, socials, launch age, watchlist and sorting          |
| Search         | Coin name/ticker/contract search, trainer name/wallet lookup, public trainer profiles                                   |
| Analytics      | Snapshot totals, volume ranking, reward-mode breakdown, account activity and labelled community examples                |
| Coin           | Illustrative chart, trades, holders, rewards, gym, buy/sell review                                                      |
| Create coin    | Four-step wizard, owned Pokémon or trainer choice, Details links, fixed step controls and local draft                   |
| Portfolio      | Holdings, holding streaks, Pokémon value, equipped partner's Rare Candy                                                 |
| Rewards        | Eggs/Packs/Opened tabs, source coin badges, timers, walking equivalents, reward tables                                  |
| Reveals        | Animated pack opening, egg hatching and evolution, looping reveal stars, reduced-motion setting                         |
| Walking        | Illustrated map, partner, simulated sessions, egg timer acceleration                                                    |
| Inventory      | Ready-first ordering, readiness outlines, search, filters, equip action and move notifications                          |
| Pokémon detail | Persistent actions, Stats/Moves/Evolution/Details menu, move-ready prompt and mystery evolution previews                |
| Pokédex        | All 151 Gen 1 species and permanent discovery history                                                                   |
| Marketplace    | Sample listings, asking prices, own listings and purchase review                                                        |
| Battles        | Fixed Gen III-inspired commands, 48 playable moves, event VFX/audio, local front/back sprites and four bot difficulties |
| Online setup   | Friendly/SOL/token/Pokémon format selection, whole-team loss explanation; no matchmaking or settlement                  |
| Gyms           | League leader and contribution panels, one supported gym, ticker badges, rankings and trainer profiles                  |
| Account        | Autosaving trainer appearance, shoulder portrait, display name, art preference and notifications                        |
| How-to         | Categorized guide to coins, rewards, collection, progression, funding, gyms, battles and account settings               |
| Other          | Starter selection, wallet placeholder, How-to in account help and error states                                          |

The sidebar fits the viewport and becomes a mobile drawer. The header search button opens a keyboard-accessible Pokédex-style panel for coin names, tickers, contract addresses, and trainer names or wallets (Ctrl/⌘ K). Unread notifications show a red dot. The account portrait shows the trainer only; the equipped partner remains available in My PC and the sidebar companion. Settings are reached through the account menu. A Poké Ball startup screen appears on full page loads and clears after the account state is ready.

## Reward and evolution accounting

The proposed allocation is 50% of actually collected creator fees to the creator and 50% to holder rewards. The reward allocation has separate buckets: free pool funds, unopened reward values, issued Pokémon values, and evolution budgets. In the demo, opening uses that reward’s existing allocation plus its originating coin’s free pool to determine affordable outcomes. It assigns the selected species/variant value and next-evolution budget, returns any surplus to the free pool, and transfers those allocations to the new instance. Other unopened rewards’ allocations remain protected; the same liability is never counted twice.

The provisional demo evolution policy requires 1,000 Rare Candy and increases current value by 50%, with a minimum increase of 0.02 SOL. That exact increase must come from an already allocated evolution budget, then any remaining amount from the originating coin's free pool. If the pool cannot cover the shortfall, evolution waits. This is an example product policy, not a live payout promise or final economic model. See [the backend contract](docs/backend-contract.md) for the complete ledger and migration rules.

## Project layout

    src/
      components/   Shared shell, sprite rendering, controls and modal
      data/         Demo seed, reward pools, species stats, sprite bounds and sample moves
      battle/       Practice engine, bot teams, event presentation, sprite atlases and audio control
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

`Coin.marketCap` and `Coin.volume` remain SOL amounts. Optional `marketCapUsd` and `volumeUsd` are separate display quotes; `launchedAt` is a Unix timestamp in milliseconds. Optional `priceHistory` contains ordered numeric price samples for the card trend. Local fixtures use `DEMO_SOL_USD = 150` solely to produce sample USD figures. The HTTP adapter never applies this fixture conversion. Analytics currently summarizes the snapshot rather than calling a platform analytics endpoint; live community events need a separate server feed.

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

Practice battles use 48 playable moves with authored effects and simplified damage, not all 165 original Gen 1 moves or a complete original-generation battle simulator. The battle view is Gen III-inspired, with full-body PMDCollab Mystery Dungeon sprites and a HeartGold/SoulSilver Kanto soundtrack; it is not a ROM-perfect recreation. The future backend must implement complete rules and learnsets, level progression, movement verification, holding/indexer policy, Rare Candy accrual, funded reward issuance, wallet authentication, escrow, and settlement. No such backend is included.

Demo reward and Eevee randomness run locally and are not secure against a client owner. Reward odds are conditional on the currently affordable pool and may change before opening; live issuance needs immutable funded batches and authoritative server results. Save migration preserves existing owned values, defaults missing variants to normal, and does not invent evolution funds or move opportunities.

Displayed stats use actual species base stats with a consistent demo assumption of neutral nature, 31 IVs, and 0 EVs. HP derives from species and level; missing legacy HP defaults to full health. These are modern six-stat displays, not exact original Red/Blue stat rules. Practice battles remain simplified and do not provide a persistent healing or competitive rules system.

Build and interaction checks should be complemented by desktop and mobile visual review after deployment. The available browser environment previously could not open this preview because of its URL policy. Exact layout and audio playback still need real-browser review; source-frame bounds and DOM checks do not replace that review.
