// MOÑONA — Duelo de Tejo
// Platanus Hack 26: Bogotá Arcade Challenge
//
// Tejo is Colombia's national sport: you hurl a metal puck across a clay court at
// a steel ring (the bocín) ringed with folded gunpowder packets (mechas). Hitting a
// mecha detonates it. This is that, as a 70-second head-to-head arcade duel.
//
// Scoring, following the real sport:
//   mano ......... 1  — the tejo bites the clay inside the ring's shadow
//   mecha ........ 3  — you detonate a gunpowder packet
//   embocinada ... 6  — the tejo lands clean inside the bocín
//   moñona ....... 9  — inside the bocín AND a detonation, on the same throw
//
// Controls are one joystick and one button, by design: the joystick walks your
// crosshair over the clay, the button charges the throw. Accuracy is decided by
// WHEN you let go — the gauge orbiting your crosshair has a bright sweet spot,
// and the scatter ring shrinks to nothing as you approach it.

const W = 800;
const H = 600;

const STORE_KEY = 'monona-tejo-scores-v1';
const MAX_SCORES = 6;
const NAME_LEN = 3;

const ROUND_MS = 70000;
const SUDDEN_MS = 30000;
const IDLE_MS = 45000;

// --- Court geometry -------------------------------------------------------

const COURT = { x: 170, y: 84, w: 460, h: 320 };
const BOCIN = { x: 400, y: 232, hole: 26, ring: 40 };

const AIM_MIN_X = COURT.x + 24;
const AIM_MAX_X = COURT.x + COURT.w - 24;
const AIM_MIN_Y = COURT.y + 26;
const AIM_MAX_Y = COURT.y + COURT.h - 28;

const MECHA_SLOTS = 8;
const MECHA_MAX_ALIVE = 4;
const MECHA_HIT_R = 18;
const MECHA_RESPAWN_MS = 1900;

// --- Throw tuning ---------------------------------------------------------

const AIM_SPEED = 300;
const AIM_SPEED_CHARGING = 132;
const SWEEP_MS = 1050;
const SWEET_LO = 0.8;
const SWEET_HI = 0.94;
const BURN_SWEEPS = 2;
const SCATTER_MAX = 132;
const FLIGHT_MS = 520;
const RECOVER_MS = 250;

const COL = {
  night: 0x0a0c07,
  backdrop: 0x05060a,
  clay: 0x8a4526,
  clayDark: 0x5f2d17,
  clayLight: 0xa8593a,
  frame: 0x3f2410,
  frameLip: 0x6a4020,
  metal: 0xd7d7c4,
  metalDark: 0x8d8d7a,
  hole: 0x24110a,
  p1: 0xe1ff00,
  p2: 0xff4f9a,
  white: 0xf7ffd8,
  slate: 0x9aa47c,
  dim: 0x4a5136,
  red: 0xff5a4d,
  gold: 0xffd21e,
  blue: 0x2f6bd8,
  crowd: 0x131a10,
};

const CSS = {
  p1: '#e1ff00',
  p2: '#ff4f9a',
  white: '#f7ffd8',
  slate: '#9aa47c',
  dim: '#5c6442',
  red: '#ff5a4d',
  gold: '#ffd21e',
  metal: '#d7d7c4',
};

const LETTER_GRID = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
  ['H', 'I', 'J', 'K', 'L', 'M', 'N'],
  ['O', 'P', 'Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z', 'Ñ', '.'],
  ['DEL', 'FIN'],
];

const MENU_ITEMS = [
  { id: 'p1cpu', label: '1 JUGADOR   ( VS CPU )' },
  { id: 'pvp', label: '2 JUGADORES  ( DUELO )' },
  { id: 'controls', label: 'CONTROLES' },
  { id: 'board', label: 'MEJORES TEJOS' },
];

// DO NOT replace existing keys — they match the physical arcade cabinet wiring.
// To add local testing shortcuts, append extra keys to any array.
const CABINET_KEYS = {
  P1_U: ['w'],
  P1_D: ['s'],
  P1_L: ['a'],
  P1_R: ['d'],
  P1_1: ['u'],
  P1_2: ['i'],
  P1_3: ['o'],
  P1_4: ['j'],
  P1_5: ['k'],
  P1_6: ['l'],
  P2_U: ['ArrowUp'],
  P2_D: ['ArrowDown'],
  P2_L: ['ArrowLeft'],
  P2_R: ['ArrowRight'],
  P2_1: ['r'],
  P2_2: ['t'],
  P2_3: ['y'],
  P2_4: ['f'],
  P2_5: ['g'],
  P2_6: ['h'],
  START1: ['Enter'],
  START2: ['2'],
};

const KEY_TO_ARCADE = Object.create(null);
for (const [code, keys] of Object.entries(CABINET_KEYS)) {
  for (const key of keys) {
    KEY_TO_ARCADE[normalizeKey(key)] = code;
  }
}

// Any of these buttons acts as "throw" / "confirm" for a player, so nobody at the
// cabinet has to be told which button is the right one.
const THROW_BTNS = {
  p1: ['P1_1', 'P1_2', 'P1_3', 'P1_4', 'P1_5', 'P1_6'],
  p2: ['P2_1', 'P2_2', 'P2_3', 'P2_4', 'P2_5', 'P2_6'],
};

// Every button that means "yes" on a menu — at a cabinet nobody reads which one.
const CONFIRM_BTNS = [
  'START1', 'START2',
  'P1_1', 'P1_2', 'P1_3', 'P1_4', 'P1_5', 'P1_6',
  'P2_1', 'P2_2', 'P2_3', 'P2_4', 'P2_5', 'P2_6',
];

const held = Object.create(null);
const edge = Object.create(null);

function normalizeKey(key) {
  return key.length === 1 ? key.toLowerCase() : key;
}

function onKeyDown(e) {
  const code = KEY_TO_ARCADE[normalizeKey(e.key)];
  if (!code) return;
  if (!held[code]) edge[code] = true;
  held[code] = true;
  if (e.key === ' ' || e.key.indexOf('Arrow') === 0) e.preventDefault();
}

function onKeyUp(e) {
  const code = KEY_TO_ARCADE[normalizeKey(e.key)];
  if (code) held[code] = false;
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);

// If the frame loses focus mid-press the matching keyup never arrives, which would
// pin a player in a charge forever. On a cabinet nobody can reach, that is fatal.
function releaseAllKeys() {
  for (const key in held) held[key] = false;
}

window.addEventListener('blur', releaseAllKeys);
document.addEventListener('visibilitychange', function () {
  if (document.hidden) releaseAllKeys();
});

// Consume a rising edge. Returns true once per physical press.
function pressed(code) {
  if (edge[code]) {
    edge[code] = false;
    return true;
  }
  return false;
}

function pressedAny(codes) {
  let hit = false;
  for (const code of codes) {
    if (pressed(code)) hit = true;
  }
  return hit;
}

function heldAny(codes) {
  for (const code of codes) {
    if (held[code]) return true;
  }
  return false;
}

function clearEdges() {
  for (const key in edge) edge[key] = false;
}

function anyCabinetHeld() {
  for (const key in held) {
    if (held[key]) return true;
  }
  return false;
}

// --- Boot -----------------------------------------------------------------

const config = {
  type: Phaser.AUTO,
  width: W,
  height: H,
  parent: 'game-root',
  backgroundColor: '#05060a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: W,
    height: H,
  },
  scene: { create, update },
};

new Phaser.Game(config);

function create() {
  const scene = this;

  scene.st = {
    phase: 'attract',
    scores: [],
    saveNote: 'Cargando puntajes...',
    menuCursor: 0,
    menuCooldown: 0,
    resultUntil: 0,
    pendingEntry: null,
    name: { letters: [], row: 0, col: 0, moveUntil: 0, okUntil: 0 },
    shakeUntil: 0,
  };

  buildBackdrop(scene);
  buildCourt(scene);
  buildPlayfieldFx(scene);
  buildHud(scene);
  buildThrowers(scene);
  buildTitle(scene);
  buildControlsCard(scene);
  buildBoardCard(scene);
  buildResultCard(scene);
  buildNameCard(scene);
  buildPauseCard(scene);

  initAudio(scene);

  // The attract screen is never a dead menu — a full CPU-versus-CPU duel runs
  // underneath it, so the cabinet always shows the game being played.
  startMatch(scene, 'demo');
  showTitle(scene);

  loadScores()
    .then((scores) => {
      scene.st.scores = scores;
      scene.st.saveNote = scores.length ? '' : 'Se el primero en el tablero.';
      refreshBoard(scene);
    })
    .catch(() => {
      scene.st.scores = [];
      scene.st.saveNote = 'Sin almacenamiento. El duelo corre igual.';
      refreshBoard(scene);
    });
}

