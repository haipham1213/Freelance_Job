import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Application from '../../models/Application.js';
import AppError from '../../utils/AppError.js';
import { notify } from '../../utils/notify.js';
import { DAY } from '../../utils/http.js';

export const FREE_QUOTA = 3;
export const PREMIUM_QUOTA = 20;

// BR-22: Guest/Student chỉ thấy Job OPEN, còn hạn, không bị ẩn/xóa, của Employer không bị khóa
export const visibleMatch = async () => ({
  status: 'OPEN',
  expiresAt: { $gt: new Date() },
  deletedAt: null,
  employerId: { $nin: await User.find({ role: 'EMPLOYER', status: 'LOCKED' }).distinct('_id') },
});

export const isVisible = async (job) => !!job && (await Job.exists({ _id: job._id, ...(await visibleMatch()) }));

// BR-15: đếm Job OPEN còn hạn
export const quotaOf = async (employer) => {
  const used = await Job.countDocuments({ employerId: employer._id, status: 'OPEN', expiresAt: { $gt: new Date() }, deletedAt: null });
  return { used, limit: employer.isPremium() ? PREMIUM_QUOTA : FREE_QUOTA };
};

export const assertQuota = async (employer) => {
  const q = await quotaOf(employer);
  if (q.used >= q.limit) throw new AppError(403, 'QUOTA_EXCEEDED', `Bạn đã dùng hết ${q.limit} tin đang mở. Nâng cấp Premium để đăng thêm.`, q);
};

// BR-16: 14 ngày (Free) hoặc 30 ngày (Premium) theo gói tại lúc đăng
export const expiryFor = (employer) => new Date(Date.now() + (employer.isPremium() ? 30 : 14) * DAY);

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
