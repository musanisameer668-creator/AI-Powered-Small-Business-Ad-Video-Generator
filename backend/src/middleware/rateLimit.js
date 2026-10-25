import rateLimit from 'express-rate-limit';
const make = (max, message) => rateLimit({
  windowMs: 15 * 60 * 1000, limit: max, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMIT', message } },
});
export const apiLimiter = make(Number(process.env.RATE_LIMIT_API || 600), 'Too many requests. Please wait a few minutes.');
export const authLimiter = make(Number(process.env.RATE_LIMIT_AUTH || 60), 'Too many login attempts. Please wait a few minutes.');
