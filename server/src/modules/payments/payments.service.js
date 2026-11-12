import mongoose from 'mongoose';
import User from '../../models/User.js';
import Job from '../../models/Job.js';
import Payment from '../../models/Payment.js';
import AuditLog from '../../models/AuditLog.js';
import { DAY } from '../../utils/http.js';
import { notify } from '../../utils/notify.js';

// BR-37: premiumUntil mới = max(hiện tại, premiumUntil cũ) + số ngày; mọi tin chưa xóa được Nổi bật theo (tin đóng mở lại vẫn Nổi bật)
export const extendPremium = async (employerId, durationDays, session) => {
  const u = await User.findById(employerId).session(session || null);
  const base = Math.max(Date.now(), +(u.employer?.premiumUntil || 0));
  const premiumUntil = new Date(base + durationDays * DAY);
  u.set('employer.premiumUntil', premiumUntil);
  await u.save({ session });
  await Job.updateMany({ employerId, deletedAt: null }, { featuredUntil: premiumUntil }, { session });
  return premiumUntil;
};

// Chốt giao dịch PENDING → SUCCESS đúng một lần. Điều kiện status PENDING trong lệnh cập nhật → webhook gọi lại chỉ cộng hạn 1 lần (BR-36/37).
// Khác BR-38 cũ: tiền chuyển khoản đã vào thì kích hoạt kể cả khi quá 15 phút (mã QR không thu hồi được); hết 15 phút chỉ ngừng hiện QR.
// SePay không có kết quả "thất bại" rõ ràng nên không lưu FAILED; EXPIRED là trạng thái tính toán (displayStatus)
export const settle = async (payment, { gatewayRef, gatewayCode, raw }) =>
  mongoose.connection.transaction(async (session) => {
    const p = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'PENDING' },
      { status: 'SUCCESS', gatewayRef, gatewayCode, ipnRaw: raw, paidAt: new Date() },
      { returnDocument: 'after', session },
    );
    if (!p) return p;
    // T-05 / PR-R03: tài khoản đã bị khóa → ghi nhận tiền nhưng không cộng Premium, để admin hoàn tiền
    const owner = await User.findById(p.employerId).select('status').session(session);
    if (owner?.status === 'LOCKED') {
      await AuditLog.create([{ action: 'PAYMENT_LOCKED_ACCOUNT', targetType: 'PAYMENT', targetId: p._id, detail: { message: 'Tài khoản đã bị khóa, cần hoàn tiền', amount: p.amount } }], { session });
      return p;
    }
    const until = await extendPremium(p.employerId, p.planSnapshot.durationDays, session);
    await notify(p.employerId, 'PAYMENT_SUCCESS', 'Thanh toán thành công', `${p.planSnapshot.name} có hiệu lực đến ${until.toLocaleDateString('vi-VN')}`, '/employer', session);
    return p;
  });
