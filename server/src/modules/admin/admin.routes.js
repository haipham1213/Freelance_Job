import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Plan from '../../models/Plan.js';
import Token from '../../models/Token.js';
import Review from '../../models/Review.js';
import Report from '../../models/Report.js';
import Payment from '../../models/Payment.js';
import Category from '../../models/Category.js';
import AuditLog from '../../models/AuditLog.js';
import Violation from '../../models/Violation.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { ok, paging, oid, escapeRegex, slugify, DAY } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { notify } from '../../utils/notify.js';
import { recomputeRating } from '../../utils/rating.js';
import { rawFile, saveUpload } from '../../utils/files.js';
import { quotaOf, rejectPending, visibleMatch } from '../jobs/jobs.service.js';
import { extendPremium } from '../payments/payments.service.js';

const router = Router();
router.use('/admin', authenticate, authorize('ADMIN'));

const reason = z.object({ reason: z.string().trim().min(1, 'Vui lòng nhập lý do').max(500) });
const audit = (req, action, targetType, targetId, detail) => AuditLog.create({ actorId: req.user._id, action, targetType, targetId, detail });
const list = async (Model, filter, q, sort = '-createdAt', populate) => {
  const { page, limit, skip } = paging(q);
  let query = Model.find(filter).sort(sort).skip(skip).limit(limit);
  if (populate) query = query.populate(...populate);
  const [items, total] = await Promise.all([query, Model.countDocuments(filter)]);
  return [items, { page, limit, total }];
};

