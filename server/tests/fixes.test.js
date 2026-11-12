// Hồi quy cho các lỗi trong báo cáo rà soát 12/11/2026 (C-01, TB-01, TB-02, TB-05, TB-06, TB-07). DB test riêng
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Plan from '../src/models/Plan.js';
import Payment from '../src/models/Payment.js';
import Review from '../src/models/Review.js';
import Application from '../src/models/Application.js';
import Category from '../src/models/Category.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ||= 'test-secret';
let server, base;
const tokens = {};
const api = async (method, path, body, who, cookie) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who && { Authorization: `Bearer ${tokens[who]}` }), ...(cookie && { Cookie: cookie }) },
    body: typeof body === 'string' ? body : body && JSON.stringify(body),
  });
  return { status: res.status, cookie: res.headers.get('set-cookie')?.split(';')[0], body: res.status === 204 ? null : await res.json() };
};
const register = async (who, role) => {
  const email = `${who}@fix.vn`;
  await api('POST', '/auth/register', { fullName: `Test ${who}`, email, password: 'Matkhau123', role });
  await User.updateOne({ email }, { emailVerified: true });
  const r = await api('POST', '/auth/login', { email, password: 'Matkhau123' });
  tokens[who] = r.body.data.accessToken;
  return { user: await User.findOne({ email }), cookie: r.cookie };
};

