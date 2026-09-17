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
    // Fill as much of the available space as possible. An integer scale
    // keeps pixels perfectly crisp but leaves large letterbox bars in most
    // panel/window sizes, so use a fractional scale instead — still
    // unsmoothed (blocky), just not locked to whole-number multiples.
    const scale = Math.max(0.1, Math.min(screenW / VIEW_W, screenH / VIEW_H));
    const dw = VIEW_W * scale, dh = VIEW_H * scale;
    const dx = Math.floor((screenW - dw) / 2), dy = Math.floor((screenH - dh) / 2);
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = '#0d1f22';
    sctx.fillRect(0, 0, screenW, screenH);
    sctx.drawImage(buffer, 0, 0, VIEW_W, VIEW_H, dx, dy, dw, dh);
  }

  // ---------- Audio ----------
  let actx = null;
  function ensureAudio() {
    try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { /* audio isn't essential — never let it block the game from starting */ }
  }
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
    grunt: { name: 'grunt', color: '#5fae4a', dark: '#2f6b26', light: '#8fd478', bone: '#e8e0c8', w: 16, h: 24, speed: 26, hp: 20, dmg: 8, soul: null, points: 10, melee: true },
    brute: { name: 'brute', color: '#c0392b', dark: '#6f1f16', light: '#e0684f', bone: '#f0d9b0', w: 22, h: 29, speed: 40, hp: 50, dmg: 16, soul: 'berserker', points: 25, melee: true },
    pyro: { name: 'pyro', color: '#ff8a3d', dark: '#a24512', light: '#ffc26b', bone: '#3a1f12', w: 16, h: 25, speed: 14, hp: 28, dmg: 0, soul: 'pyromancer', points: 30, ranged: true, fireRate: 2.0, projSpeed: 230, range: 260, spread: 0.16, projDmg: 12, kind: 'fire' },
    frost: { name: 'frost', color: '#6bd9e8', dark: '#2c7c8a', light: '#cdf6fb', bone: '#173f47', w: 16, h: 25, speed: 12, hp: 26, dmg: 0, soul: 'frost', points: 30, ranged: true, fireRate: 2.4, projSpeed: 200, range: 260, spread: 0.16, projDmg: 9, kind: 'frost' },
    lightning: { name: 'lightning', color: '#a78bfa', dark: '#5b3fa0', light: '#e0d4ff', bone: '#241748', w: 16, h: 25, speed: 14, hp: 30, dmg: 0, soul: null, points: 35, ranged: true, fireRate: 2.8, projSpeed: 900, range: 300, spread: 0.05, projDmg: 16, kind: 'lightning' },
    acid: { name: 'acid', color: '#8bc34a', dark: '#4b6b1f', light: '#c8e6a0', bone: '#1f2b10', w: 16, h: 25, speed: 12, hp: 30, dmg: 0, soul: null, points: 32, ranged: true, fireRate: 2.6, projSpeed: 170, range: 240, spread: 0.1, arc: true, projDmg: 8, kind: 'acid' },
    shrieker: { name: 'shrieker', color: '#c7c2b8', dark: '#6b675e', light: '#e8e4da', bone: '#2b2822', w: 14, h: 22, speed: 20, hp: 14, dmg: 4, soul: null, points: 20, melee: true, support: true },
  };
  const SOUL_META = {
    berserker: { label: 'HEAVY', color: '#c0392b' },
    pyromancer: { label: 'FIRE', color: '#ff8a3d' },
    frost: { label: 'FROST', color: '#6bd9e8' },
  };
  const SPAWN_LIST = [
    ['grunt', 3, 8], ['grunt', 5, 8], ['grunt', 9, 8], ['grunt', 11, 8],
    ['brute', 12, 8], ['grunt', 8, 6],
    ['grunt', 17, 8], ['grunt', 19, 8], ['brute', 18, 8],
    ['pyro', 24, 8], ['pyro', 21, 6], ['grunt', 22, 6], ['grunt', 26, 8],
    ['brute', 28, 8], ['grunt', 29, 8],
    ['brute', 31, 8], ['grunt', 34, 7], ['grunt', 36, 8], ['grunt', 37, 8],
    ['frost', 39, 8], ['frost', 42, 6], ['grunt', 43, 6],
    ['brute', 44, 8], ['grunt', 45, 8], ['pyro', 47, 8],
    ['grunt', 49, 8], ['frost', 50, 8], ['grunt', 51, 8],
    ['brute', 54, 8], ['brute', 56, 8], ['frost', 57, 8],
    ['pyro', 59, 6], ['grunt', 60, 6],
    ['grunt', 61, 8], ['brute', 63, 8], ['brute', 64, 8],
    ['pyro', 66, 8], ['pyro', 67, 8],
    ['lightning', 10, 8], ['lightning', 40, 8], ['lightning', 65, 8],
    ['acid', 6, 8], ['acid', 32, 8], ['acid', 55, 8],
    ['shrieker', 20, 8], ['shrieker', 38, 8], ['shrieker', 62, 8],
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
  let player, enemies, pBullets, eBullets, hazards, particles, messages, camX, respawn, elapsed, shake;

  function newPlayer() {
    return {
      x: 1 * TILE + TILE / 2, y: (ROWS - 1) * TILE - 13, vx: 0, vy: 0, w: 14, h: 24,
      onGround: false, facing: 1, aim: 0, // aim: -1 up, 0 horizontal, 1 down
      hp: 100, maxHp: 100, lives: 3, score: 0, kills: 0,
      ammo: 'normal', souls: { berserker: 0, pyromancer: 0, frost: 0 },
      fireCooldown: 0, invuln: 0, coyote: 0, jumpBuffer: 0, walkT: 0, hurtFlash: 0,
      shockedTimer: 0, won: false,
    };
  }

  function resetRun() {
    buildMap();
    player = newPlayer();
    enemies = SPAWN_LIST.map(([type, col, row]) => spawnEnemy(type, col, row));
    pBullets = []; eBullets = []; hazards = []; particles = []; messages = [];
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
      shootTimer: 1 + Math.random() * (cfg.fireRate || 1),
      slowTimer: 0, burnTimer: 0, burnTick: 0, speedMult: 1,
      hasteTimer: 0, hasteMult: 1, shriekTimer: 1.5 + Math.random(),
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
    spawnImpactFlash(e.x, e.y);
    shakeScreen(3);
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
    spawnExplosionParticles(x, y, opts.palette);
    spawnShockwave(x, y, opts.ringColor || 'rgba(255,200,120,0.9)', radius);
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
    if (player.fireCooldown > 0 || player.shockedTimer > 0) return;
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
    spawnShellCasing(player.x - dir * 2, player.y - 6, dir);

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
    for (let i = 0; i < 8; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, life: 0.35, color, size: 3, grav: true });
  }
  function spawnImpactFlash(x, y, color = '#fff8d8') {
    particles.push({ x, y, vx: 0, vy: 0, life: 0.1, maxLife: 0.1, color, size: 11, shape: 'star', grav: false });
  }
  function spawnShockwave(x, y, color, maxRadius) {
    particles.push({ x, y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3, color, maxRadius, shape: 'ring', grav: false });
  }
  function spawnDeathParticles(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2, spd = 40 + Math.random() * 90;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.5, color, size: 3, grav: true });
    }
  }
  function spawnExplosionParticles(x, y, palette) {
    const colors = palette || ['#ff9d3d', '#ffe27a'];
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, spd = 60 + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.45, color: colors[Math.random() < 0.5 ? 0 : 1], size: 3, grav: false });
    }
  }
  function spawnSoulParticle(x, y, soulType) {
    particles.push({ x, y, vx: 0, vy: -30, life: 0.9, color: SOUL_META[soulType].color, size: 3, soul: true, grav: false });
  }
  function spawnShellCasing(x, y, dir) {
    particles.push({ x, y, vx: -dir * (40 + Math.random() * 30), vy: -60 - Math.random() * 30, life: 0.5, color: '#d9b64a', size: 2, grav: true, shell: true });
  }
  function spawnShriekPulse(x, y) {
    spawnShockwave(x, y, 'rgba(180,150,255,0.9)', 60);
  }

  // ---------- Hazards (acid puddles) ----------
  function spawnAcidPuddle(x, y) {
    spawnHitParticles(x, y, '#8bc34a');
    hazards.push({ x, y, radius: 20, life: 3, tick: 0.4, dmg: 5 });
  }
  function updateHazards(dt) {
    for (const hz of hazards) {
      hz.life -= dt;
      hz.tick -= dt;
      if (Math.random() < dt * 4) {
        particles.push({ x: hz.x + (Math.random() - 0.5) * hz.radius, y: hz.y - 2, vx: 0, vy: -12, life: 0.3, color: '#a8d878', size: 2, grav: false });
      }
      if (hz.tick <= 0 && Math.hypot(player.x - hz.x, player.y - hz.y) < hz.radius + player.w / 2) {
        hurtPlayer(hz.dmg);
        addMessage(player.x, player.y - 28, `-${hz.dmg}`, '#8bc34a');
        hz.tick = 0.5;
      }
    }
    hazards = hazards.filter(hz => hz.life > 0);
  }

  // ---------- Input ----------
  // Embedded/iframe viewers (like an Artifact preview) don't always hand
  // keyboard focus to the page automatically, and a plain <canvas> isn't
  // focusable by default — so make it focusable and aggressively (re)claim
  // focus on any interaction, plus prevent the browser's default scroll
  // behavior for the keys the game uses.
  screenCanvas.tabIndex = 0;
  screenCanvas.style.outline = 'none';
  function claimFocus() { try { screenCanvas.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
  window.addEventListener('pointerdown', claimFocus);
  window.addEventListener('touchstart', claimFocus, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) claimFocus(); });
  claimFocus();

  const GAME_KEYS = new Set([
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS',
    'Space', 'KeyX', 'KeyJ', 'ControlLeft', 'Digit1', 'Digit2', 'Digit3', 'Digit4',
  ]);

  function handleKeyDown(ev) {
    keys[ev.code] = true;
    if (GAME_KEYS.has(ev.code)) ev.preventDefault();
    if (state !== 'playing') return;
    if (ev.code === 'Digit1') player.ammo = 'normal';
    if (ev.code === 'Digit2') player.ammo = 'berserker';
    if (ev.code === 'Digit3') player.ammo = 'pyromancer';
    if (ev.code === 'Digit4') player.ammo = 'frost';
    if (ev.code === 'Space' || ev.code === 'KeyW' || ev.code === 'ArrowUp') player.jumpBuffer = 0.12;
  }
  function handleKeyUp(ev) {
    keys[ev.code] = false;
    if (GAME_KEYS.has(ev.code)) ev.preventDefault();
  }
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  screenCanvas.addEventListener('keydown', handleKeyDown);
  screenCanvas.addEventListener('keyup', handleKeyUp);

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
    player.shockedTimer = Math.max(0, player.shockedTimer - dt);

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
      if (e.hasteTimer > 0) { e.hasteTimer -= dt; if (e.hasteTimer <= 0) e.hasteMult = 1; }
      if (e.cfg.support) {
        // Shriekers don't attack directly — they periodically buff nearby
        // melee zombies with a haste pulse, so they're worth prioritizing.
        e.shriekTimer -= dt;
        if (e.shriekTimer <= 0) {
          e.shriekTimer = 4;
          spawnShriekPulse(e.x, e.y);
          for (const o of enemies) {
            if (!o.dead && o !== e && o.cfg.melee && !o.cfg.support && Math.hypot(o.x - e.x, o.y - e.y) < 150) {
              o.hasteTimer = 3; o.hasteMult = 1.6;
            }
          }
        }
      }
      if (e.burnTimer > 0) {
        // Fire is a lingering poison-like DoT: keep dripping embers so the
        // damage-over-time reads clearly, not just a one-off explosion.
        e.burnTimer -= dt; e.burnTick -= dt;
        if (Math.random() < dt * 8) {
          particles.push({ x: e.x + (Math.random() - 0.5) * e.cfg.w, y: e.y - e.cfg.h / 2, vx: (Math.random() - 0.5) * 15, vy: -30 - Math.random() * 25, life: 0.4, color: Math.random() < 0.5 ? '#ff9d3d' : '#8a5a2a', size: 2, grav: false });
        }
        if (e.burnTick <= 0) {
          applyDamage(e, 4);
          addMessage(e.x, e.y - e.cfg.h / 2 - 4, '-4', '#ff9d3d');
          e.burnTick = 0.5;
        }
      }
      if (e.dead) continue;

      const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);

      if (e.cfg.melee) {
        // Hunt the player when they're nearby and on roughly the same
        // level; otherwise pace back and forth. Either way, stay clamped
        // to this zombie's own platform/ground segment so it never
        // wanders off an edge or into a pit.
        const canSeePlayer = distToPlayer < 190 && Math.abs(e.y - player.y) < 40;
        if (canSeePlayer) {
          const toward = player.x < e.x ? -1 : 1;
          e.vx = toward * e.cfg.speed * 1.15 * e.speedMult * e.hasteMult;
        } else {
          e.vx = (e.vx >= 0 ? 1 : -1) * e.cfg.speed * e.speedMult * e.hasteMult;
        }
        if (e.x <= e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
        if (e.x >= e.maxX) { e.x = e.maxX; e.vx = -Math.abs(e.vx); }
        e.x += e.vx * dt;
        if (rectsOverlap(e.x, e.y, e.cfg.w, e.cfg.h, player.x, player.y, player.w, player.h)) {
          hurtPlayer(e.cfg.dmg);
        }
      } else if (e.cfg.ranged) {
        // Long-range snipers: engage from well off-screen-adjacent distance
        // with a fast, flat shot aimed straight at the player rather than a
        // short lobbed arc, so "in range" actually means long range.
        const inRange = distToPlayer < e.cfg.range && Math.abs(e.y - player.y) < 70;
        if (!inRange) {
          e.vx = (e.vx >= 0 ? 1 : -1) * e.cfg.speed * 0.6 * e.speedMult;
          if (e.x <= e.minX) { e.x = e.minX; e.vx = e.cfg.speed * 0.6 * e.speedMult; }
          if (e.x >= e.maxX) { e.x = e.maxX; e.vx = -e.cfg.speed * 0.6 * e.speedMult; }
          e.x += e.vx * dt;
        } else {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = e.cfg.fireRate;
            const dx = player.x - e.x, dy = player.y - e.y;
            const baseAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 2 * (e.cfg.spread || 0);
            let vx = Math.cos(baseAngle) * e.cfg.projSpeed;
            let vy = Math.sin(baseAngle) * e.cfg.projSpeed;
            if (e.cfg.arc) vy -= 150; // lob it instead of firing flat
            eBullets.push({ x: e.x, y: e.y, vx, vy, kind: e.cfg.kind, dmg: e.cfg.projDmg, grav: !!e.cfg.arc });
            if (e.cfg.kind === 'lightning') sfx.frost();
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
          if (b.kind === 'pyro') {
            explode(b.x, b.y, 55, b.dmg, { burn: true, palette: ['#ff9d3d', '#ffe27a'], ringColor: 'rgba(255,120,40,0.9)' });
          } else if (b.kind === 'berserker') {
            applyDamage(e, b.dmg);
            explode(b.x, b.y, 60, 20, { palette: ['#ffe98a', '#fff5cc'], ringColor: 'rgba(255,220,140,0.95)' });
          } else if (b.kind === 'frost') {
            applyDamage(e, b.dmg); applyFrost(e);
            for (const o of enemies) if (!o.dead && o !== e && Math.hypot(o.x - b.x, o.y - b.y) < 40) applyFrost(o);
          } else applyDamage(e, b.dmg);
          b.dead = true;
          break;
        }
      }
    }
    pBullets = pBullets.filter(b => !b.dead && b.x > camX - 30 && b.x < camX + VIEW_W + 30 && b.y > -30 && b.y < VH + 30);

    const eBulletColors = { fire: '#ff9d3d', frost: '#9fe8f5', lightning: '#d8c7ff', acid: '#8bc34a' };
    for (const b of eBullets) {
      if (b.grav) b.vy += 900 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (isSolidPixel(b.x, b.y)) {
        if (b.kind === 'acid') spawnAcidPuddle(b.x, b.y);
        b.dead = true; continue;
      }
      if (rectsOverlap(b.x, b.y, 5, 5, player.x, player.y, player.w, player.h)) {
        hurtPlayer(b.dmg);
        if (b.kind === 'lightning') { player.shockedTimer = 1.4; sfx.frost(); addMessage(player.x, player.y - 28, 'SHOCKED', '#d8c7ff'); }
        if (b.kind === 'acid') spawnAcidPuddle(b.x, b.y);
        spawnHitParticles(b.x, b.y, eBulletColors[b.kind] || '#fff');
        b.dead = true;
      }
    }
    eBullets = eBullets.filter(b => !b.dead && b.x > camX - 30 && b.x < camX + VIEW_W + 30 && b.y > -30 && b.y < VH + 30);
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
    updateHazards(dt);
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
    const moving = player.onGround && player.vx !== 0;
    const bob = moving ? Math.sin(player.walkT * 12) * 2 : 0;
    const flash = player.hurtFlash > 0;
    const gunUp = player.aim === -1 ? -8 : player.aim === 1 ? 8 : 0;
    const firing = player.fireCooldown > BASE_COOLDOWN - 0.05;

    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(dir, 1);

    const legSwing = moving ? Math.sin(player.walkT * 12) * 4 : 0;
    const armSwing = moving ? Math.sin(player.walkT * 12 + Math.PI) * 2 : 0;

    // back boot + leg (khaki cargo pants over combat boots)
    ctx.fillStyle = flash ? '#fff' : '#1c1a16';
    ctx.fillRect(-6, 10 + (player.onGround ? 0 : -2), 5, 3 - legSwing * 0.2);
    ctx.fillStyle = flash ? '#fff' : '#5b6b45';
    ctx.fillRect(-6, 3 + (player.onGround ? 0 : -2), 5, 7 - legSwing * 0.3);

    // backpack (peeks out behind torso)
    ctx.fillStyle = flash ? '#fff' : '#4a3a24';
    ctx.fillRect(-8, -7, 4, 11);

    // front boot + leg
    ctx.fillStyle = flash ? '#fff' : '#1c1a16';
    ctx.fillRect(1, 10 + (player.onGround ? 0 : -2), 5, 3 + legSwing * 0.2);
    ctx.fillStyle = flash ? '#fff' : '#6d7f4a';
    ctx.fillRect(1, 3 + (player.onGround ? 0 : -2), 5, 7 + legSwing * 0.3);

    // torso: tan field jacket with a shaded side and a bandolier strap
    ctx.fillStyle = flash ? '#fff' : '#8a7a52';
    ctx.fillRect(-7, -8, 14, 12);
    ctx.fillStyle = flash ? '#fff' : '#6b5d3e';
    ctx.fillRect(-7, -8, 4, 12);
    ctx.fillStyle = flash ? '#fff' : '#c9b98f';
    ctx.fillRect(4, -8, 2, 12);
    ctx.fillStyle = flash ? '#fff' : '#5a3a2a';
    ctx.fillRect(-6, -7, 12, 2);
    // belt + pouch
    ctx.fillStyle = flash ? '#fff' : '#3a2e1c';
    ctx.fillRect(-7, 3, 14, 2);
    ctx.fillStyle = flash ? '#fff' : '#2b2216';
    ctx.fillRect(-2, 1, 4, 4);

    // head: skin + headband + hair
    ctx.fillStyle = flash ? '#fff' : '#d9a876';
    ctx.fillRect(-5, -16, 10, 8);
    ctx.fillStyle = flash ? '#fff' : '#7a2f22';
    ctx.fillRect(-6, -18, 12, 3);
    ctx.fillStyle = flash ? '#fff' : '#5a2118';
    ctx.fillRect(4, -18, 3, 5);
    ctx.fillStyle = flash ? '#fff' : '#2b1d14';
    ctx.fillRect(-6, -20, 12, 2);
    // eyes
    ctx.fillStyle = flash ? '#000' : '#1a1a1a';
    ctx.fillRect(1, -13, 2, 2);

    // rear arm (subtle, behind torso)
    ctx.fillStyle = flash ? '#fff' : '#7a6a48';
    ctx.fillRect(-4, -5 + armSwing, 4, 8);

    // front arm + rifle, angled for up/down aim
    const gy = -2 + gunUp;
    ctx.fillStyle = flash ? '#fff' : '#8a7a52';
    ctx.fillRect(3, -4, 5, 6);
    ctx.fillStyle = flash ? '#fff' : '#2b2418'; // barrel
    ctx.fillRect(7, gy - 1, 13, 3);
    ctx.fillStyle = flash ? '#fff' : '#4a4030'; // receiver body
    ctx.fillRect(3, gy - 2, 6, 5);
    ctx.fillStyle = flash ? '#fff' : '#1e1a12'; // magazine
    ctx.fillRect(5, gy + 2, 3, 6);
    ctx.fillStyle = flash ? '#fff' : '#2b2418'; // stock
    ctx.fillRect(-1, gy - 1, 4, 3);

    if (firing) {
      const fx = 20, fy = gy - 1;
      ctx.fillStyle = '#fff8c9';
      ctx.fillRect(fx, fy - 3, 2, 7);
      ctx.fillRect(fx - 3, fy, 8, 2);
      ctx.fillStyle = '#ffcf4a';
      ctx.fillRect(fx + 1, fy - 1, 4, 3);
    }
    ctx.restore();
  }

  function drawEnemy(e) {
    if (e.dead) return;
    const c = e.cfg;
    const x = px(e.x - camX), y = px(e.y);
    const flash = e.hitFlash > 0;
    const legSwing = Math.sin(e.walkT * 8) * 3;
    const hw = c.w / 2, hh = c.h / 2;
    const col = (a) => flash ? '#fff' : a;

    ctx.save();
    ctx.translate(x, y);

    // legs (shared base)
    ctx.fillStyle = col(c.dark);
    ctx.fillRect(-hw + 2, hh - 8, 5, 8 - legSwing * 0.3);
    ctx.fillRect(hw - 7, hh - 8, 5, 8 + legSwing * 0.3);

    if (c.name === 'grunt') {
      // hunched shambler: ragged tunic, exposed ribs, lolling head
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 8, c.w, c.h - 16);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 8, 3, c.h - 16);
      ctx.fillStyle = col(c.bone);
      ctx.fillRect(-hw + 4, -hh + 12, 2, 5);
      ctx.fillRect(-hw + 8, -hh + 11, 2, 6);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh + 1, c.w - 6, 9);
      ctx.fillStyle = col('#c62828');
      ctx.fillRect(-3, -hh + 2, 2, 2);
      ctx.fillRect(2, -hh + 2, 2, 2);
    } else if (c.name === 'brute') {
      // bulkier rusher: armored shoulders, spiked pauldrons
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 9, c.w, c.h - 17);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 9, 4, c.h - 17);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw - 2, -hh + 7, 6, 6);
      ctx.fillRect(hw - 4, -hh + 7, 6, 6);
      ctx.fillStyle = col('#4a4a4a');
      ctx.fillRect(-hw - 2, -hh + 4, 3, 4);
      ctx.fillRect(hw - 1, -hh + 4, 3, 4);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 2, -hh, c.w - 4, 9);
      ctx.fillStyle = col('#ffd54f');
      ctx.fillRect(-4, -hh + 3, 2, 2);
      ctx.fillRect(2, -hh + 3, 2, 2);
    } else if (c.name === 'pyro') {
      // fire cultist: tattered robe, embers drifting off
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 7, c.w, c.h - 15);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 7, 3, c.h - 15);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 3, hh - 10, 3, 5);
      ctx.fillRect(hw - 6, hh - 9, 3, 5);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh, c.w - 2, 8);
      ctx.fillStyle = col('#ffcf4a');
      ctx.fillRect(-3, -hh + 2, 2, 2);
      ctx.fillRect(2, -hh + 2, 2, 2);
      if (Math.sin(e.walkT * 5) > 0.3) {
        ctx.fillStyle = 'rgba(255,140,20,0.7)';
        ctx.fillRect(-2, -hh - 4, 2, 3);
        ctx.fillRect(2, -hh - 6, 2, 3);
      }
    } else if (c.name === 'frost') {
      // frost priest: pale, ice shards jutting from shoulders/head
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 7, c.w, c.h - 15);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 7, 3, c.h - 15);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh, c.w - 2, 8);
      ctx.fillStyle = col('#e3fbff');
      ctx.fillRect(-hw - 1, -hh - 1, 3, 6);
      ctx.fillRect(hw - 2, -hh - 2, 3, 7);
      ctx.fillStyle = col('#173f47');
      ctx.fillRect(-3, -hh + 2, 2, 2);
      ctx.fillRect(2, -hh + 2, 2, 2);
    } else if (c.name === 'lightning') {
      // charged trooper: crackling hair spikes, glowing violet eyes
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 7, c.w, c.h - 15);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 7, 3, c.h - 15);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh, c.w - 2, 8);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-2, -hh - 5, 2, 5);
      ctx.fillRect(1, -hh - 6, 2, 6);
      ctx.fillStyle = col('#f4e9ff');
      ctx.fillRect(-3, -hh + 2, 2, 2);
      ctx.fillRect(2, -hh + 2, 2, 2);
      if (Math.sin(e.walkT * 10) > 0.5) {
        ctx.strokeStyle = 'rgba(216,199,255,0.9)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-hw - 2, -hh + 4); ctx.lineTo(-hw + 2, -hh + 8); ctx.lineTo(-hw - 1, -hh + 12);
        ctx.stroke();
      }
    } else if (c.name === 'acid') {
      // spitter: dripping, sickly hunched frame
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 8, c.w, c.h - 16);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 8, 3, c.h - 16);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh + 1, c.w - 2, 8);
      ctx.fillStyle = col('#c8e6a0');
      ctx.fillRect(-3, -hh + 3, 2, 2);
      ctx.fillRect(2, -hh + 3, 2, 2);
      if (Math.sin(e.walkT * 4) > 0) {
        ctx.fillStyle = 'rgba(139,195,74,0.8)';
        ctx.fillRect(-2, hh - 12, 2, 4 + Math.sin(e.walkT * 4) * 2);
      }
    } else if (c.name === 'shrieker') {
      // support caster: gaunt, wide screaming mouth
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 7, c.w, c.h - 15);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh, c.w - 2, 8);
      ctx.fillStyle = col('#2b2822');
      ctx.fillRect(-3, -hh + 4, 6, 3);
      ctx.fillStyle = col('#8b1a1a');
      ctx.fillRect(-2, -hh + 5, 4, 1);
    }

    if (e.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(107,217,232,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-hw - 2, -hh - 2, c.w + 4, c.h + 4);
    }
    if (e.hasteTimer > 0) {
      ctx.strokeStyle = 'rgba(180,150,255,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-hw - 2, -hh - 2, c.w + 4, c.h + 4);
    }
    if (e.burnTimer > 0) {
      ctx.fillStyle = 'rgba(255,140,20,0.5)';
      ctx.fillRect(-hw, -hh, c.w, c.h);
    }
    ctx.restore();

    const barW = c.w;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x - barW / 2, y - hh - 8, barW, 3);
    ctx.fillStyle = pct > 0.5 ? '#6ecb63' : pct > 0.2 ? '#e6c14a' : '#c0392b';
    ctx.fillRect(x - barW / 2, y - hh - 8, barW * pct, 3);
  }

  function drawBullet(b, kind) {
    const x = px(b.x - camX), y = px(b.y);
    const colors = { normal: '#5ef29a', berserker: '#ffcf4a', pyro: '#ff8a3d', frost: '#9fe8f5', fire: '#ff8a3d', lightning: '#d8c7ff', acid: '#8bc34a' };
    ctx.fillStyle = colors[kind] || '#fff';
    if (kind === 'lightning') {
      ctx.fillRect(x - 6, y - 1, 4, 2);
      ctx.fillRect(x - 2, y - 2, 4, 2);
      ctx.fillRect(x + 2, y - 1, 4, 2);
    } else {
      ctx.fillRect(x - 3, y - 2, 6, 4);
    }
  }

  function drawHazard(hz) {
    const x = px(hz.x - camX), y = px(hz.y);
    const pct = Math.max(0, hz.life / 3);
    ctx.globalAlpha = 0.55 * pct;
    ctx.fillStyle = '#6b9c3a';
    ctx.beginPath();
    ctx.ellipse(x, y, hz.radius, hz.radius * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8d878';
    ctx.beginPath();
    ctx.ellipse(x, y, hz.radius * 0.5, hz.radius * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawParticle(p) {
    const x = px(p.x - camX), y = px(p.y);
    ctx.globalAlpha = Math.max(0, p.maxLife ? p.life / p.maxLife : p.life);
    if (p.shape === 'ring') {
      const t = 1 - p.life / p.maxLife;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(1, p.maxRadius * t), 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.shape === 'star') {
      ctx.fillStyle = p.color;
      ctx.fillRect(x - p.size / 2, y - 1, p.size, 2);
      ctx.fillRect(x - 1, y - p.size / 2, 2, p.size);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size);
    }
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
    for (const hz of hazards) drawHazard(hz);
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
    claimFocus();
    resetRun();
    state = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  requestAnimationFrame(loop);
})();
