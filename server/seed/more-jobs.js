// Thêm tin OPEN mới, rải đều 12 danh mục, không vượt hạn mức gói (BR-15). Chỉ thêm, không sửa tin cũ.
// node --env-file-if-exists=.env seed/more-jobs.js [số tin, mặc định 50]
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Category from '../src/models/Category.js';
import { TIERS, quotaOf } from '../src/modules/jobs/jobs.service.js';
import { DAY } from '../src/utils/http.js';

await mongoose.connect(process.env.MONGODB_URI);

const WANT = Number(process.argv[2]) || 50;
const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[rand(0, a.length - 1)];

// slug danh mục → [tiêu đề, loại lương, min, max, lịch, ca (ô 0–20, rỗng = linh hoạt)]
const T = {
  'phuc-vu-nha-hang-quan-ca-phe': [
    ['Phục vụ quán cà phê ca tối', 'HOURLY', 25000, 30000, 'Ca tối 18h–22h', [2, 5, 8, 11, 14]],
    ['Pha chế part-time cuối tuần', 'HOURLY', 28000, 35000, 'Thứ 7, CN', [15, 16, 18, 19]],
    ['Nhân viên phục vụ nhà hàng lẩu', 'HOURLY', 25000, 28000, 'Ca chiều – tối', [1, 2, 4, 5, 7, 8]],
    ['Phụ bếp quán ăn sáng', 'HOURLY', 22000, 27000, 'Sáng 6h–10h', [0, 3, 6, 9, 12]],
  ],
  'ban-hang-thu-ngan': [
    ['Thu ngân cửa hàng tiện lợi', 'HOURLY', 24000, 28000, 'Xoay ca 4 tiếng', [0, 1, 2, 3, 4, 5]],
    ['Nhân viên bán hàng thời trang', 'HOURLY', 25000, 30000, 'Ca chiều', [1, 4, 7, 10, 13]],
    ['Bán hàng nhà sách cuối tuần', 'DAILY', 200000, 250000, 'Thứ 7, CN cả ngày', [15, 16, 18, 19]],
    ['Tư vấn bán điện thoại', 'HOURLY', 27000, 35000, 'Ca tối', [2, 5, 8, 11, 14, 17]],
  ],
  'gia-su-tro-giang': [
    ['Gia sư Toán lớp 9', 'HOURLY', 120000, 180000, '3 buổi/tuần, tối', [2, 8, 14]],
    ['Trợ giảng tiếng Anh trung tâm', 'HOURLY', 50000, 70000, 'Tối T2–T6', [2, 5, 8, 11, 14]],
    ['Gia sư Hóa luyện thi', 'HOURLY', 150000, 200000, '2 buổi/tuần', [5, 11]],
    ['Trợ giảng lập trình cho trẻ em', 'HOURLY', 60000, 80000, 'Sáng thứ 7, CN', [15, 18]],
  ],
  'thiet-ke-do-hoa': [
    ['Thiết kế banner Facebook', 'PROJECT', 1500000, 3000000, 'Online, 2 tuần', []],
    ['Thiết kế menu cho quán ăn', 'PROJECT', 800000, 1500000, 'Online, 1 tuần', []],
    ['Cộng tác viên thiết kế Canva', 'PROJECT', 2000000, 4000000, 'Online, 1 tháng', []],
    ['Thiết kế bộ nhận diện thương hiệu nhỏ', 'PROJECT', 3000000, 6000000, 'Online, 3 tuần', []],
  ],
  'marketing-mang-xa-hoi': [
    ['Cộng tác viên quản lý fanpage', 'PROJECT', 2000000, 3500000, 'Online, 1 tháng', []],
    ['Quay và đăng video TikTok', 'PROJECT', 2500000, 5000000, 'Online, 1 tháng', []],
    ['Cộng tác viên seeding hội nhóm', 'HOURLY', 25000, 30000, 'Linh hoạt', []],
    ['Trợ lý marketing part-time', 'HOURLY', 30000, 40000, 'Chiều T2–T6', [1, 4, 7, 10, 13]],
  ],
  'chup-anh-quay-dung-video': [
    ['Chụp ảnh sản phẩm cho shop online', 'PROJECT', 1500000, 3000000, '2–3 buổi', []],
    ['Dựng video ngắn cho kênh YouTube', 'PROJECT', 2000000, 4000000, 'Online, 1 tháng', []],
    ['Quay phóng sự sự kiện', 'DAILY', 500000, 800000, 'Cuối tuần', [15, 16, 18, 19]],
  ],
  'cham-soc-khach-hang': [
    ['Trực chat chăm sóc khách hàng', 'HOURLY', 25000, 30000, 'Ca tối, online', [2, 5, 8, 11, 14, 17, 20]],
    ['Tổng đài viên part-time', 'HOURLY', 28000, 35000, 'Ca sáng/chiều', [0, 1, 3, 4, 6, 7]],
    ['Nhân viên lễ tân khách sạn ca tối', 'HOURLY', 27000, 32000, 'Tối 18h–22h', [2, 5, 8, 11, 14]],
  ],
  'lap-trinh-it': [
    ['Lập trình viên React part-time', 'HOURLY', 60000, 100000, 'Linh hoạt, remote', []],
    ['Làm landing page cho cửa hàng', 'PROJECT', 3000000, 6000000, 'Online, 2 tuần', []],
    ['Tester kiểm thử ứng dụng di động', 'HOURLY', 40000, 60000, 'Chiều T2–T6', [1, 4, 7, 10, 13]],
    ['Hỗ trợ kỹ thuật phòng máy', 'HOURLY', 30000, 40000, 'Ca sáng', [0, 3, 6, 9, 12]],
  ],
  'nhap-lieu-van-phong': [
    ['Nhập liệu đơn hàng online', 'HOURLY', 22000, 27000, 'Linh hoạt, tại nhà', []],
    ['Trợ lý hành chính văn phòng', 'HOURLY', 25000, 30000, 'Sáng T2–T6', [0, 3, 6, 9, 12]],
    ['Sắp xếp hồ sơ, scan tài liệu', 'DAILY', 180000, 220000, '1 tuần', [0, 1, 3, 4, 6, 7]],
  ],
  'su-kien-pg-pb': [
    ['PG giới thiệu sản phẩm siêu thị', 'DAILY', 300000, 400000, 'Cuối tuần', [15, 16, 18, 19]],
    ['Nhân viên hỗ trợ hội chợ việc làm', 'DAILY', 250000, 350000, '2 ngày', [15, 16, 18, 19]],
    ['MC hoạt náo sự kiện khai trương', 'DAILY', 500000, 900000, '1 ngày', [16]],
    ['Phát tờ rơi khu trường học', 'HOURLY', 25000, 30000, 'Sáng', [0, 3, 6]],
  ],
  'giao-hang-kho-van': [
    ['Giao hàng nội thành bằng xe máy', 'DAILY', 250000, 350000, 'Linh hoạt', []],
    ['Đóng gói hàng tại kho', 'HOURLY', 23000, 27000, 'Ca chiều – tối', [1, 2, 4, 5, 7, 8]],
    ['Kiểm kho cuối tháng', 'DAILY', 220000, 280000, '3 ngày', [15, 16, 18, 19]],
  ],
  'dich-thuat-viet-noi-dung': [
    ['Dịch tài liệu Anh – Việt', 'PROJECT', 1500000, 3000000, 'Online, 2 tuần', []],
    ['Viết bài chuẩn SEO cho website', 'PROJECT', 1000000, 2500000, 'Online, 10 bài', []],
    ['Phụ đề video tiếng Anh', 'PROJECT', 1200000, 2000000, 'Online, 1 tuần', []],
    ['Biên dịch tiếng Hàn part-time', 'HOURLY', 60000, 90000, 'Linh hoạt', []],
  ],
};

