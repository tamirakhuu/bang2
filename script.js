const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const W = canvas.width;
const H = canvas.height;

// ─── SOUNDS ──────────────────────────────────────────────────────────────────
const sounds = {
  laser: new Audio("./sounds/laser.mp3"),
  rapid: new Audio("./sounds/rapid.mp3"),
  sniper: new Audio("./sounds/sniper.mp3"),
};

sounds.laser.volume = 0.6;
sounds.rapid.volume = 0.5;
sounds.sniper.volume = 0.7;

function playSound(name) {
  const base = sounds[name];
  if (!base) return;

  const s = base.cloneNode();
  s.volume = base.volume;
  s.play().catch(() => {});
}

// browser audio unlock
document.addEventListener(
  "click",
  () => {
    Object.values(sounds).forEach((a) => {
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => {});
    });
  },
  { once: true }
);

// ─── Colors ─────────────────────────────────────────────────────────────────
const C = {
  bg: "#284d2a",
  bg2: "#244425",
  grid: "rgba(255,255,255,0.035)",

  pathLight: "#d9be82",
  pathMid: "#c8a96e",
  pathDark: "#a9854e",
  pathEdge: "#927242",

  baseOuter: "#2354c7",
  baseInner: "#4d88ff",
  baseCore: "#ffffff",

  spawnGlow: "rgba(255,40,120,0.25)",
  spawn: "#ff2a78",

  spotBorder: "rgba(180,235,180,0.18)",
  spotFill: "rgba(145,220,145,0.08)",
  spotHoverFill: "rgba(145,255,200,0.18)",

  panelTop: "rgba(12, 32, 14, 0.96)",
  panelBottom: "rgba(7, 18, 9, 0.96)",
  panelBorder: "rgba(120,180,120,0.18)",

  text: "#ecfff0",
  textDim: "rgba(225,255,230,0.58)",
  gold: "#ffd54f",
  green: "#86ff8f",
  red: "#ff5377",
  orange: "#ffb347",

  enemyNorm: "#ff4d8f",
  enemyFast: "#ff9f43",
  enemyTank: "#8c6bff",

  hpBg: "#3f1d22",
  hpGreen: "#37dd5f",
  hpOrange: "#f7b731",
  hpRed: "#ff4d6d",

  towerBase: "#2f3c30",
  towerShadow: "rgba(0,0,0,0.28)",
};

const TOTAL_WAVES = 8;
const UPGRADE_COST = [100, 175];
const MAX_HP = 20;
const START_COINS = 300;

const RIGHT_W = 220;
const GAME_W = W - RIGHT_W;
const TOP_H = 76;

const BASE_X = GAME_W - 78;
const BASE_Y = H / 2;
const CELL = 38;

const UI_X = GAME_W + 16;

const weaponOrder = ["laser", "rapid", "sniper"];

const TOWER_TYPES = {
  laser: {
    name: "LASER",
    cost: 75,
    color: "#00d9ff",
    stats: [
      { damage: 20, range: 110, fireRate: 1.45, accuracy: 0.82, label: "LV1" },
      { damage: 34, range: 142, fireRate: 2.0, accuracy: 0.91, label: "LV2" },
      { damage: 62, range: 175, fireRate: 2.55, accuracy: 0.98, label: "LV3" },
    ]
  },
  rapid: {
    name: "RAPID",
    cost: 90,
    color: "#ff6868",
    stats: [
      { damage: 11, range: 102, fireRate: 3.4, accuracy: 0.80, label: "LV1" },
      { damage: 17, range: 118, fireRate: 4.25, accuracy: 0.88, label: "LV2" },
      { damage: 25, range: 136, fireRate: 5.1, accuracy: 0.93, label: "LV3" },
    ]
  },
  sniper: {
    name: "SNIPER",
    cost: 120,
    color: "#ffd54f",
    stats: [
      { damage: 58, range: 200, fireRate: 0.58, accuracy: 0.96, label: "LV1" },
      { damage: 92, range: 238, fireRate: 0.75, accuracy: 0.99, label: "LV2" },
      { damage: 142, range: 275, fireRate: 0.92, accuracy: 1.0, label: "LV3" },
    ]
  }
};

function getTowerType(tower) {
  return TOWER_TYPES[tower.type];
}

function getTowerStats(tower) {
  return TOWER_TYPES[tower.type].stats[tower.level];
}

