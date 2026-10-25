import { ApiError } from '../utils/ApiError.js';

export const notFound = (req, _res, next) => next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'));

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err?.type === 'entity.parse.failed') err = new ApiError(400, 'The request body is not valid JSON.', 'BAD_JSON');
  if (err?.type === 'entity.too.large') err = new ApiError(413, 'The request is too large.', 'TOO_LARGE');
  if (err?.code === 'LIMIT_FILE_SIZE') err = new ApiError(413, 'The image is too large. Maximum size is 2 MB.', 'TOO_LARGE');
  const status = err instanceof ApiError ? err.status : (err.status && err.status < 600 ? err.status : 500);
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: { code: err.code || 'SERVER_ERROR', message: status >= 500 && !(err instanceof ApiError) ? 'Something went wrong on the server. Please try again.' : err.message, details: err.details },
  });
}
