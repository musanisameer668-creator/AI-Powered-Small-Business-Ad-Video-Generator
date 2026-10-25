import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { getRepo } from '../../repositories/index.js';
import { withDeadline, sleep } from '../../utils/time.js';
import { AiError, classifyError } from '../ai/errors.js';
import { generateContent, generateImage } from '../ai/gemini.js';
import { generateFreeImage, cropBottom, detailCrop } from '../ai/freeImages.js';
import { demoContent } from '../ai/demo.js';
import { makeVoice } from '../media/voice.js';
import { renderScene, renderEndCard, sizeFor } from '../media/frames.js';
import { buildVideo } from '../media/video.js';
import { renderStudioVideo } from '../media/studio.js';

const running = new Map(); // projectId -> true
export const isRunning = (id) => running.has(id);
export const projectDir = (id) => path.join(env.STORAGE_DIR, id);

const STEPS = ['text', 'images', 'voice', 'video'];
const freshProgress = () => Object.fromEntries(STEPS.map((s) => [s, { state: 'pending', detail: '' }]));

/**
 * Starts generation in the background and returns immediately.
 * The browser polls GET /projects/:id for `progress`, so the request itself can never hang.
 */
export async function startGeneration(project, { apiKey, demo }) {
  const repo = getRepo();
  const mode = demo || !apiKey ? 'demo' : 'live';
  running.set(project.id, true);
  await repo.projects.update(project.id, {
    status: 'generating', error: '', notes: [], mode,
    progress: { ...freshProgress(), startedAt: Date.now() },
  });
  // fire and forget; errors are recorded on the project
  withDeadline(execute(project, apiKey, mode), env.JOB_TIMEOUT_MS, 'Generation')
    .catch(async (e) => {
      const msg = e instanceof AiError ? e.message
        : e.code === 'TIMEOUT' ? 'Generation took too long and was stopped. Please try again.'
        : `Generation failed: ${e.message}`;
      await repo.projects.update(project.id, { status: 'failed', error: msg });
    })
    .finally(() => running.delete(project.id));
}

