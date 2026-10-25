import path from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { ApiError } from '../utils/ApiError.js';
import { getRepo } from '../repositories/index.js';
import { env } from '../config/env.js';
import { publicProject } from '../utils/serialize.js';
import { startGeneration, isRunning, removeProjectFiles, projectDir } from '../services/generation/job.js';

const keyFor = (user) => user.geminiKey || env.GEMINI_API_KEY;

async function owned(req) {
  const p = await getRepo().projects.get(req.params.id);
  if (!p) throw new ApiError(404, 'Project not found.', 'NOT_FOUND');
  if (p.userId !== req.user.id) throw new ApiError(403, 'You do not have access to this project.', 'FORBIDDEN');
  return p;
}

export async function list(req, res) {
  const items = await getRepo().projects.listByUser(req.user.id);
  res.json({ projects: items.map(publicProject) });
}

export async function create(req, res) {
  const { input, generate } = req.body;
  const p = await getRepo().projects.create({
    userId: req.user.id, name: input.businessName, status: 'draft', input,
    content: null, progress: {}, assets: {}, notes: [], error: '', mode: '',
  });
  if (generate) await startGeneration(p, { apiKey: keyFor(req.user), demo: false });
  res.status(201).json({ project: publicProject(await getRepo().projects.get(p.id)) });
}

export async function getOne(req, res) {
  const p = await owned(req);
  // safety net: a project marked "generating" with no live job (server restarted) must not look busy forever
  if (p.status === 'generating' && !isRunning(p.id)) {
    const fixed = await getRepo().projects.update(p.id, { status: 'failed', error: 'Generation was interrupted. Please generate again.' });
    return res.json({ project: publicProject(fixed) });
  }
  res.json({ project: publicProject(p) });
}

export async function update(req, res) {
  const p = await owned(req);
  const patch = {};
  if (req.body.name) patch.name = req.body.name;
  if (req.body.content) {
    const old = p.content || {};
    const c = req.body.content;
    patch.content = {
      ...old, ...c,
      scenes: c.scenes ? (old.scenes || []).map((s, i) => ({ ...s, caption: c.scenes[i]?.caption ?? s.caption })) : old.scenes,
    };
  }
  res.json({ project: publicProject(await getRepo().projects.update(p.id, patch)) });
}

export async function regenerate(req, res) {
  const p = await owned(req);
  if (isRunning(p.id)) throw new ApiError(409, 'This ad is already being generated.', 'BUSY');
  await startGeneration(p, { apiKey: keyFor(req.user), demo: req.body?.demo === true });
  res.status(202).json({ project: publicProject(await getRepo().projects.get(p.id)) });
}

export async function remove(req, res) {
  const p = await owned(req);
  if (isRunning(p.id)) throw new ApiError(409, 'Wait for generation to finish before deleting.', 'BUSY');
  await getRepo().projects.remove(p.id);
  await removeProjectFiles(p.id);
  res.json({ ok: true });
}

const TYPES = { '.mp4': 'video/mp4', '.png': 'image/png', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
export async function asset(req, res) {
  const p = await owned(req);
  const name = req.params.name;
  const allowed = [...(p.assets?.photos || []), p.assets?.logo, p.assets?.video, p.assets?.audio, ...(p.assets?.images || [])].filter(Boolean);
  if (!allowed.includes(name)) throw new ApiError(404, 'File not found.', 'NOT_FOUND');
  const file = path.join(projectDir(p.id), name);
  if (!fs.existsSync(file)) throw new ApiError(404, 'File not found.', 'NOT_FOUND');
  res.type(TYPES[path.extname(name)] || 'application/octet-stream');
  if (req.query.download) res.attachment(`${p.name.replace(/[^\w-]+/g, '_')}-${name}`);
  res.sendFile(file); // sendFile supports Range requests, which <video> needs
}

export async function uploadLogoFile(req, res) {
  const p = await owned(req);
  if (!req.file) throw new ApiError(400, 'Choose a PNG or JPG image to upload.', 'NO_FILE');
  let png;
  try {
    const img = await loadImage(req.file.buffer); // proves the bytes really are an image
    const s = Math.min(1, 512 / Math.max(img.width, img.height));
    const c = createCanvas(Math.round(img.width * s), Math.round(img.height * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    png = c.toBuffer('image/png');
  } catch {
    throw new ApiError(415, 'That file is not a valid image. Only PNG or JPG images are allowed.', 'BAD_FILE');
  }
  await fsp.mkdir(projectDir(p.id), { recursive: true });
  await fsp.writeFile(path.join(projectDir(p.id), 'logo.png'), png);
  const updated = await getRepo().projects.update(p.id, { assets: { ...(p.assets || {}), logo: 'logo.png' } });
  res.json({ project: publicProject(updated) });
}

export async function uploadPhotoFiles(req, res) {
  const p = await owned(req);
  if (!req.files?.length) throw new ApiError(400, 'Choose 1 to 3 photos to upload.', 'NO_FILE');
  const dir = projectDir(p.id);
  await fsp.mkdir(dir, { recursive: true });
  for (const old of p.assets?.photos || []) await fsp.rm(path.join(dir, old), { force: true });
  const names = [];
  for (const [i, f] of req.files.entries()) {
    try {
      const img = await loadImage(f.buffer); // proves the bytes really are an image
      const s = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = createCanvas(Math.round(img.width * s), Math.round(img.height * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const name = `photo${i + 1}.jpg`;
      await fsp.writeFile(path.join(dir, name), c.toBuffer('image/jpeg', 88));
      names.push(name);
    } catch {
      throw new ApiError(415, `"${f.originalname}" is not a valid image. Only PNG, JPG or WEBP photos are allowed.`, 'BAD_FILE');
    }
  }
  res.json({ project: publicProject(await getRepo().projects.update(p.id, { assets: { ...(p.assets || {}), photos: names } })) });
}

export async function removePhotos(req, res) {
  const p = await owned(req);
  for (const old of p.assets?.photos || []) await fsp.rm(path.join(projectDir(p.id), old), { force: true });
  res.json({ project: publicProject(await getRepo().projects.update(p.id, { assets: { ...(p.assets || {}), photos: [] } })) });
}
