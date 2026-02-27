let frames = [null, null, null];
let asciiFont = null;

let ready = false;
let loadErrors = [];

let current = 0;
let t = 0;

// speed of the whole transition (0..1 per frame)
let speed = 0.005;

// fit-to-canvas
let fitted = false;
let fontSize = 10;
let lineH = 10;

// hold on completed image (seconds)
const HOLD_SECONDS = 0.6;

// randomness
const START_JITTER = 0.3;
const DUR_JITTER   = 0.2;

// smoothness window for dithering
const SOFT_W = 0.02;

// transition state
let holding = false;
let holdStartMs = 0;
let transitionId = 0;

// load bookkeeping
let loaded = 0;
const NEED = 4; // 3 txt + 1 font

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("monospace"); // safe default so we always render
  loadAssets();
}

function loadAssets() {
  // FONT
  loadFont(
    "data/ABCMaxiRoundMono-Regular-Trial.otf",
    (f) => { asciiFont = f; onLoaded(); },
    (err) => { loadErrors.push("FONT failed"); console.log(err); onLoaded(); }
  );

  // TXT 0
  loadStrings(
    "data/edilstrada_autostrada_testo2.txt",
    (lines) => { frames[0] = lines; onLoaded(); },
    (err) => { loadErrors.push("TXT0 failed"); console.log(err); onLoaded(); }
  );

  // TXT 1
  loadStrings(
    "data/edilstrada_cono_testo2.txt",
    (lines) => { frames[1] = lines; onLoaded(); },
    (err) => { loadErrors.push("TXT1 failed"); console.log(err); onLoaded(); }
  );

  // TXT 2
  loadStrings(
    "data/edilstrada_gru_testo_2.txt",
    (lines) => { frames[2] = lines; onLoaded(); },
    (err) => { loadErrors.push("TXT2 failed"); console.log(err); onLoaded(); }
  );
}

function onLoaded() {
  loaded++;

  if (loaded >= NEED) {
    if (asciiFont) textFont(asciiFont); // use custom font if it loaded

    if (!frames[0] || !frames[1] || !frames[2]) {
      ready = false; // keep showing error screen
      return;
    }

    normalizeAll();
    resetTransition();
    fitted = false;
    ready = true;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  fitted = false;
}

function draw() {
  background(255);
  fill(0);

  if (!ready) {
    textSize(16);
    textLeading(20);

    let msg = "loading…";
    if (loaded >= NEED && loadErrors.length) {
      msg = "ASSET LOAD ERROR.\nCheck console + file names.\n\n" + loadErrors.join("\n");
    }
    text(msg, 20, 30);
    return;
  }

  if (!fitted) {
    fitToCanvas(frames[0]);
    fitted = true;
  }

  const next = (current + 1) % frames.length;
  const A = frames[current].join("\n");
  const B = frames[next].join("\n");

  const te = easeInOutCubic(t);
  const out = overlappedRandomStart(A, B, te);

  text(out, 0, lineH);

  if (!holding) {
    t += speed;
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
function overlappedRandomStart(A, B, t) {
  let out = "";
  const L = A.length;

  const holdA = 0.05;

  const g0Start = holdA;
  const g0Dur   = 0.12;

  const g1Start = holdA + 0.1;
  const g1Dur   = 0.62;

  const underscorePortion = 0.65;

  for (let i = 0; i < L; i++) {
    const a = A[i];
    const b = B[i];

    if (a === "\n" || b === "\n") { out += "\n"; continue; }
    if (a === b) { out += a; continue; }

    const stage = (a === "_" || a === "'") ? 0 : 1;

    const baseStart = (stage === 0) ? g0Start : g1Start;
    const baseDur   = (stage === 0) ? g0Dur   : g1Dur;

    const startJ = rand01(transitionId, stage, i, 11) * START_JITTER * 0.8;
    const durJ   = (rand01(transitionId, stage, i, 22) - 0.5) * 2 * DUR_JITTER;

    const start = baseStart + startJ;
    const dur   = max(0.08, baseDur + durJ);

    const s0 = start;
    const s1 = start + dur * underscorePortion;

    let c = pickSoft(a, "_", t, s0, SOFT_W, i, 0, stage);
    c = pickSoft(c, b, t, s1, SOFT_W, i, 1, stage);

    out += c;
  }

  return out;
}

/* helpers */

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

function pickSoft(fromC, toC, t, edge, w, i, which, stage) {
  const p = smoothstep(edge - w, edge + w, t);
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

function fitToCanvas(lines) {
  let rows = lines.length;
  let cols = 0;
  for (let i = 0; i < rows; i++) cols = max(cols, lines[i].length);

  const W = width;
  const H = height;

  fontSize = floor(min(W / cols, H / rows) * 1.1);
  fontSize = max(fontSize, 6);

  textSize(fontSize);
  lineH = fontSize * 1.05;
  textLeading(lineH);
}
