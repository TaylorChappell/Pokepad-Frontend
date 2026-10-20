# Backend integration boundary · interface v7

The static frontend deploys to GitHub Pages using hash routes. The backend belongs in a separate repository and can deploy to Railway. Production balances, funding, movement, progression, random outcomes, and settlement must be server-authoritative. This package implements none of those backend services.

## Adapter and snapshots

src/services/api.ts exposes PokepadApi:

    load(): Promise<AppSnapshot>
    dispatch(action: Action): Promise<AppSnapshot>

The demo adapter persists locally under the existing pokepad.frontend.v1 storage key. The snapshot schema is version 2. Migration accepts version 1 or 2 saves, maps legacy Stardust to Rare Candy, and defaults the art preference to pixel. Missing evolution reserves become zero, not an invented allocation; missing move offers become an empty list. Existing drawn-art preferences are preserved. Missing `OwnedPokemon.shiny` becomes false, and deprecated `rarity` labels are cleared without changing funded values. Missing health becomes the species/level maximum; supplied HP is clamped to a valid range. Only local demo migration clears unopened fixed outcomes so those rewards can use the new random pool; it preserves their existing allocations. The HTTP adapter does not run that local migration over authoritative live outcomes.

VITE_API_BASE_URL selects the HTTP adapter at build time. It uses credentialed requests, an Idempotency-Key header on actions, and a 15-second timeout. Failures do not silently activate demo mode.

src/types.ts is a view-model contract, not a database or ledger schema. Return only the connected account's private state. Public market data can later move to paginated endpoints.

## Proposed endpoints

| Endpoint                 | Request                                  | Response                               |
| ------------------------ | ---------------------------------------- | -------------------------------------- |
| GET /v1/bootstrap        | Authenticated session                    | AppSnapshot                            |
| POST /v1/actions         | Permitted Action; Idempotency-Key header | Updated AppSnapshot                    |
| GET /v1/trainers         | query string                             | { trainers: PublicTrainer[] }          |
| GET /v1/trainers/:wallet | Exact wallet address                     | { trainer: PublicTrainer }, or 404     |
| GET /v1/auth/challenge   | Wallet and origin                        | Expiring single-use signing challenge  |
| POST /v1/auth/verify     | Signed challenge                         | Session cookie and account identity    |
| POST /v1/auth/logout     | Session                                  | Clears session                         |
| GET /v1/events           | Authenticated event stream               | Reward, notification and battle events |

Bootstrap, actions, and the two public trainer routes have client adapters. Wallet signing and live event subscription remain future work. Errors should use non-2xx JSON with a user-safe message and stable machine-readable code.

## Market quotes, price history, launch age and watchlists

`Coin.marketCap` and `Coin.volume` retain their existing SOL units. `Coin.marketCapUsd?: number` and `Coin.volumeUsd?: number` are independent USD display quotes. Supply finite values from the market-data service; do not reinterpret the SOL fields as dollars. Coin cards use each available USD quote or an explicitly labelled SOL fallback. `Coin.launchedAt?: number` is the original launch timestamp in Unix milliseconds, not the time of the latest fetch. Coins without a timestamp show unavailable age; new local drafts receive the current time.

`src/data/coin-presentation.ts` decorates only initial demo data and migrated local saves. It uses the fixed illustrative `DEMO_SOL_USD = 150` to fill absent USD fields, supplies fixture ages for known sample coins, and supplies their separate token artwork. This is not a price oracle. The HTTP adapter does not decorate live responses. New local coin drafts have zero SOL/USD market figures and an empty reward pool.

`Coin.priceHistory?: number[]` supplies ordered price samples for the compact coin-card trend. The renderer requires at least two finite, non-negative values; constant histories render as a flat line. These unlabelled trends do not imply a specific currency or time window. Supply samples consistently from the market-data service, and introduce explicit time/currency metadata before presenting axis labels or a named interval. Without valid history, live cards show an empty trend area. Only the eight known demo coin IDs can receive deterministic sample curves, and those graphics are labelled as demo samples in their accessible text. New coin drafts do not receive invented history. Hover playback and chart display do not alter price, ownership, or rewards.

