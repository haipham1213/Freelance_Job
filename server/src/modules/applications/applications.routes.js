import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Job from '../../models/Job.js';
import User from '../../models/User.js';
import Review from '../../models/Review.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { ok, paging, oid, DAY } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, requireVerified } from '../../middlewares/auth.js';
import { notify } from '../../utils/notify.js';
import { recomputeRating } from '../../utils/rating.js';
import { isVisible, findOwnJob } from '../jobs/jobs.service.js';

const router = Router();
const FINISHED = ['COMPLETED', 'NOT_COMPLETED'];
const CONTACT_OPEN = ['ACCEPTED', ...FINISHED]; // BR-12
const REVIEW_WINDOW = 14 * DAY; // BR-33

const history = (status, by) => ({ $push: { statusHistory: { status, at: new Date(), by } } });

// Đổi trạng thái có điều kiện: chặn race (SV vừa rút đơn khi Employer bấm duyệt)
const transition = async (filter, update, session) => {
  const app = await Application.findOneAndUpdate(filter, update, { returnDocument: 'after', session });
  if (!app) throw new AppError(409, 'INVALID_STATUS', 'Trạng thái đơn đã thay đổi, vui lòng tải lại trang');
  return app;
};

const loadForEmployer = async (id, user) => {
  const app = await Application.findById(oid(id));
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn');
  if (!app.employerId.equals(user._id)) throw new AppError(403, 'FORBIDDEN', 'Đây không phải đơn ứng tuyển vào tin của bạn');
  return app;
};

// API-28: FR-APP-01
router.post('/jobs/:id/applications', authenticate, authorize('STUDENT'), requireVerified,
  validate(z.object({ coverLetter: z.string().trim().max(1000, 'Thư giới thiệu tối đa 1000 ký tự').optional() })),
  async (req, res) => {
    const cvUrl = req.user.student?.cv?.url;
    if (!cvUrl) throw new AppError(400, 'CV_REQUIRED', 'Bạn cần tải CV lên hồ sơ trước khi ứng tuyển');
    const job = await Job.findById(oid(req.params.id));
    if (!(await isVisible(job))) throw new AppError(409, 'JOB_NOT_OPEN', 'Tin đã đóng, đủ người hoặc hết hạn');
    let app;
    try {
      app = await Application.create({
        jobId: job._id,
        studentId: req.user._id,
        employerId: job.employerId,
        jobSnapshot: { title: job.title, companyName: job.companySnapshot?.name, startDate: job.startDate },
        coverLetter: req.body.coverLetter,
        cvUrl, // BR-13 snapshot
        statusHistory: [{ status: 'PENDING', at: new Date(), by: req.user._id }],
      });
    } catch (e) {
      if (e.code === 11000) throw new AppError(409, 'ALREADY_APPLIED', 'Bạn đã ứng tuyển tin này rồi');
      throw e;
    }
    await Job.updateOne({ _id: job._id }, { $inc: { applicationCount: 1 } });
    await notify(job.employerId, 'NEW_APPLICATION', 'Có đơn ứng tuyển mới', `${req.user.fullName} vừa ứng tuyển "${job.title}"`, `/employer/applications/${app._id}`);
    ok(res, { application: app }, null, 201);
  });

// API-31: FR-APP-04
router.get('/jobs/:id/applications', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const job = await findOwnJob(oid(req.params.id), req.user);
  const { page, limit, skip } = paging(req.query);
  const filter = { jobId: job._id, ...(req.query.status && { status: req.query.status }) };
  const [items, total] = await Promise.all([
    Application.find(filter).sort('-createdAt').skip(skip).limit(limit)
      .populate('studentId', 'fullName avatarUrl ratingAvg ratingCount student.school student.major student.yearOfStudy student.skills'),
    Application.countDocuments(filter),
  ]);
  ok(res, items, { page, limit, total, job: { _id: job._id, title: job.title, slots: job.slots, acceptedCount: job.acceptedCount, status: job.status } });
});

