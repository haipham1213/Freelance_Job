// Thêm đơn đã hoàn thành + đánh giá từ nhà tuyển dụng demo cho một sinh viên, để test "Điểm uy tín" (BR-34).
// npm run seed:reviews -- <email sinh viên>            thêm 5 đánh giá
// npm run seed:reviews -- <email sinh viên> --undo     gỡ đúng dữ liệu script này đã thêm
// Chỉ dùng tin đã CLOSED/COMPLETED của tài khoản @demo.vn nên không chiếm chỗ của tin đang tuyển.
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Application from '../src/models/Application.js';
import Review from '../src/models/Review.js';
import { recomputeRating } from '../src/utils/rating.js';
import { DAY } from '../src/utils/http.js';

const [email, flag] = process.argv.slice(2);
if (!email) throw new Error('Thiếu email: npm run seed:reviews -- <email> [--undo]');
const MARK = 'Dữ liệu mẫu (seed:reviews)';

await mongoose.connect(process.env.MONGODB_URI);
const student = await User.findOne({ email, role: 'STUDENT' });
if (!student) throw new Error(`Không thấy sinh viên ${email}`);

if (flag === '--undo') {
  const apps = await Application.find({ studentId: student._id, employerNote: MARK });
  const { deletedCount } = await Review.deleteMany({ applicationId: { $in: apps.map((a) => a._id) } });
  for (const a of apps) await Job.updateOne({ _id: a.jobId }, { $inc: { applicationCount: -1, acceptedCount: -1 } });
  await Application.deleteMany({ _id: { $in: apps.map((a) => a._id) } });
  await recomputeRating(student._id);
  console.log(`Đã gỡ ${apps.length} đơn, ${deletedCount} đánh giá của ${email}`);
} else {
  const REVIEWS = [
    [5, 'Bạn đến đúng giờ, làm việc nhanh nhẹn, khách khen nhiều. Sẽ mời lại.'],
    [5, 'Cẩn thận, chủ động hỏi khi chưa rõ việc. Rất hài lòng.'],
    [4, 'Làm tốt, cần nhanh hơn chút vào giờ cao điểm.'],
    [5, 'Thái độ tốt, hoàn thành đủ các ca đã nhận.'],
    [3, 'Hoàn thành công việc nhưng có một buổi đến trễ 15 phút.'],
  ];
  const done = await Application.distinct('jobId', { studentId: student._id });
  // Mỗi nhà tuyển dụng demo một tin đã kết thúc, sinh viên chưa ứng tuyển
  const jobs = await Job.aggregate([
    { $match: { status: { $in: ['CLOSED', 'COMPLETED'] }, deletedAt: null, _id: { $nin: done } } },
    { $lookup: { from: 'users', localField: 'employerId', foreignField: '_id', as: 'e' } },
    { $match: { 'e.email': /@demo\.vn$/ } },
    { $sample: { size: 60 } },
    { $group: { _id: '$employerId', job: { $first: '$$ROOT' } } },
    { $limit: REVIEWS.length },
  ]);
  if (!student.student?.cv?.url) throw new Error('Sinh viên chưa có CV (đơn ứng tuyển bắt buộc cvUrl)');

  const now = Date.now();
  for (const [i, { job }] of jobs.entries()) {
    const employer = job.e[0];
    const appliedAt = new Date(now - (30 - i * 5) * DAY);
    const acceptedAt = new Date(+appliedAt + DAY);
    const finishedAt = new Date(+appliedAt + 4 * DAY);
    const [app] = await Application.insertMany([{
      jobId: job._id, studentId: student._id, employerId: employer._id,
      jobSnapshot: { title: job.title, companyName: employer.employer?.company?.name, startDate: job.startDate },
      cvUrl: student.student.cv.url, status: 'COMPLETED', employerNote: MARK, finishedAt, reviewedByEmployer: true,
      statusHistory: [
        { status: 'PENDING', at: appliedAt, by: student._id },
        { status: 'ACCEPTED', at: acceptedAt, by: employer._id },
        { status: 'COMPLETED', at: finishedAt, by: employer._id },
      ],
      createdAt: appliedAt, updatedAt: finishedAt,
    }], { timestamps: false });
    const [rating, comment] = REVIEWS[i];
    const at = new Date(+finishedAt + DAY);
    await Review.insertMany([{
      applicationId: app._id, jobId: job._id, reviewerId: employer._id, revieweeId: student._id,
      reviewerRole: 'EMPLOYER', rating, comment, createdAt: at, updatedAt: at,
    }], { timestamps: false });
    await Job.updateOne({ _id: job._id }, { $inc: { applicationCount: 1, acceptedCount: 1 } });
    console.log(`${rating}★ ${employer.email} – ${job.title}`);
  }
  await recomputeRating(student._id);
}
const u = await User.findById(student._id).select('ratingAvg ratingCount');
console.log(`${email}: điểm uy tín ${u.ratingCount ? `${u.ratingAvg.toFixed(1)}★ (${u.ratingCount} đánh giá)` : '—'}`);
await mongoose.disconnect();
