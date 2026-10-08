import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import AppError from '../utils/AppError.js';

const readUser = async (req) => {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  let payload;
  try {
    payload = jwt.verify(h.slice(7), process.env.JWT_ACCESS_SECRET);
  } catch {
    throw new AppError(401, 'TOKEN_INVALID', 'Phiên đăng nhập đã hết hạn');
  }
  const user = await User.findById(payload.sub);
  if (!user) throw new AppError(401, 'TOKEN_INVALID', 'Tài khoản không tồn tại');
  // BR-06: khóa có hiệu lực ngay ở request kế tiếp
  if (user.status === 'LOCKED') throw new AppError(403, 'ACCOUNT_LOCKED', `Tài khoản đã bị khóa: ${user.lockReason || ''}`);
  return user;
};

export const authenticate = async (req, res, next) => {
  try {
    req.user = await readUser(req);
    if (!req.user) throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập');
    next();
  } catch (e) {
    next(e);
  }
};

// Không bắt buộc đăng nhập nhưng nạp user nếu có token
export const optionalAuth = async (req, res, next) => {
  try {
    req.user = await readUser(req);
  } catch {
    req.user = null;
  }
  next();
};

export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new AppError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này'));

// BR-04
export const requireVerified = (req, res, next) =>
  req.user.emailVerified ? next() : next(new AppError(403, 'EMAIL_NOT_VERIFIED', 'Vui lòng xác thực email trước'));