Watchlists are local preferences in `pokepad-watchlist-v1:<wallet>`, storing coin IDs and responding to browser storage events. They do not buy tokens, update the account snapshot, or submit an API action. A future synchronized watchlist needs its own authenticated endpoint; this version does not imply cross-device persistence.

## Public trainer directory

`src/services/trainers.ts` provides `search(query, own?, signal?)` and `get(wallet, own?, signal?)`, selected with the same `VITE_API_BASE_URL`. Search requests use `GET /v1/trainers?query=<encoded text>`; direct profile requests use `GET /v1/trainers/<encoded wallet>`. Requests include credentials, support cancellation, and time out after 12 seconds. Remote searches start at two trimmed characters. The client combines a matching current-account profile with returned results, removes its duplicate, and displays at most eight.

Return the `PublicTrainer` view defined in that service: wallet, displayName, character, accessoryColor, optional partnerId, pokemon, discovered, badges, and optional supportedGym. Each public Pokémon exposes only its instance ID, species ID, level, shiny variant, and current value in SOL. A direct lookup must return the requested wallet exactly; 404 means no profile. Return only information approved for public display, not the private `AppSnapshot`, unpublished rewards, or balances. The backend owns registration, wallet identity, visibility policy, and search rate limits.

Without an API origin, the directory searches the current demo account and two named fixture trainers. Arbitrary blockchain addresses are not automatically indexed. Errors from a configured API are shown rather than replaced with sample trainers. The public route is `#/trainer/<wallet>`.

## Analytics and community activity

`src/pages/Analytics.tsx` derives its totals from the coins in `AppSnapshot`: combined market cap, reported volume, active-coin count, free reward pools, and reward-mode counts. These cover the available snapshot, not a complete platform ledger or a historical time series. Volume is the snapshot's reported amount; the current contract has no explicit measurement-window field. Aggregate market figures use USD only if every returned coin has both finite USD quote fields; otherwise both totals consistently use SOL. Free reward-pool totals include `Coin.vault` only and exclude outstanding Pokémon values and evolution allocations.

The account feed maps `AppSnapshot.activity` to display events. A separate, explicitly labelled community preview contains fixed examples of hatches, pack openings, marketplace purchases, evolutions, and launches. These examples are never added to metrics and do not represent settled transactions. The live adapter defaults to account activity, although the labelled example view remains available.

There is no analytics endpoint or event subscription wired into this revision. A production service should supply a dedicated aggregate response with coverage, measurement windows, quote currency and timestamp, plus a paginated public event feed or stream. Events need stable IDs, server timestamps, explicit event kinds, public trainer identity, coin/instance references, outcome visibility, and settlement status. Send only completed public reveals and confirmed purchases to that feed; keep unopened outcomes and private account events private. Replace the example provider without mixing fixtures into live totals.

## Actions represented by the frontend

| Action                | Required server checks                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| profile.update        | Account ownership, character/colour allowlists, display name, pixel/drawn preference                  |
| notification.read     | Notification belongs to account                                                                       |
| reward.open           | Ownership, server timer, unopened state, funded allocations, atomic authoritative reveal              |
| pokemon.equip         | Ownership, no listing/battle lock                                                                     |
| pokemon.evolve        | Ownership, earned Rare Candy, eligible species, no locks, fully funded increase, server random branch |
| pokemon.learn         | Pending earned offer ID, level/learnset, unconsumed opportunity, valid replacement slot               |
| pokemon.declineMove   | Pending earned offer ID; durable permanent decline for that instance and move                         |
| pokemon.list / unlist | Ownership, non-starter, compatible locks, valid price                                                 |
| pokemon.redeem        | Ownership, non-starter, backed claim, atomic removal and payout, unused-budget release                |
| gym.support           | Active coin held, one supported gym, server eligibility                                               |
| starter.choose        | Main-token holding, one claim, Pikachu strictly above 1% of supply                                    |
| coin.create           | Explicit trainer or owned eligible Pokémon choice, validated content, token creation transaction      |
| sync                  | Reconcile server-owned state                                                                          |

