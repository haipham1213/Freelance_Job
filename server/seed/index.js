// Tạo dữ liệu nền nếu chưa có: Admin (BR-03), 2 gói Premium, danh mục. Chạy lại nhiều lần không sao.
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';
import Category from '../src/models/Category.js';
import { slugify } from '../src/utils/http.js';

await mongoose.connect(process.env.MONGODB_URI);

const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (ADMIN_EMAIL && ADMIN_PASSWORD && !(await User.exists({ email: ADMIN_EMAIL.toLowerCase() }))) {
  await User.create({ email: ADMIN_EMAIL, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10), role: 'ADMIN', fullName: 'Quản trị viên', emailVerified: true });
  console.log('+ admin', ADMIN_EMAIL);
}

for (const p of [
  { code: 'PREMIUM_1M', name: 'Premium 1 tháng', durationDays: 30, price: 199000 },
  { code: 'PREMIUM_3M', name: 'Premium 3 tháng', durationDays: 90, price: 499000 },
]) if (!(await Plan.exists({ code: p.code }))) { await Plan.create(p); console.log('+ plan', p.code); }

if (!(await Category.exists({}))) for (const name of ['Phục vụ – Pha chế', 'Bán hàng', 'Gia sư', 'IT – Lập trình', 'Thiết kế', 'Nhập liệu – Văn phòng', 'Marketing', 'Sự kiện – PG'])
  if (!(await Category.exists({ name }))) { await Category.create({ name, slug: slugify(name) }); console.log('+ category', name); }

console.log('Seed xong');
await mongoose.disconnect();
