import mongoose from 'mongoose';

const { Schema } = mongoose;

export const REPORT_REASONS = ['SCAM', 'WRONG_INFO', 'HARASSMENT', 'UNPAID_OR_ABSENT', 'FALSE_REVIEW', 'RETALIATION', 'OTHER'];
// BR-48: lý do khiếu nại đánh giá
export const REVIEW_REASONS = ['FALSE_REVIEW', 'RETALIATION', 'HARASSMENT', 'OTHER'];

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['JOB', 'USER', 'REVIEW'], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    reason: { type: String, enum: REPORT_REASONS, required: true },
    description: { type: String, maxlength: 500 },
    status: { type: String, enum: ['OPEN', 'RESOLVED', 'DISMISSED'], default: 'OPEN' },
    // abusive: Admin bác bỏ và xác định báo cáo sai / cố ý lạm dụng (BR-49), tính vào lịch sử người báo cáo
    resolution: { level: String, note: String, abusive: Boolean, adminId: Schema.Types.ObjectId, at: Date },
  },
  { timestamps: true },
);

// BR-39: mỗi người 1 báo cáo đang mở cho cùng đối tượng
reportSchema.index({ reporterId: 1, targetType: 1, targetId: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' } });
reportSchema.index({ status: 1, createdAt: -1 });
reportSchema.index({ reporterId: 1, 'resolution.abusive': 1 });

export default mongoose.model('Report', reportSchema);
