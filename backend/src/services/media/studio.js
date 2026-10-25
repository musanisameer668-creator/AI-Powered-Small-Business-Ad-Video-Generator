import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ensureFonts } from './frames.js';
import { makeMusic } from './music.js';

const require = createRequire(import.meta.url);
const ffmpegPath = () => process.env.FFMPEG_PATH || require('@ffmpeg-installer/ffmpeg').path;
const FPS = 25;

// ------------------------------------------------------------------ easing
const c01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, d) => c01((t - a) / d);
const outQuart = (t) => 1 - (1 - c01(t)) ** 4;
const outCubic = (t) => 1 - (1 - c01(t)) ** 3;
const inOut = (t) => { t = c01(t); return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; };

// ------------------------------------------------------------------ themes: dark, cinematic, one accent colour
const THEMES = {
  premium: { bg: ['#09090D', '#17131F'], glow: ['#B8923F', '#4A2F18'], accent: '#D8B45E', text: '#F7F3EA', btn: '#15110A' },
  professional: { bg: ['#070B14', '#0E1930'], glow: ['#3B82F6', '#1E3A8A'], accent: '#8DBBFF', text: '#F2F6FF', btn: '#07101F' },
  festive: { bg: ['#120707', '#2B100C'], glow: ['#E8870E', '#8A2C10'], accent: '#F6BC4B', text: '#FFF5E6', btn: '#2A0E08' },
  energetic: { bg: ['#0C0A12', '#1D1226'], glow: ['#F0603E', '#6D2A63'], accent: '#FF7F5C', text: '#FFF4EF', btn: '#1A0A10' },
  fun: { bg: ['#080F0E', '#0F2420'], glow: ['#2FBF8E', '#0F6B5D'], accent: '#FFD23F', text: '#F3FFFA', btn: '#10200A' },
};
export function themeFor(tone = '') {
  if (/premium/i.test(tone)) return THEMES.premium;
  if (/professional/i.test(tone)) return THEMES.professional;
  if (/festive/i.test(tone)) return THEMES.festive;
  if (/funny/i.test(tone)) return THEMES.fun;
  return THEMES.energetic;
}
const display = (px) => `${Math.round(px)}px "MitraDisplay","MitraSans","MitraDev",sans-serif`;
const text = (px) => `${Math.round(px)}px "MitraText","MitraSans","MitraDev",sans-serif`;
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

// ------------------------------------------------------------------ text
function layout(g, str, px, maxW, fontFn = display, maxLines = 4) {
  g.font = fontFn(px);
  const space = g.measureText(' ').width;
  const lines = []; let cur = []; let w = 0;
  for (const word of String(str).split(/\s+/).filter(Boolean)) {
    const ww = g.measureText(word).width;
    if (cur.length && w + space + ww > maxW) { lines.push({ s: cur.join(' '), width: w }); cur = []; w = 0; }
    w += (cur.length ? space : 0) + ww; cur.push(word);
  }
  if (cur.length) lines.push({ s: cur.join(' '), width: w });
  if (lines.length > maxLines || lines.some((l) => l.width > maxW * 1.02)) return layout(g, str, px * 0.9, maxW, fontFn, maxLines);
  return { lines, px, lh: px * 1.18, fontFn };
}
const blockH = (L) => L.lines.length * L.lh;

/** Each line slides up from behind an invisible mask. Calm, no bounce. */
function drawLines(g, L, x, y, t, { start = 0, step = 0.13, align = 'left', color = '#fff', alpha = 1 } = {}) {
  g.textBaseline = 'alphabetic'; g.textAlign = 'left'; g.font = L.fontFn(L.px);
  L.lines.forEach((line, i) => {
    const p = outQuart(seg(t, start + i * step, 0.75));
    if (p <= 0) return;
    const lx = align === 'center' ? x - line.width / 2 : x;
    const ly = y + i * L.lh;
    g.save();
    g.beginPath(); g.rect(lx - 30, ly - L.px * 0.3, line.width + 60, L.lh + L.px * 0.55); g.clip();
    g.translate(0, (1 - p) * L.lh * 0.9);
    g.globalAlpha = alpha * Math.min(1, p * 2.2);
    g.fillStyle = color; g.fillText(line.s, lx, ly + L.px);
    g.restore();
  });
}

