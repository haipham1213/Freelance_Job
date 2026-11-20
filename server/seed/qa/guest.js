// Dữ liệu QA cho các TC GUI vai trò guest (xem seed/qa.js). ctx = { mongoose, user, company, job, cats, plans, pw, DAY }
// Tài khoản g_* và công ty "Mộc Lan" là của riêng module guest: test lọc theo từ khóa "moc lan" để không lẫn tin của module khác.
// Token xác thực / đặt lại mật khẩu được tạo sẵn với chuỗi cố định (test mở thẳng link, không phải đọc log).
import Token from '../../src/models/Token.js';
import Review from '../../src/models/Review.js';
import { sha256 } from '../../src/utils/http.js';

// Tọa độ ĐH Văn Lang (cơ sở chính) trong frontend/src/utils/geo.js: 10.82848, 106.70303
// _id cố định để test mở thẳng /employers/{id}, /jobs/{id} (giá trị ghi trong freelance_automation/Json/guest/*.json)
const ID = { ntd1: '67a000000000000000000001', ntd2: '67a000000000000000000002', ntd3: '67a000000000000000000003', ntd4: '67a000000000000000000004', ntd5: '67a000000000000000000005', jobB: '67a0000000000000000000b1' };
const pin = (lat, lng) => ({ type: 'Point', coordinates: [lng, lat] });

