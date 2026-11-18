import mongoose from 'mongoose';

// Atlas M0 giới hạn 500 kết nối: mỗi instance Vercel tối đa 10 kết nối (mặc định 100), kết nối rảnh quá 1 phút thì đóng
export const connectDB = () => mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 10, maxIdleTimeMS: 60_000 });
