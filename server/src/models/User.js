import mongoose from 'mongoose';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    // Access token phát trước mốc này bị từ chối (BR-08: đặt lại mật khẩu đăng xuất mọi thiết bị ngay)
    passwordChangedAt: Date,
    role: { type: String, enum: ['STUDENT', 'EMPLOYER', 'ADMIN'], required: true },
    status: { type: String, enum: ['ACTIVE', 'LOCKED'], default: 'ACTIVE' },
    lockReason: { type: String, maxlength: 500 },
    emailVerified: { type: Boolean, default: false },
    fullName: { type: String, required: true, minlength: 2, maxlength: 100 },
    phone: String,
    avatarUrl: String,
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    lastLoginAt: Date,
    student: {
      school: String,
      major: String,
      yearOfStudy: Number,
      skills: [String],
      bio: String,
      cv: { url: String, fileName: String, uploadedAt: Date },
      // Lịch học: các ô buổi bận, cùng cách đánh số với Job.shifts
      busySlots: [Number],
    },
    employer: {
      company: {
        name: String,
        address: String,
        phone: String,
        city: String,
        district: String,
        description: String,
        website: String,
        logoUrl: String,
      },
      premiumUntil: Date,
    },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, status: 1, createdAt: -1 });

userSchema.methods.isPremium = function () {
  return !!this.employer?.premiumUntil && this.employer.premiumUntil > new Date();
};

// Dữ liệu an toàn để trả ra API (không passwordHash)
userSchema.methods.toPublic = function () {
  const u = this.toObject();
  delete u.passwordHash;
  delete u.__v;
  if (u.role === 'EMPLOYER') u.isPremium = this.isPremium();
  return u;
};

export default mongoose.model('User', userSchema);
