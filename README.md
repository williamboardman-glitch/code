# Necromancer's Nest

A 2D browser sniper game. You're a necromancer picking off marching skeletons
from a fixed vantage point — but every clean kill leaves behind a soul you can
harvest and load as special ammunition.

## Play

Open `index.html` in a browser (or serve the folder with any static file
server). No build step or dependencies.

## Controls

- **Mouse** — aim
- **Left click** — fire (a headshot is an instant kill, any ammo type)
- **Hold right click** — scope in, slowing time for precision shots
- **1 / 2 / 3 / 4** — switch ammo

## Enemies & souls

| Enemy | Behavior | Soul it drops | Ammo effect |
|---|---|---|---|
| Skeleton Grunt | Walks straight at you | none | — |
| Berserker | Fast, zigzagging rusher | Berserker soul | Heavy single-target shot (3x damage) |
| Pyromancer | Stops at range, lobs fireballs | Pyromancer soul | Explosive shot: AoE damage + burn DoT |
| Frost Witch | Stops at range, casts frost bolts | Frost soul | Freezing shot: AoE slow on all enemies hit |

Souls are consumed one per special shot — normal ammo is infinite, specials
require harvesting the matching enemy type first. Enemies that reach you
without being killed don't yield a soul.

Waves escalate over time (enemy count, speed, and HP scale up), and new
enemy types unlock on later waves. Survive as long as you can and rack up
score — headshots are worth double.
