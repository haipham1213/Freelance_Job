import mongoose from 'mongoose';

// Đăng ký nhận email khi có tin mới còn ca rảnh so với lịch học (busySlots, ô 0–20 như Job.shifts)
const jobAlertSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    busySlots: { type: [Number], default: [] },
    token: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export default mongoose.model('JobAlert', jobAlertSchema);
