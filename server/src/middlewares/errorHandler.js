// NFR-22: { success:false, error:{ code, message, details } }, không lộ stack ở production
export const notFound = (req, res) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Không tìm thấy ${req.originalUrl}` } });

export const errorHandler = (err, req, res, next) => {
  if (err.code === 11000) {
    // Không trả lại giá trị trùng (keyValue); đăng ký trùng email cùng lúc vẫn ra đúng thông báo ở ô email
    err = err.keyValue?.email
      ? { status: 409, code: 'EMAIL_EXISTS', message: 'Email đã được sử dụng', details: [{ field: 'email', message: 'Email đã được sử dụng' }] }
      : { status: 409, code: 'DUPLICATE', message: 'Dữ liệu đã tồn tại' };
  } else if (err.name === 'CastError') {
    err = { status: 400, code: 'INVALID_ID', message: 'ID không hợp lệ' };
  } else if (err.name === 'ValidationError') {
    err = { status: 400, code: 'VALIDATION_ERROR', message: Object.values(err.errors)[0]?.message };
  } else if (err.type === 'entity.too.large') {
    err = { status: 413, code: 'FILE_TOO_LARGE', message: 'File vượt quá dung lượng cho phép' };
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    success: false,
    error: {
      code: typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR',
      message: status >= 500 && process.env.NODE_ENV === 'production' ? 'Lỗi hệ thống' : err.message,
      details: err.details,
    },
  });
};
