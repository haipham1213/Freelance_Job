import mongoose from 'mongoose';
import { unaccent } from '../utils/http.js';

const { Schema } = mongoose;

const jobSchema = new Schema(
  {
    employerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    companySnapshot: { name: String, logoUrl: String, city: String },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirements: String,
    city: { type: String, required: true },
    district: String,
    address: String,
    salaryType: { type: String, enum: ['HOURLY', 'DAILY', 'PROJECT'], required: true },
    salaryMin: { type: Number, required: true },
    salaryMax: { type: Number, required: true },
    schedule: String,
    startDate: { type: Date, required: true },
    endDate: Date,
    slots: { type: Number, required: true },
    acceptedCount: { type: Number, default: 0 },
    applicationCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    // EXPIRED không lưu: = OPEN và expiresAt < now
    status: { type: String, enum: ['OPEN', 'FILLED', 'CLOSED', 'COMPLETED', 'HIDDEN'], default: 'OPEN' },
    hiddenFromStatus: String,
    expiresAt: { type: Date, required: true },
    featuredUntil: Date,
    hiddenReason: String,
    deletedAt: Date,
    searchText: String,
  },
  { timestamps: true },
);

jobSchema.index({ status: 1, expiresAt: 1, categoryId: 1, city: 1 });
jobSchema.index({ employerId: 1, status: 1 });
jobSchema.index({ featuredUntil: -1, createdAt: -1 });

jobSchema.pre('save', function () {
  this.searchText = unaccent(`${this.title} ${this.companySnapshot?.name || ''}`);
});

jobSchema.virtual('displayStatus').get(function () {
  return this.status === 'OPEN' && this.expiresAt < new Date() ? 'EXPIRED' : this.status;
});
jobSchema.set('toJSON', { virtuals: true });

export default mongoose.model('Job', jobSchema);
