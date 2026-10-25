import { getRepo } from '../repositories/index.js';
import { env } from '../config/env.js';
import { ping, generateImage } from '../services/ai/gemini.js';
import { generateFreeImage } from '../services/ai/freeImages.js';
import { MESSAGES } from '../services/ai/errors.js';

const keyFor = (u) => u.geminiKey || env.GEMINI_API_KEY;

export function status(req, res) {
  const key = keyFor(req.user);
  res.json({
    mode: key ? 'live' : 'demo',
    keySource: req.user.geminiKey ? 'account' : env.GEMINI_API_KEY ? 'server' : 'none',
    database: getRepo().kind,
    textModel: env.TEXT_MODEL, imageModels: env.IMAGE_MODELS, ttsModels: env.TTS_MODELS,
  });
}

export async function saveKey(req, res) {
  await getRepo().users.update(req.user.id, { geminiKey: req.body.key });
  res.json({ ok: true, hasOwnKey: !!req.body.key });
}

export async function testKey(req, res) {
  const key = keyFor(req.user);
  if (!key) return res.json({ ok: false, kind: 'key', message: 'No API key is set yet. Paste one above or add GEMINI_API_KEY to backend/.env.' });
  res.json(await ping(key));
}
export { MESSAGES };

export async function testImages(req, res) {
  const key = keyFor(req.user);
  const input = { format: 'Square Post', productName: 'a cup of coffee' };
  const out = { gemini: { ok: false, detail: '' }, free: { ok: false, detail: '' } };
  if (!key) out.gemini.detail = 'No API key set.';
  else {
    const shared = { dead: new Set() };
    try { const r = await generateImage(key, 'a cup of coffee on a table', input, shared); out.gemini = { ok: true, detail: `Worked with ${r.model}` }; }
    catch (e) { out.gemini.detail = (shared.errors || [e.message]).slice(0, 4).join(' | '); }
  }
  try { const r = await generateFreeImage('a cup of coffee on a table', input, 1); out.free = { ok: true, detail: `Worked (${Math.round(r.buffer.length / 1024)} KB)` }; }
  catch (e) { out.free.detail = e.message; }
  res.json(out);
}
