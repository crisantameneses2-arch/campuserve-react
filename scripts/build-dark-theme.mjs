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

/* Lightness is flipped into a comfortable range: white becomes a deep
   blue-grey (not pure black) and black becomes soft white. */
function darken([r, g, b]) {
  let [h, s, l] = rgbToHsl(r, g, b);
  const chroma = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
  // The curve lifts mid-tones a little so muted text stays readable.
  const nl = 0.085 + Math.pow(1 - l, 0.85) * 0.835;

  if (chroma < 0.035) {
    // Greys and near-whites: one calm blue-grey for every surface.
    h = 0.58;
    s = 0.22;
  } else if (l > 0.85) {
    // Pale tints (tag and badge backgrounds) keep their hue, softly.
    s = Math.min(s, 0.4);
  } else {
    s = Math.min(s, 0.75);
  }

  return hslToRgb(h, s, nl);
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

function convertValue(value) {
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
    return format(darken(rgb), alpha);
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
    const converted = convertValue(value);
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

const sections = SOURCES.map((file) => {
  const css = stripComments(readFileSync(file, "utf8").replace(/\r\n/g, "\n"));
  return `/* ---- ${file} ---- */\n\n${convert(css)}`;
});

writeFileSync(
  OUTPUT,
  `/* GENERATED by scripts/build-dark-theme.mjs — do not edit by hand.\n   Run \`npm run theme:dark\` after changing student stylesheet colours. */\n\n` +
    sections.join("\n\n") +
    "\n"
);

console.log(`Wrote ${OUTPUT}`);
