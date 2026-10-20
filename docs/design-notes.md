# Design and preview notes · v0.2

The updated theme combines warm cream, coral, soft green, sky blue, and yellow with pixel game artwork, framed game-like panels, and a persistent navigation rail. Discover uses illustrated Pokémon artwork to introduce the launchpad while keeping coin discovery and the main token prominent. Gym rankings live on the Gyms page. Search, notifications, and account access remain in the header.

The custom Poképad mark is separate from the wordmark. The name uses existing Pokémon Solid and Hollow font files rather than newly drawn lettering. Pixel display fonts support labels while ordinary text stays readable. Solana values use the bundled Solana brand mark. Asset origins are recorded in public/assets/ASSET-SOURCES.md.

Pixel Pokémon are the default. All 151 Gen 1 species have local animated sprite sheets derived from their Black/White sprites; these are not original Red/Blue animation frames. Drawn artwork remains available through Settings. Idle animation respects reduced-motion preferences and pauses for offscreen sprites where supported.

The sidebar partner always uses pixel art. It responds to petting, selected reward/evolution/gym events, and periodically offers short tips. Trainer avatars use classic FireRed/LeafGreen character sprites with selectable accessory-colour variants. The character and colour are randomized on the first preview load and persist afterward. Display names fall back to a short wallet address. The equipped Pokémon sits at the avatar's bottom-left without a circular backing.

Eggs use local pixel art with distinct tier colours, a source-coin badge, a timer, and a walking equivalent. Pack and egg reveals lead into animated Pokémon results with looping stars. Evolution has a separate transformation sequence. Reduced-motion settings shorten or remove motion. Source text is kept to “From” and the coin identity.

The three-page Trainer Handbook replaces the old introductory step cards. Animated pixel scenes explain choosing a coin, opening packs or hatching eggs, then training and battling. Each page has explicit previous/next controls and a page indicator. Generic all-caps promotional subtitles and decorative sparkle glyphs have been removed from shared page headings.

Inventory means currently owned Pokémon; the Pokédex remembers every discovered species. Pokémon detail has an explicit back button, Rare Candy progress, funded evolution readiness, and one-time move-learning prompts. A player can learn into an empty slot, replace one of four moves, or permanently decline. Eevee's outcome is random rather than a selectable branch. See the backend contract for funding and progression rules; these are not the original games' complete mechanics.

Create coin is a dedicated navigation destination. The launch Pokémon comes from the current eligible inventory, with trainer fallback only for an empty inventory. Uploaded coin artwork and social links are independent of the launch character. The profile no longer includes a recent-adventures panel.

Responsive rules target desktop, laptop, tablet, and narrow mobile widths. The mobile navigation becomes a drawer. Controls include keyboard focus styles, named buttons, modal focus management, Escape handling, a skip link, and result announcements.

This remains an offline-capable frontend preview. Seeded prices, holdings, reward tables, reserves, and other trainers are examples. Trades and payouts do not move funds. The 151-species catalogue is complete, but battle mechanics and learnsets are a smaller sample pending the backend. Build/model/DOM verification cannot establish visual quality on real devices: desktop and mobile visual browser QA was unavailable in this environment and remains a handoff check.
