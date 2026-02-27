// =====================
// CONFIG
// =====================
const ASSET_PATH = "data/";

const FONT_FILE = "ABCMaxiRoundMono-Regular-Trial.otf";
const TXT_FILES = [
  "edilstrada_autostrada_testo2.txt",
  "edilstrada_cono_testo2.txt",
  "edilstrada_gru_testo_2.txt",
];

// Transition timing
const SPEED = 0.005;        // 0..1 per frame
const HOLD_SECONDS = 0.6;

// Fit + look  
const ZOOM = 1.0;  
const MIN_FONT_SIZE = 6;
const LINEH_MULT = 1.05;

// Randomness / dithering
const START_JITTER = 0.3;
const DUR_JITTER = 0.2;
const SOFT_W = 0.02;

// Overlap timing (per-character)
const HOLD_A = 0.05;
const G0_START = HOLD_A;
const G0_DUR = 0.12;
const G1_START = HOLD_A + 0.1;
const G1_DUR = 0.62;
const UNDERSCORE_PORTION = 0.65;

// =====================
// STATE
// =====================
let frames = [null, null, null];
let asciiFont = null;

let offsetX = 0;
let offsetY = 0;

let ready = false;
let loadErrors = [];

let current = 0;
let t = 0;

let fitted = false;
let fontSize = 10;
let lineH = 10;

let holding = false;
let holdStartMs = 0;
let transitionId = 0;

// Load bookkeeping
let loaded = 0;
const NEED = 4; // 3 txt + 1 font



// =====================
// P5 LIFECYCLE
// =====================
function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(window.devicePixelRatio || 1);
  textFont("monospace"); // safe fallback
  loadAssets();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitted = false;
}

function draw() {
  background(255);
  fill(0);

  if (!ready) {
    drawLoadingOrError();
    return;
  }

  if (!fitted) {
    fitToLargestFrame();
    fitted = true;
  }

  const next = (current + 1) % frames.length;
  const A = frames[current].join("\n");
  const B = frames[next].join("\n");

  const te = easeInOutCubic(t);
  const out = overlappedRandomStart(A, B, te);

  text(out, offsetX, offsetY);

  advanceTime(next);
}




// =====================
// LOADING
// =====================
function loadAssets() {
  loadFont(
    ASSET_PATH + FONT_FILE,
    (f) => { asciiFont = f; onLoaded(); },
    (err) => { loadErrors.push("FONT failed"); console.log(err); onLoaded(); }
  );

  TXT_FILES.forEach((file, i) => {
    loadStrings(
      ASSET_PATH + file,
      (lines) => { frames[i] = lines; onLoaded(); },
      (err) => { loadErrors.push(`TXT${i} failed`); console.log(err); onLoaded(); }
    );
  });
}

function onLoaded() {
  loaded++;

  if (loaded < NEED) return;

  if (asciiFont) textFont(asciiFont);

  if (!frames[0] || !frames[1] || !frames[2]) {
    ready = false; // keep showing error screen
    return;
  }

  normalizeAll();
  resetTransition();
  fitted = false;
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




// =====================
// TRANSITION CONTROL
// =====================
function advanceTime(nextIndex) {
  if (!holding) {
    t += SPEED;
    if (t >= 1) {
      t = 1;
      holding = true;
      holdStartMs = millis();
    }
    return;
  }

  if ((millis() - holdStartMs) / 1000 >= HOLD_SECONDS) {
    current = nextIndex;
    resetTransition();
  }
}

function resetTransition() {
  t = 0;
  holding = false;
  transitionId++;
}





// =====================
// ASCII MORPH
// =====================
function overlappedRandomStart(A, B, t01) {
  let out = "";
  const L = A.length;

  for (let i = 0; i < L; i++) {
    const a = A[i];
    const b = B[i];

    if (a === "\n" || b === "\n") { out += "\n"; continue; }
    if (a === b) { out += a; continue; }

    // Stage 0: '_' and '\'', Stage 1: everything else
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





// =====================
// FITTING (width-based, vertical crop OK)
// =====================
function fitToLargestFrame() {
  // Pick a "largest" frame so other frames won't suddenly exceed the fit
  let best = frames[0];
  let bestCols = 0;
  let bestRows = 0;

  for (const f of frames) {
    const rows = f.length;
    let cols = 0;
    for (let i = 0; i < rows; i++) cols = max(cols, f[i].length);

    // prioritize widest, then tallest
    if (cols > bestCols || (cols === bestCols && rows > bestRows)) {
      best = f;
      bestCols = cols;
      bestRows = rows;
    }
  }

  fitToCanvasWidth(best);
}

function fitToCanvasWidth(lines) {
  const rows = lines.length;

  // Find longest line (actual string, for accurate measuring)
  let longestLine = "";
  for (let i = 0; i < rows; i++) {
    if (lines[i].length > longestLine.length) longestLine = lines[i];
  }

  // Initial estimate based on character count
  fontSize = floor((width / max(1, longestLine.length)) * ZOOM);
  fontSize = max(fontSize, MIN_FONT_SIZE);

  textSize(fontSize);
  lineH = fontSize * LINEH_MULT;
  textLeading(lineH);

  // Precise correction using real rendered width
  const realWidth = max(1, textWidth(longestLine));
  const scaleFix = width / realWidth;

  fontSize = max(MIN_FONT_SIZE, fontSize * scaleFix);

  textSize(fontSize);
  lineH = fontSize * LINEH_MULT;
  textLeading(lineH);

  // No horizontal margin; vertically center (cropping allowed)
  const blockH = rows * lineH;
  offsetX = 0;
  offsetY = (height - blockH) * 0.5 + lineH;
}




// =====================
// NORMALIZATION
// =====================
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




// =====================
// MATH HELPERS
// =====================
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
