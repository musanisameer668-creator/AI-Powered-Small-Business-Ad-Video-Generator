import http from 'node:http';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';

export function png() {
  const c = createCanvas(256, 256); const g = c.getContext('2d');
  g.fillStyle = '#e11d48'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#fbbf24'; g.fillRect(40, 40, 120, 120);
  return c.toBuffer('image/png');
}

/** A stand-in for Google's Interactions API. mode: ok | hang | quota | noimage */
export async function startFakeGemini(mode = 'ok') {
  const state = { mode, calls: [] };
  const scenes = [0, 1, 2].map((i) => ({ caption: ['Garma garam chai', 'Samosa ke saath', '2 pe 1 free'][i], imagePrompt: `chai and samosa scene ${i}` }));
  const content = { headline: 'Chai ka asli mazaa', caption: 'Sharma Chai Corner mein aaiye ☕', cta: 'Aaj hi aayiye', hashtags: ['#chai', 'samosa'], narration: 'शर्मा चाय कॉर्नर में आइए। दो चाय पर एक समोसा बिल्कुल मुफ़्त।', scenes };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      if (req.url.startsWith('/free')) { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(png()); }
      let j = {}; try { j = JSON.parse(body); } catch { /* ignore */ }
      state.calls.push({ url: req.url, model: j.model, type: j.response_format?.type });
      if (state.mode === 'hang') return; // never answer
      if (state.mode === 'quota') { res.writeHead(429, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 429, message: 'Quota exceeded', status: 'RESOURCE_EXHAUSTED' } })); }
      const rf = Array.isArray(j.response_format) ? j.response_format[0] : j.response_format;
      let part;
      if (rf?.type === 'image') {
        if (state.mode === 'noimage') { res.writeHead(404, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ error: { code: 404, message: 'model not found' } })); }
        part = { type: 'image', mime_type: 'image/png', data: png().toString('base64') };
      } else if (rf?.type === 'audio') {
        const pcm = Buffer.alloc(24000 * 2 * 3); for (let i = 0; i < pcm.length; i += 2) pcm.writeInt16LE(Math.round(Math.sin(i / 40) * 6000), i);
        part = { type: 'audio', mime_type: 'audio/l16;rate=24000', data: pcm.toString('base64') };
      } else if (rf?.type === 'text' && rf.schema) part = { type: 'text', text: JSON.stringify(content) };
      else part = { type: 'text', text: 'ok' };
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'x', status: 'completed', model: j.model, steps: [{ type: 'model_output', content: [part] }] }));
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { state, url: `http://127.0.0.1:${server.address().port}`, close: () => { server.closeAllConnections?.(); server.close(); } };
}

/** Boots the real Express app on a random port with env pointing at temp dirs and the fake Gemini. */
export async function boot({ gemini = true, mode = 'ok', env = {} } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'admitra-test-'));
  const fake = await startFakeGemini(mode);
  Object.assign(process.env, {
    DATA_DIR: path.join(tmp, 'data'), STORAGE_DIR: path.join(tmp, 'storage'), JWT_SECRET: 'test', MONGODB_URI: '',
    GEMINI_API_KEY: gemini ? 'test-key' : '', GEMINI_BASE_URL: fake.url,
    TEXT_TIMEOUT_MS: '2500', IMAGE_TIMEOUT_MS: '2500', IMAGES_TOTAL_MS: '6000', TTS_TIMEOUT_MS: '2500', JOB_TIMEOUT_MS: '60000',
    TTS_FALLBACK_URL: `${fake.url}/tts-missing`, FREE_IMAGE_URL: `${fake.url}/free`, STOCK_IMAGE_URL: 'off', RATE_LIMIT_AUTH: '1000', ...env,
  });
  const { initRepository } = await import('../../src/repositories/index.js');
  await initRepository();
  const { createApp } = await import('../../src/app.js');
  const server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const api = async (method, url, { token, body, form } = {}) => {
    const res = await fetch(base + url, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, body: ct.includes('json') ? await res.json() : null, res };
  };
  const signup = async (email = `u${Math.random().toString(36).slice(2)}@t.com`) =>
    (await api('POST', '/auth/register', { body: { name: 'Tester', email, password: 'secret12' } })).body;
  const waitFor = async (id, token, ms = 60000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const { body } = await api('GET', `/projects/${id}`, { token });
      if (['ready', 'failed'].includes(body.project.status)) return body.project;
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error('job did not finish');
  };
  return { base, api, signup, waitFor, fake, close: () => { server.close(); fake.close(); } };
}

export const INPUT = {
  businessName: 'Sharma Chai Corner', productName: 'Masala Chai and Samosa', description: 'Garma garam chai', usp: 'Fresh daily',
  offer: '2 chai pe 1 samosa free', city: 'Mumbai', goal: 'Festival Offer', audience: 'Office workers', tone: 'Friendly and energetic',
  platform: 'WhatsApp Status', format: 'Portrait Reel', language: 'Hinglish',
};
