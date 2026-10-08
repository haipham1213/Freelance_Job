import mongoose from 'mongoose';

const tokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['REFRESH', 'VERIFY_EMAIL', 'RESET_PASSWORD'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    replacedBy: String,
  },
  { timestamps: true },
);

tokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Token', tokenSchema);