function update(time, delta) {
  const scene = this;
  if (!scene.st) return;

  const dt = Math.min(delta, 50);
  const phase = scene.st.phase;

  // Idle watchdog. Nobody can reach this cabinet for three days, so no screen is
  // allowed to hold the machine indefinitely. A player who opens the name grid,
  // does not understand it and walks away would otherwise park the cabinet on a
  // static card forever — and the first several games all reach that grid.
  // Match phases are exempt: they drain themselves on the round clock.
  if (phase === 'playing' || phase === 'sudden' || phase === 'countdown' || phase === 'attract') {
    scene.st.idleT = 0;
  } else {
    scene.st.idleT = anyCabinetHeld() ? 0 : (scene.st.idleT || 0) + dt;
    if (scene.st.idleT > IDLE_MS) {
      scene.st.idleT = 0;
      if (phase === 'name') {
        // saveEntry defaults the name and returns to attract on its own.
        saveEntry(scene);
      } else {
        scene.pauseCard.setVisible(false);
        scene.resultCard.setVisible(false);
        scene.controlsCard.setVisible(false);
        scene.boardCard.setVisible(false);
        abandonMatch(scene);
      }
      clearEdges();
      return;
    }
  }

  // The match simulation keeps running behind the attract/menu overlays.
  if (phase === 'attract' || phase === 'controls' || phase === 'board') {
    stepMatch(scene, dt, time, true);
  } else if (phase === 'playing' || phase === 'sudden') {
    stepMatch(scene, dt, time, false);
  } else if (phase === 'countdown') {
    stepCountdown(scene, dt, time);
  } else if (phase !== 'paused') {
    // Result and name entry: tejos already in the air still land, but the aiming
    // overlay has no owner on screen. Pause freezes everything, including flight —
    // otherwise a tejo detonates and scores behind the PAUSA card.
    stepTejos(scene, dt, time);
    scene.aimLayer.clear();
  }

  if (phase === 'attract') handleMenu(scene, time, dt);
  else if (phase === 'controls') handleCard(scene, () => hideCard(scene, scene.controlsCard));
  else if (phase === 'board') handleCard(scene, () => hideCard(scene, scene.boardCard));
  else if (phase === 'playing' || phase === 'sudden') handleMatchInput(scene, time);
  else if (phase === 'paused') handlePause(scene);
  else if (phase === 'result') handleResult(scene, time);
  else if (phase === 'name') handleNameEntry(scene, time);

  updateHud(scene);
  clearEdges();
}

// --- Scenery --------------------------------------------------------------

function buildBackdrop(scene) {
  scene.add.rectangle(W / 2, H / 2, W, H, COL.backdrop);

  // A warm pool of light over the court, the way a tejo cancha is lit at night.
  const glow = scene.add.graphics();
  for (let i = 8; i >= 1; i--) {
    glow.fillStyle(0x2a1a08, 0.045);
    glow.fillEllipse(400, 260, 260 + i * 66, 200 + i * 46);
  }

  scene.add.rectangle(W / 2, H / 2, W, H, COL.night, 0.28);

  // Banderines — Colombian flag bunting strung above the court.
  const flagCols = [COL.gold, COL.blue, COL.red];
  for (let i = 0; i < 17; i++) {
    const x = 24 + i * 47;
    const y = 8 + Math.sin(i * 0.9) * 4;
    scene.add
      .triangle(x, y, 0, 0, 26, 0, 13, 22, flagCols[i % 3])
      .setAlpha(0.5)
      .setDepth(-1);
  }

  // Spectators packed along both touchlines, plus the obligatory crate of beer.
  buildCrowd(scene);
  buildCrate(scene);

  scene.add
    .text(400, H - 13, 'PLATANUS HACK 26  ·  BOGOTA  ·  CANCHA DE TEJO', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: CSS.dim,
    })
    .setOrigin(0.5)
    .setDepth(2);
}

function buildCrowd(scene) {
  scene.crowd = [];
  const cols = [0x1c2415, 0x232c18, 0x161d10];
  for (let i = 0; i < 22; i++) {
    const left = i % 2 === 0;
    const idx = Math.floor(i / 2);
    const x = left ? 24 + (idx % 3) * 42 : W - 24 - (idx % 3) * 42;
    const y = 120 + idx * 42 + (i % 2) * 16;
    if (y > 470) continue;
    const g = scene.add.container(x, y);
    const body = scene.add.ellipse(0, 14, 30, 34, cols[i % 3]);
    const head = scene.add.circle(0, -8, 11, cols[(i + 1) % 3]);
    g.add([body, head]);
    g.setDepth(0);
    g.setAlpha(0.9);
    scene.crowd.push(g);
  }
}

function buildCrate(scene) {
  const c = scene.add.container(400, 546);
  c.add(scene.add.rectangle(0, 6, 96, 44, 0x3a2a12).setStrokeStyle(2, 0x60451e));
  for (let i = 0; i < 6; i++) {
    const bx = -36 + (i % 3) * 36;
    const by = i < 3 ? -4 : 16;
    c.add(scene.add.rectangle(bx, by, 14, 20, 0x6b3f12));
    c.add(scene.add.rectangle(bx, by - 8, 8, 6, 0xd8b45a));
  }
  c.setDepth(1);
}

function buildCourt(scene) {
  const cx = COURT.x + COURT.w / 2;
  const cy = COURT.y + COURT.h / 2;

  // Wooden cajón around the clay.
  scene.add
    .rectangle(cx, cy, COURT.w + 26, COURT.h + 26, COL.frame)
    .setStrokeStyle(3, COL.frameLip);

  const clay = scene.add.graphics();
  clay.fillStyle(COL.clay, 1);
  clay.fillRect(COURT.x, COURT.y, COURT.w, COURT.h);

  // Clay speckle. Deterministic-ish scatter so the surface reads as packed earth
  // rather than a flat fill, drawn once into a single Graphics object.
  for (let i = 0; i < 240; i++) {
    const x = COURT.x + pseudo(i * 3.1) * COURT.w;
    const y = COURT.y + pseudo(i * 7.7 + 1.3) * COURT.h;
    const r = 1 + pseudo(i * 2.3) * 3.4;
    clay.fillStyle(i % 3 === 0 ? COL.clayLight : COL.clayDark, 0.22);
    clay.fillCircle(x, y, r);
  }

  // Damp ring worked into the clay around the bocín.
  clay.lineStyle(2, COL.clayDark, 0.5);
  clay.strokeCircle(BOCIN.x, BOCIN.y, 96);
  clay.lineStyle(1, COL.clayLight, 0.28);
  clay.strokeCircle(BOCIN.x, BOCIN.y, 132);

  scene.marksLayer = scene.add.graphics();
  scene.marksLayer.setDepth(3);

  // Bocín: sunken hole, steel ring, highlight.
  const b = scene.add.graphics();
  b.setDepth(4);
  b.fillStyle(COL.hole, 1);
  b.fillCircle(BOCIN.x, BOCIN.y, BOCIN.hole);
  b.lineStyle(9, COL.metalDark, 1);
  b.strokeCircle(BOCIN.x, BOCIN.y, BOCIN.ring);
  b.lineStyle(4, COL.metal, 1);
  b.strokeCircle(BOCIN.x, BOCIN.y, BOCIN.ring - 2);
  b.lineStyle(2, COL.white, 0.4);
  b.beginPath();
  b.arc(BOCIN.x, BOCIN.y, BOCIN.ring - 2, deg(-150), deg(-40));
  b.strokePath();

  scene.mechaLayer = scene.add.container(0, 0);
  scene.mechaLayer.setDepth(5);

  scene.chalk = scene.add.graphics();
  scene.chalk.setDepth(1);
  scene.chalk.lineStyle(2, COL.white, 0.13);
  scene.chalk.strokeRect(COURT.x + 8, COURT.y + 8, COURT.w - 16, COURT.h - 16);
  scene.chalk.lineStyle(3, COL.white, 0.1);
  scene.chalk.lineBetween(150, 478, 650, 478);
  scene.add
    .text(664, 478, '19,5 m', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: CSS.dim,
    })
    .setOrigin(0.5)
    .setDepth(2);
}

function buildPlayfieldFx(scene) {
  scene.fxLayer = scene.add.container(0, 0);
  scene.fxLayer.setDepth(30);
  scene.tejoLayer = scene.add.container(0, 0);
  scene.tejoLayer.setDepth(20);
  scene.aimLayer = scene.add.graphics();
  scene.aimLayer.setDepth(25);

  scene.bigText = scene.add
    .text(400, 300, '', {
      fontFamily: 'monospace',
      fontSize: '58px',
      color: CSS.white,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8,
    })
    .setOrigin(0.5)
    .setDepth(40)
    .setAlpha(0);
}