// ------------------------------------------------------------------ pieces
function cover(g, img, w, h, zoom, panX) {
  const s = Math.max(w / img.width, h / img.height) * zoom;
  const dw = img.width * s; const dh = img.height * s;
  g.drawImage(img, (w - dw) / 2 + panX * (dw - w) / 2, (h - dh) / 2, dw, dh);
}
function themedBg(g, w, h, th, t, k = 0) {
  const bg = g.createLinearGradient(0, 0, w * 0.3, h); bg.addColorStop(0, th.bg[0]); bg.addColorStop(1, th.bg[1]);
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const M = Math.max(w, h);
  const glow = (cx, cy, r, col, a) => { const r0 = g.createRadialGradient(cx, cy, 0, cx, cy, r); r0.addColorStop(0, rgba(col, a)); r0.addColorStop(1, rgba(col, 0)); g.fillStyle = r0; g.fillRect(0, 0, w, h); };
  glow(w * (0.2 + 0.15 * Math.sin(t * 0.5 + k)), h * (0.25 + 0.1 * Math.cos(t * 0.4 + k)), M * 0.7, th.glow[0], 0.5);
  glow(w * (0.85 - 0.12 * Math.cos(t * 0.45 + k)), h * (0.8 + 0.08 * Math.sin(t * 0.5)), M * 0.65, th.glow[1], 0.55);
}
function rings(g, w, h, th, t, u, k = 0) {
  const cx = w * 0.82; const cy = h * 0.2; const m = Math.min(w, h);
  g.save(); g.lineWidth = 1.5 * u;
  for (const [r, a] of [[0.32, 0.07], [0.5, 0.05], [0.7, 0.04]]) { g.strokeStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(cx, cy, m * r, 0, Math.PI * 2); g.stroke(); }
  g.strokeStyle = rgba(th.accent, 0.55); g.lineWidth = 2.5 * u; g.beginPath();
  const a0 = t * 0.35 + k; g.arc(cx, cy, m * 0.5, a0, a0 + Math.PI * 0.55); g.stroke();
  g.restore();
}
function brandTag(g, name, th, u, t) {
  const p = outCubic(seg(t, 0.2, 0.6)); if (p <= 0) return;
  g.save(); g.globalAlpha = p; g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = th.accent; g.fillRect(60 * u, 74 * u - 6 * u, 12 * u, 12 * u);
  g.fillStyle = th.text; g.font = text(26 * u); g.fillText(name.length > 28 ? `${name.slice(0, 27)}…` : name, 86 * u, 74 * u);
  g.restore();
}
function counter(g, i, n, th, u, w, t) {
  const p = outCubic(seg(t, 0.3, 0.6)); if (p <= 0) return;
  g.save(); g.globalAlpha = p; g.textAlign = 'right'; g.textBaseline = 'middle';
  g.fillStyle = th.text; g.font = display(30 * u); const a = `0${i}`; const b = ` / 0${n}`;
  g.font = text(24 * u); const bw = g.measureText(b).width; g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillText(b, w - 60 * u, 74 * u);
  g.font = display(30 * u); g.fillStyle = th.accent; g.fillText(a, w - 60 * u - bw, 74 * u);
  g.restore();
}
function accentLine(g, x, y, len, th, u, p) { g.fillStyle = th.accent; g.fillRect(x, y, len * outQuart(p), 4 * u); }

let grain = null;
function makeGrain(w, h) {
  const c = createCanvas(w + 80, h + 80); const gg = c.getContext('2d'); const id = gg.createImageData(c.width, c.height);
  let s = 12345; for (let i = 0; i < id.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const v = (s >>> 24); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 20; }
  gg.putImageData(id, 0, 0); return c;
}
function finish(g, w, h, frame) {
  const v = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.85);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.42)'); g.fillStyle = v; g.fillRect(0, 0, w, h);
  if (!grain) grain = makeGrain(w, h);
  g.drawImage(grain, -((frame * 37) % 80), -((frame * 53) % 80));
}