// API-51: 6 chỉ số FR-ADM-01
router.get('/admin/dashboard', async (req, res) => {
  const since30 = new Date(Date.now() - 30 * DAY);
  const since12m = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
  const [users, openJobs, apps30, accepted30, openReports, revenue] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    Job.countDocuments(await visibleMatch()),
    Application.countDocuments({ createdAt: { $gte: since30 } }),
    Application.countDocuments({ createdAt: { $gte: since30 }, status: { $in: ['ACCEPTED', 'COMPLETED', 'NOT_COMPLETED'] } }),
    Report.countDocuments({ status: 'OPEN' }),
    Payment.aggregate([
      { $match: { status: 'SUCCESS', paidAt: { $gte: since12m } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$paidAt', timezone: '+07:00' } }, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(since12m.getFullYear(), since12m.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const r = revenue.find((x) => x._id === key);
    return { month: key, total: r?.total || 0, count: r?.count || 0 };
  });
  ok(res, {
    users: Object.fromEntries(users.map((u) => [u._id, u.n])),
    openJobs,
    applications30d: apps30,
    acceptRate: apps30 ? Math.round((accepted30 / apps30) * 1000) / 10 : 0,
    openReports,
    revenueByMonth: months,
  });
});

// API-52
router.get('/admin/users', async (req, res) => {
  const { q, role, status } = req.query;
  const filter = {
    ...(role && { role }), ...(status && { status }),
    ...(q && { $or: [{ email: { $regex: escapeRegex(q), $options: 'i' } }, { fullName: { $regex: escapeRegex(q), $options: 'i' } }] }),
  };
  const [items, meta] = await list(User, filter, req.query);
  ok(res, items.map((u) => u.toPublic()), meta);
});

// Khóa tài khoản (API-53 và kết luận V3): BR-06 thu hồi phiên, BR-38 mất Premium còn lại,
// bậc V3 "Job bị đóng": tin OPEN của Employer → CLOSED, đơn PENDING → REJECTED (BR-28)
const lockUser = async (u, why, adminId, session) => {
  u.status = 'LOCKED';
  u.lockReason = why;
  if (u.employer?.premiumUntil) u.set('employer.premiumUntil', null);
  await u.save({ session });
  await Token.updateMany({ userId: u._id, type: 'REFRESH', revokedAt: null }, { revokedAt: new Date() }, { session });
  if (u.role !== 'EMPLOYER') return;
  for (const job of await Job.find({ employerId: u._id, status: 'OPEN', deletedAt: null }).session(session)) {
    job.status = 'CLOSED';
    await job.save({ session });
    await rejectPending(job, 'Nhà tuyển dụng đã bị khóa tài khoản', adminId, session);
  }
};

// API-53: BR-07
router.patch('/admin/users/:id/lock', validate(reason), async (req, res) => {
  const u = await User.findById(oid(req.params.id));
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy user');
  if (u.role === 'ADMIN') throw new AppError(403, 'CANNOT_LOCK_ADMIN', 'Không thể khóa tài khoản Admin');
  await mongoose.connection.transaction((session) => lockUser(u, req.body.reason, req.user._id, session));
  await audit(req, 'USER_LOCK', 'USER', u._id, { reason: req.body.reason });
  ok(res, u.toPublic());
});

// API-54
router.patch('/admin/users/:id/unlock', async (req, res) => {
  const u = await User.findByIdAndUpdate(oid(req.params.id), { status: 'ACTIVE', $unset: { lockReason: 1 } }, { returnDocument: 'after' });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy user');
  await audit(req, 'USER_UNLOCK', 'USER', u._id);
  ok(res, u.toPublic());
});

// API-55
router.get('/admin/jobs', async (req, res) => {
  const { q, status, employerId } = req.query;
  const filter = {
    deletedAt: null,
    ...(status && { status }), ...(employerId && { employerId: oid(employerId) }),
    ...(q && { title: { $regex: escapeRegex(q), $options: 'i' } }),
  };
  const [items, meta] = await list(Job, filter, req.query, '-createdAt');
  ok(res, items, meta);
});

// API-56: BR-20, BR-28
const hideJob = async (job, why, adminId, session) => {
  if (job.status === 'HIDDEN') throw new AppError(409, 'INVALID_STATUS', 'Tin đã bị ẩn');
  job.hiddenFromStatus = job.status;
  job.status = 'HIDDEN';
  job.hiddenReason = why;
  await job.save({ session });
  await rejectPending(job, 'Tin đã bị quản trị viên ẩn', adminId, session);
};

router.patch('/admin/jobs/:id/hide', validate(reason), async (req, res) => {
  const job = await Job.findById(oid(req.params.id));
  if (!job) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy tin');
  await mongoose.connection.transaction((session) => hideJob(job, req.body.reason, req.user._id, session));
  await audit(req, 'JOB_HIDE', 'JOB', job._id, { reason: req.body.reason });
  ok(res, job);
});

// API-57: quay về trạng thái trước khi ẩn
router.patch('/admin/jobs/:id/unhide', async (req, res) => {
  const job = await Job.findOne({ _id: oid(req.params.id), status: 'HIDDEN' });
  if (!job) throw new AppError(409, 'INVALID_STATUS', 'Tin không ở trạng thái ẩn');
  job.status = job.hiddenFromStatus || 'CLOSED';
  // BR-15: hiện lại thành OPEN chỉ khi Employer còn hạn mức, không thì về CLOSED để họ tự mở lại sau
  if (job.status === 'OPEN') {
    const q = await quotaOf(await User.findById(job.employerId));
    if (q.used >= q.limit) job.status = 'CLOSED';
  }
  job.hiddenReason = undefined;
  await job.save();
  await audit(req, 'JOB_UNHIDE', 'JOB', job._id);
  ok(res, job);
});

// Danh mục (cả đang ẩn) cho trang quản trị
router.get('/admin/categories', async (req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find().sort('name'),
    Job.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$categoryId', n: { $sum: 1 } } }]),
  ]);
  const byId = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  ok(res, cats.map((c) => ({ ...c.toObject(), jobCount: byId[c._id] || 0 })));
});

const categoryName = z.string().trim().min(2, 'Tên 2–60 ký tự').max(60, 'Tên 2–60 ký tự');
const dupCategory = (e) => {
  if (e.code === 11000) throw new AppError(409, 'CATEGORY_EXISTS', 'Tên danh mục đã tồn tại');
  throw e;
};

// API-58
router.post('/admin/categories', validate(z.object({ name: categoryName })), async (req, res) => {
  const c = await Category.create({ name: req.body.name, slug: slugify(req.body.name) }).catch(dupCategory);
  ok(res, c, null, 201);
});

