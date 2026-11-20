// Dữ liệu QA cho các TC GUI vai trò employer (Claude outputs/Testcase/03_Employer). ctx = { mongoose, user, company, job, cats, plans, pw, DAY }
// Tin đang hiện công khai có đuôi " (E)" để không trùng tiêu đề tin của module khác.
// Mọi tài khoản có tiền tố e_ để không đụng module khác. Mỗi file Excel dùng một nhà tuyển dụng riêng (e_ntd_tin, e_ntd_uv…)
// để thao tác đổi dữ liệu của file này không làm lệch số liệu của file khác. Chạy lại test có thao tác ghi thì seed lại.
import Application from '../../src/models/Application.js';
import Payment from '../../src/models/Payment.js';
import Job from '../../src/models/Job.js';
import { saveUpload } from '../../src/utils/files.js';

// Ảnh PNG 1×1 và file PDF nhỏ (logo, CV)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

export default async (ctx) => {
  const { user, company, job, cats, plans, DAY } = ctx;
  const now = Date.now();
  const ago = (ms) => new Date(now - ms);
  const MIN = 60_000;
  const cvUrl = await saveUpload(PDF, 'cv', ['pdf']);
  const logoUrl = await saveUpload(PNG, 'logos', ['png']);

  // Sinh viên
  const sv = (n, fullName, extra = {}) => user(`e_sv${n}@unishift.test`, 'STUDENT', fullName, {
    phone: `090300000${n}`,
    student: { school: 'Đại học Văn Lang', major: 'Quản trị kinh doanh', yearOfStudy: 2, skills: ['Giao tiếp', 'Pha chế'], cv: { url: cvUrl, fileName: 'CV.pdf', uploadedAt: new Date() } },
    ...extra,
  });
  const sv1 = await sv(1, 'Lê Minh Anh', { ratingAvg: 4, ratingCount: 2 });
  const sv2 = await sv(2, 'Phạm Thu Hà', { ratingAvg: 4, ratingCount: 2 });
  const sv3 = await sv(3, 'Võ Quốc Bảo');
  const sv4 = await sv(4, 'Đặng Gia Huy');
  const sv5 = await sv(5, 'Trương Mỹ Linh');

  // Đơn ứng tuyển: createdAt đặt lại sau khi tạo (timestamps của mongoose không cho ghi đè lúc create)
  const app = async (j, s, status = 'PENDING', extra = {}, createdAt = ago(60 * MIN)) => {
    const hist = [{ status: 'PENDING', at: createdAt }];
    if (status !== 'PENDING') hist.push({ status: ['COMPLETED', 'NOT_COMPLETED'].includes(status) ? 'ACCEPTED' : status, at: new Date(+createdAt + MIN) });
    if (['COMPLETED', 'NOT_COMPLETED'].includes(status)) hist.push({ status, at: extra.finishedAt || new Date() });
    const a = await Application.create({
      jobId: j._id, studentId: s._id, employerId: j.employerId, cvUrl, status, statusHistory: hist,
      jobSnapshot: { title: j.title, companyName: j.companySnapshot.name, startDate: j.startDate },
      coverLetter: 'Em là sinh viên năm 2, đã từng làm phục vụ quán cà phê 6 tháng, có thể làm ca tối và cuối tuần.',
      ...extra,
    });
    await Application.collection.updateOne({ _id: a._id }, { $set: { createdAt } });
    const accepted = ['ACCEPTED', 'COMPLETED', 'NOT_COMPLETED'].includes(status) ? 1 : 0;
    await Job.updateOne({ _id: j._id }, { $inc: { applicationCount: 1, acceptedCount: accepted } });
    return a;
  };
  const emp = async (email, name, extra = {}, more = {}) => {
    const c = company(name, extra);
    return user(email, 'EMPLOYER', 'Trần Thị Bình', { ...c, employer: { ...c.employer, ...more } });
  };
  const PREMIUM_UNTIL = new Date(now + 24 * DAY);

  // e_ntd1 (Premium 24 ngày): Dashboard, Mua Premium, Lịch sử giao dịch
  const ntd1 = await emp('e_ntd1@unishift.test', 'Cà phê Sáng Tạo E', {}, { premiumUntil: PREMIUM_UNTIL });
  const feat = { featuredUntil: PREMIUM_UNTIL, expiresAt: new Date(now + 24 * DAY) };
  const n1a = await job(ntd1, 'Phục vụ quán cà phê ca tối Phan Thiết', { ...feat, city: 'Phan Thiết', district: 'Phú Thủy', shifts: [14, 17, 20] });
  await job(ntd1, 'Pha chế đồ uống ca sáng Sáng Tạo', feat);
  const n1filled = await job(ntd1, 'Phục vụ tiệc tối Sáng Tạo', { ...feat, slots: 2, status: 'FILLED' });
  const n1closed = await job(ntd1, 'Thu ngân ca chiều Sáng Tạo', { ...feat, status: 'CLOSED' });
  const n1done = await job(ntd1, 'Phát tờ rơi Sáng Tạo', { ...feat, slots: 1, status: 'COMPLETED', startDate: ago(20 * DAY) });
  await job(ntd1, 'Tin đã xóa Sáng Tạo', { ...feat, deletedAt: new Date() });
  for (const [s, m] of [[sv1, 180], [sv3, 150], [sv4, 120]]) await app(n1a, s, 'PENDING', {}, ago(m * MIN));
  await app(n1a, sv2, 'PENDING', {}, ago(12 * MIN)); // đơn chờ mới nhất (TC-09)
  await app(n1filled, sv1, 'ACCEPTED');
  await app(n1filled, sv2, 'ACCEPTED');
  await app(n1done, sv3, 'COMPLETED', { finishedAt: ago(2 * DAY) });
  for (const s of [sv1, sv2, sv3]) await app(n1closed, s, 'REJECTED', { rejectReason: 'Đã đủ người' });
  // 3 giao dịch: SUCCESS cũ, PENDING quá hạn, SUCCESS mới nhất (Lịch sử giao dịch TC-08, TC-13)
  const pay = async (employer, plan, status, createdAt, ref) => {
    const p = await Payment.create({
      employerId: employer._id, planId: plan._id, planSnapshot: { code: plan.code, name: plan.name, durationDays: plan.durationDays },
      amount: plan.price, txnRef: ref, status, expiresAt: new Date(+createdAt + 15 * MIN),
      ...(status === 'SUCCESS' && { paidAt: new Date(+createdAt + 2 * MIN), gatewayRef: 'TXN-QA-' + ref }),
    });
    await Payment.collection.updateOne({ _id: p._id }, { $set: { createdAt } });
    return p;
  };
  await pay(ntd1, plans.PREMIUM_1M, 'SUCCESS', ago(15 * DAY), 'UNIE000000A1');
  await pay(ntd1, plans.PREMIUM_1M, 'PENDING', ago(6 * DAY), 'UNIE000000A2');
  await pay(ntd1, plans.PREMIUM_1M, 'SUCCESS', ago(60 * MIN), 'UNIE000000A3');

  // e_ntd2 (Free, 1 tin đang tuyển, không có đơn chờ, chưa có giao dịch): đăng tin, hồ sơ công ty, khối gói Free
  const ntd2 = await emp('e_ntd2@unishift.test', 'Nhà sách Phương Nam E', { address: '940 Đường 3/2, Phường 15', district: 'Quận 11' });
  await job(ntd2, 'Bán sách online cuối tuần Phương Nam', { categoryId: cats['Bán hàng']._id });
  // Giao dịch còn chờ tạo 5 phút trước (Lịch sử giao dịch TC-14). Hạn để 6 giờ thay vì 15 phút để test chạy sau khi seed vẫn còn "Đang xử lý"
  const p2 = await pay(ntd2, plans.PREMIUM_1M, 'PENDING', ago(5 * MIN), 'UNIE000000B1');
  await Payment.updateOne({ _id: p2._id }, { expiresAt: new Date(now + 6 * 60 * MIN) });

  // e_ntd3: chưa có hồ sơ công ty, chưa mua gói
  await user('e_ntd3@unishift.test', 'EMPLOYER', 'Hoàng Văn Cường');

  // e_ntd4 (Free, đủ 3 tin đang tuyển + 1 tin đã đóng): hết hạn mức
  const ntd4 = await emp('e_ntd4@unishift.test', 'Nhà sách Hội Chợ E');
  for (const t of ['Bán sách ca sáng Hội Chợ', 'Bán sách ca chiều Hội Chợ', 'Bán sách ca tối Hội Chợ']) await job(ntd4, t, { categoryId: cats['Bán hàng']._id });
  await job(ntd4, 'Bán sách hội chợ cuối tuần', { categoryId: cats['Bán hàng']._id, status: 'CLOSED' });

  // e_ntd5 (Free): tin chưa có đơn để xóa, tin mới hơn tin Nổi bật của e_ntd1 ở Phan Thiết, mua gói (form SePay)
  const ntd5 = await emp('e_ntd5@unishift.test', 'Nhà sách Biển Xanh E');
  await job(ntd5, 'Nhân viên bán sách ca chiều Quận 11 (E)', { categoryId: cats['Bán hàng']._id });
  await job(ntd5, 'Bán sách ca tối Phan Thiết', { categoryId: cats['Bán hàng']._id, city: 'Phan Thiết', district: 'Phú Thủy' });

  // e_ntd_logo: có logo, tin đang tuyển (Hồ sơ công ty TC-14, TC-17)
  const ntdLogo = await emp('e_ntd_logo@unishift.test', 'Cà phê Hoa Mai E', { logoUrl });
  await job(ntdLogo, 'Phục vụ quán cà phê ca tối Hoa Mai');

  // e_ntd_dang (Premium): form đăng / sửa tin; 1 tin đã nhận người, có ghim
  const ntdDang = await emp('e_ntd_dang@unishift.test', 'Cà phê Đăng Tin E', {}, { premiumUntil: PREMIUM_UNTIL });
  const locked = await job(ntdDang, 'Phục vụ quán cà phê ca tối Đăng Tin', { slots: 3, location: { type: 'Point', coordinates: [106.698, 10.772] } });
  await app(locked, sv1, 'ACCEPTED', { employerNote: 'Đến lúc 17h45' });

  // e_ntd_tin: Quản lý tin (đủ các trạng thái)
  const ntdTin = await emp('e_ntd_tin@unishift.test', 'Cà phê Quản Lý E');
  const tin16 = await job(ntdTin, 'Phục vụ quán cà phê ca tối (E)', { slots: 5, viewCount: 48, expiresAt: new Date(now + 25 * DAY) });
  await app(tin16, sv1, 'PENDING');
  await app(tin16, sv2, 'PENDING');
  await app(tin16, sv3, 'ACCEPTED');
  await app(tin16, sv4, 'REJECTED', { rejectReason: 'Chưa phù hợp' });
  await app(tin16, sv5, 'WITHDRAWN');
  const tin18 = await job(ntdTin, 'Pha chế đồ uống ca sáng cuối tuần (E)');
  await app(tin18, sv1, 'PENDING');
  await job(ntdTin, 'Phục vụ tiệc sinh nhật cuối tuần (E)');
  await job(ntdTin, 'Phát tờ rơi quá hạn Quản Lý', { expiresAt: ago(DAY) });
  await job(ntdTin, 'Phục vụ tiệc đã đủ người', { status: 'FILLED' });
  await job(ntdTin, 'Thu ngân ca chiều đã đóng', { status: 'CLOSED' });
  await job(ntdTin, 'Bưng bê sự kiện đã xong', { status: 'COMPLETED', startDate: ago(20 * DAY) });
  await job(ntdTin, 'Phát tờ rơi khai trương', { status: 'HIDDEN', hiddenFromStatus: 'OPEN', hiddenReason: 'Nội dung lương không rõ ràng' });

  // e_ntd_uv: Xử lý ứng viên — mỗi TC có ghi một tin riêng
  const ntdUv = await emp('e_ntd_uv@unishift.test', 'Cà phê Ứng Viên E');
  const uv = async (title, slots, students) => {
    const j = await job(ntdUv, title, { slots });
    for (const s of students) await app(j, s);
    return j;
  };
  await uv('Phục vụ quán cà phê ca tối (E)', 5, [sv1, sv2, sv4]); // TC-16, 17, 18 (chỉ xem)
  await uv('Phục vụ cà phê ca tối Lê Lợi', 5, [sv1]); // TC-08
  await uv('Phục vụ cà phê ca tối thứ 7', 5, [sv4]); // TC-11
  await uv('Phục vụ cà phê ca tối gặp anh Nam', 5, [sv4]); // TC-19
  await uv('Phục vụ cà phê ca tối điện thoại', 5, [sv2]); // TC-20
  await uv('Phục vụ quán cà phê ca tối – chi nhánh 2 (E)', 1, [sv1, sv2]); // TC-21

  // e_ntd_xn: Xác nhận kết quả
  const ntdXn = await emp('e_ntd_xn@unishift.test', 'Cà phê Xác Nhận E');
  const xnSoon = await job(ntdXn, 'Pha chế đồ uống ca sáng cuối tuần (E)', { startDate: new Date(now + 5 * DAY) });
  await app(xnSoon, sv4, 'ACCEPTED');
  const xnDone = await job(ntdXn, 'Phục vụ quán cà phê ca tối (E)', { slots: 5, startDate: ago(5 * DAY) });
  await app(xnDone, sv2, 'ACCEPTED');
  await app(xnDone, sv1, 'ACCEPTED');

  // e_ntd_dg: Đánh giá sinh viên
  const ntdDg = await emp('e_ntd_dg@unishift.test', 'Cà phê Đánh Giá E');
  const dgWed = await job(ntdDg, 'Phục vụ tiệc cưới cuối tuần (E)');
  await app(dgWed, sv2);
  await app(dgWed, sv3);
  const dgDone = await job(ntdDg, 'Phục vụ bàn tiệc cuối tuần', { slots: 2, status: 'COMPLETED', startDate: ago(20 * DAY) });
  await app(dgDone, sv5, 'COMPLETED', { finishedAt: new Date() });
  await app(dgDone, sv2, 'COMPLETED', { finishedAt: ago(15 * DAY) });
};