function buildHud(scene) {
  scene.hud = {};
  scene.add.rectangle(W / 2, 40, W, 80, 0x000000, 0.55).setDepth(9);
  scene.add.rectangle(W / 2, 80, W, 2, COL.dim, 0.6).setDepth(9);

  scene.hud.p1Name = scene.add
    .text(24, 14, 'JUGADOR 1', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: CSS.p1,
      fontStyle: 'bold',
    })
    .setDepth(10);
  scene.hud.p1Score = scene.add
    .text(24, 30, '0', {
      fontFamily: 'monospace',
      fontSize: '38px',
      color: CSS.p1,
      fontStyle: 'bold',
    })
    .setDepth(10);
  scene.hud.p1Combo = scene.add
    .text(96, 44, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: CSS.gold,
      fontStyle: 'bold',
    })
    .setDepth(10);

  scene.hud.p2Name = scene.add
    .text(W - 24, 14, 'JUGADOR 2', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: CSS.p2,
      fontStyle: 'bold',
    })
    .setOrigin(1, 0)
    .setDepth(10);
  scene.hud.p2Score = scene.add
    .text(W - 24, 30, '0', {
      fontFamily: 'monospace',
      fontSize: '38px',
      color: CSS.p2,
      fontStyle: 'bold',
    })
    .setOrigin(1, 0)
    .setDepth(10);
  scene.hud.p2Combo = scene.add
    .text(W - 96, 44, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: CSS.gold,
      fontStyle: 'bold',
    })
    .setOrigin(1, 0)
    .setDepth(10);

  scene.hud.clock = scene.add
    .text(400, 20, '1:10', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: CSS.white,
      fontStyle: 'bold',
    })
    .setOrigin(0.5, 0)
    .setDepth(10);
  scene.hud.mode = scene.add
    .text(400, 58, 'MOÑONA', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: CSS.slate,
    })
    .setOrigin(0.5, 0)
    .setDepth(10);
}

function buildThrowers(scene) {
  scene.throwers = {
    p1: makeThrower(scene, 206, 508, COL.p1, 1),
    p2: makeThrower(scene, 594, 508, COL.p2, -1),
  };

  scene.add
    .text(206, 560, 'P1', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: CSS.p1,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setDepth(3);
  scene.add
    .text(594, 560, 'P2', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: CSS.p2,
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setDepth(3);
}

function makeThrower(scene, x, y, color, facing) {
  const c = scene.add.container(x, y);
  c.setDepth(6);
  const shadow = scene.add.ellipse(0, 30, 46, 14, 0x000000, 0.35);
  const legs = scene.add.rectangle(0, 16, 22, 22, 0x2c3320);
  const body = scene.add.ellipse(0, -2, 34, 40, color);
  const head = scene.add.circle(0, -30, 13, 0xe8c9a0);
  const cap = scene.add.rectangle(0, -38, 28, 9, color).setStrokeStyle(1, 0x000000, 0.3);
  const arm = scene.add.rectangle(facing * 18, -6, 10, 26, color).setOrigin(0.5, 0.1);
  const disc = scene.add.circle(facing * 22, 8, 7, COL.metal).setStrokeStyle(2, COL.metalDark);
  c.add([shadow, legs, body, head, cap, arm, disc]);
  return { container: c, arm, disc, facing, homeX: x, homeY: y };
}

// --- Overlay cards --------------------------------------------------------

function card(scene, w, h, y) {
  const c = scene.add.container(400, y || 300);
  c.setDepth(50);
  c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.72));
  c.add(
    scene.add
      .rectangle(0, 0, w, h, 0x0d1206, 0.97)
      .setStrokeStyle(3, COL.p1, 0.75),
  );
  c.setVisible(false);
  return c;
}

function buildTitle(scene) {
  const c = scene.add.container(400, 300);
  c.setDepth(50);
  // Deliberately thin scrim: the CPU duel running underneath is the advert, so
  // the clay, the crosshairs and the detonations have to read through it.
  c.add(scene.add.rectangle(0, 0, W, H, 0x000000, 0.3));
  c.add(scene.add.rectangle(0, -140, 620, 150, 0x0d1206, 0.72).setStrokeStyle(3, COL.p1, 0.85));
  c.add(scene.add.rectangle(0, 18, 470, 156, 0x0d1206, 0.66).setStrokeStyle(1, COL.p1, 0.35));

  const title = scene.add
    .text(0, -176, 'MOÑONA', {
      fontFamily: 'monospace',
      fontSize: '82px',
      color: CSS.p1,
      fontStyle: 'bold',
      stroke: '#1a2200',
      strokeThickness: 10,
    })
    .setOrigin(0.5);
  c.add(title);
  scene.tweens.add({
    targets: title,
    scaleX: 1.04,
    scaleY: 1.04,
    duration: 1400,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });

  c.add(
    scene.add
      .text(0, -122, 'D U E L O   D E   T E J O', {
        fontFamily: 'monospace',
        fontSize: '19px',
        color: CSS.white,
      })
      .setOrigin(0.5),
  );
  c.add(
    scene.add
      .text(0, -96, 'Rompe la mecha. Embocina el tejo. Gana la cancha.', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: CSS.slate,
      })
      .setOrigin(0.5),
  );

  scene.menuTexts = [];
  for (let i = 0; i < MENU_ITEMS.length; i++) {
    const t = scene.add
      .text(0, -34 + i * 34, MENU_ITEMS[i].label, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: CSS.slate,
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5);
    c.add(t);
    scene.menuTexts.push(t);
  }

  scene.menuHint = scene.add
    .text(0, 116, 'JOYSTICK PARA ELEGIR   ·   START O BOTON PARA ACEPTAR', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: CSS.gold,
    })
    .setOrigin(0.5);
  c.add(scene.menuHint);
  scene.tweens.add({
    targets: scene.menuHint,
    alpha: 0.25,
    duration: 700,
    yoyo: true,
    repeat: -1,
  });

  scene.titleBoard = scene.add
    .text(0, 148, '', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: CSS.metal,
      align: 'center',
      lineSpacing: 4,
    })
    .setOrigin(0.5);
  c.add(scene.titleBoard);

  c.setVisible(false);
  scene.titleCard = c;

  // Shown during the uncovered half of the attract cycle, so an idle cabinet
  // spends most of its time displaying actual gameplay rather than a menu.
  scene.attractPrompt = scene.add
    .text(400, 574, 'PULSA START PARA JUGAR', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: CSS.gold,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6,
    })
    .setOrigin(0.5)
    .setDepth(52)
    .setVisible(false);
  scene.tweens.add({
    targets: scene.attractPrompt,
    alpha: 0.2,
    duration: 620,
    yoyo: true,
    repeat: -1,
  });
}

function buildControlsCard(scene) {
  const c = card(scene, 660, 420);
  c.add(
    scene.add
      .text(0, -172, 'CONTROLES', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: CSS.p1,
        fontStyle: 'bold',
      })
      .setOrigin(0.5),
  );
  const body = [
    'JOYSTICK      mueve tu mira sobre la arcilla',
    'BOTON 1       manten para cargar, suelta para lanzar',
    '',
    'El medidor gira alrededor de tu mira. La franja',
    'verde es el punto justo: suelta ahi y el tejo cae',
    'exacto. El circulo punteado es tu dispersion.',
    'Si aguantas demasiado, el tiro sale QUEMADO.',
    '',
    'MANO ......... 1   el tejo muerde cerca del bocin',
    'MECHA ........ 3   revientas un paquete de polvora',
    'EMBOCINADA ... 6   el tejo entra limpio al bocin',
    'MOÑONA ....... 9   entra al bocin Y revienta mecha',
    '',
    'Tres aciertos seguidos activan multiplicador.',
    'START pausa el duelo.',
  ].join('\n');
  c.add(
    scene.add
      .text(0, -6, body, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: CSS.white,
        align: 'left',
        lineSpacing: 3,
      })
      .setOrigin(0.5),
  );
  c.add(
    scene.add
      .text(0, 178, 'PULSA CUALQUIER BOTON PARA VOLVER', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: CSS.gold,
      })
      .setOrigin(0.5),
  );
  scene.controlsCard = c;
}

function buildBoardCard(scene) {
  const c = card(scene, 560, 400);
  c.add(
    scene.add
      .text(0, -160, 'MEJORES TEJOS', {
        fontFamily: 'monospace',
        fontSize: '30px',
        color: CSS.p1,
        fontStyle: 'bold',
      })
      .setOrigin(0.5),
  );
  scene.boardText = scene.add
    .text(0, -10, '', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: CSS.white,
      align: 'center',
      lineSpacing: 8,
    })
    .setOrigin(0.5);
  c.add(scene.boardText);
  c.add(
    scene.add
      .text(0, 168, 'PULSA CUALQUIER BOTON PARA VOLVER', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: CSS.gold,
      })
      .setOrigin(0.5),
  );
  scene.boardCard = c;
}

function buildResultCard(scene) {
  const c = card(scene, 620, 300);
  scene.resultTitle = scene.add
    .text(0, -84, '', {
      fontFamily: 'monospace',
      fontSize: '52px',
      color: CSS.p1,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 7,
    })
    .setOrigin(0.5);
  scene.resultLine = scene.add
    .text(0, -10, '', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: CSS.white,
      align: 'center',
      lineSpacing: 8,
    })
    .setOrigin(0.5);
  scene.resultNote = scene.add
    .text(0, 84, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: CSS.gold,
      align: 'center',
    })
    .setOrigin(0.5);
  c.add([scene.resultTitle, scene.resultLine, scene.resultNote]);
  scene.resultCard = c;
}

