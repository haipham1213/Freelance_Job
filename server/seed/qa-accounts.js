// Thêm tài khoản test sv1 / ntd1 cho bộ Selenium khi chạy trên production. CHỈ THÊM nếu chưa có, không sửa / xóa gì.
// Admin không tạo ở đây: test dùng admin thật (ADMIN_EMAIL). Chạy: npm run seed:qa-accounts -w server
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

await mongoose.connect(process.env.MONGODB_URI);
const passwordHash = await bcrypt.hash('Test12345', 10);

for (const u of [
  { email: 'sv1@unishift.test', role: 'STUDENT', fullName: 'Nguyễn Văn An', student: { school: 'Đại học Văn Lang', major: 'Công nghệ thông tin', yearOfStudy: 3 } },
  { email: 'ntd1@unishift.test', role: 'EMPLOYER', fullName: 'Trần Thị Bình', phone: '0901234567',
    employer: { company: { name: 'Cà phê Sáng Tạo', address: '45 Nguyễn Gia Trí', phone: '0901234567', city: 'TP.HCM', district: 'Bình Thạnh', description: 'Chuỗi cà phê cho sinh viên.' } } },
]) {
  if (await User.exists({ email: u.email })) { console.log('= đã có', u.email); continue; }
  await User.create({ ...u, passwordHash, emailVerified: true });
  console.log('+ tạo', u.email);
}
await mongoose.disconnect();
