import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { env } from '../../config/env.js';

const require = createRequire(import.meta.url);
const ffmpegPath = () => process.env.FFMPEG_PATH || require('@ffmpeg-installer/ffmpeg').path;

function run(args, timeoutMs) {
  return new Promise((resolve, reject) => {
    let err = '';
    const p = spawn(ffmpegPath(), args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(Object.assign(new Error('ffmpeg timed out'), { code: 'TIMEOUT' })); }, timeoutMs);
    p.stderr.on('data', (d) => { err = (err + d).slice(-4000); });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => { clearTimeout(timer); code === 0 ? resolve(err) : reject(new Error(`ffmpeg failed: ${err.split('\n').filter(Boolean).slice(-2).join(' ')}`)); });
  });
}

// `ffmpeg -i file` always exits non-zero; capture its stderr via a dedicated helper instead
async function duration(file) {
  return new Promise((resolve) => {
    let err = '';
    const p = spawn(ffmpegPath(), ['-hide_banner', '-i', file], { stdio: ['ignore', 'ignore', 'pipe'] });
    const t = setTimeout(() => p.kill('SIGKILL'), 15000);
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', () => { clearTimeout(t); resolve(0); });
    p.on('close', () => {
      clearTimeout(t);
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(err);
      resolve(m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0);
    });
  });
}

const END_SECONDS = 2.5;

/** frames: PNG buffers (3 scenes + end card). Returns { file, hasAudio, seconds, notes }. */
export async function buildVideo({ frames, audio, size, outDir }) {
  const started = Date.now(); const notes = [];
  await fs.mkdir(outDir, { recursive: true });
  const files = [];
  for (let i = 0; i < frames.length; i++) {
    const f = path.join(outDir, `frame${i}.png`); await fs.writeFile(f, frames[i]); files.push(f);
  }
  let audioFile = null; let audioSec = 0;
  if (audio) {
    audioFile = path.join(outDir, `voice.${audio.ext}`);
    await fs.writeFile(audioFile, audio.buffer);
    audioSec = await duration(audioFile);
    if (!audioSec) { notes.push('The voiceover file could not be read, so the video has no sound.'); audioFile = null; }
  }
  const sceneCount = frames.length - 1;
  const per = Math.max(((audioSec ? audioSec + 0.6 : 9)) / sceneCount, 2.6);
  const durs = [...Array(sceneCount).fill(per), END_SECONDS];
  const out = path.join(outDir, 'promo.mp4');

  const build = (zoom) => {
    const args = ['-y', '-hide_banner', '-loglevel', 'error'];
    files.forEach((f, i) => args.push('-loop', '1', '-framerate', '25', '-t', String(durs[i]), '-i', f));
    if (audioFile) args.push('-i', audioFile);
    const parts = files.map((_, i) => {
      const d = durs[i];
      const base = zoom
        ? `scale=${size.w * 2}:${size.h * 2},zoompan=z='min(zoom+0.0007,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${size.w}x${size.h}:fps=25`
        : `scale=${size.w}:${size.h}`;
      return `[${i}:v]${base},fade=t=in:st=0:d=0.3,fade=t=out:st=${(d - 0.3).toFixed(2)}:d=0.3,setsar=1,format=yuv420p[v${i}]`;
    });
    const concat = `${files.map((_, i) => `[v${i}]`).join('')}concat=n=${files.length}:v=1:a=0[v]`;
    args.push('-filter_complex', [...parts, concat].join(';'), '-map', '[v]');
    if (audioFile) args.push('-map', `${files.length}:a`, '-af', 'apad', '-c:a', 'aac', '-b:a', '128k');
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '24', '-r', '25', '-movflags', '+faststart', '-t', durs.reduce((a, b) => a + b, 0).toFixed(2), out);
    return args;
  };

  try {
    await run(build(true), env.VIDEO_TIMEOUT_MS);
  } catch (e) {
    if (e.code === 'TIMEOUT') throw e;
    notes.push('Zoom effect skipped on this computer; the video uses plain slides.');
    await run(build(false), env.VIDEO_TIMEOUT_MS);
  }
  return { file: out, hasAudio: !!audioFile, seconds: (Date.now() - started) / 1000, notes };
}
