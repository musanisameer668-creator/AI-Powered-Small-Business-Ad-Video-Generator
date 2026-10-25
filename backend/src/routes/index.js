import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter } from '../middleware/rateLimit.js';
import * as A from '../controllers/authController.js';
import * as P from '../controllers/projectController.js';
import * as S from '../controllers/settingsController.js';
import { registerSchema, loginSchema, createProjectSchema, updateProjectSchema, keySchema } from '../validators/schemas.js';
import { uploadLogo, uploadPhotos } from '../middleware/upload.js';
import { getRepo } from '../repositories/index.js';

const r = Router();
r.get('/health', (_req, res) => res.json({ ok: true, database: getRepo().kind }));

r.post('/auth/register', authLimiter, validate(registerSchema), asyncHandler(A.register));
r.post('/auth/login', authLimiter, validate(loginSchema), asyncHandler(A.login));
r.get('/auth/me', requireAuth, A.me);

r.get('/projects', requireAuth, asyncHandler(P.list));
r.post('/projects', requireAuth, validate(createProjectSchema), asyncHandler(P.create));
r.get('/projects/:id', requireAuth, asyncHandler(P.getOne));
r.patch('/projects/:id', requireAuth, validate(updateProjectSchema), asyncHandler(P.update));
r.post('/projects/:id/generate', requireAuth, asyncHandler(P.regenerate));
r.delete('/projects/:id', requireAuth, asyncHandler(P.remove));
r.post('/projects/:id/logo', requireAuth, uploadLogo, asyncHandler(P.uploadLogoFile));
r.post('/projects/:id/photos', requireAuth, uploadPhotos, asyncHandler(P.uploadPhotoFiles));
r.delete('/projects/:id/photos', requireAuth, asyncHandler(P.removePhotos));
r.get('/projects/:id/assets/:name', requireAuth, asyncHandler(P.asset));

r.get('/settings/status', requireAuth, S.status);
r.put('/settings/key', requireAuth, validate(keySchema), asyncHandler(S.saveKey));
r.post('/settings/test', requireAuth, asyncHandler(S.testKey));
r.post('/settings/test-images', requireAuth, asyncHandler(S.testImages));
export default r;
