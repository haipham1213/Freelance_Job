// Business rule phát hiện khi rà soát backend: ST-06, BR-27, BR-15, BR-36/38, V3. DB test riêng để chạy song song với flow.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Payment from '../src/models/Payment.js';
import Category from '../src/models/Category.js';
import Application from '../src/models/Application.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ||= 'test-secret';
Object.assign(process.env, { VNP_TMN_CODE: 'TEST', VNP_HASH_SECRET: 'test-hash', VNP_URL: 'https://sandbox.invalid' });
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
  const email = `${who}@rules.vn`;
  await api('POST', '/auth/register', { fullName: `Test ${who}`, email, password: 'Matkhau123', role });
  await User.updateOne({ email }, { emailVerified: true, ...(role === 'STUDENT' && { 'student.cv': { url: '/cv.pdf' } }) });
  tokens[who] = (await api('POST', '/auth/login', { email, password: 'Matkhau123' })).body.data.accessToken;
  return User.findOne({ email });
};

// IPN VNPay có chữ ký hợp lệ (ký giống vnpay.js)
const ipn = (q) => {
  const data = Object.keys(q).sort().map((k) => `${k}=${encodeURIComponent(q[k]).replace(/%20/g, '+')}`).join('&');
  return api('GET', `/payments/vnpay-ipn?${data}&vnp_SecureHash=${crypto.createHmac('sha512', 'test-hash').update(data).digest('hex')}`);
};

before(async () => {
  await mongoose.connect('mongodb://127.0.0.1:27017/student_marketplace_test_rules');
  await mongoose.connection.dropDatabase();
  await Promise.all(mongoose.modelNames().map((m) => mongoose.model(m).syncIndexes()));
  await new Promise((r) => (server = app.listen(0, r)));
  base = `http://localhost:${server.address().port}/api/v1`;
});

after(async () => {
  server?.close();
  await mongoose.disconnect();
});