function buildNameCard(scene) {
  const c = card(scene, 600, 420);
  c.add(
    scene.add
      .text(0, -176, 'ENTRASTE AL TABLERO', {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: CSS.p1,
        fontStyle: 'bold',
      })
      .setOrigin(0.5),
  );
  scene.nameScore = scene.add
    .text(0, -142, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: CSS.slate,
    })
    .setOrigin(0.5);
  scene.nameValue = scene.add
    .text(0, -96, '___', {
      fontFamily: 'monospace',
      fontSize: '54px',
      color: CSS.gold,
      fontStyle: 'bold',
      letterSpacing: 10,
    })
    .setOrigin(0.5);
  c.add([scene.nameScore, scene.nameValue]);

  scene.letterCells = [];
  const startY = -32;
  for (let r = 0; r < LETTER_GRID.length; r++) {
    const row = LETTER_GRID[r];
    const spacing = r === LETTER_GRID.length - 1 ? 120 : 62;
    const totalW = (row.length - 1) * spacing;
    for (let q = 0; q < row.length; q++) {
      const t = scene.add
        .text(-totalW / 2 + q * spacing, startY + r * 44, row[q], {
          fontFamily: 'monospace',
          fontSize: '26px',
          color: CSS.slate,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);
      c.add(t);
      scene.letterCells.push({ row: r, col: q, text: t });
    }
  }

  c.add(
    scene.add
      .text(0, 178, 'JOYSTICK MUEVE   ·   BOTON CONFIRMA', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: CSS.gold,
      })
      .setOrigin(0.5),
  );
  scene.nameCard = c;
}

function buildPauseCard(scene) {
  const c = card(scene, 420, 190);
  c.add(
    scene.add
      .text(0, -34, 'PAUSA', {
        fontFamily: 'monospace',
        fontSize: '44px',
        color: CSS.p1,
        fontStyle: 'bold',
      })
      .setOrigin(0.5),
  );
  c.add(
    scene.add
      .text(0, 24, 'START CONTINUA   ·   BOTON 6 SALE', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: CSS.white,
      })
      .setOrigin(0.5),
  );
  scene.pauseCard = c;
}

// --- Match ----------------------------------------------------------------

function startMatch(scene, mode) {
  const m = {
    mode,
    demo: mode === 'demo',
    timeLeft: mode === 'demo' ? ROUND_MS : ROUND_MS,
    sudden: false,
    mechas: [],
    tejos: [],
    marks: [],
    over: false,
  };

  m.p1 = makePlayer(scene, 'p1', COL.p1, mode === 'demo' ? 0.62 : false);
  m.p2 = makePlayer(
    scene,
    'p2',
    COL.p2,
    mode === 'demo' ? 0.58 : mode === 'p1cpu' ? 0.5 : false,
  );

  scene.mechaLayer.removeAll(true);
  scene.tejoLayer.removeAll(true);
  scene.marksLayer.clear();
  scene.aimLayer.clear();
  for (let i = 0; i < MECHA_SLOTS; i++) m.mechas.push(makeMecha(scene, i));
  for (let i = 0; i < MECHA_MAX_ALIVE; i++) reviveMecha(scene, m, 0);

  scene.match = m;
  scene.hud.mode.setText(
    mode === 'demo' ? 'DEMO  —  PULSA START' : mode === 'p1cpu' ? 'P1 VS CPU' : 'DUELO A DOS',
  );
  scene.hud.p2Name.setText(mode === 'p1cpu' ? 'CPU' : 'JUGADOR 2');
  scene.hud.p1Name.setText(mode === 'demo' ? 'CPU' : 'JUGADOR 1');
  return m;
}

function makePlayer(scene, key, color, cpuSkill) {
  return {
    key,
    color,
    cpu: cpuSkill !== false,
    skill: cpuSkill || 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    throws: 0,
    monona: 0,
    aimX: key === 'p1' ? 330 : 470,
    aimY: 250,
    charging: false,
    sweep: 0,
    cooldown: 0,
    plan: null,
    lastMark: 0,
  };
}

function makeMecha(scene, slot) {
  const angle = (slot / MECHA_SLOTS) * Math.PI * 2 - Math.PI / 2;
  const x = BOCIN.x + Math.cos(angle) * BOCIN.ring;
  const y = BOCIN.y + Math.sin(angle) * BOCIN.ring;
  const c = scene.add.container(x, y);
  // A halo behind the packet so it never disappears into the clay.
  const halo = scene.add.circle(0, 0, 15, COL.red, 0.16);
  const paper = scene.add.triangle(0, 0, 0, 13, 14, -10, -14, -10, 0xfff4dc);
  paper.setStrokeStyle(2, 0x8a6a3a);
  const fuse = scene.add.circle(0, -11, 3.4, COL.red);
  c.add([halo, paper, fuse]);
  c.setVisible(false);
  scene.mechaLayer.add(c);
  return { slot, x, y, alive: false, respawnAt: 0, node: c, fuse };
}

function reviveMecha(scene, m, now) {
  const dead = m.mechas.filter((k) => !k.alive);
  if (!dead.length) return;
  const alive = m.mechas.filter((k) => k.alive).length;
  if (alive >= MECHA_MAX_ALIVE) return;
  const pick = dead[Math.floor(Math.random() * dead.length)];
  pick.alive = true;
  pick.respawnAt = 0;
  pick.node.setVisible(true);
  pick.node.setScale(0);
  pick.node.setAngle(Math.random() * 40 - 20);
  scene.tweens.add({
    targets: pick.node,
    scaleX: 1,
    scaleY: 1,
    duration: 260,
    ease: 'Back.easeOut',
  });
}

function stepMatch(scene, dt, time, isDemo) {
  const m = scene.match;
  if (!m) return;

  if (!m.over) {
    m.timeLeft -= dt;
    if (m.timeLeft <= 0) {
      m.timeLeft = 0;
      if (isDemo) {
        // The attract loop never ends — it just starts a fresh duel.
        startMatch(scene, 'demo');
        return;
      }
      finishRound(scene, time);
      return;
    }
  }

  stepPlayer(scene, m, m.p1, dt, time);
  stepPlayer(scene, m, m.p2, dt, time);
  stepMechas(scene, m, dt, time);
  stepTejos(scene, dt, time);
  drawAim(scene, m, time);

  if (m.sudden && (m.p1.score !== m.p2.score)) finishRound(scene, time);
}

function stepMechas(scene, m, dt, time) {
  let alive = 0;
  for (const k of m.mechas) {
    if (k.alive) {
      alive++;
      k.fuse.setAlpha(0.5 + 0.5 * Math.sin(time * 0.012 + k.slot));
    } else if (k.respawnAt && time >= k.respawnAt) {
      k.respawnAt = 0;
    }
  }
  if (alive < MECHA_MAX_ALIVE) {
    m.respawnTimer = (m.respawnTimer || 0) + dt;
    if (m.respawnTimer >= MECHA_RESPAWN_MS) {
      m.respawnTimer = 0;
      reviveMecha(scene, m, time);
    }
  }
}

function stepPlayer(scene, m, p, dt, time) {
  if (p.cooldown > 0) p.cooldown -= dt;

  if (p.cpu) {
    stepCpu(scene, m, p, dt, time);
  } else {
    const up = p.key === 'p1' ? 'P1_U' : 'P2_U';
    const dn = p.key === 'p1' ? 'P1_D' : 'P2_D';
    const lf = p.key === 'p1' ? 'P1_L' : 'P2_L';
    const rt = p.key === 'p1' ? 'P1_R' : 'P2_R';
    const speed = (p.charging ? AIM_SPEED_CHARGING : AIM_SPEED) * (dt / 1000);
    if (held[lf]) p.aimX -= speed;
    if (held[rt]) p.aimX += speed;
    if (held[up]) p.aimY -= speed;
    if (held[dn]) p.aimY += speed;
  }

  p.aimX = clamp(p.aimX, AIM_MIN_X, AIM_MAX_X);
  p.aimY = clamp(p.aimY, AIM_MIN_Y, AIM_MAX_Y);

  if (p.charging) {
    p.sweep += (dt / SWEEP_MS) * 2;
    if (p.sweep >= BURN_SWEEPS * 2) {
      // Held too long — the throw goes wild. In tejo slang, quemado.
      releaseThrow(scene, m, p, time, true);
    }
  }
}

function sweepValue(sweep) {
  const s = sweep % 2;
  return s <= 1 ? s : 2 - s;
}

function scatterFor(value) {
  if (value >= SWEET_LO && value <= SWEET_HI) return 0;
  const err = value < SWEET_LO ? SWEET_LO - value : value - SWEET_HI;
  return Math.pow(Math.min(err / SWEET_LO, 1), 1.25) * SCATTER_MAX;
}

function beginCharge(scene, p) {
  if (p.charging || p.cooldown > 0) return;
  p.charging = true;
  p.sweep = 0;
  sfx(scene, 'charge');
}

function releaseThrow(scene, m, p, time, burned) {
  if (!p.charging) return;
  p.charging = false;
  const value = sweepValue(p.sweep);
  const scatter = burned ? SCATTER_MAX : scatterFor(value);
  const perfect = scatter === 0;

  const angle = Math.random() * Math.PI * 2;
  const radius = scatter * Math.sqrt(Math.random());
  const tx = clamp(p.aimX + Math.cos(angle) * radius, COURT.x + 6, COURT.x + COURT.w - 6);
  const ty = clamp(p.aimY + Math.sin(angle) * radius, COURT.y + 6, COURT.y + COURT.h - 6);

  p.cooldown = FLIGHT_MS + RECOVER_MS;
  p.throws++;
  // A CPU commits to one target and one release value per throw. Without this the
  // stale plan is reused and it fires a burst of identical, perfectly-timed tejos.
  p.plan = null;
  spawnTejo(scene, m, p, tx, ty, time, perfect, burned);
  animateThrow(scene, p.key);
  sfx(scene, burned ? 'burn' : 'throw');
  if (perfect && !burned) popText(scene, '¡PERFECTO!', p.color, 22, 460);
}

