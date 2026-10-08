import { Router } from 'express';
import { z } from 'zod';
import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { ok, paging, oid } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { rawFile, saveUpload } from '../../utils/files.js';
import { visibleMatch } from '../jobs/jobs.service.js';

const router = Router();
const student = [authenticate, authorize('STUDENT')];

const phone = z.string().trim().regex(/^0\d{9}$/, 'SĐT gồm 10 số, bắt đầu bằng 0');

// % hoàn thiện hồ sơ (FR-PRO-01)
const completion = (u) => {
  const s = u.student || {};
  const parts = [u.fullName, u.phone, s.school, s.major, s.yearOfStudy, s.skills?.length, s.bio, s.cv?.url];
  return Math.round((parts.filter(Boolean).length / parts.length) * 100);
};

// API-11
router.get('/students/me', ...student, (req, res) => ok(res, { profile: req.user.toPublic(), completion: completion(req.user) }));

// API-12
router.put('/students/me', ...student,
  validate(z.object({
    fullName: z.string().trim().min(2).max(100),
    phone: phone.optional().or(z.literal('')),
    school: z.string().trim().max(150).optional(),
    major: z.string().trim().max(150).optional(),
    yearOfStudy: z.coerce.number().int().min(1).max(6).optional().nullable(),
    skills: z.array(z.string().trim().min(1).max(30)).max(15, 'Tối đa 15 kỹ năng').optional(),
    bio: z.string().trim().max(1000, 'Giới thiệu tối đa 1000 ký tự').optional(),
  })),
  async (req, res) => {
    const { fullName, phone, ...s } = req.body;
    const u = req.user;
    u.fullName = fullName;
    u.phone = phone || undefined;
    Object.assign(u.student, s);
    await u.save();
    ok(res, { profile: u.toPublic(), completion: completion(u) });
  });

// API-13: BR-10 PDF ≤ 5 MB; đơn cũ giữ link CV cũ (BR-13) vì file cũ không bị xóa
router.post('/students/me/cv', ...student, rawFile(5), async (req, res) => {
  const url = await saveUpload(req.body, 'cv', ['pdf']);
  req.user.student.cv = { url, fileName: String(req.query.fileName || 'CV.pdf').slice(0, 120), uploadedAt: new Date() };
  await req.user.save();
  ok(res, { cv: req.user.student.cv, completion: completion(req.user) });
});

// API-14: Admin, hoặc Employer có Job mà SV đã nộp
router.get('/students/:id', authenticate, authorize('EMPLOYER', 'ADMIN'), async (req, res) => {
  const id = oid(req.params.id);
  if (req.user.role === 'EMPLOYER' && !(await Application.exists({ studentId: id, employerId: req.user._id })))
    throw new AppError(403, 'FORBIDDEN', 'Bạn chỉ xem được hồ sơ ứng viên của tin mình đăng');
  const u = await User.findOne({ _id: id, role: 'STUDENT' });
  if (!u) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sinh viên');
  const p = u.toPublic();
  delete p.email;
  delete p.phone; // BR-12: liên hệ chỉ lộ qua chi tiết đơn khi đã ACCEPTED
  ok(res, { profile: p });
});

// API-29
router.get('/students/me/applications', ...student, async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = { studentId: req.user._id, ...(req.query.status && { status: { $in: String(req.query.status).split(',') } }) };
  const [items, total] = await Promise.all([
    Application.find(filter).sort('-createdAt').skip(skip).limit(limit),
    Application.countDocuments(filter),
  ]);
  ok(res, items, { page, limit, total });
});

// API-36: Job bị ẩn/hết hạn vẫn trả về kèm cờ isAvailable = false
router.get('/students/me/saved-jobs', ...student, async (req, res) => {
  const ids = req.user.student.savedJobIds || [];
  const [jobs, visibleIds] = await Promise.all([
    Job.find({ _id: { $in: ids } }).select('-searchText -description'),
    Job.find({ _id: { $in: ids }, ...(await visibleMatch()) }).distinct('_id'),
  ]);
  const visible = new Set(visibleIds.map(String));
  ok(res, jobs.map((j) => ({ ...j.toJSON(), isAvailable: visible.has(String(j._id)) })));
});

// API-37
router.put('/students/me/saved-jobs/:jobId', ...student, async (req, res) => {
  const jobId = oid(req.params.jobId);
  if (!(await Job.exists({ _id: jobId }))) throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy tin');
  const r = await User.updateOne(
    { _id: req.user._id, 'student.savedJobIds.99': { $exists: false } },
    { $addToSet: { 'student.savedJobIds': jobId } },
  );
  if (!r.matchedCount) throw new AppError(409, 'SAVED_LIMIT', 'Bạn chỉ lưu được tối đa 100 tin');
  res.status(204).end();
});

// API-38
router.delete('/students/me/saved-jobs/:jobId', ...student, async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $pull: { 'student.savedJobIds': oid(req.params.jobId) } });
  res.status(204).end();
});

export default router;
