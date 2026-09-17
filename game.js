(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalStats = document.getElementById('finalStats');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  let W = 0, H = 0;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Audio (procedural, no external assets) ----------
  let actx = null;
  function ensureAudio() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
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
    osc.start();
    osc.stop(actx.currentTime + dur);
  }
  function noiseBurst(dur = 0.3, gain = 0.25) {
    if (!actx) return;
    const bufferSize = actx.sampleRate * dur;
    const buffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = actx.createBufferSource();
    src.buffer = buffer;
    const g = actx.createGain();
    g.gain.setValueAtTime(gain, actx.currentTime);
    src.connect(g).connect(actx.destination);
    src.start();
  }
  const sfx = {
    shot: () => tone(180, 0.08, 'square', 0.12, 90),
    heavyShot: () => { tone(90, 0.18, 'sawtooth', 0.2, 40); noiseBurst(0.15, 0.15); },
    headshot: () => tone(900, 0.12, 'sine', 0.18, 1400),
    explosion: () => { noiseBurst(0.4, 0.3); tone(60, 0.35, 'sawtooth', 0.2, 20); },
    frost: () => tone(1200, 0.2, 'sine', 0.12, 500),
    soul: () => tone(500, 0.25, 'sine', 0.1, 900),
    hurt: () => tone(140, 0.2, 'sawtooth', 0.18, 60),
    wave: () => { tone(300, 0.15, 'square', 0.12, 500); setTimeout(() => tone(500, 0.2, 'square', 0.12, 800), 150); },
    empty: () => tone(200, 0.05, 'square', 0.08, 150),
    miss: () => tone(220, 0.04, 'triangle', 0.06, 180),
  };

  // ---------- Enemy configs ----------
  const ENEMY_TYPES = {
    grunt: {
      color: '#9fb4c7', dark: '#5f7385', speed: 46, hp: 18, dmg: 8,
      radius: 20, headRadius: 8, soul: null, points: 10, unlockWave: 1,
    },
    berserker: {
      color: '#c0392b', dark: '#7a2019', speed: 78, hp: 46, dmg: 18,
      radius: 23, headRadius: 9, soul: 'berserker', points: 25, unlockWave: 2, zigzag: true,
    },
    pyromancer: {
      color: '#e67e22', dark: '#8a4c12', speed: 24, hp: 32, dmg: 0,
      radius: 20, headRadius: 8, soul: 'pyromancer', points: 30, unlockWave: 3,
      ranged: true, fireRate: 2.4, projSpeed: 210, projDmg: 14, kind: 'fire',
    },
    frostwitch: {
      color: '#48c9e0', dark: '#256c80', speed: 22, hp: 28, dmg: 0,
      radius: 20, headRadius: 8, soul: 'frost', points: 30, unlockWave: 4,
      ranged: true, fireRate: 2.8, projSpeed: 190, projDmg: 10, kind: 'frost',
    },
  };

  const SOUL_META = {
    berserker: { label: 'BERSERKER', color: '#c0392b', key: '2' },
    pyromancer: { label: 'PYROMANCER', color: '#e67e22', key: '3' },
    frost: { label: 'FROST', color: '#48c9e0', key: '4' },
  };

  const BASE_DMG = 22;
  const BASE_COOLDOWN = 0.5;

  // ---------- Game state ----------
  let state = 'start'; // start | playing | gameover
  let mouse = { x: 0, y: 0 };
  let scoped = false;
  let shake = { t: 0, mag: 0 };
  let messages = []; // floating text {x,y,text,color,t,life}
  let waveBanner = { text: '', t: 0 };

  let player, enemies, projectiles, particles, spawnQueue, waveTimer, spawnTimer, gameTime;

  function resetGame() {
    player = {
      x: 0, y: 0, hp: 100, maxHp: 100, score: 0, wave: 0,
      ammo: 'normal',
      souls: { berserker: 0, pyromancer: 0, frost: 0 },
      fireCooldown: 0,
      frozenTimer: 0,
      hurtFlash: 0,
      kills: 0,
      headshots: 0,
    };
    enemies = [];
    projectiles = [];
    particles = [];
    spawnQueue = [];
    spawnTimer = 0;
    waveTimer = 1.5;
    gameTime = 0;
    messages = [];
    shake = { t: 0, mag: 0 };
    nextWave();
  }

  function nextWave() {
    player.wave++;
    const w = player.wave;
    const available = Object.entries(ENEMY_TYPES).filter(([, c]) => c.unlockWave <= w).map(([k]) => k);
    const count = 4 + w * 2;
    spawnQueue = [];
    for (let i = 0; i < count; i++) {
      // weight earlier types more heavily, cap total variety by wave
      const pick = available[Math.floor(Math.random() * available.length)];
      spawnQueue.push(pick);
    }
    spawnTimer = 0.2;
    waveBanner = { text: `WAVE ${w}`, t: 2.2 };
    sfx.wave();
  }

  function spawnEnemy(typeKey) {
    const cfg = ENEMY_TYPES[typeKey];
    const scale = 1 + (player.wave - 1) * 0.08;
    const e = {
      type: typeKey,
      cfg,
      x: 40 + Math.random() * (W - 80),
      y: -30,
      hp: cfg.hp * scale,
      maxHp: cfg.hp * scale,
      speed: cfg.speed * (1 + (player.wave - 1) * 0.03),
      speedMult: 1,
      slowTimer: 0,
      burnTimer: 0,
      burnTick: 0,
      t: Math.random() * 10,
      dead: false,
      stopY: cfg.ranged ? H * (0.28 + Math.random() * 0.28) : null,
      shootTimer: 1 + Math.random() * 1.5,
      hitFlash: 0,
    };
    enemies.push(e);
  }

  function findHit(px, py) {
    let best = null, bestDist = Infinity;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - px, e.y - py);
      if (d <= e.cfg.headRadius && d < bestDist) {
        best = { enemy: e, headshot: true }; bestDist = d;
      } else if (d <= e.cfg.radius && d < bestDist && (!best || !best.headshot)) {
        best = { enemy: e, headshot: false }; bestDist = d;
      }
    }
    return best;
  }

  function enemiesInRadius(px, py, r) {
    return enemies.filter(e => !e.dead && Math.hypot(e.x - px, e.y - py) <= r);
  }

  function applyDamage(e, dmg, headshot) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.12;
    spawnHitParticles(e.x, e.y, headshot ? '#fff5cc' : '#cfe8d8');
    if (e.hp <= 0) killEnemy(e, headshot);
  }

  function killEnemy(e, headshot) {
    e.dead = true;
    const pts = e.cfg.points * (headshot ? 2 : 1);
    player.score += pts;
    player.kills++;
    if (headshot) { player.headshots++; sfx.headshot(); }
    spawnDeathParticles(e.x, e.y, e.cfg.color);
    addMessage(e.x, e.y - 20, headshot ? `HEADSHOT +${pts}` : `+${pts}`, headshot ? '#ffe27a' : '#dfeee4');

    if (e.cfg.soul) {
      // soul rises from the corpse and drifts to the HUD — visual harvest
      spawnSoulParticle(e.x, e.y, e.cfg.soul);
      player.souls[e.cfg.soul]++;
      sfx.soul();
    }
  }

  function explode(x, y, radius, dmg, opts = {}) {
    spawnExplosionParticles(x, y);
    sfx.explosion();
    shakeScreen(10);
    for (const e of enemiesInRadius(x, y, radius)) {
      applyDamage(e, dmg, false);
      if (opts.burn && !e.dead) { e.burnTimer = 3; e.burnTick = 0.5; }
    }
  }

  function applyFrost(e) {
    e.speedMult = 0.35;
    e.slowTimer = 4;
  }

  function shakeScreen(mag) { shake.mag = Math.max(shake.mag, mag); shake.t = 0.3; }

  function addMessage(x, y, text, color) {
    messages.push({ x, y, text, color, life: 1.0 });
  }

  // ---------- Particles ----------
  function spawnHitParticles(x, y, color) {
    for (let i = 0; i < 5; i++) {
      particles.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: (Math.random() - 0.5) * 140, life: 0.35, color, size: 3 });
    }
  }
  function spawnDeathParticles(x, y, color) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 120;
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.6, color, size: 4 });
    }
  }
  function spawnExplosionParticles(x, y) {
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * 200;
      const c = Math.random() < 0.5 ? '#ff9d3d' : '#ffe27a';
      particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.5, color: c, size: 5 });
    }
  }
  function spawnSoulParticle(x, y, soulType) {
    const color = SOUL_META[soulType].color;
    particles.push({ x, y, vx: 0, vy: -40, life: 1.1, color, size: 6, soul: true, targetX: 40, targetY: 40 });
  }

  // ---------- Projectiles (enemy attacks) ----------
  function fireProjectile(e) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const spd = e.cfg.projSpeed;
    projectiles.push({
      x: e.x, y: e.y, vx: (dx / d) * spd, vy: (dy / d) * spd,
      kind: e.cfg.kind, dmg: e.cfg.projDmg,
    });
  }

  // ---------- Input ----------
  canvas.addEventListener('mousemove', (ev) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ev.clientX - rect.left;
    mouse.y = ev.clientY - rect.top;
  });
  canvas.addEventListener('contextmenu', (ev) => ev.preventDefault());
  canvas.addEventListener('mousedown', (ev) => {
    if (state !== 'playing') return;
    if (ev.button === 0) shoot();
    if (ev.button === 2) scoped = true;
  });
  window.addEventListener('mouseup', (ev) => { if (ev.button === 2) scoped = false; });
  window.addEventListener('keydown', (ev) => {
    if (state !== 'playing') return;
    if (ev.key === '1') player.ammo = 'normal';
    if (ev.key === '2') player.ammo = 'berserker';
    if (ev.key === '3') player.ammo = 'pyromancer';
    if (ev.key === '4') player.ammo = 'frost';
  });

  function shoot() {
    if (player.fireCooldown > 0) return;
    let ammo = player.ammo;
    if (ammo !== 'normal' && player.souls[ammo] <= 0) {
      addMessage(mouse.x, mouse.y, 'NO SOULS', '#888');
      sfx.empty();
      ammo = 'normal';
      player.ammo = 'normal';
    }

    const cooldownMult = player.frozenTimer > 0 ? 1.6 : 1;
    player.fireCooldown = BASE_COOLDOWN * cooldownMult;

    const px = mouse.x, py = mouse.y;

    if (ammo === 'normal') {
      sfx.shot();
      const hit = findHit(px, py);
      if (hit) applyDamage(hit.enemy, hit.headshot ? 9999 : BASE_DMG, hit.headshot);
      else sfx.miss();
    } else if (ammo === 'berserker') {
      player.souls.berserker--;
      sfx.heavyShot();
      const hit = findHit(px, py);
      if (hit) { applyDamage(hit.enemy, hit.headshot ? 9999 : BASE_DMG * 3, hit.headshot); shakeScreen(8); }
      else sfx.miss();
    } else if (ammo === 'pyromancer') {
      player.souls.pyromancer--;
      explode(px, py, 95, 34, { burn: true });
    } else if (ammo === 'frost') {
      player.souls.frost--;
      sfx.frost();
      const hits = enemiesInRadius(px, py, 75);
      if (hits.length === 0) sfx.miss();
      for (const e of hits) { applyDamage(e, BASE_DMG * 0.8, false); applyFrost(e); }
    }
  }

  // ---------- Update ----------
  function update(dtRaw) {
    gameTime += dtRaw;
    const timeScale = scoped ? 0.45 : 1;
    const dt = dtRaw * timeScale;

    player.fireCooldown = Math.max(0, player.fireCooldown - dtRaw);
    player.frozenTimer = Math.max(0, player.frozenTimer - dtRaw);
    player.hurtFlash = Math.max(0, player.hurtFlash - dtRaw);
    shake.t = Math.max(0, shake.t - dtRaw);
    waveBanner.t = Math.max(0, waveBanner.t - dtRaw);

    // spawn queue
    spawnTimer -= dtRaw;
    if (spawnQueue.length && spawnTimer <= 0) {
      spawnEnemy(spawnQueue.shift());
      spawnTimer = Math.max(0.35, 1.1 - player.wave * 0.05);
    }
    const aliveCount = enemies.reduce((n, e) => n + (e.dead ? 0 : 1), 0);
    if (!spawnQueue.length && aliveCount === 0 && enemies.length > 0) {
      waveTimer -= dtRaw;
      if (waveTimer <= 0) {
        enemies = [];
        player.hp = Math.min(player.maxHp, player.hp + 10);
        nextWave();
        waveTimer = 1.5;
      }
    }

    for (const e of enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dtRaw);
      if (e.slowTimer > 0) { e.slowTimer -= dt; if (e.slowTimer <= 0) e.speedMult = 1; }
      if (e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.burnTick -= dt;
        if (e.burnTick <= 0) { applyDamage(e, 5, false); e.burnTick = 0.5; }
      }
      e.t += dt;
      const spd = e.speed * e.speedMult;
      if (e.cfg.ranged) {
        if (e.y < e.stopY) {
          e.y += spd * dt;
        } else {
          e.x += Math.sin(e.t * 1.6) * 18 * dt;
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) { fireProjectile(e); e.shootTimer = e.cfg.fireRate; }
        }
      } else {
        e.y += spd * dt;
        if (e.cfg.zigzag) e.x += Math.sin(e.t * 6) * 90 * dt;
        e.x = Math.max(20, Math.min(W - 20, e.x));
        if (e.y >= player.y - 20) {
          player.hp -= e.cfg.dmg;
          player.hurtFlash = 0.25;
          sfx.hurt();
          shakeScreen(6);
          e.dead = true; // reaches player, no soul harvested (not a clean kill)
        }
      }
    }

    for (const p of projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    projectiles = projectiles.filter(p => {
      if (p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) return false;
      if (Math.hypot(p.x - player.x, p.y - player.y) < 26) {
        player.hp -= p.dmg;
        player.hurtFlash = 0.25;
        sfx.hurt();
        shakeScreen(5);
        if (p.kind === 'frost') player.frozenTimer = 2.5;
        spawnHitParticles(p.x, p.y, p.kind === 'fire' ? '#ff9d3d' : '#9fe8f5');
        return false;
      }
      return true;
    });

    for (const pt of particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94; pt.vy *= 0.94;
      if (pt.soul) {
        const dx = pt.targetX - pt.x, dy = pt.targetY - pt.y;
        pt.vx += dx * 0.02; pt.vy += dy * 0.02;
      } else {
        pt.vy += 220 * dt; // gravity for gore/explosion bits
      }
      pt.life -= dtRaw;
    }
    particles = particles.filter(pt => pt.life > 0);
    messages = messages.filter(m => { m.life -= dtRaw; m.y -= 20 * dtRaw; return m.life > 0; });

    if (player.hp <= 0) endGame();
  }

  function endGame() {
    state = 'gameover';
    finalStats.textContent = `Score: ${player.score} — Wave ${player.wave} — Kills ${player.kills} (${player.headshots} headshots)`;
    gameOverScreen.classList.remove('hidden');
  }

  // ---------- Rendering ----------
  const tombstones = [];
  function buildScenery() {
    tombstones.length = 0;
    for (let i = 0; i < 10; i++) {
      tombstones.push({ x: Math.random() * W, y: H - 20 - Math.random() * 30, w: 20 + Math.random() * 16, h: 30 + Math.random() * 24 });
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0c0a16');
    grad.addColorStop(0.55, '#161b1a');
    grad.addColorStop(1, '#050604');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // moon
    ctx.beginPath();
    ctx.fillStyle = 'rgba(200, 220, 210, 0.85)';
    ctx.arc(W / 2, 70, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(94,242,154,0.06)';
    ctx.beginPath();
    ctx.arc(W / 2, 70, 70, 0, Math.PI * 2);
    ctx.fill();

    // ground fog band
    ctx.fillStyle = 'rgba(94,242,154,0.05)';
    ctx.fillRect(0, H - 120, W, 120);

    // tombstones
    ctx.fillStyle = '#20241f';
    for (const t of tombstones) {
      ctx.beginPath();
      ctx.moveTo(t.x - t.w / 2, t.y);
      ctx.lineTo(t.x - t.w / 2, t.y - t.h + t.w / 2);
      ctx.arc(t.x, t.y - t.h + t.w / 2, t.w / 2, Math.PI, 0);
      ctx.lineTo(t.x + t.w / 2, t.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function drawPlayer() {
    const x = player.x, y = player.y;
    ctx.save();
    ctx.translate(x, y);
    // robe
    ctx.fillStyle = player.hurtFlash > 0 ? '#5c1414' : '#1c2a22';
    ctx.beginPath();
    ctx.moveTo(-26, 24);
    ctx.quadraticCurveTo(0, -10, 26, 24);
    ctx.closePath();
    ctx.fill();
    // hood
    ctx.fillStyle = '#0f1712';
    ctx.beginPath();
    ctx.arc(0, -6, 16, Math.PI, 0);
    ctx.fill();
    // eyes glow
    ctx.fillStyle = 'rgba(94,242,154,0.9)';
    ctx.beginPath(); ctx.arc(-5, -8, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -8, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e) {
    if (e.dead) return;
    const c = e.cfg;
    ctx.save();
    ctx.translate(e.x, e.y);
    const flash = e.hitFlash > 0;
    ctx.fillStyle = flash ? '#ffffff' : c.color;
    ctx.beginPath();
    ctx.arc(0, 6, c.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : c.dark;
    ctx.beginPath();
    ctx.arc(0, -c.radius * 0.55, c.headRadius, 0, Math.PI * 2);
    ctx.fill();
    if (e.slowTimer > 0) {
      ctx.strokeStyle = 'rgba(72,201,224,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 6, c.radius + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.burnTimer > 0) {
      ctx.fillStyle = 'rgba(255,140,20,0.55)';
      ctx.beginPath();
      ctx.arc(0, 6, c.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // hp bar
    const barW = c.radius * 2;
    const pct = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - barW / 2, e.y - c.radius - 16, barW, 5);
    ctx.fillStyle = pct > 0.5 ? '#5ef29a' : pct > 0.2 ? '#e6c14a' : '#c0392b';
    ctx.fillRect(e.x - barW / 2, e.y - c.radius - 16, barW * pct, 5);
  }

  function drawProjectile(p) {
    ctx.beginPath();
    ctx.fillStyle = p.kind === 'fire' ? '#ff9d3d' : '#9fe8f5';
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = p.kind === 'fire' ? 'rgba(255,157,61,0.3)' : 'rgba(159,232,245,0.3)';
    ctx.arc(p.x - p.vx * 0.02, p.y - p.vy * 0.02, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawParticle(pt) {
    ctx.globalAlpha = Math.max(0, pt.life);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawCrosshair() {
    const x = mouse.x, y = mouse.y;
    const meta = player.ammo === 'normal' ? { color: '#5ef29a' } : SOUL_META[player.ammo];
    ctx.strokeStyle = meta.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, scoped ? 12 : 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 26, y); ctx.lineTo(x - 8, y);
    ctx.moveTo(x + 8, y); ctx.lineTo(x + 26, y);
    ctx.moveTo(x, y - 26); ctx.lineTo(x, y - 8);
    ctx.moveTo(x, y + 8); ctx.lineTo(x, y + 26);
    ctx.stroke();

    if (player.fireCooldown > 0) {
      const pct = 1 - player.fireCooldown / (BASE_COOLDOWN * (player.frozenTimer > 0 ? 1.6 : 1));
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawScopeVignette() {
    if (!scoped) return;
    const grad = ctx.createRadialGradient(mouse.x, mouse.y, 60, mouse.x, mouse.y, Math.max(W, H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawHUD() {
    // HP bar
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(20, 20, 220, 22);
    const hpPct = Math.max(0, player.hp / player.maxHp);
    ctx.fillStyle = hpPct > 0.5 ? '#5ef29a' : hpPct > 0.2 ? '#e6c14a' : '#c0392b';
    ctx.fillRect(22, 22, 216 * hpPct, 18);
    ctx.strokeStyle = '#111';
    ctx.strokeRect(20, 20, 220, 22);
    ctx.fillStyle = '#eafff0';
    ctx.font = '13px Georgia';
    ctx.fillText(`HP ${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, 28, 36);

    // score / wave
    ctx.textAlign = 'right';
    ctx.font = '20px Georgia';
    ctx.fillStyle = '#eafff0';
    ctx.fillText(`Score: ${player.score}`, W - 20, 34);
    ctx.font = '14px Georgia';
    ctx.fillStyle = '#9fb0a5';
    ctx.fillText(`Wave ${player.wave}`, W - 20, 54);
    ctx.textAlign = 'left';

    // ammo bar bottom center
    const slots = [
      { key: 'normal', label: '1 · SHOT', color: '#5ef29a', count: '∞' },
      { key: 'berserker', label: `2 · ${SOUL_META.berserker.label}`, color: SOUL_META.berserker.color, count: player.souls.berserker },
      { key: 'pyromancer', label: `3 · ${SOUL_META.pyromancer.label}`, color: SOUL_META.pyromancer.color, count: player.souls.pyromancer },
      { key: 'frost', label: `4 · ${SOUL_META.frost.label}`, color: SOUL_META.frost.color, count: player.souls.frost },
    ];
    const slotW = 150, totalW = slotW * slots.length;
    let sx = W / 2 - totalW / 2;
    const sy = H - 56;
    for (const s of slots) {
      const active = player.ammo === s.key;
      ctx.fillStyle = active ? 'rgba(94,242,154,0.18)' : 'rgba(0,0,0,0.45)';
      ctx.fillRect(sx + 4, sy, slotW - 8, 42);
      ctx.strokeStyle = active ? s.color : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = active ? 2 : 1;
      ctx.strokeRect(sx + 4, sy, slotW - 8, 42);
      ctx.fillStyle = s.color;
      ctx.font = '12px Georgia';
      ctx.fillText(s.label, sx + 12, sy + 17);
      ctx.fillStyle = '#eafff0';
      ctx.font = '16px Georgia';
      ctx.fillText(String(s.count), sx + 12, sy + 35);
      sx += slotW;
    }

    if (player.frozenTimer > 0) {
      ctx.fillStyle = '#9fe8f5';
      ctx.font = '13px Georgia';
      ctx.fillText('Trigger hand numbed by frost...', W / 2 - 100, H - 68);
    }

    // messages
    ctx.font = '15px Georgia';
    for (const m of messages) {
      ctx.globalAlpha = Math.max(0, m.life);
      ctx.fillStyle = m.color;
      ctx.textAlign = 'center';
      ctx.fillText(m.text, m.x, m.y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';

    // wave banner
    if (waveBanner.t > 0) {
      ctx.globalAlpha = Math.min(1, waveBanner.t);
      ctx.textAlign = 'center';
      ctx.font = 'bold 42px Georgia';
      ctx.fillStyle = '#5ef29a';
      ctx.shadowColor = '#5ef29a';
      ctx.shadowBlur = 20;
      ctx.fillText(waveBanner.text, W / 2, H / 2 - 60);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }

  function render() {
    ctx.save();
    if (shake.t > 0) {
      const m = shake.mag * (shake.t / 0.3);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    drawPlayer();
    for (const e of enemies) drawEnemy(e);
    for (const p of projectiles) drawProjectile(p);
    for (const pt of particles) drawParticle(pt);
    drawScopeVignette();
    drawHUD();
    drawCrosshair();
    if (player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(180,20,20,${player.hurtFlash * 0.5})`;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
  }

  // ---------- Main loop ----------
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;
    if (state === 'playing') update(dt);
    if (state === 'playing') render();
    requestAnimationFrame(loop);
  }

  function startGame() {
    ensureAudio();
    resize();
    buildScenery();
    resetGame();
    player.x = W / 2;
    player.y = H - 50;
    state = 'playing';
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
  }

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  requestAnimationFrame(loop);
})();
