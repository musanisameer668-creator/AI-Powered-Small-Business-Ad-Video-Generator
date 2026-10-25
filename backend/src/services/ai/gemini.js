import { GoogleGenAI } from '@google/genai';
import { env } from '../../config/env.js';
import { withDeadline } from '../../utils/time.js';
import { AiError, classifyError } from './errors.js';
import { CONTENT_SCHEMA, buildContentPrompt, buildImagePrompt, aspectFor, parseJsonLoose, normalizeContent } from '../prompt/promptBuilder.js';

const clients = new Map();
function client(key) {
  if (!clients.has(key)) {
    clients.set(key, new GoogleGenAI({ apiKey: key, ...(env.GEMINI_BASE_URL ? { httpOptions: { baseUrl: env.GEMINI_BASE_URL } } : {}) }));
  }
  return clients.get(key);
}

/** One Gemini call that can never hang: SDK timeout, zero SDK retries, plus an outer deadline. */
async function call(key, params, timeoutMs) {
  const ac = new AbortController();
  const run = client(key).interactions.create(params, { timeout: timeoutMs, maxRetries: 0, fetchOptions: { signal: ac.signal } });
  try {
    return await withDeadline(run, timeoutMs + 2000, 'Gemini request');
  } catch (e) {
    ac.abort();
    run.catch?.(() => {});
    throw e;
  }
}

export async function generateContent(key, input) {
  const prompt = buildContentPrompt(input);
  let last;
  for (const model of env.TEXT_MODELS) {
    // 1st try: strict JSON schema. 2nd try: plain request, JSON is parsed from the reply.
    for (const structured of [true, false]) {
      try {
        const params = { model, input: structured ? prompt : `${prompt}\n\nReply with one JSON object with the keys headline, caption, cta, hashtags, narration, scenes.` };
        if (structured) params.response_format = { type: 'text', mime_type: 'application/json', schema: CONTENT_SCHEMA };
        const r = await call(key, params, env.TEXT_TIMEOUT_MS);
        return normalizeContent(parseJsonLoose(r.output_text), input);
      } catch (e) {
        last = e instanceof SyntaxError ? Object.assign(new Error('Gemini returned text that is not valid JSON'), { status: 0 }) : e;
        const c = classifyError(last);
        console.warn(`[gemini:text] ${model}${structured ? '' : ' (plain)'} failed: ${c.kind}: ${c.detail}`);
        if (['key', 'quota', 'timeout', 'network'].includes(c.kind)) throw new AiError('text', last);
      }
    }
  }
  throw new AiError('text', last);
}

/**
 * Makes one image. Walks the model list; stops early on key/quota errors (a different model will not help).
 * `shared.dead` remembers models that are unavailable so the other images skip them.
 */
export async function generateImage(key, scenePrompt, input, shared = { dead: new Set(), notes: [] }) {
  const aspect = aspectFor(input.format);
  const prompt = buildImagePrompt(scenePrompt, input);
  let last;
  for (const model of env.IMAGE_MODELS) {
    if (shared.dead.has(model)) continue;
    // 1st try: ask for the aspect ratio. 2nd try: plain request (some models reject response_format).
    for (const withFormat of [true, false]) {
      try {
        const params = { model, input: withFormat ? prompt : `${prompt} Aspect ratio ${aspect}.` };
        if (withFormat) params.response_format = { type: 'image', aspect_ratio: aspect };
        const r = await call(key, params, env.IMAGE_TIMEOUT_MS);
        const data = r.output_image?.data;
        if (!data) throw Object.assign(new Error('The model returned no image'), { status: 0 });
        return { buffer: Buffer.from(data, 'base64'), model };
      } catch (e) {
        const c = classifyError(e);
        last = { ...c, model };
        console.warn(`[gemini:image] ${model}${withFormat ? '' : ' (plain)'} failed: ${c.kind}: ${c.detail}`);
        shared.errors = shared.errors || [];
        shared.errors.push(`${model}: ${c.detail}`);
        if (c.kind === 'key' || c.kind === 'quota') { shared.fatal = last; throw Object.assign(new Error(c.message), { classified: last }); }
        if (c.kind === 'timeout' || c.kind === 'network') break; // plain retry will not help
      }
    }
  }
  throw Object.assign(new Error(last?.message || 'No image model answered'), { classified: last });
}

export async function generateSpeech(key, text, language) {
  let last;
  for (const model of env.TTS_MODELS) {
    try {
      const r = await call(key, { model, input: text, response_format: { type: 'audio', mime_type: 'audio/wav' } }, env.TTS_TIMEOUT_MS);
      const a = r.output_audio;
      if (!a?.data) throw Object.assign(new Error('The model returned no audio'), { status: 0 });
      return { buffer: wavFrom(Buffer.from(a.data, 'base64'), a.mime_type, a.sample_rate), model };
    } catch (e) {
      last = classifyError(e);
      if (last.kind === 'key' || last.kind === 'quota') break;
    }
  }
  throw Object.assign(new Error(last?.message || 'No voice model answered'), { classified: last });
}

/** Gemini TTS may return raw 16-bit PCM; wrap it in a WAV header when it has none. */
export function wavFrom(buf, mime = '', rate) {
  if (buf.slice(0, 4).toString() === 'RIFF') return buf;
  const sampleRate = Number(rate) || Number(/rate=(\d+)/.exec(mime || '')?.[1]) || 24000;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + buf.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(buf.length, 40);
  return Buffer.concat([h, buf]);
}

/** Tiny request used by Settings > Test connection. */
export async function ping(key) {
  try {
    const r = await call(key, { model: env.TEXT_MODELS[0], input: 'Reply with the single word: ok' }, 15000);
    return { ok: true, model: env.TEXT_MODELS[0], reply: (r.output_text || '').slice(0, 40) };
  } catch (e) {
    const c = classifyError(e);
    return { ok: false, kind: c.kind, message: c.message, detail: c.detail };
  }
}
