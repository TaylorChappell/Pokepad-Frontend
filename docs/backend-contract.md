# Backend integration boundary · v0.2

The static frontend deploys to GitHub Pages using hash routes. The backend belongs in a separate repository and can deploy to Railway. Production balances, funding, movement, progression, random outcomes, and settlement must be server-authoritative. This package implements none of those backend services.

## Adapter and snapshots

src/services/api.ts exposes PokepadApi:

    load(): Promise<AppSnapshot>
    dispatch(action: Action): Promise<AppSnapshot>

The demo adapter persists locally under the existing pokepad.frontend.v1 storage key. The snapshot schema is version 2. Migration accepts version 1 or 2 saves, maps legacy Stardust to Rare Candy, and defaults the art preference to pixel. Missing evolution reserves become zero, not an invented allocation; missing move offers become an empty list. Existing drawn-art preferences are preserved.

VITE_API_BASE_URL selects the HTTP adapter at build time. It uses credentialed requests, an Idempotency-Key header on actions, and a 15-second timeout. Failures do not silently activate demo mode.

src/types.ts is a view-model contract, not a database or ledger schema. Return only the connected account's private state. Public market data can later move to paginated endpoints.

## Proposed endpoints

| Endpoint               | Request                                  | Response                               |
| ---------------------- | ---------------------------------------- | -------------------------------------- |
| GET /v1/bootstrap      | Authenticated session                    | AppSnapshot                            |
| POST /v1/actions       | Permitted Action; Idempotency-Key header | Updated AppSnapshot                    |
| GET /v1/auth/challenge | Wallet and origin                        | Expiring single-use signing challenge  |
| POST /v1/auth/verify   | Signed challenge                         | Session cookie and account identity    |
| POST /v1/auth/logout   | Session                                  | Clears session                         |
| GET /v1/events         | Authenticated event stream               | Reward, notification and battle events |

Only the first two have client adapters. Wallet signing and live event subscription remain future work. Errors should use non-2xx JSON with a user-safe message and stable machine-readable code.

## Actions represented by the frontend

| Action                | Required server checks                                                                                    |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| profile.update        | Account ownership, character/colour allowlists, display name, pixel/drawn preference                      |
| notification.read     | Notification belongs to account                                                                           |
| reward.open           | Ownership, server timer, unopened state, funded allocations, atomic authoritative reveal                  |
| pokemon.equip         | Ownership, no listing/battle lock                                                                         |
| pokemon.evolve        | Ownership, earned Rare Candy, eligible species, no locks, fully funded increase, server random branch     |
| pokemon.learn         | Pending earned offer ID, level/learnset, unconsumed opportunity, valid replacement slot                   |
| pokemon.declineMove   | Pending earned offer ID; durable permanent decline for that instance and move                             |
| pokemon.list / unlist | Ownership, non-starter, compatible locks, valid price                                                     |
| pokemon.redeem        | Ownership, non-starter, backed claim, atomic removal and payout, unused-budget release                    |
| gym.support           | Active coin held, one supported gym, server eligibility                                                   |
| starter.choose        | Main-token holding, one claim, Pikachu strictly above 1% of supply                                        |
| coin.create           | Owned eligible Pokémon or empty-inventory trainer fallback, validated content, token creation transaction |
| sync                  | Reconcile server-owned state                                                                              |

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

The accounting invariant is: collected holder allocation equals free funds plus outstanding base values plus evolution reserves plus completed outflows. Creator allocation is separate. The Creator console illustrates the outstanding buckets for the sample account; it is not a complete all-holder ledger or fee history.

Reserve reward allocations before issuance, atomically. Opening transfers the reward's base value and evolutionReserve to its Pokémon instance, with no second debit and no duplicate liability for the opened reward. Issued eggs remain funded after the holder sells the coin or the coin becomes inactive.

Demo outcomes are fixed fixtures. Live reward outcomes should use auditable randomness against immutable, funded batches, with their funded odds supplied to the frontend. Reserving a conservative batch maximum is an alternative only with a precise reconciliation policy. Do not silently re-roll a reveal when funds become short.

Reward.outcomeSpeciesId may be absent before opening. The UI reveals the authoritative updated snapshot returned by the action. The demo supplies outcomes in advance for offline operation. Pre-reveal reserve visibility may need redesign to prevent amount-based outcome inference.

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

coin.create accepts name, ticker, description, mode, optional pokemonInstanceId, image, and socials. If inventory contains Pokémon, the selected instance must be owned, unlisted, and unlocked. Trainer fallback is permitted only when inventory is empty, not when all owned Pokémon happen to be unavailable.

The launch Pokémon and coin image are independent. Demo uploads accept PNG/JPEG/WebP/GIF data URLs up to approximately 2 MiB. Social links support website, X, Telegram, and Discord with complete http/https URLs and no embedded credentials. Production should validate and store media through its own upload pipeline; never use an unrestricted remote URL fetch to process user content.

Created coins are local drafts with an empty reward pool, not deployed tokens. Trainer-launched coins use launchKind=trainer, pokemonId=0, and a trainer appearance snapshot. Display uploaded art first, otherwise the appropriate Pokémon or trainer.

Profile.artStyle is pixel or drawn, defaulting to pixel. Character, accessory colour, and display name are persisted preferences. The sidebar partner remains a pixel sprite. These settings affect rendering only.

## Gyms, walking and holding

Each trainer supports one active gym. Preview scores sum current Pokémon backing, never asking prices or unused evolution budgets, and include sample aggregates for other trainers. Replace those fixtures with current server-calculated inventory across eligible supporters. Prevent double attribution and define escrow/listing treatment and snapshot timing. If no gym qualifies, feature the main token.

Demo walking removes two hours from egg timers per kilometre. This is a configurable preview parameter. Real verification needs server sessions, device signals, route/speed plausibility, and duplicate detection. A browser cannot supply cheat-proof GPS evidence; show pending/accepted/rejected progress without allowing local timers to mint rewards.

Balances, sales/transfers, active-coin eligibility, holding streaks, and Rare Candy accrual require a chain indexer and explicit server policy. Preview values are samples, not ongoing verified earnings.

## Battles

The local practice engine uses simplified damage, a curated move set, HP, PP, switching, and results. It is not a complete Gen 1 battle simulator, and its result must never authorize settlement.

The backend needs full rules and learnsets, eligible-instance checks, match formats, timeouts, disconnect policy, sequencing, and finality. In Pokémon wagers, all selected losing instances transfer together, including their attached funding records. Unevolved starter instances are excluded by this demo policy.

## Railway deployment considerations

Allow the exact frontend origin in CORS, with credentials and the Idempotency-Key header. Use a suitable session/CSRF design. Default GitHub Pages and Railway domains are cross-site; custom app/API domains under one site avoid reliance on third-party cookies.

Keep signing, RPC, and database credentials server-side. VITE-prefixed frontend variables are public. Authoritative state needs a durable database, not process memory or an ephemeral filesystem.
