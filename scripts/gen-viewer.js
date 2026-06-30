#!/usr/bin/env node
// FilePath: scripts/gen-viewer.js
//
// Regenerates the `const layers = {...}` data block in `<keymap>-viewer.html` from
// `config/<keymap>.keymap` so the viewer's key data can't drift from the keymap.
// Run via `just html`. Requires `keymap` (keymap-drawer 0.23.0) on PATH and node.
//
// Only the `const layers` block is rewritten. The HTML shell (CSS, key positions,
// rendering JS) and `layerDescriptions` are NOT touched. Per-layer icon/color come
// from METADATA below; friendly labels and color categories come from the maps
// below. Add new keycodes/macros to those maps (the generator WARNs about unmapped
// tokens) rather than editing the viewer HTML by hand.

const fs = require("fs");
const { execSync } = require("child_process");

const KM = process.argv[2] || "yuyudhan-1";
const HTML = `${KM}-viewer.html`;
const KEYMAP = `config/${KM}.keymap`;
const DRAWER_CFG = "config/keymap_drawer.config.yaml";

// --- per-layer presentation metadata (not derivable from the keymap) ---
const METADATA = {
  base:  { icon: "B", color: "#e94560" },
  nav:   { icon: "V", color: "#eab308" },
  num:   { icon: "N", color: "#06b6d4" },
  media: { icon: "M", color: "#f6a623" },
  sym:   { icon: "S", color: "#a855f7" },
  fun:   { icon: "F", color: "#22c55e" },
  mouse: { icon: "P", color: "#f97316" },
};

// --- mapping rules (validated to reproduce the current viewer exactly) ---
const LAYER_TYPE = { BASE:"", NAV:"nav", NUM:"num", MEDIA:"media", SYM:"sym", FUN:"fn", MOUSE:"mouse" };
const LAYER_NAMES = new Set(["BASE","NAV","NUM","MEDIA","SYM","FUN","MOUSE"]);
const MODS = new Set(["LGUI","LALT","LCTRL","LSHFT","RGUI","RALT","RCTRL","RSHFT"]);
const MOD_HOLD = { LGUI:"CMD", RGUI:"CMD", LALT:"OPT", RALT:"OPT", LCTRL:"CTRL", RCTRL:"CTRL", LSHFT:"SHIFT", RSHFT:"SHIFT" };
const MOD_TAP  = { LSHFT:"LSHIFT" }; // every other mod renders as its literal keycode
const NO_TYPE  = new Set(["RET","BSPC","DEL","SPACE","TAB","APP"]); // base-like passthroughs -> default color
const SPECIAL_TYPE = { "DISP|TOG":"media", "OUT TOG":"bt", "BT CLR":"bt" };
const LABELS = {
  RET:"ENTER", LEFT:"\u2190", DOWN:"\u2193", UP:"\u2191", RIGHT:"\u2192",
  "PG DN":"PGDN", "PG UP":"PGUP", "BRI DN":"BRI-", "BRI UP":"BRI+",
  "VOL DN":"VOL-", "VOL UP":"VOL+", PP:"PLAY\nPAUSE", APP:"K_APP", "PAUSE BREAK":"PAUSE",
  "OUT TOG":"OUT\nTOG", "DISP|TOG":"DISP\nTOG", "BT CLR":"BT\nCLR",
  "Gui+Sft+Z":"REDO", "Gui+V":"PASTE", "Gui+C":"COPY", "Gui+X":"CUT", "Gui+Z":"UNDO",
  "Ctl+Gui+Q":"LOCK", "Sft+Gui+Q":"LOGOUT",
  "&mmv MOVE_LEFT":"\u2190", "&mmv MOVE_DOWN":"\u2193", "&mmv MOVE_UP":"\u2191", "&mmv MOVE_RIGHT":"\u2192",
  "&msc SCRL_LEFT":"SCRL\n\u2190", "&msc SCRL_DOWN":"SCRL\n\u2193", "&msc SCRL_UP":"SCRL\n\u2191", "&msc SCRL_RIGHT":"SCRL\n\u2192",
  "&mkp MCLK":"MCLK", "&mkp LCLK":"LCLK", "&mkp RCLK":"RCLK",
};

// --- helpers ---
function need(bin){
  try { execSync(`command -v ${bin}`, { stdio:"ignore" }); }
  catch { console.error(`FATAL: \`${bin}\` not found on PATH. Install keymap-drawer: pipx install --python python3.12 keymap-drawer==0.23.0`); process.exit(1); }
}
function decodeScalar(s){
  s = s.trim();
  if (s.length >= 2 && s[0] === "'" && s[s.length-1] === "'") return s.slice(1,-1).replace(/''/g,"'");
  return s;
}
function parseLayers(yamlText){
  const out = {}; let cur = null, inLayers = false;
  for (const line of yamlText.split("\n")){
    if (/^layers:\s*$/.test(line)) { inLayers = true; continue; }
    if (inLayers && /^\S/.test(line)) inLayers = false; // any column-0 key ends the layers block
    if (!inLayers) continue;
    let mm;
    if ((mm = line.match(/^  ([A-Za-z0-9_]+):\s*$/))) { cur = mm[1]; out[cur] = []; continue; }
    if (cur && /^  - /.test(line)){
      const v = line.slice(4);
      if (v.trim().startsWith("{")){
        const o = {}; const inner = v.trim().replace(/^\{|\}$/g,"");
        inner.split(/,\s*/).forEach(p => { const i = p.indexOf(":"); o[p.slice(0,i).trim()] = decodeScalar(p.slice(i+1)); });
        out[cur].push(o);
      } else out[cur].push(decodeScalar(v));
    }
  }
  return out;
}

