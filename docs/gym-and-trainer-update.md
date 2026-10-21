# Gym and trainer UI update

The matching backend revision must be deployed with migrations 100, 110, 120 and 130 before this frontend runs in live mode. Demo mode retains browser-local state and makes no real payments.

- Three team slots open a focused PC picker with the same sorting choices as My PC. Previous teams are previewed and scoped to the wallet in local storage.
- Practice and gym opponents share the same move/item/switch/replacement AI. Difficulty labels are Easy, Medium, Hard and Master; online battles retain mutual review and acceptance.
- Gyms show their actual three strongest defenders, combat strength, weekly points and non-SOL rewards. Live challenges use server-authoritative turns and resume from bootstrap or URL state.
- My PC's Bag uses earned berries, potions and revives and consumes owned move manuals on confirmed learning. Match bags remain equal and independent of inventory supplies. The green Ready for battle label is removed.
- Battle results appear after the last attack/faint playback and show outcome, team and remaining HP. The Bag has a light palette, individual disabled items and a persistent Back control.
- Move learning and move info use a silent looping preview with the actual battle body sprites, geometry and attack effects. Info buttons replace description dropdowns. Reduced motion is supported; previews loop without a pause control.
- Trainer settings support custom profile pictures, custom banners and four static presets with auto-save. Uploaded images are centre-cropped; the old animated Pikachu cover is removed.
- Reset demo data clears deferred prompt acknowledgements and reopens move/evolution opportunities.
- Eggs now take 20 minutes, 1 hour or 4 hours before walking boosts. Demo saves migrate old egg timers.
- Evolution is offered only when Candy and its reservation are ready. The backend reserves backing with each Candy grant. No client-side preview authorizes a payout or evolution.

Validation includes DOM interaction tests for reset prompts, PC item eligibility, info previews, autosaved banners, bag navigation and team selection, plus battle engine/AI tests and production compilation. Desktop and mobile browser checks cover sprite bounds, picker overflow, menu layering, two-step learning and the success sound.

Gym victories award one badge per eligible win. The manual catalogue contains 30 moves across strength-gated random pools; weak gyms drop no manuals. Deploy backend migration 130 before this frontend.

Initial loading waits for data, fonts, visible image decoding, CSS sprites and battle bodies; later data and artwork loads use skeleton placeholders. PC default ordering pins the partner, then favourites, then combat strength.

Item sprites: original pixel artwork distributed by [PokeAPI/sprites](https://github.com/PokeAPI/sprites/tree/master/sprites/items), using `sitrus-berry.png`, `potion.png`, `revive.png` and `full-heal.png`.