const PATH = [
  { x: -18, y: H / 2 },
  { x: 94, y: H / 2 },
  { x: 94, y: 160 },
  { x: 290, y: 160 },
  { x: 290, y: H - 140 },
  { x: 520, y: H - 140 },
  { x: 520, y: 210 },
  { x: BASE_X + 26, y: 210 },
  { x: BASE_X + 26, y: BASE_Y },
];

const BUILD_SPOTS = [
  { x: 190, y: 118 },
  { x: 190, y: 218 },
  { x: 46, y: 230 },
  { x: 46, y: 400 },
  { x: 418, y: 300 },
  { x: 418, y: H - 82 },
  { x: 630, y: 160 },
  { x: 630, y: 260 },
  { x: 590, y: 400 },
];

function getWaveConfig(wave) {
  const baseHP = Math.round(100 * Math.pow(1.3, wave - 1));
  const count = 6 + (wave - 1) * 3;
  const speed = 72 + (wave - 1) * 6;
  const reward = 12 + wave * 2;
  const interval = Math.max(0.55, 1.35 - (wave - 1) * 0.08);
  return { baseHP, count, speed, reward, interval };
}

// ─── Game State ──────────────────────────────────────────────────────────────
let state = "between";
let playerHP = MAX_HP;
let coins = START_COINS;
let currentWave = 0;
let towers = [];
let enemies = [];
let lasers = [];
let particles = [];
let selectedTower = null;
let selectedWeapon = "laser";
let hoveredSpot = -1;
let occupiedSpots = new Set();

let waveEnemiesSpawned = 0;
let waveSpawnTimer = 0;
let announceTimer = 0;
let announceText = "";
let shakeX = 0, shakeY = 0, shakeDuration = 0, shakeIntensity = 0;
let flashTimer = 0;
let time = 0;
let rapidSoundCooldown = 0;

let mouseX = 0;
let mouseY = 0;

canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) * (W / rect.width);
  mouseY = (e.clientY - rect.top) * (H / rect.height);
  updateHoveredSpot();
});

canvas.addEventListener("click", (e) => {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top) * (H / rect.height);
  handleClick(mx, my);
});

function updateHoveredSpot() {
  hoveredSpot = -1;
  if (state !== "playing" && state !== "between") return;

  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    if (occupiedSpots.has(i)) continue;
    const s = BUILD_SPOTS[i];
    const dx = mouseX - s.x;
    const dy = mouseY - s.y;
    if (dx * dx + dy * dy < 18 * 18) {
      hoveredSpot = i;
      break;
    }
  }
}

function pointInRect(mx, my, x, y, w, h) {
  return mx >= x && mx <= x + w && my >= y && my <= y + h;
}

function handleClick(mx, my) {
  if (state === "between" && isInStartBtn(mx, my)) {
    startWave();
    return;
  }

  if (state === "gameover" || state === "win") {
    if (isInRestartBtn(mx, my)) resetGame();
    return;
  }

  if (state !== "playing" && state !== "between") return;

  for (let i = 0; i < weaponOrder.length; i++) {
    const key = weaponOrder[i];
    const bx = UI_X;
    const by = 148 + i * 48;
    if (pointInRect(mx, my, bx, by, 188, 34)) {
      selectedWeapon = key;
      return;
    }
  }

  if (selectedTower) {
    const infoY = 380;
    if (selectedTower.level < 2) {
      if (pointInRect(mx, my, UI_X, infoY + 156, 188, 34)) {
        upgradeTower(selectedTower);
        return;
      }
    }
    if (pointInRect(mx, my, UI_X, infoY + 194, 188, 30)) {
      sellTower(selectedTower);
      return;
    }
  }

  for (const t of towers) {
    const dx = mx - t.x;
    const dy = my - t.y;
    if (dx * dx + dy * dy < 18 * 18) {
      selectedTower = t;
      return;
    }
  }

  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    if (occupiedSpots.has(i)) continue;
    const s = BUILD_SPOTS[i];
    const dx = mx - s.x;
    const dy = my - s.y;
    if (dx * dx + dy * dy < 18 * 18) {
      const weapon = TOWER_TYPES[selectedWeapon];
      if (coins < weapon.cost) {
        triggerFlash();
        return;
      }
      placeTower(i, s.x, s.y);
      return;
    }
  }

  selectedTower = null;
}

