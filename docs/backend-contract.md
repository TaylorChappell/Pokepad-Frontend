# Kanto backend integration

The production implementation now lives in the separate [kanto-backend repository](https://github.com/TaylorChappell/kanto-backend). Its [API contract](https://github.com/TaylorChappell/kanto-backend/blob/main/docs/api.md), SQL migrations and server tests are the authority for live behavior.

## Fee and ownership model

Every Kanto coin launches on Pump’s regular SOL-paired infrastructure with permanent creator-fee allocations: 30% to its creator wallet, 20% to the platform, 50% to one shared rewards treasury. These are creator-fee shares, not percentages of total trading volume. The backend keeps an isolated per-coin ledger inside that treasury.

Issued rewards are sealed and fully funded. The server chooses outcomes, verifies timers and ownership, calculates evolution value, records earned move opportunities and signs treasury payouts. The browser cannot mint backing or choose winners. There is no marketplace: Pokémon can be redeemed for their recorded SOL claim.

## Frontend configuration

- `VITE_API_BASE_URL` chooses live HTTP mode; an empty value uses local demo state.
- Use only public configuration in `VITE_*` variables. Never expose RPC credentials, session secrets or signing keys.
- `services/http.ts` handles authenticated requests and structured backend errors.
- `services/wallet.ts` uses Wallet Standard with Phantom and MetaMask Solana, signs exact one-use challenges, and holds bearer credentials only in memory.
- `services/transactions.ts` records pending transaction identities for confirmation/recovery. Preserve the same signed bytes when retrying.
- `LiveWalk` requests server sessions and sends sequential mobile GPS samples. It never submits a claimed kilometer total.
- Online battles use the server’s private seat view and turn revisions; offline bots remain local and never award value.

## State and compatibility

`GET /v1/bootstrap` keeps the version 2 snapshot shape while adding optional server evolution/readiness/gym fields. Anonymous snapshots contain public coins and empty private collections. Unopened reward outcomes, Shiny flags and exact secret liabilities are omitted. Placeholder backing values on sealed rewards are not prize previews.

`POST /v1/actions` supports account, reward, Pokémon, gym and starter actions with `Idempotency-Key`. Live `coin.create`, `walk.progress` and `demo.reset` are rejected; dedicated signed-transaction and walking endpoints replace them.

Legacy local storage remains a demo-only compatibility path. It is never uploaded as authoritative inventory or balances. Existing marketplace listing remnants are migrated back into inventory without changing local demo backing.

## Activation boundaries

Backend code alone does not activate mainnet transactions. Configure the deployed API URL, archival Solana RPC, exact fee recipients, main token, an immutable address lookup table, worker signers, backups and feature flags. Check indexer/treasury health and complete real-wallet acceptance testing first.

Mobile browser GPS remains forgeable; the server checks plausibility, replay and caps without claiming proof of walking. Reward randomness is server CSPRNG, not a VRF. SOL and token cash wagers are rejected until a verified escrow integration exists. The current combat engine implements 48 attacks and all 151 species, rather than every original game mechanic.
