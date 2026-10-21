import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import JobAlert from '../../models/JobAlert.js';
import AppError from '../../utils/AppError.js';
import { ok, randomToken, slotList } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { sendJobAlert } from '../../config/mailer.js';

const router = Router();
const limiter = rateLimit({ windowMs: 60_000, limit: 10, standardHeaders: true, legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'TOO_MANY_REQUESTS', 'Bạn thao tác quá nhanh, thử lại sau 1 phút')) });

// Đăng ký (hoặc cập nhật lịch học) nhận email việc mới; gửi lại cùng email thì chỉ cập nhật busySlots
router.post('/job-alerts', limiter, validate(z.object({
  email: z.string().trim().toLowerCase().pipe(z.email('Email không hợp lệ')),
  busySlots: z.array(z.number().int().min(0).max(20)).max(21).default([]),
})), async (req, res) => {
  const { email, busySlots } = req.body;
  await JobAlert.updateOne({ email }, { $set: { busySlots: slotList(busySlots) }, $setOnInsert: { token: randomToken() } }, { upsert: true });
  ok(res, { email }, null, 201);
});

// Link "Hủy nhận thông báo" trong email: xóa đăng ký rồi về trang chủ kèm thông báo
router.get('/job-alerts/unsubscribe', async (req, res) => {
  await JobAlert.deleteOne({ token: String(req.query.token || '') });
  res.redirect(`${process.env.CLIENT_URL}/?alerts=off`);
});

// Gọi sau khi đăng tin: gửi cho người đăng ký có ít nhất một ca của tin không trùng giờ học (tin không có ca cố định thì gửi cho mọi người)
// ponytail: gửi tuần tự ngay trong request đăng tin, đủ cho vài trăm người đăng ký; nhiều hơn thì đưa vào hàng đợi
export const alertsFor = (job) => (job.shifts?.length ? JobAlert.find({ busySlots: { $not: { $all: job.shifts } } }) : JobAlert.find());
export const notifyAlerts = async (job) => {
  for (const a of await alertsFor(job)) await sendJobAlert(a.email, job, a.token);
};

export default router;