// API-59: BR-40 chỉ ẩn, không xóa
router.put('/admin/categories/:id', validate(z.object({ name: categoryName.optional(), isActive: z.boolean().optional() })), async (req, res) => {
  const update = { ...req.body, ...(req.body.name && { slug: slugify(req.body.name) }) };
  const c = await Category.findByIdAndUpdate(oid(req.params.id), update, { returnDocument: 'after', runValidators: true }).catch(dupCategory);
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy danh mục');
  ok(res, c);
});

router.post('/admin/categories/:id/image', rawFile(2), async (req, res) => {
  const imageUrl = await saveUpload(req.body, 'categories', ['jpg', 'png']);
  const c = await Category.findByIdAndUpdate(oid(req.params.id), { imageUrl }, { returnDocument: 'after' });
  ok(res, c);
});

// API-60: kèm thông tin đối tượng bị báo cáo
router.get('/admin/reports', async (req, res) => {
  const { status, targetType } = req.query;
  const filter = { ...(status && { status }), ...(targetType && { targetType }) };
  const [items, meta] = await list(Report, filter, req.query, '-createdAt', ['reporterId', 'fullName email']);
  const jobIds = items.filter((r) => r.targetType === 'JOB').map((r) => r.targetId);
  const userIds = items.filter((r) => r.targetType === 'USER').map((r) => r.targetId);
  const [jobs, users] = await Promise.all([
    Job.find({ _id: { $in: jobIds } }).select('title status employerId companySnapshot'),
    User.find({ _id: { $in: userIds } }).select('fullName email role status'),
  ]);
  const byId = Object.fromEntries([...jobs, ...users].map((x) => [x._id, x]));
  ok(res, items.map((r) => ({ ...r.toObject(), target: byId[r.targetId] || null })), meta);
});

// API-61: DISMISS | V1 cảnh cáo | V2 ẩn nội dung | V3 khóa tài khoản
router.patch('/admin/reports/:id/resolve',
  validate(z.object({ decision: z.enum(['DISMISS', 'V1', 'V2', 'V3']), note: z.string().trim().min(1, 'Vui lòng ghi chú kết luận').max(500) })),
  async (req, res) => {
    const { decision, note } = req.body;
    const report = await Report.findOne({ _id: oid(req.params.id), status: 'OPEN' });
    if (!report) throw new AppError(409, 'ALREADY_RESOLVED', 'Báo cáo đã được xử lý');
    const job = report.targetType === 'JOB' ? await Job.findById(report.targetId) : null;
    const offenderId = job ? job.employerId : report.targetId;
    await mongoose.connection.transaction(async (session) => {
      report.status = decision === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
      report.resolution = { level: decision === 'DISMISS' ? undefined : decision, note, adminId: req.user._id, at: new Date() };
      await report.save({ session });
      if (decision === 'DISMISS') return;
      await Violation.create([{ userId: offenderId, reportId: report._id, level: decision, note, adminId: req.user._id }], { session });
      // ponytail: V2 với báo cáo USER chỉ ghi vi phạm + thông báo; thêm "ẩn toàn bộ tin của user" nếu nhóm cần
      if (decision === 'V2' && job && job.status !== 'HIDDEN') await hideJob(job, `Vi phạm: ${note}`, req.user._id, session);
      if (decision === 'V3') {
        const u = await User.findById(offenderId).session(session);
        if (u && u.role !== 'ADMIN') await lockUser(u, `Vi phạm nghiêm trọng: ${note}`, req.user._id, session);
      }
      const label = { V1: 'Cảnh cáo', V2: 'Ẩn nội dung vi phạm', V3: 'Khóa tài khoản' }[decision];
      await notify(offenderId, 'VIOLATION', `Xử lý vi phạm: ${label}`, note, null, session);
    });
    await audit(req, 'REPORT_RESOLVE', 'REPORT', report._id, { decision, note });
    ok(res, report);
  });