test('business rule sau rà soát', async (t) => {
  const cat = await Category.create({ name: 'Phục vụ', slug: 'phuc-vu' });
  const emp = await register('emp', 'EMPLOYER');
  await register('sv1', 'STUDENT');
  await register('sv2', 'STUDENT');
  await api('PUT', '/employers/me', { name: 'Quán Test', address: '1 Lê Lợi', phone: '0901234567' }, 'emp');
  await User.create({ email: 'admin@rules.vn', passwordHash: await bcrypt.hash('Matkhau123', 10), role: 'ADMIN', fullName: 'Admin', emailVerified: true });
  tokens.admin = (await api('POST', '/auth/login', { email: 'admin@rules.vn', password: 'Matkhau123' })).body.data.accessToken;

  const body = { title: 'Nhân viên phục vụ ca tối', description: 'Phục vụ khách, dọn bàn, hỗ trợ quầy pha chế. Có đào tạo ngày đầu.',
    categoryId: String(cat._id), city: 'TP.HCM', salaryType: 'HOURLY', salaryMin: 25000, salaryMax: 30000, startDate: new Date().toISOString(), slots: 3 };
  const newJob = async () => (await api('POST', '/jobs', body, 'emp')).body.data.job;
  const apply = async (job, sv) => (await api('POST', `/jobs/${job._id}/applications`, {}, sv)).body.data.application;
  const closeAll = () => Job.updateMany({ employerId: emp._id }, { status: 'CLOSED' });

  await t.test('ST-06: Job hết hạn, mọi đơn ACCEPTED đã kết thúc → COMPLETED', async () => {
    const job = await newJob();
    const a = await apply(job, 'sv1');
    await api('PATCH', `/applications/${a._id}/accept`, {}, 'emp');
    await Job.updateOne({ _id: job._id }, { expiresAt: new Date(Date.now() - 1000) });
    await api('PATCH', `/applications/${a._id}/result`, { result: 'COMPLETED' }, 'emp');
    assert.equal((await Job.findById(job._id)).status, 'COMPLETED');
  });

  await t.test('BR-27: giảm số chỗ bằng số đã nhận → FILLED, đơn PENDING bị từ chối', async () => {
    await closeAll();
    const job = await newJob();
    const a = await apply(job, 'sv1');
    const b = await apply(job, 'sv2');
    await api('PATCH', `/applications/${a._id}/accept`, {}, 'emp');
    assert.equal((await api('PUT', `/jobs/${job._id}`, { ...body, startDate: job.startDate, slots: 1 }, 'emp')).status, 200);
    assert.equal((await Job.findById(job._id)).status, 'FILLED');
    assert.equal((await Application.findById(b._id)).status, 'REJECTED');
  });

  await t.test('BR-15: hiện lại tin khi đã hết hạn mức → CLOSED, không vượt 3 tin OPEN', async () => {
    await closeAll();
    const job = await newJob();
    await api('PATCH', `/admin/jobs/${job._id}/hide`, { reason: 'Kiểm tra' }, 'admin');
    await newJob(); await newJob(); await newJob(); // đủ 3 tin OPEN
    await api('PATCH', `/admin/jobs/${job._id}/unhide`, {}, 'admin');
    assert.equal((await Job.findById(job._id)).status, 'CLOSED');
    assert.equal(await Job.countDocuments({ employerId: emp._id, status: 'OPEN' }), 3);
  });

  await t.test('BR-36/38: IPN đúng hạn kích hoạt Premium, IPN sau 15 phút → EXPIRED, không kích hoạt', async () => {
    const pay = (txnRef, expiresAt) => Payment.create({ employerId: emp._id, planId: new mongoose.Types.ObjectId(),
      planSnapshot: { code: 'P1', name: 'Premium 1 tháng', durationDays: 30 }, amount: 1000, txnRef, expiresAt });
    const ok = { vnp_Amount: '100000', vnp_ResponseCode: '00', vnp_TransactionStatus: '00' };

    await pay('LATE', new Date(Date.now() - 60_000));
    assert.equal((await ipn({ ...ok, vnp_TxnRef: 'LATE' })).body.RspCode, '02');
    assert.equal((await Payment.findOne({ txnRef: 'LATE' })).status, 'EXPIRED');
    assert.equal((await User.findById(emp._id)).employer.premiumUntil, undefined);

    await pay('ONTIME', new Date(Date.now() + 15 * 60_000));
    assert.equal((await ipn({ ...ok, vnp_TxnRef: 'ONTIME' })).body.RspCode, '00');
    assert.equal((await Payment.findOne({ txnRef: 'ONTIME' })).status, 'SUCCESS');
    assert.ok((await User.findById(emp._id)).employer.premiumUntil > new Date());
  });

  await t.test('Lọc theo lịch học: giữ việc còn ca rảnh hoặc linh hoạt, hợp nhiều ca lên trước', async () => {
    await closeAll();
    const post = async (title, shifts) => (await api('POST', '/jobs', { ...body, title, shifts }, 'emp')).body.data.job;
    const evenings = await post('Phục vụ tối thứ 2 đến thứ 6', [2, 5, 8, 11, 14]); // tối T2–T6
    const mornings = await post('Phục vụ sáng thứ 2 và thứ 4', [0, 6]); // sáng T2, T4: trùng hết giờ học
    const flexible = await post('Viết bài online làm tại nhà', []);
    const weekend = await post('Phục vụ chiều thứ 7, chủ nhật', [16, 19]);

    // Bận sáng T2–T6 và tối T6
    const busy = '0,3,6,9,12,14';
    const r = (await api('GET', `/jobs?busy=${busy}`)).body.data;
    const ids = r.map((j) => j._id);
    assert.ok(!ids.includes(mornings._id), 'việc trùng hết giờ học bị loại');
    assert.deepEqual(ids, [evenings._id, weekend._id, flexible._id], 'hợp 4 ca, rồi 2 ca, linh hoạt cuối');
    assert.deepEqual([r[0].fit, r[0].shiftCount], [4, 5]);

    // busy rỗng = chưa bận buổi nào: mọi việc đều hiện
    assert.equal((await api('GET', '/jobs?busy=')).body.data.length, 4);

    // Sinh viên lưu lịch: ô sai bị bỏ, trùng bị gộp
    const saved = await api('PUT', '/students/me/schedule', { busySlots: [3, 0, 3] }, 'sv1');
    assert.deepEqual(saved.body.data.busySlots, [0, 3]);
    assert.equal((await api('PUT', '/students/me/schedule', { busySlots: [21] }, 'sv1')).status, 400);
  });

  await t.test('V3 / khóa tài khoản: tin OPEN của Employer bị đóng, đơn PENDING bị từ chối', async () => {
    await closeAll();
    const job = await newJob();
    const a = await apply(job, 'sv1');
    assert.equal((await api('PATCH', `/admin/users/${emp._id}/lock`, { reason: 'Lừa đảo' }, 'admin')).status, 200);
    assert.equal((await Job.findById(job._id)).status, 'CLOSED');
    assert.equal((await Application.findById(a._id)).status, 'REJECTED');
    assert.equal((await api('GET', '/employers/me', null, 'emp')).body.error.code, 'ACCOUNT_LOCKED');
  });
});