const PLACES = [
  ['TP. Hồ Chí Minh', ['Quận 1', 'Quận 3', 'Bình Thạnh', 'Gò Vấp', 'Phú Nhuận', 'Thủ Đức', 'Tân Bình']],
  ['Hà Nội', ['Cầu Giấy', 'Đống Đa', 'Hai Bà Trưng', 'Thanh Xuân']],
  ['Đà Nẵng', ['Hải Châu', 'Thanh Khê', 'Sơn Trà']],
  ['Cần Thơ', ['Ninh Kiều', 'Cái Răng']],
];
const STREETS = ['Nguyễn Huệ', 'Lê Lợi', 'Trần Hưng Đạo', 'Hai Bà Trưng', 'Nguyễn Trãi', 'Lý Thường Kiệt', 'Võ Văn Tần'];

// Danh sách chỗ trống theo hạn mức: mỗi nhà tuyển dụng xuất hiện (limit - used) lần
const seats = [];
for (const u of await User.find({ role: 'EMPLOYER', status: 'ACTIVE', 'employer.company.name': { $exists: true } })) {
  const { used, limit } = await quotaOf(u);
  for (let i = used; i < limit; i++) seats.push(u);
}
seats.sort(() => Math.random() - 0.5);

const cats = await Category.find({ slug: { $in: Object.keys(T) } });
const n = Math.min(WANT, seats.length);
for (let i = 0; i < n; i++) {
  const u = seats[i];
  const cat = cats[i % cats.length];
  const [title, salaryType, min, max, schedule, shifts] = pick(T[cat.slug]);
  const [city, districts] = rand(1, 10) <= 6 ? PLACES[0] : pick(PLACES);
  const company = u.employer.company;
  const startDate = new Date(Date.now() + rand(1, 14) * DAY);
  await Job.create({
    employerId: u._id,
    companySnapshot: { name: company.name, logoUrl: company.logoUrl, city: company.city },
    categoryId: cat._id,
    title,
    description: `${company.name} cần tuyển ${title.toLowerCase()}. Công việc phù hợp sinh viên muốn kiếm thêm thu nhập, được hướng dẫn từ đầu, môi trường trẻ trung, thân thiện.`,
    requirements: 'Sinh viên năm 1–4, đúng giờ, trung thực, có tinh thần học hỏi. Có kinh nghiệm là lợi thế.',
    city,
    district: pick(districts),
    address: `${rand(1, 300)} ${pick(STREETS)}`,
    salaryType,
    salaryMin: min,
    salaryMax: max,
    schedule,
    shifts,
    startDate,
    endDate: new Date(+startDate + rand(7, 60) * DAY),
    slots: rand(1, 6),
    viewCount: rand(5, 150),
    expiresAt: new Date(Date.now() + rand(7, u.isPremium() ? TIERS.premium.days : TIERS.free.days) * DAY),
    featuredUntil: u.isPremium() ? u.employer.premiumUntil : undefined,
  });
}

console.log(`+ ${n}/${WANT} tin mới (hạn mức còn ${seats.length} chỗ)`);
await mongoose.disconnect();