function spawnTejo(scene, m, p, tx, ty, time, perfect, burned) {
  const home = scene.throwers[p.key];
  const shadow = scene.add.ellipse(home.homeX, home.homeY, 16, 7, 0x000000, 0.4);
  const disc = scene.add.circle(home.homeX, home.homeY - 12, 9, COL.metal);
  disc.setStrokeStyle(2.5, COL.metalDark);
  scene.tejoLayer.add([shadow, disc]);
  m.tejos.push({
    owner: p,
    fromX: home.homeX,
    fromY: home.homeY,
    toX: tx,
    toY: ty,
    t: 0,
    shadow,
    disc,
    perfect,
    burned,
  });
}

function stepTejos(scene, dt, time) {
  const m = scene.match;
  if (!m) return;
  for (let i = m.tejos.length - 1; i >= 0; i--) {
    const tj = m.tejos[i];
    tj.t += dt / FLIGHT_MS;
    if (tj.t >= 1) {
      tj.shadow.destroy();
      tj.disc.destroy();
      m.tejos.splice(i, 1);
      landTejo(scene, m, tj, time);
      continue;
    }
    const k = tj.t;
    const x = lerp(tj.fromX, tj.toX, k);
    const y = lerp(tj.fromY, tj.toY, k);
    const lift = Math.sin(k * Math.PI) * 92;
    tj.shadow.setPosition(x, y);
    tj.shadow.setScale(1 - Math.sin(k * Math.PI) * 0.35);
    tj.disc.setPosition(x, y - lift);
    tj.disc.setScale(1 + Math.sin(k * Math.PI) * 0.55);
    if (tj.burned) tj.disc.setAngle((tj.disc.angle || 0) + 14);
  }
}

function landTejo(scene, m, tj, time) {
  const p = tj.owner;
  const x = tj.toX;
  const y = tj.toY;
  const dist = Math.hypot(x - BOCIN.x, y - BOCIN.y);

  let mecha = null;
  for (const k of m.mechas) {
    if (!k.alive) continue;
    if (Math.hypot(x - k.x, y - k.y) <= MECHA_HIT_R) {
      mecha = k;
      break;
    }
  }

  const inBocin = dist <= BOCIN.hole;
  let base = 0;
  let label = '';
  let big = 34;

  if (mecha && inBocin) {
    base = 9;
    label = '¡MOÑONA!';
    big = 54;
    p.monona++;
  } else if (mecha) {
    base = 3;
    label = '¡MECHA!';
    big = 36;
  } else if (inBocin) {
    base = 6;
    label = '¡EMBOCINADA!';
    big = 36;
  } else if (dist <= BOCIN.ring + 14) {
    base = 1;
    label = 'MANO';
    big = 24;
  }

  addMark(scene, m, x, y, p.color);
  dust(scene, x, y);

  if (mecha) {
    mecha.alive = false;
    mecha.node.setVisible(false);
    explode(scene, mecha.x, mecha.y, base >= 9);
  } else {
    sfx(scene, inBocin ? 'clang' : 'thud');
  }

  if (base > 0) {
    p.combo++;
    p.hits++;
    if (p.combo > p.bestCombo) p.bestCombo = p.combo;
  } else {
    p.combo = 0;
  }

  const mult = comboMult(p.combo);
  const points = base * mult;
  p.score += points;

  if (base > 0) {
    popText(scene, label, p.color, big, base >= 6 ? 420 : 300);
    floatScore(scene, x, y, points, p.color);
    if (mult > 1) {
      popSub(scene, 'x' + mult + '  ¡EN RACHA!', p.color);
    }
    if (base >= 9) {
      cheer(scene);
      shake(scene, 420, 0.016);
    } else if (base >= 6) {
      shake(scene, 240, 0.009);
    }
  }
}

// Drop every tejo still in the air without resolving it.
function flushTejos(m) {
  for (const tj of m.tejos) {
    tj.shadow.destroy();
    tj.disc.destroy();
  }
  m.tejos.length = 0;
}

