import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Job from '../../models/Job.js';
import User from '../../models/User.js';
import Category from '../../models/Category.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { ok, cdnCache, paging, oid, unaccent, escapeRegex, slotList, vnDay } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, optionalAuth, authorize, requireVerified } from '../../middlewares/auth.js';
import { visibleMatch, isVisible, assertQuota, expiryFor, findOwnJob, rejectPending, publicCompany, completeIfDone } from './jobs.service.js';

import { notifyAlerts } from '../alerts/alerts.routes.js';
import { inBackground } from '../../config/mailer.js';
const router = Router();


// BR-43: tọa độ ghim phải nằm trong khung lãnh thổ Việt Nam (chặn ghim nhầm ra biển hoặc nước khác)
const VN = { lat: [8, 24], lng: [102, 110] };
const inVN = (lat, lng) => lat >= VN.lat[0] && lat <= VN.lat[1] && lng >= VN.lng[0] && lng <= VN.lng[1];
const samePoint = (a, b) => (a?.coordinates || []).join() === (b?.coordinates || []).join();

// BR-14
const jobBody = z.object({
  title: z.string().trim().min(10, 'Tiêu đề 10–120 ký tự').max(120, 'Tiêu đề 10–120 ký tự'),
  description: z.string().trim().min(50, 'Mô tả tối thiểu 50 ký tự').max(5000),
  requirements: z.string().trim().max(2000).optional(),
  categoryId: z.string().refine(mongoose.isValidObjectId, 'Vui lòng chọn danh mục'),
  city: z.string().trim().min(1, 'Vui lòng chọn thành phố'),
  district: z.string().trim().optional(),
  address: z.string().trim().max(200).optional(),
  // { lat, lng } → GeoJSON; null = bỏ ghim, không gửi = giữ nguyên
  location: z.object({ lat: z.number(), lng: z.number() }).refine((p) => inVN(p.lat, p.lng), 'Vị trí ghim phải nằm trong lãnh thổ Việt Nam')
    .nullable().optional().transform((p) => p && { type: 'Point', coordinates: [p.lng, p.lat] }),
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

// Bộ lọc dùng chung cho danh sách (API-20) và bản đồ (API-79). Trả các stage đầu pipeline + thông tin để sắp xếp
const searchStages = async (q) => {
  const match = await visibleMatch();
  if (q.q) match.searchText = { $regex: escapeRegex(unaccent(String(q.q))) }; // ponytail: regex quét toàn bộ, đủ cho ~1.000 Job; đổi sang text index/Atlas Search khi dữ liệu lớn
  if (q.categoryId) match.categoryId = oid(q.categoryId);
  if (q.city) match.city = q.city;
  if (q.district) match.district = q.district;
  if (q.salaryType) match.salaryType = q.salaryType;
  if (q.salaryMin) match.salaryMax = { $gte: Number(q.salaryMin) };
  if (q.salaryMax) match.salaryMin = { $lte: Number(q.salaryMax) };
  // Lọc theo lịch học (busy = các ô buổi bận): giữ việc không có ca cố định (linh hoạt) hoặc có ca rảnh rơi vào ít nhất
  // minDays ngày khác nhau (mặc định 1 = còn ít nhất 1 ca rảnh); tin chỉ có ca trong ít ngày hơn thì cần rảnh đủ mọi ngày đó.
  // Xếp việc hợp nhiều ca lên trước, việc linh hoạt xuống sau. fit/shiftCount/fitDays trả về để hiện "Hợp 3/5 ca"
  const busy = q.busy !== undefined ? slotList(q.busy) : null;
  const minDays = Math.min(Math.max(parseInt(q.minDays, 10) || 1, 1), 7);
  const days = (cells) => ({ $size: { $setUnion: [{ $map: { input: cells, in: { $floor: { $divide: ['$$this', 3] } } } }, []] } });
  const bySchedule = busy ? [
    { $addFields: { free: { $setDifference: [{ $ifNull: ['$shifts', []] }, busy] }, shiftCount: { $size: { $ifNull: ['$shifts', []] } } } },
    { $addFields: { fit: { $size: '$free' }, fitDays: days('$free'), jobDays: days({ $ifNull: ['$shifts', []] }) } },
    { $match: { $or: [{ shiftCount: 0 }, { $expr: { $and: [{ $gt: ['$fit', 0] }, { $gte: ['$fitDays', { $min: [minDays, '$jobDays'] }] }] } }] } },
    { $addFields: { flexible: { $eq: ['$shiftCount', 0] } } },
    { $project: { free: 0, jobDays: 0 } },
  ] : [];
  // FR-SRC-05 / BR-44: near=vĩ độ,kinh độ + radius (km, 0,5–50, mặc định 5) → chỉ giữ tin có ghim trong bán kính, kèm distance (mét, đường chim bay).
  // Điểm xuất phát chỉ dùng để tính, không lưu lại
  let near = null;
  if (q.near !== undefined) {
    const [lat, lng] = String(q.near).split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inVN(lat, lng)) throw new AppError(400, 'VALIDATION_ERROR', 'Điểm xuất phát không hợp lệ');
    near = { lat, lng, radius: Math.min(50, Math.max(0.5, Number(q.radius) || 5)) };
  }
  const head = near
    ? [{ $geoNear: { near: { type: 'Point', coordinates: [near.lng, near.lat] }, key: 'location', distanceField: 'distance', maxDistance: near.radius * 1000, query: match, spherical: true } },
      { $addFields: { distance: { $round: ['$distance', 0] } } }]
    : [{ $match: match }];
  const stages = [...head, ...bySchedule, { $addFields: { isFeatured: { $gt: ['$featuredUntil', new Date()] } } }];
  // Nổi bật trước (BR-21); đang lọc khoảng cách thì gần trước, không thì mới trước
  const order = near ? { isFeatured: -1, distance: 1 } : { isFeatured: -1, createdAt: -1 };
  // Số tin khớp các bộ lọc khác nhưng chưa ghim vị trí, để giao diện nói rõ vì sao chúng không hiện
  const noLocation = async () => (await Job.aggregate([{ $match: { ...match, location: null } }, ...bySchedule, { $count: 'n' }]))[0]?.n || 0;
  return { match, stages, sort: busy ? { flexible: 1, fit: -1, ...order } : order, near, noLocation };
};

// API-20: FR-SRC-01, Nổi bật trước rồi mới nhất (BR-21); có near thì lọc theo khoảng cách (FR-SRC-05)
router.get('/jobs', cdnCache(15), async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const s = await searchStages(req.query);
  const [[r], noLocation] = await Promise.all([
    Job.aggregate([
      ...s.stages,
      { $sort: s.sort },
      // Bỏ mô tả đầy đủ cho nhẹ, chỉ gửi đoạn đầu để thẻ việc hiện 2 dòng tóm tắt
      { $addFields: { excerpt: { $substrCP: [{ $ifNull: ['$description', ''] }, 0, 160] } } },
      { $project: { searchText: 0, description: 0, requirements: 0 } },
      { $facet: { items: [{ $skip: skip }, { $limit: limit }], total: [{ $count: 'n' }] } },
    ]),
    s.near ? s.noLocation() : undefined,
  ]);
  ok(res, r.items, { page, limit, total: r.total[0]?.n || 0, ...(s.near && { radius: s.near.radius, noLocation }) });
});

