# Temple of Bones

A pixel-art 2D run-and-gun platformer. Jump across a sunken temple's crumbling
ledges and gun down the zombies guarding it — every clean kill leaves behind
a soul you can load as special ammunition.

## Play

Open `index.html` in a browser (or serve the folder with any static file
server). No build step or dependencies. The whole game renders through a
low-res virtual canvas scaled up with nearest-neighbor filtering for a
genuine chunky pixel-art look.

## Controls

- **← → / A D** — move
- **↑ / W** — jump (hold for a higher, longer jump — needed to clear the wider pits)
- **Space / X / J** — shoot in the direction you're facing (hold ↑ or ↓ to aim vertically)
- **1 / 2 / 3 / 4** — switch ammo

## Enemies & souls

| Enemy | Behavior | Soul it drops | Ammo effect |
|---|---|---|---|
| Shambler | Patrols and deals contact damage | none | — |
| Brute | Faster, tankier melee rusher | Berserker soul | Heavy single-target shot (3x damage) |
| Fire Cultist | Stationary, lobs fireballs | Pyromancer soul | Explosive shot: AoE damage + burn DoT |
| Frost Priest | Stationary, lobs ice shards | Frost soul | Freezing shot: AoE slow on everything hit |

Souls are consumed one per special shot — normal ammo is infinite, specials
require harvesting the matching zombie type first.

You have 3 lives and respawn at the last torch-lit checkpoint you passed.
Falling into a pit costs a life instantly, however much HP you have left.
Reach the altar at the far end of the temple to win.