function comboMult(combo) {
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

function addMark(scene, m, x, y, color) {
  m.marks.push({ x, y, color, born: 0, life: 2600 });
  if (m.marks.length > 22) m.marks.shift();
  redrawMarks(scene, m);
}

function redrawMarks(scene, m) {
  const g = scene.marksLayer;
  g.clear();
  for (const mk of m.marks) {
    g.fillStyle(0x2a1408, 0.5);
    g.fillCircle(mk.x, mk.y, 10);
    g.lineStyle(2, mk.color, 0.5);
    g.strokeCircle(mk.x, mk.y, 8);
  }
}

// --- Aiming overlay -------------------------------------------------------

function drawAim(scene, m, time) {
  const g = scene.aimLayer;
  g.clear();
  drawOneAim(scene, g, m.p1, time);
  drawOneAim(scene, g, m.p2, time);
}

function drawOneAim(scene, g, p, time) {
  const x = p.aimX;
  const y = p.aimY;
  const ready = p.cooldown <= 0;

  // Crosshair. Dimmed while the thrower is still recovering.
  const a = ready ? 1 : 0.32;
  g.lineStyle(2, p.color, a);
  g.lineBetween(x - 15, y, x - 5, y);
  g.lineBetween(x + 5, y, x + 15, y);
  g.lineBetween(x, y - 15, x, y - 5);
  g.lineBetween(x, y + 5, x, y + 15);
  g.strokeCircle(x, y, 4);

  if (!p.charging) {
    if (ready) {
      const pulse = 20 + Math.sin(time * 0.006) * 2;
      g.lineStyle(1, p.color, 0.3);
      g.strokeCircle(x, y, pulse);
    }
    return;
  }

  const value = sweepValue(p.sweep);
  const scatter = scatterFor(value);
  const R = 27;

  // Gauge track.
  g.lineStyle(4, 0x000000, 0.5);
  g.strokeCircle(x, y, R);
  g.lineStyle(2, COL.dim, 0.85);
  g.strokeCircle(x, y, R);

  // The sweet spot, drawn as a bright arc on the track.
  g.lineStyle(5, scatter === 0 ? COL.white : 0x6cff3d, scatter === 0 ? 1 : 0.95);
  g.beginPath();
  g.arc(x, y, R, gaugeAngle(SWEET_LO), gaugeAngle(SWEET_HI));
  g.strokePath();

  // Filled progress up to the marker.
  g.lineStyle(3, p.color, 0.9);
  g.beginPath();
  g.arc(x, y, R, gaugeAngle(0), gaugeAngle(Math.max(value, 0.001)));
  g.strokePath();

  // Marker head.
  const ma = gaugeAngle(value);
  const mx = x + Math.cos(ma) * R;
  const my = y + Math.sin(ma) * R;
  g.fillStyle(scatter === 0 ? COL.white : p.color, 1);
  g.fillCircle(mx, my, 5);

  // Scatter ring — the whole mechanic, made visible. It shrinks to nothing
  // exactly when the marker enters the sweet spot.
  if (scatter > 0.5) {
    g.lineStyle(1.5, p.color, 0.5);
    g.strokeCircle(x, y, scatter);
  } else {
    const flare = 8 + Math.sin(time * 0.03) * 3;
    g.lineStyle(2.5, COL.white, 0.95);
    g.strokeCircle(x, y, flare);
  }

  // Burn warning on the second sweep.
  if (p.sweep > (BURN_SWEEPS * 2) - 0.5) {
    g.lineStyle(3, COL.red, 0.8);
    g.strokeCircle(x, y, R + 7);
  }
}

function gaugeAngle(value) {
  return -Math.PI / 2 + value * Math.PI * 2;
}

// --- CPU ------------------------------------------------------------------

function stepCpu(scene, m, p, dt, time) {
  if (!p.plan || time > p.plan.expires) p.plan = cpuPlan(scene, m, p, time);
  const plan = p.plan;

  const speed = (p.charging ? AIM_SPEED_CHARGING : AIM_SPEED) * (dt / 1000) * (0.7 + p.skill * 0.5);
  const dx = plan.x - p.aimX;
  const dy = plan.y - p.aimY;
  const d = Math.hypot(dx, dy);
  if (d > 2) {
    p.aimX += (dx / d) * Math.min(speed, d);
    p.aimY += (dy / d) * Math.min(speed, d);
  }

  if (!p.charging) {
    if (d < 14 && p.cooldown <= 0 && time > (plan.readyAt || 0)) beginCharge(scene, p);
    return;
  }

  // The plan already decided whether this throw is a hit or a visible miss, so
  // the CPU simply releases at the value it committed to.
  const value = sweepValue(p.sweep);
  if (p.sweep > 1) {
    // Overshot the top of the sweep — bail out on the way back down.
    if (value <= SWEET_HI) releaseThrow(scene, m, p, time, false);
    return;
  }
  if (value >= plan.releaseAt) releaseThrow(scene, m, p, time, false);
}

// Rubber band: a CPU that is behind bears down, a CPU that is far ahead eases
// off. A first-timer at the cabinet should lose close, not get buried.
function cpuSkill(m, p) {
  const opp = p.key === 'p1' ? m.p2 : m.p1;
  const swing = clamp((opp.score - p.score) / 220, -0.16, 0.2);
  return clamp(p.skill + swing, 0.16, 0.9);
}

function cpuPlan(scene, m, p, time) {
  const skill = cpuSkill(m, p);
  const live = m.mechas.filter((k) => k.alive);
  let x = BOCIN.x;
  let y = BOCIN.y;
  if (live.length && Math.random() < 0.45 + skill * 0.3) {
    const pick = live[Math.floor(Math.random() * live.length)];
    x = pick.x;
    y = pick.y;
  }

  // Aim wander, and — the part that actually decides difficulty — whether this
  // throw commits to the sweet spot at all.
  const err = (1 - skill) * 78;
  const lands = Math.random() < skill;
  const releaseAt = lands
    ? SWEET_LO + (SWEET_HI - SWEET_LO) * (0.15 + Math.random() * 0.7)
    : rand(0.12, SWEET_LO - 0.24);

  return {
    x: clamp(x + rand(-err, err), AIM_MIN_X, AIM_MAX_X),
    y: clamp(y + rand(-err, err), AIM_MIN_Y, AIM_MAX_Y),
    releaseAt,
    readyAt: time + rand(430, 1250) * (1.6 - skill),
    expires: time + 4200,
  };
}

// --- Input during a match -------------------------------------------------

function handleMatchInput(scene, time) {
  const m = scene.match;
  // The round can end on the same frame a button is read; never act on a dead match.
  if (!m || m.over) return;

  for (const key of ['p1', 'p2']) {
    const p = m[key];
    if (p.cpu) continue;
    const btns = THROW_BTNS[key];
    if (!p.charging && p.cooldown <= 0 && pressedAny(btns)) {
      beginCharge(scene, p);
    } else if (p.charging && !heldAny(btns)) {
      releaseThrow(scene, m, p, time, false);
    } else if (p.charging) {
      pressedAny(btns);
    }
  }

  if (pressed('START1') || pressed('START2')) pauseMatch(scene);
}

function pauseMatch(scene) {
  scene.st.phase = 'paused';
  scene.pauseCard.setVisible(true);
  sfx(scene, 'menu');
}

function handlePause(scene) {
  if (pressed('START1') || pressed('START2')) {
    scene.pauseCard.setVisible(false);
    scene.st.phase = scene.match.sudden ? 'sudden' : 'playing';
    sfx(scene, 'menu');
    return;
  }
  if (pressed('P1_6') || pressed('P2_6')) {
    scene.pauseCard.setVisible(false);
    abandonMatch(scene);
  }
}

function abandonMatch(scene) {
  startMatch(scene, 'demo');
  showTitle(scene);
  sfx(scene, 'menu');
}

// --- Round flow -----------------------------------------------------------

function beginCountdown(scene, mode) {
  startMatch(scene, mode);
  scene.st.phase = 'countdown';
  scene.st.countdown = 3200;
  scene.st.lastBeep = 99;
  scene.titleCard.setVisible(false);
  scene.attractPrompt.setVisible(false);
  popText(scene, '3', COL.white, 90, 700, 268);
  startMusic(scene);
}

function stepCountdown(scene, dt, time) {
  const st = scene.st;
  st.countdown -= dt;
  stepTejos(scene, dt, time);
  drawAim(scene, scene.match, time);

  const secs = Math.ceil(st.countdown / 1000);
  if (secs < st.lastBeep) {
    st.lastBeep = secs;
    if (secs === 3 || secs === 2 || secs === 1) {
      popText(scene, String(secs), COL.white, 90, 700, 268);
      sfx(scene, 'beep');
    }
  }
  if (st.countdown <= 200 && st.countdown > 0 && !st.wentGo) {
    st.wentGo = true;
  }
  if (st.countdown <= 0) {
    st.wentGo = false;
    st.phase = 'playing';
    popText(scene, '¡TEJO!', COL.p1, 74, 620, 268);
    sfx(scene, 'go');
  }
}

function finishRound(scene, time) {
  const m = scene.match;
  if (m.over) return;

  if (m.p1.score === m.p2.score && !m.sudden) {
    m.sudden = true;
    m.timeLeft = SUDDEN_MS;
    flushTejos(m);
    scene.st.phase = 'sudden';
    popText(scene, 'MUERTE SUBITA', COL.red, 44, 1500, 268);
    scene.hud.mode.setText('MUERTE SUBITA — EL PRIMER PUNTO GANA');
    sfx(scene, 'go');
    return;
  }

  m.over = true;
  // Clear the sky before snapshotting the scoreboard. A tejo still in flight
  // would land during the result screen and keep incrementing the live score, so
  // the HUD and the result card would disagree — and in sudden death a throw that
  // left the hand first but lands second could crown the wrong player.
  flushTejos(m);
  stopMusic(scene);
  scene.st.phase = 'result';
  scene.st.resultUntil = time + 4200;

  const p1 = m.p1;
  const p2 = m.p2;
  const tie = p1.score === p2.score;
  const p1Wins = p1.score > p2.score;
  const winner = tie ? null : p1Wins ? p1 : p2;

  scene.resultTitle.setText(tie ? 'EMPATE' : p1Wins ? 'GANA P1' : m.mode === 'p1cpu' ? 'GANA CPU' : 'GANA P2');
  scene.resultTitle.setColor(tie ? CSS.white : p1Wins ? CSS.p1 : CSS.p2);
  scene.resultLine.setText(
    'P1  ' + p1.score + '        ' + (m.mode === 'p1cpu' ? 'CPU' : 'P2') + '  ' + p2.score,
  );

  const human = pickHumanEntry(scene, m);
  scene.st.pendingEntry = human;
  scene.resultNote.setText(
    human && qualifies(scene, human.score)
      ? 'PUNTAJE PARA EL TABLERO'
      : 'PULSA BOTON PARA VOLVER',
  );

  scene.resultCard.setVisible(true);
  if (winner) {
    cheer(scene);
    shake(scene, 300, 0.01);
  }
}

// The board tracks human scores only — a CPU cannot take a slot on it.
function pickHumanEntry(scene, m) {
  const cands = [];
  if (!m.p1.cpu) cands.push({ who: 'P1', score: m.p1.score, stats: m.p1, mode: m.mode });
  if (!m.p2.cpu) cands.push({ who: 'P2', score: m.p2.score, stats: m.p2, mode: m.mode });
  if (!cands.length) return null;
  cands.sort((a, b) => b.score - a.score);
  return cands[0].score > 0 ? cands[0] : null;
}

function qualifies(scene, score) {
  const list = scene.st.scores;
  if (score <= 0) return false;
  if (list.length < MAX_SCORES) return true;
  return score > list[list.length - 1].score;
}

function handleResult(scene, time) {
  const anyBtn = pressedAny(CONFIRM_BTNS);
  if (!anyBtn && time < scene.st.resultUntil) return;

  scene.resultCard.setVisible(false);
  const entry = scene.st.pendingEntry;
  if (entry && qualifies(scene, entry.score)) {
    openNameEntry(scene, entry);
  } else {
    abandonMatch(scene);
  }
}

// --- Name entry -----------------------------------------------------------

function openNameEntry(scene, entry) {
  scene.st.phase = 'name';
  scene.st.name = { letters: [], row: 0, col: 0, moveUntil: 0, okUntil: 0 };
  scene.nameScore.setText(
    entry.who + '  ·  ' + entry.score + ' PUNTOS  ·  MEJOR RACHA x' + comboMult(entry.stats.bestCombo),
  );
  scene.nameCard.setVisible(true);
  refreshName(scene);
  sfx(scene, 'go');
}

function handleNameEntry(scene, time) {
  const n = scene.st.name;
  let ax = 0;
  let ay = 0;
  if (held.P1_L || held.P2_L) ax -= 1;
  if (held.P1_R || held.P2_R) ax += 1;
  if (held.P1_U || held.P2_U) ay -= 1;
  if (held.P1_D || held.P2_D) ay += 1;

  if ((ax || ay) && time > n.moveUntil) {
    n.moveUntil = time + 160;
    moveLetter(scene, ax, ay);
    sfx(scene, 'menu');
  }

  if (time > n.okUntil && pressedAny(CONFIRM_BTNS)) {
    n.okUntil = time + 140;
    commitLetter(scene);
  }
}

function moveLetter(scene, ax, ay) {
  const n = scene.st.name;
  if (ay) {
    n.row = wrap(n.row + ay, LETTER_GRID.length);
    n.col = Math.min(n.col, LETTER_GRID[n.row].length - 1);
  }
  if (ax) n.col = wrap(n.col + ax, LETTER_GRID[n.row].length);
  refreshName(scene);
}

function commitLetter(scene) {
  const n = scene.st.name;
  const ch = LETTER_GRID[n.row][n.col];
  if (ch === 'DEL') {
    n.letters.pop();
  } else if (ch === 'FIN') {
    saveEntry(scene);
    return;
  } else if (n.letters.length < NAME_LEN) {
    n.letters.push(ch);
    if (n.letters.length === NAME_LEN) {
      saveEntry(scene);
      return;
    }
  }
  sfx(scene, 'menu');
  refreshName(scene);
}

function refreshName(scene) {
  const n = scene.st.name;
  const shown = n.letters.join('') + '_'.repeat(Math.max(0, NAME_LEN - n.letters.length));
  scene.nameValue.setText(shown.split('').join(' '));
  for (const cell of scene.letterCells) {
    const on = cell.row === n.row && cell.col === n.col;
    cell.text.setColor(on ? CSS.gold : CSS.slate);
    cell.text.setScale(on ? 1.25 : 1);
  }
}

function saveEntry(scene) {
  const entry = scene.st.pendingEntry;
  const name = (scene.st.name.letters.join('') || 'TEJ').slice(0, NAME_LEN);
  scene.nameCard.setVisible(false);
  if (entry) {
    const list = scene.st.scores.slice();
    list.push({
      name,
      score: entry.score,
      mode: entry.mode === 'p1cpu' ? 'CPU' : 'DUO',
      monona: entry.stats.monona,
    });
    list.sort((a, b) => b.score - a.score);
    scene.st.scores = list.slice(0, MAX_SCORES);
    saveScores(scene.st.scores).catch(() => {});
    refreshBoard(scene);
  }
  sfx(scene, 'clang');
  abandonMatch(scene);
}

// --- Menu -----------------------------------------------------------------

function showTitle(scene) {
  scene.st.phase = 'attract';
  scene.st.attractT = 0;
  setAttractShow(scene, true);
  refreshMenu(scene);
  refreshBoard(scene);
  stopMusic(scene);
}

function setAttractShow(scene, on) {
  scene.st.attractShow = on;
  scene.st.attractT = 0;
  scene.titleCard.setVisible(on);
  scene.attractPrompt.setVisible(!on);
}

function refreshMenu(scene) {
  for (let i = 0; i < scene.menuTexts.length; i++) {
    const on = i === scene.st.menuCursor;
    scene.menuTexts[i].setText((on ? '> ' : '  ') + MENU_ITEMS[i].label + (on ? ' <' : '  '));
    scene.menuTexts[i].setColor(on ? CSS.p1 : CSS.slate);
    scene.menuTexts[i].setScale(on ? 1.06 : 1);
  }
}

function handleMenu(scene, time, dt) {
  const st = scene.st;
  let ay = 0;
  if (held.P1_U || held.P2_U) ay -= 1;
  if (held.P1_D || held.P2_D) ay += 1;

  // Attract cycle: menu for a few seconds, then step aside and let the duel play
  // in the clear. Any input snaps the menu back and restarts the timer.
  const touched = ay !== 0 || anyCabinetHeld();
  st.attractT = touched ? 0 : (st.attractT || 0) + dt;
  if (touched && !st.attractShow) setAttractShow(scene, true);
  else if (st.attractShow && st.attractT > 5200) setAttractShow(scene, false);
  else if (!st.attractShow && st.attractT > 8200) setAttractShow(scene, true);

  if (!st.attractShow) {
    // First press while the menu is hidden only brings it back.
    if (pressedAny(CONFIRM_BTNS)) {
      setAttractShow(scene, true);
      sfx(scene, 'menu');
    }
    return;
  }

  if (ay && time > st.menuCooldown) {
    st.menuCooldown = time + 170;
    st.menuCursor = wrap(st.menuCursor + ay, MENU_ITEMS.length);
    refreshMenu(scene);
    sfx(scene, 'menu');
  }
  if (!ay) st.menuCooldown = 0;

  const confirm = pressedAny(CONFIRM_BTNS);
  if (!confirm) return;

  const item = MENU_ITEMS[st.menuCursor];
  sfx(scene, 'go');
  if (item.id === 'controls') {
    scene.attractPrompt.setVisible(false);
    scene.titleCard.setVisible(false);
    scene.controlsCard.setVisible(true);
    st.phase = 'controls';
  } else if (item.id === 'board') {
    scene.attractPrompt.setVisible(false);
    scene.titleCard.setVisible(false);
    scene.boardCard.setVisible(true);
    st.phase = 'board';
  } else {
    beginCountdown(scene, item.id);
  }
}

function handleCard(scene, close) {
  if (pressedAny(CONFIRM_BTNS)) {
    close();
    sfx(scene, 'menu');
  }
}

function hideCard(scene, c) {
  c.setVisible(false);
  showTitle(scene);
}

function refreshBoard(scene) {
  const list = scene.st.scores;
  if (!list || !list.length) {
    const empty = scene.st.saveNote || 'Sin puntajes todavia.';
    scene.boardText.setText(empty);
    scene.titleBoard.setText('');
    return;
  }
  const lines = list.map((e, i) => {
    const rank = String(i + 1);
    const name = (e.name || '???').padEnd(3, ' ');
    const score = String(e.score).padStart(3, ' ');
    return rank + '.  ' + name + '   ' + score + '   ' + (e.mode || '');
  });
  scene.boardText.setText(lines.join('\n'));
  scene.titleBoard.setText(
    'MEJOR: ' + list[0].name + '  ' + list[0].score + ' PTS',
  );
}

// --- HUD ------------------------------------------------------------------

function updateHud(scene) {
  const m = scene.match;
  if (!m) return;
  scene.hud.p1Score.setText(String(m.p1.score));
  scene.hud.p2Score.setText(String(m.p2.score));

  const m1 = comboMult(m.p1.combo);
  const m2 = comboMult(m.p2.combo);
  scene.hud.p1Combo.setText(m1 > 1 ? 'x' + m1 : '');
  scene.hud.p2Combo.setText(m2 > 1 ? 'x' + m2 : '');

  const secs = Math.ceil(m.timeLeft / 1000);
  const mm = Math.floor(secs / 60);
  const ss = secs % 60;
  scene.hud.clock.setText(mm + ':' + (ss < 10 ? '0' : '') + ss);
  scene.hud.clock.setColor(secs <= 10 && !m.over ? CSS.red : CSS.white);
}

// --- Effects --------------------------------------------------------------

// Callouts land in the dead band between the clay and the throwers, so a big
// "¡MOÑONA!" never hides the thing it is celebrating.
function popText(scene, text, color, size, life, y) {
  const t = scene.bigText;
  const top = y || 424;
  scene.tweens.killTweensOf(t);
  t.setText(text);
  t.setFontSize(size);
  t.setColor(hexCss(color));
  t.setAlpha(1);
  t.setScale(0.4);
  t.setPosition(400, top);
  scene.tweens.add({
    targets: t,
    scaleX: 1,
    scaleY: 1,
    duration: 190,
    ease: 'Back.easeOut',
  });
  scene.tweens.add({
    targets: t,
    alpha: 0,
    y: top - 26,
    delay: Math.max(0, life - 200),
    duration: 200,
  });
}

function popSub(scene, text, color) {
  const t = scene.add
    .text(400, 456, text, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: hexCss(color),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(41);
  scene.tweens.add({
    targets: t,
    y: 434,
    alpha: 0,
    duration: 900,
    onComplete: () => t.destroy(),
  });
}

function floatScore(scene, x, y, points, color) {
  const t = scene.add
    .text(x, y - 14, '+' + points, {
      fontFamily: 'monospace',
      fontSize: '26px',
      color: hexCss(color),
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(41);
  scene.tweens.add({
    targets: t,
    y: y - 62,
    alpha: 0,
    duration: 820,
    ease: 'Quad.easeOut',
    onComplete: () => t.destroy(),
  });
}

function explode(scene, x, y, huge) {
  sfx(scene, huge ? 'monona' : 'boom');

  const flash = scene.add.circle(x, y, 12, 0xffffff, 0.95).setDepth(35);
  scene.tweens.add({
    targets: flash,
    scaleX: huge ? 10 : 6.5,
    scaleY: huge ? 10 : 6.5,
    alpha: 0,
    duration: huge ? 460 : 330,
    onComplete: () => flash.destroy(),
  });

  const ring = scene.add.circle(x, y, 10, 0x000000, 0).setDepth(35);
  ring.setStrokeStyle(3, COL.gold, 0.9);
  scene.tweens.add({
    targets: ring,
    scaleX: huge ? 9 : 5.5,
    scaleY: huge ? 9 : 5.5,
    alpha: 0,
    duration: huge ? 560 : 400,
    onComplete: () => ring.destroy(),
  });

  const n = huge ? 26 : 15;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = rand(34, huge ? 150 : 96);
    const col = i % 3 === 0 ? COL.gold : i % 3 === 1 ? COL.red : COL.white;
    const spark = scene.add.circle(x, y, rand(2, 5), col).setDepth(36);
    scene.tweens.add({
      targets: spark,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: rand(340, 720),
      ease: 'Quad.easeOut',
      onComplete: () => spark.destroy(),
    });
  }

  // Smoke puffs linger after the flash.
  for (let i = 0; i < (huge ? 7 : 4); i++) {
    const puff = scene.add
      .circle(x + rand(-12, 12), y + rand(-12, 12), rand(7, 14), 0x6b6b5a, 0.5)
      .setDepth(34);
    scene.tweens.add({
      targets: puff,
      y: puff.y - rand(18, 40),
      scaleX: 2.2,
      scaleY: 2.2,
      alpha: 0,
      duration: rand(700, 1200),
      onComplete: () => puff.destroy(),
    });
  }

  shake(scene, huge ? 400 : 220, huge ? 0.014 : 0.007);
  bounceCrowd(scene, huge);
}

function dust(scene, x, y) {
  for (let i = 0; i < 6; i++) {
    const p = scene.add
      .circle(x, y, rand(2, 5), COL.clayLight, 0.7)
      .setDepth(33);
    scene.tweens.add({
      targets: p,
      x: x + rand(-30, 30),
      y: y + rand(-24, 10),
      alpha: 0,
      duration: rand(280, 520),
      onComplete: () => p.destroy(),
    });
  }
}

function bounceCrowd(scene, huge) {
  if (!scene.crowd) return;
  const n = huge ? scene.crowd.length : Math.floor(scene.crowd.length / 2);
  for (let i = 0; i < n; i++) {
    const g = scene.crowd[(i * 3) % scene.crowd.length];
    scene.tweens.killTweensOf(g);
    const baseY = g.getData('baseY') || g.y;
    g.setData('baseY', baseY);
    scene.tweens.add({
      targets: g,
      y: baseY - rand(8, 20),
      duration: rand(120, 220),
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => g.setY(baseY),
    });
  }
}

function animateThrow(scene, key) {
  const t = scene.throwers[key];
  if (!t) return;
  scene.tweens.killTweensOf(t.arm);
  t.arm.setAngle(0);
  scene.tweens.add({
    targets: t.arm,
    angle: t.facing * -95,
    duration: 110,
    yoyo: true,
    ease: 'Quad.easeOut',
  });
  t.disc.setVisible(false);
  scene.time.delayedCall(FLIGHT_MS + 120, () => t.disc.setVisible(true));
  scene.tweens.add({
    targets: t.container,
    scaleY: 0.9,
    duration: 90,
    yoyo: true,
  });
}

function shake(scene, duration, intensity) {
  scene.cameras.main.shake(duration, intensity);
}

// --- Audio ----------------------------------------------------------------

function initAudio(scene) {
  scene.audio = { ctx: null, music: null, step: 0, gain: null, ready: false };
  try {
    const ctx = scene.sound && scene.sound.context;
    if (!ctx) return;
    scene.audio.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    scene.audio.gain = master;
    scene.audio.ready = true;
  } catch (err) {
    scene.audio.ready = false;
  }
}

// A suspended AudioContext does not advance currentTime, so anything scheduled
// against it is stopped at a moment that never arrives — the node is never
// released. The attract duel fires several sounds a second forever, so returning
// a non-running context here leaks oscillators until the tab dies overnight.
// resume() is async: ask for it, but refuse to schedule until it has landed.
function actx(scene) {
  const a = scene.audio;
  if (!a || !a.ready || !a.ctx) return null;
  if (a.ctx.state !== 'running') {
    try {
      const p = a.ctx.resume();
      if (p && p.catch) p.catch(function () {});
    } catch (err) {
      return null;
    }
    return null;
  }
  return a.ctx;
}

function tone(scene, freq, dur, type, vol, slideTo) {
  const ctx = actx(scene);
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type || 'square';
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), ctx.currentTime + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(vol || 0.14, ctx.currentTime + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(g);
  g.connect(scene.audio.gain);
  osc.start();
  osc.stop(ctx.currentTime + dur + 0.02);
}

function noise(scene, dur, vol, freq, q) {
  const ctx = actx(scene);
  if (!ctx) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, Math.max(len, 1), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.6);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq || 1800, ctx.currentTime);
  filter.Q.value = q || 1;
  const g = ctx.createGain();
  g.gain.value = vol || 0.3;
  src.connect(filter);
  filter.connect(g);
  g.connect(scene.audio.gain);
  src.start();
}

function sfx(scene, kind) {
  if (!scene.audio || !scene.audio.ready) return;
  if (kind === 'menu') {
    tone(scene, 660, 0.06, 'square', 0.09);
  } else if (kind === 'go') {
    tone(scene, 520, 0.1, 'square', 0.12);
    scene.time.delayedCall(90, () => tone(scene, 780, 0.16, 'square', 0.12));
  } else if (kind === 'beep') {
    tone(scene, 440, 0.12, 'square', 0.12);
  } else if (kind === 'charge') {
    tone(scene, 300, 0.07, 'triangle', 0.07, 520);
  } else if (kind === 'throw') {
    noise(scene, 0.16, 0.16, 900, 3);
  } else if (kind === 'burn') {
    tone(scene, 260, 0.3, 'sawtooth', 0.1, 70);
  } else if (kind === 'thud') {
    tone(scene, 120, 0.14, 'sine', 0.16, 62);
    noise(scene, 0.1, 0.1, 500);
  } else if (kind === 'clang') {
    tone(scene, 1180, 0.32, 'square', 0.1, 900);
    tone(scene, 1760, 0.24, 'square', 0.06);
    noise(scene, 0.08, 0.08, 5200, 6);
  } else if (kind === 'boom') {
    noise(scene, 0.42, 0.42, 1300, 1);
    tone(scene, 130, 0.34, 'sine', 0.3, 40);
  } else if (kind === 'monona') {
    noise(scene, 0.6, 0.5, 1800, 1);
    tone(scene, 150, 0.5, 'sine', 0.34, 36);
    const notes = [523, 659, 784, 1046];
    for (let i = 0; i < notes.length; i++) {
      scene.time.delayedCall(90 + i * 85, () => tone(scene, notes[i], 0.22, 'square', 0.13));
    }
  }
}

function cheer(scene) {
  const ctx = actx(scene);
  if (!ctx) return;
  const dur = 0.9;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const k = i / len;
    const env = Math.sin(Math.PI * Math.pow(k, 0.6));
    data[i] = (Math.random() * 2 - 1) * env * 0.6;
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1100;
  filter.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0.3;
  src.connect(filter);
  filter.connect(g);
  g.connect(scene.audio.gain);
  src.start();
}

// A skeletal cumbia pulse: walking bass under an offbeat scraper. Enough to make
// the cabinet feel like a tejo bar without eating the byte budget.
const BASS_LINE = [55, 0, 82.4, 0, 55, 0, 73.4, 0, 49, 0, 73.4, 0, 55, 0, 82.4, 98];

function startMusic(scene) {
  if (!scene.audio || !scene.audio.ready || scene.audio.music) return;
  scene.audio.step = 0;
  scene.audio.music = scene.time.addEvent({
    delay: 132,
    loop: true,
    callback: () => musicStep(scene),
  });
}

function stopMusic(scene) {
  if (scene.audio && scene.audio.music) {
    scene.audio.music.remove();
    scene.audio.music = null;
  }
}

function musicStep(scene) {
  const a = scene.audio;
  if (!a) return;
  const s = a.step % 16;
  a.step++;
  const note = BASS_LINE[s];
  if (note) tone(scene, note, 0.2, 'triangle', 0.09);
  if (s % 2 === 1) noise(scene, 0.05, 0.045, 7000, 4);
  if (s === 4 || s === 12) noise(scene, 0.11, 0.09, 2400, 2);
}

// --- Storage --------------------------------------------------------------

function getStore() {
  if (window.platanusArcadeStorage) return window.platanusArcadeStorage;
  return {
    async get(key) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null
          ? { found: false, value: null }
          : { found: true, value: JSON.parse(raw) };
      } catch (err) {
        return { found: false, value: null };
      }
    },
    async set(key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        return;
      }
    },
  };
}