// API-79: FR-SRC-05, các tin có ghim vị trí khớp cùng bộ lọc với API-20 để vẽ lên bản đồ (không phân trang, tối đa 200 ghim)
const MAP_LIMIT = 200;
router.get('/jobs/map', cdnCache(15), async (req, res) => {
  const s = await searchStages(req.query);
  const [[r], noLocation] = await Promise.all([
    Job.aggregate([
      ...s.stages,
      ...(s.near ? [] : [{ $match: { 'location.coordinates.1': { $exists: true } } }]),
      { $sort: s.sort },
      { $project: { searchText: 0, description: 0, requirements: 0 } },
      { $facet: { items: [{ $limit: MAP_LIMIT }], total: [{ $count: 'n' }] } },
    ]),
    s.noLocation(),
  ]);
  ok(res, r.items, { total: r.total[0]?.n || 0, limit: MAP_LIMIT, noLocation, ...(s.near && { radius: s.near.radius }) });
});

// Thành phố/quận đang có Job để làm bộ lọc; counts = số tin theo quận, total = số tin cả thành phố (mục "Việc theo khu vực" ở trang chủ)
router.get('/jobs/locations', cdnCache(60), async (req, res) => {
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
  // jobsPosted / hiredCount: chỉ số "Thông tin khác" ở cột phải trang chi tiết việc (số tin đã đăng, số sinh viên đã được nhận)
  const [employer, category, application, jobsPosted, hiredCount] = await Promise.all([
    User.findById(job.employerId),
    Category.findById(job.categoryId).lean(),
    req.user?.role === 'STUDENT' ? Application.findOne({ jobId: job._id, studentId: req.user._id }) : null,
    Job.countDocuments({ employerId: job.employerId, deletedAt: null }),
    Application.countDocuments({ employerId: job.employerId, status: { $in: ['ACCEPTED', 'COMPLETED', 'NOT_COMPLETED'] } }),
    !isOwner && Job.updateOne({ _id: job._id }, { $inc: { viewCount: 1 } }),
  ]);
  ok(res, {
    job: { ...job.toJSON(), isFeatured: job.featuredUntil > new Date(), remainingSlots: job.slots - job.acceptedCount },
    employer: { _id: employer._id, fullName: employer.fullName, company: publicCompany(employer), ratingAvg: employer.ratingAvg, ratingCount: employer.ratingCount, isPremium: employer.isPremium(), createdAt: employer.createdAt, jobsPosted, hiredCount },
    category,
    myApplication: application && { _id: application._id, status: application.status },
    isSaved: !!req.user?.student?.savedJobIds?.some((j) => j.equals(job._id)),
  });
});

