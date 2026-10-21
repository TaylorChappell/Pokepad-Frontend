# Kanto frontend API contract · interface v16

The server lives in [TaylorChappell/kanto-backend](https://github.com/TaylorChappell/kanto-backend). Its [API documentation](https://github.com/TaylorChappell/kanto-backend/blob/main/docs/api.md), migrations and tests define authoritative behavior. This document records what the frontend consumes.

## Connection and authentication

`VITE_API_BASE_URL` selects live HTTP mode; an empty value uses local demo state. Live failures never load fixture balances. `VITE_*` values are public; signing keys, session secrets and private RPC credentials must stay on the backend. The backend allowlists the exact frontend origin, such as `https://taylorchappell.github.io`, without a repository path.

| Endpoint                  | Contract                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/auth/challenge` | `{wallet}` → `{challengeId,message,expiresAt}`                                                                                          |
| `POST /v1/auth/verify`    | `{challengeId,signature}` with base58 message signature → `{authenticated,wallet,token,expiresAt}` and a secure HttpOnly session cookie |
| `GET /v1/auth/session`    | `{authenticated,wallet,expiresAt}`; no signing provider is implied                                                                      |
| `POST /v1/auth/logout`    | Revokes the session                                                                                                                     |
| `GET /health/ready`       | `{ready,services,missingConfiguration}`; readiness and missing configuration names, never secret values                                 |

`services/http.ts` sends credentials and an optional memory-only bearer. `services/wallet.ts` supports Phantom and MetaMask Solana, verifies that the exact challenge bytes and expected account were signed, and invalidates account changes. Sessions have a fixed seven-day lifetime, not a separate refresh-token flow. Cookie-blocking browsers need a new sign-in after reload; a cookie-restored account must reconnect a provider before signing a transaction.

## Snapshot, collection and public views

`GET /v1/bootstrap` returns the version-2 `AppSnapshot`. Anonymous responses contain public coins and empty private collections. Live ownership, balances and readiness always come from the server. Optional fields let older snapshots remain readable without inventing missing live data.

| Field                           | Meaning                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pokemon[].favourite`           | Owned-instance preference; no effect on strength, backing or rewards                                                                                                 |
| `pokemon[].evolutionPreview`    | Server policy version, candy requirement, current/next value, reserved funding, funding shortfall and eligibility; optional branch values/chances and min/max ranges |
| `discoveredVariants`            | `{normal:number[],shiny:number[],unknown:number[]}` permanent discovery history; unknown preserves legacy history without guessing a variant                         |
| `pokemonCatalogue`              | `{policyVersion,entries:[{speciesId,normalValue,shinyValue}],totals:{normal,shiny}}`; reference SOL values for the full catalogue, not owned backing                 |
| `starterEligibility`            | `{canChoose,canChoosePikachu,reason?}`; server balance/supply rules decide eligibility                                                                               |
| `redemptions`                   | `{id,pokemonId,speciesId,amountSol,status,signature?}[]`; only confirmed payouts mean paid                                                                           |
| `gyms`, `watchlist`, `features` | Server gym scores, watched coin IDs and service capabilities; no fixture score supplementation in live mode                                                          |

Unopened rewards omit their outcome, shiny flag and Pokémon instance ID. Their zero backing/reserve placeholders do not reveal the sealed financial claim. Opened rewards may include `pokemonInstanceId` for linking to the resulting owned instance.

`POST /v1/actions` uses `Idempotency-Key`, validates account/reward/Pokémon/gym/starter actions and returns the updated snapshot. Favourites use `{type:'pokemon.favourite',id,favourite:boolean}` and require ownership. Live `coin.create`, `walk.progress` and `demo.reset` are rejected; use the dedicated routes below.

Public queries are `GET /v1/trainers?query=...`, `GET /v1/trainers/:wallet` and `GET /v1/analytics`. Watchlists use `GET /v1/watchlist` and `PUT`/`DELETE /v1/watchlist/:coinId`, returning `{coinIds}`. Analytics polls for server totals and public trainer activity. `Coin.marketCap`/`volume` are SOL amounts; optional `marketCapUsd`/`volumeUsd` are explicit quotes, and `launchedAt` is Unix milliseconds. The live adapter never applies the demo SOL/USD conversion.

## Launching and trading

| Endpoint                                 | Request / response                                                                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /v1/uploads/coin`                  | Authenticated, with `Idempotency-Key`; `{imageDataUrl,name,symbol,description,socials}` → `{assetId,image,metadataUri}`                      |
| `POST /v1/coins/prepare`                 | `{assetId,mode,launchKind,pokemonId?,requestId}`; mode `Eggs`/`Packs`/`Mixed`, partner `pokemon`/`trainer`, owned Pokémon UUID when selected |
| `POST /v1/coins/:mint/trades/prepare`    | `{side,amount,slippageBps,requestId}`; buy amount is raw lamports, sell amount is raw token units                                            |
| `POST /v1/transactions/:intentId/submit` | Sign-only fallback: `{signedTransactionBase64}`; the server verifies the exact prepared transaction before broadcasting                      |
| `GET /v1/transactions/:intentId`         | Restores prepared transaction and status: `prepared`, `submitted`, `confirmed`, `failed` or `expired`                                        |
| `POST /v1/coins/confirm`                 | `{intentId,signature}`; HTTP 202 pending or confirmed result                                                                                 |
| `POST /v1/coins/:mint/trades/confirm`    | Same confirmation contract for trades                                                                                                        |

Uploads accept PNG/JPEG/WebP up to 2 MiB, with UTF-8 limits of 32 bytes for names and 13 for symbols. Prepared transactions include `intentId`, `transactionBase64`, `mint`, `blockhash`, `lastValidBlockHeight` and `chain`. Amounts use exact integer strings, converted with the mint's decimals; no floating-point token-unit arithmetic.

The frontend saves a stable request UUID and reviewed body before preparation. Retrying that operation uses the same ID and body; changed terms conflict. Wallet sign-and-send is preferred, with the submit endpoint for sign-only wallets. HTTP 202, disconnects and ambiguous send errors stay pending and are recovered before requesting another signature. A possibly signed transaction cannot be treated as cancelled merely because a dialog closed.

## Walking

`GET /v1/walking/capabilities` advertises limits and mobile-only availability. `POST /v1/walking/start` receives `{device:{mobile,screenWidth,screenHeight,geolocation},requestId}` and returns a session ID, challenge, sequence and expiry.

`POST /v1/walking/:id/samples` receives `{challenge,seq,latitude,longitude,accuracy,timestamp}`. The server returns acceptance/reason, credited/session/daily meters, `nextSeq` and ready egg IDs. The frontend samples at least six seconds apart, advances sequence after every successful response (including filtered locations), and retries identical samples after ambiguous failures. `POST /v1/walking/:id/finish` sends `{challenge}`.

Desktop initiation is disabled. The browser never submits an arbitrary distance total. Server timing, accuracy, speed, replay and progress caps limit abuse, but browser GPS remains forgeable and is not proof of walking.

## Online rooms and replacement phases

`GET /v1/battles/capabilities` advertises `friendly`, `pokemon`, `sol`, `token`, `monetaryWagerReason`, supported `tokens:[{mint,symbol,name,decimals}]`, `solDecimals`, time limits and `maxTeamSize`. The UI uses these capabilities rather than assuming configured funds or services.

| Endpoint                                     | Contract                                                                                                      |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `GET /v1/battles`                            | Public waiting rooms with host, team size and exact wager terms                                               |
| `GET /v1/battles/mine`                       | `{room}` or null; also restores unfinished funding, settlement and refund flows                               |
| `GET /v1/battles/:id`                        | Private seat view with authoritative state and monotonic `revision`                                           |
| `GET /v1/battles/:id/preview?inviteCode=...` | Exact host terms and team size before joining; invite code required for private rooms, no team disclosed      |
| `POST /v1/battles`                           | `{pokemonIds,wager,visibility,requestId,acceptPokemonRisk,...monetaryTerms}`                                  |
| `POST /v1/battles/:id/join`                  | `{pokemonIds,wager,inviteCode?,acceptPokemonRisk,...monetaryTerms}`; team count and wager must match the room |
| `POST /v1/battles/:id/commands`              | `{turn,phase,action:{kind,index},requestId}`                                                                  |
| `POST /v1/battles/:id/leave`                 | Server-controlled cancellation or forfeit                                                                     |

Wager is `friendly`, `pokemon`, `sol` or `token`. Monetary terms are `wagerAmount` (positive raw integer string), `wagerMint` for tokens and `acceptMonetaryRisk:true`. Room views also supply `wagerDecimals` and `wagerSymbol`. The joiner accepts the exact host amount and asset, without rounded float comparison. Pokémon stakes require explicit whole-team loss consent.

Commands use phase `turn` for `move`/`switch`/`item`, and `replacement` for `replace`. Perspective-correct `state.replacementRequired:{player,rival}` identifies who must choose a living reserve. Only required seats submit; simultaneous choices remain private until all required seats are ready. Replacement changes active Pokémon without incrementing the attack turn. Idempotency includes the phase, and `submitted`/`opponentSubmitted` refer to the current phase. Clients discard older revisions that arrive after newer command responses.

## SOL and token escrow

Cash wagering is implemented but capability-gated. It requires a separately deployed on-chain program whose upgrade authority is permanently revoked, verified program configuration and an operating worker. Supported tokens come from eligible indexed Kanto/Pump coins and on-chain mint checks. Code availability is not evidence of live deployment or successful funded acceptance.

After both trainers join, the room enters `review`. Only after both accept the same current review version does a monetary room enter `funding`. The worker initializes escrow; prepare may return `409 ESCROW_INITIALIZING` until that initialization is finalized. The UI waits for `escrow.initialized` and an address before asking for a deposit. The operator funds setup rent; trainers approve their own stake and network fee. Both equal deposits must confirm before the battle becomes active.

| Endpoint                                       | Contract                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `POST /v1/battles/:id/escrow/prepare`          | `{requestId,action:'deposit'                                                                 | 'refund'}` → prepared transaction, intent, chain, blockhash and expiry |
| `GET /v1/battles/:id/escrow/intents/:intentId` | Saved intent and transaction status for recovery                                             |
| `POST /v1/battles/:id/escrow/submit`           | `{intentId,signedTransactionBase64}` for sign-only wallets; exact prepared bytes are checked |
| `POST /v1/battles/:id/escrow/confirm`          | `{intentId,signature}` → pending/confirmed status and signature; refresh the room afterward  |

The room's `escrow` includes asset, mint, raw amount, address, chain, initialization, each seat's deposit, deadlines, refund availability and settlement signature. Status is `awaiting-opponent`, `funding`, `funded`, `settling`, `settled`, `refund-available` or `refunded`. Decimal/symbol display comes from the room's top-level wager terms.

Funding recovery is scoped to API, wallet and room. It preserves request IDs and signing state across retries and reloads. An ambiguous wallet submission is checked rather than signed again. Winning the game does not mean funds were paid: the result remains pending until confirmed settlement, and refunds follow their own wallet/confirmation flow.

## Funding policy and activation

Live creator fees split 30% creator / 20% platform / 50% rewards, with isolated coin ledgers inside one rewards treasury. Issuance selects and fully reserves outcomes and their future evolution path; opening never rerolls. Redemption pays the current recorded claim, not a catalogue estimate, and pending instances are unavailable for conflicting actions. Unfunded starters earn candy only from their originating main-token holding until a funded evolution.

Legacy local storage is a demo-only compatibility path, never authoritative live inventory. Demo reward selection and its provisional 1,000-candy/+50% (minimum 0.02 SOL) evolution formula remain separate from server policy. Unknown historical variants are preserved, and old marketplace remnants migrate without inventing backing.

Before enabling live flows, follow backend deployment instructions for RPC/indexing, fee recipients, token configuration, treasury/escrow workers, backups, flags and readiness. Complete real-wallet funding, confirmation, settlement and recovery acceptance. The current combat rules cover 48 attacks and 151 species, not every cartridge mechanic; reward randomness is server CSPRNG, not a VRF.

## Automatic trainer prompts

The frontend opens mandatory starter selection only for an authenticated wallet whose snapshot matches that wallet and whose server `starterEligibility.canChoose` is true. Once opened it stays required until `profile.starterChosen` is true; temporarily syncing holdings keep the chooser open with its action disabled. The existing atomic `starter.choose` action remains authoritative.

Pending earned move offers and server-funded `evolutionPreview.canEvolve` opportunities queue individual dialogs. Evolution prompts respect the account’s evolution notification preference. Later does not dispatch a decline or spend Rare Candy; it records a browser-local acknowledgement scoped to API origin, wallet and offer/evolution stage. Manual My PC actions remain available. No new backend endpoint or schema is required.

Visible authenticated accounts poll bootstrap every 10 seconds and refresh on window focus/visibility. Background reads are single-flight and are discarded after another action, reload, disconnect or wallet change. Failures preserve the current screen and retry later. Live egg notification updates use this read flow rather than the demo’s timer-triggered sync action.

## Room review and battle supplies (v16)

- `reviewRequired:true` and `battleItems:true` in capabilities identify this protocol. New-room controls stay disabled against older backends.
- `POST /v1/battles/:id/review` accepts `{version,pokemonIds?,rules?,wagerAmount?}`. `rules` is `{items:"none"|"standard",levels:"original"|"level50"}`. Team count, asset and wager mode remain fixed.
- `POST /v1/battles/:id/accept` accepts `{version,accepted,acceptPokemonRisk,acceptMonetaryRisk}`. Both seats must explicitly accept the current version. Stale versions fail; edits reset consent.
- `POST /v1/battles/:id/messages` accepts `{body}` up to 280 characters, private to the participants before acceptance; messages are rate limited and rendered as plain text.
- Room `review` supplies `version`, `rules`, both teams with `accepted` flags and full battle snapshots, and recent messages. Chat revisions do not invalidate acceptance; rule/team/stake changes do.
- Item commands are `{kind:"item",item:"potion"|"revive"|"full-heal",index}` with the ordinary turn, phase and retry UUID. `index` targets the trainer’s own team. Remaining supplies are perspective-correct `state.bags.player` and `.rival`.

The standard bag is two Potions, one Revive and one Full Heal per side. Items consume a turn with priority above switching/attacks. They cannot be used with no eligible target, during charge/recharge, during a required replacement or after defeat. A wiped-out party cannot revive after the result. Bag supplies exist only within the match, cannot be topped up from personal inventory, and never affect funded redemption value. Equal levels affect battle snapshots only; settlement maps health back to the Pokémon’s real maximum HP.
