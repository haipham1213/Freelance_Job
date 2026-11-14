// Business rule phát hiện khi rà soát backend: ST-06, BR-27, BR-36/38, khóa tài khoản, lọc theo lịch học. DB test riêng để chạy song song với flow.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
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
Object.assign(process.env, { SEPAY_ENV: 'sandbox', SEPAY_MERCHANT_ID: 'SP-TEST-1', SEPAY_SECRET_KEY: 'spsk_test_x', SEPAY_IPN_SECRET: 'ipn-secret', CLIENT_URL: 'http://localhost:3000' });
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
  await User.updateOne({ email }, { emailVerified: true, ...(role === 'STUDENT' && { 'student.cv': { url: '/cv.pdf' }, phone: '0912345678' }) });
  tokens[who] = (await api('POST', '/auth/login', { email, password: 'Matkhau123' })).body.data.accessToken;
  return User.findOne({ email });
};

// IPN SePay: xác thực bằng header X-Secret-Key
const ipn = async (invoice, { amount = 1000, type = 'ORDER_PAID', status = 'CAPTURED', key = 'ipn-secret', id = 'T1' } = {}) => {
  const res = await fetch(`${base}/payments/sepay-ipn`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(key && { 'X-Secret-Key': key }) },
    body: JSON.stringify({ timestamp: 1, notification_type: type, order: { order_status: status, order_invoice_number: invoice, order_amount: String(amount) }, transaction: { transaction_id: id } }) });
  return { status: res.status, body: await res.json() };
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

  await t.test('Lọc theo lịch học: giữ việc còn ca rảnh hoặc linh hoạt, hợp nhiều ca lên trước', async () => {
    await closeAll();
    // Đăng 4 tin, vượt hạn mức 3 tin của gói free
    await User.updateOne({ _id: emp._id }, { 'employer.premiumUntil': new Date(Date.now() + 86400000) });
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

    // minDays=3: ca rảnh phải rơi vào ≥ 3 ngày; tin chỉ có ca trong 2 ngày (cuối tuần) rảnh đủ cả 2 thì vẫn giữ
    const partial = await post('Phụ bếp sáng T2, T3 và chiều cuối tuần', [0, 3, 16, 19]); // rảnh T7, CN: 2/4 ngày
    assert.ok((await api('GET', `/jobs?busy=${busy}`)).body.data.some((j) => j._id === partial._id), 'mặc định: còn 1 ca rảnh là hiện');
    const r3 = (await api('GET', `/jobs?busy=${busy}&minDays=3`)).body.data;
    assert.deepEqual(r3.map((j) => j._id), [evenings._id, weekend._id, flexible._id], 'rảnh 4 ngày, cuối tuần đủ 2/2 ngày, linh hoạt');
    assert.equal(r3[0].fitDays, 4);
    await Job.updateOne({ _id: partial._id }, { status: 'CLOSED' });

    // Sinh viên lưu lịch: ô sai bị bỏ, trùng bị gộp
    const saved = await api('PUT', '/students/me/schedule', { busySlots: [3, 0, 3] }, 'sv1');
    assert.deepEqual(saved.body.data.busySlots, [0, 3]);
    assert.equal((await api('PUT', '/students/me/schedule', { busySlots: [21] }, 'sv1')).status, 400);
  });

  await t.test('BR-15 / BR-20: ẩn tin → đơn chờ bị từ chối, Employer không mở lại; hiện lại khi đã hết hạn mức → CLOSED', async () => {
    await closeAll();
    const job = await newJob();
    const a = await apply(job, 'sv1');
    const admin = await User.create({ email: 'admin2@rules.vn', passwordHash: await bcrypt.hash('Matkhau123', 10), role: 'ADMIN', fullName: 'Admin 2', emailVerified: true });
    tokens.admin2 = (await api('POST', '/auth/login', { email: admin.email, password: 'Matkhau123' })).body.data.accessToken;
    assert.equal((await api('PATCH', `/admin/jobs/${job._id}/hide`, {}, 'admin2')).status, 400); // bắt buộc lý do
    await api('PATCH', `/admin/jobs/${job._id}/hide`, { reason: 'Kiểm tra' }, 'admin2');
    assert.equal((await Application.findById(a._id)).status, 'REJECTED');
    assert.equal((await api('GET', `/jobs/${job._id}`)).status, 404);
    assert.equal((await api('PATCH', `/jobs/${job._id}/reopen`, {}, 'emp')).status, 409);
    await User.updateOne({ _id: emp._id }, { $unset: { 'employer.premiumUntil': 1 } });
    await newJob(); await newJob(); await newJob(); // đủ 3 tin OPEN
    await api('PATCH', `/admin/jobs/${job._id}/unhide`, {}, 'admin2');
    assert.equal((await Job.findById(job._id)).status, 'CLOSED');
    assert.equal(await Job.countDocuments({ employerId: emp._id, status: 'OPEN' }), 3);
  });

  await t.test('BR-25: rút đơn chỉ khi PENDING, rút rồi không nộp lại; lưu tin không trùng, tin hết tuyển gắn cờ', async () => {
    await closeAll();
    const job = await newJob();
    const a = await apply(job, 'sv2');
    assert.equal((await api('PATCH', `/applications/${a._id}/withdraw`, {}, 'sv2')).body.data.application.status, 'WITHDRAWN');
    assert.equal((await api('PATCH', `/applications/${a._id}/withdraw`, {}, 'sv2')).status, 409);
    assert.equal((await api('POST', `/jobs/${job._id}/applications`, {}, 'sv2')).body.error.code, 'ALREADY_APPLIED');

    await api('PUT', `/students/me/saved-jobs/${job._id}`, null, 'sv2');
    await api('PUT', `/students/me/saved-jobs/${job._id}`, null, 'sv2');
    assert.equal((await api('GET', `/jobs/${job._id}`, null, 'sv2')).body.data.isSaved, true);
    await closeAll();
    const saved = (await api('GET', '/students/me/saved-jobs', null, 'sv2')).body.data;
    assert.deepEqual([saved.length, saved[0].isAvailable], [1, false]);
    await api('DELETE', `/students/me/saved-jobs/${job._id}`, null, 'sv2');
    assert.equal((await api('GET', '/students/me/saved-jobs', null, 'sv2')).body.data.length, 0);
  });

  await t.test('FR-AUTH-06: đổi mật khẩu sai mật khẩu cũ → lỗi; đổi xong mật khẩu cũ hết dùng', async () => {
    assert.equal((await api('PUT', '/auth/change-password', { currentPassword: 'Sai12345', newPassword: 'Moi123456' }, 'sv2')).body.error.code, 'WRONG_PASSWORD');
    assert.equal((await api('PUT', '/auth/change-password', { currentPassword: 'Matkhau123', newPassword: 'ngan' }, 'sv2')).status, 400);
    assert.equal((await api('PUT', '/auth/change-password', { currentPassword: 'Matkhau123', newPassword: 'Moi123456' }, 'sv2')).status, 200);
    assert.equal((await api('POST', '/auth/login', { email: 'sv2@rules.vn', password: 'Matkhau123' })).status, 401);
    assert.equal((await api('POST', '/auth/login', { email: 'sv2@rules.vn', password: 'Moi123456' })).status, 200);
  });

  await t.test('BR-36: IPN SePay kích hoạt Premium đúng 1 lần; sai secret, chưa CAPTURED, lệch tiền, đơn lạ không kích hoạt', async () => {
    const pay = (txnRef, expiresAt = new Date(Date.now() + 15 * 60_000)) => Payment.create({ employerId: emp._id, planId: new mongoose.Types.ObjectId(),
      planSnapshot: { code: 'P1', name: 'Premium 1 tháng', durationDays: 30 }, amount: 1000, txnRef, expiresAt });
    const premiumOf = async () => +(await User.findById(emp._id)).employer.premiumUntil || 0;
    const before = await premiumOf();
    await pay('UNIAAAAAAAAAA');

    assert.equal((await ipn('UNIAAAAAAAAAA', { key: 'sai' })).status, 401, 'sai secret');
    assert.equal((await ipn('UNIAAAAAAAAAA', { key: '' })).status, 200, 'không header: hỏi lại SePay, đơn không có thật bên đó nên bị bỏ qua');
    assert.equal((await Payment.findOne({ txnRef: 'UNIAAAAAAAAAA' })).status, 'PENDING', 'IPN giả không kích hoạt');
    assert.equal((await ipn('UNIAAAAAAAAAA', { type: 'TRANSACTION_VOID' })).status, 200);
    assert.equal((await ipn('UNIAAAAAAAAAA', { status: 'AUTHENTICATION_NOT_NEEDED' })).status, 200, 'chưa CAPTURED');
    assert.equal((await ipn('UNIAAAAAAAAAA', { amount: 999 })).status, 200, 'lệch tiền vẫn trả 200 để SePay không gọi lại');
    assert.equal((await ipn('UNIZZZZZZZZZZ')).status, 200, 'mã lạ');
    assert.equal((await Payment.findOne({ txnRef: 'UNIAAAAAAAAAA' })).status, 'PENDING');
    assert.equal(await premiumOf(), before);

    const r = await ipn('UNIAAAAAAAAAA', { id: 'TX5' });
    assert.deepEqual([r.status, r.body], [200, { success: true }]);
    const p = await Payment.findOne({ txnRef: 'UNIAAAAAAAAAA' });
    assert.equal(p.status, 'SUCCESS');
    assert.equal(p.gatewayRef, 'TX5');
    // BR-37: còn hạn thì cộng nối tiếp 30 ngày
    const until = await premiumOf();
    assert.equal(until - Math.max(before, Date.now()) > 29.9 * 864e5, true);
    assert.equal((await ipn('UNIAAAAAAAAAA')).status, 200, 'SePay gọi lại');
    assert.equal(await premiumOf(), until, 'gọi lại không cộng thêm');

    // Thanh toán muộn sau 15 phút: tiền đã vào nên vẫn kích hoạt
    await pay('UNIBBBBBBBBBB', new Date(Date.now() - 60_000));
    await ipn('UNIBBBBBBBBBB');
    assert.equal((await Payment.findOne({ txnRef: 'UNIBBBBBBBBBB' })).status, 'SUCCESS');
  });

  await t.test('Tạo thanh toán lấy giá từ DB; GET trả form checkout đã ký khi còn PENDING, hết hạn thì không', async () => {
    const Plan = (await import('../src/models/Plan.js')).default;
    await Plan.create({ code: 'PREMIUM_30', name: 'Premium 30 ngày', durationDays: 30, price: 199000 });
    const r = await api('POST', '/payments', { planCode: 'PREMIUM_30', amount: 1 }, 'emp');
    assert.equal(r.status, 201, JSON.stringify(r.body));
    const got = (await api('GET', `/payments/${r.body.data.paymentId}`, null, 'emp')).body.data.payment;
    assert.equal(got.amount, 199000, 'bỏ qua amount của client');
    assert.match(got.txnRef, /^UNI[0-9A-F]{10}$/);
    const { url, fields } = got.checkout;
    assert.equal(url, 'https://pay-sandbox.sepay.vn/v1/checkout/init');
    assert.equal(fields.order_invoice_number, got.txnRef);
    assert.equal(fields.order_amount, 199000);
    assert.equal(fields.merchant, 'SP-TEST-1');
    assert.ok(fields.signature && fields.success_url.endsWith(`paymentId=${got._id}&status=success`));
    assert.equal((await api('GET', `/payments/${got.txnRef}`, null, 'emp')).status, 200, 'tra theo mã đơn');
    assert.equal((await api('GET', `/payments/${got._id}`, null, 'sv1')).status, 403, 'sinh viên không xem được');
    await Payment.updateOne({ _id: got._id }, { expiresAt: new Date(Date.now() - 1000) });
    const old = (await api('GET', `/payments/${got._id}`, null, 'emp')).body.data.payment;
    assert.equal(old.displayStatus, 'EXPIRED');
    assert.equal(old.checkout, undefined);
    // API-49: chỉ thấy giao dịch của mình, mới nhất ở trên
    const hist = await api('GET', '/payments?limit=2', null, 'emp');
    assert.equal(hist.status, 200);
    assert.equal(hist.body.data[0]._id, got._id);
    assert.ok(hist.body.data.every((x) => x.employerId === String(emp._id)) && hist.body.meta.total >= 3 && hist.body.data.length === 2);
    assert.equal((await api('GET', '/payments', null, 'sv1')).status, 403);
  });

  await t.test('FR-SRC-05: ghim vị trí, lọc theo khoảng cách, bản đồ; BR-43 tọa độ trong Việt Nam; BR-18 khóa ghim khi đã nhận người', async () => {
    await closeAll();
    const at = { lat: 10.827, lng: 106.7 }; // điểm xuất phát (trường)
    const post = (title, location) => api('POST', '/jobs', { ...body, title, ...(location && { location }) }, 'emp');
    assert.equal((await post('Tin ghim ở Paris nước Pháp', { lat: 48.85, lng: 2.35 })).status, 400, 'ngoài Việt Nam');
    const a = (await post('Tin cách trường 445 mét', { lat: at.lat + 0.004, lng: at.lng })).body.data.job;
    const b = (await post('Tin cách trường 3 cây số', { lat: at.lat + 0.027, lng: at.lng })).body.data.job;
    const c = (await post('Tin không ghim vị trí')).body.data.job;
    assert.deepEqual(a.location.coordinates, [at.lng, at.lat + 0.004], 'GeoJSON [kinh độ, vĩ độ]');
    assert.equal(c.location, undefined);

    const near = (q) => api('GET', `/jobs?near=${at.lat},${at.lng}${q}`);
    const r1 = await near('&radius=1');
    assert.deepEqual(r1.body.data.map((j) => j._id), [a._id], 'bán kính 1 km chỉ có tin gần');
    assert.ok(Math.abs(r1.body.data[0].distance - 445) < 10, `khoảng cách ~445 m, nhận ${r1.body.data[0].distance}`);
    assert.equal(r1.body.meta.noLocation, 1, 'báo số tin chưa ghim');
    const r5 = await near('');
    assert.deepEqual(r5.body.data.map((j) => j._id), [a._id, b._id], 'mặc định 5 km, gần trước');
    assert.equal(r5.body.meta.radius, 5);
    assert.equal((await near('&radius=999')).body.meta.radius, 50, 'bán kính tối đa 50 km');
    assert.equal((await api('GET', '/jobs?near=abc')).status, 400);
    assert.equal((await api('GET', '/jobs?near=48.85,2.35')).status, 400);
    assert.equal((await api('GET', '/jobs')).body.meta.total, 3, 'không lọc khoảng cách thì tin không ghim vẫn hiện');

    const map = await api('GET', '/jobs/map');
    assert.deepEqual(map.body.data.map((j) => j._id).sort(), [a._id, b._id].sort(), 'bản đồ chỉ có tin đã ghim');
    assert.equal(map.body.meta.noLocation, 1);
    assert.equal(map.body.data[0].description, undefined, 'không gửi mô tả đầy đủ');
    assert.deepEqual((await api('GET', `/jobs/map?near=${at.lat},${at.lng}&radius=1`)).body.data.map((j) => j._id), [a._id]);

    // Sửa tin: không gửi location = giữ nguyên, null = bỏ ghim
    const edit = (job, patch) => api('PUT', `/jobs/${job._id}`, { ...body, title: job.title, ...patch }, 'emp');
    assert.equal((await edit(a, {})).status, 200);
    assert.ok((await Job.findById(a._id)).location, 'không gửi location thì giữ ghim');
    assert.equal((await edit(a, { location: null })).status, 200);
    assert.equal((await Job.findById(a._id)).location, undefined, 'null thì bỏ ghim');
    // BR-18: đã nhận người thì không dời ghim
    const app = await apply(b, 'sv1');
    await api('PATCH', `/applications/${app._id}/accept`, {}, 'emp');
    const moved = await edit(b, { location: { lat: at.lat, lng: at.lng } });
    assert.equal(moved.status, 409);
    assert.ok(moved.body.error.details.includes('location'));
    assert.equal((await edit(b, { location: { lat: at.lat + 0.027, lng: at.lng } })).status, 200, 'gửi lại đúng ghim cũ thì được');
  });

  await t.test('Khóa tài khoản: tin OPEN của Employer bị đóng, đơn PENDING bị từ chối, request kế tiếp bị chặn', async () => {
    const admin = await User.create({ email: 'admin@rules.vn', passwordHash: await bcrypt.hash('Matkhau123', 10), role: 'ADMIN', fullName: 'Admin', emailVerified: true });
    tokens.admin = (await api('POST', '/auth/login', { email: 'admin@rules.vn', password: 'Matkhau123' })).body.data.accessToken;
    await closeAll();
    const job = await newJob();
    const a = await apply(job, 'sv1');
    assert.equal((await api('PATCH', `/admin/users/${admin._id}/lock`, { reason: 'x' }, 'admin')).status, 403);
    assert.equal((await api('PATCH', `/admin/users/${emp._id}/lock`, { reason: 'Lừa đảo' }, 'admin')).status, 200);
    assert.equal((await Job.findById(job._id)).status, 'CLOSED');
    assert.equal((await Application.findById(a._id)).status, 'REJECTED');
    assert.equal((await api('GET', '/employers/me', null, 'emp')).body.error.code, 'ACCOUNT_LOCKED');
  });
});