// API-22: FR-JOB-01
router.post('/jobs', authenticate, authorize('EMPLOYER'), requireVerified, validate(jobBody), async (req, res) => {
  assertCompany(req.user);
  if (vnDay(req.body.startDate) < vnDay()) throw new AppError(400, 'VALIDATION_ERROR', 'Ngày bắt đầu phải từ hôm nay trở đi');
  await assertCategory(req.body.categoryId);
  const c = req.user.employer.company;
  let job;
  await mongoose.connection.transaction(async (session) => {
    await assertQuota(req.user, session);
    [job] = await Job.create([{
      ...req.body,
      location: req.body.location || undefined,
      employerId: req.user._id,
      companySnapshot: { name: c.name, logoUrl: c.logoUrl, city: c.city },
      expiresAt: expiryFor(req.user),
      featuredUntil: req.user.isPremium() ? req.user.employer.premiumUntil : undefined,
    }], { session });
  });
  inBackground(notifyAlerts(job), 'alerts');
  ok(res, { job }, null, 201);
});

// API-23: FR-JOB-02, BR-18 khóa trường khi đã nhận người
router.put('/jobs/:id', authenticate, authorize('EMPLOYER'), validate(jobBody), async (req, res) => {
  const { _id } = await findOwnJob(oid(req.params.id), req.user);
  const b = req.body;
  let job;
  // Đọc lại tin trong transaction: bấm Nhận cùng lúc cũng ghi vào Job nên gây xung đột, lần chạy lại thấy acceptedCount mới
  await mongoose.connection.transaction(async (session) => {
    job = await Job.findById(_id).session(session);
    if (job.status === 'HIDDEN') throw new AppError(409, 'JOB_HIDDEN', 'Tin đã bị quản trị viên ẩn, không sửa được');
    if (job.status === 'COMPLETED') throw new AppError(409, 'INVALID_STATUS', 'Tin đã hoàn thành, không sửa được');
    // Danh mục bị ẩn sau khi đăng vẫn giữ được, chỉ chặn chọn danh mục ẩn mới
    if (String(b.categoryId) !== String(job.categoryId)) await assertCategory(b.categoryId);
    const day = (d) => new Date(d).toISOString().slice(0, 10);
    if (day(b.startDate) === day(job.startDate)) b.startDate = job.startDate; // form gửi ngày, DB lưu cả giờ
    if (job.acceptedCount > 0) {
      const locked = ['salaryMin', 'salaryMax', 'salaryType', 'city', 'district', 'address']
        .filter((k) => String(b[k] ?? '') !== String(job[k] ?? ''));
      if (+b.startDate !== +job.startDate) locked.push('startDate');
      if (b.location !== undefined && !samePoint(b.location, job.location)) locked.push('location');
      if (locked.length) throw new AppError(409, 'FIELD_LOCKED', 'Tin đã nhận người: không được sửa lương, địa điểm, ngày bắt đầu', locked);
      if (b.slots < job.acceptedCount) throw new AppError(409, 'FIELD_LOCKED', `Số chỗ không được nhỏ hơn số người đã nhận (${job.acceptedCount})`);
    } else if (+b.startDate !== +job.startDate && vnDay(b.startDate) < vnDay()) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Ngày bắt đầu phải từ hôm nay trở đi');
    }
    // Tin đủ người được tăng số chỗ → tuyển tiếp (tính vào hạn mức tin đang mở)
    const reopen = job.status === 'FILLED' && b.slots > job.acceptedCount && job.expiresAt > new Date();
    if (reopen) await assertQuota(req.user, session);
    job.set(b);
    if (b.location === null) job.location = undefined; // bỏ ghim
    if (reopen) job.status = 'OPEN';
    // BR-27: số chỗ vừa giảm bằng số người đã nhận → đủ người
    const full = job.status === 'OPEN' && job.acceptedCount > 0 && job.slots <= job.acceptedCount;
    if (full) job.status = 'FILLED';
    await job.save({ session });
    if (full) await rejectPending(job, 'Đã đủ số lượng', req.user._id, session);
    // T-01(a): giảm số chỗ bằng số đã nhận khi mọi đơn đã có kết quả → hoàn thành luôn
    if (full && (await completeIfDone(job._id, session))) job.status = 'COMPLETED';
  });
  ok(res, { job });
});

