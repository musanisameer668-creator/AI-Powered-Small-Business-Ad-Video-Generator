import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Prevent local Windows antivirus / proxy SSL interception from breaking HTTPS API calls
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const here = path.dirname(fileURLToPath(import.meta.url));
export const BACKEND_ROOT = path.resolve(here, '..', '..');
dotenv.config({ path: path.join(BACKEND_ROOT, '.env'), quiet: true });

const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

export const env = {
  PORT: num(process.env.PORT, 5000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'admitra-dev-secret-change-me',
  MONGODB_URI: (process.env.MONGODB_URI || '').trim(),
  GEMINI_API_KEY: (process.env.GEMINI_API_KEY || '').trim(),
  GEMINI_BASE_URL: (process.env.GEMINI_BASE_URL || '').trim(),
  TEXT_MODEL: process.env.TEXT_MODEL || 'gemini-3.8-flash',
  TEXT_MODELS: (process.env.TEXT_MODELS || `${process.env.TEXT_MODEL || 'gemini-3.8-flash'},gemini-2.5-flash,gemini-2.0-flash`)
    .split(',').map((s) => s.trim()).filter(Boolean),
  IMAGE_MODELS: (process.env.IMAGE_MODELS || 'gemini-3.1-flash-lite-image,gemini-nano-banana-2.1,gemini-2.5-flash-image')
    .split(',').map((s) => s.trim()).filter(Boolean),
  TTS_MODELS: (process.env.TTS_MODELS || 'gemini-3.8-flash-tts,gemini-3.8-flash-lite-tts')
    .split(',').map((s) => s.trim()).filter(Boolean),
  // Hard limits so nothing can load forever
  TEXT_TIMEOUT_MS: num(process.env.TEXT_TIMEOUT_MS, 40000),
  IMAGE_TIMEOUT_MS: num(process.env.IMAGE_TIMEOUT_MS, 45000),
  IMAGES_TOTAL_MS: num(process.env.IMAGES_TOTAL_MS, 70000),
  TTS_TIMEOUT_MS: num(process.env.TTS_TIMEOUT_MS, 25000),
  VIDEO_TIMEOUT_MS: num(process.env.VIDEO_TIMEOUT_MS, 180000),
  JOB_TIMEOUT_MS: num(process.env.JOB_TIMEOUT_MS, 280000),
  FREE_IMAGE_URL: process.env.FREE_IMAGE_URL || 'https://image.pollinations.ai/prompt',
  STOCK_IMAGE_URL: process.env.STOCK_IMAGE_URL || 'https://loremflickr.com',
  FREE_IMAGE_TIMEOUT_MS: num(process.env.FREE_IMAGE_TIMEOUT_MS, 25000),
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  DATA_DIR: process.env.DATA_DIR || path.join(BACKEND_ROOT, 'data'),
  STORAGE_DIR: process.env.STORAGE_DIR || path.join(BACKEND_ROOT, 'storage'),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || '',
};