export default async (ctx) => {
  const { mongoose, user, company, job, cats, DAY } = ctx;
  const token = (u, type, raw) => Token.create({ userId: u._id, type, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + DAY) });

  // --- Tài khoản cho Quên mật khẩu / Xác thực email
  const sv4 = await user('g_sv4@unishift.test', 'STUDENT', 'Lê Minh Tư');
  const sv4b = await user('g_sv4b@unishift.test', 'STUDENT', 'Lê Minh Tuấn');
  await token(sv4, 'RESET_PASSWORD', 'guest-reset-sv4');
  await token(sv4b, 'RESET_PASSWORD', 'guest-reset-sv4b');
  const sv6 = await user('g_sv6@unishift.test', 'STUDENT', 'Đỗ Thu Sáu', { emailVerified: false });
  await token(sv6, 'VERIFY_EMAIL', 'guest-verify-sv6');
  await user('g_sv9@unishift.test', 'STUDENT', 'Phan Gia Chín', { emailVerified: false });

  // --- Nhà tuyển dụng
  const premium = { premiumUntil: new Date(Date.now() + 30 * DAY) };
  const ntd1 = await user('g_ntd1@unishift.test', 'EMPLOYER', 'Vũ Thị Mộc', {
    _id: ID.ntd1,
    ...company('Cà phê Mộc Lan', { website: 'https://mloan.example.com', logoUrl: '/logo192.png' }),
  });
  ntd1.employer.premiumUntil = premium.premiumUntil;
  ntd1.ratingAvg = 4; ntd1.ratingCount = 12;
  await ntd1.save();
  const ntd2 = await user('g_ntd2@unishift.test', 'EMPLOYER', 'Hồ Văn Nam', { _id: ID.ntd2, ...company('Nhà sách Mộc Lan'), ratingAvg: 4, ratingCount: 2 });
  const ntd3 = await user('g_ntd3@unishift.test', 'EMPLOYER', 'Lý Bản Đồ', { _id: ID.ntd3, ...company('Mộc Lan Bản Đồ') });
  await user('g_ntd4@unishift.test', 'EMPLOYER', 'Tạ Văn Khóa', { _id: ID.ntd4, ...company('Mộc Lan Bị Khóa'), status: 'LOCKED', lockReason: 'Thu phí đặt cọc' });
  const ntd5 = await user('g_ntd5@unishift.test', 'EMPLOYER', 'Mai Thị Năm', { _id: ID.ntd5, ...company('Cửa hàng Mộc Lan') });

  // --- Tin của g_ntd1 (Premium): 3 tin Nổi bật + 5 tin thường (đủ nhiều để công ty lên dải logo trang chủ và có việc tương tự)
  const featured = { featuredUntil: new Date(Date.now() + 30 * DAY) };
  await job(ntd1, 'Phục vụ Mộc Lan ca tối', { ...featured, shifts: [2, 5, 8, 11, 14], slots: 5, acceptedCount: 2, applicationCount: 4, schedule: 'Tối T2–T6, 18h–22h' });
  await job(ntd1, 'Pha chế Mộc Lan ca sáng', { ...featured, shifts: [0, 3, 6] });
  await job(ntd1, 'Thu ngân Mộc Lan ca chiều', { ...featured, shifts: [1, 4, 7], categoryId: cats['Bán hàng']._id });
  for (const [i, s] of [[1, [17, 20]], [2, [15, 18]], [3, [2, 5]], [4, []], [5, [9, 12]]].entries())
    await job(ntd1, `Phục vụ Mộc Lan số ${s[0]}`, { shifts: s[1].length ? s[1] : undefined, createdAt: new Date(Date.now() - (i + 1) * 3600_000) });

  // --- g_ntd1: 12 đánh giá (6 × 5★, 6 × 3★ → 4,0), mới nhất trước
  const svs = [];
  for (let i = 1; i <= 12; i++) svs.push(await user(`g_rv${i}@unishift.test`, 'STUDENT', `Sinh viên Đánh Giá ${i}`));
  const anyJob = await mongoose.model('Job').findOne({ employerId: ntd1._id });
  for (const [i, s] of svs.entries())
    await Review.create({ applicationId: new mongoose.Types.ObjectId(), jobId: anyJob._id, reviewerId: s._id, revieweeId: ntd1._id, reviewerRole: 'STUDENT',
      rating: i % 2 ? 3 : 5, comment: `Nhận xét Mộc Lan số ${i + 1}`, createdAt: new Date(Date.now() - (i + 1) * DAY) });

  // --- g_ntd2 (Free): đúng 1 tin đang tuyển, 2 đánh giá 5★ và 3★
  const banSach = await job(ntd2, 'Nhân viên bán sách Mộc Lan cuối tuần', { categoryId: cats['Bán hàng']._id, shifts: [15, 16, 18, 19] });
  for (const [i, r] of [5, 3].entries())
    await Review.create({ applicationId: new mongoose.Types.ObjectId(), jobId: banSach._id, reviewerId: svs[i]._id, revieweeId: ntd2._id, reviewerRole: 'STUDENT', rating: r, comment: `Nhà sách Mộc Lan ${r} sao` });

  // --- g_ntd5: chưa có đánh giá; tin lương lẻ 25.500đ/giờ (BUG-050) và tin gia sư theo giờ ở TP.HCM
  await job(ntd5, 'Thu ngân nhà sách Mộc Lan cuối tuần', { categoryId: cats['Bán hàng']._id, salaryMin: 25500, salaryMax: 25500, shifts: [15, 18] });
  await job(ntd5, 'Gia sư Mộc Lan toán lớp 9', { categoryId: cats['Gia sư']._id, shifts: [8, 11] });

  // --- g_ntd3: tin cho bản đồ gần trường (P1 cách ĐH Văn Lang ~445 m, P4 ~3 km, P2 không ghim) và tin hết hạn B
  await job(ntd3, 'Phục vụ Mộc Lan gần Văn Lang', { location: pin(10.83248, 106.70303) });
  await job(ntd3, 'Pha chế Mộc Lan cách trường 3 km', { location: pin(10.85548, 106.70303) });
  await job(ntd3, 'Phục vụ Mộc Lan chưa ghim');
  await job(ntd3, 'Mộc Lan B hết hạn', { _id: ID.jobB, expiresAt: new Date(Date.now() - DAY), startDate: new Date(Date.now() - 3 * DAY) });
};