// API-24: FR-JOB-03
router.patch('/jobs/:id/close', authenticate, authorize('EMPLOYER'), async (req, res) => {
  let job = await findOwnJob(oid(req.params.id), req.user);
  await mongoose.connection.transaction(async (session) => {
    // T-03: đọc lại trong transaction — nhận người cuối cùng lúc (ghi FILLED vào Job) sẽ xung đột, lần chạy lại thấy trạng thái mới
    job = await Job.findById(job._id).session(session);
    if (job.status !== 'OPEN') throw new AppError(409, 'INVALID_STATUS', 'Chỉ đóng được tin đang tuyển');
    job.status = 'CLOSED';
    await job.save({ session });
    await rejectPending(job, 'Nhà tuyển dụng đã đóng tin', req.user._id, session);
    // ST-06: mọi người đã nhận đều đã được xác nhận kết quả → COMPLETED
    if (await completeIfDone(job._id, session)) job.status = 'COMPLETED';
  });
  ok(res, { job });
});

// API-25: CLOSED → OPEN khi còn hạn và còn hạn mức
router.patch('/jobs/:id/reopen', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const job = await findOwnJob(oid(req.params.id), req.user);
  if (job.status !== 'CLOSED') throw new AppError(409, 'INVALID_STATUS', 'Chỉ mở lại được tin đã đóng');
  if (job.expiresAt < new Date()) throw new AppError(409, 'JOB_EXPIRED', 'Tin đã hết hạn, hãy đăng tin mới');
  if (job.acceptedCount >= job.slots) throw new AppError(409, 'JOB_FULL', 'Tin đã đủ số lượng');
  await mongoose.connection.transaction(async (session) => {
    await assertQuota(req.user, session);
    job.status = 'OPEN';
    await job.save({ session });
  });
  ok(res, { job });
});

// API-26: BR-19 chỉ xóa mềm Job chưa có đơn
router.delete('/jobs/:id', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const job = await findOwnJob(oid(req.params.id), req.user);
  // T-02: điều kiện chưa có đơn nằm ngay trong lệnh ghi, tránh ứng tuyển chen vào giữa
  const r = await Job.updateOne({ _id: job._id, applicationCount: 0, deletedAt: null }, { deletedAt: new Date() });
  if (!r.modifiedCount) throw new AppError(409, 'JOB_HAS_APPLICATIONS', 'Tin đã có người ứng tuyển, chỉ được đóng');
  res.status(204).end();
});

export default router;
