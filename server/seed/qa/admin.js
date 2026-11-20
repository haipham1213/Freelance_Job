// Dữ liệu QA cho các TC GUI vai trò admin (xem seed/qa.js). ctx = { mongoose, user, company, job, cats, plans, pw, DAY }
// Mọi tài khoản tiền tố a_; _id cố định (ID(n)) để test mở thẳng /employers/{id}, /jobs/{id}. Mỗi TC dùng dữ liệu riêng nên chạy độc lập.
import Category from '../../src/models/Category.js';
import Application from '../../src/models/Application.js';
import Review from '../../src/models/Review.js';
import Report from '../../src/models/Report.js';
import Violation from '../../src/models/Violation.js';
import Payment from '../../src/models/Payment.js';
import User from '../../src/models/User.js';
import { slugify } from '../../src/utils/http.js';

export default async (ctx) => {
  const { mongoose, user, company, job, plans, DAY } = ctx;
  const ID = (n) => new mongoose.Types.ObjectId(`ad${String(n).padStart(22, '0')}`);
  const MIN = 60_000;
  // Danh sách quản trị chỉ hiện 10 dòng/trang, xếp mới nhất trước: đẩy createdAt lên tương lai để dữ liệu test luôn ở trang 1
  // (chỉ dùng cho bản ghi không hiện công khai). Ghi thẳng collection để mongoose không ghi đè createdAt.
  const top = (Model, id, i) => Model.collection.updateOne({ _id: id }, { $set: { createdAt: new Date(Date.now() + DAY + i * MIN) } });
  const sv = (n, email, fullName, extra = {}) => user(`${email}@unishift.test`, 'STUDENT', fullName, { _id: ID(n), student: { school: 'Đại học Văn Lang', major: 'Kinh tế', yearOfStudy: 2 }, ...extra });
  const ntd = (n, email, fullName, co, extra = {}) => {
    const c = company(co);
    return user(`${email}@unishift.test`, 'EMPLOYER', fullName, { _id: ID(n), ...c, ...extra, employer: { ...c.employer, ...extra.employer } });
  };
  const admin = await User.findOne({ email: 'admin@unishift.test' });
  const cat = (name, extra = {}) => Category.create({ name, slug: slugify(name), ...extra });

  // ---- Quản lý người dùng
  await user('a_admin2@unishift.test', 'ADMIN', 'Quản trị viên QA 2', { _id: ID(1) }, 'Admin1234');
  await ntd(7, 'a_ntd7', 'Chủ quán QA07', 'Cà phê QA07', { employer: { premiumUntil: new Date(Date.now() + 20 * DAY) } }); // TC-07
  const ntd12 = await ntd(12, 'a_ntd12', 'Chủ nhà sách QA12', 'Nhà sách QA12 Khóa', { status: 'LOCKED', lockReason: 'Lừa đảo' }); // TC-12
  await job(ntd12, 'Nhà sách QA12 tuyển nhân viên bán sách', { _id: ID(112), status: 'FILLED' });
  await sv(20, 'a_sv1', 'Sinh viên QA Tìm'); // TC-18
  await sv(18, 'a_sv18', 'Sinh viên QA Bị khóa 18', { status: 'LOCKED', lockReason: 'Spam báo cáo' });
  await sv(21, 'a_sv19', 'Sinh viên QA Khóa 19'); // TC-19
  await sv(22, 'a_sv21', 'Sinh viên QA Khóa 21', { status: 'LOCKED', lockReason: 'Đăng tải CV giả mạo' }); // TC-21
  await sv(23, 'a_sv22', 'Sinh viên QA Mở khóa 22', { status: 'LOCKED', lockReason: 'Spam báo cáo' }); // TC-22
  for (const [i, n] of [18, 22, 23].entries()) await top(User, ID(n), i);

  // ---- Quản lý tin
  const ntdTin = await ntd(30, 'a_ntd_tin', 'Chủ quán QA Tin', 'Quán QA Tin');
  await job(ntdTin, 'Phục vụ quán trà QA15', { _id: ID(130) }); // TC-15
  await job(ntdTin, 'Phục vụ QA16 bị ẩn', { _id: ID(131), status: 'HIDDEN', hiddenFromStatus: 'OPEN', hiddenReason: 'Tin trùng lặp' }); // TC-16
  await job(ntdTin, 'Phục vụ QA16 hết hạn', { _id: ID(132), expiresAt: new Date(Date.now() - DAY) });
  await job(await ntd(31, 'a_ntd17', 'Chủ quán QA17', 'Quán QA17'), 'Phục vụ quán cà phê QA17', { _id: ID(133), status: 'HIDDEN', hiddenFromStatus: 'OPEN', hiddenReason: 'Tin yêu cầu đặt cọc' }); // TC-17
  await job(await ntd(32, 'a_ntd18', 'Chủ quán QA18', 'Quán QA18'), 'Phục vụ quán cà phê QA18', { _id: ID(134), status: 'HIDDEN', hiddenFromStatus: 'OPEN', hiddenReason: 'Tin yêu cầu đặt cọc' }); // TC-18
  for (const [i, n] of [131, 132, 133, 134].entries()) await top(mongoose.model('Job'), ID(n), i);

  // ---- Danh mục (tên có chữ QA, không đụng 8 danh mục nền)
  const ntd2 = await ntd(10, 'a_ntd2', 'Chủ nhà sách QA', 'Nhà sách Phương Nam QA');
  const banHang = await cat('Bán hàng QA'); // TC-16
  await job(ntd2, 'Bán hàng QA16 cửa hàng tiện lợi', { categoryId: banHang._id });
  const banSach = await cat('Bán sách QA', { isActive: false }); // TC-17: danh mục đang ẩn
  await job(ntd2, 'Nhân viên bán sách cuối tuần QA', { _id: ID(110), categoryId: banSach._id });
  await cat('Thiết kế QA'); // TC-15
  await cat('Marketing QA'); // TC-18

  // ---- Đánh giá: mỗi đánh giá cần 1 đơn COMPLETED
  const dg1 = await sv(41, 'a_sv_dg1', 'SV QA Đánh giá Một');
  const dg2 = await sv(42, 'a_sv_dg2', 'SV QA Đánh giá Hai');
  const dg4 = await sv(43, 'a_sv_dg4', 'SV QA Đánh giá Bốn');
  let ri = 0;
  const review = async (e, s, rating, comment, hiddenReason) => {
    const j = (await mongoose.model('Job').findOne({ employerId: e._id })) || (await job(e, `Phục vụ ${e.employer.company.name}`, { status: 'COMPLETED' }));
    const a = await Application.create({ jobId: j._id, studentId: s._id, employerId: e._id, cvUrl: '/api/v1/files/cv/qa.pdf', status: 'COMPLETED', jobSnapshot: { title: j.title, companyName: e.employer.company.name } });
    const r = await Review.create({ applicationId: a._id, jobId: j._id, reviewerId: s._id, revieweeId: e._id, reviewerRole: 'STUDENT', rating, comment, isHidden: !!hiddenReason, hiddenReason });
    await top(Review, r._id, ri++);
  };
  const rate = (e, avg, count) => User.updateOne({ _id: e._id }, { ratingAvg: avg, ratingCount: count });
  const dgA = await ntd(40, 'a_ntd_dg11', 'Chủ quán QA DG11', 'Quán QA Đánh giá 11'); // TC-10, TC-11
  await review(dgA, dg1, 5, 'QA11 Quán sạch sẽ, chủ thân thiện');
  await review(dgA, dg2, 3, 'QA11 Lương trả chậm');
  await rate(dgA, 4, 2);
  const dgB = await ntd(44, 'a_ntd_dg12', 'Chủ quán QA DG12', 'Quán QA Đánh giá 12'); // TC-12: 3 sao đã ẩn
  await review(dgB, dg1, 5, 'QA12 Rất tốt');
  await review(dgB, dg2, 3, 'QA12 Tạm được', 'Ngôn từ xúc phạm');
  await rate(dgB, 5, 1);
  const dgC = await ntd(45, 'a_ntd_dg13', 'Chủ quán QA DG13', 'Quán QA Đánh giá 13'); // TC-13
  await review(dgC, dg1, 5, 'QA13 Môi trường tốt');
  await review(dgC, dg4, 2, 'QA13 Không thích', 'Spam');
  await review(dgC, dg2, 3, 'QA13 Hơi đông khách', 'Ngôn từ xúc phạm');
  await rate(dgC, 5, 1);

  // ---- Báo cáo vi phạm
  let pi = 0;
  const report = async (reporter, targetType, targetId, reason, extra = {}) => {
    const r = await Report.create({ reporterId: reporter._id, targetType, targetId, reason, ...extra });
    await top(Report, r._id, pi++);
    return r;
  };
  const rSv = await sv(50, 'a_sv_r04', 'SV QA Người báo cáo');
  const rNtd = await ntd(52, 'a_ntd_r05', 'NTD QA Người báo cáo', 'Quán QA Báo cáo');
  await report(rSv, 'USER', (await ntd(51, 'a_ntd_r04', 'NTD QA Bị báo cáo 04', 'Nhà sách QA04'))._id, 'WRONG_INFO'); // TC-04
  await report(rNtd, 'USER', (await sv(53, 'a_sv_r05', 'SV QA Bị báo cáo 05'))._id, 'UNPAID_OR_ABSENT'); // TC-05
  const r07 = await ntd(54, 'a_ntd_r07', 'NTD QA Nhà sách 07', 'Nhà sách QA07'); // TC-07
  const j07 = await job(r07, 'Nhân viên bán sách cuối tuần QA07', { _id: ID(154) });
  await job(r07, 'Thu ngân nhà sách ca sáng QA07', { _id: ID(155) });
  const sv07 = await sv(55, 'a_sv_r07', 'SV QA Ứng viên 07');
  await Application.create({ jobId: j07._id, studentId: sv07._id, employerId: r07._id, cvUrl: '/api/v1/files/cv/qa.pdf', jobSnapshot: { title: j07.title, companyName: 'Nhà sách QA07' }, statusHistory: [{ status: 'PENDING', at: new Date() }] });
  const sv07b = await sv(56, 'a_sv_r07b', 'SV QA Người báo cáo 07');
  await report(sv07b, 'JOB', j07._id, 'SCAM');
  const r14 = await ntd(58, 'a_ntd_r14', 'NTD QA Tái phạm 14', 'Nhà sách QA14'); // TC-14: đã 2 lần vi phạm
  const j14 = await job(r14, 'Nhân viên bán sách cuối tuần QA14', { _id: ID(158) });
  for (const level of ['V1', 'V2']) await Violation.create({ userId: r14._id, level, note: 'Vi phạm cũ QA14', adminId: admin._id });
  await report(sv07b, 'JOB', j14._id, 'SCAM');
  const r15 = await ntd(60, 'a_ntd_r15', 'NTD QA Quán 15', 'Quán QA15'); // TC-15, TC-16
  await report(rSv, 'USER', (await sv(59, 'a_sv_r15', 'SV QA Bị báo cáo 15'))._id, 'HARASSMENT');
  await report(rSv, 'JOB', (await job(r15, 'Phục vụ quán cà phê QA15r', { _id: ID(160) }))._id, 'SCAM');
  await report(rSv, 'JOB', (await job(r15, 'Phục vụ quán cà phê QA16r', { _id: ID(161) }))._id, 'SCAM');
  await report(rNtd, 'USER', (await sv(61, 'a_sv_r17', 'SV QA Bị báo cáo 17'))._id, 'UNPAID_OR_ABSENT'); // TC-17
  await report(rSv, 'USER', (await ntd(62, 'a_ntd_d05', 'NTD QA Dashboard 05', 'Quán QA D05'))._id, 'WRONG_INFO'); // Dashboard TC-05
  await report(rNtd, 'USER', (await ntd(57, 'a_ntd_r13', 'NTD QA Đã xử lý 13', 'Quán QA13'))._id, 'OTHER', // TC-13: 1 báo cáo đã xử lý
    { status: 'RESOLVED', resolution: { level: 'V1', note: 'QA13 đã cảnh cáo', adminId: admin._id, at: new Date() } });

  // ---- Gói & giao dịch
  await ntd(70, 'a_ntd_p09a', 'NTD QA Premium 09A', 'Quán QA P09A', { employer: { premiumUntil: new Date(Date.now() + 25 * DAY) } }); // TC-09
  const p09b = await ntd(71, 'a_ntd_p09b', 'NTD QA Premium 09B', 'Quán QA P09B');
  await job(p09b, 'Phục vụ QA P09B ca sáng');
  await job(p09b, 'Phục vụ QA P09B ca tối');
  await ntd(72, 'a_ntd_p18', 'NTD QA Premium 18', 'Quán QA P18'); // TC-18
  let ti = 0;
  const pay = async (e, code, status, extra = {}) => {
    const p = plans[code];
    const doc = await Payment.create({
      employerId: e._id, planId: p._id, planSnapshot: { code, name: p.name, durationDays: p.durationDays }, amount: p.price,
      txnRef: `UNIAD${String(++ti).padStart(8, '0')}`, status, expiresAt: new Date(Date.now() + DAY),
      ...(status === 'SUCCESS' && { paidAt: new Date(), gatewayCode: 'QA' }), ...extra,
    });
    await Payment.collection.updateOne({ _id: doc._id }, { $set: { createdAt: new Date(Date.now() + ti * MIN) } }); // mới nhất, vẫn trong tháng này
    return doc;
  };
  await pay(await ntd(73, 'a_ntd_p19', 'NTD QA Giao dịch 19', 'Quán QA P19'), 'PREMIUM_1M', 'PENDING'); // TC-19
  const p17a = await ntd(74, 'a_ntd_p17a', 'NTD QA Giao dịch 17A', 'Quán QA P17A'); // TC-17, Dashboard TC-11/14
  const p17b = await ntd(75, 'a_ntd_p17b', 'NTD QA Giao dịch 17B', 'Quán QA P17B');
  await pay(p17a, 'PREMIUM_1M', 'SUCCESS');
  await pay(p17b, 'PREMIUM_3M', 'SUCCESS');
  await pay(p17a, 'PREMIUM_1M', 'PENDING');
  for (let i = 0; i < 2; i++) await pay(p17b, 'PREMIUM_1M', 'PENDING', { expiresAt: new Date(Date.now() - 5 * MIN) });
  await pay(await ntd(76, 'a_ntd_p20', 'NTD QA Giao dịch 20', 'Quán QA P20'), 'PREMIUM_1M', 'PENDING', { txnRef: 'UNIAD00000020', expiresAt: new Date(Date.now() - 25 * MIN) }); // TC-20
  await pay(await ntd(77, 'a_ntd_p20b', 'NTD QA Giao dịch 20B', 'Quán QA P20B'), 'PREMIUM_1M', 'SUCCESS', { txnRef: 'UNIAD00000021' });
};