// ------------------------------------------------------------------ beats
function buildBeats(c) {
  const { g, w, h, u, input, content, sceneDur, hasPhotos } = c;
  const wide = w > h; const margin = 60 * u; const maxW = wide ? w * 0.58 : w - margin * 2;
  const beats = [];
  beats.push({ type: 'hook', dur: 2.8, L: layout(g, content.headline || input.businessName, (wide ? 70 : 92) * u, maxW, display, 4), sub: input.productName });
  content.scenes.slice(0, 3).forEach((s, i) => beats.push({ type: 'scene', idx: i, dur: sceneDur, L: layout(g, s.caption, (wide ? 52 : 66) * u, maxW, display, 4) }));
  if (input.offer) {
    const m = /(\d+\s?%|₹\s?\d+|rs\.?\s?\d+)/i.exec(input.offer);
    const beat = { type: 'offer', dur: 2.9 };
    if (m) { beat.big = m[0].replace(/\s+/g, ''); beat.rest = input.offer.replace(m[0], '').replace(/\s+/g, ' ').trim(); beat.restL = beat.rest ? layout(g, beat.rest, (wide ? 44 : 54) * u, maxW, text, 3) : null; }
    else beat.L = layout(g, input.offer, (wide ? 64 : 84) * u, maxW, display, 4);
    beats.push(beat);
  }
  beats.push({ type: 'end', dur: 3.2, nameL: layout(g, input.businessName, (wide ? 66 : 84) * u, w - margin * 2, display, 3), ctaL: content.cta ? layout(g, content.cta, 38 * u, w - margin * 3, text, 2) : null });
  void hasPhotos;
  return beats;
}

function photoLayer(g, c, b, t, img, pi, dark = 0.25) {
  const { w, h } = c;
  const zoom = 1.05 + 0.13 * outCubic(t / b.dur); const dir = pi % 2 ? -1 : 1;
  cover(g, img, w, h, zoom, dir * (-0.6 + 1.2 * (t / b.dur)) * 0.5);
  g.fillStyle = `rgba(8,8,14,${dark})`; g.fillRect(0, 0, w, h);
  const sh = g.createLinearGradient(0, h * 0.38, 0, h); sh.addColorStop(0, 'rgba(6,6,10,0)'); sh.addColorStop(1, 'rgba(6,6,10,0.93)'); g.fillStyle = sh; g.fillRect(0, h * 0.38, w, h * 0.62);
  const tp = g.createLinearGradient(0, 0, 0, h * 0.22); tp.addColorStop(0, 'rgba(6,6,10,0.6)'); tp.addColorStop(1, 'rgba(6,6,10,0)'); g.fillStyle = tp; g.fillRect(0, 0, w, h * 0.22);
}

