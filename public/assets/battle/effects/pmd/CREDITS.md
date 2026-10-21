# Native battle effect sources

Source repository: [PMDCollab/RawAsset](https://github.com/PMDCollab/RawAsset/tree/03c80dad937911572f8fb19903771a47956fc696), pinned at `03c80dad937911572f8fb19903771a47956fc696`.

These existing game pixel effects replace the generated high-resolution battle effect strips. The original PNG bytes are embedded unchanged inside compact SVG atlases. Frame viewports crop transparent margins while preserving the original logical cell, source-pixel positions and pivot. No pixels are repainted, recolored, resampled or generated.

The repository does not supply a README, license file or per-effect artist credits for these selected graphics. This import records their distribution source without assigning another project’s software or sprite license to them. Existing game artwork remains associated with its respective creators.

## Source format

- Particle direction and frame layout follow [RogueEssence DirSheet.cs](https://github.com/RogueCollab/RogueEssence/blob/master/RogueEssence/Content/DirSheet.cs). Particle rows follow Down, DownLeft, Left, UpLeft, Up, UpRight, Right, DownRight; this differs from the SpriteCollab character-sheet row order.
- Five-row sheets store the first five directions and mirror the remaining directions. Two-row sheets store down and down-left, with quarter-turn rotation supplying the other six directions.
- Particle pivots are the center of the original cell, as in `LoopingAnim.GetDrawLoc`. Beam body pivots are bottom-center; beam head/tail pivots are centered, following [BeamSheet.cs](https://github.com/RogueCollab/RogueEssence/blob/master/RogueEssence/Content/BeamSheet.cs). Native beam head, continuous body and tail assets remain separate.
- Particle filenames encode direction format or explicit frame count. Beam `BeamData.xml` encodes total frames. Neither supplies per-frame durations; playback timing in the frontend is application-authored and explicitly identified as such in the catalogue.
- `materialize` is the native 15-frame orb/star/ring burst used for switch release; reverse playback supplies recall.

## Reproduce and verify

`python scripts/import-pmd-native-effects.py` imports the pinned assets listed in `scripts/pmd-native-effects-sources.json`. Each source PNG and beam XML is checked against its pinned Git blob SHA; the catalogue also retains SHA-256 digests and original source coordinates.

Native-resolution raster verification reconstructed all 1,359 logical source frames from the SVG atlases and compared 6,943,968 pixels with the source PNGs. There were zero alpha differences and zero RGB differences.

## Imported images

- `absorb` — [`Particle/Absorb.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Absorb.None.png); 9 frames × 1 direction row(s).
- `aqua_tail_wave` — [`Particle/Aqua_Tail_Wave.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Aqua_Tail_Wave.None.png); 7 frames × 1 direction row(s).
- `beam_column_blue_body` — [`Beam/Column_Blue/Body.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Blue/Body.png); 14 frames × 1 direction row(s).
- `beam_column_blue_head` — [`Beam/Column_Blue/Head.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Blue/Head.png); 14 frames × 1 direction row(s).
- `beam_column_blue_tail` — [`Beam/Column_Blue/Tail.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Blue/Tail.png); 14 frames × 1 direction row(s).
- `beam_column_green_body` — [`Beam/Column_Green/Body.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Green/Body.png); 14 frames × 1 direction row(s).
- `beam_column_green_head` — [`Beam/Column_Green/Head.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Green/Head.png); 14 frames × 1 direction row(s).
- `beam_column_green_tail` — [`Beam/Column_Green/Tail.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Green/Tail.png); 14 frames × 1 direction row(s).
- `beam_column_red_body` — [`Beam/Column_Red/Body.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Red/Body.png); 14 frames × 1 direction row(s).
- `beam_column_red_head` — [`Beam/Column_Red/Head.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Red/Head.png); 14 frames × 1 direction row(s).
- `beam_column_red_tail` — [`Beam/Column_Red/Tail.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Red/Tail.png); 14 frames × 1 direction row(s).
- `beam_column_white_body` — [`Beam/Column_White/Body.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_White/Body.png); 14 frames × 1 direction row(s).
- `beam_column_white_head` — [`Beam/Column_White/Head.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_White/Head.png); 14 frames × 1 direction row(s).
- `beam_column_white_tail` — [`Beam/Column_White/Tail.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_White/Tail.png); 14 frames × 1 direction row(s).
- `beam_column_yellow_body` — [`Beam/Column_Yellow/Body.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Yellow/Body.png); 14 frames × 1 direction row(s).
- `beam_column_yellow_head` — [`Beam/Column_Yellow/Head.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Yellow/Head.png); 14 frames × 1 direction row(s).
- `beam_column_yellow_tail` — [`Beam/Column_Yellow/Tail.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Column_Yellow/Tail.png); 14 frames × 1 direction row(s).
- `beam_lightning_body` — [`Beam/Lightning/Body.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Lightning/Body.png); 6 frames × 1 direction row(s).
- `beam_lightning_head` — [`Beam/Lightning/Head.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Lightning/Head.png); 6 frames × 1 direction row(s).
- `beam_lightning_tail` — [`Beam/Lightning/Tail.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Beam/Lightning/Tail.png); 6 frames × 1 direction row(s).
- `bite` — [`Particle/Bite.Dir8.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Bite.Dir8.png); 4 frames × 8 direction row(s).
- `bubbles_purple` — [`Particle/Bubbles_Purple.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Bubbles_Purple.None.png); 8 frames × 1 direction row(s).
- `burned` — [`Particle/Burned.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Burned.None.png); 12 frames × 1 direction row(s).
- `charge_beam_glow` — [`Particle/Charge_Beam_Glow.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Charge_Beam_Glow.None.png); 35 frames × 1 direction row(s).
- `charge_beam_start` — [`Particle/Charge_Beam_Start.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Charge_Beam_Start.None.png); 42 frames × 1 direction row(s).
- `charge_up` — [`Particle/Charge_Up.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Charge_Up.None.png); 7 frames × 1 direction row(s).
- `circle_purple_out` — [`Particle/Circle_Purple_Out.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Circle_Purple_Out.None.png); 8 frames × 1 direction row(s).
- `circle_white_in` — [`Particle/Circle_White_In.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Circle_White_In.None.png); 8 frames × 1 direction row(s).
- `circle_white_out` — [`Particle/Circle_White_Out.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Circle_White_Out.None.png); 8 frames × 1 direction row(s).
- `confuse_ray` — [`Particle/Confuse_Ray.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Confuse_Ray.None.png); 6 frames × 1 direction row(s).
- `dark_pulse_back` — [`Particle/Dark_Pulse_Back.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Dark_Pulse_Back.None.png); 13 frames × 1 direction row(s).
- `dark_pulse_front` — [`Particle/Dark_Pulse_Front.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Dark_Pulse_Front.None.png); 13 frames × 1 direction row(s).
- `discharge_hit` — [`Particle/Discharge_Hit.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Discharge_Hit.None.png); 10 frames × 1 direction row(s).
- `dragon_pulse_ball` — [`Particle/Dragon_Pulse_Ball.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Dragon_Pulse_Ball.None.png); 4 frames × 1 direction row(s).
- `dragon_pulse_charge` — [`Particle/Dragon_Pulse_Charge.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Dragon_Pulse_Charge.None.png); 24 frames × 1 direction row(s).
- `earthquake_ranger` — [`Particle/Earthquake_Ranger.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Earthquake_Ranger.None.png); 12 frames × 1 direction row(s).
- `ember` — [`Particle/Ember.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Ember.None.png); 9 frames × 1 direction row(s).
- `explosion` — [`Particle/Explosion.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Explosion.None.png); 15 frames × 1 direction row(s).
- `fire_blast` — [`Particle/Fire_Blast.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Fire_Blast.None.png); 15 frames × 1 direction row(s).
- `fire_spin_back` — [`Particle/Fire_Spin_Back.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Fire_Spin_Back.None.png); 57 frames × 1 direction row(s).
- `fire_spin_fireball` — [`Particle/Fire_Spin_Fireball.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Fire_Spin_Fireball.None.png); 7 frames × 1 direction row(s).
- `fire_spin_front` — [`Particle/Fire_Spin_Front.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Fire_Spin_Front.None.png); 57 frames × 1 direction row(s).
- `flamethrower` — [`Particle/Flamethrower.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Flamethrower.None.png); 12 frames × 1 direction row(s).
- `growl` — [`Particle/Growl.Dir8.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Growl.Dir8.png); 6 frames × 8 direction row(s).
- `grudge_lights` — [`Particle/Grudge_Lights.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Grudge_Lights.None.png); 8 frames × 1 direction row(s).
- `harden_rse` — [`Particle/Harden_RSE.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Harden_RSE.None.png); 6 frames × 1 direction row(s).
- `hit_neutral` — [`Particle/Hit_Neutral.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Hit_Neutral.None.png); 4 frames × 1 direction row(s).
- `hit_super_effective` — [`Particle/Hit_Super_Effective.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Hit_Super_Effective.None.png); 6 frames × 1 direction row(s).
- `hydro_cannon` — [`Particle/Hydro_Cannon.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Hydro_Cannon.None.png); 5 frames × 1 direction row(s).
- `ice_rse` — [`Particle/Ice_RSE.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Ice_RSE.None.png); 3 frames × 1 direction row(s).
- `icy_wind_particle` — [`Particle/Icy_Wind_Particle.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Icy_Wind_Particle.None.png); 1 frames × 1 direction row(s).
- `lick` — [`Particle/Lick.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Lick.None.png); 5 frames × 1 direction row(s).
- `light_ball_purple` — [`Particle/Light_Ball_Purple.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Light_Ball_Purple.None.png); 11 frames × 1 direction row(s).
- `materialize` — [`Particle/Materialize.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Materialize.None.png); 15 frames × 1 direction row(s).
- `print_foot` — [`Particle/Print_Foot.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Print_Foot.None.png); 1 frames × 1 direction row(s).
- `puff_brown` — [`Particle/Puff_Brown.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Puff_Brown.None.png); 7 frames × 1 direction row(s).
- `razor_leaf` — [`Particle/Razor_Leaf.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Razor_Leaf.None.png); 8 frames × 1 direction row(s).
- `razor_leaf_charge` — [`Particle/Razor_Leaf_Charge.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Razor_Leaf_Charge.None.png); 27 frames × 1 direction row(s).
- `rock_pieces` — [`Particle/Rock_Pieces.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Rock_Pieces.None.png); 15 frames × 1 direction row(s).
- `rock_slide_back` — [`Particle/Rock_Slide_Back.79.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Rock_Slide_Back.79.png); 79 frames × 1 direction row(s).
- `rock_slide_front` — [`Particle/Rock_Slide_Front.62.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Rock_Slide_Front.62.png); 62 frames × 1 direction row(s).
- `sand_tomb_sand` — [`Particle/Sand_Tomb_Sand.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Sand_Tomb_Sand.None.png); 5 frames × 1 direction row(s).
- `scratch` — [`Particle/Scratch.Dir1.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Scratch.Dir1.png); 7 frames × 1 direction row(s).
- `shock_wave` — [`Particle/Shock_Wave.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Shock_Wave.None.png); 4 frames × 1 direction row(s).
- `sky_attack` — [`Particle/Sky_Attack.Dir2.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Sky_Attack.Dir2.png); 1 frames × 2 direction row(s).
- `slash` — [`Particle/Slash.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Slash.None.png); 8 frames × 1 direction row(s).
- `sleep_z` — [`Particle/Sleep_Z.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Sleep_Z.None.png); 3 frames × 1 direction row(s).
- `solar_beam_charge` — [`Particle/Solar_Beam_Charge.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Solar_Beam_Charge.None.png); 50 frames × 1 direction row(s).
- `solar_beam_particle` — [`Particle/Solar_Beam_Particle.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Solar_Beam_Particle.None.png); 4 frames × 1 direction row(s).
- `spark` — [`Particle/Spark.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Spark.None.png); 4 frames × 1 direction row(s).
- `sparkle_rse` — [`Particle/Sparkle_RSE.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Sparkle_RSE.None.png); 5 frames × 1 direction row(s).
- `spores_rse_green` — [`Particle/Spores_RSE_Green.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Spores_RSE_Green.None.png); 8 frames × 1 direction row(s).
- `spores_rse_purple` — [`Particle/Spores_RSE_Purple.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Spores_RSE_Purple.None.png); 8 frames × 1 direction row(s).
- `string_shot_ball` — [`Particle/String_Shot_Ball.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/String_Shot_Ball.None.png); 5 frames × 1 direction row(s).
- `string_shot_web` — [`Particle/String_Shot_Web.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/String_Shot_Web.None.png); 7 frames × 1 direction row(s).
- `swift_star` — [`Particle/Swift_Star.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Swift_Star.None.png); 2 frames × 1 direction row(s).
- `swords_dance` — [`Particle/Swords_Dance.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Swords_Dance.None.png); 5 frames × 1 direction row(s).
- `synthesis_sparkle` — [`Particle/Synthesis_Sparkle.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Synthesis_Sparkle.None.png); 7 frames × 1 direction row(s).
- `tailwind` — [`Particle/Tailwind.Dir1.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Tailwind.Dir1.png); 25 frames × 1 direction row(s).
- `thorn_pink` — [`Particle/Thorn_Pink.Dir2.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Thorn_Pink.Dir2.png); 1 frames × 2 direction row(s).
- `vine_whip` — [`Particle/Vine_Whip.Dir1.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Vine_Whip.Dir1.png); 6 frames × 1 direction row(s).
- `vine_whip_2` — [`Particle/Vine_Whip_2.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Vine_Whip_2.None.png); 3 frames × 1 direction row(s).
- `water_spout_splash` — [`Particle/Water_Spout_Splash.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Water_Spout_Splash.None.png); 4 frames × 1 direction row(s).
- `wave_circle_pink` — [`Particle/Wave_Circle_Pink.Dir5.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Wave_Circle_Pink.Dir5.png); 11 frames × 5 direction row(s).
- `wave_circle_purple` — [`Particle/Wave_Circle_Purple.Dir5.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Wave_Circle_Purple.Dir5.png); 11 frames × 5 direction row(s).
- `wave_circle_yellow` — [`Particle/Wave_Circle_Yellow.Dir5.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Wave_Circle_Yellow.Dir5.png); 11 frames × 5 direction row(s).
- `wing_attack` — [`Particle/Wing_Attack.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Particle/Wing_Attack.None.png); 38 frames × 1 direction row(s).
- `sword_lightblue` — [`Icon/Sword_LightBlue.None.png`](https://github.com/PMDCollab/RawAsset/blob/03c80dad937911572f8fb19903771a47956fc696/Icon/Sword_LightBlue.None.png); 13 frames × 1 direction row(s). This native 16×16 flashing sword supplies compact Swords Dance particles without changing the scene pixel scale.
