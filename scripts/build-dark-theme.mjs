/*
 * Builds src/theme/darkMode.generated.css from the student stylesheets.
 *
 * Every colour in those stylesheets gets a dark-mode version: the hue and
 * saturation stay the same and the lightness is flipped, so white surfaces
 * turn dark, dark text turns light, and blues stay blue. Each rule is
 * repeated under `html.cs-dark`, which is only set while the student
 * dashboard is open in dark mode. Photos are never touched.
 *
 * Run again after changing colours in a student stylesheet:
 *   npm run theme:dark
 */

import { readFileSync, writeFileSync } from "node:fs";

const SOURCES = [
  "src/dashboards/StudentDashboard/StudentDashboard.css",
  "src/dashboards/StudentDashboard/StudentDashboardTheme.css",
  "src/pages/student/ItemReservation.css",
  "src/pages/student/ItemReservationTheme.css",
  "src/pages/student/ItemStocks.css",
  "src/pages/student/ClaimStubPage.css",
  "src/pages/student/AccountSettings.css",
  "src/pages/student/ContactSupport.css",
  "src/pages/student/HelpCenter.css",
  "src/pages/student/MyProfile.css",
  "src/components/document-request/DocumentRequestWizard.css",
  "src/components/messaging/Messaging.css",
  // Left out on purpose: DigitalReceipt.css (the receipt stays white paper)
  // and index.css / App.css (global starter styles, not student pages).
];

const OUTPUT = "src/theme/darkMode.generated.css";
const SCOPE = "html.cs-dark";

// Properties whose colours are converted. Shadows are left alone: dark
// shadows still read as shadows on a dark page.
const COLOR_PROPS =
  /^(color|background|background-color|background-image|border|border-(top|right|bottom|left)(-color)?|border-color|outline|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color|column-rule-color|--[\w-]+)$/;

/* ---------- colour conversion ---------- */

const NAMED = {
  white: [255, 255, 255],
  black: [0, 0, 0],
};

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255));
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255));
}

/* ---------- the dark palette: Midnight Blue ----------
   Surfaces  #0B1724 background · #102235 sidebar · #162B3D cards
             #1D3549 elevated
   Blues     #2585C5 primary · #45A9E0 hover/links · #173C56 active item
             #29475D borders
   Text      #F2F6FA headings · #C0D0DE body · #849BAD muted
   Reds, greens and yellows keep their own hue, so status colours still
   mean the same thing. */

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const PAGE = hex("#0b1724"); // background
const CARD = hex("#162b3d"); // cards
const FILL = hex("#1d3549"); // elevated: fills inside cards, tags, hovers
const LINE = hex("#29475d"); // borders
const PRIMARY = hex("#2585c5"); // primary actions, banners
const ACTIVE = hex("#173c56"); // active item, deep blue areas
const INK = hex("#08111b"); // very dark spots
const HEADING = hex("#f2f6fa"); // headings
const TEXT = hex("#c0d0de"); // body text
const ACCENT = hex("#45a9e0"); // links and blue labels
const MUTED = hex("#849bad"); // muted text
const FAINT = hex("#647d90"); // faint hints

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * Math.max(0, Math.min(1, t))));

/**
 * role: "bg" for backgrounds, "text" for text and icons,
 *       "auto" (borders, variables): light colours act as backgrounds.
 */
function darken([r, g, b], role) {
  const [h, s, l] = rgbToHsl(r, g, b);
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  // Greys, blues, and greyish tints (old green-theme leftovers) all
  // follow the navy palette.
  const blueish = chroma < 0.06 || s < 0.22 || (h >= 0.47 && h <= 0.75);

  if (role === "auto") role = l > 0.82 ? "bg" : "text";

  if (role === "bg") {
    // Strong non-blue colours (badges, status dots) keep their hue, muted.
    if (!blueish && s > 0.45 && l < 0.8) return hslToRgb(h, Math.min(s, 0.45), 0.36);
    // Pale status tints keep a faint hint of their hue over the card colour.
    if (!blueish && l >= 0.8) return mix(FILL, hslToRgb(h, Math.min(s, 0.4), 0.3), 0.22);

    if (l >= 0.985) return CARD;
    if (l >= 0.955) return PAGE;
    if (l >= 0.85) return mix(FILL, LINE, (0.955 - l) / 0.105);
    if (l >= 0.55) return LINE;
    // Mid blues (buttons, banner highlights) become the primary blue;
    // deep blues become the active-item blue.
    if (l >= 0.3) return s > 0.3 ? PRIMARY : LINE;
    if (l >= 0.1) return ACTIVE;
    return INK;
  }

  // text
  const dark = l <= 0.3 || (!blueish && l < 0.35 && s < 0.6);
  // Dark text: strongly coloured (headings) → heading white, else body.
  if (dark) return s > 0.45 ? HEADING : mix(HEADING, TEXT, 0.6);
  if (!blueish) {
    // Reds, greens, yellows: same hue, gentle and readable.
    return hslToRgb(h, Math.min(s, 0.55), Math.min(0.74, Math.max(0.62, 1.05 - l)));
  }
  if (l <= 0.6) return s > 0.3 ? ACCENT : mix(TEXT, MUTED, (l - 0.3) / 0.3);
  if (l <= 0.85) return mix(MUTED, FAINT, (l - 0.6) / 0.25);
  return HEADING;
}