function drawBeat(c, b, t) {
  const { g, w, h, u, th, input, content, logo } = c; const wide = w > h; const margin = 60 * u;
  g.save();
  if (b.type === 'hook') {
    const hookImg = c.photos[3] || c.photos.find(Boolean);
    if (hookImg) photoLayer(g, c, b, t, hookImg, 0, 0.38); else { themedBg(g, w, h, th, t, 0); rings(g, w, h, th, t, u); }
    brandTag(g, input.businessName, th, u, t);
    const y = (wide ? h * 0.5 - blockH(b.L) / 2 : h * 0.52 - blockH(b.L) / 2);
    accentLine(g, margin, y - 40 * u, 120 * u, th, u, seg(t, 0.15, 0.7));
    drawLines(g, b.L, margin, y, t, { start: 0.35, color: th.text });
    const yy = y + blockH(b.L) + 36 * u; const p = outCubic(seg(t, 0.35 + b.L.lines.length * 0.13 + 0.2, 0.7));
    if (b.sub) { g.save(); g.globalAlpha = p * 0.8; g.translate(0, (1 - p) * 14 * u); g.font = text(34 * u); g.fillStyle = th.text; g.textBaseline = 'alphabetic'; g.fillText(b.sub, margin, yy + 30 * u); g.restore(); }
  } else if (b.type === 'scene') {
    const nth = b.idx + 1;
    const img = c.photos[b.idx];
    if (img) photoLayer(g, c, b, t, img, b.idx); else { themedBg(g, w, h, th, t, nth * 1.7); rings(g, w, h, th, t, u, nth); }
    if (!img) {
      g.save(); g.font = display(Math.min(w, h) * 1.05); g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.lineWidth = 2 * u; g.strokeStyle = 'rgba(255,255,255,0.07)';
      g.translate((1 - outCubic(seg(t, 0, 1.2))) * 60 * u, 0); g.strokeText(String(nth), w * 0.98, h * 0.62); g.restore();
    }
    brandTag(g, input.businessName, th, u, t); counter(g, nth, 3, th, u, w, t);
    const bottom = h - (wide ? 90 : 150) * u; const y = bottom - blockH(b.L);
    accentLine(g, margin, y - 38 * u, 96 * u, th, u, seg(t, 0.2, 0.7));
    drawLines(g, b.L, margin, y, t, { start: 0.3, color: th.text });
  } else if (b.type === 'offer') {
    themedBg(g, w, h, th, t, 4); rings(g, w, h, th, t, u, 2);
    // ring that draws itself around the offer
    const m = Math.min(w, h); const cx = wide ? w * 0.78 : w * 0.78; const cy = wide ? h * 0.5 : h * 0.8; const R = m * (wide ? 0.34 : 0.42);
    g.save(); g.lineWidth = 3 * u; g.strokeStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = th.accent; g.lineCap = 'round'; g.beginPath(); g.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * outQuart(seg(t, 0.2, 1.4))); g.stroke(); g.restore();
    const lp = outCubic(seg(t, 0.1, 0.6));
    g.save(); g.globalAlpha = lp; g.fillStyle = th.accent; g.font = text(32 * u); g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillText('Special offer', margin, (wide ? h * 0.3 : h * 0.24)); g.restore();
    if (b.big) {
      const bigPx = (wide ? 190 : 250) * u; g.font = display(bigPx);
      const bw = g.measureText(b.big).width; const fit = Math.min(1, (w - margin * 2) / bw);
      const px = bigPx * fit; const by = (wide ? h * 0.3 : h * 0.24) + 40 * u + px * 0.85;
      const p = outQuart(seg(t, 0.3, 0.9)); g.save(); g.beginPath(); g.rect(0, by - px, w, px * 1.3); g.clip();
      g.translate(0, (1 - p) * px * 0.7); g.globalAlpha = Math.min(1, p * 2); g.font = display(px); g.fillStyle = th.text; g.textAlign = 'left'; g.fillText(b.big, margin, by); g.restore();
      if (b.restL) drawLines(g, b.restL, margin, by + 50 * u, t, { start: 0.9, color: th.text, alpha: 0.85 });
    } else drawLines(g, b.L, margin, (wide ? h * 0.3 : h * 0.24) + 40 * u, t, { start: 0.4, color: th.text });
  } else if (b.type === 'end') {
    themedBg(g, w, h, th, t, 7);
    const cx = w / 2;
    const lh = logo ? logo.height * Math.min(((wide ? 110 : 150) * u) / logo.width, ((wide ? 110 : 150) * u) / logo.height) : 0;
    const bh = 96 * u;
    const totalH = (logo ? lh + 56 * u : 0) + blockH(b.nameL) + 40 * u + (b.ctaL ? blockH(b.ctaL) + 40 * u : 0) + bh + (input.city ? 80 * u : 0);
    let y = Math.max(h * 0.1, (h - totalH) / 2);
    if (logo) {
      const s = Math.min(((wide ? 110 : 150) * u) / logo.width, ((wide ? 110 : 150) * u) / logo.height); const p = outCubic(seg(t, 0.1, 0.7));
      g.save(); g.globalAlpha = p; g.fillStyle = 'rgba(255,255,255,0.96)'; g.beginPath(); g.roundRect(cx - logo.width * s / 2 - 16 * u, y - 16 * u, logo.width * s + 32 * u, logo.height * s + 32 * u, 18 * u); g.fill();
      g.drawImage(logo, cx - logo.width * s / 2, y, logo.width * s, logo.height * s); g.restore(); y += lh + 56 * u;
    }
    drawLines(g, b.nameL, cx, y, t, { start: 0.2, align: 'center', color: th.text }); y += blockH(b.nameL) + 14 * u;
    const lp = outQuart(seg(t, 0.7, 0.8)); g.fillStyle = th.accent; g.fillRect(cx - 60 * u * lp, y, 120 * u * lp, 4 * u); y += 26 * u;
    if (b.ctaL) { drawLines(g, b.ctaL, cx, y, t, { start: 0.9, align: 'center', color: th.text, alpha: 0.78 }); y += blockH(b.ctaL) + 36 * u; }
    const bp = outCubic(seg(t, 1.3, 0.7));
    const label = input.platform === 'WhatsApp Status' ? 'Message us now' : 'Visit us today';
    g.save(); g.globalAlpha = bp; g.translate(0, (1 - bp) * 20 * u); g.font = display(34 * u);
    const bw = g.measureText(label).width + 110 * u;
    g.shadowColor = rgba(th.accent, 0.4); g.shadowBlur = 40 * u; g.fillStyle = th.accent; g.beginPath(); g.roundRect(cx - bw / 2, y, bw, bh, bh / 2); g.fill(); g.shadowBlur = 0;
    g.fillStyle = th.btn; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, cx, y + bh / 2 + 2 * u); g.restore();
    y += bh + 52 * u;
    if (input.city) {
      const p = outCubic(seg(t, 1.8, 0.6)); g.save(); g.globalAlpha = p * 0.85; g.font = text(34 * u); g.fillStyle = th.text; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      const tw = g.measureText(input.city).width; g.fillText(input.city, cx + 18 * u, y + 28 * u);
      const px = cx - tw / 2 - 12 * u; const py = y + 8 * u; g.fillStyle = th.accent; g.beginPath(); g.arc(px, py, 10 * u, Math.PI, 0); g.lineTo(px, py + 22 * u); g.closePath(); g.fill();
      g.fillStyle = th.btn; g.beginPath(); g.arc(px, py, 4 * u, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  g.restore();
}

// ------------------------------------------------------------------ main
export async function renderStudioVideo({ content, input, photoBufs = [], logoBuf, audio, size, outDir, timeoutMs = 180000, music = true }) {
  ensureFonts();
  const started = Date.now(); const notes = [];
  const { w, h } = size; const u = Math.min(w, h) / 720;
  await fs.mkdir(outDir, { recursive: true });
  const canvas = createCanvas(w, h); const g = canvas.getContext('2d');
  const th = themeFor(input.tone);

  let audioSec = 0; let audioFile = null;
  if (audio) {
    audioFile = path.join(outDir, `voice.${audio.ext}`); await fs.writeFile(audioFile, audio.buffer);
    audioSec = await probe(audioFile);
    if (!audioSec) { notes.push('The voiceover file could not be read, so the video has no voice.'); audioFile = null; }
  }
  const HOOK = 2.8; const VOICE_DELAY = 0.5;
  const sceneDur = Math.min(4.6, Math.max(2.8, audioSec ? (audioSec + VOICE_DELAY - HOOK + 0.6) / 3 : 3.2));

  const photos = await Promise.all([0, 1, 2, 3].map((i) => (photoBufs[i] ? loadImage(photoBufs[i]).catch(() => null) : null)));
  const logo = logoBuf ? await loadImage(logoBuf).catch(() => null) : null;
  const c = { g, w, h, u, th, input, content, logo, photos, sceneDur };
  const beats = buildBeats(c);
  beats.forEach((b, i) => { b.start = beats.slice(0, i).reduce((s, x) => s + x.dur, 0); });
  const total = beats.reduce((s, b) => s + b.dur, 0);
  const frames = Math.round(total * FPS);

  let musicFile = null;
  if (music) { musicFile = path.join(outDir, 'music.wav'); await fs.writeFile(musicFile, makeMusic(total + 1, { bpm: 96 })); }
  const out = path.join(outDir, 'promo.mp4');
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${w}x${h}`, '-r', String(FPS), '-i', 'pipe:0'];
  let ai = 1; const idx = {};
  if (audioFile) { args.push('-i', audioFile); idx.voice = ai++; }
  if (musicFile) { args.push('-i', musicFile); idx.music = ai++; }
  const chains = []; const fade = Math.max(0, total - 1.4);
  if (idx.voice && idx.music) {
    chains.push(`[${idx.voice}:a]adelay=${VOICE_DELAY * 1000}|${VOICE_DELAY * 1000},volume=1.9[v]`);
    chains.push(`[${idx.music}:a]volume=0.2,afade=t=in:d=0.8,afade=t=out:st=${fade.toFixed(2)}:d=1.3[m]`);
    chains.push('[v][m]amix=inputs=2:duration=longest,volume=2[a]');
  } else if (idx.voice) chains.push(`[${idx.voice}:a]adelay=${VOICE_DELAY * 1000}|${VOICE_DELAY * 1000},volume=1.5[a]`);
  else if (idx.music) chains.push(`[${idx.music}:a]volume=0.5,afade=t=in:d=0.8,afade=t=out:st=${fade.toFixed(2)}:d=1.3[a]`);
  if (chains.length) args.push('-filter_complex', chains.join(';'), '-map', '0:v', '-map', '[a]', '-c:a', 'aac', '-b:a', '128k');
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-t', total.toFixed(2), out);

  const stills = [];
  await new Promise((resolve, reject) => {
    let err = '';
    const p = spawn(ffmpegPath(), args, { stdio: ['pipe', 'ignore', 'pipe'] });
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(Object.assign(new Error('video rendering timed out'), { code: 'TIMEOUT' })); }, timeoutMs);
    p.stderr.on('data', (d) => { err = (err + d).slice(-3000); });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.stdin.on('error', () => {});
    p.on('close', (code) => { clearTimeout(timer); if (code === 0) resolve(); else reject(new Error(`ffmpeg failed: ${err.split('\n').filter(Boolean).slice(-2).join(' ')}`)); });
    (async () => {
      try {
        for (let f = 0; f < frames; f++) {
          const T = f / FPS;
          let bi = beats.findIndex((b) => T < b.start + b.dur); if (bi < 0) bi = beats.length - 1;
          const b = beats[bi]; const t = T - b.start;
          g.clearRect(0, 0, w, h);
          const TR = 0.45;
          if (bi > 0 && t < TR) {
            const prev = beats[bi - 1]; drawBeat(c, prev, prev.dur);
            g.save(); g.globalAlpha = inOut(t / TR); drawBeat(c, b, t); g.restore();
          } else drawBeat(c, b, t);
          finish(g, w, h, f);
          g.fillStyle = th.accent; g.fillRect(0, h - 4 * u, w * (T / total), 4 * u);
          if (b.type === 'scene' && !stills[b.idx] && t >= b.dur * 0.8) stills[b.idx] = canvas.toBuffer('image/png');
          const buf = Buffer.from(canvas.data());
          await new Promise((res, rej) => p.stdin.write(buf, (e) => (e ? rej(e) : res())));
        }
        p.stdin.end();
      } catch (e) { p.kill('SIGKILL'); reject(e); }
    })();
  });
  return { file: out, hasAudio: !!audioFile, hasMusic: !!musicFile, seconds: (Date.now() - started) / 1000, duration: total, stills, notes };
}

function probe(file) {
  return new Promise((resolve) => {
    let err = '';
    const p = spawn(ffmpegPath(), ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    const t = setTimeout(() => p.kill('SIGKILL'), 15000);
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => { clearTimeout(t); resolve(0); });
    p.on('close', () => { clearTimeout(t); const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err); resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0); });
  });
}