walk.progress and demo.reset are demo-only actions; reject them on the live API. Start and finish verified walking sessions through a separate backend interface. Never accept client distance as authoritative.

Trade, purchase, and wager screens are review/practice flows. They do not submit live orders or escrow transactions. Add intent, signing, confirmation, and settlement endpoints when those operations are implemented.

## Reward ledger and conservation

The demo exposes SOL numbers for display and converts accounting calculations to integer lamports. The production ledger must store exact integer amounts throughout and convert at the view boundary.

Split actually collected creator fees 50/50 between creator and holder rewards. Token price changes and expected future volume do not fund rewards. Within each coin's reward allocation, keep distinct accounts for:

- Free pool funds, represented by Coin.vault.
- Base values assigned to unopened rewards, represented by Reward.backing.
- Realized values assigned to issued Pokémon, represented by OwnedPokemon.backing.
- Future evolution budgets in unopened rewards and owned Pokémon, represented by evolutionReserve.
- Completed redemptions and any other explicitly authorized outflows.

The accounting invariant is: collected holder allocation equals free funds plus outstanding base values plus evolution reserves plus completed outflows. Creator allocation is separate.

The local demo draws on opening from `src/data/rewardPools.ts`. It combines the reward’s existing `backing` and `evolutionReserve` with the originating `Coin.vault`, filters out outcomes whose value plus next-evolution reserve exceed that budget, then draws by the remaining normalized weights. It returns surplus to that coin’s free pool and transfers the chosen allocations to the new instance. Other rewards’ reserves are excluded. If no outcome is affordable, the action leaves the original state unchanged.

All 151 species have normal and shiny entries. Egg tier and reward kind affect weights; each species/variant has one provisional issuance value independent of tier. Demo shiny issuance value is three times the normal value. Legendaries and Mew are available only when the pool can afford them. The displayed odds are conditional on current funding, so another opening may change them. These prices and odds are sample configuration, not market quotes or a final economy.

Production must reserve allocations before issuance atomically and define immutable, funded batches with auditable odds supplied to the frontend. An issued egg’s committed outcome must remain funded after a holder sells or a coin becomes inactive. Do not reproduce the demo’s mutable opening-time pool as an undisclosed fixed-odds product, or re-roll an already committed outcome when funding falls. Opening must transfer liabilities without a second debit or double-counting the opened reward.

`Reward.outcomeSpeciesId` and `Reward.shiny` may be absent before opening. The frontend reveals the authoritative updated snapshot returned by `reward.open`; it does not send a requested species or variant. Live batch odds and commitments need a dedicated response model beyond the current demo table. Pre-reveal reserve visibility may also need redesign to prevent amount-based outcome inference.

Opening, evolution, payouts, and settlement require durable transaction constraints and idempotency across retries and multiple tabs. Frontend guards alone provide no security.

## Funded evolution

The provisional demo policy consumes 1,000 Rare Candy and raises the current Pokémon value by 50%, with a minimum increase of 0.02 SOL. These numbers are example product settings, not a final economy or a promise that every future evolution is funded.

OwnedPokemon.evolutionReserve is already allocated money for a future increase. On evolution, consume that reserve first and atomically debit any shortfall from the originating coin's free pool. If the full increase is unavailable, reject the action without changing species, candy, or balances. A ready-candy state alone is therefore insufficient for evolution.

After a successful evolution, the demo allocates as much of the next evolution's budget as the remaining originating pool can afford. This can be a partial reserve. The UI uses getEvolutionStatus to distinguish current value, increase, existing reserve, funding still needed, and readiness. Inventory value and gym score include current backing only; unused evolution budgets do not inflate either.

