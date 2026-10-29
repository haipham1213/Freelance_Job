import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import User from '../../models/User.js';
import Token from '../../models/Token.js';
import AppError from '../../utils/AppError.js';
import { ok, sha256, randomToken, DAY } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate } from '../../middlewares/auth.js';
import { sendVerifyEmail, sendResetEmail } from '../../config/mailer.js';

const router = Router();

// NFR-07
const limiter = rateLimit({ windowMs: 60_000, limit: Number(process.env.AUTH_RATE_LIMIT) || 20, standardHeaders: true, legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', 'Bạn thao tác quá nhanh, thử lại sau 1 phút')) });

// US-05: gửi lại link xác thực tối đa 3 lần/giờ cho mỗi email
const resendLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 3, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase(),
  handler: (req, res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', 'Đã gửi lại quá 3 lần trong 1 giờ, vui lòng thử lại sau')) });

// BR-02
const password = z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự').max(64).regex(/[A-Za-z]/, 'Mật khẩu phải có chữ').regex(/\d/, 'Mật khẩu phải có số');
const email = z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ'));

const COOKIE = 'refreshToken';
const cookieOpts = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/v1/auth' };

const issueTokens = async (res, user) => {
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: '15m' });
  const refresh = randomToken();
  await Token.create({ userId: user._id, type: 'REFRESH', tokenHash: sha256(refresh), expiresAt: new Date(Date.now() + 7 * DAY) });
  res.cookie(COOKIE, refresh, { ...cookieOpts, maxAge: 7 * DAY });
  return { accessToken, refresh };
};

const DUMMY_HASH = bcrypt.hashSync('khong-phai-mat-khau-1', 10);

const createOneTimeToken = async (userId, type, ttlMs) => {
  await Token.deleteMany({ userId, type });
  const t = randomToken();
  await Token.create({ userId, type, tokenHash: sha256(t), expiresAt: new Date(Date.now() + ttlMs) });
  return t;
};

// Dùng 1 lần (BR-05)
const consumeToken = async (token, type) => {
  const t = await Token.findOneAndDelete({ tokenHash: sha256(token || ''), type, expiresAt: { $gt: new Date() } });
  if (!t) throw new AppError(400, 'TOKEN_INVALID', 'Link không hợp lệ hoặc đã hết hạn');
  return t;
};

// API-01
router.post('/register', limiter,
  validate(z.object({
    fullName: z.string().trim().min(2, 'Họ tên tối thiểu 2 ký tự').max(100),
    email,
    password,
    role: z.enum(['STUDENT', 'EMPLOYER'], 'Vai trò phải là Sinh viên hoặc Nhà tuyển dụng'),
  })),
  async (req, res) => {
    const { fullName, email, password, role } = req.body;
    if (await User.exists({ email })) throw new AppError(409, 'EMAIL_EXISTS', 'Email đã được sử dụng');
    const user = await User.create({
      fullName, email, role,
      passwordHash: await bcrypt.hash(password, 10),
      ...(role === 'STUDENT' ? { student: { skills: [], savedJobIds: [] } } : { employer: {} }),
    });
    await sendVerifyEmail(email, await createOneTimeToken(user._id, 'VERIFY_EMAIL', DAY));
    ok(res, { user: user.toPublic() }, null, 201);
  });

// API-02
router.post('/verify-email', async (req, res) => {
  const t = await consumeToken(req.body.token, 'VERIFY_EMAIL');
  await User.updateOne({ _id: t.userId }, { emailVerified: true });
  ok(res, { message: 'Xác thực email thành công' });
});

// API-03: luôn 200 để không lộ email nào đã đăng ký
router.post('/resend-verification', limiter, resendLimiter, validate(z.object({ email })), async (req, res) => {
  const user = await User.findOne({ email: req.body.email, emailVerified: false });
  // Không chờ gửi mail: thời gian phản hồi như nhau dù email có tồn tại hay không
  if (user) createOneTimeToken(user._id, 'VERIFY_EMAIL', DAY).then((t) => sendVerifyEmail(user.email, t)).catch((e) => console.warn(`[mail] ${e.message}`));
  ok(res, { message: 'Nếu email chưa được xác thực, chúng tôi đã gửi lại link' });
});

// API-04
router.post('/login', limiter, validate(z.object({ email, password: z.string().min(1) })), async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  // Email không tồn tại vẫn chạy bcrypt để thời gian phản hồi không lộ email nào đã đăng ký
  if (!(await bcrypt.compare(req.body.password, user?.passwordHash || DUMMY_HASH)) || !user)
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Email hoặc mật khẩu không đúng');
  if (user.status === 'LOCKED') throw new AppError(403, 'ACCOUNT_LOCKED', `Tài khoản đã bị khóa: ${user.lockReason || ''}`);
  // Phải xác thực email mới được đăng nhập (đổi từ US-05 tiêu chí 4: trước đây cho vào và chỉ nhắc)
  if (!user.emailVerified) throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Email chưa được xác thực. Hãy bấm link trong email chúng tôi đã gửi, hoặc gửi lại link bên dưới.');
  user.lastLoginAt = new Date();
  await user.save();
  const { accessToken } = await issueTokens(res, user);
  ok(res, { accessToken, user: user.toPublic() });
});

