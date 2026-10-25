/** Template content used when there is no API key (or the user picks Demo mode). No network needed. */
export function demoContent(input) {
  const { businessName: b, productName: p, offer, city, language: lang } = input;
  const at = city ? ` ${city}` : '';
  const T = {
    English: {
      headline: `${p} you will love`,
      caption: `Fresh from ${b}${city ? `, ${city}` : ''}! ✨\n${offer ? `${offer}. ` : ''}Come try our ${p} today.\nTag a friend who needs this 👇`,
      cta: 'Visit us today',
      narration: `${b} presents ${p}. ${offer ? offer + '. ' : ''}Made with care, loved by everyone. Visit us${city ? ' in ' + city : ''} today.`,
      scenes: [b, p, offer || 'Visit us today'],
    },
    Hinglish: {
      headline: `${p}, bilkul alag mazaa`,
      caption: `${b}${at} mein aaya hai ${p}! ✨\n${offer ? `${offer}. ` : ''}Aaj hi try karo.\nApne dost ko tag karo 👇`,
      cta: 'Aaj hi aayiye',
      narration: `${b} laaya hai ${p}. ${offer ? offer + '. ' : ''}Aaj hi hamari dukaan par aayiye.`,
      scenes: [b, p, offer || 'Aaj hi aayiye'],
    },
    Hindi: {
      headline: `${p}, एकदम अलग स्वाद`,
      caption: `${b}${at} में आ गया है ${p}! ✨\n${offer ? `${offer}। ` : ''}आज ही आज़माइए।\nअपने दोस्त को टैग करें 👇`,
      cta: 'आज ही आइए',
      narration: `${b} लाया है ${p}। ${offer ? offer + '। ' : ''}आज ही हमारी दुकान पर आइए।`,
      scenes: [b, p, offer || 'आज ही आइए'],
    },
  }[lang] || null;
  const t = T || demoContent({ ...input, language: 'English' });
  if (!T) return t;
  return {
    headline: t.headline, caption: t.caption, cta: t.cta, narration: t.narration,
    hashtags: ['#' + b.replace(/[^\p{L}\p{N}]/gu, ''), '#' + p.replace(/[^\p{L}\p{N}]/gu, ''), '#LocalBusiness', '#ShopLocal', '#MadeInIndia', '#SmallBusiness'].filter((h) => h.length > 1),
    scenes: t.scenes.map((c, i) => ({ caption: c, imagePrompt: `${p}, scene ${i + 1}` })),
  };
}
