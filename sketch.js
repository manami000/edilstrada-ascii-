
const ASSET_DIR = "data/";

const FONT_FILE = "ABCMaxiRoundMono-Regular-Trial.otf";
const TXT_FILES = [
  "edilstrada_autostrada_testo2.txt",
  "edilstrada_cono_testo2.txt",
  "edilstrada_gru_testo_2.txt",
];

const FONT_SIZE = 6;
const LINEH_MULT = 1.05;

const SPEED = 0.005;       
const HOLD_SECONDS = 0.6;

// randomness / smoothing
const START_JITTER = 0.3;
const DUR_JITTER = 0.2;
const SOFT_W = 0.02;

// overlap timing
const HOLD_A = 0.05;
const G0_START = HOLD_A;
const G0_DUR = 0.12;
const G1_START = HOLD_A + 0.1;
const G1_DUR = 0.62;
const UNDERSCORE_PORTION = 0.65;

// --------------------
// STATE
// --------------------
let frames = [null, null, null];
let asciiFont = null;

let ready = false;
let loadErrors = [];
let loaded = 0;
const NEED = 4; // 3 txt + 1 font

let current = 0;
let t = 0;

let holding = false;
let holdStartMs = 0;
let transitionId = 0;

let lineH = FONT_SIZE * LINEH_MULT;

// --------------------

// --------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(window.devicePixelRatio || 1);

  // fallback font so we can render messages even if custom font fails
  textFont("monospace");
  applyTextMetrics();

  loadAssets();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

function draw() {
  background(255);
  fill(0);

  if (!ready) {
    drawLoadingOrError();
    return;
  }

  const next = (current + 1) % frames.length;
  const A = frames[current].join("\n");
  const B = frames[next].join("\n");

  const te = easeInOutCubic(t);
  const out = overlappedRandomStart(A, B, te);

  text(out, 0, lineH);

  // time/hold logic
  if (!holding) {
    t += SPEED;
    if (t >= 1) {
      t = 1;
      holding = true;
      holdStartMs = millis();
    }
  } else {
    if ((millis() - holdStartMs) / 1000 >= HOLD_SECONDS) {
      current = next;
      resetTransition();
    }
  }
}

// --------------------
// LOADING
// --------------------
function loadAssets() {
  loadFont(
    ASSET_DIR + FONT_FILE,
    (f) => { asciiFont = f; onLoaded(); },
    (err) => { loadErrors.push("FONT failed"); console.log(err); onLoaded(); }
  );

  TXT_FILES.forEach((file, i) => {
    loadStrings(
      ASSET_DIR + file,
      (lines) => { frames[i] = lines; onLoaded(); },
      (err) => { loadErrors.push(`TXT${i} failed`); console.log(err); onLoaded(); }
    );
  });
}

function onLoaded() {
  loaded++;

  if (loaded < NEED) return;

  if (!frames[0] || !frames[1] || !frames[2]) {
    ready = false;
    return;
  }

  // use custom font if loaded (optional)
  if (asciiFont) textFont(asciiFont);

  applyTextMetrics();
  normalizeAll();
  resetTransition();

  ready = true;
}

function drawLoadingOrError() {
  textSize(16);
  textLeading(20);

  let msg = "loading…";
  if (loaded >= NEED && loadErrors.length) {
    msg = "ASSET LOAD ERROR.\nCheck console + file names.\n\n" + loadErrors.join("\n");
  }
  text(msg, 20, 30);
}

function applyTextMetrics() {
  textSize(FONT_SIZE);
  lineH = FONT_SIZE * LINEH_MULT;
  textLeading(lineH);
}

// --------------------
// TRANSITION
// --------------------
function resetTransition() {
  t = 0;
  holding = false;
  transitionId++;
}

/**
 * Smooth random-start per character, with 2 overlapping groups:
 * Group0: '_' and '\''
 * Group1: everything else
 */
function overlappedRandomStart(A, B, t01) {
  let out = "";
  const L = A.length;

  for (let i = 0; i < L; i++) {
    const a = A[i];
    const b = B[i];

    if (a === "\n" || b === "\n") { out += "\n"; continue; }
    if (a === b) { out += a; continue; }

    const stage = (a === "_" || a === "'") ? 0 : 1;

    const baseStart = (stage === 0) ? G0_START : G1_START;
    const baseDur   = (stage === 0) ? G0_DUR   : G1_DUR;

    const startJ = rand01(transitionId, stage, i, 11) * START_JITTER * 0.8;
    const durJ   = (rand01(transitionId, stage, i, 22) - 0.5) * 2 * DUR_JITTER;

    const start = baseStart + startJ;
    const dur = max(0.08, baseDur + durJ);

    const s0 = start;
    const s1 = start + dur * UNDERSCORE_PORTION;

    let c = pickSoft(a, "_", t01, s0, SOFT_W, i, 0, stage);
    c = pickSoft(c, b, t01, s1, SOFT_W, i, 1, stage);

    out += c;
  }

  return out;
}

// --------------------
// HELPERS
// --------------------
function easeInOutCubic(x) {
  x = constrain(x, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - pow(-2 * x + 2, 3) / 2;
}

function smoothstep(edge0, edge1, x) {
  x = constrain((x - edge0) / (edge1 - edge0), 0, 1);
  return x * x * (3 - 2 * x);
}

function rand01(a, b, c, d) {
  return (hash32(a, b, c, d) % 10000) / 10000;
}

function pickSoft(fromC, toC, t01, edge, w, i, which, stage) {
  const p = smoothstep(edge - w, edge + w, t01);
  const r = rand01(transitionId, stage + 33, i + 1, which + 500);
  return r < p ? toC : fromC;
}

function hash32(a, b, c, d) {
  let h = 2166136261 >>> 0;
  h = (h ^ (a + 1)) * 16777619 >>> 0;
  h = (h ^ (b + 1)) * 16777619 >>> 0;
  h = (h ^ (c + 1)) * 16777619 >>> 0;
  h = (h ^ (d + 1)) * 16777619 >>> 0;
  h ^= h >>> 16; h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13; h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

function normalizeAll() {
  const refRows = frames[0].length;
  const refCols = Math.max(...frames[0].map(l => l.length));

  for (let k = 0; k < frames.length; k++) {
    frames[k] = frames[k].slice(0, refRows);
    while (frames[k].length < refRows) frames[k].push("");

    frames[k] = frames[k].map(line => {
      line = line.replace(/\r/g, "").replace(/\t/g, "    ");
      if (line.length > refCols) return line.slice(0, refCols);
      return line.padEnd(refCols, " ");
    });
  }
}
