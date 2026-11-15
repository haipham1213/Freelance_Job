// Dữ liệu cho bộ test tự động Selenium (freelance_automation): XÓA SẠCH DB rồi tạo đúng tài khoản / tin mà test case dùng.
// Chỉ chạy trên MongoDB local có tên kết thúc bằng _qa để không bao giờ xóa nhầm DB thật:
//   MONGODB_URI="mongodb://127.0.0.1:27017/student_marketplace_qa?replicaSet=rs0" npm run seed:qa -w server
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';
import Category from '../src/models/Category.js';
import Job from '../src/models/Job.js';
import { slugify, DAY } from '../src/utils/http.js';

const uri = process.env.MONGODB_URI || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/][^?]*_qa(\?|$)/.test(uri)) {
  console.error('Từ chối: seed:qa chỉ chạy trên MongoDB local, tên DB kết thúc bằng _qa. MONGODB_URI hiện tại không hợp lệ.');
  process.exit(1);
}
await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
await Promise.all([User, Job, Category].map((m) => m.syncIndexes()));

for (const p of [
  { code: 'PREMIUM_1M', name: 'Premium 1 tháng', durationDays: 30, price: 199000 },
  { code: 'PREMIUM_3M', name: 'Premium 3 tháng', durationDays: 90, price: 499000 },
]) await Plan.create(p);
const cats = {};
for (const name of ['Phục vụ – Pha chế', 'Bán hàng', 'Gia sư', 'IT – Lập trình', 'Thiết kế', 'Nhập liệu – Văn phòng', 'Marketing', 'Sự kiện – PG'])
  cats[name] = await Category.create({ name, slug: slugify(name) });

// Tài khoản: mật khẩu như cột "Dữ liệu test" trong file Excel
const pw = { Test12345: await bcrypt.hash('Test12345', 10), Admin1234: await bcrypt.hash('Admin1234', 10) };
const user = (email, role, fullName, extra = {}, pass = 'Test12345') =>
  User.create({ email, passwordHash: pw[pass], role, fullName, emailVerified: true, ...extra });

await user('admin@unishift.test', 'ADMIN', 'Quản trị viên', {}, 'Admin1234');
await user('sv1@unishift.test', 'STUDENT', 'Nguyễn Văn An', { student: { school: 'Đại học Văn Lang', major: 'Công nghệ thông tin', yearOfStudy: 3 } });
const ntd1 = await user('ntd1@unishift.test', 'EMPLOYER', 'Trần Thị Bình', {
  phone: '0901234567',
  employer: { company: { name: 'Cà phê Sáng Tạo', address: '45 Nguyễn Gia Trí', phone: '0901234567', city: 'TP.HCM', district: 'Bình Thạnh', description: 'Chuỗi cà phê cho sinh viên.' } },
});

const job = (employer, title, extra = {}) => Job.create({
  employerId: employer._id,
  companySnapshot: { name: employer.employer.company.name, city: employer.employer.company.city },
  categoryId: cats['Phục vụ – Pha chế']._id,
  title,
  description: 'Phục vụ khách, order và dọn bàn. Ưu tiên sinh viên, được đào tạo từ đầu.',
  city: 'TP.HCM', district: 'Bình Thạnh', address: '45 Nguyễn Gia Trí',
  salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000,
  startDate: new Date(Date.now() + 7 * DAY), slots: 3,
  expiresAt: new Date(Date.now() + 14 * DAY),
  ...extra,
});

await job(ntd1, 'Phục vụ quán cà phê ca tối', { shifts: [2, 5, 8] });

console.log('Seed QA xong:', await User.countDocuments(), 'tài khoản,', await Job.countDocuments(), 'tin');
await mongoose.disconnect();
