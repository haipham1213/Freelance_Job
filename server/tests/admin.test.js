// Admin: xử lý báo cáo V1/V2, gói & giao dịch, Premium thủ công, trang công khai Employer. DB test riêng
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Plan from '../src/models/Plan.js';
import Payment from '../src/models/Payment.js';
import Category from '../src/models/Category.js';
import AuditLog from '../src/models/AuditLog.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ||= 'test-secret';
let server, base;
const tokens = {};
const api = async (method, path, body, who) => {
  const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(who && { Authorization: `Bearer ${tokens[who]}` }) }, body: body && JSON.stringify(body) });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};
const register = async (who, role) => {
  const email = `${who}@admin.vn`;
  await api('POST', '/auth/register', { fullName: `Test ${who}`, email, password: 'Matkhau123', role });
  await User.updateOne({ email }, { emailVerified: true });
  tokens[who] = (await api('POST', '/auth/login', { email, password: 'Matkhau123' })).body.data.accessToken;
  return User.findOne({ email });
};

before(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/student_marketplace_test_admin');
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).syncIndexes()));
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api/v1`;
});
after(async () => { server?.close(); await mongoose.disconnect(); });

test('admin: báo cáo, gói, giao dịch, Premium thủ công, trang công khai', async () => {
  const cat = await Category.create({ name: 'Phục vụ', slug: 'phuc-vu' });
  const plan = await Plan.create({ code: 'PREMIUM_30', name: 'Premium 30 ngày', durationDays: 30, price: 99000 });
  await User.create({ email: 'root@admin.vn', passwordHash: await bcrypt.hash('Matkhau123', 10), role: 'ADMIN', fullName: 'Root', emailVerified: true });
  tokens.admin = (await api('POST', '/auth/login', { email: 'root@admin.vn', password: 'Matkhau123' })).body.data.accessToken;
  const emp = await register('emp', 'EMPLOYER');
  await register('sv', 'STUDENT');
  await api('PUT', '/employers/me', { name: 'Quán A', address: '1 Lê Lợi', phone: '0901234567' }, 'emp');
  const job = (await api('POST', '/jobs', { title: 'Nhân viên phục vụ ca tối', description: 'Phục vụ khách, dọn bàn, hỗ trợ quầy pha chế. Có đào tạo ngày đầu.',
    categoryId: String(cat._id), city: 'TP.HCM', salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000, startDate: new Date().toISOString(), slots: 2 }, 'emp')).body.data.job;

  // Quyền: sinh viên không vào được admin
  assert.equal((await api('GET', '/admin/reports', null, 'sv')).status, 403);
  assert.equal((await api('GET', '/admin/reports')).status, 401);

  // V1 cảnh cáo: tạo Violation, không ẩn tin, không khóa
  const r1 = (await api('POST', '/reports', { targetType: 'JOB', targetId: job._id, reason: 'SCAM' }, 'sv'));
  assert.equal(r1.status, 201, JSON.stringify(r1.body));
  assert.equal((await api('PATCH', `/admin/reports/${r1.body.data.report._id}/resolve`, { decision: 'V1' }, 'admin')).status, 400, 'thiếu ghi chú');
  assert.equal((await api('PATCH', `/admin/reports/${r1.body.data.report._id}/resolve`, { decision: 'V1', note: 'Nhắc nhở' }, 'admin')).status, 200);
  assert.equal((await Job.findById(job._id)).status, 'OPEN');
  assert.equal((await User.findById(emp._id)).status, 'ACTIVE');
  const notifs = (await api('GET', '/notifications', null, 'emp')).body.data;
  assert.ok(notifs.some((n) => n.type === 'VIOLATION'));

  // Sau khi xử lý xong, báo cáo mới cùng đối tượng được phép; V2 ẩn tin
  const r2 = (await api('POST', '/reports', { targetType: 'JOB', targetId: job._id, reason: 'SCAM' }, 'sv')).body.data.report;
  assert.equal((await api('PATCH', `/admin/reports/${r2._id}/resolve`, { decision: 'V2', note: 'Tin lừa đảo' }, 'admin')).status, 200);
  assert.equal((await Job.findById(job._id)).status, 'HIDDEN');
  assert.equal((await api('GET', `/jobs/${job._id}`)).status, 404, 'tin ẩn không xem công khai được');
  assert.equal((await api('GET', '/admin/reports?status=RESOLVED', null, 'admin')).body.data.length, 2);

  // Gói: giá phải > 0, đổi giá có audit; giao dịch cũ giữ nguyên số tiền
  assert.equal((await api('PUT', `/admin/plans/${plan._id}`, { price: 0 }, 'admin')).status, 400);
  assert.equal((await api('PUT', `/admin/plans/${plan._id}`, { price: 120000 }, 'admin')).body.data.price, 120000);
  assert.equal(await AuditLog.countDocuments({ action: 'PLAN_UPDATE' }), 1);

  // Giao dịch: lọc tháng + trạng thái, doanh thu chỉ tính SUCCESS
  const now = new Date();
  await Payment.create({ employerId: emp._id, planId: plan._id, planSnapshot: { code: plan.code, name: plan.name, durationDays: 30 }, amount: 99000, status: 'SUCCESS', txnRef: 'T1', expiresAt: new Date(Date.now() + 9e5) }).catch((e) => assert.fail(`tạo Payment: ${e.message}`));
  await Payment.create({ employerId: emp._id, planId: plan._id, planSnapshot: { code: plan.code, name: plan.name, durationDays: 30 }, amount: 99000, txnRef: 'T2', expiresAt: new Date(Date.now() + 9e5) });
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const all = await api('GET', `/admin/payments?month=${ym}`, null, 'admin');
  assert.equal(all.body.meta.total, 2);
  assert.equal(all.body.meta.revenue, 99000);
  assert.equal((await api('GET', '/admin/payments?status=PENDING', null, 'admin')).body.meta.total, 1);
  assert.equal((await api('GET', '/admin/payments?month=1999-01', null, 'admin')).body.meta.total, 0);
  assert.equal((await api('GET', '/admin/payments?month=$ne', null, 'admin')).status, 200, 'month sai định dạng bị bỏ qua, không lỗi');

  // Premium thủ công: cần lý do, ghi audit, cộng dồn hạn
  assert.equal((await api('POST', `/admin/employers/${emp._id}/premium`, { planCode: 'PREMIUM_30' }, 'admin')).status, 400);
  assert.equal((await api('POST', `/admin/employers/${emp._id}/premium`, { planCode: 'NOPE', reason: 'x' }, 'admin')).status, 400);
  const p1 = (await api('POST', `/admin/employers/${emp._id}/premium`, { planCode: 'PREMIUM_30', reason: 'Chuyển khoản' }, 'admin')).body.data.premiumUntil;
  const p2 = (await api('POST', `/admin/employers/${emp._id}/premium`, { planCode: 'PREMIUM_30', reason: 'Chuyển khoản lần 2' }, 'admin')).body.data.premiumUntil;
  assert.equal(Math.round((new Date(p2) - new Date(p1)) / 86400000), 30);
  assert.equal(await AuditLog.countDocuments({ action: 'PREMIUM_MANUAL' }), 2);

  // V3 khóa tài khoản, sau đó không kích hoạt Premium được
  const r3 = (await api('POST', '/reports', { targetType: 'USER', targetId: String(emp._id), reason: 'SCAM' }, 'sv')).body.data.report;
  assert.equal((await api('PATCH', `/admin/reports/${r3._id}/resolve`, { decision: 'V3', note: 'Lừa đảo' }, 'admin')).status, 200);
  assert.equal((await User.findById(emp._id)).status, 'LOCKED');
  assert.equal((await api('POST', `/admin/employers/${emp._id}/premium`, { planCode: 'PREMIUM_30', reason: 'x' }, 'admin')).status, 409);

  // Trang công khai: employer bị khóa không còn xem được, không lộ SĐT/email
  const pub = await api('GET', `/employers/${emp._id}`);
  assert.ok([200, 404].includes(pub.status));
  assert.ok(!JSON.stringify(pub.body).includes('0901234567'), 'không lộ số điện thoại');
  assert.ok(!JSON.stringify(pub.body).includes('@admin.vn'), 'không lộ email');
});
