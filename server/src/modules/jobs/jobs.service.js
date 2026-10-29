import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { notify } from '../../utils/notify.js';
import { DAY } from '../../utils/http.js';

// BR-15, BR-16: số tin đang mở tối đa và số ngày hiển thị mỗi tin theo gói (frontend đọc qua meta của GET /plans)
export const TIERS = { free: { quota: 3, days: 14 }, premium: { quota: 20, days: 30 } };
const tierOf = (employer) => TIERS[employer.isPremium() ? 'premium' : 'free'];

// BR-22: Guest/Student chỉ thấy Job OPEN, còn hạn, không bị ẩn/xóa, của Employer không bị khóa
export const visibleMatch = async () => ({
  status: 'OPEN',
  expiresAt: { $gt: new Date() },
  deletedAt: null,
  employerId: { $nin: await User.find({ role: 'EMPLOYER', status: 'LOCKED' }).distinct('_id') },
});

export const isVisible = async (job, session) => !!job && (await Job.exists({ _id: job._id, ...(await visibleMatch()) }).session(session || null));

// BR-15: đếm Job OPEN còn hạn
export const quotaOf = async (employer, session) => {
  const used = await Job.countDocuments({ employerId: employer._id, status: 'OPEN', expiresAt: { $gt: new Date() }, deletedAt: null }).session(session || null);
  return { used, limit: tierOf(employer).quota };
};

// Gọi trong transaction: ghi vào User để 2 lần đăng/mở tin song song xung đột, lần chạy lại đếm được tin vừa mở
export const assertQuota = async (employer, session) => {
  await User.updateOne({ _id: employer._id }, { $set: { updatedAt: new Date() } }, { session, timestamps: false });
  const q = await quotaOf(employer, session);
  if (q.used >= q.limit) throw new AppError(403, 'QUOTA_EXCEEDED', `Bạn đã dùng hết ${q.limit} tin đang mở. Đóng bớt tin cũ để đăng thêm.`, q);
};

// BR-16: số ngày theo gói tại lúc đăng
export const expiryFor = (employer) => new Date(Date.now() + tierOf(employer).days * DAY);

export const findOwnJob = async (id, user) => {
  const job = await Job.findOne({ _id: id, deletedAt: null });
  if (!job) throw new AppError(404, 'JOB_NOT_FOUND', 'Không tìm thấy tin tuyển dụng');
  if (!job.employerId.equals(user._id)) throw new AppError(403, 'NOT_JOB_OWNER', 'Bạn không phải chủ tin tuyển dụng này');
  return job;
};

// BR-28: đóng/ẩn Job → đơn PENDING thành REJECTED, đơn ACCEPTED giữ nguyên
export const rejectPending = async (job, reason, byId, session) => {
  const pending = await Application.find({ jobId: job._id, status: 'PENDING' }).session(session || null);
  if (!pending.length) return;
  await Application.updateMany(
    { _id: { $in: pending.map((a) => a._id) } },
    { status: 'REJECTED', rejectReason: reason, $push: { statusHistory: { status: 'REJECTED', at: new Date(), by: byId } } },
    { session },
  );
  for (const a of pending)
    await notify(a.studentId, 'APPLICATION_REJECTED', 'Đơn ứng tuyển bị từ chối', `"${job.title}": ${reason}`, `/student/applications/${a._id}`, session);
};

// BR-12: số điện thoại công ty chỉ lộ cho sinh viên đã được nhận (qua contact ở chi tiết đơn)
export const publicCompany = (employer) => {
  const { phone, ...company } = employer.toObject().employer?.company || {};
  return company;
};

// Tin OPEN đã quá hạn: từ chối đơn còn chờ; ai được nhận cũng đã có kết quả thì chuyển COMPLETED (ST-06)
// ponytail: quét lại mọi tin hết hạn mỗi giờ; thêm cờ đã xử lý nếu số tin hết hạn lên hàng chục nghìn
export const sweepExpired = async () => {
  for (const job of await Job.find({ status: 'OPEN', expiresAt: { $lt: new Date() }, deletedAt: null })) {
    await rejectPending(job, 'Tin đã hết hạn', job.employerId);
    if (job.acceptedCount > 0 && !(await Application.exists({ jobId: job._id, status: 'ACCEPTED' })))
      await Job.updateOne({ _id: job._id, status: 'OPEN' }, { status: 'COMPLETED' });
  }
};
