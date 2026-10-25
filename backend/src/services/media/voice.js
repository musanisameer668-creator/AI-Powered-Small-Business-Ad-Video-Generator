import { generateSpeech } from '../ai/gemini.js';

const FALLBACK = () => process.env.TTS_FALLBACK_URL || 'https://translate.google.com/translate_tts';

function chunk(text, max = 180) {
  const parts = text.replace(/\s+/g, ' ').split(/(?<=[.!?।])\s+/); const out = []; let cur = '';
  for (const p of parts) {
    if ((cur + ' ' + p).trim().length <= max) cur = (cur + ' ' + p).trim();
    else { if (cur) out.push(cur); cur = p.slice(0, max); }
  }
  if (cur) out.push(cur);
  return out;
}

async function googleTranslateTts(text, language) {
  const tl = language === 'English' ? 'en' : 'hi';
  const bufs = [];
  for (const part of chunk(text)) {
    const url = `${FALLBACK()}?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(part)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const b = Buffer.from(await res.arrayBuffer());
    if (b.length < 200) throw new Error('empty audio');
    bufs.push(b);
  }
  return Buffer.concat(bufs);
}

/**
 * Voice-over with fallbacks: Gemini TTS, then Google Translate voice, then none.
 * Never throws. Returns { audio: {buffer, ext} | null, source, notes }.
 */
export async function makeVoice({ text, language, key }) {
  const notes = [];
  const clean = String(text || '').replace(/[#*_`]/g, '').trim();
  if (!clean) return { audio: null, source: 'none', notes: ['No narration text, so the video has no voiceover.'] };
  if (key) {
    try {
      const r = await generateSpeech(key, clean, language);
      return { audio: { buffer: r.buffer, ext: 'wav' }, source: `Gemini (${r.model})`, notes };
    } catch (e) {
      notes.push(`Gemini voice unavailable: ${e.classified?.message || e.message}`);
    }
  }
  try {
    const buffer = await googleTranslateTts(clean, language);
    return { audio: { buffer, ext: 'mp3' }, source: 'Google Translate voice', notes };
  } catch (e) {
    notes.push(`Backup voice unavailable (${e.message}). The video was made without a voiceover.`);
  }
  return { audio: null, source: 'none', notes };
}