pokemon.evolve accepts only an instance ID. The client cannot select an evolution target. Eevee has exactly equal one-third chances of Vaporeon, Jolteon, and Flareon. Offline code uses crypto.getRandomValues with rejection sampling; tests can inject each branch. A live backend must select and durably record the result using its authoritative randomness policy. Client cryptography cannot stop an owner modifying or resetting their local preview.

Starter Pokémon begin at zero value. Claiming reserves an initial evolution budget only from available main-token funds. Their first funded evolution makes them a regular funded instance in this provisional policy. Redemption pays only current backing, returns any unused evolutionReserve to the originating pool, and preserves the Pokédex discovery. Marketplace asking prices remain separate from funded value.

## One-time move opportunities

OwnedPokemon.moveOffers contains earned opportunities with a stable ID, move, level, and pending/learned/declined status. The next available offer must be pending, meet the instance's level, not already be known, and have no prior decline of the same move. The frontend shows only that eligible offer.

pokemon.learn sends the instance ID, offer ID, and optional replaceIndex. An empty slot is used when fewer than four moves are known; otherwise the player must explicitly choose a current move to forget. No arbitrary move name is accepted from the client. Acceptance consumes the offer.

pokemon.declineMove permanently resolves the opportunity and suppresses later offers for the same move on that instance. Persist this history across transfers and reloads. The server must create offers from verified level progression and a complete approved learnset; the preview only seeds a few earned examples and does not implement a full level-up system.

## Coin creation and profile preferences

`coin.create` accepts name, ticker, description, mode, `launchKind`, optional `pokemonInstanceId`, image, and socials. The current wizard sends an explicit `launchKind` of `trainer` or `pokemon`. A trainer launch is allowed with any inventory size and must omit `pokemonInstanceId`. A Pokémon launch must identify an owned, unlisted, unlocked instance; conflicting trainer-plus-instance input is rejected. The local action type keeps `launchKind` optional for compatibility with older actions: an instance selects Pokémon mode, while an empty inventory without an instance can retain the old trainer default. New clients should use the explicit choice.

The wizard has four steps: Details, Partner, Rewards, and Review. Coin and Links are subpanels within Details, and all provided links must validate before advancing. Back/Next controls stay outside the step’s scrollable content region. The UI submits one final action rather than separate partial token-creation requests.

The ticker input preserves case, printable punctuation, and internal spaces. It accepts 1–10 characters using the browser's input-length convention, requires non-whitespace content, and rejects ASCII control characters. Submission trims surrounding whitespace and does not uppercase the result. Duplicate tickers are allowed: coin IDs and contract addresses identify coins. The ten-character input limit matches the public [Pump creation form](https://pump.fun/create) inspected on 20 October 2026; this does not establish a universal Solana metadata byte limit. The future token-creation service must validate its chosen mint/metadata program's encoded limits and return any error before signing, without silently rewriting the ticker.

The launch Pokémon and coin image are independent. The coin snapshots the selected species and shiny appearance in `pokemonId` and `pokemonShiny`, so its mascot matches the chosen instance. Demo uploads accept PNG/JPEG/WebP/GIF data URLs up to approximately 2 MiB. Social links support website, X, Telegram, and Discord with complete http/https URLs and no embedded credentials. Production should validate and store media through its own upload pipeline; never use an unrestricted remote URL fetch to process user content.

Created coins are local drafts with an empty reward pool, not deployed tokens. Trainer-launched coins use launchKind=trainer, pokemonId=0, and a trainer appearance snapshot. The token avatar uses uploaded art or a neutral monogram; the Pokémon or trainer remains a separate mascot presentation. Mascot previews animate during the launch wizard, subject to reduced-motion preferences.

Profile.artStyle is pixel or drawn, defaulting to pixel. Character, accessory colour, and display name are persisted preferences. The sidebar partner remains a pixel sprite. The account editor previews preferences immediately and sends debounced `profile.update` actions automatically; the API must support repeated idempotent preference updates. Brock and Blue garment colours are rendered with pixel-aligned SVG overlays over the original PNGs; this presentation helper does not add profile fields. The header no longer displays the equipped Pokémon, while the sidebar companion remains. These presentation changes do not add token deployment or financial authority.

