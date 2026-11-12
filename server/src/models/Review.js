import mongoose from 'mongoose';

const { Schema } = mongoose;

const reviewSchema = new Schema(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    reviewerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    revieweeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewerRole: { type: String, enum: ['STUDENT', 'EMPLOYER'], required: true },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, maxlength: 500 },
    isHidden: { type: Boolean, default: false },
    hiddenReason: String,
  },
  { timestamps: true },
);

reviewSchema.index({ applicationId: 1, reviewerId: 1 }, { unique: true });
reviewSchema.index({ revieweeId: 1, isHidden: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
