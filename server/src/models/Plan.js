import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    durationDays: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Plan', planSchema);
