# Temple of Bones

A pixel-art 2D run-and-gun platformer. Jump across seven crumbling floors —
temple, dungeon, jungle, a frozen temple, Hell itself, a cursed desert, and
finally the Demon God's own throne — and gun down whatever's guarding them.
Every clean kill leaves behind a soul you can load as special ammunition, and
a wolf pup follows you the whole way, growing fiercer with every kill.

## Story

A cutscene plays on the way into every floor from the dungeon onward,
piecing together — one carving, one vision, one whispered word at a time —
what actually happened here: a king, a bargain with something that shouldn't
have been bargained with, and exactly what he became. It builds to the
throne room at the very end. Better experienced in order than spoiled here.

## Bullets & the knife

Normal ammo isn't infinite — you start each run with 100 bullets. Run out
and shooting falls back to a short-range knife swing instead of failing
outright. Every kill restocks +2 bullets, even a soulless shambler, so
staying aggressive keeps you stocked; the shop's Ammo Cache also tops
bullets back up to 100 (never down) alongside its usual soul refill.

Beat the Arch Demon and that knife is upgraded permanently into the
**Demon Knife**: instead of a stationary swipe it becomes a short forward
dash-strike, cutting through everything in its path and setting each hit
on fire (a damage-over-time burn), rather than just plain melee damage.

The knife isn't just a last resort, either — key **8** switches to it
manually anytime, bullets or not.

## Traps

Cacti — rooted, spike-throwing plants found on the Cursed Desert — drop a
trap charge instead of a normal combat soul. Press **9** while grounded to
plant one at your feet: it arms after a beat, then detonates on the first
enemy to walk over it for a solid burst of damage. It's a resource, not a
weapon mode — no aiming, no ammo switch, just drop and walk away.

## Play

Open `index.html` in a browser (or serve the folder with any static file
server). No build step or dependencies. The whole game renders through a
low-res virtual canvas scaled up with nearest-neighbor filtering for a
genuine chunky pixel-art look.

Before the game starts you're asked whether you're on a touchscreen device
or a keyboard (with a best guess pre-filled based on your device) — pick
one and the matching controls are ready to go.

## Saving & resuming

Progress is saved to your browser automatically — at every checkpoint,
floor transition, and respawn, plus a periodic autosave while playing.
Close the tab (or the Claude Artifact) and come back later, and you're
asked whether to continue that run (dropping you back at your last
checkpoint, with your score, kills, and gear intact) or start a new game.
Dying completely wipes the save along with your gear, same as it always
has — reloading the page can't undo that. The save lives in your
browser's local storage, so it's tied to that browser and device, not
shared or synced anywhere.

## Controls

**Keyboard**
- **← → / A D** — move
- **↑ / W** — jump (hold for a higher, longer jump — needed to clear the wider pits)
- **Space / X / J** — shoot in the direction you're facing (hold ↑ or ↓ to aim vertically)
- **1-7** — switch ammo
- **8** — switch to the knife manually (works anytime, not just when out of bullets)
- **9** — place a trap (requires a trap charge, and being on the ground)
- **R** — Wither (once per floor, unlocked by the Shadow Helm)

**Mobile (on-screen controls)**
- **D-pad** (bottom-left) — move / aim up-down / jump
- **FIRE** (bottom-right) — shoot
- **AMMO** — cycle through ammo types (including the knife)
- **TRAP** — place a trap (requires a trap charge, and being on the ground)
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
| Shadow | Very low direct damage but very long range; its bolt hurls you toward it | Shadow soul | Pull shot: yanks nearby enemies together and primes your next shot to home in |
| Imp | Small, fast, swarming melee — low health, decent bite | none | — |
| Cactus | Rooted in place, throws spike volleys | Trap charge | Place a trap with key 9 (see [Traps](#traps)) |
| The Guardian | Floor 2's boss (see below) | — | Drops the Shadow Helm on death (+10% damage) instead of a soul |
| The Arch Demon | Floor 5's boss, alone on its whole floor (see below) | — | Drops the Demon Knife on death — upgrades your bullets-out knife into a burning dash strike |
| The Demon God | Floor 7's boss, the true final fight (see below) | — | Grants a permanent +20% damage bonus on death |

Souls are consumed one per special shot; specials require harvesting the
matching zombie type first. See [Bullets & the knife](#bullets--the-knife)
above for how normal ammo works.

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

## The Frozen Temple

Floor 4, right before Hell — a dark, ice-choked ruin with no boss of its
own, but the heaviest lineup of Frost Priests in the game plus the usual
mix of shamblers, brutes, and a few imps thrown in. Treat it as the last
gauntlet before the Arch Demon: stock up at the shop beforehand.

## The Arch Demon

Hell is its floor and its floor alone — no lesser zombies share it, just a
long, empty walk in before the fight. It has 900 HP and cycles between five
attacks, on top of the same channeled nova the Guardian uses (at 50% and
20% HP) —

- **Demon charge** — two heavy dashes through your position
- **Fireball barrage** — a flat six-shot volley
- **Meteor rain** — four lobbed, arcing fireballs that fall on your position
- **Eruption** — a telegraphed ground-scorch around itself; unlike the
  Guardian's slam, jumping doesn't save you here, only running clear does
- **Summon** — calls in two imps to flank you

Like the Guardian's arena, crossing into the Arch Demon's fight seals the
way back until it's dead.

Beating it grants the **Demon Knife**, a permanent upgrade to your
bullets-out fallback weapon: instead of a stationary swipe it dashes you
forward through anything in front of you, and every enemy it cuts is left
burning.

## The Cursed Desert

Floor 6 — no boss here either, just the hardest lineup of lesser enemies in
the game, led by Cactus plants that never move but never stop shooting.
This is where trap charges start piling up, so it's worth planting a few on
the way through rather than saving them all for later.

## The Demon God

The true final boss, alone on its own throne floor at the very end. It has
1400 HP and cycles between four attacks, on top of the same channeled nova
the other two bosses use (at 50% and 20% HP) —

- **Godsplit charge** — three fast dashes through your position
- **Radial judgment** — a full 360-degree burst of void bolts
- **Smite** — marks wherever you're standing the instant it begins the move,
  then strikes there after a beat; staying still is what gets you killed
- **Summon** — raises a brute and a shambler to flank you

Like the other two arenas, crossing into the fight seals the way back until
it's dead. Beating it grants a permanent +20% damage bonus and ends the run
— reach the end of its floor to win.

## Wolf companion

A wolf pup starts at your side from the first floor and levels up purely
from your running kill count — no feeding or separate XP to manage. It
fights in melee, biting whatever's nearest, and gets stronger, faster, and
tougher-looking at each stage: Puppy → Young Wolf → Wolf → Dire Wolf →
Alpha Wolf → **Fenrir**, fully grown at 300 kills.

## Shop

Between floors, spend your score at the supply cache on healing, ammo
refills, and permanent damage/health/armor upgrades. Prices climb both with
repeated purchases of the same upgrade and with how deep you are — every
floor's cache after the temple's charges more than the last, and the Demon
God's throne is the steepest of all.

You have 3 lives and respawn at the last torch-lit checkpoint you passed.
Falling into a pit costs a life instantly, however much HP you have left.
Losing all 3 lives sends you back to the start of the current floor and
wipes every shop upgrade. Reach the end of the Demon God's throne to win.
