# Kanto recorded sound effects

62 short, local sound samples are imported from [audinowho/DumpAsset](https://github.com/audinowho/DumpAsset), the audio/content submodule of [PMD: Origins](https://github.com/audinowho/PMDODump). Source revision: `d74394dc662612d6655a4f820553adca1bbcde08` (the submodule revision pinned by PMDODump `68965e74c2f627bcdcffae78c9e1ec1c1b13968a`).

These are existing Pokémon Mystery Dungeon sound recordings distributed with PMDO, replacing Kanto's earlier generic oscillator/noise effects. They are not newly generated audio and are not claimed to be Red/Blue or FireRed recordings. Pokémon and original game sounds belong to their respective owners. The upstream README is preserved in `SOURCE-README.txt`; upstream software licenses are not presented as a license to Pokémon audio.

`manifest.json` records each original source path, pinned URL, Git blob ID, original SHA-256, output SHA-256, duration and file size. `scripts/import-original-sounds.py` verifies original bytes and converts Ogg to broadly supported 44.1 kHz MP3 without changing pitch, speed or channel placement. Only selected files are bundled (about 853 KiB total); no runtime requests go to an external audio host.

## Playback coverage

`src/audio/catalog.ts` explicitly maps all 48 currently playable moves, plus selection, recall/send-out, faint, victory and defeat. Several moves deliberately share appropriate PMD samples, following the pinned PMDO `Data/Skill/*.json` definitions where suitable. For example, Thunderbolt uses `DUN_Shock_Wave`, Psychic uses `DUN_Confusion`, and both powders use `DUN_Stun_Spore`. The frontend chooses segment durations, layering and timings for its own battle presentation. This is not a claim that every move has a separately named original recording or that original game choreography is reproduced exactly.

Egg opening uses `EVT_Egg_Single`, `EVT_Egg`, `EVT_Egg_Hatch` and `JoinTeam`. Evolution uses `EVT_Evolution_Start` and `LevelUp`. Pack opening is a Kanto-specific arrangement of `_UNK_DUN_Rustle`, `EVT_CH02_Box_Open` and `Treasure`; it is not described as an original Pokémon pack-opening effect. The existing HGSS Kanto trainer music remains credited in `../ASSET-SOURCES.md`.

Sound is unlocked by a user gesture, preloaded into a cancellable Web Audio group, and respects one saved preference across battles and reveals. Closing the relevant view, muting or hiding the document cancels both playing and pending effects. Missing or unsupported audio does not block gameplay.
