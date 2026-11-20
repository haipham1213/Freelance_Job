// Dữ liệu cho bộ test tự động Selenium (freelance_automation): XÓA SẠCH DB rồi tạo đúng tài khoản / tin mà test case dùng.
// Chỉ chạy trên MongoDB local có tên kết thúc bằng _qa để không bao giờ xóa nhầm DB thật:
//   MONGODB_URI="mongodb://127.0.0.1:27017/student_marketplace_qa?replicaSet=rs0" npm run seed:qa -w server
// Mặc định tạo dữ liệu nền + mọi module trong seed/qa/; chỉ một vài module: npm run seed:qa -w server -- student admin
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';
import Category from '../src/models/Category.js';
import Job from '../src/models/Job.js';
import { slugify, DAY } from '../src/utils/http.js';

const MODULES = ['guest', 'student', 'employer', 'admin'];

const uri = process.env.MONGODB_URI || '';
if (!/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/][^?]*_qa(_[a-z0-9]+)?(\?|$)/.test(uri)) {
  console.error('Từ chối: seed:qa chỉ chạy trên MongoDB local, tên DB kết thúc bằng _qa hoặc _qa_<tên>. MONGODB_URI hiện tại không hợp lệ.');
  process.exit(1);
}
await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

const plans = {};
for (const p of [
  { code: 'PREMIUM_1M', name: 'Premium 1 tháng', durationDays: 30, price: 199000 },
  { code: 'PREMIUM_3M', name: 'Premium 3 tháng', durationDays: 90, price: 499000 },
]) plans[p.code] = await Plan.create(p);
const cats = {};
for (const name of ['Phục vụ – Pha chế', 'Bán hàng', 'Gia sư', 'IT – Lập trình', 'Thiết kế', 'Nhập liệu – Văn phòng', 'Marketing', 'Sự kiện – PG'])
  cats[name] = await Category.create({ name, slug: slugify(name) });

// Tài khoản: mật khẩu như cột "Dữ liệu test" trong file Excel. Trùng email thì trả lại tài khoản đã có (module dùng chung sv1, ntd1…)
const pw = { Test12345: await bcrypt.hash('Test12345', 10), Admin1234: await bcrypt.hash('Admin1234', 10) };
const user = async (email, role, fullName, extra = {}, pass = 'Test12345') =>
  (await User.findOne({ email })) || User.create({ email, passwordHash: pw[pass] || (await bcrypt.hash(pass, 10)), role, fullName, emailVerified: true, ...extra });
const company = (name, extra = {}) => ({
  phone: '0901234567',
  employer: { company: { name, address: '45 Nguyễn Gia Trí', phone: '0901234567', city: 'TP.HCM', district: 'Bình Thạnh', description: `${name} tuyển sinh viên làm part-time.`, ...extra } },
});
// Tin tuyển dụng mặc định: OPEN, còn hạn 14 ngày, bắt đầu sau 7 ngày, ngành Phục vụ
const job = (employer, title, extra = {}) => Job.create({
  employerId: employer._id,
  companySnapshot: { name: employer.employer.company.name, logoUrl: employer.employer.company.logoUrl, city: employer.employer.company.city },
  categoryId: cats['Phục vụ – Pha chế']._id,
  title,
  description: 'Phục vụ khách, order và dọn bàn. Ưu tiên sinh viên, được đào tạo từ đầu.',
  city: 'TP.HCM', district: 'Bình Thạnh', address: '45 Nguyễn Gia Trí',
  salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000,
  startDate: new Date(Date.now() + 7 * DAY), slots: 3,
  expiresAt: new Date(Date.now() + 14 * DAY),
  ...extra,
});

// Dữ liệu nền dùng chung (TC Đăng nhập)
await user('admin@unishift.test', 'ADMIN', 'Quản trị viên', {}, 'Admin1234');
await user('sv1@unishift.test', 'STUDENT', 'Nguyễn Văn An', { student: { school: 'Đại học Văn Lang', major: 'Công nghệ thông tin', yearOfStudy: 3 } });
const ntd1 = await user('ntd1@unishift.test', 'EMPLOYER', 'Trần Thị Bình', company('Cà phê Sáng Tạo'));
await job(ntd1, 'Phục vụ quán cà phê ca tối', { shifts: [2, 5, 8] });

const ctx = { mongoose, user, company, job, cats, plans, pw, DAY };
const chosen = process.argv.slice(2).length ? process.argv.slice(2) : MODULES;
for (const m of chosen) {
  await (await import(`./qa/${m}.js`)).default(ctx);
  console.log('+ module', m);
}

console.log('Seed QA xong:', await User.countDocuments(), 'tài khoản,', await Job.countDocuments(), 'tin');
await mongoose.disconnect();
