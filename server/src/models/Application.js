import mongoose from 'mongoose';

const { Schema } = mongoose;

const applicationSchema = new Schema(
  {
    jobId: { type: Schema.Types.ObjectId, ref: 'Job', required: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    employerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    jobSnapshot: { title: String, companyName: String, startDate: Date },
    coverLetter: { type: String, maxlength: 1000 },
    cvUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'NOT_COMPLETED'],
      default: 'PENDING',
    },
    employerNote: { type: String, maxlength: 500 },
    rejectReason: { type: String, maxlength: 500 },
    notCompletedReason: { type: String, maxlength: 500 },
    statusHistory: [{ _id: false, status: String, at: Date, by: Schema.Types.ObjectId }],
    finishedAt: Date,
    reviewedByStudent: { type: Boolean, default: false },
    reviewedByEmployer: { type: Boolean, default: false },
  },
  { timestamps: true },
);

applicationSchema.index({ jobId: 1, studentId: 1 }, { unique: true });
applicationSchema.index({ studentId: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, status: 1 });

export default mongoose.model('Application', applicationSchema);
