import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true },
    imageUrl: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export default mongoose.model('Category', categorySchema);
