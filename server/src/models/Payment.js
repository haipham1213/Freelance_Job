import mongoose from 'mongoose';

const { Schema } = mongoose;

const paymentSchema = new Schema(
  {
    employerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    planId: { type: Schema.Types.ObjectId, ref: 'Plan', required: true },
    planSnapshot: { code: String, name: String, durationDays: Number },
    amount: { type: Number, required: true },
    txnRef: { type: String, required: true, unique: true },
    status: { type: String, enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'], default: 'PENDING' },
    expiresAt: { type: Date, required: true },
    vnpTransactionNo: String,
    vnpResponseCode: String,
    bankCode: String,
    paidAt: Date,
    ipnRaw: Object,
  },
  { timestamps: true },
);

paymentSchema.index({ employerId: 1, createdAt: -1 });

// BR-38: PENDING quá 15 phút coi là EXPIRED
paymentSchema.virtual('displayStatus').get(function () {
  return this.status === 'PENDING' && this.expiresAt < new Date() ? 'EXPIRED' : this.status;
});
paymentSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Payment', paymentSchema);