## Gyms, walking and holding

Each trainer supports one active gym. Preview scores sum current Pokémon backing, never asking prices or unused evolution budgets, and include sample aggregates for other trainers. Replace those fixtures with current server-calculated inventory across eligible supporters. Prevent double attribution and define escrow/listing treatment and snapshot timing. If no gym qualifies, use the main token as the fallback on the Gyms page. The redesigned leader and contribution panels are view-only; available trainer roster entries link to public profiles without changing support eligibility.

Demo walking removes two hours from egg timers per kilometre. This is a configurable preview parameter. Real verification needs server sessions, device signals, route/speed plausibility, and duplicate detection. A browser cannot supply cheat-proof GPS evidence; show pending/accepted/rejected progress without allowing local timers to mint rewards.

Balances, sales/transfers, active-coin eligibility, holding streaks, and Rare Candy accrual require a chain indexer and explicit server policy. Preview values are samples, not ongoing verified earnings.

## Pokémon variants, stats and health

The Pokémon summary organizes Stats, Moves, Evolution, and Details through a button menu while keeping identity, HP, value, and primary actions visible. Its move-ready control opens the same earned-offer workflow; selecting a panel does not change stats, learn moves, or allocate funding.

`OwnedPokemon.shiny?: boolean` identifies the colour variant; absent means normal. It is independent of reward tier, persists through evolution and transfer, and changes the provisional reward value, not combat stats. `OwnedPokemon.rarity` is retained only for compatibility and should not define a variant. Never infer shiny status from a legacy Rare/Epic label or reprice an existing funded instance without an explicit funded operation.

`OwnedPokemon.health?: number` is current HP. `src/data/stats.ts` derives maximum HP, Attack, Defense, Special Attack, Special Defense, and Speed from actual species base stats and level using neutral nature, 31 IVs, and 0 EVs. Missing health defaults to maximum; values are bounded to 0–max. Evolution keeps the existing damage amount relative to the new maximum. These are demo assumptions using modern six-stat data, not exact original Gen 1 rules.

Production needs server-owned health, status, nature/IV/EV policy, progression, and healing. The current view model is not a complete competitive stat record. Practice battle HP is match-local and must not be treated as persistent authoritative health.

## Battles

`src/battle/engine.ts` runs local offline practice with one to three Pokémon, a curated move set, type effectiveness, same-type attack bonuses, physical/special damage, speed/priority order, PP, switching, selected status effects, stat stages, healing, and move-specific trade-offs. Easy, Medium, Hard, and Master generate different-species rival teams targeting approximately 0.76×, 1×, 1.2×, and 1.42× the player's team strength. Level and practice stat scaling support those targets; stronger bots also make more tactical move and switching choices. These are demo balancing settings, not the original cartridge's complete rules.

The lobby displays a labelled possible matchup and an editable party preview, with challenge choices beside the arena. These previews use the same relative-strength generation policy; opening the lobby does not start a match. Battle state and the practice win streak are local to the screen. Offline matches do not dispatch ownership or balance changes, issue rewards, charge stakes, or persist damage. The Online tab exposes friendly, SOL, token, and Pokémon setup controls, but its matchmaking button is disabled and it sends no matchmaking request or escrow instruction. No local battle result may authorize a payout or transfer.

The backend needs full rules and learnsets, eligible-instance checks, match formats, timeouts, disconnect policy, sequencing, and finality. In Pokémon wagers, all selected losing instances transfer together, including their attached funding records. Unevolved starter instances are excluded by this demo policy.

## Railway deployment considerations

Allow the exact frontend origin in CORS, with credentials and the Idempotency-Key header. Use a suitable session/CSRF design. Default GitHub Pages and Railway domains are cross-site; custom app/API domains under one site avoid reliance on third-party cookies.

Keep signing, RPC, and database credentials server-side. VITE-prefixed frontend variables are public. Authoritative state needs a durable database, not process memory or an ephemeral filesystem.
