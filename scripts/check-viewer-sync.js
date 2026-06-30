#!/usr/bin/env node
// FilePath: scripts/check-viewer-sync.js

// Fails (exit 1) if `<keymap>-viewer.html` structurally drifts from `config/<keymap>.keymap`.
// Label-agnostic: never false-positives on styling diffs (RET vs ENTER, CMD vs LGUI, DISP vs EP TOG).
//
// Two modes depending on whether `keymap` (keymap-drawer) is on PATH:
//   ONLINE  — full diff: layer count, per-layer key count, BASE thumb hold-layer order, and HRM
//             positions all compared against the parsed keymap. Requires `keymap` on PATH.
//   OFFLINE — viewer-internal checks: viewer must have exactly the 7 expected layers, each with
//             exactly 36 keys; thumb order and HRM positions checked against EXPECTED constants
//             below (no external tool required). Update EXPECTED when the BASE layout changes.
//
// Invariants enforced (both modes unless noted):
//   1. Layer set: viewer has exactly EXPECTED.LAYER_NAMES layers.
//   2. Per-layer key count: each viewer layer === EXPECTED.KEYS_PER_LAYER (offline) or parsed count (online).
//   3. BASE thumb hold-layer order (lowercased) === viewer base thumb type:"layer" h-values.
//   4. BASE home-row-mod positions (idx 0-29) === viewer base idx with .h && type!=="layer".
//      Invariants 3-4: compared to parsed keymap (online) or EXPECTED constants (offline).

const fs = require("fs");
const { execSync } = require("child_process");

// ── Fixed expectations (update when the BASE thumb/HRM layout changes) ─────────
const EXPECTED = {
  LAYER_NAMES:    ["base", "nav", "num", "media", "sym", "fun", "mouse"],
  KEYS_PER_LAYER: 36,
  THUMB_ORDER:    ["media", "nav", "mouse", "sym", "num", "fun"],  // indices 30-35
  HRM_IDX:        [10, 11, 12, 13, 16, 17, 18, 19],               // 0-based, within 0-29
};

// ── Load viewer layers (new Function avoids assignment-into-scope eval) ─────────
const KM = process.argv[2] || "yuyudhan-1";
const html = fs.readFileSync(`${KM}-viewer.html`, "utf8");
const m = html.match(/const layers = \{[\s\S]*?\n\};/);
if (!m) { console.error(`FAIL: could not locate \`const layers\` in ${KM}-viewer.html`); process.exit(1); }
const layers = new Function("return (" + m[0].replace(/^const layers = /, "").replace(/;\s*$/, "") + ");")();

// ── Try to parse keymap (optional) ──────────────────────────────────────────────
let counts = null, holds = null;
try {
  const yamlText = execSync(`keymap parse -z config/${KM}.keymap`, { encoding: "utf8" });
  const lines = yamlText.split("\n");
  let inLayers = false, cur = null;
  counts = {}; holds = {};
  for (const line of lines) {
    if (/^layers:\s*$/.test(line)) { inLayers = true; continue; }
    if (inLayers && /^\S/.test(line) && !/^layers:/.test(line)) inLayers = false;
    if (!inLayers) continue;
    let mm;
    if ((mm = line.match(/^  ([A-Z]+):\s*$/))) { cur = mm[1]; counts[cur] = 0; holds[cur] = []; continue; }
    if (cur && /^  - /.test(line)) {
      counts[cur]++;
      const hm = line.match(/h:\s*'?([A-Za-z0-9]+)'?/);
      holds[cur].push(hm ? hm[1] : null);
    }
  }
} catch (err) {
  const isMissing = err.code === 127 || err.status === 127 ||
                    /not found|ENOENT|command not found/i.test(String(err.message || err));
  if (!isMissing) {
    console.error(`FAIL: \`keymap parse\` ran but failed (real parse error — check config/${KM}.keymap):`);
    console.error(String(err.message || err));
    process.exit(1);
  }
  console.warn("keymap-drawer not on PATH; skipping keymap-vs-viewer count checks — " +
               "running viewer-internal structural checks and fixed-expectation thumb/HRM checks only.");
}

const online = counts !== null;
const NAME_MAP = { BASE: "base", NAV: "nav", NUM: "num", MEDIA: "media", SYM: "sym", FUN: "fun", MOUSE: "mouse" };
const errs = [];

// ── Invariant 1: layer set ───────────────────────────────────────────────────────
const vwLayerNames = Object.keys(layers).sort();
const expLayerNames = [...EXPECTED.LAYER_NAMES].sort();
if (JSON.stringify(vwLayerNames) !== JSON.stringify(expLayerNames))
  errs.push(`layer set: viewer has ${JSON.stringify(Object.keys(layers))} vs expected ${JSON.stringify(EXPECTED.LAYER_NAMES)}`);

if (online && Object.keys(layers).length !== Object.keys(counts).length)
  errs.push(`layer count: keymap ${Object.keys(counts).length} vs viewer ${Object.keys(layers).length}`);

// ── Invariant 2: per-layer key count ────────────────────────────────────────────
for (const [kn, vn] of Object.entries(NAME_MAP)) {
  if (!layers[vn]) { errs.push(`viewer missing layer "${vn}"`); continue; }
  const expectedCount = online ? counts[kn] : EXPECTED.KEYS_PER_LAYER;
  if (layers[vn].keys.length !== expectedCount)
    errs.push(`${vn}: viewer ${layers[vn].keys.length} keys vs ${online ? "keymap" : "expected"} ${expectedCount}`);
}

// ── Invariant 3: BASE thumb hold-layer order ─────────────────────────────────────
const vwThumbs = layers.base.keys.slice(30, 36).map(k => k.type === "layer" ? (k.h || "") : "");
const refThumbs = online
  ? (holds.BASE || []).slice(30, 36).map(h => (h || "").toLowerCase())
  : EXPECTED.THUMB_ORDER;
if (JSON.stringify(refThumbs) !== JSON.stringify(vwThumbs))
  errs.push(`BASE thumb layers: ${online ? "keymap" : "expected"} ${JSON.stringify(refThumbs)} vs viewer ${JSON.stringify(vwThumbs)}`);

// ── Invariant 4: BASE home-row-mod positions ─────────────────────────────────────
const vwHrm = layers.base.keys.map((k, i) => ({ k, i })).filter(o => o.i < 30 && o.k.h && o.k.type !== "layer").map(o => o.i);
const refHrm = online
  ? (holds.BASE || []).map((h, i) => ({ h, i })).filter(o => o.i < 30 && o.h && /^[LR]/.test(o.h)).map(o => o.i)
  : EXPECTED.HRM_IDX;
if (JSON.stringify(refHrm) !== JSON.stringify(vwHrm))
  errs.push(`BASE home-row-mod positions: ${online ? "keymap" : "expected"} ${JSON.stringify(refHrm)} vs viewer ${JSON.stringify(vwHrm)}`);

if (errs.length) {
  console.error(`${KM}-viewer.html is OUT OF SYNC with config/${KM}.keymap:`);
  for (const e of errs) console.error("  - " + e);
  console.error(`Update ${KM}-viewer.html to match the keymap (see AGENTS.md).`);
  process.exit(1);
}
const mode = online ? "full keymap diff" : "viewer-internal + fixed-expectation checks";
console.log(`${KM}-viewer.html structural sync OK [${mode}] (${EXPECTED.LAYER_NAMES.length} layers, thumb+HRM layout matches).`);
