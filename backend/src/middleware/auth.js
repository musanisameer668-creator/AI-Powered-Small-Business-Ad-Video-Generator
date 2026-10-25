import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError, asyncHandler } from '../utils/ApiError.js';
import { getRepo } from '../repositories/index.js';

export const signToken = (user) => jwt.sign({ sub: user.id }, env.JWT_SECRET, { expiresIn: '7d' });

/** Reads "Authorization: Bearer x". Media routes also accept ?token= because <video> cannot send headers. */
export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
  if (!token) throw new ApiError(401, 'Please log in to continue.', 'NO_TOKEN');
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET); }
  catch { throw new ApiError(401, 'Your session has expired. Please log in again.', 'BAD_TOKEN'); }
  const user = await getRepo().users.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Your session has expired. Please log in again.', 'BAD_TOKEN');
  req.user = user;
  next();
});