const warns = [];
const lbl = (tok) => (tok in LABELS) ? LABELS[tok] : tok;
function flag(tok, L, i){ if (!(tok in LABELS) && (/^&\w/.test(tok) || /\w\+\w/.test(tok))) warns.push(`unmapped token ${JSON.stringify(tok)} (${L} #${i}) -> add to LABELS in scripts/gen-viewer.js`); }

function genKey(L, y, i){
  if (y === "") return {};
  if (typeof y === "object" && y.type === "held") return { type:"held" };
  if (typeof y === "object"){ // flow map {t, h}
    const tok = `${y.t}|${y.h}`;
    if (LAYER_NAMES.has(y.h)) return { t: lbl(y.t), h: y.h.toLowerCase(), type:"layer" }; // layer-tap thumb
    if (MODS.has(y.h)) return { t: lbl(y.t), h: MOD_HOLD[y.h] };                          // home-row mod
    if (y.t === "BT") return { t: `BT ${y.h}`, type:"bt" };                               // BT 0..3
    flag(tok, L, i);
    return { t: lbl(tok), type: SPECIAL_TYPE[tok] || LAYER_TYPE[L] };
  }
  if (MODS.has(y)) return { t: MOD_TAP[y] || y, type:"mod" };       // standalone modifier
  if (NO_TYPE.has(y)) return { t: lbl(y) };                         // base-like passthrough
  if (y in SPECIAL_TYPE) { flag(y, L, i); return { t: lbl(y), type: SPECIAL_TYPE[y] }; }
  flag(y, L, i);
  const type = LAYER_TYPE[L];
  return type ? { t: lbl(y), type } : { t: lbl(y) };               // themed key (base -> no type)
}

// --- serialize to the viewer's compact JS literal (double quotes, non-ASCII -> \uXXXX) ---
function esc(s){
  let r = "";
  for (const ch of s){
    const c = ch.codePointAt(0);
    if (ch === '"') r += '\\"';
    else if (ch === '\\') r += '\\\\';
    else if (ch === '\n') r += '\\n';
    else if (c < 32 || c > 126) r += "\\u" + c.toString(16).padStart(4,"0");
    else r += ch;
  }
  return '"' + r + '"';
}
function serKey(k){
  const parts = [];
  for (const f of ["t","h","type"]) if (k[f] !== undefined) parts.push(`${f}:${esc(k[f])}`);
  return "{" + parts.join(",") + "}";
}
const ROWS = [[0,5],[5,10],[10,15],[15,20],[20,25],[25,30],[30,33],[33,36]]; // matches current layout
function serLayer(name, keys){
  const meta = METADATA[name] || { icon: name[0].toUpperCase(), color: "#888888" };
  if (!METADATA[name]) warns.push(`no METADATA for layer "${name}" -> add icon/color in scripts/gen-viewer.js and a layerDescriptions entry in ${HTML}`);
  let s = `  ${name}: {\n    icon: ${esc(meta.icon)}, color: ${esc(meta.color)},\n    keys: [\n`;
  for (const [a,b] of ROWS){
    const slice = keys.slice(a,b).map(serKey).join(",");
    if (slice) s += `      ${slice},\n`;
  }
  s = s.replace(/,\n$/, "\n"); // last row: no trailing comma
  s += `    ]\n  }`;
  return s;
}

// --- main ---
need("keymap");
if (!fs.existsSync(KEYMAP)) { console.error(`FATAL: ${KEYMAP} not found`); process.exit(1); }
const yaml = execSync(`keymap -c ${DRAWER_CFG} parse -z ${KEYMAP}`, { encoding:"utf8" });
const Y = parseLayers(yaml);
const order = Object.keys(Y); // keymap-drawer emits in #define order: BASE,NAV,NUM,MEDIA,SYM,FUN,MOUSE
const blocks = order.map(L => serLayer(L.toLowerCase(), Y[L].map((y,i) => genKey(L, y, i))));
const block = "const layers = {\n" + blocks.join(",\n") + "\n};";

let html = fs.readFileSync(HTML, "utf8");
const re = /const layers = \{[\s\S]*?\n\};/;
if (!re.test(html)) { console.error(`FATAL: could not locate \`const layers\` block in ${HTML}`); process.exit(1); }
const next = html.replace(re, block.replace(/\$/g, "$$$$")); // escape $ for String.replace
if (next === html) console.log(`${HTML} \`layers\` already up to date.`);
else { fs.writeFileSync(HTML, next); console.log(`Regenerated \`const layers\` in ${HTML} (${order.length} layers, ${order.reduce((n,L)=>n+Y[L].length,0)} keys).`); }
for (const w of warns) console.warn("WARN: " + w);
