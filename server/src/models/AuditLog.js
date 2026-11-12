import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    action: { type: String, required: true },
    targetType: String,
    targetId: mongoose.Schema.Types.ObjectId,
    detail: Object,
  },
  { timestamps: true },
);

export default mongoose.model('AuditLog', auditLogSchema);
