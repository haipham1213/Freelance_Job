// Dữ liệu QA cho các TC GUI vai trò student (xem seed/qa.js). ctx = { mongoose, user, company, job, cats, plans, pw, DAY }
// Mọi tài khoản có tiền tố s_ (s_sv1…, s_ntd1, s_ntd2), mỗi TC làm đổi dữ liệu dùng tài khoản riêng.
// Tiêu đề tin có đuôi "(QA SV)"; 5 tin của TC Lịch học có đuôi "(QA LH)" để đếm/lọc không lẫn module khác.
// Một số _id cố định (ID) để test Selenium mở thẳng URL — khai báo trùng trong Json/student/*.json của freelance_automation.
import crypto from 'node:crypto';
import Application from '../../src/models/Application.js';
import Notification from '../../src/models/Notification.js';
import File from '../../src/models/File.js';
import Report from '../../src/models/Report.js';
import Review from '../../src/models/Review.js';
import Job from '../../src/models/Job.js';

const ID = {
  ntd1: '6573760000000000000000e1',
  ntd2: '6573760000000000000000e2',
  jobCaPhe: '6573760000000000000000a1',
  jobToRoiKhaiTruong: '6573760000000000000000a7',
  appAcceptedSv1: '6573760000000000000000b2',
};

export default async (ctx) => {
  const { user, company, job, DAY } = ctx;
  const ago = (d) => new Date(Date.now() - d * DAY);

  // CV có sẵn: lưu file PDF nhỏ vào collection files như API POST /students/me/cv
  const cv = async (fileName, daysAgo = 10) => {
    const _id = `cv/${crypto.randomBytes(16).toString('hex')}.pdf`;
    await File.create({ _id, contentType: 'application/pdf', data: Buffer.from(`%PDF-1.4\n% ${fileName}\n%%EOF\n`) });
    return { url: `/api/v1/files/${_id}`, fileName, uploadedAt: ago(daysAgo) };
  };
  let phoneSeq = 0;
  const sv = async (ten, fullName, student = {}, extra = {}) => user(`${ten}@unishift.test`, 'STUDENT', fullName, {
    phone: `09012345${String(++phoneSeq).padStart(2, '0')}`,
    student: { school: 'Đại học Văn Lang', major: 'Công nghệ thông tin', yearOfStudy: 3, cv: await cv(`CV-${ten.replace('s_', '')}.pdf`), ...student },
    ...extra,
  });

  // Nhà tuyển dụng
  const ntd1 = await user('s_ntd1@unishift.test', 'EMPLOYER', 'Lê Văn Sáng', { _id: ID.ntd1, ...company('Cà phê Sáng Tạo SV') });
  const ntd2 = await user('s_ntd2@unishift.test', 'EMPLOYER', 'Phạm Thị Nam', { _id: ID.ntd2, ...company('Nhà sách Phương Nam SV') });

  // Tin dùng chung của module
  const jCaPhe = await job(ntd1, 'Phục vụ quán cà phê ca tối (QA SV)', { _id: ID.jobCaPhe, shifts: [2, 5, 8], slots: 5 });
  const jThuNgan = await job(ntd1, 'Thu ngân cửa hàng tiện lợi ca chiều (QA SV)', { shifts: [1, 4, 7] });
  const jGiaSu = await job(ntd2, 'Gia sư Toán lớp 8 buổi tối (QA SV)');
  const jToRoi = await job(ntd1, 'Phát tờ rơi cuối tuần (QA SV)', { status: 'COMPLETED', startDate: ago(10) });
  const jTet = await job(ntd2, 'Bán hàng nhà sách dịp Tết (QA SV)', { status: 'CLOSED' });
  const jPhuBep = await job(ntd1, 'Nhân viên phụ bếp ca trưa (QA SV)');
  const jKhaiTruong = await job(ntd1, 'Phát tờ rơi khai trương (QA SV)', { _id: ID.jobToRoiKhaiTruong, status: 'FILLED', slots: 1, acceptedCount: 1 });
  const jSuKien = await job(ntd1, 'Trực quầy sự kiện cuối tuần (QA SV)', { expiresAt: ago(1), startDate: ago(20) });
  const jTraSua = await job(ntd2, 'Pha chế trà sữa ca sáng (QA SV)', { status: 'HIDDEN', hiddenFromStatus: 'OPEN', hiddenReason: 'Vi phạm' });

  // 5 tin TC Lịch học (A–E)
  await job(ntd1, 'Phục vụ quán cà phê ca tối (QA LH)', { shifts: [2, 5, 8, 11, 14] });
  await job(ntd2, 'Thu ngân nhà sách ca sáng (QA LH)', { shifts: [0, 3, 6, 9, 12] });
  await job(ntd2, 'Gia sư Toán lớp 8 (QA LH)');
  await job(ntd1, 'Phát tờ rơi cuối tuần (QA LH)', { shifts: [16, 19] });
  await job(ntd1, 'Pha chế ca tối đầu tuần (QA LH)', { shifts: [2, 5, 8] });

  // Đơn ứng tuyển: lưu với createdAt/updatedAt tự đặt (tắt timestamps)
  const hist = (...steps) => steps.map(([status, d]) => ({ status, at: ago(d) }));
  const app = (student, j, status, d, extra = {}) => {
    const statusHistory = extra.statusHistory || hist(['PENDING', d]);
    return new Application({
      jobId: j._id, studentId: student._id, employerId: j.employerId,
      jobSnapshot: { title: j.title, companyName: j.companySnapshot.name, startDate: j.startDate },
      cvUrl: student.student.cv?.url || '/api/v1/files/cv/00000000000000000000000000000000.pdf',
      status, statusHistory, createdAt: ago(d), updatedAt: statusHistory.at(-1).at, ...extra,
    }).save({ timestamps: false });
  };

  // s_sv1: đúng 5 đơn ở 5 trạng thái (Đơn của tôi TC-12…15, Ứng tuyển TC-24, Đánh giá TC-14, Thông báo TC-11, Đổi mật khẩu TC-10/11, Hồ sơ TC-19)
  const sv1 = await sv('s_sv1', 'Nguyễn Văn Sơn');
  await app(sv1, jCaPhe, 'PENDING', 3);
  const accepted = await app(sv1, jThuNgan, 'ACCEPTED', 6, { _id: ID.appAcceptedSv1, employerNote: 'Có mặt 17h45 thứ Hai, mặc áo trắng', statusHistory: hist(['PENDING', 6], ['ACCEPTED', 4]) });
  await app(sv1, jGiaSu, 'REJECTED', 8, { rejectReason: 'Đã đủ số lượng', statusHistory: hist(['PENDING', 8], ['REJECTED', 7]) });
  await app(sv1, jToRoi, 'COMPLETED', 12, { finishedAt: ago(2), statusHistory: hist(['PENDING', 12], ['ACCEPTED', 11], ['COMPLETED', 2]) });
  await app(sv1, jTet, 'WITHDRAWN', 15, { statusHistory: hist(['PENDING', 15], ['WITHDRAWN', 14]) });
  await Notification.create({ userId: sv1._id, type: 'APPLICATION_ACCEPTED', title: 'Bạn đã được nhận!', message: `${jThuNgan.companySnapshot.name} đã nhận bạn cho "${jThuNgan.title}".`, link: `/student/applications/${accepted._id}` });

  // s_sv2: Ứng tuyển TC-02, Hồ sơ TC-15 (chưa có Canva, năm học trống), Báo cáo TC-12/13, Thông báo TC-12 (15 thông báo, 4 chưa đọc)
  const sv2 = await sv('s_sv2', 'Trần Thị Sa', { major: 'Kinh tế', yearOfStudy: undefined, skills: ['Excel'] });
  for (let i = 1; i <= 15; i++)
    await Notification.create({ userId: sv2._id, type: 'REVIEW_RECEIVED', title: `Thông báo thử ${i}`, message: `Nội dung thông báo số ${i}`, isRead: i > 4, createdAt: ago(i / 24) });

  // s_sv3: chỉ có họ tên + SĐT (25%), chưa có CV (Hồ sơ TC-17/18, Đổi mật khẩu TC-12, Việc đã lưu TC-14)
  await user('s_sv3@unishift.test', 'STUDENT', 'Lê Văn Ba', { phone: '0901234503', student: {} });
  await sv('s_sv4', 'Phạm Văn Tư'); // Ứng tuyển TC-23
  const sv5 = await sv('s_sv5', 'Hoàng Thị Năm'); // Đơn của tôi TC-16 (rút đơn)
  await app(sv5, jPhuBep, 'PENDING', 1);
  const sv6 = await sv('s_sv6', 'Đỗ Văn Sáu'); // Báo cáo TC-14: đã có báo cáo OPEN về tin cà phê
  await Report.create({ reporterId: sv6._id, targetType: 'JOB', targetId: jCaPhe._id, reason: 'SCAM' });
  await sv('s_sv7', 'Vũ Thị Bảy'); // Việc đã lưu TC-10
  await sv('s_sv8', 'Bùi Văn Tám', { savedJobIds: [jCaPhe._id, jKhaiTruong._id, jTet._id, jSuKien._id, jTraSua._id] }); // Việc đã lưu TC-11
  await sv('s_sv9', 'Ngô Thị Chín', { savedJobIds: [jCaPhe._id, jThuNgan._id] }); // Việc đã lưu TC-12
  await sv('s_sv10', 'Đinh Văn Mười'); // Ứng tuyển TC-18
  await sv('s_sv11', 'Lý Thị Mười Một'); // Đổi mật khẩu TC-09
  const sv12 = await sv('s_sv12', 'Mai Văn Mười Hai'); // Thông báo TC-13
  await Notification.create({ userId: sv12._id, type: 'VIOLATION', title: 'Xử lý vi phạm: Cảnh cáo', message: 'Tài khoản của bạn bị cảnh cáo do vi phạm quy định.' });
  await sv('s_sv13', 'Tô Thị Mười Ba', { skills: ['Excel', 'Canva', 'Word', 'PowerPoint', 'Tiếng Anh', 'Giao tiếp', 'Bán hàng', 'Pha chế', 'Phục vụ', 'Thu ngân', 'Lái xe máy', 'Photoshop cơ bản', 'Gia sư Toán', 'Nhập liệu', 'Chăm sóc khách hàng'] }); // Hồ sơ TC-16
  await sv('s_sv14', 'Chu Văn Mười Bốn'); // Lịch học TC-10
  await sv('s_sv15', 'Kiều Thị Mười Lăm'); // Lịch học TC-09
  await sv('s_sv16', 'La Văn Mười Sáu'); // Lịch học TC-13

  // Đánh giá NTD
  const sv17 = await sv('s_sv17', 'Tạ Thị Mười Bảy'); // TC-12: COMPLETED 2 ngày trước, chưa đánh giá
  await app(sv17, jCaPhe, 'COMPLETED', 10, { finishedAt: ago(2), statusHistory: hist(['PENDING', 10], ['ACCEPTED', 9], ['COMPLETED', 2]) });
  const sv18 = await sv('s_sv18', 'Văn Thị Mười Tám'); // TC-13
  await app(sv18, jThuNgan, 'COMPLETED', 10, { finishedAt: ago(1), statusHistory: hist(['PENDING', 10], ['ACCEPTED', 9], ['COMPLETED', 1]) });
  const sv19 = await sv('s_sv19', 'Hà Văn Mười Chín'); // TC-14: COMPLETED cách đây 14 ngày 1 giờ (quá hạn)
  await app(sv19, jSuKien, 'COMPLETED', 20, { finishedAt: new Date(Date.now() - 14 * DAY - 3600e3), statusHistory: hist(['PENDING', 20], ['ACCEPTED', 19], ['COMPLETED', 14.05]) });
  const sv20 = await sv('s_sv20', 'Lâm Thị Hai Mươi'); // TC-16: 1 đơn chưa đánh giá, 1 đơn đã đánh giá
  await app(sv20, jPhuBep, 'COMPLETED', 9, { finishedAt: ago(1), statusHistory: hist(['PENDING', 9], ['ACCEPTED', 8], ['COMPLETED', 1]) });
  const a20 = await app(sv20, jCaPhe, 'COMPLETED', 12, { finishedAt: ago(3), reviewedByStudent: true, statusHistory: hist(['PENDING', 12], ['ACCEPTED', 11], ['COMPLETED', 3]) });
  await Review.create({ applicationId: a20._id, jobId: jCaPhe._id, reviewerId: sv20._id, revieweeId: ntd1._id, reviewerRole: 'STUDENT', rating: 5, comment: 'Rất tốt' });

  // Số đơn trên tin (hiển thị "x ứng viên")
  for (const j of [jCaPhe, jThuNgan, jGiaSu, jToRoi, jTet, jPhuBep, jSuKien])
    await Job.updateOne({ _id: j._id }, { applicationCount: await Application.countDocuments({ jobId: j._id }) });
};
