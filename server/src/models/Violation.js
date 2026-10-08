import mongoose from 'mongoose';

const { Schema } = mongoose;

const violationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reportId: { type: Schema.Types.ObjectId, ref: 'Report' },
    level: { type: String, enum: ['V1', 'V2', 'V3'], required: true },
    note: String,
    adminId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

export default mongoose.model('Violation', violationSchema);
