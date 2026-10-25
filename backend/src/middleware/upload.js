import multer from 'multer';
import { ApiError } from '../utils/ApiError.js';

const OK = new Set(['image/png', 'image/jpeg']);
export const uploadLogo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (OK.has(file.mimetype) ? cb(null, true) : cb(new ApiError(415, 'Only PNG or JPG images are allowed.', 'BAD_FILE'))),
}).single('logo');

const PHOTO_OK = new Set(['image/png', 'image/jpeg', 'image/webp']);
export const uploadPhotos = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 3 },
  fileFilter: (_req, file, cb) => (PHOTO_OK.has(file.mimetype) ? cb(null, true) : cb(new ApiError(415, 'Only PNG, JPG or WEBP photos are allowed.', 'BAD_FILE'))),
}).array('photos', 3);
