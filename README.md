# Temple of Bones

A pixel-art 2D run-and-gun platformer. Jump across four crumbling floors —
temple, dungeon, jungle, and finally Hell itself — and gun down whatever's
guarding them. Every clean kill leaves behind a soul you can load as special
ammunition, and a wolf pup follows you the whole way, growing fiercer with
every kill.

## Play

Open `index.html` in a browser (or serve the folder with any static file
server). No build step or dependencies. The whole game renders through a
low-res virtual canvas scaled up with nearest-neighbor filtering for a
genuine chunky pixel-art look.

## Controls

- **← → / A D** — move
- **↑ / W** — jump (hold for a higher, longer jump — needed to clear the wider pits)
- **Space / X / J** — shoot in the direction you're facing (hold ↑ or ↓ to aim vertically)
- **1-7** — switch ammo
- **R** — Wither (once per floor, unlocked by the Shadow Helm)

## Enemies & souls

| Enemy | Behavior | Soul it drops | Ammo effect |
|---|---|---|---|
| Shambler | Patrols and deals contact damage | none | — |
| Brute | Faster, tankier melee rusher | Berserker soul | Heavy single-target shot (3x damage) |
| Fire Cultist | Stationary, lobs fireballs | Pyromancer soul | Explosive shot: AoE damage + burn DoT |
| Frost Priest | Stationary, lobs ice shards | Frost soul | Freezing shot: AoE slow on everything hit |
| Lightning Trooper | Stationary, fires a fast flat bolt | Lightning soul | Chain lightning: jumps between nearby enemies |
| Acid Spitter | Stationary, lobs a corrosive glob | Acid soul | Corrosive shot: leaves a damaging puddle |
| Shrieker | Support — buffs nearby melee zombies with haste | none | — |
| Shadow | Very low direct damage but very long range; its bolt pulls you toward it | Shadow soul | Pull shot: yanks nearby enemies toward the hit and primes your next shot to home in |
| Imp | Small, fast, swarming melee — low health, decent bite | none | — |
| The Guardian | Floor 2's boss (see below) | — | Drops the Shadow Helm on death (+10% damage) instead of a soul |

Souls are consumed one per special shot — normal ammo is infinite, specials
require harvesting the matching zombie type first.

## The Guardian

Floor 2 ends in a sealed arena: cross into it and the way back shuts until
the Guardian is dead. It has 520 HP and cycles between four attacks —

- **Dash flurry** — three rapid dashes through your position, each its own hit
- **Ground slam** — a telegraphed leap-slam shockwave; jump it to avoid the hit
- **Dark bolt barrage** — a fast five-shot volley aimed at you
- **Dark nova** — channeled once at 50% HP and again at 20%; it's briefly
  invulnerable while charging, hits hard in a radius on release, and is left
  staggered afterward (1.5x damage taken) — the punish window for surviving it

Beating it grants the Shadow Helm (+10% damage), which survives death on any
later floor — it only resets if you die back on the Guardian's own floor,
since that's the one place you can re-earn it.

The helm also unlocks **Wither** (press **R**), a once-per-floor curse on
the nearest enemy in range: it permanently halves that target's remaining
health pool and every point of damage it deals for the rest of the floor.
It won't land on a target with hyperarmor (e.g. the Guardian mid-nova).

## Wolf companion

A wolf pup starts at your side from the first floor and levels up purely
from your running kill count — no feeding or separate XP to manage. It
fights in melee, biting whatever's nearest, and gets stronger, faster, and
tougher-looking at each stage: Puppy → Young Wolf → Wolf → Dire Wolf →
Alpha Wolf → **Fenrir**, fully grown at 300 kills.

## Shop

Between floors, spend your score at the supply cache on healing, ammo
refills, and permanent damage/health/armor upgrades. Prices climb both with
repeated purchases of the same upgrade and with how deep you are — the
dungeon, jungle, and Hell caches all charge more than the temple's.

You have 3 lives and respawn at the last torch-lit checkpoint you passed.
Falling into a pit costs a life instantly, however much HP you have left.
Losing all 3 lives sends you back to the start of the current floor and
wipes every shop upgrade. Reach the end of Hell to win.
