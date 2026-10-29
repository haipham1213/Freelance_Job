// Thêm ứng viên mẫu đủ các trạng thái cho một tin để test màn Xem ứng viên.
// npm run seed:applicants -- "Nhập liệu đơn hàng tại văn phòng – Cái Răng"
// Chỉ dùng sinh viên đã có CV, bỏ qua người đã ứng tuyển tin này; luôn chừa ít nhất 1 chỗ để test bấm Nhận.
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Application from '../src/models/Application.js';
import { DAY } from '../src/utils/http.js';

const title = process.argv[2];
if (!title) throw new Error('Thiếu tên tin: npm run seed:applicants -- "<tên tin>"');

await mongoose.connect(process.env.MONGODB_URI);

const job = await Job.findOne({ title, deletedAt: null }).sort('-createdAt');
if (!job) throw new Error(`Không thấy tin "${title}"`);
const employer = await User.findById(job.employerId);

const LETTERS = [
  'Em là sinh viên năm 2, gõ phím nhanh và quen Excel. Em rảnh các buổi chiều trong tuần.',
  'Em từng nhập liệu cho cửa hàng của gia đình, cẩn thận và đúng giờ. Mong được anh chị xem xét.',
  'Em muốn tìm việc gần trường để vừa học vừa làm. Em có thể bắt đầu ngay tuần sau.',
  '',
  'Em thành thạo Word, Excel, Google Sheets; tốc độ gõ khoảng 60 từ/phút.',
  'Em đã làm part-time văn phòng 6 tháng, quen quy trình đối soát đơn hàng.',
  '',
  'Em rảnh thứ 7, chủ nhật và các buổi tối, có xe đi lại.',
];
const REJECT_REASONS = ['Lịch rảnh chưa phù hợp với ca làm', 'Đã chọn ứng viên có kinh nghiệm hơn', 'Hồ sơ chưa đủ thông tin'];

// Kế hoạch trạng thái: chỗ còn trống trừ 1 dành cho ACCEPTED/COMPLETED/NOT_COMPLETED
const freeSlots = Math.max(0, job.slots - job.acceptedCount - 1);
const accepted = ['ACCEPTED', 'COMPLETED', 'NOT_COMPLETED'].slice(0, job.startDate <= new Date() ? freeSlots : 0);
if (job.startDate > new Date()) accepted.push(...Array(freeSlots).fill('ACCEPTED'));
const plan = [...accepted, 'REJECTED', 'REJECTED', 'REJECTED', ...Array(8).fill('PENDING')];

const applied = await Application.distinct('studentId', { jobId: job._id });
const students = await User.aggregate([
  { $match: { role: 'STUDENT', status: 'ACTIVE', email: /@demo\.vn$/, 'student.cv.url': { $exists: true }, _id: { $nin: applied } } },
  { $sample: { size: plan.length } },
]);

const now = Date.now();
const docs = students.map((s, i) => {
  const status = plan[i];
  const appliedAt = new Date(now - (plan.length - i) * 0.4 * DAY);
  const decidedAt = new Date(appliedAt.getTime() + 0.2 * DAY);
  const history = [{ status: 'PENDING', at: appliedAt, by: s._id }];
  if (status !== 'PENDING') history.push({ status: status === 'REJECTED' ? 'REJECTED' : 'ACCEPTED', at: decidedAt, by: employer._id });
  if (status === 'COMPLETED' || status === 'NOT_COMPLETED') history.push({ status, at: new Date(now - 0.1 * DAY), by: employer._id });
  return {
    jobId: job._id,
    studentId: s._id,
    employerId: employer._id,
    jobSnapshot: { title: job.title, companyName: employer.employer?.company?.name, startDate: job.startDate },
    coverLetter: LETTERS[i % LETTERS.length] || undefined,
    cvUrl: s.student.cv.url,
    status,
    statusHistory: history,
    ...(status !== 'PENDING' && status !== 'REJECTED' && { employerNote: 'Có mặt lúc 13h tại văn phòng, mang theo CCCD.' }),
    ...(status === 'REJECTED' && { rejectReason: REJECT_REASONS[i % REJECT_REASONS.length] }),
    ...(status === 'NOT_COMPLETED' && { notCompletedReason: 'Nghỉ giữa chừng không báo trước' }),
    ...(['COMPLETED', 'NOT_COMPLETED'].includes(status) && { finishedAt: new Date(now - 0.1 * DAY) }),
    createdAt: appliedAt,
    updatedAt: history.at(-1).at,
  };
});

await Application.insertMany(docs, { timestamps: false });
const acceptedAdded = docs.filter((d) => d.status !== 'PENDING' && d.status !== 'REJECTED').length;
await Job.updateOne({ _id: job._id }, { $inc: { applicationCount: docs.length, acceptedCount: acceptedAdded } });

const count = (st) => docs.filter((d) => d.status === st).length;
console.log(`"${job.title}" (${employer.email}): +${docs.length} đơn`,
  Object.fromEntries(['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'NOT_COMPLETED'].map((st) => [st, count(st)])),
  `| đã nhận ${job.acceptedCount + acceptedAdded}/${job.slots}`);
await mongoose.disconnect();
