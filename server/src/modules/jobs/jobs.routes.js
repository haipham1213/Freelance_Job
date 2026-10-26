import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Job from '../../models/Job.js';
import User from '../../models/User.js';
import Category from '../../models/Category.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { ok, paging, oid, unaccent, escapeRegex, slotList } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, authorize, requireVerified } from '../../middlewares/auth.js';
import { visibleMatch, isVisible, assertQuota, expiryFor, findOwnJob, rejectPending } from './jobs.service.js';

import { notifyAlerts } from '../alerts/alerts.routes.js';
const router = Router();

const today = () => new Date(new Date().toDateString());

// BR-14
const jobBody = z.object({
  title: z.string().trim().min(10, 'Tiêu đề 10–120 ký tự').max(120, 'Tiêu đề 10–120 ký tự'),
  description: z.string().trim().min(50, 'Mô tả tối thiểu 50 ký tự').max(5000),
  requirements: z.string().trim().max(2000).optional(),
  categoryId: z.string().refine(mongoose.isValidObjectId, 'Vui lòng chọn danh mục'),
  city: z.string().trim().min(1, 'Vui lòng chọn thành phố'),
  district: z.string().trim().optional(),
  address: z.string().trim().max(200).optional(),
  salaryType: z.enum(['HOURLY', 'DAILY', 'PROJECT'], 'Loại lương không hợp lệ'),
  salaryMin: z.coerce.number().positive('Lương phải lớn hơn 0'),
  salaryMax: z.coerce.number().positive('Lương phải lớn hơn 0'),
  schedule: z.string().trim().max(200).optional(),
  shifts: z.array(z.number().int().min(0).max(20)).max(21).optional().transform((v) => v && slotList(v)),
  startDate: z.coerce.date('Ngày bắt đầu không hợp lệ'),
  endDate: z.coerce.date().optional().nullable(),
  slots: z.coerce.number().int().min(1, 'Số chỗ 1–50').max(50, 'Số chỗ 1–50'),
})
  .refine((b) => b.salaryMin <= b.salaryMax, { message: 'Lương tối thiểu phải ≤ lương tối đa', path: ['salaryMin'] })
  .refine((b) => !b.endDate || b.endDate >= b.startDate, { message: 'Ngày kết thúc phải sau ngày bắt đầu', path: ['endDate'] });

const assertCategory = async (id) => {
  if (!(await Category.exists({ _id: id, isActive: true }))) throw new AppError(400, 'INVALID_CATEGORY', 'Danh mục không tồn tại hoặc đã ngừng dùng');
};

const assertCompany = (user) => {
  const c = user.employer?.company;
  if (!c?.name || !c?.address || !c?.phone)
    throw new AppError(403, 'COMPANY_PROFILE_REQUIRED', 'Vui lòng hoàn thiện hồ sơ công ty (tên, địa chỉ, SĐT) trước khi đăng tin');
};