// API-05: xoay vòng refresh token; dùng lại token đã thu hồi → thu hồi mọi phiên
router.post('/refresh', async (req, res) => {
  const raw = req.cookies[COOKIE];
  const t = raw && (await Token.findOne({ tokenHash: sha256(raw), type: 'REFRESH' }));
  if (!t || t.expiresAt < new Date()) throw new AppError(401, 'REFRESH_INVALID', 'Phiên đăng nhập đã hết hạn');
  // Nhiều tab cùng refresh một lúc gửi cùng cookie: token vừa được xoay (< 30 giây) vẫn cho qua, không coi là đánh cắp
  const justRotated = t.revokedAt && t.replacedBy && Date.now() - t.revokedAt < 30_000;
  if (t.revokedAt && !justRotated) {
    await Token.updateMany({ userId: t.userId, type: 'REFRESH', revokedAt: null }, { revokedAt: new Date() });
    throw new AppError(401, 'REFRESH_REUSED', 'Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại');
  }
  const user = await User.findById(t.userId);
  if (!user || user.status === 'LOCKED' || !user.emailVerified) throw new AppError(401, 'REFRESH_INVALID', 'Phiên đăng nhập đã hết hạn');
  const { accessToken, refresh } = await issueTokens(res, user);
  if (!justRotated) {
    t.revokedAt = new Date();
    t.replacedBy = sha256(refresh);
    await t.save();
  }
  ok(res, { accessToken, user: user.toPublic() });
});

// API-06
router.post('/logout', async (req, res) => {
  const raw = req.cookies[COOKIE];
  if (raw) await Token.updateOne({ tokenHash: sha256(raw) }, { revokedAt: new Date() });
  res.clearCookie(COOKIE, cookieOpts).status(204).end();
});

// API-07: BR-09 luôn cùng một thông báo
router.post('/forgot-password', limiter, validate(z.object({ email })), async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) createOneTimeToken(user._id, 'RESET_PASSWORD', 30 * 60_000).then((t) => sendResetEmail(user.email, t)).catch((e) => console.warn(`[mail] ${e.message}`));
  ok(res, { message: 'Nếu email tồn tại, chúng tôi đã gửi link đặt lại mật khẩu' });
});

// API-08: BR-08 thu hồi mọi refresh token
router.post('/reset-password', validate(z.object({ token: z.string(), newPassword: password })), async (req, res) => {
  const t = await consumeToken(req.body.token, 'RESET_PASSWORD');
  await User.updateOne({ _id: t.userId }, { passwordHash: await bcrypt.hash(req.body.newPassword, 10), passwordChangedAt: new Date() });
  await Token.updateMany({ userId: t.userId, type: 'REFRESH', revokedAt: null }, { revokedAt: new Date() });
  ok(res, { message: 'Đặt lại mật khẩu thành công' });
});

// API-10
router.get('/me', authenticate, (req, res) => ok(res, { user: req.user.toPublic() }));

export default router;
