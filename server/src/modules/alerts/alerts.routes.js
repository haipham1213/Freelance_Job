import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import JobAlert from '../../models/JobAlert.js';
import AppError from '../../utils/AppError.js';
import { ok, randomToken, slotList } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { sendJobAlert, sendAlertConfirm } from '../../config/mailer.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', 'Bạn thao tác quá nhanh, thử lại sau 1 phút')) });

// Mỗi email nhận tối đa 3 email xác nhận/giờ
const perEmail = rateLimit({ windowMs: 60 * 60_000, limit: 3, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase(),
  handler: (req, res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', 'Email này đã đăng ký quá nhiều lần, thử lại sau 1 giờ')) });

// Đăng ký (hoặc cập nhật lịch học) nhận email việc mới: lịch học nằm chờ trong pendingSlots, gửi link xác nhận về chính email đó
router.post('/job-alerts', limiter, perEmail, validate(z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')),
  busySlots: z.array(z.number().int().min(0).max(20)).max(21).default([]),
})), async (req, res) => {
  const { email, busySlots } = req.body;
  const a = await JobAlert.findOneAndUpdate({ email }, { $set: { pendingSlots: slotList(busySlots) }, $setOnInsert: { token: randomToken(), confirmed: false } },
    { upsert: true, returnDocument: 'after' });
  sendAlertConfirm(email, a.token).catch((e) => console.warn(`[mail] ${e.message}`));
  ok(res, { email }, null, 201);
});

// Link "Xác nhận" trong email: áp lịch học đang chờ và bật nhận thông báo
router.get('/job-alerts/confirm', async (req, res) => {
  const a = await JobAlert.findOne({ token: String(req.query.token || '') });
  if (a) {
    if (a.pendingSlots) a.busySlots = a.pendingSlots;
    a.pendingSlots = undefined;
    a.confirmed = true;
    await a.save();
  }
  res.redirect(`${process.env.CLIENT_URL}/?alerts=${a ? 'on' : 'invalid'}`);
});

// Link "Hủy nhận thông báo" trong email: xóa đăng ký rồi về trang chủ kèm thông báo
router.get('/job-alerts/unsubscribe', async (req, res) => {
  const r = await JobAlert.deleteOne({ token: String(req.query.token || '') });
  res.redirect(`${process.env.CLIENT_URL}/?alerts=${r.deletedCount ? 'off' : 'invalid'}`);
});

// Gọi sau khi đăng tin: gửi cho người đăng ký có ít nhất một ca của tin không trùng giờ học (tin không có ca cố định thì gửi cho mọi người)
// ponytail: gửi tuần tự ngay trong request đăng tin, đủ cho vài trăm người đăng ký; nhiều hơn thì đưa vào hàng đợi
export const alertsFor = (job) => JobAlert.find({ confirmed: { $ne: false }, ...(job.shifts?.length && { busySlots: { $not: { $all: job.shifts } } }) });
export const notifyAlerts = async (job) => {
  for (const a of await alertsFor(job)) await sendJobAlert(a.email, job, a.token);
};

export default router;
