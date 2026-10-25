const LANG_RULES = {
  Hindi: 'Write everything in Hindi using Devanagari script.',
  English: 'Write everything in simple, natural Indian English.',
  Hinglish: 'Write the headline, caption, CTA and scene captions in Hinglish (Hindi words typed in Roman letters, the way people text in India). Write "narration" in Hindi using Devanagari script so a Hindi voice can read it correctly.',
};

export const aspectFor = (format) => ({ 'Portrait Reel': '9:16', 'Square Post': '1:1', 'Landscape Video': '16:9' }[format] || '9:16');

export const CONTENT_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'Catchy headline, max 8 words' },
    caption: { type: 'string', description: 'Social media caption, 2-3 short lines with a few emojis' },
    cta: { type: 'string', description: 'Call to action, max 8 words' },
    hashtags: { type: 'array', items: { type: 'string' }, description: '6 to 8 hashtags each starting with #' },
    narration: { type: 'string', description: 'Voiceover script, 25 to 40 words, speakable, no emojis' },
    scenes: {
      type: 'array',
      description: 'Exactly 3 storyboard scenes',
      items: {
        type: 'object',
        properties: {
          caption: { type: 'string', description: 'On-screen text, max 6 words' },
          imagePrompt: { type: 'string', description: 'English description of the picture to generate, no text in the image' },
        },
        required: ['caption', 'imagePrompt'],
      },
    },
  },
  required: ['headline', 'caption', 'cta', 'hashtags', 'narration', 'scenes'],
};

export function buildContentPrompt(input) {
  const lines = [
    'You are an advertising copywriter for small Indian businesses. Create a short social media video ad.',
    '',
    `Business: ${input.businessName}`,
    `Product or service: ${input.productName}`,
    input.description && `About it: ${input.description}`,
    input.usp && `What makes it special: ${input.usp}`,
    input.offer && `Offer: ${input.offer}`,
    input.city && `City: ${input.city}`,
    `Campaign goal: ${input.goal}`,
    input.audience && `Target audience: ${input.audience}`,
    `Tone: ${input.tone}`,
    `Platform: ${input.platform} (${input.format})`,
    '',
    LANG_RULES[input.language] || LANG_RULES.English,
    'Only mention facts and offers given above. Do not invent prices, phone numbers or addresses.',
    'Return exactly 3 scenes: 1) attention-grabbing opening, 2) the product and its benefit, 3) the offer and call to action.',
    'imagePrompt is always in English and describes a clean, appealing advertising photo with no text or logos in it.',
    'Return JSON only.',
  ];
  return lines.filter((l) => l !== undefined && l !== false && l !== '').join('\n');
}

export function buildImagePrompt(scenePrompt, input) {
  return `${scenePrompt}. Professional advertising photograph for "${input.productName}" by a small business in India. ` +
    'Vibrant, well lit, clean composition, space for a caption at the bottom. No text, no letters, no watermark, no logo.';
}

/** Extract the JSON object even when the model wraps it in code fences. */
export function parseJsonLoose(text) {
  if (!text) throw new Error('Empty response from the model');
  let t = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{'); const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

/** Fix shape problems so the rest of the pipeline can rely on it. */
export function normalizeContent(raw, input) {
  const s = (v, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);
  const tags = (Array.isArray(raw.hashtags) ? raw.hashtags : [])
    .map((h) => String(h).trim().replace(/\s+/g, '')).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)).slice(0, 10);
  const scenes = (Array.isArray(raw.scenes) ? raw.scenes : []).slice(0, 3).map((x, i) => ({
    caption: s(x?.caption, i === 0 ? input.businessName : i === 1 ? input.productName : input.offer || 'Visit us today').slice(0, 80),
    imagePrompt: s(x?.imagePrompt, `${input.productName}, attractive product shot`),
  }));
  while (scenes.length < 3) {
    scenes.push({ caption: scenes.length === 1 ? input.productName : input.offer || input.businessName, imagePrompt: `${input.productName}, attractive product shot` });
  }
  const headline = s(raw.headline, `${input.productName} at ${input.businessName}`);
  return {
    headline,
    caption: s(raw.caption, `${headline}\n${input.offer || ''}`.trim()),
    cta: s(raw.cta, 'Visit us today'),
    hashtags: tags,
    narration: s(raw.narration, `${headline}. ${input.offer || ''}`.trim()),
    scenes,
  };
}