// API-62
router.get('/admin/reviews', async (req, res) => {
  const { isHidden, rating } = req.query;
  const filter = { ...(isHidden !== undefined && { isHidden: isHidden === 'true' }), ...(rating && { rating: Number(rating) }) };
  const { page, limit, skip } = paging(req.query);
  const [items, total] = await Promise.all([
    Review.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('reviewerId', 'fullName role').populate('revieweeId', 'fullName role'),
    Review.countDocuments(filter),
  ]);
  ok(res, items, { page, limit, total });
});

// API-63: ẩn → tính lại điểm (FR-ADM-06)
router.patch('/admin/reviews/:id/hide', validate(reason), async (req, res) => {
  const r = await Review.findOneAndUpdate({ _id: oid(req.params.id), isHidden: false }, { isHidden: true, hiddenReason: req.body.reason }, { returnDocument: 'after' });
  if (!r) throw new AppError(409, 'INVALID_STATUS', 'Đánh giá không tồn tại hoặc đã bị ẩn');
  await recomputeRating(r.revieweeId);
  await audit(req, 'REVIEW_HIDE', 'REVIEW', r._id, { reason: req.body.reason });
  ok(res, r);
});

router.patch('/admin/reviews/:id/unhide', async (req, res) => {
  const r = await Review.findOneAndUpdate({ _id: oid(req.params.id), isHidden: true }, { isHidden: false, $unset: { hiddenReason: 1 } }, { returnDocument: 'after' });
  if (!r) throw new AppError(409, 'INVALID_STATUS', 'Đánh giá không ở trạng thái ẩn');
  await recomputeRating(r.revieweeId);
  ok(res, r);
});

// Danh sách gói (cả đang tắt)
router.get('/admin/plans', async (req, res) => ok(res, await Plan.find().sort('price')));

// API-64: đổi giá chỉ ảnh hưởng giao dịch mới (Payment giữ planSnapshot + amount)
router.put('/admin/plans/:id', validate(z.object({ price: z.number().int().positive('Giá phải > 0').optional(), isActive: z.boolean().optional() })), async (req, res) => {
  const p = await Plan.findByIdAndUpdate(oid(req.params.id), req.body, { returnDocument: 'after' });
  if (!p) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy gói');
  await audit(req, 'PLAN_UPDATE', 'PLAN', p._id, req.body);
  ok(res, p);
});

// API-65
router.get('/admin/payments', async (req, res) => {
  const { status, month } = req.query;
  const filter = { ...(status && { status }) };
  if (month) {
    const [y, m] = month.split('-').map(Number);
    filter.createdAt = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
  }
  const { page, limit, skip } = paging(req.query);
  const [items, total, [sum]] = await Promise.all([
    Payment.find(filter).select('-ipnRaw').sort('-createdAt').skip(skip).limit(limit).populate('employerId', 'fullName email employer.company.name'),
    Payment.countDocuments(filter),
    Payment.aggregate([{ $match: { ...filter, status: 'SUCCESS' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  ok(res, items, { page, limit, total, revenue: sum?.total || 0 });
});

// API-66: FR-ADM-08 kích hoạt thủ công, ghi audit log
router.post('/admin/employers/:id/premium', validate(reason.extend({ planCode: z.string() })), async (req, res) => {
  const [u, plan] = await Promise.all([User.findOne({ _id: oid(req.params.id), role: 'EMPLOYER' }), Plan.findOne({ code: req.body.planCode })]);
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy nhà tuyển dụng');
  if (!plan) throw new AppError(400, 'INVALID_PLAN', 'Gói không tồn tại');
  const premiumUntil = await extendPremium(u._id, plan.durationDays);
  await audit(req, 'PREMIUM_MANUAL', 'USER', u._id, { planCode: plan.code, reason: req.body.reason, premiumUntil });
  await notify(u._id, 'PAYMENT_SUCCESS', 'Premium đã được kích hoạt', `${plan.name} có hiệu lực đến ${premiumUntil.toLocaleDateString('vi-VN')}`, '/employer');
  ok(res, { premiumUntil });
});

export default router;