function isInStartBtn(mx, my) {
  return mx >= UI_X && mx <= UI_X + 188 && my >= 362 && my <= 404;
}

function isInRestartBtn(mx, my) {
  return mx >= W / 2 - 98 && mx <= W / 2 + 98 && my >= H / 2 + 60 && my <= H / 2 + 108;
}

function triggerFlash() {
  flashTimer = 0.28;
}

function placeTower(spotIndex, x, y) {
  const weapon = TOWER_TYPES[selectedWeapon];
  if (coins < weapon.cost) {
    triggerFlash();
    return;
  }

  coins -= weapon.cost;
  occupiedSpots.add(spotIndex);

  const tower = {
    x,
    y,
    level: 0,
    cooldown: 0,
    spotIndex,
    type: selectedWeapon
  };

  towers.push(tower);
  selectedTower = tower;
  spawnParticles(x, y, 10, weapon.color);
}

function upgradeTower(tower) {
  if (tower.level >= 2) return;
  const cost = UPGRADE_COST[tower.level];
  if (coins < cost) {
    triggerFlash();
    return;
  }

  coins -= cost;
  tower.level++;
  spawnParticles(tower.x, tower.y, 14, getTowerType(tower).color);
  shake(4, 120);
}

function sellTower(tower) {
  coins += 25;
  towers = towers.filter((t) => t !== tower);
  occupiedSpots.delete(tower.spotIndex);
  if (selectedTower === tower) selectedTower = null;
  spawnParticles(tower.x, tower.y, 8, "#ff5377");
}

function startWave() {
  if (currentWave >= TOTAL_WAVES) return;

  currentWave++;
  state = "playing";
  waveEnemiesSpawned = 0;
  waveSpawnTimer = 0;

  announceText = `ҮЕ ${currentWave}`;
  announceTimer = 2.2;
}

function spawnEnemy(wave) {
  const cfg = getWaveConfig(wave);
  const enemyType = wave >= 6 ? "tank" : wave >= 4 ? "fast" : "normal";

  enemies.push({
    x: PATH[0].x,
    y: PATH[0].y,
    hp: cfg.baseHP,
    maxHp: cfg.baseHP,
    speed: enemyType === "fast" ? cfg.speed * 1.18 : enemyType === "tank" ? cfg.speed * 0.82 : cfg.speed,
    reward: enemyType === "tank" ? cfg.reward + 4 : cfg.reward,
    waypointIndex: 1,
    enemyType,
    dead: false,
    size: enemyType === "tank" ? 16 : enemyType === "fast" ? 11 : 12,
  });
}

function fireLaserAt(tower, enemy) {
  const stats = getTowerStats(tower);
  const towerType = getTowerType(tower);

  if (tower.type === "laser") {
    playSound("laser");
  } else if (tower.type === "rapid") {
    if (rapidSoundCooldown <= 0) {
      playSound("rapid");
      rapidSoundCooldown = 0.12;
    }
  } else if (tower.type === "sniper") {
    playSound("sniper");
  }

  const hit = Math.random() <= stats.accuracy;

  let targetX = enemy.x;
  let targetY = enemy.y;

  if (!hit) {
    const missOffset = 16 + Math.random() * 24;
    const angle = Math.atan2(enemy.y - tower.y, enemy.x - tower.x);
    const side = Math.random() < 0.5 ? -1 : 1;
    targetX = enemy.x + Math.cos(angle + side * Math.PI / 2) * missOffset;
    targetY = enemy.y + Math.sin(angle + side * Math.PI / 2) * missOffset;
  }

  lasers.push({
    x1: tower.x,
    y1: tower.y,
    x2: targetX,
    y2: targetY,
    color: towerType.color,
    life: 0.09,
    width: tower.type === "sniper" ? 4 : tower.type === "rapid" ? 2 : 3,
  });

  if (hit && !enemy.dead) {
    enemy.hp -= stats.damage;
    spawnParticles(enemy.x, enemy.y, 4, towerType.color);

    if (enemy.hp <= 0) {
      enemy.dead = true;
      enemies = enemies.filter((e) => e !== enemy);
      coins += enemy.reward;
      spawnParticles(enemy.x, enemy.y, 10, C.gold);
    }
  } else {
    spawnParticles(targetX, targetY, 3, towerType.color);
  }
}

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 35 + Math.random() * 85;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 1,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

