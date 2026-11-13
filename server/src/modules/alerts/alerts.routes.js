import express, { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import JobAlert from '../../models/JobAlert.js';
import AppError from '../../utils/AppError.js';
import { ok, randomToken, slotList } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { sendJobAlert, sendAlertConfirm, inBackground } from '../../config/mailer.js';

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
  inBackground(sendAlertConfirm(email, a.token));
  ok(res, { email }, null, 201);
});

// T-10: link trong email là GET nhưng chỉ hiện nút bấm; thay đổi dữ liệu nằm ở POST
// (bộ quét link của hộp thư tự mở GET sẽ không vô tình xác nhận/hủy đăng ký)
const ACTIONS = { confirm: 'Xác nhận nhận thông báo việc mới', unsubscribe: 'Hủy nhận thông báo việc mới' };
const tokenOf = (v) => (/^[a-f0-9]{64}$/.test(String(v || '')) ? String(v) : '');
router.get('/job-alerts/:action', (req, res, next) => {
  const label = ACTIONS[req.params.action];
  if (!label) return next();
  res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>UniShift</title>
<body style="font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:90vh;margin:0">
<form method="post" style="text-align:center"><input type="hidden" name="token" value="${tokenOf(req.query.token)}">
<p>${label}?</p><button style="padding:10px 20px;font-size:16px;cursor:pointer">${label}</button></form>`);
});

router.post('/job-alerts/:action', express.urlencoded({ extended: false }), async (req, res, next) => {
  if (!ACTIONS[req.params.action]) return next();
  const token = tokenOf(req.body?.token);
  let done = false;
  if (token && req.params.action === 'confirm') {
    const a = await JobAlert.findOne({ token });
    if (a) {
      if (a.pendingSlots) a.busySlots = a.pendingSlots;
      a.pendingSlots = undefined;
      a.confirmed = true;
      await a.save();
      done = true;
    }
  } else if (token) {
    done = (await JobAlert.deleteOne({ token })).deletedCount > 0;
  }
  res.redirect(303, `${process.env.CLIENT_URL}/?alerts=${done ? (req.params.action === 'confirm' ? 'on' : 'off') : 'invalid'}`);
});

// Gọi sau khi đăng tin: gửi cho người đăng ký có ít nhất một ca của tin không trùng giờ học (tin không có ca cố định thì gửi cho mọi người)
// ponytail: gửi tuần tự ngay trong request đăng tin, đủ cho vài trăm người đăng ký; nhiều hơn thì đưa vào hàng đợi
export const alertsFor = (job) => JobAlert.find({ confirmed: { $ne: false }, ...(job.shifts?.length && { busySlots: { $not: { $all: job.shifts } } }) });
export const notifyAlerts = async (job) => {
  for (const a of await alertsFor(job)) await sendJobAlert(a.email, job, a.token);
};

export default router;