// API-32: kèm liên hệ bên kia khi ACCEPTED trở về sau (BR-12)
router.get('/applications/:id', authenticate, async (req, res) => {
  const app = await Application.findById(oid(req.params.id));
  if (!app) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn');
  const u = req.user;
  const side = app.studentId.equals(u._id) ? 'STUDENT' : app.employerId.equals(u._id) ? 'EMPLOYER' : u.role === 'ADMIN' ? 'ADMIN' : null;
  if (!side) throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền xem đơn này');
  const showContact = side === 'ADMIN' || CONTACT_OPEN.includes(app.status);
  const [student, employer, job, reviews] = await Promise.all([
    User.findById(app.studentId), User.findById(app.employerId), Job.findById(app.jobId).select('-searchText'), Review.find({ applicationId: app._id }),
  ]);
  const contact = (x) => (showContact ? { email: x.email, phone: x.phone } : {});
  const deadline = app.finishedAt && new Date(+app.finishedAt + REVIEW_WINDOW);
  const reviewed = side === 'STUDENT' ? app.reviewedByStudent : app.reviewedByEmployer;
  ok(res, {
    application: app,
    job,
    student: { _id: student._id, fullName: student.fullName, avatarUrl: student.avatarUrl, ratingAvg: student.ratingAvg, ratingCount: student.ratingCount, student: student.student, ...contact(student) },
    employer: { _id: employer._id, fullName: employer.fullName, company: employer.employer?.company, ratingAvg: employer.ratingAvg, ratingCount: employer.ratingCount, ...contact(employer), ...(showContact && { phone: employer.employer?.company?.phone || employer.phone }) },
    reviews,
    canReview: side !== 'ADMIN' && FINISHED.includes(app.status) && !reviewed && deadline > new Date(),
    reviewDeadline: deadline,
  });
});

// API-30: BR-25
router.patch('/applications/:id/withdraw', authenticate, authorize('STUDENT'), async (req, res) => {
  const app = await transition(
    { _id: oid(req.params.id), studentId: req.user._id, status: 'PENDING' },
    { status: 'WITHDRAWN', ...history('WITHDRAWN', req.user._id) },
  );
  ok(res, { application: app });
});

// API-33: FR-APP-05 trong transaction (BR-26, BR-27)
router.patch('/applications/:id/accept', authenticate, authorize('EMPLOYER'), requireVerified,
  validate(z.object({ employerNote: z.string().trim().max(500, 'Ghi chú tối đa 500 ký tự').optional() })),
  async (req, res) => {
    const app0 = await loadForEmployer(req.params.id, req.user);
    let result;
    await mongoose.connection.transaction(async (session) => {
      // acceptedCount < slots kiểm tra ngay trong lệnh cập nhật để 2 tab bấm cùng lúc chỉ 1 thành công
      const job = await Job.findOneAndUpdate(
        { _id: app0.jobId, status: 'OPEN', $expr: { $lt: ['$acceptedCount', '$slots'] } },
        { $inc: { acceptedCount: 1 } },
        { returnDocument: 'after', session },
      );
      if (!job) throw new AppError(409, 'JOB_FULL', 'Tin đã đủ số lượng hoặc không còn tuyển');
      const app = await transition(
        { _id: app0._id, status: 'PENDING' },
        { status: 'ACCEPTED', employerNote: req.body.employerNote, ...history('ACCEPTED', req.user._id) },
        session,
      );
      await notify(app.studentId, 'APPLICATION_ACCEPTED', 'Bạn đã được nhận!', `Nhà tuyển dụng đã nhận bạn cho "${job.title}"`, `/student/applications/${app._id}`, session);
      if (job.acceptedCount >= job.slots) {
        job.status = 'FILLED';
        await job.save({ session });
        const others = await Application.find({ jobId: job._id, status: 'PENDING' }).session(session);
        await Application.updateMany(
          { _id: { $in: others.map((a) => a._id) } },
          { status: 'REJECTED', rejectReason: 'Đã đủ số lượng', ...history('REJECTED', req.user._id) },
          { session },
        );
        for (const o of others)
          await notify(o.studentId, 'APPLICATION_REJECTED', 'Đơn ứng tuyển bị từ chối', `"${job.title}": Đã đủ số lượng`, `/student/applications/${o._id}`, session);
      }
      result = { application: app, jobStatus: job.status };
    });
    ok(res, result);
  });

// API-34
router.patch('/applications/:id/reject', authenticate, authorize('EMPLOYER'),
  validate(z.object({ reason: z.string().trim().max(500).optional() })),
  async (req, res) => {
    const app0 = await loadForEmployer(req.params.id, req.user);
    const app = await transition(
      { _id: app0._id, status: 'PENDING' },
      { status: 'REJECTED', rejectReason: req.body.reason, ...history('REJECTED', req.user._id) },
    );
    await notify(app.studentId, 'APPLICATION_REJECTED', 'Đơn ứng tuyển bị từ chối', `"${app.jobSnapshot.title}"${req.body.reason ? `: ${req.body.reason}` : ''}`, `/student/applications/${app._id}`);
    ok(res, { application: app });
  });