function shake(intensity, durationMs) {
  shakeIntensity = intensity;
  shakeDuration = durationMs / 1000;
}

function showOverlay(win) {
  state = win ? "win" : "gameover";
}

function resetGame() {
  state = "between";
  playerHP = MAX_HP;
  coins = START_COINS;
  currentWave = 0;
  towers = [];
  enemies = [];
  lasers = [];
  particles = [];
  selectedTower = null;
  selectedWeapon = "laser";
  hoveredSpot = -1;
  occupiedSpots.clear();
  waveEnemiesSpawned = 0;
  waveSpawnTimer = 0;
  announceTimer = 0;
  flashTimer = 0;
  shakeX = 0;
  shakeY = 0;
  rapidSoundCooldown = 0;
}

let lastTime = 0;

function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.1);
  lastTime = ts;
  time += dt;

  update(dt);
  render();

  requestAnimationFrame(loop);
}

function update(dt) {
  if (announceTimer > 0) announceTimer -= dt;
  if (flashTimer > 0) flashTimer -= dt;
  if (rapidSoundCooldown > 0) rapidSoundCooldown -= dt;

  if (shakeDuration > 0) {
    shakeDuration -= dt;
    shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
  } else {
    shakeX = 0;
    shakeY = 0;
  }

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.vy += 55 * dt;
    p.life -= dt * 1.45;
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (state !== "playing") return;

  const cfg = getWaveConfig(currentWave);

  if (waveEnemiesSpawned < cfg.count) {
    waveSpawnTimer += dt;
    if (waveSpawnTimer >= cfg.interval) {
      waveSpawnTimer -= cfg.interval;
      spawnEnemy(currentWave);
      waveEnemiesSpawned++;
    }
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.dead) {
      enemies.splice(i, 1);
      continue;
    }

    const wp = PATH[e.waypointIndex];
    const dx = wp.x - e.x;
    const dy = wp.y - e.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = e.speed * dt;

    if (dist <= step) {
      e.x = wp.x;
      e.y = wp.y;
      e.waypointIndex++;

      if (e.waypointIndex >= PATH.length) {
        e.dead = true;
        enemies.splice(i, 1);
        playerHP--;
        shake(8, 230);
        spawnParticles(BASE_X, BASE_Y, 12, C.red);
        if (playerHP <= 0) showOverlay(false);
        continue;
      }
    } else {
      e.x += (dx / dist) * step;
      e.y += (dy / dist) * step;
    }
  }

  for (const tower of towers) {
    const stats = getTowerStats(tower);
    tower.cooldown -= dt;
    if (tower.cooldown > 0) continue;

    let best = null;
    let bestDist = Infinity;

    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - tower.x;
      const dy = e.y - tower.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d <= stats.range && d < bestDist) {
        bestDist = d;
        best = e;
      }
    }

    if (best) {
      fireLaserAt(tower, best);
      tower.cooldown = 1 / stats.fireRate;
    }
  }

  for (let i = lasers.length - 1; i >= 0; i--) {
    lasers[i].life -= dt;
    if (lasers[i].life <= 0) lasers.splice(i, 1);
  }

  if (waveEnemiesSpawned >= cfg.count && enemies.length === 0) {
    if (currentWave >= TOTAL_WAVES) {
      showOverlay(true);
    } else {
      state = "between";
      coins += 35;
    }
  }
}

function render() {
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawWorld();
  drawTopHud();
  drawBuildSpots();
  drawTowers();
  drawEnemies();
  drawLasers();
  drawParticles();
  drawSidePanel();
  drawSelectedTowerRange();

  ctx.restore();

  if (state === "gameover" || state === "win") drawOverlay();

  if (announceTimer > 0) {
    ctx.save();
    ctx.fillStyle = C.gold;
    ctx.font = "32px Comfortaa";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(announceText, W / 2, 50);
    ctx.restore();
  }
}

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundRect(x, y, w, h, r, fill, stroke, strokeWidth = 1) {
  roundRectPath(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
  }
}

function drawPanel(x, y, w, h, radius = 14) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, C.panelTop);
  grad.addColorStop(1, C.panelBottom);

  roundRectPath(x, y, w, h, radius);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = C.panelBorder;
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