// API-20: FR-SRC-01, Nổi bật trước rồi mới nhất (BR-21)
router.get('/jobs', async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const q = req.query;
  const match = await visibleMatch();
  if (q.q) match.searchText = { $regex: escapeRegex(unaccent(q.q)) }; // ponytail: regex quét toàn bộ, đủ cho ~1.000 Job; đổi sang text index/Atlas Search khi dữ liệu lớn
  if (q.categoryId) match.categoryId = oid(q.categoryId);
  if (q.city) match.city = q.city;
  if (q.district) match.district = q.district;
  if (q.salaryType) match.salaryType = q.salaryType;
  if (q.salaryMin) match.salaryMax = { $gte: Number(q.salaryMin) };
  if (q.salaryMax) match.salaryMin = { $lte: Number(q.salaryMax) };
  // Lọc theo lịch học (busy = các ô buổi bận): giữ việc còn ít nhất 1 ca rảnh hoặc không có ca cố định (linh hoạt);
  // xếp việc hợp nhiều ca lên trước, việc linh hoạt xuống sau. fit/shiftCount trả về để hiện "Hợp 3/5 ca"
  const busy = q.busy !== undefined ? slotList(q.busy) : null;
  const bySchedule = busy ? [
    { $addFields: { shiftCount: { $size: { $ifNull: ['$shifts', []] } }, fit: { $size: { $setDifference: [{ $ifNull: ['$shifts', []] }, busy] } } } },
    { $match: { $or: [{ shiftCount: 0 }, { fit: { $gt: 0 } }] } },
    { $addFields: { flexible: { $eq: ['$shiftCount', 0] } } },
  ] : [];
  const [r] = await Job.aggregate([
    { $match: match },
    ...bySchedule,
    { $addFields: { isFeatured: { $gt: ['$featuredUntil', new Date()] } } },
    { $sort: busy ? { flexible: 1, fit: -1, isFeatured: -1, createdAt: -1 } : { isFeatured: -1, createdAt: -1 } },
    { $project: { searchText: 0, description: 0, requirements: 0 } },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]);
  ok(res, r.items, { page, limit, total: r.total[0]?.n || 0 });
});

// Thành phố/quận đang có Job để làm bộ lọc; counts = số tin theo quận, total = số tin cả thành phố (mục "Việc theo khu vực" ở trang chủ)
router.get('/jobs/locations', async (req, res) => {
  const rows = await Job.aggregate([{ $match: await visibleMatch() }, { $group: { _id: { city: '$city', district: '$district' }, n: { $sum: 1 } } }]);
  const map = {};
  for (const { _id, n } of rows) {
    const c = (map[_id.city] ||= { districts: new Set(), counts: {}, total: 0 });
    c.total += n;
    if (_id.district) { c.districts.add(_id.district); c.counts[_id.district] = n; }
  }
  ok(res, Object.entries(map).sort().map(([city, c]) => ({ city, districts: [...c.districts].sort(), counts: c.counts, total: c.total })));
});

// API-21
router.get('/jobs/:id', optionalAuth, async (req, res) => {
  const job = await Job.findOne({ _id: oid(req.params.id), deletedAt: null });
  const isOwner = job && req.user && job.employerId.equals(req.user._id);
  const isAdmin = req.user?.role === 'ADMIN';
  if (!job || (!isOwner && !isAdmin && !(await isVisible(job)))) throw new AppError(404, 'JOB_NOT_FOUND', 'Tin tuyển dụng không tồn tại hoặc đã ngừng tuyển');
  if (!isOwner) await Job.updateOne({ _id: job._id }, { $inc: { viewCount: 1 } });
  const [employer, category, application] = await Promise.all([
    User.findById(job.employerId),
    Category.findById(job.categoryId),
    req.user?.role === 'STUDENT' ? Application.findOne({ jobId: job._id, studentId: req.user._id }) : null,
  ]);
  ok(res, {
    job: { ...job.toJSON(), isFeatured: job.featuredUntil > new Date(), remainingSlots: job.slots - job.acceptedCount },
    employer: { _id: employer._id, fullName: employer.fullName, company: employer.employer?.company, ratingAvg: employer.ratingAvg, ratingCount: employer.ratingCount, isPremium: employer.isPremium() },
    category,
    myApplication: application && { _id: application._id, status: application.status },
  });
});

// API-22: FR-JOB-01
router.post('/jobs', authenticate, authorize('EMPLOYER'), requireVerified, validate(jobBody), async (req, res) => {
  assertCompany(req.user);
  if (req.body.startDate < today()) throw new AppError(400, 'VALIDATION_ERROR', 'Ngày bắt đầu phải từ hôm nay trở đi');
  await assertCategory(req.body.categoryId);
  await assertQuota(req.user);
  const c = req.user.employer.company;
  const job = await Job.create({
    ...req.body,
    employerId: req.user._id,
    companySnapshot: { name: c.name, logoUrl: c.logoUrl, city: c.city },
    expiresAt: expiryFor(req.user),
    featuredUntil: req.user.isPremium() ? req.user.employer.premiumUntil : undefined,
  });
  notifyAlerts(job).catch((e) => console.warn(`[alerts] ${e.message}`));
  ok(res, { job }, null, 201);
});