// API-35: FR-APP-06 (BR-29, BR-30)
router.patch('/applications/:id/result', authenticate, authorize('EMPLOYER'),
  validate(z.object({ result: z.enum(FINISHED), reason: z.string().trim().max(500).optional() })
    .refine((b) => b.result === 'COMPLETED' || b.reason, { message: 'Vui lòng ghi lý do không hoàn thành', path: ['reason'] })),
  async (req, res) => {
    const app0 = await loadForEmployer(req.params.id, req.user);
    const job = await Job.findById(app0.jobId);
    if (job.startDate > new Date()) throw new AppError(409, 'JOB_NOT_STARTED', 'Chưa tới ngày bắt đầu công việc');
    const { result, reason } = req.body;
    const app = await transition(
      { _id: app0._id, status: 'ACCEPTED' },
      { status: result, finishedAt: new Date(), ...(result === 'NOT_COMPLETED' && { notCompletedReason: reason }), ...history(result, req.user._id) },
    );
    if (job.status !== 'OPEN' && !(await Application.exists({ jobId: job._id, status: 'ACCEPTED' })))
      await Job.updateOne({ _id: job._id, status: { $in: ['FILLED', 'CLOSED'] } }, { status: 'COMPLETED' });
    await notify(app.studentId, 'WORK_RESULT', 'Kết quả công việc',
      `"${job.title}": ${result === 'COMPLETED' ? 'Hoàn thành' : 'Không hoàn thành'}. Bạn có 14 ngày để đánh giá nhà tuyển dụng.`, `/student/applications/${app._id}`);
    ok(res, { application: app });
  });

// API-39: FR-REV-01 (BR-31…33)
router.post('/applications/:id/reviews', authenticate, authorize('STUDENT', 'EMPLOYER'), requireVerified,
  validate(z.object({ rating: z.number().int().min(1, 'Điểm từ 1 đến 5').max(5, 'Điểm từ 1 đến 5'), comment: z.string().trim().max(500, 'Nhận xét tối đa 500 ký tự').optional() })),
  async (req, res) => {
    const app = await Application.findById(oid(req.params.id));
    if (!app) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn');
    const isStudent = app.studentId.equals(req.user._id);
    if (!isStudent && !app.employerId.equals(req.user._id)) throw new AppError(403, 'FORBIDDEN', 'Bạn không thuộc đơn này');
    if (!FINISHED.includes(app.status)) throw new AppError(409, 'INVALID_STATUS', 'Chỉ đánh giá được khi công việc đã kết thúc');
    if (+app.finishedAt + REVIEW_WINDOW < Date.now()) throw new AppError(409, 'REVIEW_WINDOW_CLOSED', 'Đã quá 14 ngày, không thể đánh giá');
    const flag = isStudent ? 'reviewedByStudent' : 'reviewedByEmployer';
    const revieweeId = isStudent ? app.employerId : app.studentId;
    let review;
    await mongoose.connection.transaction(async (session) => {
      const marked = await Application.updateOne({ _id: app._id, [flag]: false }, { [flag]: true }, { session });
      if (!marked.modifiedCount) throw new AppError(409, 'ALREADY_REVIEWED', 'Bạn đã đánh giá đơn này rồi');
      [review] = await Review.create([{
        applicationId: app._id, jobId: app.jobId, reviewerId: req.user._id, revieweeId,
        reviewerRole: req.user.role, rating: req.body.rating, comment: req.body.comment,
      }], { session });
      await recomputeRating(revieweeId, session);
      await notify(revieweeId, 'REVIEW_RECEIVED', 'Bạn nhận được đánh giá mới', `${req.user.fullName} đã đánh giá bạn ${req.body.rating}★`,
        isStudent ? `/employers/${revieweeId}` : `/employer/applications/${app._id}`, session);
    });
    ok(res, { review }, null, 201);
  });

// API-40
router.get('/users/:id/reviews', async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = { revieweeId: oid(req.params.id), isHidden: false };
  const [items, total, user] = await Promise.all([
    Review.find(filter).sort('-createdAt').skip(skip).limit(limit).populate('reviewerId', 'fullName avatarUrl'),
    Review.countDocuments(filter),
    User.findById(filter.revieweeId).select('ratingAvg ratingCount'),
  ]);
  ok(res, items, { page, limit, total, ratingAvg: user?.ratingAvg, ratingCount: user?.ratingCount });
});

export default router;