function drawWorld() {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#2b542d");
  bg.addColorStop(1, "#244425");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GAME_W, H);

  const vg = ctx.createRadialGradient(GAME_W / 2, H / 2, 80, GAME_W / 2, H / 2, GAME_W / 1.1);
  vg.addColorStop(0, "rgba(255,255,255,0.04)");
  vg.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, GAME_W, H);

  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= GAME_W; x += CELL) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += CELL) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(GAME_W, y);
    ctx.stroke();
  }

  drawPath();
  drawSpawn();
  drawBase();

  const sideGrad = ctx.createLinearGradient(GAME_W, 0, W, 0);
  sideGrad.addColorStop(0, "rgba(0,0,0,0.06)");
  sideGrad.addColorStop(1, "rgba(0,0,0,0.16)");
  ctx.fillStyle = sideGrad;
  ctx.fillRect(GAME_W, 0, RIGHT_W, H);
}

function drawPath() {
  const pathW = 38;

  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];

    ctx.fillStyle = C.pathEdge;
    if (a.x === b.x) {
      const top = Math.min(a.y, b.y);
      const height = Math.abs(b.y - a.y);
      ctx.fillRect(a.x - pathW / 2 - 2, top, pathW + 4, height);

      const grad = ctx.createLinearGradient(a.x - pathW / 2, top, a.x + pathW / 2, top);
      grad.addColorStop(0, C.pathDark);
      grad.addColorStop(0.5, C.pathLight);
      grad.addColorStop(1, C.pathDark);
      ctx.fillStyle = grad;
      ctx.fillRect(a.x - pathW / 2, top, pathW, height);
    } else {
      const left = Math.min(a.x, b.x);
      const width = Math.abs(b.x - a.x);
      ctx.fillRect(left, a.y - pathW / 2 - 2, width, pathW + 4);

      const grad = ctx.createLinearGradient(left, a.y - pathW / 2, left, a.y + pathW / 2);
      grad.addColorStop(0, C.pathLight);
      grad.addColorStop(0.45, C.pathMid);
      grad.addColorStop(1, C.pathDark);
      ctx.fillStyle = grad;
      ctx.fillRect(left, a.y - pathW / 2, width, pathW);
    }
  }

  for (let i = 1; i < PATH.length - 1; i++) {
    const p = PATH[i];
    ctx.fillStyle = C.pathEdge;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pathW / 2 + 2, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createRadialGradient(p.x - 4, p.y - 6, 5, p.x, p.y, pathW / 1.3);
    grad.addColorStop(0, C.pathLight);
    grad.addColorStop(1, C.pathDark);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, pathW / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSpawn() {
  ctx.save();
  ctx.shadowColor = C.spawn;
  ctx.shadowBlur = 18;
  ctx.fillStyle = C.spawnGlow;
  ctx.beginPath();
  ctx.arc(PATH[0].x + 18, PATH[0].y, 22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.spawn;
  ctx.beginPath();
  ctx.arc(PATH[0].x + 18, PATH[0].y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBase() {
  const pulse = 0.72 + Math.sin(time * 3.2) * 0.28;
  const lowHp = playerHP <= 6;

  const glowColor = lowHp
    ? `rgba(255,80,100,${0.28 + pulse * 0.18})`
    : `rgba(90,170,255,${0.22 + pulse * 0.16})`;

  const outerColor = lowHp ? "#8a2d3c" : "#214fbf";
  const innerColor = lowHp ? "#c84d63" : "#4b87ff";
  const coreColor = "#eef6ff";

  ctx.save();
  ctx.translate(BASE_X, BASE_Y);

  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(27, 24, 28, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 28;
  ctx.fillStyle = glowColor;
  ctx.beginPath();
  ctx.arc(25, 0, 30 + pulse * 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;

  roundRect(-1, -28, 56, 56, 14, outerColor);
  roundRect(7, -20, 40, 40, 10, innerColor);
  roundRect(8, -18, 36, 8, 5, "rgba(255,255,255,0.14)");
  roundRect(16, -11, 22, 22, 6, coreColor);
  roundRect(16, -11, 22, 22, 6, null, "rgba(40,80,150,0.18)", 1);

  ctx.fillStyle = lowHp ? "#ff6b81" : "#3d7cff";
  ctx.beginPath();
  ctx.arc(27, 0, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "8px Comfortaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("ТӨРДӨГ", 27, 45);

  ctx.restore();
}

function drawTopHud() {
  drawPanel(14, 14, GAME_W - 28, 52, 14);

  const hpRatio = playerHP / MAX_HP;
  const hpColor = hpRatio > 0.5 ? C.green : hpRatio > 0.25 ? C.orange : C.red;

  drawHudChip(28, 26, 120, 28, `ҮЕ ${currentWave || "-"} / ${TOTAL_WAVES}`, C.gold);
  drawHudChip(162, 26, 110, 28, `АМЬ ${playerHP}/${MAX_HP}`, hpColor);
  drawHudChip(286, 26, 110, 28, `${coins}₮`, flashTimer > 0 ? C.red : C.text);

  ctx.fillStyle = C.textDim;
  ctx.font = "11px Comfortaa";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText("ХОЖИЖ БАЙЖ ХОЖНО ШҮҮ", GAME_W - 126, 40);
}

function drawHudChip(x, y, w, h, label, color) {
  roundRect(x, y, w, h, 10, "rgba(255,255,255,0.03)", "rgba(255,255,255,0.05)", 1);
  ctx.fillStyle = color;
  ctx.font = "12px Comfortaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + w / 2, y + h / 2 + 1);
}

function drawBuildSpots() {
  if (state !== "playing" && state !== "between") return;

  for (let i = 0; i < BUILD_SPOTS.length; i++) {
    if (occupiedSpots.has(i)) continue;
    const s = BUILD_SPOTS[i];
    const hov = hoveredSpot === i;
    const weaponColor = TOWER_TYPES[selectedWeapon].color;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.globalAlpha = hov ? 1 : 0.22;

    if (hov) {
      ctx.shadowColor = weaponColor;
      ctx.shadowBlur = 12;
    }

    roundRect(-14, -14, 28, 28, 6, hov ? C.spotHoverFill : C.spotFill, hov ? weaponColor : C.spotBorder, hov ? 1.5 : 1);

    ctx.fillStyle = hov ? weaponColor : "rgba(220,255,220,0.45)";
    ctx.fillRect(-1, -6, 2, 12);
    ctx.fillRect(-6, -1, 12, 2);

    ctx.restore();
  }

  if (hoveredSpot !== -1) {
    const s = BUILD_SPOTS[hoveredSpot];
    const canBuy = coins >= TOWER_TYPES[selectedWeapon].cost;
    ctx.fillStyle = canBuy ? C.gold : C.red;
    ctx.font = "10px Comfortaa";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${TOWER_TYPES[selectedWeapon].cost}₮`, s.x, s.y - 16);
  }
}

function drawTowers() {
  for (const tower of towers) {
    const towerType = getTowerType(tower);
    const stats = getTowerStats(tower);
    const col = towerType.color;

    ctx.save();
    ctx.translate(tower.x, tower.y);

    if (selectedTower === tower) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
    }

    ctx.fillStyle = C.towerShadow;
    ctx.beginPath();
    ctx.ellipse(0, 14, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    roundRect(-15, -15, 30, 30, 8, C.towerBase);
    roundRect(-11, -11, 22, 22, 6, col);

    ctx.fillStyle = "rgba(255,255,255,0.15)";
    roundRect(-10, -10, 20, 6, 4, "rgba(255,255,255,0.15)");

    ctx.fillStyle = "#1b231c";
    roundRect(-5, -5, 10, 10, 3, "#1b231c");

    if (tower.type === "laser") {
      ctx.fillStyle = "#11242a";
      ctx.fillRect(-2, -18, 4, 12);
      ctx.fillStyle = "#9ef3ff";
      ctx.fillRect(-1, -16, 2, 8);
    } else if (tower.type === "rapid") {
      ctx.fillStyle = "#2a1212";
      ctx.fillRect(-6, -16, 3, 10);
      ctx.fillRect(3, -16, 3, 10);
      ctx.fillStyle = "#ffc4c4";
      ctx.fillRect(-6, -15, 3, 3);
      ctx.fillRect(3, -15, 3, 3);
    } else if (tower.type === "sniper") {
      ctx.fillStyle = "#3f3412";
      ctx.fillRect(-1, -21, 2, 15);
      ctx.fillRect(3, -12, 5, 4);
      ctx.fillStyle = "#fff0ad";
      ctx.fillRect(-1, -20, 2, 4);
    }

    for (let i = 0; i <= tower.level; i++) {
      ctx.fillStyle = i === 2 ? "#fff0a6" : "rgba(255,255,255,0.65)";
      ctx.beginPath();
      ctx.arc(-7 + i * 7, 11, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.fillStyle = "#081308";
    ctx.font = "8px Comfortaa";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(stats.label, 0, 0);

    ctx.restore();
  }
}

function drawSelectedTowerRange() {
  if (!selectedTower) return;
  const stats = getTowerStats(selectedTower);
  const col = getTowerType(selectedTower).color;

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = hexToRgba(col, 0.22);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(selectedTower.x, selectedTower.y, stats.range, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;

    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.enemyType === "fast") {
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = C.enemyFast;
      ctx.fillRect(-e.size, -e.size, e.size * 2, e.size * 2);
    } else if (e.enemyType === "tank") {
      roundRect(-e.size, -e.size, e.size * 2, e.size * 2, 6, C.enemyTank);
    } else {
      ctx.fillStyle = C.enemyNorm;
      ctx.beginPath();
      ctx.arc(0, 0, e.size, 0, Math.PI * 2);
      ctx.fill();
    }

    const barW = 28;
    const barH = 4;
    const barY = -e.size - 10;
    ctx.fillStyle = C.hpBg;
    ctx.fillRect(-barW / 2, barY, barW, barH);

    const ratio = Math.max(0, e.hp / e.maxHp);
    const hpCol = ratio > 0.5 ? C.hpGreen : ratio > 0.25 ? C.hpOrange : C.hpRed;
    ctx.fillStyle = hpCol;
    ctx.fillRect(-barW / 2, barY, barW * ratio, barH);

    ctx.restore();
  }
}

function drawLasers() {
  for (const l of lasers) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, l.life / 0.09);

    ctx.strokeStyle = l.color;
    ctx.shadowColor = l.color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = l.width + 2;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();

    ctx.strokeStyle = "#ffffff";
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(1, l.width - 1);
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawSidePanel() {
  const panelX = UI_X - 8;
  const panelY = 92;
  const panelW = 204;

  drawPanel(panelX, panelY, panelW, 270, 16);

  ctx.fillStyle = C.textDim;
  ctx.font = "11px Comfortaa";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("ЗЭВСЭГҮҮД", UI_X, panelY + 18);

  for (let i = 0; i < weaponOrder.length; i++) {
    const key = weaponOrder[i];
    const weapon = TOWER_TYPES[key];
    const by = panelY + 56 + i * 48;
    const active = selectedWeapon === key;

    roundRect(
      UI_X,
      by,
      188,
      34,
      10,
      active ? "rgba(52,160,72,0.92)" : "rgba(255,255,255,0.04)",
      active ? weapon.color : "rgba(255,255,255,0.06)",
      active ? 1.5 : 1
    );

    roundRect(UI_X + 6, by + 6, 6, 22, 3, weapon.color);

    ctx.fillStyle = active ? C.text : C.textDim;
    ctx.font = "11px Comfortaa";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(weapon.name, UI_X + 18, by + 17);

    ctx.fillStyle = active ? C.gold : "rgba(255,213,79,0.7)";
    ctx.textAlign = "right";
    ctx.fillText(`${weapon.cost}₮`, UI_X + 176, by + 17);
  }

  const previewY = panelY + 206;
  roundRect(
    UI_X,
    previewY,
    188,
    34,
    10,
    "rgba(255,255,255,0.03)",
    "rgba(255,255,255,0.05)",
    1
  );

  const preview = TOWER_TYPES[selectedWeapon].stats[0];

  ctx.fillStyle = C.textDim;
  ctx.font = "9px Comfortaa";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.fillText(`DMG ${preview.damage}`, UI_X + 10, previewY + 17);
  ctx.fillText(`RNG ${preview.range}`, UI_X + 74, previewY + 17);
  ctx.fillText(`SPD ${preview.fireRate.toFixed(1)}`, UI_X + 138, previewY + 17);

  const progY = panelY + 250;
  roundRect(UI_X, progY, 188, 8, 5, "rgba(255,255,255,0.06)");
  roundRect(UI_X, progY, 188 * (currentWave / TOTAL_WAVES), 8, 5, C.gold);

  const canStart = state === "between" && currentWave < TOTAL_WAVES;
  const btnY = panelY + 270;

  roundRect(
    UI_X,
    btnY,
    188,
    42,
    12,
    canStart ? "#2fa445" : "#2e4330"
  );

  ctx.fillStyle = canStart ? C.text : "rgba(255,255,255,0.35)";
  ctx.font = "13px Comfortaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(
    currentWave === 0 ? "▶ ЭХЛЭХ 1" : `▶ START WAVE ${currentWave + 1}`,
    UI_X + 94,
    btnY + 21
  );

  if (selectedTower) {
    const towerType = getTowerType(selectedTower);
    const st = getTowerStats(selectedTower);
    const nst = towerType.stats[selectedTower.level + 1];

    const infoY = 380;
    drawPanel(panelX, infoY, panelW, 210, 16);

    ctx.fillStyle = towerType.color;
    ctx.font = "12px Comfortaa";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`${towerType.name} ${st.label}`, UI_X, infoY + 18);

    ctx.fillStyle = C.text;
    ctx.font = "11px Comfortaa";

    ctx.textAlign = "left";
    ctx.fillText("DMG", UI_X, infoY + 48);
    ctx.fillText("RNG", UI_X, infoY + 70);
    ctx.fillText("SPD", UI_X, infoY + 92);
    ctx.fillText("ACC", UI_X, infoY + 114);

    ctx.textAlign = "right";
    ctx.fillText(`${st.damage}`, UI_X + 178, infoY + 48);
    ctx.fillText(`${st.range}`, UI_X + 178, infoY + 70);
    ctx.fillText(`${st.fireRate.toFixed(1)}/s`, UI_X + 178, infoY + 92);
    ctx.fillText(`${Math.round(st.accuracy * 100)}%`, UI_X + 178, infoY + 114);

    if (nst) {
      ctx.textAlign = "left";
      ctx.fillStyle = C.textDim;
      ctx.font = "10px Comfortaa";
      ctx.fillText(`NEXT ${nst.damage}/${nst.range}/${nst.fireRate.toFixed(1)}`, UI_X, infoY + 140);
    }

    if (selectedTower.level < 2) {
      const cost = UPGRADE_COST[selectedTower.level];
      const canUp = coins >= cost;

      roundRect(UI_X, infoY + 156, 188, 34, 8, canUp ? "#296b39" : "#334433");
      ctx.fillStyle = canUp ? C.text : "rgba(255,255,255,0.35)";
      ctx.font = "11px Comfortaa";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`UPGRADE (${cost}₮)`, UI_X + 94, infoY + 173);
    }

    roundRect(UI_X, infoY + 194, 188, 30, 8, "#5b2430");
    ctx.fillStyle = C.text;
    ctx.fillText("SELL (+25g)", UI_X + 94, infoY + 209);
  }
}

function drawOverlay() {
  ctx.fillStyle = "rgba(0,0,0,0.74)";
  ctx.fillRect(0, 0, W, H);

  const win = state === "win";
  const title = win ? " ТА ЯЛЛАА!" : "ГУНИГ2";
  const sub = win ? `ДАВСАН РАУНД ${TOTAL_WAVES}` : `ИШШ ЧААВААС`;
  const titleCol = win ? C.gold : C.red;

  const cardW = 420;
  const cardH = 230;
  const cardX = W / 2 - cardW / 2;
  const cardY = H / 2 - cardH / 2;

  drawPanel(cardX, cardY, cardW, cardH, 22);

  roundRect(
    cardX + 10,
    cardY + 10,
    cardW - 20,
    20,
    10,
    "rgba(255,255,255,0.03)"
  );

  ctx.save();
  ctx.shadowColor = titleCol;
  ctx.shadowBlur = 18;
  ctx.fillStyle = titleCol;
  ctx.font = "44px Comfortaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, W / 2, cardY + 74);
  ctx.restore();

  ctx.fillStyle = "rgba(236,255,240,0.84)";
  ctx.font = "16px Comfortaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(sub, W / 2, cardY + 126);

  const btnW = 196;
  const btnH = 50;
  const btnX = W / 2 - btnW / 2;
  const btnY = cardY + 160;

  roundRect(btnX, btnY, btnW, btnH, 12, "#2fa445");

  ctx.fillStyle = C.text;
  ctx.font = "16px Comfortaa";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("▶ ДАХИН ТОГЛОХ", W / 2, btnY + btnH / 2 + 1);
}

function hexToRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

requestAnimationFrame(loop);