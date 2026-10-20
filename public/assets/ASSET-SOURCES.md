# Poképad frontend assets

These local files support the requested private Pokémon-themed frontend concept.

- `pokemon/1.png` through `pokemon/151.png`: official-artwork PNG files distributed by the PokeAPI sprites project, retrieved from `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/{id}.png`. Pokémon character artwork belongs to its respective owners.
- `pokemon/back/{id}.png`: back sprites from the same PokeAPI sprites project for battle scenes.
- Gen 1 species names, types and evolution relationships in `src/data/pokemon.ts`: Pokémon Showdown Pokédex data, `https://github.com/smogon/pokemon-showdown/blob/master/data/pokedex.ts`. Later-generation Fairy/Steel typings and evolutions outside IDs 1–151 are removed. This catalogue is display metadata, not a battle simulator.
- `fonts/Nunito.ttf`: Nunito variable font from Google Fonts, `https://github.com/google/fonts/tree/main/ofl/nunito`. License retained in `fonts/Nunito-OFL.txt`.
- `fonts/PokemonSolid.ttf`: Pokémon Solid logo-style font file mirrored at `https://github.com/SaadArqam/Whos-That-Pokemon/blob/master/Pokemon%20Solid.ttf`.

No external API is required to display the bundled artwork.

## Pixel revision — 20 October 2026

- `sheets/1.png` through `sheets/151.png` and `pixel/1.png` through `pixel/151.png`: authentic Black/White animated Pokémon sprites distributed by PokeAPI at `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/{id}.gif`. Every source animation frame is preserved as original-resolution pixels, centred and baseline-aligned in a transparent 96×96 cell. The output PNGs are horizontal sprite atlases, not generated or redrawn Pokémon artwork. The static PNG is the first animation frame. `src/data/sprites.ts` describes each atlas; the preview uses the mean source frame duration for uniform CSS stepping. All 151 Kanto species are included; these are Gen V pixel animations of Gen I Pokémon, not a claim that Red/Blue had these animations.
- `trainers/{red,leaf,misty,brock,blue}.png`: authentic FireRed/LeafGreen trainer front sprites from `https://github.com/pret/pokefirered/tree/master/graphics/trainers/front_pics`. Source names: `red_front_pic.png`, `leaf_front_pic.png`, `leader_misty_front_pic.png`, `leader_brock_front_pic.png`, and `rival_late_front_pic.png`. Trainer variants suffixed with a hex colour change only selected indexed clothing/accessory palette entries; skin, face, pose, and original pixel geometry are preserved. There are six colour variants per trainer, matching the frontend's six accessory choices.
- `pixel/egg.png`: original FireRed/LeafGreen egg sprite from `https://raw.githubusercontent.com/pret/pokefirered/master/graphics/pokemon/egg/front.png`. `egg-standard.png`, `egg-rare.png`, and `egg-epic.png` preserve the original pixels and change only the two green spot palette entries for reward-tier distinction.
- `pixel/items/*.png` and the `pixel/rare-candy.png` alias: original game item pixel sprites distributed by PokeAPI at `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/{item-name}.png`. Items include Rare Candy, Poké Balls, Town Map, Coin Case, VS Seeker, Bicycle, Exp. Share, Old Rod, Amulet Coin, Lucky Egg, Sitrus Berry, Pokéblock Case, Fashion Case, and evolution stones.
- `brand/solana.svg`: unaltered official gradient Solana logomark from `https://solana.com/src/img/branding/solanaLogoMark.svg`, linked from `https://solana.com/branding`.
- `fonts/PokemonHollow.ttf`: matching Pokémon Hollow typeface, mirrored at `https://github.com/dewaldsch/Whos-that-Raider-Pokemon-Sammi/blob/main/Pokemon%20Hollow.ttf`; companion to the existing genuine Pokémon Solid font. Font family metadata was checked: Pokémon Solid is `Pokemon Solid` / `Normal`; this is an existing font file, not newly drawn lettering. Font listing: `https://www.dafont.com/pokemon.font`.
- `fonts/PressStart2P.ttf`: Press Start 2P by CodeMan38 from `https://github.com/google/fonts/tree/main/ofl/pressstart2p`; its OFL retained as `PressStart2P-OFL.txt`.
- `fonts/PixelifySans.ttf`: Pixelify Sans from `https://github.com/google/fonts/tree/main/ofl/pixelifysans`; its OFL retained as `PixelifySans-OFL.txt`.

- `src/data/icons.ts`: free Pixelarticons v1.8.1 glyph paths from `https://github.com/halfmage/pixelarticons`, MIT license retained in `Pixelarticons-LICENSE.txt`.
- `brand/pokepad.svg` and `public/pokepad.svg`: original code-native Poképad cartridge/Pokédex logo created for this frontend.
