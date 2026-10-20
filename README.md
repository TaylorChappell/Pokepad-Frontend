# Poképad frontend · v0.2

A Pokémon launchpad frontend built with React, TypeScript, Vite, and locally bundled artwork. This is a frontend preview: the future Railway backend belongs in a separate repository.

## Try the preview

Open the supplied **Pokepad-Preview.html** file in a modern browser. It bundles the app, fonts, trainer sprites, and all 151 Gen 1 Pokémon, and works offline. Demo changes persist in that browser when local storage is available.

For development, use Node.js 24:

    npm ci
    npm run dev

The preview starts with sample coins, Pokémon, eggs, and packs. No wallet is connected. Trading, wagering, redemption, and walking use labelled preview flows.

## What changed in v0.2

Pixel Pokémon are the default, with a drawn-art option in Settings. Local sprite sheets give the Pokémon idle animations; the sidebar partner responds to petting and selected account events. Trainers use classic game sprites with accessory colour choices. The wordmark uses existing Pokémon Solid/Hollow font files beside a custom Poképad logo. Eggs, item art, and the three-page animated Trainer Handbook follow the pixel theme.

Rare Candy replaces Stardust. Evolution increases a Pokémon's SOL value only when the increase can be fully funded from its existing evolution budget and originating coin's reward pool. Eevee's three Kanto evolutions each have an equal one-third chance. Moves are offered as earned, one-time opportunities; learning can replace one of four moves, while declining permanently closes that move for the instance.

Coin creation is a dedicated page. Choose an available Pokémon you own, or launch as your trainer when your inventory is empty. A separate uploaded coin image and website, X, Telegram, and Discord links are supported.

## Pages and interactions

| Area           | Included                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------ |
| Discover       | Illustrated introduction, main token, leading gym, coin discovery, reward-mode filters and sorting     |
| Coin           | Illustrative chart, trades, holders, rewards, gym, buy/sell review                                     |
| Create coin    | Owned Pokémon or trainer identity, separate image, social links, Eggs/Packs/Mixed mode, local draft    |
| Portfolio      | Holdings, holding streaks, Pokémon value, equipped partner's Rare Candy                                |
| Rewards        | Eggs/Packs/Opened tabs, source coin badges, timers, walking equivalents, reward tables                 |
| Reveals        | Animated pack opening, egg hatching and evolution, looping reveal stars, reduced-motion setting        |
| Walking        | Illustrated map, partner, simulated sessions, egg timer acceleration                                   |
| Inventory      | Current Pokémon, search, filters, equip action, evolution and move notifications                       |
| Pokémon detail | Explicit back button, funded evolution, pending learn/forget/decline flow, list/unlist/redeem previews |
| Pokédex        | All 151 Gen 1 species and permanent discovery history                                                  |
| Marketplace    | Sample listings, asking prices, own listings and purchase review                                       |
| Battles        | Friendly practice, teams of up to three, simplified moves/PP/HP, switching and result                  |
| Wager flows    | SOL/token/Pokémon stake review, whole-team loss explanation, practice-only settlement                  |
| Gyms           | One supported gym, ticker badges, inventory-value leaderboard and trainer views                        |
| Account        | Pixel trainer customization, display name, pixel/drawn Pokémon preference, notifications               |
| Other          | Starter selection, creator console, wallet placeholder, three-page handbook and error states           |

The desktop sidebar becomes a mobile drawer. Header search accepts ticker or contract address. Unread notifications show a red dot. The equipped Pokémon overlays the avatar's bottom-left without a circular background.

## Reward and evolution accounting

The proposed allocation is 50% of actually collected creator fees to the creator and 50% to holder rewards. The reward allocation has separate buckets: free pool funds, unopened reward values, issued Pokémon values, and evolution budgets. An opened reward transfers its existing allocations to the resulting Pokémon; it does not create money or debit the pool twice.

The provisional demo evolution policy requires 1,000 Rare Candy and increases current value by 50%, with a minimum increase of 0.02 SOL. That exact increase must come from an already allocated evolution budget, then any remaining amount from the originating coin's free pool. If the pool cannot cover the shortfall, evolution waits. This is an example product policy, not a live payout promise or final economic model. See [the backend contract](docs/backend-contract.md) for the complete ledger and migration rules.

## Project layout

    src/
      components/   Shared shell, sprite rendering, controls and modal
      data/         Demo seed, Gen 1 catalogue, sprite metadata and sample moves
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

The HTTP adapter expects:

- GET /v1/bootstrap → authenticated account view state.
- POST /v1/actions → validate an action and return updated view state.

See [docs/backend-contract.md](docs/backend-contract.md). VITE-prefixed environment variables are public browser configuration; backend secrets belong in Railway.

## Build and check

    npm test
    npm run build

To recreate the single-file offline preview:

    npm run preview:file

The result is artifacts/Pokepad-Preview.html. Deploy the normal dist/ build to GitHub Pages. Formatting is available with npm run format.

Model tests cover funded reward transfer, duplicate opening, egg timing, evolution conservation and insufficient-funds rejection, all three Eevee outcomes, earned move replacement and permanent decline, redemption, starter eligibility, gym scoring, coin-creation eligibility, and legacy-save migration. DOM tests cover the frontend interaction flows.

## Frontend scope and remaining work

All 151 Gen 1 species are in the Pokédex. Animated sprites depict those species using the Black/White game art; they are not original Red/Blue animation frames. Trainers and eggs use FireRed/LeafGreen assets. Provenance is in public/assets/ASSET-SOURCES.md.

Practice battles use a curated move set and simplified damage, not a complete original-generation battle simulator. The future backend must implement complete rules and learnsets, level progression, movement verification, holding/indexer policy, Rare Candy accrual, funded reward issuance, wallet authentication, escrow, and settlement. No such backend is included.

Preview reward outcomes are fixed fixtures. Demo Eevee randomness runs locally and is not secure against a client owner; live randomness and results must be authoritative server outputs. Local storage migration preserves older saves without giving them unearned evolution funds or new move opportunities.

Desktop/mobile visual browser QA remains a handoff check: an approved browser preview capability was unavailable in this environment. Build, model, and DOM checks do not replace that visual review.
