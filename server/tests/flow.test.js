// Luồng demo end-to-end trên DB test riêng: đăng ký → đăng tin → ứng tuyển → duyệt → kết quả → admin
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';
import Job from '../src/models/Job.js';
import JobAlert from '../src/models/JobAlert.js';
import { alertsFor } from '../src/modules/alerts/alerts.routes.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ||= 'test-secret';
let server, base;
const tokens = {};

const api = async (method, path, body, who) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(who && { Authorization: `Bearer ${tokens[who]}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, body: res.status === 204 ? null : await res.json() };
};

const register = async (who, role) => {
  const email = `${who}@test.vn`;
  assert.equal((await api('POST', '/auth/register', { fullName: `Test ${who}`, email, password: 'Matkhau123', role })).status, 201);
  await User.updateOne({ email }, { emailVerified: true });
  const r = await api('POST', '/auth/login', { email, password: 'Matkhau123' });
  tokens[who] = r.body.data.accessToken;
  return r.body.data.user;
};

before(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/student_marketplace_test');
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).syncIndexes()));
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api/v1`;
});

after(async () => {
  server.close();
  await mongoose.disconnect();
});

test('luồng chính và các business rule quan trọng', async () => {
  const cat = await Category.create({ name: 'Phục vụ', slug: 'phuc-vu' });
  const emp = await register('emp', 'EMPLOYER');
  await register('sv1', 'STUDENT');
  await register('sv2', 'STUDENT');
  await register('sv3', 'STUDENT');

  // BR-01, BR-03, BR-02
  assert.equal((await api('POST', '/auth/register', { fullName: 'X Y', email: 'EMP@test.vn', password: 'Matkhau123', role: 'STUDENT' })).status, 409);
  assert.equal((await api('POST', '/auth/register', { fullName: 'X Y', email: 'a@test.vn', password: 'Matkhau123', role: 'ADMIN' })).status, 400);
  assert.equal((await api('POST', '/auth/register', { fullName: 'X Y', email: 'b@test.vn', password: 'abcdefgh', role: 'STUDENT' })).status, 400);
  assert.equal((await api('POST', '/auth/login', { email: 'emp@test.vn', password: 'sai123456' })).status, 401);

  // Frontend đọc giới hạn gói từ API, không tự ghi số
  assert.deepEqual((await api('GET', '/plans')).body.meta.tiers, { free: { quota: 3, days: 14 }, premium: { quota: 20, days: 30 } });
  assert.equal((await api('GET', '/employers/me/stats', null, 'emp')).body.data.tiers.free.quota, 3);

  const jobBody = {
    title: 'Nhân viên phục vụ ca tối', description: 'Phục vụ khách, dọn bàn, hỗ trợ quầy pha chế. Môi trường thân thiện, có đào tạo.',
    categoryId: String(cat._id), city: 'TP.HCM', district: 'Quận 1', salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000,
    startDate: new Date().toISOString(), slots: 2,
  };
  // BR-11: chưa có hồ sơ công ty
  assert.equal((await api('POST', '/jobs', jobBody, 'emp')).body.error.code, 'COMPANY_PROFILE_REQUIRED');
  assert.equal((await api('PUT', '/employers/me', { name: 'Quán Test', address: '1 Lê Lợi', phone: '0901234567', city: 'TP.HCM' }, 'emp')).status, 200);
  // BR-14, quyền
  assert.equal((await api('POST', '/jobs', { ...jobBody, salaryMin: 50000 }, 'emp')).status, 400);
  assert.equal((await api('POST', '/jobs', jobBody, 'sv1')).status, 403);
  const job = (await api('POST', '/jobs', jobBody, 'emp')).body.data.job;
  // BR-15: Free tối đa 3 tin OPEN
  await api('POST', '/jobs', jobBody, 'emp');
  await api('POST', '/jobs', jobBody, 'emp');
  assert.equal((await api('POST', '/jobs', jobBody, 'emp')).body.error.code, 'QUOTA_EXCEEDED');

  // Trang chủ: nhà tuyển dụng đang tuyển, số tin theo khu vực
  const hiringRow = (await api('GET', '/employers/hiring')).body.data[0];
  assert.deepEqual([String(hiringRow._id), hiringRow.jobs], [String(emp._id), 3]);
  const loc = (await api('GET', '/jobs/locations')).body.data.find((l) => l.city === jobBody.city);
  assert.equal(loc.total, 3);

  // Email việc mới: gửi cho người có ít nhất một ca của tin không trùng giờ học; gửi lại cùng email chỉ cập nhật lịch
  assert.equal((await api('POST', '/job-alerts', { email: 'bad' })).status, 400);
  await api('POST', '/job-alerts', { email: 'Ban@test.vn', busySlots: [0] });
  await api('POST', '/job-alerts', { email: 'ban@test.vn', busySlots: [0, 3] });
  await api('POST', '/job-alerts', { email: 'ranh@test.vn', busySlots: [] });
  assert.equal(await JobAlert.countDocuments(), 2);
  const to = async (job) => (await alertsFor(job)).map((a) => a.email).sort();
  // Chưa bấm link xác nhận trong email thì chưa nhận thông báo
  assert.deepEqual(await to({}), []);
  const confirm = async (email) => fetch(`${base}/job-alerts/confirm?token=${(await JobAlert.findOne({ email })).token}`, { redirect: 'manual' });
  await confirm('ban@test.vn');
  await confirm('ranh@test.vn');
  // Người khác gửi lịch mới cho email đã xác nhận: chưa xác nhận thì lịch cũ giữ nguyên
  await api('POST', '/job-alerts', { email: 'ban@test.vn', busySlots: [] });
  assert.deepEqual(await to({ shifts: [0, 3] }), ['ranh@test.vn']);
  assert.deepEqual(await to({ shifts: [0, 6] }), ['ban@test.vn', 'ranh@test.vn']);
  assert.deepEqual(await to({}), ['ban@test.vn', 'ranh@test.vn']);
  const { token } = await JobAlert.findOne({ email: 'ranh@test.vn' });
  const off = await fetch(`${base}/job-alerts/unsubscribe?token=${token}`, { redirect: 'manual' });
  assert.equal(off.status, 302);
  assert.equal(await JobAlert.exists({ email: 'ranh@test.vn' }), null);

  // Khoảng lương phổ biến theo ngành (3 tin cùng 25k–30k/giờ)
  const catRow = (await api('GET', '/categories')).body.data.find((c) => c.slug === 'phuc-vu');
  assert.deepEqual([catRow.jobCount, catRow.pay], [3, { salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000 }]);

  // Tìm kiếm không dấu
  const found = await api('GET', '/jobs?q=phuc vu');
  assert.equal(found.body.meta.total, 3);

  // BR-10: chưa có CV
  assert.equal((await api('POST', `/jobs/${job._id}/applications`, {}, 'sv1')).body.error.code, 'CV_REQUIRED');
  await User.updateMany({ role: 'STUDENT' }, { 'student.cv': { url: '/cv.pdf', fileName: 'cv.pdf', uploadedAt: new Date() } });
  const a1 = (await api('POST', `/jobs/${job._id}/applications`, { coverLetter: 'Em làm được' }, 'sv1')).body.data.application;
  const a2 = (await api('POST', `/jobs/${job._id}/applications`, {}, 'sv2')).body.data.application;
  const a3 = (await api('POST', `/jobs/${job._id}/applications`, {}, 'sv3')).body.data.application;
  // BR-24
  assert.equal((await api('POST', `/jobs/${job._id}/applications`, {}, 'sv1')).body.error.code, 'ALREADY_APPLIED');
  // Thông báo cho Employer
  assert.equal((await api('GET', '/notifications/unread-count', null, 'emp')).body.data.count, 3);

  // BR-12: chưa ACCEPTED thì chưa thấy liên hệ
  assert.equal((await api('GET', `/applications/${a1._id}`, null, 'sv1')).body.data.employer.phone, undefined);
  // BR-26/27: nhận 2/2 → FILLED, đơn còn lại REJECTED
  await api('PATCH', `/applications/${a1._id}/accept`, { employerNote: 'Đến lúc 17h' }, 'emp');
  const acc2 = await api('PATCH', `/applications/${a2._id}/accept`, {}, 'emp');
  assert.equal(acc2.body.data.jobStatus, 'FILLED');
  assert.equal((await api('GET', `/applications/${a3._id}`, null, 'sv3')).body.data.application.status, 'REJECTED');
  assert.equal((await api('GET', `/applications/${a1._id}`, null, 'sv1')).body.data.employer.phone, '0901234567');
  // Job FILLED không còn trong tìm kiếm
  assert.equal((await api('GET', '/jobs')).body.meta.total, 2);

  // BR-29/30: kết quả công việc → Job COMPLETED khi hết đơn ACCEPTED
  assert.equal((await api('PATCH', `/applications/${a2._id}/result`, { result: 'NOT_COMPLETED' }, 'emp')).status, 400);
  await api('PATCH', `/applications/${a1._id}/result`, { result: 'COMPLETED' }, 'emp');
  await api('PATCH', `/applications/${a2._id}/result`, { result: 'NOT_COMPLETED', reason: 'Không đến' }, 'emp');
  assert.equal((await Job.findById(job._id)).status, 'COMPLETED');

  // Chỉ Admin quản lý danh mục
  await User.create({ email: 'admin@test.vn', passwordHash: await (await import('bcryptjs')).default.hash('Matkhau123', 10), role: 'ADMIN', fullName: 'Admin', emailVerified: true });
  tokens.admin = (await api('POST', '/auth/login', { email: 'admin@test.vn', password: 'Matkhau123' })).body.data.accessToken;
  assert.equal((await api('GET', '/admin/categories', null, 'emp')).status, 403);
  assert.equal((await api('GET', '/admin/categories', null, 'admin')).status, 200);
});