async function execute(project, apiKey, mode) {
  const repo = getRepo();
  const { input } = project;
  const progress = (await repo.projects.get(project.id)).progress;
  const notes = [];
  const set = async (step, state, detail = '') => {
    progress[step] = { state, detail };
    await repo.projects.update(project.id, { progress: { ...progress } });
  };

  // 1) text ------------------------------------------------------------------------------
  await set('text', 'active', mode === 'demo' ? 'Using built-in demo text' : 'Gemini is writing your ad');
  let t0 = Date.now();
  let content;
  if (mode === 'demo') { await sleep(300); content = demoContent(input); }
  else content = await generateContent(apiKey, input);
  await set('text', 'done', `${((Date.now() - t0) / 1000).toFixed(0)}s`);
  await repo.projects.update(project.id, { content });

  // 2) images ----------------------------------------------------------------------------
  const size = sizeFor(input.format);
  const images = [null, null, null];
  const photoSet = new Set();
  const freeSet = new Set();
  const cur = await repo.projects.get(project.id);
  const photoNames = cur.assets?.photos || [];
  const photoBufs = [];
  for (const n of photoNames) { try { photoBufs.push(await fs.readFile(path.join(projectDir(project.id), n))); } catch { /* removed */ } }
  // Each user photo fills its own scene; only the remaining scenes are generated.
  photoBufs.slice(0, 3).forEach((b, i) => { images[i] = b; photoSet.add(i); });
  let hero = null; let reused = 0;
  const need = [0, 1, 2].filter((i) => !images[i]);
  const nPhotos = photoSet.size;
  if (!need.length) {
    await set('images', 'done', `Using your ${nPhotos} photos`);
  } else if (mode === 'demo') {
    await set('images', 'skipped', nPhotos ? `Your ${nPhotos} photo${nPhotos > 1 ? 's' : ''}, rest typography (demo)` : 'Demo mode: typography scenes');
    notes.push('Demo mode: add a Gemini API key to get AI-generated pictures, voice and text.');
  } else {
    t0 = Date.now();
    // Always aim for 4 AI pictures when the user gave fewer than 3 photos: the missing scenes plus a wide opening shot.
    const jobs = need.map((i) => ({ slot: i, prompt: content.scenes[i].imagePrompt }));
    jobs.push({ slot: 'hero', prompt: `${input.productName}, wide cinematic hero shot of ${input.businessName || 'the shop'}, dramatic lighting, shallow depth of field` });
    const total = jobs.length;
    await set('images', 'active', `Creating ${total} pictures with AI`);
    const store = (j, buf) => { if (j.slot === 'hero') hero = buf; else images[j.slot] = buf; };
    const have = (j) => (j.slot === 'hero' ? !!hero : !!images[j.slot]);
    const shared = { dead: new Set() };
    let done = 0; const freeErrors = [];
    const gem = (list) => Promise.race([Promise.all(list.map((j) =>
      generateImage(apiKey, j.prompt, input, shared)
        .then(async (r) => { store(j, r.buffer); done++; await set('images', 'active', `${done} of ${total} ready`); })
        .catch(() => {}))), sleep(env.IMAGES_TOTAL_MS)]);
    await gem(jobs);
    // Free keys often allow only a few image calls per minute, so a parallel burst can get just one through.
    // Retry the failed ones one at a time with a pause in between.
    if (!shared.fatal && done > 0) { // some worked, so it is a rate limit: slow retries can succeed
      const deadline = Date.now() + 80000;
      for (let pass = 0; pass < 3; pass++) {
        const again = jobs.filter((j) => !have(j));
        if (!again.length || shared.fatal || Date.now() > deadline) break;
        await set('images', 'active', `Retrying ${again.length} picture${again.length > 1 ? 's' : ''} (slower, one by one)`);
        await sleep(pass === 0 ? 4000 : 9000);
        shared.dead = new Set();
        for (const j of again) {
          if (Date.now() > deadline) break;
          await Promise.race([
            generateImage(apiKey, j.prompt, input, shared).then(async (r) => { store(j, r.buffer); done++; await set('images', 'active', `${done} of ${total} ready`); }).catch(() => {}),
            sleep(Math.min(env.IMAGE_TIMEOUT_MS, 30000)),
          ]);
        }
      }
    }
    let freeUsed = 0;
    const missing = jobs.filter((j) => !have(j));
    if (missing.length) {
      await set('images', 'active', 'Trying a free picture source');
      await Promise.all(missing.map((j, k) => generateFreeImage(j.prompt, input, k + 11)
        .then(async (r) => { store(j, await cropBottom(r.buffer).catch(() => r.buffer)); if (j.slot !== 'hero') freeSet.add(j.slot); freeUsed++; })
        .catch((e) => { freeErrors.push(e.message); })));
      if (freeUsed) notes.push(`Pictures: ${freeUsed} picture(s) came from the free backup source because Gemini image generation was not available for this key.`);
    }
    // Still gaps but at least one generated picture: cut different close-up crops of it (different area and zoom per scene)
    // so the scenes do not look identical. Several real pictures are always better, so this is only a last resort.
    const pool = [hero, ...[0, 1, 2].filter((i) => !photoSet.has(i)).map((i) => images[i])].filter(Boolean);
    if (pool.length) {
      let k = 0;
      for (const i of need) if (!images[i]) { images[i] = await detailCrop(pool[k % pool.length], k).catch(() => null); if (images[i]) { freeSet.add(i); reused++; } k++; }
      if (reused) notes.push(`Pictures: Gemini only made ${pool.length} picture(s) (free keys limit image requests per minute), so ${reused} scene(s) use a close-up crop of one. Wait a minute and use Regenerate for more, or add your own photos.`);
    }
    const got = need.filter((i) => images[i]).length;
    if (got === need.length) await set('images', 'done', `${nPhotos ? `${nPhotos} yours + ` : ''}${got} AI, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    else {
      await set('images', 'warn', `${got} of ${need.length} AI pictures made, text scenes fill the rest`);
      const why = [...(shared.errors || []).slice(0, 2), ...freeErrors.slice(0, 1).map((e) => `free source: ${e}`)].join(' | ');
      notes.push(shared.fatal ? `Pictures: ${shared.fatal.message} (${shared.fatal.detail})`
        : why ? `Pictures: text-only scenes were used where AI image generation was not available. Upload up to 3 product photos for real pictures. ${why}`
        : 'Pictures: no AI image was ready in time, so text-only scenes were used.');
    }
  }

  const sources = images.map((x, i) => (!x ? 'none' : photoSet.has(i) ? 'photo' : freeSet.has(i) ? 'free' : 'ai'));

  if (mode === 'live' && sources.includes('none')) {
    const real = sources.filter((x) => x !== 'none').length;
    await set('images', 'done', real ? `${real} picture${real > 1 ? 's' : ''}, rest typography` : 'Text scenes only: pictures unavailable (see Details > Messages)');
  }

  // 3) voice -----------------------------------------------------------------------------
  await set('voice', 'active', 'Recording the voiceover');
  const voice = await makeVoice({ text: content.narration, language: input.language, key: mode === 'live' ? apiKey : '' });
  notes.push(...voice.notes);
  await set('voice', voice.audio ? 'done' : 'warn', voice.audio ? voice.source : 'No voiceover');

  // 4) video -----------------------------------------------------------------------------
  await set('video', 'active', 'Joining pictures, captions and voice');
  t0 = Date.now();
  const dir = projectDir(project.id);
  await fs.mkdir(dir, { recursive: true });
  let logo = null;
  try { logo = await fs.readFile(path.join(dir, 'logo.png')); } catch { /* no logo uploaded */ }
  const frames = [];
  for (let i = 0; i < 3; i++) {
    frames.push(await renderScene({ image: images[i], caption: content.scenes[i].caption, index: i, size, businessName: input.businessName }));
  }
  frames.push(await renderEndCard({ businessName: input.businessName, offer: input.offer, city: input.city, cta: content.cta, size, logo }));
  // the scene pictures (with captions) are also offered as downloads
  const imageNames = [];
  for (let i = 0; i < 3; i++) { const n = `scene${i + 1}.png`; await fs.writeFile(path.join(dir, n), frames[i]); imageNames.push(n); }
  let video;
  const workDir = path.join(dir, 'work');
  try {
    video = await renderStudioVideo({ content, input, photoBufs: [...images, hero], logoBuf: logo, audio: voice.audio, size, outDir: workDir, timeoutMs: env.VIDEO_TIMEOUT_MS, music: process.env.MUSIC !== 'off' });
  } catch (e) {
    console.warn('[video] animated renderer failed, using simple slideshow:', e.message);
    notes.push(`Animated video effects were skipped (${e.message}); a simple slideshow was made instead.`);
    try {
      video = await buildVideo({ frames, audio: voice.audio, size, outDir: workDir });
    } catch (e2) {
      throw new Error(`The video could not be built (${e2.message})`);
    }
  }
  if (video.stills?.length === 3 && video.stills.every(Boolean)) for (let i = 0; i < 3; i++) await fs.writeFile(path.join(dir, imageNames[i]), video.stills[i]);
  await fs.copyFile(video.file, path.join(dir, 'promo.mp4'));
  let audioName = '';
  if (voice.audio) { audioName = `voice.${voice.audio.ext}`; try { await fs.copyFile(path.join(workDir, audioName), path.join(dir, audioName)); } catch { audioName = ''; } }
  await fs.rm(workDir, { recursive: true, force: true });
  notes.push(...video.notes);
  await set('video', 'done', `${((Date.now() - t0) / 1000).toFixed(0)}s`);

  await repo.projects.update(project.id, {
    status: 'ready', error: '', notes,
    assets: { logo: logo ? 'logo.png' : '', video: 'promo.mp4', audio: audioName, images: imageNames, aiImages: sources.map((x) => x === 'ai' || x === 'free'), photos: photoNames, hasMusic: !!video.hasMusic, imageSources: sources, hasVoice: !!voice.audio, voiceSource: voice.source },
  });
}

export async function removeProjectFiles(id) {
  await fs.rm(projectDir(id), { recursive: true, force: true });
}
export { classifyError };
