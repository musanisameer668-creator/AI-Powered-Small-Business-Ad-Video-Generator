import { createCanvas, loadImage } from '@napi-rs/canvas';
import { env } from '../../config/env.js';
import { buildImagePrompt } from '../prompt/promptBuilder.js';

const DIMS = { 'Portrait Reel': [576, 1024], 'Square Post': [768, 768], 'Landscape Video': [1024, 576] };

/** Keyless picture source (Pollinations). Used when Gemini images are unavailable, e.g. free keys with image limit 0. */
export async function generateFreeImage(scenePrompt, input, seed = 1) {
  const errs = [];
  if (env.FREE_IMAGE_URL && env.FREE_IMAGE_URL !== 'off') {
    try { return await pollinations(scenePrompt, input, seed); } catch (e) { errs.push(`Pollinations: ${e.message}`); }
  }
  if (env.STOCK_IMAGE_URL && env.STOCK_IMAGE_URL !== 'off') {
    try { return await stockPhoto(input, seed); } catch (e) { errs.push(`stock photos: ${e.message}`); }
  }
  throw new Error(errs.join('; ') || 'free image source is turned off');
}

/** Last-resort keyless source: real stock photos matched on keywords from the product (LoremFlickr). */
async function stockPhoto(input, seed) {
  const [w, h] = DIMS[input.format] || DIMS['Portrait Reel'];
  const words = `${input.productName || ''} ${input.category || ''} ${input.businessName || ''}`.toLowerCase().match(/[a-z]{3,}/g) || [];
  const tags = [...new Set(words)].slice(0, 2).join(',') || 'shop';
  const url = `${env.STOCK_IMAGE_URL.replace(/\/$/, '')}/${w}/${h}/${tags}?lock=${seed}`;
  let res;
  try { res = await fetch(url, { signal: AbortSignal.timeout(env.FREE_IMAGE_TIMEOUT_MS), headers: { 'User-Agent': 'Mozilla/5.0 AdMitra' } }); }
  catch (e) { throw new Error(e.name === 'TimeoutError' ? 'no answer in time' : `cannot connect (${e.cause?.code || e.message})`); }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!(res.headers.get('content-type') || '').startsWith('image/') || buf.length < 500) throw new Error('did not return a picture');
  return { buffer: buf, model: 'Stock photo (free)', stock: true };
}

async function pollinations(scenePrompt, input, seed) {
  const [w, h] = DIMS[input.format] || DIMS['Portrait Reel'];
  const prompt = encodeURIComponent(buildImagePrompt(scenePrompt, input).slice(0, 600));
  const url = `${env.FREE_IMAGE_URL.replace(/\/$/, '')}/${prompt}?width=${w}&height=${h}&nologo=true&seed=${seed}`;
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(env.FREE_IMAGE_TIMEOUT_MS), headers: { 'User-Agent': 'Mozilla/5.0 AdMitra' } });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError' ? 'no answer in time' : `cannot connect (${e.cause?.code || e.message})`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') || '';
  const buf = Buffer.from(await res.arrayBuffer());
  if (!type.startsWith('image/') || buf.length < 500) throw new Error('did not return a picture');
  return { buffer: buf, model: 'Pollinations (free)' };
}

/** Free services stamp a small watermark along the bottom edge; cut it off. */
export async function cropBottom(buf, frac = 0.09) {
  const img = await loadImage(buf);
  const h = Math.round(img.height * (1 - frac));
  const c = createCanvas(img.width, h);
  c.getContext('2d').drawImage(img, 0, 0, img.width, h, 0, 0, img.width, h);
  return c.toBuffer('image/png');
}

export async function flipImage(buf) {
  const img = await loadImage(buf);
  const c = createCanvas(img.width, img.height);
  const g = c.getContext('2d');
  g.translate(img.width, 0); g.scale(-1, 1);
  g.drawImage(img, 0, 0);
  return c.toBuffer('image/png');
}

/** A zoomed close-up of a different part of the picture (variant 0..5), so reused pictures do not look identical. */
export async function detailCrop(buf, variant = 0) {
  const img = await loadImage(buf);
  const zoom = [1.55, 1.8, 1.55, 2.0][variant % 4];
  const anchors = [[0.15, 0.2], [0.85, 0.75], [0.5, 0.85], [0.8, 0.15]][variant % 4];
  const cw = img.width / zoom; const ch = img.height / zoom;
  const sx = (img.width - cw) * anchors[0]; const sy = (img.height - ch) * anchors[1];
  const c = createCanvas(img.width, img.height);
  const g = c.getContext('2d');
  if (variant % 2 === 1) { g.translate(img.width, 0); g.scale(-1, 1); }
  g.drawImage(img, sx, sy, cw, ch, 0, 0, img.width, img.height);
  return c.toBuffer('image/png');
}
