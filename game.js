(() => {
  const screenCanvas = document.getElementById('game');
  const sctx = screenCanvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const endTitle = document.getElementById('endTitle');
  const finalStats = document.getElementById('finalStats');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const skipCutsceneBtn = document.getElementById('skipCutsceneBtn');
  const shopScreen = document.getElementById('shopScreen');
  const shopScoreEl = document.getElementById('shopScore');
  const shopItemsEl = document.getElementById('shopItems');
  const shopContinueBtn = document.getElementById('shopContinueBtn');
  const deviceScreen = document.getElementById('deviceScreen');
  const deviceGuessEl = document.getElementById('deviceGuess');
  const chooseMobileBtn = document.getElementById('chooseMobileBtn');
  const chooseDesktopBtn = document.getElementById('chooseDesktopBtn');
  const touchControls = document.getElementById('touchControls');
  const resumeScreen = document.getElementById('resumeScreen');
  const resumeSummaryEl = document.getElementById('resumeSummary');
  const resumeContinueBtn = document.getElementById('resumeContinueBtn');
  const resumeNewGameBtn = document.getElementById('resumeNewGameBtn');

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
    blip: () => tone(320 + Math.random() * 180, 0.035, 'square', 0.06),
    wave: () => tone(180, 0.6, 'sine', 0.05, 90),
    groan: () => { tone(90, 0.5, 'sawtooth', 0.12, 60); tone(140, 0.4, 'sawtooth', 0.08, 80); },
    advance: () => tone(440, 0.05, 'square', 0.08, 660),
    knife: () => tone(900, 0.05, 'square', 0.09, 400),
    demonSlash: () => { tone(200, 0.09, 'sawtooth', 0.16, 60); noiseBurst(0.09, 0.12); },
  };

  // ---------- Boss music ----------
  // An original driving chiptune riff for the guardian fight — not a cover
  // of any existing track, just written in the same fast/minor-key/bullet-
  // hell spirit. Sequenced as a simple 16-step loop over Web Audio oscillators.
  let bossMusicTimer = null;
  let bossMusicStep = 0;
  const BOSS_BPM = 168;
  const BOSS_BASS = [73.42, 73.42, 87.31, 73.42, 65.41, 65.41, 73.42, 55.00]; // D2 D2 F2 D2 C2 C2 D2 A1
  const BOSS_LEAD = [
    null, 293.66, null, 349.23, null, 293.66, 440.00, null,
    null, 261.63, null, 293.66, null, 220.00, 233.08, null,
  ];
  function playBossStep(step) {
    if (step % 2 === 0) tone(BOSS_BASS[(step / 2) % BOSS_BASS.length], 0.16, 'sawtooth', 0.09);
    const lead = BOSS_LEAD[step % BOSS_LEAD.length];
    if (lead) tone(lead, 0.11, 'square', 0.07);
    if (step % 4 === 0) noiseBurst(0.07, 0.1);
    else if (step % 4 === 2) noiseBurst(0.025, 0.045);
  }
  function startBossMusic() {
    if (bossMusicTimer || !actx) return;
    bossMusicStep = 0;
    const stepMs = (60 / BOSS_BPM / 4) * 1000;
    bossMusicTimer = setInterval(() => { playBossStep(bossMusicStep % BOSS_LEAD.length); bossMusicStep++; }, stepMs);
  }
  function stopBossMusic() {
    if (bossMusicTimer) { clearInterval(bossMusicTimer); bossMusicTimer = null; }
  }

  // ---------- Level ----------
  // Both floors share the same physical layout (gaps/platforms) — it's
  // already proven jumpable — and differ in theme, enemy mix, and the
  // guardian boss waiting at the end of floor 2.
  const LEVEL_GAPS = [[14, 15], [33, 35], [52, 53]];
  const LEVEL_PLATFORMS = [
    { row: 6, c0: 7, c1: 9 },
    { row: 6, c0: 20, c1: 23 },
    { row: 7, c0: 33, c1: 35 }, // bridge over the wide pit
    { row: 6, c0: 41, c1: 43 },
    { row: 6, c0: 58, c1: 61 },
  ];
  const GOAL_COL = 68;
  const LEVEL_CHECKPOINTS = [1, 19, 37, 56];

  let levelIndex = 0;
  // The Guardian's boss room: once you walk past this column while it's
  // still alive, a barrier seals the way back until it's dead.
  const BOSS_ARENA_START_COL = 63;
  let bossArenaSealed = false;
  function currentLevel() { return LEVEL_DEFS[levelIndex]; }

  let map;
  function buildMap() {
    map = [];
    for (let r = 0; r < ROWS; r++) map.push(new Array(COLS).fill(0));
    for (let c = 0; c < COLS; c++) {
      const inGap = LEVEL_GAPS.some(([a, b]) => c >= a && c <= b);
      map[ROWS - 1][c] = inGap ? 0 : 1;
    }
    for (const p of LEVEL_PLATFORMS) for (let c = p.c0; c <= p.c1; c++) map[p.row][c] = 1;
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
    lightning: { name: 'lightning', color: '#a78bfa', dark: '#5b3fa0', light: '#e0d4ff', bone: '#241748', w: 16, h: 25, speed: 14, hp: 30, dmg: 0, soul: 'lightning', points: 35, ranged: true, fireRate: 2.8, projSpeed: 900, range: 300, spread: 0.05, projDmg: 16, kind: 'lightning' },
    acid: { name: 'acid', color: '#8bc34a', dark: '#4b6b1f', light: '#c8e6a0', bone: '#1f2b10', w: 16, h: 25, speed: 12, hp: 30, dmg: 0, soul: 'acid', points: 32, ranged: true, fireRate: 2.6, projSpeed: 170, range: 240, spread: 0.1, arc: true, projDmg: 8, kind: 'acid' },
    shrieker: { name: 'shrieker', color: '#c7c2b8', dark: '#6b675e', light: '#e8e4da', bone: '#2b2822', w: 14, h: 22, speed: 20, hp: 14, dmg: 4, soul: null, points: 20, melee: true, support: true },
    shadow: { name: 'shadow', color: '#241a33', dark: '#120c1c', light: '#4a3566', bone: '#0a0610', w: 15, h: 24, speed: 10, hp: 22, dmg: 3, soul: 'shadow', points: 34, ranged: true, fireRate: 3.0, projSpeed: 260, range: 340, spread: 0.05, projDmg: 3, kind: 'shadow', pull: true },
    imp: { name: 'imp', color: '#ff5a2e', dark: '#8a2508', light: '#ffb37a', bone: '#2a0a02', w: 13, h: 18, speed: 62, hp: 10, dmg: 10, soul: null, points: 12, melee: true },
    boss: {
      name: 'boss', displayName: 'THE GUARDIAN', color: '#2a1a3a', dark: '#150d1f', light: '#5a3a7a', bone: '#0a0610',
      w: 34, h: 44, speed: 30, hp: 520, dmg: 22, soul: null, points: 350, isBoss: true,
      hudColor: '#a78bfa', novaRingColor: 'rgba(176,144,255,0.7)',
      telegraphColors: { dash_telegraph: 'rgba(255,90,60,0.8)', slam_telegraph: 'rgba(167,139,250,0.8)', barrage_telegraph: 'rgba(90,180,255,0.8)' },
    },
    archdemon: {
      name: 'archdemon', displayName: 'THE ARCH DEMON', color: '#7a1a0a', dark: '#3a0a03', light: '#ff5a1f', bone: '#1a0500',
      w: 40, h: 52, speed: 34, hp: 900, dmg: 26, soul: null, points: 800, isBoss: true,
      hudColor: '#ff5a1f', novaRingColor: 'rgba(255,90,31,0.7)',
      telegraphColors: {
        charge_telegraph: 'rgba(255,90,60,0.8)', fireball_telegraph: 'rgba(255,160,40,0.8)',
        meteor_telegraph: 'rgba(255,60,20,0.8)', eruption_telegraph: 'rgba(255,200,40,0.8)',
        summon_telegraph: 'rgba(180,60,180,0.8)',
      },
    },
  };
  const SOUL_META = {
    berserker: { label: 'HEAVY', color: '#c0392b' },
    pyromancer: { label: 'FIRE', color: '#ff8a3d' },
    frost: { label: 'FROST', color: '#6bd9e8' },
    lightning: { label: 'CHAIN', color: '#a78bfa' },
    acid: { label: 'ACID', color: '#8bc34a' },
    shadow: { label: 'PULL', color: '#8a6fd1' },
  };
  const LEVEL1_SPAWN = [
    ['grunt', 3, 8], ['grunt', 9, 8],
    ['brute', 12, 8], ['grunt', 8, 6],
    ['grunt', 19, 8],
    ['pyro', 24, 8], ['grunt', 26, 8],
    ['brute', 28, 8],
    ['acid', 32, 8], ['grunt', 37, 8],
    ['lightning', 40, 8],
    ['frost', 42, 6],
    ['brute', 44, 8], ['grunt', 45, 8],
    ['grunt', 51, 8],
    ['brute', 56, 8],
    ['shrieker', 38, 8],
    ['grunt', 60, 6],
    ['grunt', 61, 8], ['brute', 64, 8],
    ['pyro', 67, 8],
  ];
  const LEVEL2_SPAWN = [
    ['grunt', 3, 8], ['grunt', 5, 8], ['grunt', 9, 8], ['grunt', 11, 8], ['brute', 12, 8],
    ['lightning', 8, 6], ['brute', 16, 8], ['grunt', 17, 8], ['grunt', 18, 8], ['acid', 19, 8],
    ['brute', 22, 6], ['grunt', 24, 8], ['frost', 26, 8], ['grunt', 27, 8],
    ['shrieker', 29, 8], ['brute', 30, 8], ['brute', 31, 8], ['frost', 34, 7],
    ['grunt', 36, 8], ['grunt', 37, 8], ['lightning', 39, 8], ['acid', 40, 8], ['acid', 42, 6], ['grunt', 43, 6],
    ['brute', 44, 8], ['brute', 46, 8], ['pyro', 47, 8], ['pyro', 48, 8], ['grunt', 49, 8], ['grunt', 50, 8],
    ['shrieker', 51, 8], ['brute', 54, 8], ['lightning', 55, 8], ['grunt', 56, 8], ['grunt', 57, 8],
    ['acid', 59, 6], ['brute', 60, 6], ['lightning', 61, 8], ['acid', 62, 8],
    ['boss', 64, 8],
  ];
  const LEVEL3_SPAWN = [
    ['grunt', 3, 8], ['grunt', 5, 8], ['brute', 7, 8], ['brute', 9, 8], ['grunt', 11, 8],
    ['acid', 12, 8], ['acid', 16, 8], ['grunt', 17, 8], ['grunt', 18, 8], ['shrieker', 19, 8],
    ['lightning', 21, 6], ['lightning', 22, 6], ['brute', 24, 8], ['frost', 26, 8], ['brute', 27, 8],
    ['shadow', 20, 6], ['grunt', 29, 8], ['grunt', 30, 8], ['acid', 31, 8], ['frost', 34, 7],
    ['brute', 36, 8], ['grunt', 37, 8], ['lightning', 39, 8], ['acid', 40, 8], ['shadow', 32, 8],
    ['shrieker', 42, 6], ['grunt', 43, 6], ['frost', 44, 8], ['brute', 45, 8], ['brute', 46, 8],
    ['grunt', 47, 8], ['grunt', 48, 8], ['acid', 49, 8], ['lightning', 50, 8], ['grunt', 51, 8],
    ['shadow', 41, 6], ['brute', 54, 8], ['frost', 55, 8], ['lightning', 56, 8], ['frost', 57, 8],
    ['grunt', 58, 6], ['shrieker', 59, 6], ['grunt', 60, 6], ['shadow', 51, 8],
    ['brute', 61, 8], ['brute', 62, 8], ['acid', 63, 8], ['brute', 64, 8],
    ['acid', 65, 8], ['grunt', 66, 8], ['frost', 67, 8], ['shadow', 61, 6],
  ];
  const ICE_SPAWN = [
    ['grunt', 3, 8], ['frost', 5, 8], ['grunt', 7, 8], ['brute', 9, 8],
    ['frost', 8, 6], ['grunt', 11, 8], ['lightning', 12, 8], ['frost', 16, 8],
    ['brute', 17, 8], ['shrieker', 18, 8], ['grunt', 19, 8],
    ['frost', 20, 6], ['imp', 22, 6], ['acid', 24, 8], ['brute', 26, 8],
    ['frost', 27, 8], ['shadow', 28, 8], ['grunt', 29, 8],
    ['lightning', 30, 8], ['frost', 31, 8], ['brute', 34, 7], ['frost', 35, 7],
    ['grunt', 36, 8], ['shrieker', 37, 8], ['acid', 39, 8], ['frost', 40, 8],
    ['brute', 41, 6], ['imp', 42, 6], ['lightning', 43, 6],
    ['frost', 44, 8], ['grunt', 45, 8], ['brute', 46, 8], ['shadow', 47, 8],
    ['frost', 48, 8], ['acid', 49, 8], ['grunt', 50, 8], ['lightning', 51, 8],
    ['shrieker', 54, 8], ['brute', 55, 8], ['frost', 56, 8], ['frost', 57, 8],
    ['shadow', 58, 6], ['imp', 59, 6], ['grunt', 60, 6],
    ['brute', 61, 8], ['frost', 62, 8], ['lightning', 63, 8], ['acid', 64, 8],
    ['brute', 65, 8], ['frost', 66, 8], ['shadow', 67, 8],
  ];
  // Hell belongs to the Arch Demon alone — no lesser zombies share its floor.
  const HELL_SPAWN = [
    ['archdemon', 64, 8],
  ];
  const LEVEL_DEFS = [
    { theme: 'temple', name: 'Temple of Bones', spawnList: LEVEL1_SPAWN },
    { theme: 'dungeon', name: 'The Dark Dungeon', spawnList: LEVEL2_SPAWN },
    { theme: 'jungle', name: 'The Dark Jungle', spawnList: LEVEL3_SPAWN },
    { theme: 'ice', name: 'The Frozen Temple', spawnList: ICE_SPAWN },
    { theme: 'hell', name: 'The Burning Hell', spawnList: HELL_SPAWN },
  ];

  const BASE_DMG = 16;
  const BASE_COOLDOWN = 0.28;
  const GRAVITY = 1350;
  const MOVE_SPEED = 150;
  const JUMP_VELOCITY = -480;
  const MAX_FALL = 620;

  // ---------- State ----------
  let state = 'start'; // start | cutscene | playing | shop | win | dead
  let keys = {};
  let mobileControlsEnabled = false;
  let touchControlsShown = false;
  let autosaveTimer = 0;
  let player, wolf, enemies, pBullets, eBullets, hazards, particles, messages, camX, respawn, elapsed, shake, levelBanner;

  function newPlayer() {
    return {
      x: 1 * TILE + TILE / 2, y: (ROWS - 1) * TILE - 13, vx: 0, vy: 0, w: 14, h: 24,
      onGround: false, facing: 1, aim: 0, // aim: -1 up, 0 horizontal, 1 down
      hp: 100, maxHp: 100, lives: 3, score: 0, kills: 0,
      ammo: 'normal', bullets: 100, souls: { berserker: 0, pyromancer: 0, frost: 0, lightning: 0, acid: 0, shadow: 0 },
      fireCooldown: 0, invuln: 0, coyote: 0, jumpBuffer: 0, jumpsUsed: 0, walkT: 0, hurtFlash: 0,
      shockedTimer: 0, blockMsgCooldown: 0, won: false,
      dmgMult: 1, armor: 0, upgrades: { damage: 0, vitality: 0, armor: 0 },
      // helmDmgBonus is tracked apart from dmgMult (which the shop and floor
      // deaths wipe) so the Guardian's reward can survive a death that
      // doesn't put the boss back in play to be re-earned.
      homingNext: false, shadowHelm: false, helmDmgBonus: 1, knockX: 0, knockTimer: 0,
      usedSpecialThisFloor: false, knifeSwing: 0, demonKnife: false,
    };
  }

  function resetRun() {
    stopBossMusic();
    levelIndex = 0;
    buildMap();
    player = newPlayer();
    wolf = { x: player.x - 14, y: player.y, biteCooldown: 0 };
    enemies = currentLevel().spawnList.map(([type, col, row]) => spawnEnemy(type, col, row));
    pBullets = []; eBullets = []; hazards = []; particles = []; messages = [];
    camX = 0; elapsed = 0; shake = { t: 0, mag: 0 };
    levelBanner = { text: '', t: 0 };
    respawn = { x: player.x, y: player.y };
    bossArenaSealed = false;
  }

  // Shared by goToLevel() and resumeSave(): resets a floor's transient state
  // (enemies, projectiles, camera, wolf position, respawn point) and places
  // the player at the given spot.
  function enterLevelEntitiesAt(x, y) {
    enemies = currentLevel().spawnList.map(([type, col, row]) => spawnEnemy(type, col, row));
    pBullets = []; eBullets = []; hazards = []; particles = []; messages = [];
    camX = 0;
    bossArenaSealed = false;
    player.x = x; player.y = y; player.vx = 0; player.vy = 0;
    player.knockX = 0; player.knockTimer = 0;
    if (wolf) { wolf.x = x - 14; wolf.y = y; } else { wolf = { x: x - 14, y, biteCooldown: 0 }; }
    respawn = { x, y };
  }

  function goToLevel(idx) {
    levelIndex = idx;
    buildMap();
    player.usedSpecialThisFloor = false;
    enterLevelEntitiesAt(1 * TILE + TILE / 2, (ROWS - 1) * TILE - 13);
    levelBanner = { text: `FLOOR ${idx + 1} — ${currentLevel().name.toUpperCase()}`, t: 3 };
    state = 'playing';
    sfx.checkpoint();
    if (currentLevel().theme === 'dungeon' || currentLevel().theme === 'hell') startBossMusic();
    saveGame();
  }

  function spawnEnemy(typeKey, col, row) {
    const cfg = ENEMY_TYPES[typeKey];
    const ext = platformExtent(row, col);
    const y = row * TILE - cfg.h / 2 + 1;
    const e = {
      cfg, x: col * TILE + TILE / 2, y, vx: cfg.speed, vy: 0,
      minX: ext.minCol * TILE + cfg.w / 2 + 2, maxX: (ext.maxCol + 1) * TILE - cfg.w / 2 - 2,
      hp: cfg.hp, maxHp: cfg.hp, dead: false, hitFlash: 0, walkT: Math.random() * 10,
      shootTimer: 1 + Math.random() * (cfg.fireRate || 1),
      slowTimer: 0, burnTimer: 0, burnTick: 0, acidTimer: 0, acidTick: 0, speedMult: 1,
      hasteTimer: 0, hasteMult: 1, shriekTimer: 1.5 + Math.random(),
      weakDmgMult: 1, weakened: false,
    };
    if (cfg.isBoss) {
      e.attackState = 'idle'; e.attackTimer = 1.5;
      e.dashesLeft = 0; e.dashDir = 1; e.hitThisStep = false;
      e.invulnTimer = 0; e.staggerTimer = 0; e.staggerBonus = 1;
      e.usedNova50 = false; e.usedNova20 = false; e.novaRadius = 0;
    }
    return e;
  }

  function respawnPlayer() {
    player.x = respawn.x; player.y = respawn.y; player.vx = 0; player.vy = 0;
    player.hp = player.maxHp; player.invuln = 1.5;
    player.knockX = 0; player.knockTimer = 0;
    // Unseal the arena so a checkpoint respawn actually leaves the player
    // at the checkpoint instead of the seal's retreat-clamp immediately
    // snapping them back into the fight; walking back in reseals it.
    bossArenaSealed = false;
    saveGame();
  }

  function loseLife(reason) {
    player.lives--;
    sfx.death();
    shakeScreen(10);
    if (player.lives <= 0) {
      state = 'dead';
      // The last save was from before this death and still has full gear —
      // clear it so reloading instead of pressing "Try Again" can't dodge
      // the upgrade/soul wipe that's supposed to be the cost of dying.
      clearSave();
      stopBossMusic();
      endTitle.innerHTML = `${currentLevel().name.toUpperCase()} <span class="accent">CLAIMS YOU</span>`;
      finalStats.textContent = `Score: ${player.score} — Kills: ${player.kills} — All shop gear is gone. You'll wake at the start of this floor.`;
      gameOverScreen.classList.remove('hidden');
    } else {
      respawnPlayer();
    }
  }

  // Losing all 3 lives sends you back to the start of the CURRENT floor
  // (not all the way to floor 1) — but every shop upgrade is wiped, so
  // dying still costs you something real.
  function respawnAtFloorStart() {
    claimFocus();
    player.dmgMult = 1;
    player.armor = 0;
    player.maxHp = 100;
    player.upgrades = { damage: 0, vitality: 0, armor: 0 };
    player.souls = { berserker: 0, pyromancer: 0, frost: 0, lightning: 0, acid: 0, shadow: 0 };
    player.ammo = 'normal';
    player.bullets = 100;
    player.lives = 3;
    player.hp = player.maxHp;
    // Only strip the Guardian's shadow helm (and the damage bonus it
    // carries) if this respawn puts the boss back in play (the dungeon
    // floor) — losing it on a later floor with no way to re-earn it would
    // be an unrecoverable, unintended penalty.
    if (currentLevel().theme === 'dungeon') { player.shadowHelm = false; player.helmDmgBonus = 1; }
    player.homingNext = false;
    gameOverScreen.classList.add('hidden');
    goToLevel(levelIndex);
  }

  function shakeScreen(mag) { shake.mag = Math.max(shake.mag, mag); shake.t = 0.25; }
  function addMessage(x, y, text, color) { messages.push({ x, y, text, color, life: 0.9 }); }

  // ---------- Combat ----------
  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return Math.abs(ax - bx) * 2 < (aw + bw) && Math.abs(ay - by) * 2 < (ah + bh);
  }

  function applyDamage(e, dmg) {
    if (e.dead) return;
    if (e.invulnTimer > 0) return; // hyperarmor while the boss is channeling an attack
    dmg *= e.staggerBonus || 1; // bonus damage during a boss's post-nova stagger window
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
    player.bullets += 2; // every kill restocks bullets, even a soulless shambler
    spawnDeathParticles(e.x, e.y, e.cfg.color);
    addMessage(e.x, e.y - 16, `+${e.cfg.points}`, '#dfeee4');
    if (e.cfg.soul) {
      player.souls[e.cfg.soul]++;
      spawnSoulParticle(e.x, e.y, e.cfg.soul);
      sfx.soul();
    }
    if (e.cfg.isBoss) {
      stopBossMusic();
      if (e.cfg.name === 'boss') {
        player.shadowHelm = true;
        player.helmDmgBonus = 1.1;
        spawnExplosionParticles(e.x, e.y, ['#a78bfa', '#e0d4ff']);
        spawnShockwave(e.x, e.y, 'rgba(167,139,250,0.9)', 90);
        addMessage(e.x, e.y - 30, "YOU CLAIM THE GUARDIAN'S SHADOW HELM", '#a78bfa');
      } else if (e.cfg.name === 'archdemon') {
        player.demonKnife = true;
        spawnExplosionParticles(e.x, e.y, ['#ff5a1f', '#ffcf4a']);
        spawnShockwave(e.x, e.y, 'rgba(255,90,31,0.9)', 110);
        addMessage(e.x, e.y - 30, 'THE ARCH DEMON FALLS — YOU CLAIM THE DEMON KNIFE', '#ff5a1f');
      }
      sfx.win();
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

  function findNearestEnemy(x, y, maxDist, exclude) {
    let target = null, bestDist = maxDist;
    for (const o of enemies) {
      if (o.dead || (exclude && exclude.includes(o))) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bestDist) { bestDist = d; target = o; }
    }
    return target;
  }

  // ---------- Guardian's helm ability: Wither ----------
  // A once-per-floor curse, unlocked by the Shadow Helm, that permanently
  // halves one enemy's remaining health pool and every point of damage it
  // deals for the rest of the floor — a hard counter to a single dangerous
  // target (the Guardian included, on a later attempt).
  function useSpecialAttack() {
    if (!player.shadowHelm) return;
    if (player.usedSpecialThisFloor) {
      addMessage(player.x, player.y - 24, 'WITHER ALREADY USED', '#8a6fd1');
      sfx.empty();
      return;
    }
    const target = findNearestEnemy(player.x, player.y, 350);
    if (!target) {
      addMessage(player.x, player.y - 24, 'NO TARGET IN RANGE', '#c9b98f');
      sfx.empty();
      return;
    }
    if (target.invulnTimer > 0) {
      addMessage(player.x, player.y - 24, 'TARGET HAS HYPERARMOR', '#c9b98f');
      sfx.empty();
      return;
    }
    player.usedSpecialThisFloor = true;
    target.hp *= 0.5;
    target.maxHp *= 0.5;
    target.weakDmgMult = 0.5;
    target.weakened = true;
    spawnExplosionParticles(target.x, target.y, ['#8a6fd1', '#2a1a3a']);
    spawnShockwave(target.x, target.y, 'rgba(122,95,201,0.9)', 50);
    shakeScreen(8);
    sfx.groan();
    addMessage(target.x, target.y - target.cfg.h / 2 - 10, 'WITHERED', '#8a6fd1');
  }

  function chainLightning(fromEnemy, dmg, excluded, jumpsLeft) {
    if (jumpsLeft <= 0) return;
    const target = findNearestEnemy(fromEnemy.x, fromEnemy.y, 90, excluded);
    if (!target) return;
    spawnLightningArc(fromEnemy.x, fromEnemy.y, target.x, target.y);
    applyDamage(target, dmg);
    excluded.push(target);
    chainLightning(target, dmg * 0.7, excluded, jumpsLeft - 1);
  }
  function spawnLightningArc(x1, y1, x2, y2) {
    particles.push({ x: x1, y: y1, x2, y2, vx: 0, vy: 0, life: 0.15, maxLife: 0.15, color: '#d8c7ff', shape: 'arc', grav: false });
  }

  function shoot() {
    if (player.fireCooldown > 0 || player.shockedTimer > 0) return;
    let ammo = player.ammo;
    if (ammo === 'knife') { knifeAttack(); return; }
    if (ammo !== 'normal' && player.souls[ammo] <= 0) {
      addMessage(player.x, player.y - 24, 'NO SOULS', '#c9b98f');
      sfx.empty();
      ammo = 'normal'; player.ammo = 'normal';
    }
    if (ammo === 'normal' && player.bullets <= 0) {
      knifeAttack();
      return;
    }
    player.fireCooldown = BASE_COOLDOWN;
    const dir = player.facing;
    let vx = 0, vy = 0;
    if (player.aim === -1) { vy = -420; }
    else if (player.aim === 1 && !player.onGround) { vy = 420; }
    else { vx = 420 * dir; }
    // Bullets are logically spawned at the player's own center (not out at
    // the visual muzzle tip) so a target that's overlapping the player —
    // e.g. a melee zombie right on top of you — is guaranteed to already
    // overlap the bullet on its very first frame instead of the shot
    // starting past/behind it and never registering a hit.
    const muzzleX = player.x;
    const muzzleY = player.y - 2 + (player.aim === -1 ? -10 : player.aim === 1 ? 10 : 0);
    spawnShellCasing(player.x - dir * 2, player.y - 6, dir);

    const dmg = BASE_DMG * player.dmgMult * player.helmDmgBonus;
    const homing = player.homingNext;
    player.homingNext = false;
    if (ammo === 'normal') {
      player.bullets--;
      sfx.shot();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'normal', dmg, homing });
      if (player.bullets <= 0) addMessage(player.x, player.y - 24, 'OUT OF BULLETS', '#c9b98f');
    } else if (ammo === 'berserker') {
      player.souls.berserker--; sfx.heavyShot();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'berserker', dmg: dmg * 3, homing });
    } else if (ammo === 'pyromancer') {
      player.souls.pyromancer--; sfx.shot();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'pyro', dmg, homing });
    } else if (ammo === 'frost') {
      player.souls.frost--; sfx.frost();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'frost', dmg: dmg * 0.7, homing });
    } else if (ammo === 'lightning') {
      player.souls.lightning--; sfx.frost();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'lightning', dmg: dmg * 1.2, homing });
    } else if (ammo === 'acid') {
      player.souls.acid--; sfx.shot();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'acid', dmg: dmg * 0.75, homing });
    } else if (ammo === 'shadow') {
      player.souls.shadow--; sfx.frost();
      pBullets.push({ x: muzzleX, y: muzzleY, vx, vy, kind: 'shadow', dmg: dmg * 0.5, homing });
    }
  }

  // Backup melee weapon once you're out of bullets — a short-range swipe
  // that can hit whatever's directly in front of (or above/below) you.
  // Beating the Arch Demon upgrades it into the Demon Knife: instead of a
  // stationary swipe, it's a short forward dash-strike that burns (DoT)
  // everything it cuts through along the way.
  function knifeAttack() {
    player.fireCooldown = BASE_COOLDOWN;
    player.knifeSwing = 0.15;
    const dir = player.facing;
    const ky = player.y - 2 + (player.aim === -1 ? -10 : player.aim === 1 ? 10 : 0);
    const dmg = BASE_DMG * player.dmgMult * player.helmDmgBonus;

    if (player.demonKnife) {
      const startX = player.x;
      const dashDist = 50, stepSize = 8;
      let remaining = dashDist;
      while (remaining > 0) {
        const step = Math.min(stepSize, remaining);
        const testX = player.x + dir * step;
        if (isSolidPixel(testX, player.y)) break;
        player.x = testX;
        remaining -= step;
      }
      sfx.demonSlash();
      spawnHitParticles(player.x, ky, '#ff8a3d');
      const loX = Math.min(startX, player.x) - 12, hiX = Math.max(startX, player.x) + 12;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e.x > loX && e.x < hiX && Math.abs(e.y - ky) < e.cfg.h / 2 + 14) {
          applyDamage(e, dmg);
          if (!e.dead) { e.burnTimer = 3; e.burnTick = 0.5; }
        }
      }
      return;
    }

    const range = 26;
    const kx = player.x + dir * (range / 2 + 4);
    sfx.knife();
    spawnHitParticles(kx, ky, '#e8e8e8');
    for (const e of enemies) {
      if (e.dead) continue;
      if (rectsOverlap(kx, ky, range, range, e.x, e.y, e.cfg.w, e.cfg.h)) {
        applyDamage(e, dmg);
      }
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
  function spawnAcidPuddle(x, y, dmgMult = 1) {
    spawnHitParticles(x, y, '#8bc34a');
    hazards.push({ x, y, radius: 20, life: 3, tick: 0.4, dmg: 5 * dmgMult });
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
    'Space', 'KeyX', 'KeyJ', 'ControlLeft', 'KeyR', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8',
  ]);

  // Single source of truth for the Digit1-8 ammo hotkeys, also reused by the
  // on-screen ammo-cycle button so keyboard and touch never drift apart.
  // Digit8 ('knife') is a manual switch to melee, distinct from the
  // automatic fallback that kicks in when normal bullets run out.
  const DIGIT_AMMO = {
    Digit1: 'normal', Digit2: 'berserker', Digit3: 'pyromancer',
    Digit4: 'frost', Digit5: 'lightning', Digit6: 'acid', Digit7: 'shadow', Digit8: 'knife',
  };
  const AMMO_CYCLE = Object.values(DIGIT_AMMO);

  function handleKeyDown(ev) {
    keys[ev.code] = true;
    if (GAME_KEYS.has(ev.code)) ev.preventDefault();
    if (state === 'cutscene') {
      if (ev.code === 'Space' || ev.code === 'Enter' || ev.code === 'KeyX' || ev.code === 'KeyJ') advanceCutscene();
      return;
    }
    if (state !== 'playing') return;
    if (DIGIT_AMMO[ev.code]) player.ammo = DIGIT_AMMO[ev.code];
    if (ev.code === 'KeyW' || ev.code === 'ArrowUp') player.jumpBuffer = 0.12;
    if (ev.code === 'KeyR') useSpecialAttack();
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

  // ---------- Save / resume ----------
  // Progress is saved at each checkpoint, floor transition, and respawn (plus
  // a periodic autosave for score/kills/upgrades between checkpoints) so
  // closing and reopening the page can offer to pick back up from there.
  const SAVE_KEY = 'templeOfBones_save_v1';

  function saveGame() {
    if (state !== 'playing') return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        v: 1,
        levelIndex,
        mobileControlsEnabled,
        respawn: { x: respawn.x, y: respawn.y },
        player: {
          hp: player.hp, maxHp: player.maxHp, lives: player.lives,
          score: player.score, kills: player.kills,
          ammo: player.ammo, bullets: player.bullets,
          souls: { ...player.souls },
          dmgMult: player.dmgMult, armor: player.armor,
          upgrades: { ...player.upgrades },
          shadowHelm: player.shadowHelm, helmDmgBonus: player.helmDmgBonus,
          demonKnife: player.demonKnife,
        },
      }));
    } catch (e) { /* storage unavailable/full — saving is a convenience, never block play */ }
  }

  function loadSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (
        !data || data.v !== 1 || !LEVEL_DEFS[data.levelIndex] ||
        !data.respawn || typeof data.respawn.x !== 'number' || typeof data.respawn.y !== 'number' ||
        !data.player || typeof data.player !== 'object'
      ) return null;
      return data;
    } catch (e) { return null; }
  }

  function clearSave() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  }

  function resumeSave(save) {
    ensureAudio();
    claimFocus();
    stopBossMusic();
    levelIndex = save.levelIndex;
    mobileControlsEnabled = !!save.mobileControlsEnabled;
    buildMap();
    player = newPlayer();
    Object.assign(player, save.player);
    player.souls = { berserker: 0, pyromancer: 0, frost: 0, lightning: 0, acid: 0, shadow: 0, ...save.player.souls };
    player.upgrades = { damage: 0, vitality: 0, armor: 0, ...save.player.upgrades };
    elapsed = 0; shake = { t: 0, mag: 0 };
    enterLevelEntitiesAt(save.respawn.x, save.respawn.y);
    levelBanner = { text: `FLOOR ${levelIndex + 1} — ${currentLevel().name.toUpperCase()}`, t: 3 };
    state = 'playing';
    resumeScreen.classList.add('hidden');
    deviceScreen.classList.add('hidden');
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    shopScreen.classList.add('hidden');
    skipCutsceneBtn.classList.add('hidden');
    if (currentLevel().theme === 'dungeon' || currentLevel().theme === 'hell') startBossMusic();
    sfx.checkpoint();
  }

  // ---------- Device choice & on-screen touch controls (mobile) ----------
  function fakeKeyEvent(code) { return { code, preventDefault() {} }; }
  function pressKey(code) { handleKeyDown(fakeKeyEvent(code)); }
  function releaseKey(code) { handleKeyUp(fakeKeyEvent(code)); }

  function bindHoldButton(el, code) {
    // Release implicit touch pointer capture so a finger that slides from
    // one D-pad button onto another (a normal quick-turn gesture) generates
    // pointerenter/pointerleave on the buttons it crosses instead of being
    // stuck reporting events for whichever button it first touched.
    const start = (ev) => {
      ev.preventDefault();
      try { el.releasePointerCapture(ev.pointerId); } catch (e) { /* not captured */ }
      pressKey(code);
    };
    const enter = (ev) => { if (ev.pressure > 0 || ev.buttons > 0) pressKey(code); };
    const end = (ev) => { ev.preventDefault(); releaseKey(code); };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerenter', enter);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
    el.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  bindHoldButton(document.getElementById('tcLeft'), 'ArrowLeft');
  bindHoldButton(document.getElementById('tcRight'), 'ArrowRight');
  bindHoldButton(document.getElementById('tcUp'), 'ArrowUp');
  bindHoldButton(document.getElementById('tcDown'), 'ArrowDown');
  bindHoldButton(document.getElementById('tcShoot'), 'Space');

  const tcWitherBtn = document.getElementById('tcWither');
  tcWitherBtn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    pressKey('KeyR');
    releaseKey('KeyR');
  });
  tcWitherBtn.addEventListener('contextmenu', (ev) => ev.preventDefault());

  const tcAmmoBtn = document.getElementById('tcAmmo');
  tcAmmoBtn.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    if (state !== 'playing') return;
    const idx = AMMO_CYCLE.indexOf(player.ammo);
    player.ammo = AMMO_CYCLE[(idx + 1) % AMMO_CYCLE.length];
  });
  tcAmmoBtn.addEventListener('contextmenu', (ev) => ev.preventDefault());

  const likelyMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  deviceGuessEl.textContent = `Looks like you're on ${likelyMobile ? 'a touchscreen device' : 'a computer'} — tap to confirm.`;

  function chooseDevice(mobile) {
    mobileControlsEnabled = mobile;
    deviceScreen.classList.add('hidden');
    startScreen.classList.remove('hidden');
  }
  chooseMobileBtn.addEventListener('click', () => chooseDevice(true));
  chooseDesktopBtn.addEventListener('click', () => chooseDevice(false));

  // On load, offer to resume a saved run instead of the usual device-choice
  // screen — but only once there's actually a save to offer.
  const pendingSave = loadSave();
  if (pendingSave) {
    const floorName = LEVEL_DEFS[pendingSave.levelIndex].name;
    resumeSummaryEl.textContent = `Floor ${pendingSave.levelIndex + 1} — ${floorName} · Score ${pendingSave.player.score} · Kills ${pendingSave.player.kills}`;
    resumeScreen.classList.remove('hidden');
  } else {
    deviceScreen.classList.remove('hidden');
  }
  resumeContinueBtn.addEventListener('click', () => {
    try {
      resumeSave(pendingSave);
    } catch (e) {
      // A corrupt/unexpectedly-shaped save shouldn't strand the player on
      // a dead Continue button — fall back to a normal new game.
      clearSave();
      resumeScreen.classList.add('hidden');
      deviceScreen.classList.remove('hidden');
    }
  });
  resumeNewGameBtn.addEventListener('click', () => {
    clearSave();
    resumeScreen.classList.add('hidden');
    deviceScreen.classList.remove('hidden');
  });

  // Safety net: if a touch sequence gets interrupted by the OS (incoming
  // call, app-switch gesture) without delivering pointerup/pointercancel to
  // whatever on-screen button was held, don't leave that input stuck on.
  function releaseHeldMoveKeys() {
    releaseKey('ArrowLeft'); releaseKey('ArrowRight');
    releaseKey('ArrowUp'); releaseKey('ArrowDown'); releaseKey('Space');
  }
  window.addEventListener('blur', releaseHeldMoveKeys);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseHeldMoveKeys(); });

  function syncTouchControls() {
    const show = mobileControlsEnabled && state === 'playing';
    if (show === touchControlsShown) return;
    touchControlsShown = show;
    touchControls.classList.toggle('hidden', !show);
  }

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
    player.knifeSwing = Math.max(0, player.knifeSwing - dt);
    player.coyote = Math.max(0, player.coyote - dt);
    player.jumpBuffer = Math.max(0, player.jumpBuffer - dt);
    player.shockedTimer = Math.max(0, player.shockedTimer - dt);

    const left = held('ArrowLeft', 'KeyA'), right = held('ArrowRight', 'KeyD');
    const up = held('ArrowUp', 'KeyW'), down = held('ArrowDown', 'KeyS');
    if (left && !right) { player.vx = -MOVE_SPEED; player.facing = -1; }
    else if (right && !left) { player.vx = MOVE_SPEED; player.facing = 1; }
    else player.vx = 0;

    player.aim = up ? -1 : (down && !player.onGround ? 1 : 0);

    if (player.onGround) { player.coyote = 0.09; player.jumpsUsed = 0; }
    if (player.jumpBuffer > 0 && (player.coyote > 0 || player.jumpsUsed < 2)) {
      const isDoubleJump = player.coyote <= 0;
      player.vy = JUMP_VELOCITY * (isDoubleJump ? 0.85 : 1);
      player.jumpsUsed = Math.max(player.jumpsUsed, 1) + (isDoubleJump ? 1 : 0);
      player.jumpBuffer = 0; player.coyote = 0;
      sfx.jump();
      if (isDoubleJump) {
        sfx.frost();
        for (let i = 0; i < 8; i++) {
          const a = Math.random() * Math.PI * 2;
          particles.push({ x: player.x, y: player.y + player.h / 2, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 20, life: 0.3, color: '#dfeee4', size: 2, grav: true });
        }
      }
    }
    const jumpHeld = held('KeyW', 'ArrowUp');
    if (player.vy < 0 && !jumpHeld) player.vy *= 0.55; // variable jump height

    player.vy = Math.min(MAX_FALL, player.vy + GRAVITY * dt);

    // shadow-bolt pull (horizontal component): added on top of the input-
    // driven vx (rather than overwriting it) so it still gets resolved by
    // moveAndCollide's wall/ground checks, and decays at a fixed per-second
    // rate independent of framerate. vx is safe to re-add every frame since
    // it's freshly re-derived from input each frame rather than persisting;
    // the vertical component is applied once, directly, at the point of
    // impact instead (see updateBullets) since vy is persistent state.
    if (player.knockTimer > 0) {
      player.knockTimer -= dt;
      player.vx += player.knockX;
      player.knockX *= Math.exp(-6 * dt);
    }

    moveAndCollide(player, dt);

    if (player.x < player.w / 2) player.x = player.w / 2;

    // The Guardian's arena: cross into it and the way back seals shut
    // until the boss is dead — no retreating from the fight.
    if (currentLevel().theme === 'dungeon' || currentLevel().theme === 'hell') {
      const boss = enemies.find(en => en.cfg.isBoss);
      if (boss && !boss.dead) {
        if (!bossArenaSealed && player.x >= BOSS_ARENA_START_COL * TILE) {
          bossArenaSealed = true;
          sfx.checkpoint();
          addMessage(player.x, player.y - 40, 'THE ARENA SEALS SHUT', boss.cfg.hudColor);
        }
        if (bossArenaSealed) player.x = Math.max(player.x, BOSS_ARENA_START_COL * TILE);
      } else if (bossArenaSealed) {
        bossArenaSealed = false;
      }
    }

    if (held('KeyX', 'KeyJ', 'ControlLeft', 'Space')) shoot();

    if (player.vx !== 0 && player.onGround) player.walkT += dt;
    else player.walkT = 0;

    // checkpoints
    for (const c of LEVEL_CHECKPOINTS) {
      const cx = c * TILE + TILE / 2;
      if (player.onGround && player.x >= cx && respawn.x < cx) {
        respawn = { x: cx, y: player.y };
        sfx.checkpoint();
        saveGame();
        addMessage(player.x, player.y - 30, 'CHECKPOINT', '#ffcd3c');
      }
    }

    // fell into a pit
    if (player.y > VH + 40) { loseLife('fell'); return; }

    // goal
    if (player.x >= GOAL_COL * TILE && state === 'playing') {
      const boss = enemies.find(e => e.cfg.isBoss);
      if (boss && !boss.dead) {
        player.x = GOAL_COL * TILE - 2;
        player.blockMsgCooldown = Math.max(0, (player.blockMsgCooldown || 0) - dt);
        if (player.blockMsgCooldown <= 0) {
          addMessage(player.x, player.y - 30, `DEFEAT ${boss.cfg.displayName} FIRST`, boss.cfg.hudColor);
          player.blockMsgCooldown = 1.5;
        }
      } else if (levelIndex + 1 < LEVEL_DEFS.length) {
        const next = levelIndex + 1;
        if (LEVEL_DEFS[next].theme === 'hell') playCutscene(HELL_CUTSCENE, () => openShop(next));
        else openShop(next);
      } else {
        state = 'win';
        clearSave();
        endTitle.innerHTML = 'THE INFERNO <span class="accent">BOWS TO YOU</span>';
        finalStats.textContent = `Score: ${player.score} — Kills: ${player.kills} — Time: ${elapsed.toFixed(1)}s`;
        gameOverScreen.classList.remove('hidden');
        sfx.win();
      }
    }
  }

  function hurtPlayer(dmg) {
    if (player.invuln > 0) return;
    dmg = Math.max(1, dmg - player.armor);
    player.hp -= dmg;
    player.invuln = 1.0;
    player.hurtFlash = 0.3;
    sfx.hurt();
    shakeScreen(6);
    if (player.hp <= 0) loseLife('hp');
  }

  // ---------- Boss AI ----------
  // Shared machinery both bosses build on: invuln/stagger timers, a
  // channeled-nova phase triggered at hp thresholds (invulnerable while
  // charging, a big hit on release, then a bonus-damage stagger window),
  // and the recovery beat after any attack. Each boss's own update function
  // handles its idle chase and attack-specific states, then defers here for
  // anything already in a shared state (nova_channel/stagger/recover).
  function maybeTriggerNova(e, novaCfg) {
    const hpPct = e.hp / e.maxHp;
    if ((!e.usedNova50 && hpPct <= 0.5) || (!e.usedNova20 && hpPct <= 0.2)) {
      if (hpPct <= 0.5) e.usedNova50 = true;
      if (hpPct <= 0.2) e.usedNova20 = true;
      e.attackState = 'nova_channel'; e.attackTimer = novaCfg.channelTime; e.invulnTimer = novaCfg.channelTime;
      addMessage(e.x, e.y - 50, novaCfg.channelMsg, novaCfg.color);
      sfx.groan();
      return true;
    }
    return false;
  }

  function updateBossSharedStates(e, dt, novaCfg) {
    if (e.invulnTimer > 0) e.invulnTimer -= dt;
    if (e.staggerTimer > 0) {
      e.staggerTimer -= dt;
      if (e.staggerTimer <= 0) e.staggerBonus = 1;
    }
    if (e.attackState === 'nova_channel') {
      e.vx = 0;
      e.attackTimer -= dt;
      e.novaRadius = novaCfg.radius * (1 - Math.max(0, e.attackTimer) / novaCfg.channelTime);
      if (e.attackTimer <= 0) {
        spawnExplosionParticles(e.x, e.y, novaCfg.palette);
        spawnShockwave(e.x, e.y, novaCfg.ringColor, novaCfg.radius);
        shakeScreen(16);
        sfx.explosion();
        if (Math.hypot(player.x - e.x, player.y - e.y) < novaCfg.radius) {
          hurtPlayer(novaCfg.dmg * e.weakDmgMult);
          addMessage(player.x, player.y - 28, novaCfg.hitMsg, novaCfg.color);
        }
        e.attackState = 'stagger'; e.attackTimer = novaCfg.staggerTime;
        e.staggerTimer = novaCfg.staggerTime; e.staggerBonus = novaCfg.staggerBonus;
        e.novaRadius = 0;
      }
      return true;
    }
    if (e.attackState === 'stagger') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { e.attackState = 'recover'; e.attackTimer = 0.3; }
      return true;
    }
    if (e.attackState === 'recover') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { e.attackState = 'idle'; e.attackTimer = 1.2 + Math.random() * 0.8; }
      return true;
    }
    return false;
  }

  // A multi-hit dash: telegraph, then a burst of `count` short dashes at
  // `speed`, each landing at most once via a wider-than-body hitbox, with a
  // brief retarget pause between dashes so the direction can re-lock onto
  // the player. Shared by the Guardian's dash and the Arch Demon's charge.
  function updateDashAttack(e, dt, states, cfg) {
    if (e.attackState === states.telegraph) {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackState = states.dash; e.dashesLeft = cfg.count; e.attackTimer = cfg.dashTime;
        e.dashDir = Math.sign(player.x - e.x) || 1; e.hitThisStep = false;
      }
      return true;
    }
    if (e.attackState === states.dash) {
      e.vx = e.dashDir * cfg.speed;
      e.x = Math.max(e.minX, Math.min(e.maxX, e.x + e.vx * dt));
      if (!e.hitThisStep && rectsOverlap(e.x, e.y, e.cfg.w + cfg.hitboxPad, e.cfg.h, player.x, player.y, player.w, player.h)) {
        hurtPlayer(cfg.dmg * e.weakDmgMult);
        e.hitThisStep = true;
        shakeScreen(cfg.shake);
      }
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.dashesLeft--;
        if (e.dashesLeft > 0) { e.attackState = states.retarget; e.attackTimer = cfg.retargetTime; }
        else { e.attackState = 'recover'; e.attackTimer = cfg.recoverTime; e.vx = 0; }
      }
      return true;
    }
    if (e.attackState === states.retarget) {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackState = states.dash; e.attackTimer = cfg.dashTime;
        e.dashDir = Math.sign(player.x - e.x) || 1; e.hitThisStep = false;
      }
      return true;
    }
    return false;
  }

  const GUARDIAN_DASH_STATES = { telegraph: 'dash_telegraph', dash: 'dash', retarget: 'dash_retarget' };
  const GUARDIAN_DASH = { count: 3, speed: 520, hitboxPad: 10, dmg: 16, shake: 6, dashTime: 0.15, retargetTime: 0.12, recoverTime: 0.5 };
  const ARCHDEMON_CHARGE_STATES = { telegraph: 'charge_telegraph', dash: 'charge', retarget: 'charge_retarget' };
  const ARCHDEMON_CHARGE = { count: 2, speed: 480, hitboxPad: 12, dmg: 24, shake: 7, dashTime: 0.2, retargetTime: 0.15, recoverTime: 0.5 };

  const GUARDIAN_NOVA = {
    channelTime: 1.0, radius: 140, dmg: 30, staggerTime: 1.5, staggerBonus: 1.5,
    channelMsg: 'THE GUARDIAN GATHERS DARK POWER', hitMsg: 'OVERWHELMED', color: '#b090ff',
    palette: ['#b090ff', '#e0d4ff'], ringColor: 'rgba(176,144,255,0.95)',
  };

  // The Guardian cycles through four distinct attacks — a triple dash
  // flurry, a ground slam shockwave, a dark-bolt barrage, and (once at half
  // and again at a fifth health) the shared channeled nova above.
  function updateBossAI(e, dt) {
    // Dash has its own dedicated (lower) contact damage via a wider hitbox
    // below; skip the generic body-contact check there so it doesn't fire
    // first, eat the post-hit invuln window, and silently override it.
    if (e.attackState !== 'dash' && rectsOverlap(e.x, e.y, e.cfg.w, e.cfg.h, player.x, player.y, player.w, player.h)) {
      hurtPlayer(e.cfg.dmg * e.weakDmgMult);
    }

    if (updateBossSharedStates(e, dt, GUARDIAN_NOVA)) return;
    if (updateDashAttack(e, dt, GUARDIAN_DASH_STATES, GUARDIAN_DASH)) return;

    if (e.attackState === 'idle') {
      if (maybeTriggerNova(e, GUARDIAN_NOVA)) return;
      const dist = player.x - e.x;
      e.vx = Math.abs(dist) > 40 ? Math.sign(dist) * e.cfg.speed : 0;
      e.x = Math.max(e.minX, Math.min(e.maxX, e.x + e.vx * dt));
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.34) { e.attackState = 'dash_telegraph'; e.attackTimer = 0.4; }
        else if (roll < 0.64) { e.attackState = 'slam_telegraph'; e.attackTimer = 0.6; }
        else { e.attackState = 'barrage_telegraph'; e.attackTimer = 0.3; }
      }
      return;
    }

    if (e.attackState === 'slam_telegraph') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackState = 'slam'; e.attackTimer = 0.15;
        const radius = 100;
        spawnShockwave(e.x, e.y + e.cfg.h / 2, 'rgba(167,139,250,0.9)', radius);
        shakeScreen(12);
        sfx.explosion();
        if (player.onGround && Math.abs(player.x - e.x) < radius) {
          hurtPlayer(22 * e.weakDmgMult);
          addMessage(player.x, player.y - 28, 'SLAMMED', '#a78bfa');
        }
      }
      return;
    }
    if (e.attackState === 'slam') {
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { e.attackState = 'recover'; e.attackTimer = 0.5; }
      return;
    }

    if (e.attackState === 'barrage_telegraph') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { e.attackState = 'barrage'; e.dashesLeft = 5; e.attackTimer = 0; }
      return;
    }
    if (e.attackState === 'barrage') {
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        const dx = player.x - e.x, dy = player.y - e.y;
        const baseAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.3;
        eBullets.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle) * 260, vy: Math.sin(baseAngle) * 260, kind: 'dark', dmg: 9 * e.weakDmgMult });
        e.dashesLeft--;
        e.attackTimer = 0.15;
        if (e.dashesLeft <= 0) { e.attackState = 'recover'; e.attackTimer = 0.4; }
      }
      return;
    }
  }

  const ARCHDEMON_NOVA = {
    channelTime: 1.2, radius: 160, dmg: 35, staggerTime: 1.5, staggerBonus: 1.5,
    channelMsg: 'THE ARCH DEMON DRINKS IN THE FLAMES', hitMsg: 'ENGULFED', color: '#ff5a1f',
    palette: ['#ff5a1f', '#ffcf4a'], ringColor: 'rgba(255,90,31,0.95)',
  };

  // The Arch Demon commands the whole of Hell alone — no lesser zombies to
  // hide behind here. It cycles between five attacks — a double charge, a
  // flat fireball barrage, a lobbed meteor rain, a ground-scorching eruption
  // that punishes standing still (jumping it, unlike the Guardian's slam,
  // doesn't help), and a call for imp reinforcements — on top of the shared
  // channeled nova at half and a fifth health.
  function updateArchDemonAI(e, dt) {
    if (e.attackState !== 'charge' && rectsOverlap(e.x, e.y, e.cfg.w, e.cfg.h, player.x, player.y, player.w, player.h)) {
      hurtPlayer(e.cfg.dmg * e.weakDmgMult);
    }

    if (updateBossSharedStates(e, dt, ARCHDEMON_NOVA)) return;
    if (updateDashAttack(e, dt, ARCHDEMON_CHARGE_STATES, ARCHDEMON_CHARGE)) return;

    if (e.attackState === 'idle') {
      if (maybeTriggerNova(e, ARCHDEMON_NOVA)) return;
      const dist = player.x - e.x;
      e.vx = Math.abs(dist) > 40 ? Math.sign(dist) * e.cfg.speed : 0;
      e.x = Math.max(e.minX, Math.min(e.maxX, e.x + e.vx * dt));
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        const roll = Math.random();
        if (roll < 0.22) { e.attackState = 'charge_telegraph'; e.attackTimer = 0.45; }
        else if (roll < 0.44) { e.attackState = 'fireball_telegraph'; e.attackTimer = 0.35; }
        else if (roll < 0.66) { e.attackState = 'meteor_telegraph'; e.attackTimer = 0.5; }
        else if (roll < 0.86) { e.attackState = 'eruption_telegraph'; e.attackTimer = 0.6; }
        else { e.attackState = 'summon_telegraph'; e.attackTimer = 0.5; }
      }
      return;
    }

    if (e.attackState === 'fireball_telegraph') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { e.attackState = 'fireball'; e.dashesLeft = 6; e.attackTimer = 0; }
      return;
    }
    if (e.attackState === 'fireball') {
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        const dx = player.x - e.x, dy = player.y - e.y;
        const baseAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.25;
        eBullets.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle) * 280, vy: Math.sin(baseAngle) * 280, kind: 'fire', dmg: 10 * e.weakDmgMult });
        e.dashesLeft--;
        e.attackTimer = 0.12;
        if (e.dashesLeft <= 0) { e.attackState = 'recover'; e.attackTimer = 0.4; }
      }
      return;
    }

    if (e.attackState === 'meteor_telegraph') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { e.attackState = 'meteor'; e.dashesLeft = 4; e.attackTimer = 0; }
      return;
    }
    if (e.attackState === 'meteor') {
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        const dx = player.x - e.x + (Math.random() - 0.5) * 70, dy = player.y - e.y;
        const baseAngle = Math.atan2(dy, dx);
        eBullets.push({ x: e.x, y: e.y, vx: Math.cos(baseAngle) * 190, vy: Math.sin(baseAngle) * 190 - 160, kind: 'fire', dmg: 14 * e.weakDmgMult, grav: true });
        e.dashesLeft--;
        e.attackTimer = 0.2;
        if (e.dashesLeft <= 0) { e.attackState = 'recover'; e.attackTimer = 0.5; }
      }
      return;
    }

    if (e.attackState === 'eruption_telegraph') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        e.attackState = 'eruption'; e.attackTimer = 0.2;
        const radius = 130;
        spawnShockwave(e.x, e.y + e.cfg.h / 2, 'rgba(255,90,31,0.9)', radius);
        shakeScreen(14);
        sfx.explosion();
        // Unlike the Guardian's slam, jumping doesn't save you here — only
        // putting horizontal distance between yourself and the eruption does.
        if (Math.abs(player.x - e.x) < radius) {
          hurtPlayer(28 * e.weakDmgMult);
          addMessage(player.x, player.y - 28, 'SCORCHED', '#ff5a1f');
        }
      }
      return;
    }
    if (e.attackState === 'eruption') {
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { e.attackState = 'recover'; e.attackTimer = 0.5; }
      return;
    }

    if (e.attackState === 'summon_telegraph') {
      e.vx = 0;
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) {
        // Clamp to the demon's own leash (already gap-free by construction
        // via platformExtent) so an imp can never spawn floating over a pit.
        const minCol = Math.floor(e.minX / TILE), maxCol = Math.floor(e.maxX / TILE);
        const col = Math.round(e.x / TILE);
        const row = ROWS - 1;
        enemies.push(spawnEnemy('imp', Math.max(minCol, col - 2), row));
        enemies.push(spawnEnemy('imp', Math.min(maxCol, col + 2), row));
        spawnExplosionParticles(e.x, e.y, ['#ff5a2e', '#ffb37a']);
        sfx.groan();
        addMessage(e.x, e.y - 50, 'IMPS ANSWER THE CALL', '#ff5a2e');
        e.attackState = 'recover'; e.attackTimer = 0.6;
      }
      return;
    }
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
      if (e.acidTimer > 0) {
        e.acidTimer -= dt; e.acidTick -= dt;
        if (Math.random() < dt * 8) {
          particles.push({ x: e.x + (Math.random() - 0.5) * e.cfg.w, y: e.y - e.cfg.h / 2, vx: (Math.random() - 0.5) * 12, vy: -20 - Math.random() * 15, life: 0.35, color: '#8bc34a', size: 2, grav: true });
        }
        if (e.acidTick <= 0) {
          applyDamage(e, 5);
          addMessage(e.x, e.y - e.cfg.h / 2 - 4, '-5', '#8bc34a');
          e.acidTick = 0.4;
        }
      }
      if (e.dead) continue;

      const distToPlayer = Math.hypot(e.x - player.x, e.y - player.y);

      if (e.cfg.isBoss) {
        if (e.cfg.name === 'archdemon') updateArchDemonAI(e, dt);
        else updateBossAI(e, dt);
      } else if (e.cfg.melee) {
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
          hurtPlayer(e.cfg.dmg * e.weakDmgMult);
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
            eBullets.push({ x: e.x, y: e.y, vx, vy, kind: e.cfg.kind, dmg: e.cfg.projDmg * e.weakDmgMult, grav: !!e.cfg.arc, pull: !!e.cfg.pull, srcX: e.x, srcY: e.y, weakDmgMult: e.weakDmgMult });
            if (e.cfg.kind === 'lightning') sfx.frost();
          }
        }
        if (rectsOverlap(e.x, e.y, e.cfg.w, e.cfg.h, player.x, player.y, player.w, player.h)) {
          hurtPlayer(4 * e.weakDmgMult);
        }
      }
    }
  }

  function updateBullets(dt) {
    for (const b of pBullets) {
      if (b.homing) {
        const target = findNearestEnemy(b.x, b.y, 160);
        if (target) {
          const speed = Math.hypot(b.vx, b.vy) || 1;
          const dx = target.x - b.x, dy = target.y - b.y, d = Math.hypot(dx, dy) || 1;
          const turnRate = Math.min(1, 6 * dt);
          b.vx += (dx / d * speed - b.vx) * turnRate;
          b.vy += (dy / d * speed - b.vy) * turnRate;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.dead = isSolidPixel(b.x, b.y);
      if (b.dead) { if (b.kind === 'acid') spawnAcidPuddle(b.x, b.y); continue; }
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
          } else if (b.kind === 'lightning') {
            applyDamage(e, b.dmg);
            chainLightning(e, b.dmg * 0.6, [e], 2);
          } else if (b.kind === 'acid') {
            applyDamage(e, b.dmg);
            e.acidTimer = 2.5; e.acidTick = 0.4;
            spawnAcidPuddle(b.x, b.y);
          } else if (b.kind === 'shadow') {
            applyDamage(e, b.dmg);
            for (const o of enemies) {
              if (o.dead) continue;
              const d = Math.hypot(o.x - b.x, o.y - b.y);
              // Horizontal only — enemies have no gravity/reattachment, so a
              // vertical nudge would leave them permanently off their row.
              if (d < 90 && d > 1) { o.x += (b.x - o.x) * 0.55; }
            }
            player.homingNext = true;
            spawnShockwave(b.x, b.y, 'rgba(122,95,201,0.8)', 40);
          } else applyDamage(e, b.dmg);
          b.dead = true;
          break;
        }
      }
    }
    pBullets = pBullets.filter(b => !b.dead && b.x > camX - 30 && b.x < camX + VIEW_W + 30 && b.y > -30 && b.y < VH + 30);

    const eBulletColors = { fire: '#ff9d3d', frost: '#9fe8f5', lightning: '#d8c7ff', acid: '#8bc34a', dark: '#b090ff', shadow: '#8a6fd1' };
    for (const b of eBullets) {
      if (b.grav) b.vy += 900 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (isSolidPixel(b.x, b.y)) {
        if (b.kind === 'acid') spawnAcidPuddle(b.x, b.y, b.weakDmgMult || 1);
        b.dead = true; continue;
      }
      if (rectsOverlap(b.x, b.y, 5, 5, player.x, player.y, player.w, player.h)) {
        const wasInvuln = player.invuln > 0;
        const livesBefore = player.lives;
        hurtPlayer(b.dmg);
        // A lethal hit already moved the player (to a checkpoint via
        // respawnPlayer, or ended the run) before we get here — applying a
        // pull on top of that stale position would yank the wrong player.
        const diedOrRespawned = player.lives < livesBefore;
        if (b.kind === 'lightning') { player.shockedTimer = 1.4; sfx.frost(); addMessage(player.x, player.y - 28, 'SHOCKED', '#d8c7ff'); }
        if (b.kind === 'acid') spawnAcidPuddle(b.x, b.y, b.weakDmgMult || 1);
        if (b.pull && !wasInvuln && !diedOrRespawned) {
          // Horizontal pull is a decaying field re-applied each frame in
          // updatePlayer (vx is re-derived from input every frame, so it
          // can't accumulate). Vertical is a single direct kick instead,
          // since vy is persistent physics state — repeatedly adding to it
          // every frame like vx would compound into an unbounded velocity.
          const dx = b.srcX - player.x, dy = b.srcY - player.y, d = Math.hypot(dx, dy) || 1;
          player.knockX = (dx / d) * 480;
          player.knockTimer = 0.5;
          player.vy = Math.max(-MAX_FALL, Math.min(MAX_FALL, player.vy + (dy / d) * 240));
          addMessage(player.x, player.y - 28, 'PULLED', '#8a6fd1');
        }
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
    updateWolf(dt);
    updateBullets(dt);
    updateHazards(dt);
    updateParticles(dt);
    camX = Math.max(0, Math.min(player.x - VIEW_W / 2, VW - VIEW_W));
    if (levelBanner.t > 0) levelBanner.t -= dt;
  }

  // Starts as a puppy at the hunter's side and grows with every kill — a
  // slow melee companion rather than a gun, so it reads as a wolf, not a
  // second turret. Fully grown into Fenrir once the kill count caps out.
  const WOLF_STAGES = [
    { name: 'Puppy', dmg: 4, biteRate: 1.4, range: 100, speed: 90, scale: 0.55, color: '#8a6a4a', dark: '#5a4530', eye: '#fff2d0' },
    { name: 'Young Wolf', dmg: 7, biteRate: 1.2, range: 130, speed: 100, scale: 0.7, color: '#7a6248', dark: '#4a3a28', eye: '#ffdf9c' },
    { name: 'Wolf', dmg: 11, biteRate: 1.0, range: 160, speed: 110, scale: 0.85, color: '#6b5a44', dark: '#3a3024', eye: '#ffd25a' },
    { name: 'Dire Wolf', dmg: 16, biteRate: 0.85, range: 190, speed: 120, scale: 1.0, color: '#4a4038', dark: '#2a231d', eye: '#ffb347' },
    { name: 'Alpha Wolf', dmg: 22, biteRate: 0.7, range: 220, speed: 135, scale: 1.15, color: '#332a26', dark: '#1c1613', eye: '#ff7a3d' },
    { name: 'Fenrir', dmg: 32, biteRate: 0.5, range: 260, speed: 155, scale: 1.4, color: '#160f0d', dark: '#000000', eye: '#ff2e2e' },
  ];
  const WOLF_MAX_KILLS = 300;
  function wolfStage() { return Math.min(WOLF_STAGES.length - 1, Math.floor(player.kills / (WOLF_MAX_KILLS / (WOLF_STAGES.length - 1)))); }

  function updateWolf(dt) {
    if (!wolf) return;
    const cfg = WOLF_STAGES[wolfStage()];
    wolf.biteCooldown = Math.max(0, wolf.biteCooldown - dt);
    const target = findNearestEnemy(wolf.x, wolf.y, cfg.range);
    if (target) {
      const dx = target.x - wolf.x, dy = target.y - wolf.y, d = Math.hypot(dx, dy) || 1;
      wolf.facing = dx >= 0 ? 1 : -1;
      if (d > 12) { wolf.x += (dx / d) * cfg.speed * dt; wolf.y += (dy / d) * cfg.speed * dt; wolf.moving = true; }
      else {
        wolf.moving = false;
        if (wolf.biteCooldown <= 0) {
          wolf.biteCooldown = cfg.biteRate;
          applyDamage(target, cfg.dmg);
          spawnHitParticles(wolf.x, wolf.y, cfg.eye);
          sfx.hit();
        }
      }
    } else {
      const targetX = player.x - player.facing * 20, targetY = player.y + 2;
      const dx = targetX - wolf.x;
      wolf.facing = Math.abs(dx) > 2 ? (dx >= 0 ? 1 : -1) : (wolf.facing || 1);
      wolf.moving = Math.hypot(targetX - wolf.x, targetY - wolf.y) > 2;
      wolf.x += (targetX - wolf.x) * Math.min(1, dt * 4);
      wolf.y += (targetY - wolf.y) * Math.min(1, dt * 4);
    }
  }

  // ---------- Rendering ----------
  function px(v) { return Math.round(v); }

  function drawBackground() {
    const theme = currentLevel().theme;
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    if (theme === 'dungeon') {
      grad.addColorStop(0, '#0d0a16');
      grad.addColorStop(0.6, '#1c1428');
      grad.addColorStop(1, '#2a1a3a');
    } else if (theme === 'jungle') {
      grad.addColorStop(0, '#04140a');
      grad.addColorStop(0.6, '#0a2e1a');
      grad.addColorStop(1, '#123d20');
    } else if (theme === 'hell') {
      grad.addColorStop(0, '#1a0503');
      grad.addColorStop(0.55, '#4a1206');
      grad.addColorStop(1, '#7a2a0a');
    } else if (theme === 'ice') {
      grad.addColorStop(0, '#03060e');
      grad.addColorStop(0.6, '#0b2030');
      grad.addColorStop(1, '#153a4a');
    } else {
      grad.addColorStop(0, '#6be3d8');
      grad.addColorStop(0.6, '#8fedc9');
      grad.addColorStop(1, '#c8e896');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (theme === 'dungeon') {
      // dim blood moon
      ctx.fillStyle = 'rgba(180,60,70,0.8)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(167,139,250,0.06)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 42, 0, Math.PI * 2); ctx.fill();
    } else if (theme === 'jungle') {
      // pale green moon through the canopy
      ctx.fillStyle = 'rgba(200,255,210,0.85)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(140,255,150,0.08)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 40, 0, Math.PI * 2); ctx.fill();
    } else if (theme === 'hell') {
      // pulsing hellfire sun
      ctx.fillStyle = 'rgba(255,90,20,0.9)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,40,10,0.15)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 48, 0, Math.PI * 2); ctx.fill();
    } else if (theme === 'ice') {
      // pale frozen moon
      ctx.fillStyle = 'rgba(220,245,255,0.9)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(180,230,255,0.1)';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 44, 0, Math.PI * 2); ctx.fill();
    } else {
      // sun
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath(); ctx.arc(VIEW_W - 60, 40, 18, 0, Math.PI * 2); ctx.fill();
    }

    // distant pillars / tree trunks / spires (parallax)
    const parallax = camX * 0.4;
    ctx.fillStyle = theme === 'dungeon' ? 'rgba(20,15,30,0.6)' : theme === 'jungle' ? 'rgba(5,20,10,0.65)' : theme === 'hell' ? 'rgba(40,10,5,0.7)' : theme === 'ice' ? 'rgba(15,35,50,0.7)' : 'rgba(60,110,90,0.35)';
    for (let i = -1; i < 8; i++) {
      const x = i * 140 - (parallax % 140);
      ctx.fillRect(px(x), VIEW_H - 160, 26, 160);
      if (theme === 'jungle') {
        ctx.beginPath(); ctx.ellipse(px(x) + 13, VIEW_H - 168, 26, 18, 0, 0, Math.PI * 2); ctx.fill();
      } else if (theme === 'hell') {
        ctx.beginPath();
        ctx.moveTo(px(x) + 13, VIEW_H - 200); ctx.lineTo(px(x), VIEW_H - 160); ctx.lineTo(px(x) + 26, VIEW_H - 160);
        ctx.closePath(); ctx.fill();
      } else if (theme === 'ice') {
        // hanging icicle spikes off the pillar cap
        ctx.beginPath();
        ctx.moveTo(px(x), VIEW_H - 160); ctx.lineTo(px(x) + 13, VIEW_H - 130); ctx.lineTo(px(x) + 26, VIEW_H - 160);
        ctx.closePath(); ctx.fill();
        ctx.fillRect(px(x) - 6, VIEW_H - 176, 38, 16);
      } else {
        ctx.fillRect(px(x) - 6, VIEW_H - 172, 38, 12);
      }
    }
    if (theme === 'dungeon') {
      // drifting purple spores
      for (let i = -1; i < 14; i++) {
        const x = (i * 68 - (camX * 0.6 % 68));
        const y = (elapsed * 10 + i * 37) % VIEW_H;
        ctx.fillStyle = 'rgba(167,139,250,0.4)';
        ctx.fillRect(px(x), y, 2, 2);
      }
    } else if (theme === 'hell') {
      // rising embers
      for (let i = -1; i < 16; i++) {
        const x = (i * 55 - (camX * 0.6 % 55));
        const y = VIEW_H - ((elapsed * 26 + i * 41) % VIEW_H);
        ctx.fillStyle = `rgba(255,${110 + (i % 3) * 30},40,0.7)`;
        ctx.fillRect(px(x), y, 2, 2);
      }
    } else if (theme === 'ice') {
      // falling snow
      for (let i = -1; i < 16; i++) {
        const x = (i * 50 - (camX * 0.5 % 50)) + Math.sin(elapsed + i) * 6;
        const y = (elapsed * 18 + i * 33) % VIEW_H;
        ctx.fillStyle = 'rgba(220,245,255,0.75)';
        ctx.fillRect(px(x), y, 2, 2);
      }
    } else if (theme === 'jungle') {
      // drifting fireflies
      for (let i = -1; i < 14; i++) {
        const x = (i * 61 - (camX * 0.55 % 61));
        const y = VIEW_H * 0.3 + Math.sin(elapsed * 1.5 + i * 2) * 40 + (i % 5) * 20;
        const glow = 0.4 + Math.sin(elapsed * 5 + i) * 0.3;
        ctx.fillStyle = `rgba(180,255,140,${Math.max(0.1, glow)})`;
        ctx.fillRect(px(x), y, 2, 2);
      }
      // hanging vines
      ctx.fillStyle = 'rgba(20,60,30,0.6)';
      for (let i = -1; i < 10; i++) {
        const x = i * 95 - (camX * 0.7 % 95);
        ctx.fillRect(px(x), 0, 4, 26 + (i % 3) * 12);
      }
    } else {
      // jungle vines (temple floor)
      ctx.fillStyle = 'rgba(50,140,70,0.5)';
      for (let i = -1; i < 10; i++) {
        const x = i * 95 - (camX * 0.7 % 95);
        ctx.fillRect(px(x), 0, 4, 20 + (i % 3) * 10);
      }
    }
  }

  function hexToRgbTriplet(hex) {
    const n = parseInt(hex.slice(1), 16);
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  }

  function drawTiles() {
    const theme = currentLevel().theme;
    const dungeon = theme === 'dungeon';
    const jungle = theme === 'jungle';
    const hell = theme === 'hell';
    const ice = theme === 'ice';
    const arenaBoss = (dungeon || hell) ? enemies.find(e => e.cfg.isBoss) : null;
    const arenaRgb = hexToRgbTriplet((arenaBoss && arenaBoss.cfg.hudColor) || '#a78bfa');
    const topColor = dungeon ? '#4a4258' : jungle ? '#3a4a2a' : hell ? '#3a1408' : ice ? '#3a5a68' : '#f2d99b';
    const sideColor = dungeon ? '#241f30' : jungle ? '#1c2814' : hell ? '#1a0a04' : ice ? '#16262e' : '#c9a361';
    const edgeColor = dungeon ? 'rgba(10,8,16,0.5)' : jungle ? 'rgba(5,10,5,0.5)' : hell ? 'rgba(0,0,0,0.6)' : ice ? 'rgba(5,15,20,0.6)' : 'rgba(120,85,40,0.35)';
    const highlightColor = dungeon ? 'rgba(167,139,250,0.15)' : jungle ? 'rgba(140,255,120,0.12)' : hell ? 'rgba(255,120,40,0.25)' : ice ? 'rgba(200,240,255,0.3)' : 'rgba(255,255,255,0.25)';
    const glyphColor = dungeon ? 'rgba(167,139,250,0.35)' : jungle ? 'rgba(140,255,120,0.35)' : hell ? 'rgba(255,120,40,0.5)' : ice ? 'rgba(180,230,255,0.4)' : 'rgba(120,85,40,0.5)';

    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(COLS - 1, Math.ceil((camX + VIEW_W) / TILE) + 1);
    for (let r = 0; r < ROWS; r++) {
      for (let c = c0; c <= c1; c++) {
        if (map[r][c] !== 1) continue;
        const x = px(c * TILE - camX), y = r * TILE;
        const topExposed = r === 0 || map[r - 1][c] !== 1;
        ctx.fillStyle = topExposed ? topColor : sideColor;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = edgeColor;
        ctx.fillRect(x, y + TILE - 4, TILE, 4);
        ctx.fillRect(x, y, 2, TILE);
        const inArena = (dungeon || hell) && c >= BOSS_ARENA_START_COL;
        if (topExposed) {
          ctx.fillStyle = inArena ? `rgba(${arenaRgb},${0.25 + Math.sin(elapsed * 3 + c) * 0.1})` : highlightColor;
          ctx.fillRect(x, y, TILE, 3);
        }
        // the boss arena floor is etched with a glowing rune on every tile;
        // elsewhere it's an occasional carved glyph
        if (inArena && topExposed) {
          ctx.fillStyle = `rgba(${arenaRgb},0.55)`;
          ctx.fillRect(x + TILE / 2 - 2, y + 6, 4, 14);
          ctx.fillRect(x + TILE / 2 - 6, y + 12, 12, 2);
        } else if ((c * 7 + r * 13) % 11 === 0 && topExposed) {
          ctx.fillStyle = glyphColor;
          ctx.fillRect(x + TILE / 2 - 2, y + 8, 4, 10);
        }
      }
    }
    // torches (fire in the temple/dungeon, glowing fungus in the jungle,
    // a cold blue ice-shard glow in the frozen temple)
    ctx.font = '10px monospace';
    for (let c = c0; c <= c1; c++) {
      if (map[ROWS - 1][c] === 1 && c % 8 === 4) {
        const x = px(c * TILE - camX) + TILE / 2, y = (ROWS - 1) * TILE;
        ctx.fillStyle = dungeon ? '#3a3448' : jungle ? '#3a2f1a' : hell ? '#2a1006' : ice ? '#22404c' : '#8a5a2a';
        ctx.fillRect(x - 2, y - 14, 4, 14);
        const flick = 6 + Math.sin(elapsed * 12 + c) * 2;
        ctx.fillStyle = dungeon ? '#a78bfa' : jungle ? '#5cffa0' : hell ? '#ff5a1f' : ice ? '#6bd9e8' : '#ff8a3d';
        ctx.beginPath(); ctx.arc(x, y - 16, flick / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dungeon ? '#e0d4ff' : jungle ? '#c8ffdd' : hell ? '#ffd24a' : ice ? '#e0faff' : '#ffe27a';
        ctx.beginPath(); ctx.arc(x, y - 16, flick / 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    // goal marker: an altar in the temple, a dark rift in the dungeon,
    // a vine-choked shrine in the jungle, a lava gate in hell, a frozen
    // shrine in the ice temple
    const gx = px(GOAL_COL * TILE - camX);
    const gy = (ROWS - 1) * TILE;
    if (dungeon) {
      ctx.fillStyle = '#150d1f';
      ctx.fillRect(gx, gy - 34, TILE, 34);
      const pulse = 8 + Math.sin(elapsed * 4) * 3;
      ctx.fillStyle = 'rgba(167,139,250,0.8)';
      ctx.beginPath(); ctx.ellipse(gx + TILE / 2, gy - 20, pulse, pulse * 1.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f4e9ff';
      ctx.beginPath(); ctx.ellipse(gx + TILE / 2, gy - 20, pulse * 0.4, pulse * 0.6, 0, 0, Math.PI * 2); ctx.fill();
    } else if (hell) {
      ctx.fillStyle = '#1a0805';
      ctx.fillRect(gx, gy - 34, TILE, 34);
      const pulse = 8 + Math.sin(elapsed * 5) * 3;
      ctx.fillStyle = 'rgba(255,90,20,0.85)';
      ctx.beginPath(); ctx.ellipse(gx + TILE / 2, gy - 18, pulse, pulse * 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.ellipse(gx + TILE / 2, gy - 18, pulse * 0.4, pulse * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    } else if (jungle) {
      ctx.fillStyle = '#1a2414';
      ctx.fillRect(gx, gy - 34, TILE, 34);
      ctx.fillStyle = '#0f1a0c';
      ctx.fillRect(gx + 6, gy - 28, TILE - 12, 28);
      const pulse = 7 + Math.sin(elapsed * 4) * 3;
      ctx.fillStyle = 'rgba(140,255,150,0.75)';
      ctx.beginPath(); ctx.ellipse(gx + TILE / 2, gy - 16, pulse, pulse * 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(30,90,40,0.8)';
      ctx.fillRect(gx + 2, gy - 34, 3, 30);
      ctx.fillRect(gx + TILE - 5, gy - 30, 3, 26);
    } else if (ice) {
      ctx.fillStyle = '#0e222c';
      ctx.fillRect(gx, gy - 34, TILE, 34);
      const pulse = 7 + Math.sin(elapsed * 3.5) * 3;
      ctx.fillStyle = 'rgba(160,230,255,0.8)';
      ctx.beginPath(); ctx.ellipse(gx + TILE / 2, gy - 20, pulse, pulse * 1.3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0fcff';
      ctx.beginPath(); ctx.ellipse(gx + TILE / 2, gy - 20, pulse * 0.4, pulse * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      // flanking icicles
      ctx.fillStyle = 'rgba(200,240,255,0.7)';
      ctx.beginPath(); ctx.moveTo(gx + 3, gy - 34); ctx.lineTo(gx + 7, gy - 44); ctx.lineTo(gx + 11, gy - 34); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(gx + TILE - 11, gy - 34); ctx.lineTo(gx + TILE - 7, gy - 44); ctx.lineTo(gx + TILE - 3, gy - 34); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = '#d9c07a';
      ctx.fillRect(gx, gy - 34, TILE, 34);
      ctx.fillStyle = '#ffcd3c';
      ctx.fillRect(gx + TILE / 2 - 3, gy - 46, 6, 12 + Math.sin(elapsed * 4) * 3);
    }
  }

  function drawPlayer() {
    const x = px(player.x - camX), y = px(player.y);
    if (player.invuln > 0 && Math.floor(elapsed * 20) % 2 === 0) return;
    const dir = player.facing;
    const moving = player.onGround && player.vx !== 0;
    const bob = moving ? Math.sin(player.walkT * 12) * 2 : 0;
    const flash = player.hurtFlash > 0;
    const gunUp = player.aim === -1 ? -8 : player.aim === 1 ? 8 : 0;
    const firing = player.fireCooldown > BASE_COOLDOWN - 0.05 && player.knifeSwing <= 0;

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

    // shadow helm: the guardian's boss-drop reward, worn over the headband
    if (player.shadowHelm) {
      ctx.fillStyle = flash ? '#fff' : '#1a1220';
      ctx.fillRect(-6, -20, 12, 9);
      ctx.fillRect(-7, -14, 3, 4);
      ctx.fillStyle = flash ? '#fff' : '#3a2a52';
      ctx.fillRect(-6, -20, 12, 2);
      ctx.fillStyle = flash ? '#fff' : '#a78bfa';
      ctx.fillRect(0, -14, 2, 2);
    }

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
    if (player.knifeSwing > 0) {
      const t = 1 - player.knifeSwing / 0.15;
      const demon = player.demonKnife;
      const swingRadius = demon ? 40 : 26;
      const sx = (demon ? 26 : 19) + t * (demon ? 32 : 20), sy = gy - 15 + t * 30;
      ctx.strokeStyle = demon ? 'rgba(255,120,40,0.9)' : 'rgba(232,232,232,0.9)';
      ctx.lineWidth = demon ? 6 : 5;
      ctx.beginPath();
      ctx.arc(6, gy, swingRadius, -0.9 + t * 1.1, -0.2 + t * 1.1);
      ctx.stroke();
      ctx.fillStyle = demon ? '#ffcf4a' : '#d8d8d8';
      ctx.fillRect(sx, sy, 9, 5);
    }
    ctx.restore();
  }

  function drawWolf(w) {
    const cfg = WOLF_STAGES[wolfStage()];
    const x = px(w.x - camX), y = px(w.y);
    const bob = w.moving ? Math.sin(elapsed * 10) * 1.5 : 0;
    const facing = w.facing || 1;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(facing * cfg.scale, cfg.scale);

    if (cfg.name === 'Fenrir') {
      ctx.fillStyle = 'rgba(255,40,20,0.3)';
      ctx.beginPath(); ctx.arc(0, -2, 16, 0, Math.PI * 2); ctx.fill();
    }

    // tail + legs
    ctx.fillStyle = cfg.dark;
    ctx.fillRect(-13, -4, 5, 3);
    ctx.fillRect(-8, 4, 3, 5);
    ctx.fillRect(4, 4, 3, 5);

    // body + head
    ctx.fillStyle = cfg.color;
    ctx.fillRect(-9, -5, 16, 9);
    ctx.fillRect(6, -8, 8, 7);

    // snout + ears
    ctx.fillStyle = cfg.dark;
    ctx.fillRect(12, -5, 4, 3);
    ctx.fillRect(6, -10, 3, 3);
    ctx.fillRect(11, -10, 3, 3);

    // glowing eye
    ctx.fillStyle = cfg.eye;
    ctx.fillRect(10, -6, 2, 2);
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
    } else if (c.name === 'shadow') {
      // shadow: a hooded wisp of a figure, mostly cloak, glowing violet eyes
      ctx.fillStyle = col('rgba(36,26,51,0.7)');
      ctx.fillRect(-hw - 2, -hh + 6, c.w + 4, c.h - 10);
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 4, c.w, c.h - 12);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh - 2, c.w - 2, 9);
      ctx.fillStyle = col('#8a6fd1');
      ctx.fillRect(-3, -hh + 1, 2, 2);
      ctx.fillRect(2, -hh + 1, 2, 2);
      if (Math.sin(e.walkT * 3) > 0.2) {
        ctx.fillStyle = 'rgba(122,95,201,0.4)';
        ctx.fillRect(-hw - 4, -hh + 10, 3, 8);
        ctx.fillRect(hw + 1, -hh + 6, 3, 8);
      }
    } else if (c.name === 'imp') {
      // imp: small fiery demon, horns, tail, clawed hands
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 6, c.w, c.h - 12);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 1, -hh, c.w - 2, 7);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw - 1, -hh - 3, 2, 4);
      ctx.fillRect(hw - 1, -hh - 3, 2, 4);
      ctx.fillStyle = col('#ffcf4a');
      ctx.fillRect(-3, -hh + 2, 2, 2);
      ctx.fillRect(2, -hh + 2, 2, 2);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(hw - 1, hh - 10, 6, 2 + Math.sin(e.walkT * 8) * 2);
    } else if (c.name === 'boss') {
      // the guardian: hulking dark knight with a jagged crown and burning eyes
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 12, c.w, c.h - 20);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 12, 5, c.h - 20);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 3, -hh, c.w - 6, 14);
      // crown spikes
      ctx.fillStyle = col(c.bone);
      ctx.fillRect(-hw + 2, -hh - 6, 4, 8);
      ctx.fillRect(-2, -hh - 9, 4, 11);
      ctx.fillRect(hw - 6, -hh - 6, 4, 8);
      // burning eyes
      ctx.fillStyle = col('#ff5a3d');
      ctx.fillRect(-7, -hh + 5, 4, 3);
      ctx.fillRect(3, -hh + 5, 4, 3);
      // dark aura wisps
      if (Math.sin(e.walkT * 6) > 0) {
        ctx.fillStyle = 'rgba(90,58,122,0.6)';
        ctx.fillRect(-hw - 3, -hh + 10, 3, 10);
        ctx.fillRect(hw, -hh + 6, 3, 10);
      }
    } else if (c.name === 'archdemon') {
      // the arch demon: massive horned brute wreathed in its own hellfire
      ctx.fillStyle = col(c.color);
      ctx.fillRect(-hw, -hh + 14, c.w, c.h - 24);
      ctx.fillStyle = col(c.light);
      ctx.fillRect(-hw, -hh + 14, 6, c.h - 24);
      ctx.fillStyle = col(c.dark);
      ctx.fillRect(-hw + 4, -hh, c.w - 8, 16);
      // horns
      ctx.fillStyle = col(c.bone);
      ctx.beginPath(); ctx.moveTo(-hw + 4, -hh - 2); ctx.lineTo(-hw - 6, -hh - 16); ctx.lineTo(-hw + 8, -hh - 4); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hw - 4, -hh - 2); ctx.lineTo(hw + 6, -hh - 16); ctx.lineTo(hw - 8, -hh - 4); ctx.closePath(); ctx.fill();
      // burning eyes
      ctx.fillStyle = col('#ffcf4a');
      ctx.fillRect(-9, -hh + 6, 5, 4);
      ctx.fillRect(4, -hh + 6, 5, 4);
      // tattered wings
      ctx.fillStyle = col('rgba(58,10,3,0.7)');
      ctx.beginPath(); ctx.moveTo(-hw, -hh + 16); ctx.lineTo(-hw - 16, -hh + 4); ctx.lineTo(-hw - 10, -hh + 26); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hw, -hh + 16); ctx.lineTo(hw + 16, -hh + 4); ctx.lineTo(hw + 10, -hh + 26); ctx.closePath(); ctx.fill();
      // hellfire licking off the shoulders
      if (Math.sin(e.walkT * 8) > 0) {
        ctx.fillStyle = 'rgba(255,140,20,0.7)';
        ctx.fillRect(-hw - 2, -hh + 12, 3, 6);
        ctx.fillRect(hw - 1, -hh + 8, 3, 6);
      }
    }

    if (c.isBoss) {
      // attack telegraphs: a pulsing outline color-coded per incoming move
      const telegraphColor = (c.telegraphColors && c.telegraphColors[e.attackState]) || null;
      if (telegraphColor) {
        const pulse = 2 + Math.sin(elapsed * 20) * 1.5;
        ctx.strokeStyle = telegraphColor;
        ctx.lineWidth = pulse;
        ctx.strokeRect(-hw - 4, -hh - 8, c.w + 8, c.h + 8);
      }
      if (e.attackState === 'nova_channel') {
        ctx.strokeStyle = c.novaRingColor || 'rgba(176,144,255,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(2, e.novaRadius), 0, Math.PI * 2);
        ctx.stroke();
      }
      if (e.attackState === 'stagger') {
        const pulse = 0.4 + Math.sin(elapsed * 12) * 0.3;
        ctx.strokeStyle = `rgba(255,230,140,${pulse})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(-hw - 4, -hh - 8, c.w + 8, c.h + 8);
      }
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
    if (e.acidTimer > 0) {
      ctx.fillStyle = 'rgba(139,195,74,0.45)';
      ctx.fillRect(-hw, -hh, c.w, c.h);
    }
    if (e.weakened) {
      const pulse = 0.5 + Math.sin(elapsed * 4) * 0.3;
      ctx.strokeStyle = `rgba(122,95,201,${pulse})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(-hw - 3, -hh - 3, c.w + 6, c.h + 6);
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
    // Orient every bullet along its actual travel direction so shapes
    // (the lightning zigzag, flame lick, ice shard point, etc.) read
    // correctly no matter which way it's fired or aimed.
    const angle = Math.atan2(b.vy, b.vx);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    if (kind === 'lightning') {
      ctx.strokeStyle = '#d8c7ff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(-4, -4); ctx.lineTo(0, 3); ctx.lineTo(5, -4); ctx.lineTo(10, 0);
      ctx.stroke();
      ctx.fillStyle = '#f4e9ff';
      ctx.beginPath(); ctx.arc(10, 0, 2.2, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'berserker') {
      ctx.fillStyle = '#a85a1a';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffcf4a';
      ctx.beginPath(); ctx.ellipse(1, 0, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff5cc';
      ctx.beginPath(); ctx.ellipse(3, 0, 3, 1.4, 0, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'pyro' || kind === 'fire') {
      ctx.fillStyle = 'rgba(255,138,61,0.55)';
      ctx.beginPath(); ctx.moveTo(-5, -3); ctx.lineTo(-12, 0); ctx.lineTo(-5, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a24512';
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff8a3d';
      ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(1.5, 0, 2.4, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'frost') {
      ctx.fillStyle = '#2c7c8a';
      ctx.beginPath();
      ctx.moveTo(9, 0); ctx.lineTo(0, -5); ctx.lineTo(-9, 0); ctx.lineTo(0, 5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#cdf6fb';
      ctx.beginPath();
      ctx.moveTo(5.5, 0); ctx.lineTo(0, -2.5); ctx.lineTo(-5.5, 0); ctx.lineTo(0, 2.5);
      ctx.closePath(); ctx.fill();
    } else if (kind === 'acid') {
      ctx.fillStyle = 'rgba(139,195,74,0.5)';
      ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-10, 0); ctx.lineTo(-5, 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4b6b1f';
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 4.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.ellipse(1, 0, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c8e6a0';
      ctx.beginPath(); ctx.arc(2, -1, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'dark') {
      ctx.fillStyle = 'rgba(90,58,122,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a1a3a';
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b090ff';
      ctx.beginPath(); ctx.arc(1.5, -1.5, 2.6, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 'shadow') {
      ctx.fillStyle = 'rgba(36,26,51,0.6)';
      ctx.beginPath(); ctx.moveTo(-10, -3); ctx.lineTo(-16, 0); ctx.lineTo(-10, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#120c1c';
      ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8a6fd1';
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e0d4ff';
      ctx.beginPath(); ctx.arc(1.5, -1, 1.6, 0, Math.PI * 2); ctx.fill();
    } else {
      // normal (player default)
      ctx.fillStyle = '#2f8f5b';
      ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 3.2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#5ef29a';
      ctx.beginPath(); ctx.ellipse(1, 0, 5, 1.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eafff0';
      ctx.beginPath(); ctx.arc(3, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
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

  function drawArenaBarrier() {
    const x = px(BOSS_ARENA_START_COL * TILE - camX);
    if (x < -20 || x > VIEW_W + 20) return;
    const boss = enemies.find(e => e.cfg.isBoss);
    const rgb = hexToRgbTriplet((boss && boss.cfg.hudColor) || '#a78bfa');
    const pulse = 0.5 + Math.sin(elapsed * 5) * 0.25;
    const grad = ctx.createLinearGradient(x - 6, 0, x + 6, 0);
    grad.addColorStop(0, `rgba(${rgb},0)`);
    grad.addColorStop(0.5, `rgba(${rgb},${pulse})`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(x - 6, 0, 12, VIEW_H);
    ctx.fillStyle = `rgba(255,255,255,${pulse})`;
    ctx.fillRect(x - 1, 0, 2, VIEW_H);
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
    } else if (p.shape === 'arc') {
      const x2 = px(p.x2 - camX), y2 = px(p.y2);
      const midx = (x + x2) / 2 + (Math.random() - 0.5) * 8, midy = (y + y2) / 2 + (Math.random() - 0.5) * 8;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(midx, midy); ctx.lineTo(x2, y2);
      ctx.stroke();
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

    // wolf companion: name + progress toward its next stage (Fenrir at 300 kills)
    if (wolf) {
      const stage = wolfStage();
      const wcfg = WOLF_STAGES[stage];
      const perStage = WOLF_MAX_KILLS / (WOLF_STAGES.length - 1);
      const wPct = stage >= WOLF_STAGES.length - 1 ? 1 : (player.kills % perStage) / perStage;
      ctx.font = '8px monospace';
      ctx.fillStyle = wcfg.eye;
      ctx.fillText(wcfg.name.toUpperCase(), 8, 32);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(8, 34, 60, 3);
      ctx.fillStyle = wcfg.eye;
      ctx.fillRect(8, 34, 60 * Math.max(0, Math.min(1, wPct)), 3);
    }

    // Wither: the Shadow Helm's once-per-floor curse
    if (player.shadowHelm) {
      ctx.font = '8px monospace';
      ctx.fillStyle = player.usedSpecialThisFloor ? 'rgba(138,111,209,0.4)' : '#a78bfa';
      ctx.fillText(player.usedSpecialThisFloor ? 'WITHER: USED' : 'WITHER (R): READY', 8, 45);
    }

    // score
    ctx.fillStyle = '#2b1d14';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${player.score}`, VIEW_W - 8, 16);
    ctx.textAlign = 'left';

    // progress bar (or the guardian's health bar, once it's engaged)
    const boss = enemies.find(e => e.cfg.isBoss);
    if (boss && !boss.dead) {
      const bossPct = Math.max(0, boss.hp / boss.maxHp);
      const bossColor = boss.cfg.hudColor;
      ctx.textAlign = 'center';
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = bossColor;
      ctx.fillText(boss.cfg.displayName || boss.cfg.name.toUpperCase(), VIEW_W / 2, 10);
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(VIEW_W / 2 - 70, 13, 140, 6);
      ctx.fillStyle = bossColor;
      ctx.fillRect(VIEW_W / 2 - 69, 14, 138 * bossPct, 4);
      // phase-threshold ticks where the nova attack triggers
      ctx.fillStyle = 'rgba(255,230,140,0.9)';
      ctx.fillRect(VIEW_W / 2 - 69 + 138 * 0.5 - 1, 13, 2, 6);
      ctx.fillRect(VIEW_W / 2 - 69 + 138 * 0.2 - 1, 13, 2, 6);
    } else {
      const prog = Math.min(1, player.x / (GOAL_COL * TILE));
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(VIEW_W / 2 - 60, 6, 120, 5);
      ctx.fillStyle = '#ffcd3c';
      ctx.fillRect(VIEW_W / 2 - 60, 6, 120 * prog, 5);
    }

    // ammo slots
    const slots = [
      { key: 'normal', label: '1', color: player.bullets > 0 ? '#5ef29a' : (player.demonKnife ? '#ff8a3d' : '#c9b98f'), count: player.bullets > 0 ? player.bullets : 'KNIFE' },
      { key: 'berserker', label: '2', color: SOUL_META.berserker.color, count: player.souls.berserker },
      { key: 'pyromancer', label: '3', color: SOUL_META.pyromancer.color, count: player.souls.pyromancer },
      { key: 'frost', label: '4', color: SOUL_META.frost.color, count: player.souls.frost },
      { key: 'lightning', label: '5', color: SOUL_META.lightning.color, count: player.souls.lightning },
      { key: 'acid', label: '6', color: SOUL_META.acid.color, count: player.souls.acid },
      { key: 'shadow', label: '7', color: SOUL_META.shadow.color, count: player.souls.shadow },
      { key: 'knife', label: '8', color: player.demonKnife ? '#ff8a3d' : '#c9b98f', count: 'KNIFE' },
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

    if (levelBanner.t > 0) {
      ctx.globalAlpha = Math.min(1, levelBanner.t);
      ctx.textAlign = 'center';
      ctx.font = 'bold 20px monospace';
      ctx.fillStyle = '#a78bfa';
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 12;
      ctx.fillText(levelBanner.text, VIEW_W / 2, VIEW_H / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    ctx.save();
    if (shake.t > 0) {
      const m = shake.mag * (shake.t / 0.25);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    drawTiles();
    if (bossArenaSealed) drawArenaBarrier();
    for (const hz of hazards) drawHazard(hz);
    for (const e of enemies) drawEnemy(e);
    drawPlayer();
    if (wolf) drawWolf(wolf);
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

  // ---------- Intro cutscene ----------
  const CUTSCENE = [
    { type: 'boat', boatX: 0.18, islandScale: 0.45, speaker: 'HUNTER', text: 'Three months chasing rumors across two oceans for this.' },
    { type: 'boat', boatX: 0.58, islandScale: 0.85, speaker: 'HUNTER', text: 'The map better be right this time.' },
    { type: 'arrive', speaker: 'HUNTER', text: "...Door's already broken open. Someone beat me here." },
    { type: 'arrive', speaker: 'HUNTER', text: 'Or something did.' },
    { type: 'zombie', speaker: 'HUNTER', text: 'Right. Guess the old stories were true after all.' },
  ];
  // Plays between the jungle and the hell floor — the ground gives way to a
  // fiery portal and something drags the hunter down before the shop screen.
  const HELL_CUTSCENE = [
    { type: 'ground', speaker: 'HUNTER', text: "Ground's warm down here. Warmer than it should be." },
    { type: 'crack', speaker: 'HUNTER', text: "...That's not warmth. That's a crack splitting open." },
    { type: 'devil', speaker: '???', text: 'FOOLISH MORTAL. YOU HAVE DUG FAR ENOUGH.' },
    { type: 'devil', speaker: 'HUNTER', text: 'Wait — !' },
  ];
  const CUTSCENE_CPS = 30;
  let cutsceneBeat = 0, cutsceneChars = 0, cutsceneIdleT = 0, cutsceneT = 0;
  let activeCutscene = CUTSCENE, cutsceneOnEnd = null;

  function playCutscene(script, onEnd) {
    activeCutscene = script;
    cutsceneOnEnd = onEnd;
    state = 'cutscene';
    initCutscene();
  }

  function initCutscene() {
    cutsceneBeat = 0; cutsceneChars = 0; cutsceneIdleT = 0; cutsceneT = 0;
    skipCutsceneBtn.classList.remove('hidden');
    sfx.wave();
  }

  function endCutscene() {
    const onEnd = cutsceneOnEnd || beginGameplay;
    cutsceneOnEnd = null;
    onEnd();
  }

  function advanceCutscene() {
    const beat = activeCutscene[cutsceneBeat];
    if (!beat) return;
    if (cutsceneChars < beat.text.length) { cutsceneChars = beat.text.length; return; }
    sfx.advance();
    cutsceneBeat++;
    cutsceneChars = 0;
    cutsceneIdleT = 0;
    if (cutsceneBeat >= activeCutscene.length) endCutscene();
  }

  function skipCutscene() { endCutscene(); }

  function updateCutscene(dt) {
    cutsceneT += dt;
    const beat = activeCutscene[cutsceneBeat];
    if (!beat) return;
    if (cutsceneChars < beat.text.length) {
      const prevChars = cutsceneChars;
      if (prevChars === 0 && beat.type === 'zombie') sfx.groan();
      cutsceneChars = Math.min(beat.text.length, cutsceneChars + CUTSCENE_CPS * dt);
      if (Math.floor(cutsceneChars / 3) > Math.floor(prevChars / 3)) sfx.blip();
    } else {
      cutsceneIdleT += dt;
      if (cutsceneIdleT > 3.2) advanceCutscene();
    }
  }

  function wrapText(text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
      else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawCutsceneHunter(x, y, facing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(facing, 1);
    ctx.fillStyle = '#1c1a16';
    ctx.fillRect(-6, 10, 5, 8);
    ctx.fillRect(1, 10, 5, 8);
    ctx.fillStyle = '#6d7f4a';
    ctx.fillRect(-6, 3, 5, 8);
    ctx.fillRect(1, 3, 5, 8);
    ctx.fillStyle = '#8a7a52';
    ctx.fillRect(-7, -8, 14, 12);
    ctx.fillStyle = '#5a3a2a';
    ctx.fillRect(-6, -7, 12, 2);
    ctx.fillStyle = '#d9a876';
    ctx.fillRect(-5, -16, 10, 8);
    ctx.fillStyle = '#7a2f22';
    ctx.fillRect(-6, -18, 12, 3);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(1, -13, 2, 2);
    ctx.fillStyle = '#8a7a52';
    ctx.fillRect(3, -4, 5, 6);
    ctx.fillStyle = '#2b2418';
    ctx.fillRect(7, -3, 12, 3);
    ctx.restore();
  }

  function drawTempleSilhouette(x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#1a2420';
    ctx.fillRect(-50, -10, 100, 40);
    ctx.fillRect(-60, 20, 120, 14);
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(i * 30 - 5, -30, 10, 30);
    }
    ctx.fillStyle = '#0a0a08';
    ctx.fillRect(-14, 4, 28, 26);
    ctx.restore();
  }

  function renderCutscene() {
    const beat = activeCutscene[cutsceneBeat];
    if (!beat) { blit(); return; }
    const horizon = VIEW_H * 0.5;

    if (beat.type === 'boat') {
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#2a1a3a');
      grad.addColorStop(0.5, '#5a3a5a');
      grad.addColorStop(0.55, '#0d3a4a');
      grad.addColorStop(1, '#082430');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.fillStyle = 'rgba(255,225,180,0.75)';
      ctx.beginPath(); ctx.arc(VIEW_W - 80, 55, 20, 0, Math.PI * 2); ctx.fill();

      drawTempleSilhouette(VIEW_W - 90, horizon - 6, beat.islandScale);

      ctx.strokeStyle = 'rgba(200,230,240,0.25)';
      for (let i = 0; i < 5; i++) {
        const wy = horizon + 20 + i * 35;
        ctx.beginPath();
        for (let px2 = 0; px2 <= VIEW_W; px2 += 12) {
          const wave = Math.sin(px2 * 0.06 + cutsceneT * 2 + i) * 3;
          if (px2 === 0) ctx.moveTo(px2, wy + wave); else ctx.lineTo(px2, wy + wave);
        }
        ctx.stroke();
      }

      const boatX = beat.boatX * VIEW_W;
      const boatY = horizon + 55 + Math.sin(cutsceneT * 2.4) * 3;
      ctx.fillStyle = '#3a2a1a';
      ctx.beginPath();
      ctx.moveTo(boatX - 34, boatY);
      ctx.lineTo(boatX + 34, boatY);
      ctx.lineTo(boatX + 24, boatY + 12);
      ctx.lineTo(boatX - 24, boatY + 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5a4028';
      ctx.fillRect(boatX - 2, boatY - 26, 3, 26);
      ctx.fillStyle = 'rgba(230,220,200,0.85)';
      ctx.beginPath();
      ctx.moveTo(boatX, boatY - 26);
      ctx.lineTo(boatX + 20, boatY - 6);
      ctx.lineTo(boatX, boatY - 6);
      ctx.closePath();
      ctx.fill();

      drawCutsceneHunter(boatX - 6, boatY - 6 + Math.sin(cutsceneT * 2.4) * 3, 1);
    } else if (beat.type === 'ground' || beat.type === 'crack' || beat.type === 'devil') {
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#1a0805');
      grad.addColorStop(0.55, '#3a1208');
      grad.addColorStop(0.56, '#180a06');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      // the crack in the ground widens and glows brighter with each beat
      const crackW = beat.type === 'ground' ? 20 : beat.type === 'crack' ? 70 : 140;
      const glowAlpha = beat.type === 'ground' ? 0.3 : beat.type === 'crack' ? 0.6 : 0.9;
      ctx.fillStyle = `rgba(255,90,20,${glowAlpha})`;
      ctx.fillRect(VIEW_W / 2 - crackW / 2, horizon + 58, crackW, 6);
      for (let i = 0; i < 18; i++) {
        const ex = VIEW_W / 2 + Math.sin(i * 1.7 + cutsceneT * 2) * crackW * 0.6;
        const ey = horizon + 58 - ((cutsceneT * 40 + i * 23) % 90);
        ctx.fillStyle = 'rgba(255,150,40,0.8)';
        ctx.fillRect(px(ex), ey, 2, 2);
      }

      const dragDown = beat.type === 'devil' ? Math.min(24, cutsceneT * 12) : 0;
      drawCutsceneHunter(VIEW_W * 0.4, horizon + 64 + dragDown, 1);

      if (beat.type === 'devil') {
        const riseY = horizon + 40 - Math.min(40, cutsceneT * 22);
        ctx.save();
        ctx.translate(VIEW_W * 0.58, riseY);
        ctx.fillStyle = '#4a0e08';
        ctx.beginPath();
        ctx.moveTo(-14, 20); ctx.lineTo(-10, -14); ctx.lineTo(0, -22); ctx.lineTo(10, -14); ctx.lineTo(14, 20);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a0503';
        ctx.beginPath(); ctx.moveTo(-8, -14); ctx.lineTo(-14, -30); ctx.lineTo(-4, -16); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(8, -14); ctx.lineTo(14, -30); ctx.lineTo(4, -16); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffcf4a';
        ctx.fillRect(-6, -6, 3, 3);
        ctx.fillRect(3, -6, 3, 3);
        ctx.restore();
      }

      ctx.fillStyle = `rgba(255,60,20,${beat.type === 'devil' ? 0.15 : 0.05})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#3a2a4a');
      grad.addColorStop(0.55, '#6a5a5a');
      grad.addColorStop(0.56, '#8a7550');
      grad.addColorStop(1, '#5a4a30');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);

      drawTempleSilhouette(VIEW_W * 0.62, horizon - 20, 1.6);

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = -1; i < 12; i++) ctx.fillRect(i * 40, horizon + 60, 4, VIEW_H);

      drawCutsceneHunter(VIEW_W * 0.32, horizon + 70, 1);

      if (beat.type === 'zombie') {
        const zx = VIEW_W * 0.6 + Math.sin(cutsceneT * 1.5) * 6;
        const zy = horizon + 68;
        ctx.save();
        ctx.translate(zx, zy);
        ctx.fillStyle = '#3f6b34';
        ctx.fillRect(-6, -6, 12, 18);
        ctx.fillStyle = '#274a20';
        ctx.fillRect(-6, -16, 12, 10);
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(-3, -12, 2, 2);
        ctx.fillRect(2, -12, 2, 2);
        ctx.restore();
      }
    }

    // dialogue bubble
    ctx.font = '9px monospace';
    const lines = wrapText(beat.text.slice(0, Math.floor(cutsceneChars)), 210);
    const bw = 250, bh = 24 + lines.length * 12;
    const bx = VIEW_W / 2 - bw / 2, by = 14;
    ctx.fillStyle = 'rgba(20,14,10,0.55)';
    ctx.fillRect(bx + 3, by + 3, bw, bh);
    ctx.fillStyle = '#f2e9d8';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#2b1d14';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = '#f2e9d8';
    ctx.beginPath();
    ctx.moveTo(VIEW_W / 2 - 10, by + bh);
    ctx.lineTo(VIEW_W / 2 + 6, by + bh);
    ctx.lineTo(VIEW_W / 2 - 6, by + bh + 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2b1d14';
    ctx.stroke();

    ctx.font = 'bold 8px monospace';
    ctx.fillStyle = '#8a5a2a';
    ctx.fillText(beat.speaker, bx + 8, by + 12);
    ctx.font = '9px monospace';
    ctx.fillStyle = '#2b1d14';
    lines.forEach((line, i) => ctx.fillText(line, bx + 8, by + 24 + i * 12));

    if (cutsceneChars >= beat.text.length && Math.sin(cutsceneT * 6) > 0) {
      ctx.fillStyle = '#8a5a2a';
      ctx.fillText('▼', bx + bw - 14, by + bh - 4);
    }

    blit();
  }

  screenCanvas.addEventListener('click', () => { if (state === 'cutscene') advanceCutscene(); });
  skipCutsceneBtn.addEventListener('click', skipCutscene);

  // ---------- Shop (between floors) ----------
  // Prices climb the deeper you go, on top of the existing per-purchase
  // escalation, so gear bought outside the temple actually costs more.
  let shopNextLevel = 0;
  const SHOP_FLOOR_MULT = { 1: 1.2, 2: 1.7, 3: 2.1, 4: 2.6 };
  function shopCostMult() { return SHOP_FLOOR_MULT[shopNextLevel] || 1; }
  function scaledCost(base) { return Math.round((base * shopCostMult()) / 5) * 5; }

  const SHOP_ITEMS = [
    {
      key: 'heal', name: 'Field Medic', desc: 'Refill your health to full.',
      cost: () => scaledCost(30),
      canBuy: (p) => p.hp < p.maxHp,
      buy: (p) => { p.hp = p.maxHp; },
    },
    {
      key: 'ammo', name: 'Ammo Cache', desc: '+1 soul of every special ammo type, and tops up bullets to 100.',
      cost: () => scaledCost(50),
      canBuy: () => true,
      buy: (p) => { for (const k of Object.keys(p.souls)) p.souls[k]++; p.bullets = Math.max(p.bullets, 100); },
    },
    {
      key: 'damage', name: 'Sharpened Rounds', desc: '+15% permanent damage.',
      cost: (p) => scaledCost(80 + p.upgrades.damage * 40),
      canBuy: () => true,
      buy: (p) => { p.dmgMult *= 1.15; p.upgrades.damage++; },
    },
    {
      key: 'vitality', name: 'Vitality Boost', desc: '+20 max health, healed on the spot.',
      cost: (p) => scaledCost(60 + p.upgrades.vitality * 30),
      canBuy: () => true,
      buy: (p) => { p.maxHp += 20; p.hp += 20; p.upgrades.vitality++; },
    },
    {
      key: 'armor', name: 'Scavenged Armor', desc: '-2 damage taken per hit (max -10).',
      cost: (p) => scaledCost(100 + p.upgrades.armor * 50),
      canBuy: (p) => p.armor < 10,
      buy: (p) => { p.armor = Math.min(10, p.armor + 2); p.upgrades.armor++; },
    },
  ];

  function openShop(nextLevel) {
    shopNextLevel = nextLevel;
    state = 'shop';
    renderShopUI();
    shopScreen.classList.remove('hidden');
    sfx.win();
  }

  function renderShopUI() {
    shopScoreEl.textContent = `Loot: ${player.score}`;
    shopItemsEl.innerHTML = '';
    for (const item of SHOP_ITEMS) {
      const cost = item.cost(player);
      const usable = item.canBuy(player);
      const afford = player.score >= cost;
      const row = document.createElement('div');
      row.className = 'shopItem';
      const info = document.createElement('div');
      info.className = 'shopItemInfo';
      info.innerHTML = `<div class="shopItemName">${item.name}</div><div class="shopItemDesc">${item.desc}</div>`;
      const btn = document.createElement('button');
      btn.className = 'shopBuyBtn';
      btn.textContent = usable ? cost : 'MAXED';
      btn.disabled = !usable || !afford;
      btn.addEventListener('click', () => {
        if (player.score < item.cost(player) || !item.canBuy(player)) return;
        player.score -= item.cost(player);
        item.buy(player);
        sfx.checkpoint();
        renderShopUI();
      });
      row.appendChild(info);
      row.appendChild(btn);
      shopItemsEl.appendChild(row);
    }
  }

  shopContinueBtn.addEventListener('click', () => {
    shopScreen.classList.add('hidden');
    goToLevel(shopNextLevel);
  });

  // ---------- Main loop ----------
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (state === 'playing' || state === 'win' || state === 'dead') { update(dt); render(); }
    else if (state === 'cutscene') { updateCutscene(dt); renderCutscene(); }
    if (state === 'playing') {
      autosaveTimer += dt;
      if (autosaveTimer >= 10) { autosaveTimer = 0; saveGame(); }
    }
    syncTouchControls();
    requestAnimationFrame(loop);
  }

  // Called by the start-screen button: plays the skippable intro first.
  function beginIntro() {
    ensureAudio();
    claimFocus();
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    playCutscene(CUTSCENE, beginGameplay);
  }

  // Called when the cutscene ends/is skipped, and by the restart button
  // (retrying a run doesn't replay the intro).
  function beginGameplay() {
    ensureAudio();
    claimFocus();
    resetRun();
    state = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    shopScreen.classList.add('hidden');
    skipCutsceneBtn.classList.add('hidden');
  }

  startBtn.addEventListener('click', beginIntro);
  restartBtn.addEventListener('click', () => {
    if (state === 'dead') respawnAtFloorStart();
    else beginGameplay();
  });

  requestAnimationFrame(loop);
})();
