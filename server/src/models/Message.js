import mongoose from 'mongoose';

// FR-MSG-01: tin nhắn gắn với một đơn ứng tuyển (mỗi đơn là một cuộc trò chuyện giữa sinh viên và nhà tuyển dụng)
const messageSchema = new mongoose.Schema(
  {
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, maxlength: 1000 },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

messageSchema.index({ applicationId: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
