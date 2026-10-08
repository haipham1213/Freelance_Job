import AppError from '../utils/AppError.js';

// zod → 400 kèm lỗi từng trường; dữ liệu đã parse ghi đè lại req[where]
export const validate = (schema, where = 'body') => (req, res, next) => {
  const r = schema.safeParse(req[where] ?? {});
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new AppError(400, 'VALIDATION_ERROR', details[0]?.message || 'Dữ liệu không hợp lệ', details));
  }
  if (where === 'query') req.valid = r.data;
  else req[where] = r.data;
  next();
};