before(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/student_marketplace_test_fixes');
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).syncIndexes()));
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api/v1`;
});
after(async () => { server?.close(); await mongoose.disconnect(); });

test('rà soát: đổi mật khẩu, Nổi bật, lọc giao dịch, đánh giá ẩn, khóa SV, đầu vào sai', async () => {
  await User.create({ email: 'root@fix.vn', passwordHash: await bcrypt.hash('Matkhau123', 10), role: 'ADMIN', fullName: 'Root', emailVerified: true });
  tokens.admin = (await api('POST', '/auth/login', { email: 'root@fix.vn', password: 'Matkhau123' })).body.data.accessToken;
  const { user: emp } = await register('emp', 'EMPLOYER');
  const { cookie: svCookie } = await register('sv', 'STUDENT');
  const { user: sv2 } = await register('sv2', 'STUDENT');

  // C-01: phiên cũ (access + refresh) chết, phiên hiện tại nhận token mới
  const oldToken = tokens.sv;
  await new Promise((r) => setTimeout(r, 1100)); // iat tính theo giây
  const cp = await api('PUT', '/auth/change-password', { currentPassword: 'Matkhau123', newPassword: 'Matkhau456' }, 'sv');
  assert.equal(cp.status, 200);
  tokens.sv = cp.body.data.accessToken;
  tokens.old = oldToken;
  assert.equal((await api('GET', '/auth/me', null, 'old')).status, 401);
  assert.equal((await api('GET', '/auth/me', null, 'sv')).status, 200);
  assert.equal((await api('POST', '/auth/refresh', null, null, cp.cookie)).status, 200);
  // cookie cũ bị từ chối (và vì là token đã thu hồi → coi như bị đánh cắp, thu hồi mọi phiên)
  assert.equal((await api('POST', '/auth/refresh', null, null, svCookie)).status, 401);

  // TB-07: đầu vào sai → 400, không 500
  assert.equal((await api('POST', '/auth/verify-email', {})).status, 400);
  assert.equal((await api('POST', '/auth/verify-email', { token: { $gt: '' } })).status, 400);
  assert.equal((await api('GET', '/jobs?q=a&q=b')).status, 200);
  const bad = await api('POST', '/auth/login', '{"email":');
  assert.deepEqual([bad.status, bad.body.error.code], [400, 'INVALID_JSON']);

  // TB-01: tin đang đóng lúc mua Premium, mở lại vẫn Nổi bật; khóa Employer thì mất Nổi bật
  const cat = await Category.create({ name: 'Phục vụ', slug: 'phuc-vu' });
  await api('PUT', '/employers/me', { name: 'Quán A', address: '1 Lê Lợi', phone: '0901234567' }, 'emp');
  const job = (await api('POST', '/jobs', { title: 'Nhân viên phục vụ ca tối', description: 'Phục vụ khách, dọn bàn, hỗ trợ quầy pha chế. Có đào tạo ngày đầu.',
    categoryId: String(cat._id), city: 'TP.HCM', salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000, startDate: new Date().toISOString(), slots: 2 }, 'emp')).body.data.job;
  await api('PATCH', `/jobs/${job._id}/close`, null, 'emp');
  const plan = await Plan.create({ code: 'PREMIUM_30', name: 'Premium 30 ngày', durationDays: 30, price: 99000 });
  assert.equal((await api('POST', `/admin/employers/${emp._id}/premium`, { planCode: plan.code, reason: 'test' }, 'admin')).status, 200);
  await api('PATCH', `/jobs/${job._id}/reopen`, null, 'emp');
  assert.equal((await api('GET', `/jobs/${job._id}`)).body.data.job.isFeatured, true);

  // TB-05: đánh giá bị ẩn không trả cho hai bên của đơn
  const appId = (await Application.create({ jobId: job._id, studentId: sv2._id, employerId: emp._id, cvUrl: '/x.pdf' }))._id;
  await Review.create({ applicationId: appId, jobId: job._id, reviewerId: emp._id, revieweeId: sv2._id, reviewerRole: 'EMPLOYER', rating: 1, comment: 'xúc phạm', isHidden: true, hiddenReason: 'V2' });
  assert.equal((await api('GET', `/applications/${appId}`, null, 'emp')).body.data.reviews.length, 0);
  assert.equal((await api('GET', `/applications/${appId}`, null, 'admin')).body.data.reviews.length, 1);
  // TB-06: khóa sinh viên → đơn PENDING bị từ chối
  assert.equal((await api('PATCH', `/admin/users/${sv2._id}/lock`, { reason: 'test' }, 'admin')).status, 200);
  assert.equal((await Application.findById(appId)).status, 'REJECTED');

  await api('PATCH', `/admin/users/${emp._id}/lock`, { reason: 'test' }, 'admin');
  assert.equal((await Job.findById(job._id)).featuredUntil, undefined);

  // TB-02: EXPIRED/PENDING lọc theo hạn 15 phút
  const mk = (txnRef, ago) => Payment.create({ employerId: emp._id, planId: plan._id, planSnapshot: { code: plan.code, name: plan.name, durationDays: 30 }, amount: 99000, txnRef, expiresAt: new Date(Date.now() - ago) });
  await mk('UNI000000001', 60_000);
  await mk('UNI000000002', -60_000);
  const refs = async (status) => (await api('GET', `/admin/payments?status=${status}`, null, 'admin')).body.data.map((p) => p.txnRef);
  assert.deepEqual(await refs('EXPIRED'), ['UNI000000001']);
  assert.deepEqual(await refs('PENDING'), ['UNI000000002']);
});

test('rà soát: tin kẹt FILLED, kích hoạt tay theo giao dịch, báo cáo Admin, lọc tin theo Employer', async () => {
  const { user: emp } = await register('emp2', 'EMPLOYER');
  const { user: sv } = await register('sv3', 'STUDENT');
  const admin = await User.findOne({ role: 'ADMIN' });
  const cat = await Category.findOne();
  const plan = await Plan.findOne();
  await api('PUT', '/employers/me', { name: 'Quán B', address: '2 Lê Lợi', phone: '0901234568' }, 'emp2');
  const job = (await api('POST', '/jobs', { title: 'Phụ bếp ca sáng cuối tuần', description: 'Sơ chế nguyên liệu, rửa dụng cụ, giữ bếp sạch sẽ. Có đào tạo ngày đầu.',
    categoryId: String(cat._id), city: 'TP.HCM', salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000, startDate: new Date().toISOString(), slots: 1 }, 'emp2')).body.data.job;

  // API-55: lọc tin theo Employer
  const ids = (await api('GET', `/admin/jobs?employerId=${emp._id}`, null, 'admin')).body.data.map((j) => j._id);
  assert.deepEqual(ids, [job._id]);

  // T-01(b): kết quả được xác nhận khi tin đang ẩn → hiện lại thành COMPLETED
  await Job.updateOne({ _id: job._id }, { status: 'FILLED', acceptedCount: 1 });
  await Application.create({ jobId: job._id, studentId: sv._id, employerId: emp._id, cvUrl: '/x.pdf', status: 'COMPLETED' });
  assert.equal((await api('PATCH', `/admin/jobs/${job._id}/hide`, { reason: 'kiểm tra' }, 'admin')).status, 200);
  assert.equal((await api('PATCH', `/admin/jobs/${job._id}/unhide`, null, 'admin')).body.data.status, 'COMPLETED');

  // T-11: không báo cáo được tài khoản Admin
  assert.equal((await api('POST', '/reports', { targetType: 'USER', targetId: String(admin._id), reason: 'SCAM' }, 'sv3')).status, 404);

  // T-05: kích hoạt tay theo giao dịch → giao dịch thành SUCCESS, doanh thu đúng
  const p = await Payment.create({ employerId: emp._id, planId: plan._id, planSnapshot: { code: plan.code, name: plan.name, durationDays: 30 }, amount: 99000, txnRef: 'UNI000000009', expiresAt: new Date() });
  assert.equal((await api('POST', `/admin/employers/${emp._id}/premium`, { paymentId: String(p._id), reason: 'Lệch tiền' }, 'admin')).status, 200);
  assert.equal((await Payment.findById(p._id)).status, 'SUCCESS');
  assert.ok((await User.findById(emp._id)).employer.premiumUntil > new Date());
  assert.equal((await api('POST', `/admin/employers/${emp._id}/premium`, { paymentId: String(p._id), reason: 'Lần 2' }, 'admin')).status, 409);
});
