import { ApiError } from '../utils/ApiError.js';

export const validate = (schema) => (req, _res, next) => {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) {
    const fields = {};
    for (const i of r.error.issues) fields[i.path.join('.') || '_'] ??= i.message;
    const first = Object.values(fields)[0];
    const e = new ApiError(400, first || 'Please check the form and try again.', 'VALIDATION');
    e.details = fields;
    return next(e);
  }
  req.body = r.data;
  next();
};
