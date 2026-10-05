# Temple of Bones

A pixel-art 2D run-and-gun platformer. Jump across eight crumbling floors —
temple, dungeon, jungle, a frozen temple, Hell itself, a cursed desert, a
bone crypt, and finally the Demon God's own throne — and take down whatever's
guarding them. Floor one is fists-only; clearing it cracks open three loot
chests, each offering a pick of 1 of 3 gear items — a sword, a gun, or a
pet — that shapes how you fight for the rest of the run (see
[Gear & Loadout](#gear--loadout)). Every clean kill leaves behind a soul you
can load as special ammunition, on top of whatever your gear gives you.

## Story

A cutscene plays on the way into every floor from the dungeon onward,
piecing together — one carving, one vision, one whispered word at a time —
what actually happened here: a king, a bargain with something that shouldn't
have been bargained with, and exactly what he became. It builds to the
throne room at the very end. Better experienced in order than spoiled here.

## Gear & Loadout

Floor one is bare-handed — no gun, just fists — so clearing it is the
payoff: three loot chests crack open, one at a time, each revealing 3
random candidates out of a pool of 9 gear items (3 swords, 3 guns, 3 pets).
Pick one from each chest to keep — your final loadout is always exactly
those 3 picked items.

Once you've picked, the game auto-equips from what you own:

- **One weapon, never two** — a sword and a gun can't both be equipped. If
  you own at least one weapon, the first one you picked is the one that
  goes on; any second or third weapon pick just sits owned, unequipped.
- **Pick a weapon and pets stop appearing** — the moment a sword or gun
  lands in a chest, every chest after it offers only more swords and guns,
  never a pet. Skip weapons entirely and pets keep showing up in all 3
  chests, unlocking a second pet slot (see below) — so a true dual-pet
  build has to go all-in from the first chest.
- **One pet, or two if you skipped weapons entirely** — equipping a weapon
  leaves room for a single pet (if one was picked before any weapon was).
  Give up the weapon slot completely (all 3 picks are pets) and both extra
  pet slots open up instead, letting a true dual-pet build run two
  companions side by side.
- A sword-equipped build fights in melee with **B** free to parry (a hit
  landed during the parry window does no damage and detonates a damage
  pulse on everything nearby); a gun-equipped build fights at range but
  runs on bullets (see [Bullets & the knife](#bullets--the-knife)); a
  pets-only build has no weapon abilities at all, relying on its
  companions plus a backup knife swing.

### Weapons

Every sword and gun carries 3 named abilities, bound to the same three
keys regardless of which one you're carrying: **C** (level 5), **Z**
(level 10), and **V** (level 15) — levels earned purely from your kill
count once a loadout is picked, with a permanent damage buff every 5
levels on top. The HUD lists all three abilities from the moment you
equip a weapon — locked ones show the level they unlock at.

| Weapon | C (lv5) | Z (lv10) | V (lv15) |
|---|---|---|---|
| 🗡️ Dragon Tooth Katana | **Blazing Slash** — a wide fiery arc that burns everything it catches | **Scaled Parry** — an extra reflexive parry pulse | **Draconic Roar** — a short channel pulsing fire damage to everything nearby and slowing it |
| 🗡️ Nightblade Shadow | **Shadow Step** — teleport behind the nearest enemy and land a heavy hit | **Veiled Strike** — brief invulnerability and invisibility, then your next hit lands harder | **Silent Execution** — instantly finishes a low-HP enemy outright, or hits hard otherwise |
| 🗡️ Tsunami Blade | **Tidal Wave** — a wave of water that knocks enemies back with solid AoE damage | **Hydro-Slash** — a fast, heavier-hitting forward slash | **Rejuvenating Flow** — a wide slash that heals you for every kill it lands |
| 🔫 Plasma Cannon | **Charged Shot** — a slow, heavy bolt that explodes in a wide radius | **Beam Wave** — a shot that pierces through everything in its path | **Overload** — a brief damage buff to every hit you land |
| 🔫 Railgun Rifle | **Sonic Dart** — a free, massive hit on the nearest enemy, no ammo spent | **Armor Piercing** — ignores hyperarmor outright, even mid-boss-nova | **Target Lock** — your next few shots home in on the nearest enemy |
| 🔫 Tesla Blipper | **Arc Lightning** — an instant bolt that chains to 2 more enemies | **EM Pulse** — an AoE pulse that damages and slows everything nearby | **Voltaic Charge** — a burst of movement speed plus a storm of lightning bolts striking everything nearby |

Each ability has its own cooldown (shown in the HUD once unlocked), so
they're a burst to lean on, not a replacement for your normal attack.

### Pets

Every pet carries 3 named abilities too, but they're passive — no key to
press. A pet fights entirely on its own, closing in on the nearest enemy
and biting automatically; which named move replaces the plain bite is
decided by the same level thresholds (5/10/15) as weapon abilities, read
off your own kill-count level. Pet attacks also channel a loaded soul the
same way your own weapon does (see
[Soul-infused slashes](#soul-infused-slashes)) — a soul consumed on a pet's
bite lands its elemental effect on whatever it hits.

| Pet | Lv5 | Lv10 | Lv15 |
|---|---|---|---|
| 🐉 Crimson Whelp | **Fire Breath** — bite also sets the target burning | **Draconic Might** — heavier hit and a speed burst for the pet | **Winged Strike** — a fiery explosion on the target |
| 🐆 Shadow Panther | **Pounce** — bite also slows the target | **Camouflage** — brief extra safety for the pet after striking | **Bleeding Claw** — heavier hit with a bleed effect |
| 🦊 Lightning Kitsune | **Electric Discharge** — bite also chains a small lightning jolt to another enemy | **Static Shield** — brief extra safety for the pet after striking | **Foxfire Swirl** — a periodic damaging pulse around the pet itself |

Each pet has its own health bar, shown in the HUD; melee enemies that
touch it deal contact damage, same as they do to you. Keep pets alive and
fighting with two supply-cache items: **Pet Armor** (-2 damage taken per
hit, up to -8) and **Dog Biscuits** — a portable heal (50 HP to every pet
at once, up to 5 held) fed to them anytime with **E**, the same pattern as
your own Health Potions.

## Bullets & the knife

Normal ammo isn't infinite — equip a gun and you start with 100 bullets.
Run out and shooting falls back to a short-range knife swing instead of
failing outright. Every kill restocks +2 bullets, even a soulless
shambler, so staying aggressive keeps you stocked; the shop's Ammo Cache
also tops bullets back up to 100 (never down) alongside its usual soul
refill. A sword-equipped build never touches bullets at all — the attack
key always swings the blade, souls and all (see below); a pets-only build
has no weapon of its own either, and falls straight to the knife.

Beat the Arch Demon and that knife is upgraded permanently into the
**Demon Knife**: instead of a stationary swipe it becomes a short forward
dash-strike, cutting through everything in its path and setting each hit
on fire (a damage-over-time burn), rather than just plain melee damage.

The knife isn't just a last resort, either — key **8** switches to it
manually anytime, bullets or not.

### Soul-infused slashes

A soul loaded with keys **1-7** isn't bullet-only — any melee swing (a
sword-equipped build's attack, or anyone else's out-of-ammo/manual knife)
carries the same trait, just delivered by the blade instead of a shot, at
the same relative damage weighting. Out of that soul and it quietly falls
back to a plain swing, same as running dry does for bullets. A pet's own
bite channels a loaded soul the same way too (see [Pets](#pets)).

| Soul | Slash effect |
|---|---|
| Brute | Heavy hit (3x damage) plus a small splash explosion |
| Fire Cultist | Fiery AoE burst around the hit, burning everything it catches |
| Frost Priest | Freezes the enemy hit and anything else close by |
| Lightning Trooper | Chains to two more nearby enemies after the hit |
| Acid Spitter | Burns the hit enemy with acid and leaves a damaging puddle |
| Shadow | The katana itself swells to roughly twice size for that one swing — a much wider reach instead of a pull |

The Demon Knife keeps its own always-burning dash and doesn't take a
soul — it's already fire-infused by default.

## Traps

Cacti — rooted, spike-throwing plants found on the Cursed Desert — drop a
trap charge instead of a normal combat soul. Press **9** while grounded to
plant one at your feet: it arms after a beat, then detonates on the first
enemy to walk over it for a solid burst of damage. It's a resource, not a
weapon mode — no aiming, no ammo switch, just drop and walk away.

## Soul Fusion

The supply cache between floors can fuse two of your souls into one: spend
3 of each to craft 3 charges of a shot that carries **both** souls' on-hit
effects at once. Berserker + Lightning hits as hard as the heavy shot and
still chains to nearby enemies; Acid + Pyromancer leaves a burning,
corrosive puddle; and so on for all 15 pairings of the 6 combat souls.
Fused shots load into their own slot, separate from the regular ammo row.
The fastest way to pull one up is to hold both of its souls' ammo keys at
once — Berserker (**2**) + Lightning (**5**) loads Berserker+Lightning,
Pyromancer (**3**) + Frost (**4**) loads Pyromancer+Frost, and so on for any
pair you've actually crafted. Key **0** (or the mobile **FUSE** button) also
cycles through whichever ones you've crafted, one at a time.

Every fused shot you're currently holding charges for shows up as a badge
along the top of the screen — split in its two souls' colors with a charge
count (e.g. a fire/frost badge reading "x3") — so you can see your whole
fused loadout at a glance, with the currently-loaded one outlined in gold.

## Play

Open `index.html` in a browser (or serve the folder with any static file
server). No build step or dependencies. The whole game renders through a
low-res virtual canvas scaled up with nearest-neighbor filtering for a
genuine chunky pixel-art look.

Before the game starts you're asked whether you're on a touchscreen device
or a keyboard (with a best guess pre-filled based on your device) — pick
one and the matching controls are ready to go.

The ⚙ button (top-right, visible everywhere — menus, cutscenes, and
mid-run) opens Settings: a volume slider and a mute toggle, saved to your
browser and applied immediately to every sound effect and the boss music.
Opening it pauses the game for as long as it's open.

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
- **↓ / S** — slide (grounded only): a quick burst of speed in the direction you're facing, with brief invulnerability — good for closing distance or diving through incoming fire. Short cooldown between slides, and walking off a ledge mid-slide cancels it.
- **Space / X / J** — shoot in the direction you're facing (hold ↑ or ↓ to aim vertically)
- **1-7** — switch ammo
- **8** — switch to the knife manually (works anytime, not just when out of bullets)
- **9** — place a trap (requires a trap charge, and being on the ground)
- **0** — cycle fused shots; or hold two souls' ammo keys together (e.g. **2+5**) to load that pair directly (see [Soul Fusion](#soul-fusion))
- **Q** — drink a potion (heals 30 HP on the spot; bought at the supply cache, holds up to 5)
- **E** — feed your pets a biscuit (heals all of them 50 HP on the spot; bought at the supply cache, holds up to 5)
- **B** — parry (sword equipped only): blocks the next hit outright and counters nearby enemies
- **C / Z / V** — weapon abilities, unlocked at gear levels 5/10/15 (see [Weapons](#weapons))
- **R** — Wither (once per floor, unlocked by the Shadow Helm)

**Mobile (on-screen controls)**
- **D-pad** (bottom-left) — move / aim up-down / jump / slide (down, while grounded)
- **FIRE** (bottom-right) — shoot
- **AMMO** — cycle through ammo types (including the knife)
- **TRAP** — place a trap (requires a trap charge, and being on the ground)
- **FUSE** — cycle fused shots (see [Soul Fusion](#soul-fusion))
- **POTION** — drink a potion (heals 30 HP on the spot)
- **BISCUIT** — feed your pets a biscuit (heals all of them 50 HP on the spot)
- **PARRY** — parry (sword equipped only)
- **C / Z / V** — weapon abilities, unlocked at gear levels 5/10/15
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
| The Demon God | Floor 8's boss, the true final fight (see below) | — | Grants a permanent +20% damage bonus on death |

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

## The Dark Jungle

Floor 3 — thick overgrowth patches near the start and the midpoint slow you
down while you're standing in them (grounded only; sliding powers straight
through, and it doesn't touch you mid-jump). Otherwise just a mixed lineup
of shamblers, brutes, and the game's first ranged casters.

## The Frozen Temple

Floor 4, right before Hell — a dark, ice-choked ruin with no boss of its
own, but the heaviest lineup of Frost Priests in the game plus the usual
mix of shamblers, brutes, and a few imps thrown in. The floor itself is
slippery: letting go of a direction coasts for a moment instead of
stopping dead, so leave a little extra room near the pits. Treat it as the
last gauntlet before the Arch Demon: stock up at the shop beforehand.

## The Arch Demon

Hell is its floor and its floor alone — no lesser zombies share it, just a
long walk in past a handful of permanent lava pools (periodic burn damage
while you're standing in one) before the fight. It has 900 HP and cycles
between five
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

Floor 6 — no boss here either, just a brutal lineup of lesser enemies led
by Cactus plants that never move but never stop shooting, under a
sandstorm that sweeps hazy bands across the whole floor. This is where
trap charges start piling up, so it's worth planting a few on the way
through rather than saving them all for later.

## The Bone Crypt

Floor 7, right before the throne — the mass grave the king built his power
on, and the hardest lineup of lesser enemies in the game: every zombie type
that's hunted you so far, all in one floor, with no boss of its own to
break it up. The gloom here is real: visibility shrinks to a small circle
around you, pitch dark beyond it. Treat it as the last gauntlet before the
Demon God: stock up and craft any fused shots you've been saving for
beforehand.

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

## Shop

Between floors, spend your score at the supply cache on healing, ammo
refills, and permanent damage/health/armor upgrades, plus Health Potions —
a portable heal (30 HP, up to 5 held at once) you can drink anytime with
**Q**, unlike the instant full heal that only works at the cache itself.
You can also roll out the Combine Souls panel to fuse your souls together
(see [Soul Fusion](#soul-fusion)). A build with a pet equipped gets two
more items — Pet Armor and Dog Biscuits (the latter working like a Health
Potion, but for your pets) — while a gun-less build has Ammo Cache and
Combine Souls hidden instead, since there's no gun to spend bullets or
fused shots from (see [Gear & Loadout](#gear--loadout)). Prices climb both
with repeated purchases of the
same upgrade and with how deep you are — every floor's cache after the
temple's charges more than the last, and the Demon God's throne is the
steepest of all.

You have 3 lives and respawn at the last torch-lit checkpoint you passed.
Falling into a pit costs a life instantly, however much HP you have left.
Losing all 3 lives sends you back to the start of the current floor and
wipes every shop upgrade. Reach the end of the Demon God's throne to win.
