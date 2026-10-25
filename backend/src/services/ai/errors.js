/** Turns any SDK / network error into one of a few kinds with a message a shop owner can act on. */
export function classifyError(err) {
  const text = `${err?.status ?? ''} ${err?.code ?? ''} ${err?.name ?? ''} ${err?.message ?? ''} ${err?.cause?.code ?? ''}`.toLowerCase();
  const status = Number(err?.status) || 0;
  let kind = 'other';
  if (/billing|free tier is not available|upgrade to the paid tier/.test(text)) kind = 'billing';
  else if (status === 401 || status === 403 || /api key|api_key|permission_denied|unauthenticated|invalid.*key/.test(text)) kind = 'key';
  else if (status === 429 || /quota|resource_exhausted|rate limit|too many requests/.test(text)) kind = 'quota';
  else if (err?.code === 'TIMEOUT' || /timed out|timeout|abort/.test(text)) kind = 'timeout';
  else if (/enotfound|econnrefused|econnreset|eai_again|fetch failed|network|getaddrinfo|socket/.test(text)) kind = 'network';
  else if (status === 404 || /not found|not supported|unsupported model|is not available/.test(text)) kind = 'model';
  else if (status === 400 && /model|response_format|modalit/.test(text)) kind = 'model';
  return { kind, message: MESSAGES[kind], detail: String(err?.message || err).slice(0, 300) };
}

export const MESSAGES = {
  billing: 'The free tier is not available for this Google project. In Google AI Studio, click "Create API key in NEW project" (or use another Google account), or set up billing at aistudio.google.com/billing.',
  key: 'Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env, or save a new key in Settings.',
  quota: 'The free Gemini limit has been reached for now. Wait a minute and try again, or use another key.',
  timeout: 'Gemini did not answer in time. Please try again.',
  network: "Could not reach Google's servers. Check your internet connection and try again.",
  model: 'That Gemini model is not available for this key.',
  other: 'Gemini could not complete the request.',
};

/** Error carrying a friendly message plus the raw detail for the Notes list. */
export class AiError extends Error {
  constructor(step, err) {
    const c = err instanceof AiError ? err : classifyError(err);
    // for unknown errors, show the real reason so it can be fixed
    super(c.kind === 'other' || c.kind === 'model' ? `${c.message} (${c.detail})` : c.message);
    console.warn(`[gemini:${step}] ${c.kind}: ${c.detail}`);
    this.step = step;
    this.kind = c.kind;
    this.detail = c.detail;
  }
}
