import { createRequire } from 'node:module';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);
const nm = (p) => require.resolve(p);
let fontsReady = false;
export function ensureFonts() {
  if (fontsReady) return;
  fontsReady = true;
  const reg = (file, name) => { try { GlobalFonts.registerFromPath(nm(file), name); } catch { /* falls back to system sans */ } };
  reg('@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2', 'MitraDev');
  reg('@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2', 'MitraSans');
  reg('@fontsource/sora/files/sora-latin-700-normal.woff2', 'MitraDisplay');
  reg('@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2', 'MitraText');
}
// Latin font first, Devanagari second: Latin punctuation never falls into the Devanagari-only font.
const font = (px, display = false) => `${Math.round(px)}px "${display ? 'MitraDisplay' : 'MitraSans'}","MitraDev",sans-serif`;

export const SIZES = { 'Portrait Reel': { w: 720, h: 1280 }, 'Square Post': { w: 720, h: 720 }, 'Landscape Video': { w: 1280, h: 720 } };
export const sizeFor = (format) => SIZES[format] || SIZES['Portrait Reel'];

const PALETTES = [
  ['#0A0A0F', '#2A2036'], ['#0A1018', '#17304A'], ['#120A0A', '#3A1A14'], ['#0B0B12', '#26213A'],
];

function wrap(g, text, maxW) {
  const lines = []; let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    const trial = line ? `${line} ${word}` : word;
    if (g.measureText(trial).width <= maxW || !line) line = trial; else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  return lines;
}

function background(g, w, h, i) {
  const [a, b] = PALETTES[i % PALETTES.length];
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, a); grad.addColorStop(1, b);
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.08)';
  g.beginPath(); g.arc(w * 0.1, h * 0.78, Math.min(w, h) * 0.5, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(w * 0.9, h * 0.12, Math.min(w, h) * 0.34, 0, Math.PI * 2); g.fill();
}

function cover(g, img, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s; const dh = img.height * s;
  g.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function brandPill(g, w, name, u) {
  g.font = font(24 * u);
  const text = name.length > 28 ? `${name.slice(0, 27)}…` : name;
  const tw = g.measureText(text).width + 56 * u;
  const x = 36 * u; const y = 40 * u; const hh = 52 * u;
  g.fillStyle = 'rgba(15,11,30,0.62)';
  g.beginPath(); g.roundRect(x, y, tw, hh, hh / 2); g.fill();
  g.fillStyle = '#FBBF24'; g.beginPath(); g.arc(x + 26 * u, y + hh / 2, 7 * u, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillText(text, x + 44 * u, y + hh / 2 + 1);
}

export async function renderScene({ image, caption, index, size, businessName }) {
  ensureFonts();
  const { w, h } = size; const u = Math.min(w, h) / 720;
  const c = createCanvas(w, h); const g = c.getContext('2d');
  background(g, w, h, index);
  if (image) { try { cover(g, await loadImage(image), w, h); } catch { /* keep gradient */ } }
  // legibility gradient at the bottom
  const shade = g.createLinearGradient(0, h * 0.5, 0, h);
  shade.addColorStop(0, 'rgba(10,6,24,0)'); shade.addColorStop(1, 'rgba(10,6,24,0.88)');
  g.fillStyle = shade; g.fillRect(0, h * 0.5, w, h * 0.5);
  brandPill(g, w, businessName, u);
  // caption
  g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = '#fff';
  const px = 58 * u; g.font = font(px, true);
  const maxW = w - 120 * u; const lines = wrap(g, caption, maxW).slice(0, 4);
  const lh = px * 1.3; const bottom = h - 110 * u;
  const top = bottom - lines.length * lh;
  g.fillStyle = '#FBBF24'; g.beginPath(); g.roundRect(60 * u, top - 34 * u, 90 * u, 8 * u, 4 * u); g.fill();
  g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 14 * u;
  lines.forEach((l, i) => g.fillText(l, 60 * u, top + (i + 1) * lh - 12 * u));
  g.shadowBlur = 0;
  return c.toBuffer('image/png');
}

export async function renderEndCard({ businessName, offer, city, cta, size, logo }) {
  ensureFonts();
  const { w, h } = size; const u = Math.min(w, h) / 720;
  const c = createCanvas(w, h); const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#120B2E'); grad.addColorStop(1, '#4C1D95');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(251,191,36,0.9)'; g.lineWidth = 4 * u;
  g.beginPath(); g.roundRect(34 * u, 34 * u, w - 68 * u, h - 68 * u, 28 * u); g.stroke();
  let logoH = 0;
  if (logo) {
    try {
      const li = await loadImage(logo); const m = 150 * u; const s = Math.min(m / li.width, m / li.height);
      logoH = li.height * s;
      g.save(); g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect((w - li.width * s) / 2 - 14 * u, 90 * u - 14 * u, li.width * s + 28 * u, logoH + 28 * u, 20 * u); g.fill(); g.restore();
      g.drawImage(li, (w - li.width * s) / 2, 90 * u, li.width * s, logoH);
    } catch { logoH = 0; }
  }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  const blocks = [];
  g.font = font(92 * u, true); blocks.push({ lines: wrap(g, businessName, w - 160 * u).slice(0, 3), px: 92 * u, color: '#FBBF24', display: true });
  if (offer) { g.font = font(54 * u); blocks.push({ lines: wrap(g, offer, w - 200 * u).slice(0, 3), px: 54 * u, color: '#fff' }); }
  if (cta) { g.font = font(40 * u); blocks.push({ lines: wrap(g, cta, w - 200 * u).slice(0, 2), px: 40 * u, color: '#C4B5FD' }); }
  if (city) { g.font = font(36 * u); blocks.push({ lines: [city], px: 36 * u, color: '#DDD6FE' }); }
  const gap = 44 * u;
  const total = blocks.reduce((s, b) => s + b.lines.length * b.px * 1.28, 0) + gap * (blocks.length - 1);
  let y = Math.max((h - total) / 2, logoH ? 90 * u + logoH + 60 * u : 0);
  for (const b of blocks) {
    g.font = font(b.px, b.display); g.fillStyle = b.color;
    for (const l of b.lines) { y += b.px * 1.28; g.fillText(l, w / 2, y - b.px * 0.22); }
    y += gap;
  }
  return c.toBuffer('image/png');
}
