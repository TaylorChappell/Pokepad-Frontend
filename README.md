# Kanto frontend · interface v16

A Pokémon launchpad built with React, TypeScript and Vite. This repository contains the frontend; the matching API and workers live in [TaylorChappell/kanto-backend](https://github.com/TaylorChappell/kanto-backend).

## Run locally

Use Node.js 24:

```bash
npm ci
npm run dev
```

Copy `.env.example` to `.env.local` when connecting an API. An empty `VITE_API_BASE_URL` selects the local demo with sample coins, Pokémon and rewards. Setting it to an HTTPS API origin enables live mode. API failures remain visible and never silently substitute demo balances or inventory.

```bash
npm test
npm run build
```

`npm run preview:file` also produces `artifacts/Kanto-Preview.html`, a single-file demo. Most artwork, fonts, sprites and battle audio are bundled; drawn shiny artwork needs a network connection. Deploy the normal `dist/` build to GitHub Pages.

## Interface and implemented flows

| Area               | Current behavior                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shell              | Kanto emblem and wordmark loading screen, trainer shoulder portraits, keyboard-accessible search, notifications and account settings                               |
| Discover           | Compact starter banner, main-token starter link, market-cap cards, separate coin logos and hover mascots, socials, launch age and watchlist                        |
| Search             | Coin name/ticker/contract search and public trainer name/wallet lookup                                                                                             |
| Create coin        | Four-step Details/Partner/Rewards/Review wizard, image upload, expandable social links, owned Pokémon or trainer partner, wallet signing and confirmation recovery |
| Coin               | Market-cap line chart, creator profile, trades, rewards, gym and signed buy/sell flow                                                                              |
| Portfolio          | Verified holdings, holding streaks, current Pokémon backing, Rare Candy and pending/confirmed redemptions                                                          |
| Rewards            | Eggs/Packs/Opened tabs, source coins, incubation progress and synchronized hatch/pack/evolution reveals                                                            |
| Walking            | Mobile location sessions and server-calculated egg acceleration in live mode; labelled simulation in demo mode                                                     |
| My PC              | Actionable evolutions/moves first, then combat strength; separate SOL sorting, favourites, search, filters, HP and readiness indicators                            |
| Pokémon summary    | Stats/Moves/Evolution/Details menu, equip, earned move learning/forgetting, mystery evolution previews and exact-value redemption                                  |
| Pokédex            | All 151 Kanto species, separate normal/shiny discovery history and catalogue reference totals                                                                      |
| Battles            | One-to-three Pokémon team picker, searchable roster, selected slots, HP/types/strength, favourites first, online rooms and four offline bot difficulties           |
| Gyms               | One supported gym, coin-image badges, server-scored supporter value and trainer profiles                                                                           |
| Analytics          | Reward SOL earned by trainers, platform trading volume, active users and refreshing Trainer Activity                                                               |
| Account and How-to | Autosaving appearance/name/art/sound preferences, wallet controls and categorized instructions                                                                     |

The trainer portrait contains only the trainer. Pixel artwork is the default, with drawn artwork available in settings. The loader shows only the Kanto emblem and wordmark. Search preserves the page width when opening or closing, and the sidebar becomes a drawer on mobile.

Eligible authenticated main-token holders automatically receive a mandatory starter choice. The server’s saved `starterChosen` flag prevents repeat selections. New earned moves and funded evolutions open the same decision dialogs used in My PC, queued behind other dialogs and battles. **Later** preserves the opportunity in My PC and remembers that prompt per wallet/API in this browser; a different move offer or evolution stage can still prompt. Connected accounts refresh in the background every 10 seconds while visible and on returning to the tab, without replacing newer actions with stale reads.

Favourites improve collection and team selection without changing Pokémon stats or SOL value. Pokédex discoveries remain after ownership ends. Its normal/shiny catalogue totals describe the full reference catalogue; they are **not owned inventory value or redeemable backing**. Older discovery records with no known variant remain unknown rather than being assigned a colour.

There is no marketplace or player asking-price flow. Selling redeems an eligible Pokémon for its recorded funded SOL amount. A pending payout is not displayed as paid, and a locked Pokémon cannot be used in conflicting actions.

## Battles, animation and sound

The viewport-constrained battlefield uses Gen III-inspired HP panels and a fixed Fight/Pokémon/Bag/Surrender command menu. Full-body PMDCollab Mystery Dungeon sprites supply front/back directions and normal/shiny animation frames for all 151 species. The current engine has 48 playable attacks, with authored timing, native pixel effects, source-frame anchors and matching original sound samples. These are reusable source action families and a modernized ruleset, not 151 newly drawn animations per attack or all 165 original Gen 1 moves.

Switching uses Poké Ball recall and release. After fainting, the trainer explicitly chooses a living replacement; simultaneous replacement choices stay private until all required trainers submit. Replacement does not consume another attack turn. Music and effects share the sound preference; hidden pages, cancellation and reduced motion are handled. Reward reveal audio follows the visual timeline, and unavailable or stalled audio cannot block an already-confirmed reveal.

Live online play supports public and invite rooms, server-controlled turns, reconnect and friendly or Pokémon wagers. Both players review their team and stake; losing a Pokémon wager transfers the selected team. Offline bots are always for practice and never transfer assets.

SOL and supported coin-token wagering is implemented through separate on-chain escrow: both trainers accept identical terms, approve their own deposits, and enter battle only after funding confirms. Funding, settlement and refund recovery are reflected in the UI. Availability is determined by the backend's capabilities, **not merely by displaying a wager option**. Enabling it requires the separately deployed immutable escrow program, configured API/worker infrastructure and live wallet acceptance testing. Source implementation alone does not establish that cash wagering is deployed or verified.

## Live reward accounting and demo policy

Live launches allocate **30% of collected creator fees to the creator, 20% to the platform and 50% to holder rewards**. These percentages apply to creator fees, not total trading volume. One rewards treasury keeps separate per-coin ledgers.

Live rewards are selected, sealed and fully funded when awarded, including their future evolution path. Opening reveals the saved outcome without rerolling. The server controls eligibility, timers, ownership, Rare Candy, evolution funding and payouts. The frontend uses authoritative evolution previews, including branch value ranges; it does not infer live increases from demo formulas. A free starter with no SOL backing earns candy only from its originating main-token holding until its first funded evolution.

The demo is an illustrative local model. Its opening flow selects affordable outcomes from the existing reward allocation and its source coin's free pool, protects other allocations and returns surplus funds. Its provisional evolution policy requires 1,000 Rare Candy and a 50% value increase, with a minimum increase of 0.02 SOL. Demo randomness, balances and payouts are not secure or redeemable; they are not the live issuance policy.

## Connect and publish

1. Deploy the separate backend and complete its service/readiness checks.
2. Set this frontend repository's GitHub Actions variable `VITE_API_BASE_URL` to the deployed HTTPS API origin, then rebuild.
3. Configure backend `FRONTEND_ORIGINS=https://taylorchappell.github.io` for the existing Pages host. Use the exact frontend origin without a repository path.
4. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. The included workflow deploys `main`; pull requests and `staging` pushes run checks without deployment.

Repository: [TaylorChappell/Pokepad-Frontend](https://github.com/TaylorChappell/Pokepad-Frontend). Hash routes and the default relative Vite base support repository subpaths and custom-domain roots.

Phantom and MetaMask Solana use Wallet Standard sign-in. Secure cookies can restore the session, with a memory-only bearer fallback; browsers blocking the cookie require a fresh sign-in after reload. A restored session must reconnect its wallet before signing transactions. Disconnecting or switching accounts clears stale private state. No user wallet private key enters the frontend.

Launch, trade and escrow operations preserve reviewed request IDs and pending transaction receipts for recovery. Unknown transaction outcomes are checked before another signature is requested. `VITE_*` values are public browser configuration: keep signing keys, session secrets and private RPC credentials on the backend.

See [the frontend API contract](docs/backend-contract.md) and the [backend deployment documentation](https://github.com/TaylorChappell/kanto-backend). Mobile browser GPS remains spoofable; server plausibility checks and limits reduce abuse but do not prove walking. Live activation still needs deployed infrastructure, real-wallet transaction checks and desktop/mobile visual and audio review.

## Project layout

```text
src/
  components/   Shell, wallet controls, artwork and battle team picker
  pages/        Route screens
  services/     Demo/HTTP adapters, auth, transaction and escrow recovery
  state/        Application state, demo transitions and collection helpers
  battle/       Shared combat rules, bots, sprite presentation and audio
  audio/        Reveal timing and sound playback
  data/         Species, moves, sprite metadata and demo fixtures
  types.ts      Frontend/API view models
public/assets/  Local artwork, sprites, fonts, audio and provenance
scripts/        Asset processing and standalone preview tooling
tests/          Model, API-adapter and DOM interaction tests
docs/           Integration contract and design notes
```

Asset provenance is recorded in `public/assets/ASSET-SOURCES.md`. Tests cover accounting, collection history, favourites, auth lifecycle, transaction recovery, walking, team selection, wager terms, replacement phases and UI interactions. Source and DOM checks supplement, rather than replace, real-browser and funded deployment acceptance.

### Battle review and equal bags

Online rooms now wait in a review stage after a rival joins. Both trainers inspect the complete team snapshots (levels, HP, stats and moves), discuss changes, and explicitly accept the same review version. Either trainer can propose a new team, equal Lv. 50, no items, a standard bag, or a revised monetary stake. Every change clears both acceptances. Wager type and team size stay fixed; create a different room to change those. Leaving during review releases the teams without a forfeit. New rooms require the backend’s `reviewRequired` capability.

The standard battle bag grants each side two Potions (30% maximum HP), one Revive (50% HP), and one Full Heal. Supplies are match-only and identical; a trainer’s collectible inventory cannot increase them. Each valid item use consumes a turn and a single supply. Supplies and legal targets are enforced by the backend, and the offline bot uses the same limits. Items cannot interrupt charge/recharge or substitute for a mandatory faint replacement. Surrender requires confirmation and settles a started wager as a loss.

Deploy the backend migration `090_battle_review.sql` before this frontend. This change adds no purchasable or redeemable items and does not yet distribute gym reward items.
