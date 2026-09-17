(() => {
  const screenCanvas = document.getElementById('game');
  const sctx = screenCanvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const endTitle = document.getElementById('endTitle');
  const finalStats = document.getElementById('finalStats');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  // ---------- Virtual low-res buffer (gives the whole game its pixelated look) ----------
  const TILE = 30;
  const COLS = 70, ROWS = 9;
  const VW = COLS * TILE, VH = ROWS * TILE; // 2100 x 270
  const VIEW_W = 480, VIEW_H = 270; // visible window into the level
  const buffer = document.createElement('canvas');
  buffer.width = VIEW_W; buffer.height = VIEW_H;
  const ctx = buffer.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  let screenW = 0, screenH = 0;
  function resize() {
    screenW = window.innerWidth; screenH = window.innerHeight;
    screenCanvas.width = screenW; screenCanvas.height = screenH;
  }
  window.addEventListener('resize', resize);
  resize();

  function blit() {
    const scale = Math.max(1, Math.floor(Math.min(screenW / VIEW_W, screenH / VIEW_H)));
    const dw = VIEW_W * scale, dh = VIEW_H * scale;
    const dx = Math.floor((screenW - dw) / 2), dy = Math.floor((screenH - dh) / 2);
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = '#0d1f22';
    sctx.fillRect(0, 0, screenW, screenH);
    sctx.drawImage(buffer, 0, 0, VIEW_W, VIEW_H, dx, dy, dw, dh);
  }

  // ---------- Audio ----------
  let actx = null;
  function ensureAudio() { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); }
  function tone(freq, dur, type = 'square', gain = 0.15, glideTo = null) {
    if (!actx) return;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, actx.currentTime);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, actx.currentTime + dur);
    g.gain.setValueAtTime(gain, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    osc.connect(g).connect(actx.destination);
    osc.start(); osc.stop(actx.currentTime + dur);
  }
  function noiseBurst(dur = 0.3, gain = 0.25) {
    if (!actx) return;
    const bufferSize = actx.sampleRate * dur;
    const nb = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = nb.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = actx.createBufferSource();
    src.buffer = nb;
    const g = actx.createGain();
    g.gain.setValueAtTime(gain, actx.currentTime);
    src.connect(g).connect(actx.destination);
    src.start();
  }
  const sfx = {
    jump: () => tone(320, 0.12, 'square', 0.12, 520),
    shot: () => tone(240, 0.06, 'square', 0.1, 140),
    heavyShot: () => { tone(100, 0.16, 'sawtooth', 0.2, 40); noiseBurst(0.12, 0.12); },
    explosion: () => { noiseBurst(0.35, 0.28); tone(60, 0.3, 'sawtooth', 0.18, 20); },
    frost: () => tone(1200, 0.18, 'sine', 0.12, 500),
    soul: () => tone(500, 0.25, 'sine', 0.1, 900),
    hurt: () => tone(140, 0.2, 'sawtooth', 0.18, 60),
    hit: () => tone(700, 0.05, 'square', 0.08, 300),
    checkpoint: () => { tone(500, 0.1, 'sine', 0.12, 700); setTimeout(() => tone(700, 0.12, 'sine', 0.12, 1000), 90); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'square', 0.12), i * 120)); },
    death: () => tone(220, 0.4, 'sawtooth', 0.2, 40),
    empty: () => tone(180, 0.05, 'square', 0.07, 120),
  };

  // ---------- Level ----------
  const GAPS = [[14, 15], [33, 35], [52, 53]];
  const PLATFORMS = [
    { row: 6, c0: 7, c1: 9 },
    { row: 6, c0: 20, c1: 23 },
    { row: 7, c0: 33, c1: 35 }, // bridge over the wide pit
    { row: 6, c0: 41, c1: 43 },
    { row: 6, c0: 58, c1: 61 },
  ];
  const GOAL_COL = 68;

  let map;
  function buildMap() {
    map = [];
    for (let r = 0; r < ROWS; r++) map.push(new Array(COLS).fill(0));
    for (let c = 0; c < COLS; c++) {
      const inGap = GAPS.some(([a, b]) => c >= a && c <= b);
      map[ROWS - 1][c] = inGap ? 0 : 1;
    }
    for (const p of PLATFORMS) for (let c = p.c0; c <= p.c1; c++) map[p.row][c] = 1;
  }

  function isSolidPixel(px, py) {
    const col = Math.floor(px / TILE), row = Math.floor(py / TILE);
    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return false;
    return map[row][col] === 1;
  }

  function platformExtent(row, col) {
    let left = col, right = col;
    while (left > 0 && map[row][left - 1] === 1) left--;
    while (right < COLS - 1 && map[row][right + 1] === 1) right++;
    return { minCol: left, maxCol: right };
  }

  // ---------- Enemy configs ----------
  const ENEMY_TYPES = {
    grunt: { name: 'grunt', color: '#5fae4a', dark: '#2f6b26', w: 16, h: 24, speed: 26, hp: 20, dmg: 8, soul: null, points: 10, melee: true },
    brute: { name: 'brute', color: '#c0392b', dark: '#6f1f16', w: 20, h: 28, speed: 40, hp: 50, dmg: 16, soul: 'berserker', points: 25, melee: true },
    pyro: { name: 'pyro', color: '#ff8a3d', dark: '#a24512', w: 16, h: 24, speed: 14, hp: 28, dmg: 0, soul: 'pyromancer', points: 30, ranged: true, fireRate: 2.0, projSpeed: 180, projDmg: 12, kind: 'fire' },
    frost: { name: 'frost', color: '#6bd9e8', dark: '#2c7c8a', w: 16, h: 24, speed: 12, hp: 26, dmg: 0, soul: 'frost', points: 30, ranged: true, fireRate: 2.4, projSpeed: 160, projDmg: 9, kind: 'frost' },
  };
  const SOUL_META = {
    berserker: { label: 'HEAVY', color: '#c0392b' },
    pyromancer: { label: 'FIRE', color: '#ff8a3d' },
    frost: { label: 'FROST', color: '#6bd9e8' },
  };
  const SPAWN_LIST = [
    ['grunt', 3, 8], ['grunt', 9, 8], ['brute', 12, 8], ['grunt', 8, 6],
    ['grunt', 19, 8], ['pyro', 24, 8], ['pyro', 21, 6], ['brute', 28, 8],
    ['brute', 31, 8], ['grunt', 34, 7], ['grunt', 37, 8], ['frost', 42, 6],
    ['grunt', 45, 8], ['frost', 49, 8], ['brute', 56, 8], ['pyro', 59, 6],
    ['grunt', 61, 8], ['brute', 64, 8], ['pyro', 66, 8],
  ];
  const CHECKPOINT_COLS = [1, 19, 37, 56];

  const BASE_DMG = 16;
  const BASE_COOLDOWN = 0.28;
  const GRAVITY = 1350;
  const MOVE_SPEED = 150;
  const JUMP_VELOCITY = -480;
  const MAX_FALL = 620;

  // ---------- State ----------
  let state = 'start'; // start | playing | win | dead
  let keys = {};
  let player, enemies, pBullets, eBullets, particles, messages, camX, respawn, elapsed, shake;

  function newPlayer() {
    return {
      x: 1 * TILE + TILE / 2, y: (ROWS - 1) * TILE - 13, vx: 0, vy: 0, w: 14, h: 24,
      onGround: false, facing: 1, aim: 0, // aim: -1 up, 0 horizontal, 1 down
      hp: 100, maxHp: 100, lives: 3, score: 0, kills: 0,
      ammo: 'normal', souls: { berserker: 0, pyromancer: 0, frost: 0 },
      fireCooldown: 0, invuln: 0, coyote: 0, jumpBuffer: 0, walkT: 0, hurtFlash: 0,
      won: false,
    };
  }

  function resetRun() {
    buildMap();
    player = newPlayer();
    enemies = SPAWN_LIST.map(([type, col, row]) => spawnEnemy(type, col, row));
    pBullets = []; eBullets = []; particles = []; messages = [];
    camX = 0; elapsed = 0; shake = { t: 0, mag: 0 };
    respawn = { x: player.x, y: player.y };
  }

  function spawnEnemy(typeKey, col, row) {
    const cfg = ENEMY_TYPES[typeKey];
    const ext = platformExtent(row, col);
    const y = row * TILE - cfg.h / 2 + 1;
    return {
      cfg, x: col * TILE + TILE / 2, y, vx: cfg.speed, vy: 0,
      minX: ext.minCol * TILE + cfg.w / 2 + 2, maxX: (ext.maxCol + 1) * TILE - cfg.w / 2 - 2,
      hp: cfg.hp, maxHp: cfg.hp, dead: false, hitFlash: 0, walkT: Math.random() * 10,
      shootTimer: 1 + Math.random() * cfg.fireRate,
      slowTimer: 0, burnTimer: 0, burnTick: 0, speedMult: 1,
    };
  }

  function respawnPlayer() {
    player.x = respawn.x; player.y = respawn.y; player.vx = 0; player.vy = 0;
    player.hp = player.maxHp; player.invuln = 1.5;
  }

  function loseLife(reason) {
    player.lives--;
    sfx.death();
    shakeScreen(10);
    if (player.lives <= 0) {
      state = 'dead';
      endTitle.innerHTML = 'THE TEMPLE <span class="accent">CLAIMS YOU</span>';
      finalStats.textContent = `Score: ${player.score} — Kills: ${player.kills}`;
      gameOverScreen.classList.remove('hidden');
    } else {
      respawnPlayer();
    }
  }

  function shakeScreen(mag) { shake.mag = Math.max(shake.mag, mag); shake.t = 0.25; }
  function addMessage(x, y, text, color) { messages.push({ x, y, text, color, life: 0.9 }); }

  // ---------- Combat ----------
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) * 2 < (aw + bw) && Math.abs(ay - by) * 2 < (ah + bh);
  }

  function applyDamage(e, dmg) {
    if (e.dead) return;
    e.hp -= dmg; e.hitFlash = 0.12;
    spawnHitParticles(e.x, e.y, '#fff5cc');
    sfx.hit();
    if (e.hp <= 0) killEnemy(e);
  }

  function killEnemy(e) {
    e.dead = true;
    player.score += e.cfg.points;
    player.kills++;
    spawnDeathParticles(e.x, e.y, e.cfg.color);
    addMessage(e.x, e.y - 16, `+${e.cfg.points}`, '#dfeee4');
    if (e.cfg.soul) {
      player.souls[e.cfg.soul]++;
      spawnSoulParticle(e.x, e.y, e.cfg.soul);
      sfx.soul();
    }
  }

  function explode(x, y, radius, dmg, opts = {}) {
    spawnExplosionParticles(x, y);
    sfx.explosion();
    shakeScreen(8);
    for (const e of enemies) {
      if (e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) <= radius) {
        applyDamage(e, dmg);
        if (opts.burn && !e.dead) { e.burnTimer = 3; e.burnTick = 0.5; }
      }
    }
  }

  function applyFrost(e) { e.speedMult = 0.35; e.slowTimer = 4; }

  function shoot() {
    if (player.fireCooldown > 0) return;
    let ammo = player.ammo;
    if (ammo !== 'normal' && player.souls[ammo] <= 0) {
      addMessage(player.x, player.y - 24, 'NO SOULS', '#c9b98f');
      sfx.empty();
      ammo = 'normal'; player.ammo = 'normal';
    }
    player.fireCooldown = BASE_COOLDOWN;
    const dir = player.facing;
    let vx = 0, vy = 0;
    if (player.aim === -1) { vy = -420; }
    else if (player.aim === 1 && !player.onGround) { vy = 420; }
    else { vx = 420 * dir; }
    const muzzleX = player.x + dir * player.w * 0.7;
    const muzzleY = player.y - 2 + (player.aim === -1 ? -10 : player.aim === 1 ? 10 : 0);

    if (ammo === 'normal') {
      sfx.shot();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'normal', dmg: BASE_DMG });
    } else if (ammo === 'berserker') {
      player.souls.berserker--; sfx.heavyShot();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'berserker', dmg: BASE_DMG * 3 });
    } else if (ammo === 'pyromancer') {
      player.souls.pyromancer--; sfx.shot();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'pyro', dmg: BASE_DMG });
    } else if (ammo === 'frost') {
      player.souls.frost--; sfx.frost();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'frost', dmg: BASE_DMG * 0.7 });
    }
  }

  // ---------- Particles ----------
  function spawnHitParticles(x, y, color) {
    for (let i = 0; i < 4; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 100, vy: (Math.random() - 0.5) * 100, life: 0.3, color, size: 2, grav: true });
  }
  function spawnDeathParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, spd = 40 + Math.random() * 90;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.5, color, size: 3, grav: true });
    }
  }
  function spawnExplosionParticles(x, y) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 150;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.4, color: Math.random() < 0.5 ? '#ff9d3d' : '#ffe27a', size: 3, grav: false });
    }
  }
  function spawnSoulParticle(x, y, soulType) {
    particles.push({ x, y, vx: 0, vy: -30, life: 0.9, color: SOUL_META[soulType].color, size: 3, soul: true, grav: false });
  }

  // ---------- Input ----------
  window.addEventListener('keydown', (ev) => {
    keys[ev.code] = true;
    if (state !== 'playing') return;
    if (ev.code === 'Digit1') player.ammo = 'normal';
    if (ev.code === 'Digit2') player.ammo = 'berserker';
    if (ev.code === 'Digit3') player.ammo = 'pyromancer';
    if (ev.code === 'Digit4') player.ammo = 'frost';
    if (ev.code === 'Space' || ev.code === 'KeyW' || ev.code === 'ArrowUp') player.jumpBuffer = 0.12;
  });
  window.addEventListener('keyup', (ev) => { keys[ev.code] = false; });

  function held(...codes) { return codes.some(c => keys[c]); }

  // ---------- Physics ----------
  function moveAndCollide(e, dt) {
    e.x += e.vx * dt;
    const dir = Math.sign(e.vx);
    if (dir !== 0) {
      const leadX = e.x + (dir > 0 ? e.w / 2 : -e.w / 2);
      const top = e.y - e.h / 2 + 3, bottom = e.y + e.h / 2 - 3;
      if (isSolidPixel(leadX, top) || isSolidPixel(leadX, bottom)) {
        const col = Math.floor(leadX / TILE);
        e.x = dir > 0 ? col * TILE - e.w / 2 - 0.5 : (col + 1) * TILE + e.w / 2 + 0.5;
        e.vx = 0;
      }
    }
    e.y += e.vy * dt;
    e.onGround = false;
    const vdir = Math.sign(e.vy);
    if (vdir !== 0) {
      const leadY = e.y + (vdir > 0 ? e.h / 2 : -e.h / 2);
      const left = e.x - e.w / 2 + 3, right = e.x + e.w / 2 - 3;
      if (isSolidPixel(left, leadY) || isSolidPixel(right, leadY)) {
        const row = Math.floor(leadY / TILE);
        if (vdir > 0) { e.y = row * TILE - e.h / 2 - 0.5; e.onGround = true; }
        else { e.y = (row + 1) * TILE + e.h / 2 + 0.5; }
        e.vy = 0;
      }
    }
  }

  function updatePlayer(dt) {
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.invuln = Math.max(0, player.invuln - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    player.coyote = Math.max(0, player.coyote - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);

    const left = held('ArrowLeft', 'KeyA'), right = held('ArrowRight', 'KeyD');
    const up = held('ArrowUp', 'KeyW'), down = held('ArrowDown', 'KeyS');
    if (left && !right) { player.vx = -MOVE_SPEED; player.facing = -1; }
    else if (right && !left) { player.vx = MOVE_SPEED; player.facing = 1; }
    else player.vx = 0;

    player.aim = up ? -1 : (down && !player.onGround ? 1 : 0);

    if (player.onGround) player.coyote = 0.09;
    if (player.jumpBuffer > 0 && player.coyote > 0) {
      player.vy = JUMP_VELOCITY;
      player.jumpBuffer = 0; player.coyote = 0;
      sfx.jump();
    }
    const jumpHeld = held('Space', 'KeyW', 'ArrowUp');
    if (player.vy < 0 && !jumpHeld) player.vy *= 0.55; // variable jump height

    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);
    moveAndCollide(player, dt);

    if (player.x < player.w / 2) player.x = player.w / 2;

    if (held('KeyX', 'KeyJ', 'ControlLeft')) shoot();

    if (player.vx !== 0 && player.onGround) player.walkT += dt;
    else player.walkT = 0;

    // checkpoints
    for (const c of CHECKPOINT_COLS) {
      const cx = c * TILE + TILE / 2;
      if (player.onGround && player.x >= cx && respawn.x < cx) {
        respawn = { x: cx, y: player.y };
        sfx.checkpoint();
        addMessage(player.x, player.y - 30, 'CHECKPOINT', '#ffcd3c');
      }
    }

    // fell into a pit
    if (player.y > VH + 40) { loseLife('fell'); return; }

    // goal
    if (player.x >= GOAL_COL * TILE && state === 'playing') {
      state = 'win';
      endTitle.innerHTML = 'THE ALTAR <span class="accent">IS YOURS</span>';
      finalStats.textContent = `Score: ${player.score} — Kills: ${player.kills} — Time: ${elapsed.toFixed(1)}s`;
      gameOverScreen.classList.remove('hidden');
      sfx.win();
    }
  }

  function hurtPlayer(dmg) {
    if (player.invuln > 0) return;
    player.hp -= dmg;
    player.invuln = 1.0;
    player.hurtFlash = 0.3;
    sfx.hurt();
    shakeScreen(6);
    if (player.hp <= 0) loseLife('hp');
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.walkT += dt;
      if (e.slowTimer > 0) { e.slowTimer -= dt; if (e.slowTimer <= 0) e.speedMult = 1; }
      if (e.burnTimer > 0) {
        e.burnTimer -= dt; e.burnTick -= dt;
        if (e.burnTick <= 0) { applyDamage(e, 4); e.burnTick = 0.5; }
      }
      if (e.dead) continue;

      const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);
      const facingPlayer = player.x < e.x ? -1 : 1;

      if (e.cfg.melee) {
        e.vx = (e.vx >= 0 ? 1 : -1) * e.cfg.speed * e.speedMult;
        if (e.x <= e.minX) { e.x = e.minX; e.vx = e.cfg.speed * e.speedMult; }
        if (e.x >= e.maxX) { e.x = e.maxX; e.vx = -e.cfg.speed * e.speedMult; }
        e.x += e.vx * dt;
        if (rectsOverlap(e.x, e.y, e.cfg.w, e.cfg.h, player.x, player.y, player.w, player.h)) {
          hurtPlayer(e.cfg.dmg);
        }
      } else if (e.cfg.ranged) {
        const inRange = distToPlayer < 220 && Math.abs(e.y - player.y) < 50;
        if (!inRange) {
          e.vx = (e.vx >= 0 ? 1 : -1) * e.cfg.speed * 0.6 * e.speedMult;
          if (e.x <= e.minX) { e.x = e.minX; e.vx = e.cfg.speed * 0.6 * e.speedMult; }
          if (e.x >= e.maxX) { e.x = e.maxX; e.vx = -e.cfg.speed * 0.6 * e.speedMult; }
          e.x += e.vx * dt;
        } else {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = e.cfg.fireRate;
            eBullets.push({
              x: e.x, y: e.y, vx: facingPlayer * e.cfg.projSpeed, vy: -60,
              kind: e.cfg.kind, dmg: e.cfg.projDmg, grav: true,
            });
          }
        }
        if (rectsOverlap(e.x, e.y, e.cfg.w, e.cfg.h, player.x, player.y, player.w, player.h)) {
          hurtPlayer(4);
        }
      }
    }
  }

  function updateBullets(dt) {
    for (const b of pBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.dead = isSolidPixel(b.x, b.y);
      if (b.dead) continue;
      for (const e of enemies) {
        if (e.dead) continue;
        if (rectsOverlap(b.x, b.y, 4, 4, e.x, e.y, e.cfg.w, e.cfg.h)) {
          if (b.kind === 'pyro') explode(b.x, b.y, 55, b.dmg, { burn: true });
          else if (b.kind === 'frost') { applyDamage(e, b.dmg); applyFrost(e); for (const o of enemies) if (!o.dead && o !== e && Math.hypot(o.x - b.x, o.y - b.y) < 40) applyFrost(o); }
          else applyDamage(e, b.dmg);
          b.dead = true;
          break;
        }
      }
    }
    pBullets = pBullets.filter(b => !b.dead && b.x > camX - 30 && b.x < camX + VIEW_W + 30 && b.y > -30 && b.y < VH + 30);

    for (const b of eBullets) {
      if (b.grav) b.vy += 900 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (isSolidPixel(b.x, b.y)) { b.dead = true; continue; }
      if (rectsOverlap(b.x, b.y, 5, 5, player.x, player.y, player.w, player.h)) {
        hurtPlayer(b.dmg);
        spawnHitParticles(b.x, b.y, b.kind === 'fire' ? '#ff9d3d' : '#9fe8f5');
        b.dead = true;
      }
    }
    eBullets = eBullets.filter(b => !b.dead && b.y < VH + 30);
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.94; p.vy *= 0.94;
      if (p.grav) p.vy += 400 * dt;
      if (p.soul) { const dx = -p.x + camX + 30, dy = -p.y + 14; p.vx += dx * 0.01; p.vy += dy * 0.01; }
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
    messages = messages.filter(m => { m.life -= dt; m.y -= 18 * dt; return m.life > 0; });
  }

  function update(dt) {
    elapsed += dt;
    shake.t = Math.max(0, shake.t - dt);
    updatePlayer(dt);
    if (state !== 'playing') { updateParticles(dt); return; }
    updateEnemies(dt);
    updateBullets(dt);
    updateParticles(dt);
    camX = Math.max(0, Math.min(player.x - VIEW_W / 2, VW - VIEW_W));
  }

  // ---------- Rendering ----------
  function px(v) { return Math.round(v); }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#6be3d8');
    grad.addColorStop(0.6, '#8fedc9');
    grad.addColorStop(1, '#c8e896');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // sun
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 18, 0, Math.PI * 2); ctx.fill();

    // distant pillars (parallax)
    const parallax = camX * 0.4;
    ctx.fillStyle = 'rgba(60,110,90,0.35)';
    for (let i = -1; i < 8; i++) {
      const x = i * 140 - (parallax % 140);
      ctx.fillRect(px(x), VIEW_H - 160, 26, 160);
      ctx.fillRect(px(x) - 6, VIEW_H - 172, 38, 12);
    }
    // jungle vines
    ctx.fillStyle = 'rgba(50,140,70,0.5)';
    for (let i = -1; i < 10; i++) {
      const x = i * 95 - (camX * 0.7 % 95);
      ctx.fillRect(px(x), 0, 4, 20 + (i % 3) * 10);
    }
  }

  function drawTiles() {
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(COLS - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        if (map[r][c] !== 1) continue;
        const x = px(c * TILE - camX), y = r * TILE;
        const topExposed = r === 0 || map[r - 1][c] !== 1;
        ctx.fillStyle = topExposed ? '#f2d99b' : '#c9a361';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(120,85,40,0.35)';
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
        ctx.fillRect(x, y, 2, TILE);
        if (topExposed) {
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.fillRect(x, y, TILE, 3);
        }
        // occasional carved glyph
        if ((c * 7 + r * 13) % 11 === 0 && topExposed) {
          ctx.fillStyle = 'rgba(120,85,40,0.5)';
          ctx.fillRect(x + TILE / 2 - 2, y + 8, 4, 10);
        }
      }
    }
    // torches on ground row at intervals
    ctx.font = '10px monospace';
    for (let c = c0; c <= c1; c++) {
      if (map[ROWS - 1][c] === 1 && c % 8 === 4) {
        const x = px(c * TILE - camX) + TILE / 2, y = (ROWS - 1) * TILE;
        ctx.fillStyle = '#8a5a2a';
        ctx.fillRect(x - 2, y - 14, 4, 14);
        const flick = 6 + Math.sin(elapsed * 12 + c) * 2;
        ctx.fillStyle = '#ff8a3d';
        ctx.beginPath(); ctx.arc(x, y - 16, flick / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffe27a';
        ctx.beginPath(); ctx.arc(x, y - 16, flick / 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // altar / goal
    const gx = px(GOAL_COL * TILE - camX);
    const gy = (ROWS - 1) * TILE;
    ctx.fillStyle = '#d9c07a';
    ctx.fillRect(gx, gy - 34, TILE, 34);
    ctx.fillStyle = '#ffcd3c';
    ctx.fillRect(gx + TILE / 2 - 3, gy - 46, 6, 12 + Math.sin(elapsed * 4) * 3);
  }

  function drawPlayer() {
    const x = px(player.x - camX), y = px(player.y);
    if (player.invuln > 0 && Math.floor(elapsed * 20) % 2 === 0) return;
    const dir = player.facing;
    const bob = (player.vx !== 0 && player.onGround) ? Math.sin(player.walkT * 12) * 2 : 0;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(dir, 1);

    // legs
    const legSwing = player.onGround && player.vx !== 0 ? Math.sin(player.walkT * 12) * 4 : 0;
    ctx.fillStyle = '#2b1d14';
    ctx.fillRect(-6, 6 + (player.onGround ? 0 : -2), 5, 8 - legSwing * 0.3);
    ctx.fillRect(1, 6 + (player.onGround ? 0 : -2), 5, 8 + legSwing * 0.3);

    // robe/torso
    ctx.fillStyle = player.hurtFlash > 0 ? '#ffffff' : '#3b2a55';
    ctx.fillRect(-7, -8, 14, 16);
    // belt
    ctx.fillStyle = '#c9a361';
    ctx.fillRect(-7, 4, 14, 2);

    // head + hood
    ctx.fillStyle = player.hurtFlash > 0 ? '#ffffff' : '#e8c39e';
    ctx.fillRect(-5, -16, 10, 8);
    ctx.fillStyle = player.hurtFlash > 0 ? '#ffffff' : '#241636';
    ctx.fillRect(-6, -18, 12, 5);
    // eyes
    ctx.fillStyle = '#5ef29a';
    ctx.fillRect(1, -13, 2, 2);

    // arm + gun
    let gunY = 0;
    if (player.aim === -1) gunY = -14; else if (player.aim === 1) gunY = 10;
    ctx.fillStyle = '#6b5a3a';
    ctx.fillRect(6, -2 + (player.aim === -1 ? -8 : player.aim === 1 ? 8 : 0), 10, 4);
    ctx.fillStyle = '#9c8a5a';
    ctx.fillRect(4, -4, 6, 6);

    if (player.fireCooldown > BASE_COOLDOWN - 0.05) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath();
      ctx.arc(17, -2 + (player.aim === -1 ? -8 : player.aim === 1 ? 8 : 0), 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    if (e.dead) return;
    const c = e.cfg;
    const x = px(e.x - camX), y = px(e.y);
    const flash = e.hitFlash > 0;
    const legSwing = Math.sin(e.walkT * 8) * 3;
    ctx.save();
    ctx.translate(x, y);
    // legs
    ctx.fillStyle = flash ? '#fff' : c.dark;
    ctx.fillRect(-c.w / 2 + 2, c.h / 2 - 8, 5, 8 - legSwing * 0.3);
    ctx.fillRect(c.w / 2 - 7, c.h / 2 - 8, 5, 8 + legSwing * 0.3);
    // body
    ctx.fillStyle = flash ? '#fff' : c.color;
    ctx.fillRect(-c.w / 2, -c.h / 2 + 6, c.w, c.h - 14);
    // head
    ctx.fillStyle = flash ? '#fff' : c.dark;
    ctx.fillRect(-c.w / 2 + 2, -c.h / 2, c.w - 4, 8);
    // eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(-3, -c.h / 2 + 3, 2, 2);
    ctx.fillRect(2, -c.h / 2 + 3, 2, 2);
    if (e.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(107,217,232,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-c.w / 2 - 2, -c.h / 2 - 2, c.w + 4, c.h + 4);
    }
    if (e.burnTimer > 0) {
      ctx.fillStyle = 'rgba(255,140,20,0.5)';
      ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    }
    ctx.restore();

    const barW = c.w;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - barW / 2, y - c.h / 2 - 8, barW, 3);
    ctx.fillStyle = pct > 0.5 ? '#6ecb63' : pct > 0.2 ? '#e6c14a' : '#c0392b';
    ctx.fillRect(x - barW / 2, y - c.h / 2 - 8, barW * pct, 3);
  }

  function drawBullet(b, kind) {
    const x = px(b.x - camX), y = px(b.y);
    const colors = { normal: '#5ef29a', berserker: '#ffcf4a', pyro: '#ff8a3d', frost: '#9fe8f5', fire: '#ff8a3d' };
    ctx.fillStyle = colors[kind] || '#fff';
    ctx.fillRect(x - 3, y - 2, 6, 4);
  }

  function drawParticle(p) {
    const x = px(p.x - camX), y = px(p.y);
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    // hearts
    for (let i = 0; i < 3; i++) {
      const x = 8 + i * 12, y = 6;
      ctx.fillStyle = i < player.lives ? '#ff6b4a' : 'rgba(255,255,255,0.2)';
      ctx.fillRect(x, y, 9, 8);
    }
    // hp bar
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(8, 18, 90, 6);
    const hpPct = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpPct > 0.5 ? '#6ecb63' : hpPct > 0.2 ? '#e6c14a' : '#c0392b';
    ctx.fillRect(9, 19, 88 * hpPct, 4);

    // score
    ctx.fillStyle = '#2b1d14';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${player.score}`, VIEW_W - 8, 16);
    ctx.textAlign = 'left';

    // progress bar
    const prog = Math.min(1, player.x / (GOAL_COL * TILE));
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(VIEW_W / 2 - 60, 6, 120, 5);
    ctx.fillStyle = '#ffcd3c';
    ctx.fillRect(VIEW_W / 2 - 60, 6, 120 * prog, 5);

    // ammo slots
    const slots = [
      { key: 'normal', label: '1', color: '#5ef29a', count: '∞' },
      { key: 'berserker', label: '2', color: SOUL_META.berserker.color, count: player.souls.berserker },
      { key: 'pyromancer', label: '3', color: SOUL_META.pyromancer.color, count: player.souls.pyromancer },
      { key: 'frost', label: '4', color: SOUL_META.frost.color, count: player.souls.frost },
    ];
    let sx = VIEW_W / 2 - (slots.length * 34) / 2;
    const sy = VIEW_H - 22;
    for (const s of slots) {
      const active = player.ammo === s.key;
      ctx.fillStyle = active ? 'rgba(255,205,60,0.3)' : 'rgba(0,0,0,0.35)';
      ctx.fillRect(sx, sy, 30, 18);
      ctx.strokeStyle = active ? s.color : 'rgba(255,255,255,0.2)';
      ctx.strokeRect(sx + 0.5, sy + 0.5, 29, 17);
      ctx.fillStyle = s.color;
      ctx.font = '9px monospace';
      ctx.fillText(s.label, sx + 3, sy + 9);
      ctx.fillStyle = '#fff';
      ctx.fillText(String(s.count), sx + 3, sy + 16);
      sx += 34;
    }

    ctx.font = '9px monospace';
    ctx.fillStyle = '#fff';
    for (const m of messages) {
      ctx.globalAlpha = Math.max(0, m.life);
      ctx.textAlign = 'center';
      ctx.fillStyle = m.color;
      ctx.fillText(m.text, px(m.x - camX), px(m.y));
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  function render() {
    ctx.save();
    if (shake.t > 0) {
      const m = shake.mag * (shake.t / 0.25);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    drawTiles();
    for (const e of enemies) drawEnemy(e);
    drawPlayer();
    for (const b of pBullets) drawBullet(b, b.kind);
    for (const b of eBullets) drawBullet(b, b.kind);
    for (const p of particles) drawParticle(p);
    drawHUD();
    if (player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(180,20,20,${player.hurtFlash * 0.4})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    ctx.restore();
    blit();
  }

  // ---------- Main loop ----------
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (state === 'playing' || state === 'win' || state === 'dead') { update(dt); render(); }
    requestAnimationFrame(loop);
  }

  function startGame() {
    ensureAudio();
    resetRun();
    state = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  requestAnimationFrame(loop);
})();
