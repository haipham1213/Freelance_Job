import { Router } from 'express';
import { z } from 'zod';
import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Review from '../../models/Review.js';
import Payment from '../../models/Payment.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { ok, paging, oid } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { rawFile, saveUpload } from '../../utils/files.js';
import { quotaOf, TIERS, visibleMatch } from '../jobs/jobs.service.js';

const router = Router();
const employer = [authenticate, authorize('EMPLOYER')];

const profile = async (u) => ({ user: u.toPublic(), company: u.employer?.company || {}, premiumUntil: u.employer?.premiumUntil, isPremium: u.isPremium(), quota: await quotaOf(u) });

// Khi đổi tên/logo công ty thì cập nhật snapshot trong các Job (ít xảy ra)
const syncSnapshots = (u) => {
  const c = u.employer.company;
  return Job.updateMany({ employerId: u._id }, { companySnapshot: { name: c.name, logoUrl: c.logoUrl, city: c.city } });
};

// API-15
router.get('/employers/me', ...employer, async (req, res) => ok(res, await profile(req.user)));

// API-16: BR-11 tên, địa chỉ, SĐT bắt buộc
router.put('/employers/me', ...employer,
  validate(z.object({
    name: z.string().trim().min(2, 'Tên công ty 2–150 ký tự').max(150),
    address: z.string().trim().min(1, 'Vui lòng nhập địa chỉ').max(200),
    phone: z.string().trim().regex(/^0\d{9}$/, 'SĐT gồm 10 số, bắt đầu bằng 0'),
    city: z.string().trim().max(60).optional(),
    district: z.string().trim().max(60).optional(),
    description: z.string().trim().max(2000).optional(),
    website: z.url('Website không hợp lệ').optional().or(z.literal('')),
    fullName: z.string().trim().min(2).max(100).optional(),
  })),
  async (req, res) => {
    const { fullName, ...company } = req.body;
    const u = req.user;
    if (fullName) u.fullName = fullName;
    u.employer ||= {};
    u.employer.company = { ...(u.employer.company?.toObject?.() || {}), ...company };
    await u.save();
    await syncSnapshots(u);
    ok(res, await profile(u));
  });

// API-17: logo JPG/PNG ≤ 2 MB
router.post('/employers/me/logo', ...employer, rawFile(2), async (req, res) => {
  const logoUrl = await saveUpload(req.body, 'logos', ['jpg', 'png']);
  req.user.set('employer.company.logoUrl', logoUrl);
  await req.user.save();
  await syncSnapshots(req.user);
  ok(res, { logoUrl });
});

// API-27: Job của tôi + số đơn theo trạng thái
router.get('/employers/me/jobs', ...employer, async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = { employerId: req.user._id, deletedAt: null };
  const s = req.query.status;
  if (s === 'EXPIRED') Object.assign(filter, { status: 'OPEN', expiresAt: { $lt: new Date() } });
  else if (s === 'OPEN') Object.assign(filter, { status: 'OPEN', expiresAt: { $gte: new Date() } });
  else if (s) filter.status = s;
  const [jobs, total] = await Promise.all([
    Job.find(filter).select('-searchText -description -requirements').sort('-createdAt').skip(skip).limit(limit),
    Job.countDocuments(filter),
  ]);
  const counts = await Application.aggregate([
    { $match: { jobId: { $in: jobs.map((j) => j._id) } } },
    { $group: { _id: { job: '$jobId', status: '$status' }, n: { $sum: 1 } } },
  ]);
  const byJob = {};
  for (const c of counts) (byJob[c._id.job] ||= {})[c._id.status] = c.n;
  ok(res, jobs.map((j) => ({ ...j.toJSON(), counts: byJob[j._id] || {} })), { page, limit, total });
});

// Số liệu cho Dashboard Employer (SCR-E01)
router.get('/employers/me/stats', ...employer, async (req, res) => {
  const id = req.user._id;
  const [jobs, apps, recent] = await Promise.all([
    Job.aggregate([{ $match: { employerId: id, deletedAt: null } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Application.aggregate([{ $match: { employerId: id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Application.find({ employerId: id, status: 'PENDING' }).sort('-createdAt').limit(5).populate('studentId', 'fullName avatarUrl ratingAvg'),
  ]);
  const toMap = (rows) => Object.fromEntries(rows.map((r) => [r._id, r.n]));
  ok(res, { ...(await profile(req.user)), jobs: toMap(jobs), applications: toMap(apps), recentPending: recent, tiers: TIERS });
});

// API-49
router.get('/employers/me/payments', ...employer, async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = { employerId: req.user._id };
  const [items, total] = await Promise.all([Payment.find(filter).select('-ipnRaw').sort('-createdAt').skip(skip).limit(limit), Payment.countDocuments(filter)]);
  ok(res, items, { page, limit, total });
});

// Nhà tuyển dụng đang có tin mở, nhiều tin xếp trước (dải logo ở trang chủ)
router.get('/employers/hiring', async (req, res) => {
  const rows = await Job.aggregate([
    { $match: await visibleMatch() },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$employerId', jobs: { $sum: 1 }, company: { $first: '$companySnapshot' } } },
    { $sort: { jobs: -1, 'company.name': 1 } },
    { $limit: Math.min(24, Number(req.query.limit) || 12) },
  ]);
  ok(res, rows.map((r) => ({ _id: r._id, name: r.company?.name, logoUrl: r.company?.logoUrl, city: r.company?.city, jobs: r.jobs })));
});

// API-18: trang công khai
router.get('/employers/:id', async (req, res) => {
  const u = await User.findOne({ _id: oid(req.params.id), role: 'EMPLOYER' });
  if (!u || u.status === 'LOCKED') throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy nhà tuyển dụng');
  const { page, limit, skip } = paging(req.query);
  const [openJobs, reviews, total] = await Promise.all([
    Job.find({ ...(await visibleMatch()), employerId: u._id }).select('-searchText -description').sort('-createdAt').limit(20),
    Review.find({ revieweeId: u._id, isHidden: false }).sort('-createdAt').skip(skip).limit(limit).populate('reviewerId', 'fullName avatarUrl'),
    Review.countDocuments({ revieweeId: u._id, isHidden: false }),
  ]);
  ok(res, {
    employer: { _id: u._id, fullName: u.fullName, company: u.employer?.company, ratingAvg: u.ratingAvg, ratingCount: u.ratingCount, isPremium: u.isPremium(), createdAt: u.createdAt },
    openJobs,
    reviews,
  }, { page, limit, total });
});

export default router;