function format([r, g, b], alpha) {
  if (alpha === undefined || alpha >= 1) {
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  }
  return `rgba(${r}, ${g}, ${b}, ${+alpha.toFixed(3)})`;
}

function parseHex(hex) {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { rgb: [n(0), n(2), n(4)], alpha: h.length === 8 ? n(6) / 255 : undefined };
}

const COLOR_RE =
  /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\(\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*[, ]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)|\b(?:white|black)\b/g;

function convertValue(value, role) {
  let changed = false;
  const out = value.replace(COLOR_RE, (match) => {
    let rgb;
    let alpha;
    if (match.startsWith("#")) {
      ({ rgb, alpha } = parseHex(match));
    } else if (match.startsWith("rgb")) {
      const parts = match
        .slice(match.indexOf("(") + 1, -1)
        .split(/[\s,/]+/)
        .filter(Boolean);
      rgb = parts.slice(0, 3).map((p) =>
        p.endsWith("%") ? Math.round(parseFloat(p) * 2.55) : Number(p)
      );
      if (parts[3] !== undefined) {
        alpha = parts[3].endsWith("%") ? parseFloat(parts[3]) / 100 : Number(parts[3]);
      }
    } else {
      rgb = NAMED[match.toLowerCase()];
    }
    changed = true;
    return format(darken(rgb, role), alpha);
  });
  return changed ? out : null;
}

/* ---------- a small CSS reader (rules, @media, @supports) ---------- */

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Splits css into top-level items: { prelude, body } for blocks. */
function blocks(css) {
  const items = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    items.push({ prelude: prelude.replace(/^[^{}]*;/, "").trim(), body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return items;
}

function scopeSelector(selector) {
  return selector
    .split(/,(?![^()]*\))/)
    .map((part) => {
      const s = part.trim();
      if (!s) return s;
      if (s === ":root" || s === "html") return SCOPE;
      if (/^html\b/.test(s)) return s.replace(/^html/, SCOPE);
      return `${SCOPE} ${s}`;
    })
    .join(",\n");
}

/* Custom properties defined exactly once (e.g. --sdx-green) are filled in
   before converting, so a colour used as a background is converted as a
   background, and the same colour used as text is converted as text. */
const VARS = new Map();
const varCounts = new Map();

function collectVars(css) {
  for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)/g)) {
    varCounts.set(m[1], (varCounts.get(m[1]) || 0) + 1);
    VARS.set(m[1], m[2].trim());
  }
}

function resolveVars(value) {
  return value.replace(/var\((--[\w-]+)\)/g, (match, name) =>
    varCounts.get(name) === 1 ? VARS.get(name) : match
  );
}

function convertDeclarations(body) {
  const out = [];
  for (const raw of body.split(/;(?![^()]*\))/)) {
    const colon = raw.indexOf(":");
    if (colon === -1) continue;
    const prop = raw.slice(0, colon).trim();
    if (!COLOR_PROPS.test(prop)) continue;
    let value = raw.slice(colon + 1).trim();
    const important = /!important\s*$/.test(value);
    value = value.replace(/!important\s*$/, "").trim();
    const role = /^(background|background-color|background-image)$/.test(prop)
      ? "bg"
      : /^(border|outline|--)/.test(prop)
        ? "auto"
        : "text";
    const converted = convertValue(
      prop.startsWith("--") ? value : resolveVars(value),
      role
    );
    if (converted) out.push(`  ${prop}: ${converted}${important ? " !important" : ""};`);
  }
  return out;
}

function convert(css) {
  const out = [];
  for (const { prelude, body } of blocks(css)) {
    if (!prelude) continue;
    if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
      const inner = convert(body);
      if (inner.trim()) out.push(`${prelude} {\n${inner}\n}`);
    } else if (prelude.startsWith("@")) {
      continue; // @keyframes, @font-face, …
    } else {
      const decls = convertDeclarations(body);
      if (decls.length) out.push(`${scopeSelector(prelude)} {\n${decls.join("\n")}\n}`);
    }
  }
  return out.join("\n\n");
}

const texts = SOURCES.map((file) =>
  stripComments(readFileSync(file, "utf8").replace(/\r\n/g, "\n"))
);
texts.forEach(collectVars);

const sections = SOURCES.map(
  (file, index) => `/* ---- ${file} ---- */\n\n${convert(texts[index])}`
);

writeFileSync(
  OUTPUT,
  `/* GENERATED by scripts/build-dark-theme.mjs — do not edit by hand.\n   Run \`npm run theme:dark\` after changing student stylesheet colours. */\n\n` +
    sections.join("\n\n") +
    "\n"
);

console.log(`Wrote ${OUTPUT}`);
