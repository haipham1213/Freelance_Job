import { z } from 'zod';
import AppError from '../utils/AppError.js';

// Thông báo mặc định tiếng Việt cho mọi schema không tự ghi message (tránh lộ chuỗi gốc kiểu "Too small: expected string…")
z.config({
  customError: (iss) => {
    if (iss.code === 'invalid_type') return iss.input === undefined || iss.input === null ? 'Vui lòng nhập thông tin này' : 'Kiểu dữ liệu không hợp lệ';
    if (iss.code === 'too_small') return iss.origin === 'string' ? (Number(iss.minimum) <= 1 ? 'Vui lòng nhập thông tin này' : `Cần tối thiểu ${iss.minimum} ký tự`) : `Giá trị tối thiểu là ${iss.minimum}`;
    if (iss.code === 'too_big') return iss.origin === 'string' ? `Tối đa ${iss.maximum} ký tự` : `Giá trị tối đa là ${iss.maximum}`;
    if (iss.code === 'invalid_format') return 'Định dạng không hợp lệ';
    if (iss.code === 'invalid_value') return 'Giá trị không hợp lệ';
    return 'Dữ liệu không hợp lệ';
  },
});

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
