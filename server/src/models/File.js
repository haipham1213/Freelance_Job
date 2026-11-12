import mongoose from 'mongoose';

// File upload (CV, logo, ảnh danh mục) lưu thẳng trong MongoDB: chạy được trên serverless (Vercel) không có đĩa bền.
// _id = "<thư mục>/<tên file>", khớp phần sau /api/v1/files/ của URL
// ponytail: mỗi file ≤ 5 MB, đủ cho Atlas M0 (512 MB) khi demo; nhiều file hơn thì chuyển sang object storage (Vercel Blob, S3…)
const fileSchema = new mongoose.Schema({
  _id: String,
  contentType: { type: String, required: true },
  data: { type: Buffer, required: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

export default mongoose.model('File', fileSchema);