// Storage survives releases, so nothing read back is trusted without validation.
function isEntry(v) {
  return (
    v &&
    typeof v === 'object' &&
    typeof v.name === 'string' &&
    v.name.length > 0 &&
    v.name.length <= 4 &&
    typeof v.score === 'number' &&
    Number.isFinite(v.score) &&
    v.score >= 0 &&
    v.score < 100000
  );
}

async function loadScores() {
  const res = await getStore().get(STORE_KEY);
  if (!res || !res.found || !Array.isArray(res.value)) return [];
  return res.value
    .filter(isEntry)
    .map((v) => ({
      name: String(v.name).slice(0, 3).toUpperCase(),
      score: Math.floor(v.score),
      mode: typeof v.mode === 'string' ? v.mode.slice(0, 4) : '',
      monona: typeof v.monona === 'number' ? v.monona : 0,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SCORES);
}

async function saveScores(list) {
  return getStore().set(STORE_KEY, list);
}

// --- Small helpers --------------------------------------------------------

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function wrap(v, n) {
  return ((v % n) + n) % n;
}

function deg(d) {
  return (d * Math.PI) / 180;
}

// Cheap deterministic scatter for static scenery, so the clay looks the same
// every boot without shipping a table of coordinates.
function pseudo(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function hexCss(color) {
  return '#' + color.toString(16).padStart(6, '0');
}