// API-23: FR-JOB-02, BR-18 khóa trường khi đã nhận người
router.put('/jobs/:id', authenticate, authorize('EMPLOYER'), validate(jobBody), async (req, res) => {
  const job = await findOwnJob(oid(req.params.id), req.user);
  if (job.status === 'HIDDEN') throw new AppError(409, 'JOB_HIDDEN', 'Tin đã bị quản trị viên ẩn, không sửa được');
  await assertCategory(req.body.categoryId);
  const b = req.body;
  const day = (d) => new Date(d).toISOString().slice(0, 10);
  if (day(b.startDate) === day(job.startDate)) b.startDate = job.startDate; // form gửi ngày, DB lưu cả giờ
  if (job.acceptedCount > 0) {
    const locked = ['salaryMin', 'salaryMax', 'salaryType', 'city', 'district', 'address']
      .filter((k) => String(b[k] ?? '') !== String(job[k] ?? ''));
    if (+b.startDate !== +job.startDate) locked.push('startDate');
    if (locked.length) throw new AppError(409, 'FIELD_LOCKED', 'Tin đã nhận người: không được sửa lương, địa điểm, ngày bắt đầu', locked);
    if (b.slots < job.acceptedCount) throw new AppError(409, 'FIELD_LOCKED', `Số chỗ không được nhỏ hơn số người đã nhận (${job.acceptedCount})`);
  } else if (+b.startDate !== +job.startDate && b.startDate < today()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Ngày bắt đầu phải từ hôm nay trở đi');
  }
  job.set(b);
  await mongoose.connection.transaction(async (session) => {
    // BR-27: số chỗ vừa giảm bằng số người đã nhận → đủ người
    const full = job.status === 'OPEN' && job.acceptedCount > 0 && job.slots <= job.acceptedCount;
    if (full) job.status = 'FILLED';
    await job.save({ session });
    if (full) await rejectPending(job, 'Đã đủ số lượng', req.user._id, session);
  });
  ok(res, { job });
});

// API-24: FR-JOB-03
router.patch('/jobs/:id/close', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const job = await findOwnJob(oid(req.params.id), req.user);
  if (job.status !== 'OPEN') throw new AppError(409, 'INVALID_STATUS', 'Chỉ đóng được tin đang tuyển');
  await mongoose.connection.transaction(async (session) => {
    job.status = 'CLOSED';
    await job.save({ session });
    await rejectPending(job, 'Nhà tuyển dụng đã đóng tin', req.user._id, session);
  });
  ok(res, { job });
});

// API-25: CLOSED → OPEN khi còn hạn và còn hạn mức
router.patch('/jobs/:id/reopen', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const job = await findOwnJob(oid(req.params.id), req.user);
  if (job.status !== 'CLOSED') throw new AppError(409, 'INVALID_STATUS', 'Chỉ mở lại được tin đã đóng');
  if (job.expiresAt < new Date()) throw new AppError(409, 'JOB_EXPIRED', 'Tin đã hết hạn, hãy đăng tin mới');
  if (job.acceptedCount >= job.slots) throw new AppError(409, 'JOB_FULL', 'Tin đã đủ số lượng');
  await assertQuota(req.user);
  job.status = 'OPEN';
  await job.save();
  ok(res, { job });
});

// API-26: BR-19 chỉ xóa mềm Job chưa có đơn
router.delete('/jobs/:id', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const job = await findOwnJob(oid(req.params.id), req.user);
  if (await Application.exists({ jobId: job._id })) throw new AppError(409, 'JOB_HAS_APPLICATIONS', 'Tin đã có người ứng tuyển, chỉ được đóng');
  job.deletedAt = new Date();
  await job.save();
  res.status(204).end();
});

export default router;
