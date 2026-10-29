import mongoose from 'mongoose';

// Đăng ký nhận email khi có tin mới còn ca rảnh so với lịch học (busySlots, ô 0–20 như Job.shifts)
const jobAlertSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    busySlots: { type: [Number], default: [] },
    // Chỉ gửi email việc mới sau khi chủ email bấm link xác nhận; bản ghi cũ không có trường này coi như đã xác nhận
    confirmed: Boolean,
    // Lịch học mới gửi lên, chờ xác nhận qua email rồi mới thay busySlots (người khác không ghi đè được lịch của bạn)
    pendingSlots: { type: [Number], default: undefined },
    token: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export default mongoose.model('JobAlert', jobAlertSchema);
