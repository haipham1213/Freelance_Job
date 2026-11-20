// Khiếu nại đánh giá (BR-48) và ghi nhận báo cáo sai (BR-49). DB test riêng
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Category from '../src/models/Category.js';

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
  const email = `${who}@kn.vn`;
  await api('POST', '/auth/register', { fullName: `Test ${who}`, email, password: 'Matkhau123', role });
  await User.updateOne({ email }, { emailVerified: true, phone: '0912345678', 'student.cv': { url: '/cv.pdf', fileName: 'cv.pdf', uploadedAt: new Date() } });
  tokens[who] = (await api('POST', '/auth/login', { email, password: 'Matkhau123' })).body.data.accessToken;
  return User.findOne({ email });
};

before(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/student_marketplace_test_complaints');
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).syncIndexes()));
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api/v1`;
});
after(async () => { server?.close(); await mongoose.disconnect(); });

test('khiếu nại đánh giá và ghi nhận báo cáo sai', async () => {
  await User.create({ email: 'admin@kn.vn', passwordHash: await bcrypt.hash('Matkhau123', 10), role: 'ADMIN', fullName: 'Admin', emailVerified: true });
  tokens.admin = (await api('POST', '/auth/login', { email: 'admin@kn.vn', password: 'Matkhau123' })).body.data.accessToken;
  const emp = await register('emp', 'EMPLOYER');
  const sv = await register('sv', 'STUDENT');
  await register('sv2', 'STUDENT');
  const cat = await Category.create({ name: 'Phục vụ', slug: 'phuc-vu' });
  await api('PUT', '/employers/me', { name: 'Quán Khiếu Nại', address: '1 Lê Lợi', phone: '0901234567', city: 'TP.HCM' }, 'emp');
  const job = (await api('POST', '/jobs', {
    title: 'Phục vụ ca tối', description: 'Phục vụ khách, dọn bàn, hỗ trợ quầy pha chế. Môi trường thân thiện.',
    categoryId: String(cat._id), city: 'TP.HCM', salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000, startDate: new Date().toISOString(), slots: 1,
  }, 'emp')).body.data.job;
  const appId = (await api('POST', `/jobs/${job._id}/applications`, {}, 'sv')).body.data.application._id;
  await api('PATCH', `/applications/${appId}/accept`, {}, 'emp');
  await api('PATCH', `/applications/${appId}/result`, { result: 'COMPLETED' }, 'emp');
  const review = (await api('POST', `/applications/${appId}/reviews`, { rating: 1, comment: 'Lười biếng' }, 'emp')).body.data.review;
  assert.equal((await User.findById(sv._id)).ratingCount, 1);

  // BR-48: chỉ người bị đánh giá khiếu nại, lý do riêng, mô tả ≥ 10 ký tự, mỗi đánh giá 1 lần
  const complain = (who, body) => api('POST', '/reports', { targetType: 'REVIEW', targetId: review._id, reason: 'RETALIATION', description: 'Em làm đủ giờ, quán chấm 1 sao vì em không làm thêm ca', ...body }, who);
  assert.equal((await complain('sv2')).status, 403);
  assert.equal((await complain('sv', { description: 'ngắn' })).status, 400);
  assert.equal((await complain('sv', { reason: 'SCAM' })).status, 400);
  assert.equal((await api('POST', '/reports', { targetType: 'USER', targetId: emp._id, reason: 'FALSE_REVIEW' }, 'sv')).status, 400);
  assert.equal((await complain('sv')).status, 201);
  assert.equal((await complain('sv')).body.error.code, 'ALREADY_REPORTED');
  const mine = (await api('GET', '/reports/mine?targetType=REVIEW', null, 'sv')).body.data;
  assert.deepEqual([mine.length, String(mine[0].targetId), mine[0].status], [1, String(review._id), 'OPEN']);

  // Admin thấy đánh giá bị khiếu nại kèm đơn để mở tin nhắn; người viết đánh giá là người vi phạm
  const item = (await api('GET', '/admin/reports?status=OPEN', null, 'admin')).body.data.find((r) => r.targetType === 'REVIEW');
  assert.deepEqual([item.target.reviewerId.employer.company.name, String(item.target.applicationId), item.target.jobId.title], ['Quán Khiếu Nại', String(appId), job.title]);
  assert.equal((await api('GET', `/applications/${appId}/messages`, null, 'admin')).status, 200);
  assert.equal((await api('PATCH', `/admin/reports/${item._id}/resolve`, { decision: 'V2', note: 'x' }, 'admin')).status, 400);
  assert.equal((await api('PATCH', `/admin/reports/${item._id}/resolve`, { decision: 'V1', note: 'x', abusive: true }, 'admin')).status, 400);
  assert.equal((await api('PATCH', `/admin/reports/${item._id}/resolve`, { decision: 'V1', note: 'Tin nhắn cho thấy đánh giá trả đũa' }, 'admin')).status, 200);
  // Chấp nhận → đánh giá ẩn, điểm tính lại, hai bên nhận thông báo
  const after1 = await User.findById(sv._id);
  assert.deepEqual([after1.ratingAvg, after1.ratingCount], [0, 0]);
  const svNotif = (await api('GET', '/notifications', null, 'sv')).body.data[0];
  assert.deepEqual([svNotif.type, svNotif.title, svNotif.link], ['REPORT_RESULT', 'Khiếu nại đánh giá được chấp nhận', '/student/profile']);
  assert.equal((await api('GET', '/notifications', null, 'emp')).body.data[0].type, 'VIOLATION');

  // BR-49: báo cáo sai bị ghi nhận; đủ 3 lần trong 90 ngày thì không gửi được nữa
  for (let i = 0; i < 3; i++) {
    const rep = (await api('POST', '/reports', { targetType: 'USER', targetId: emp._id, reason: 'OTHER', description: `Lần ${i}` }, 'sv')).body.data.report;
    const row = (await api('GET', '/admin/reports?status=OPEN', null, 'admin')).body.data.find((r) => r._id === rep._id);
    assert.equal(row.reporterFalseCount, i);
    assert.equal((await api('PATCH', `/admin/reports/${rep._id}/resolve`, { decision: 'DISMISS', note: 'Không có căn cứ', abusive: true }, 'admin')).status, 200);
  }
  assert.equal((await api('GET', '/notifications', null, 'sv')).body.data[0].title, 'Báo cáo của bạn bị xác định là sai');
  assert.equal((await api('POST', '/reports', { targetType: 'JOB', targetId: job._id, reason: 'SCAM' }, 'sv')).body.error.code, 'REPORT_BLOCKED');
  // Người khác vẫn báo cáo bình thường
  assert.equal((await api('POST', '/reports', { targetType: 'JOB', targetId: job._id, reason: 'SCAM' }, 'sv2')).status, 201);
});
