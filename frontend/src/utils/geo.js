// Bản đồ việc gần trường (FR-SRC-05): danh sách trường làm điểm xuất phát, tính khoảng cách, lưu điểm xuất phát đã chọn.
// Tọa độ lấy từ OpenStreetMap (Nominatim) ngày 14/11/2026, là cổng / tòa chính của từng cơ sở. Trường nhiều cơ sở thì mỗi cơ sở một dòng.
// [id, tên, thành phố, vĩ độ, kinh độ]
const RAW = [
  ['vlu', 'ĐH Văn Lang (cơ sở chính, Bình Thạnh)', 'TP.HCM', 10.82848, 106.70303],
  ['hcmut1', 'ĐH Bách khoa TP.HCM (cơ sở Lý Thường Kiệt)', 'TP.HCM', 10.77335, 106.65963],
  ['hcmut2', 'ĐH Bách khoa TP.HCM (cơ sở Dĩ An)', 'TP.HCM', 10.88111, 106.80604],
  ['hcmus1', 'ĐH Khoa học Tự nhiên TP.HCM (cơ sở Nguyễn Văn Cừ)', 'TP.HCM', 10.76262, 106.68202],
  ['hcmus2', 'ĐH Khoa học Tự nhiên TP.HCM (cơ sở Linh Trung)', 'TP.HCM', 10.87623, 106.79685],
  ['ussh1', 'ĐH KHXH&NV TP.HCM (cơ sở Đinh Tiên Hoàng)', 'TP.HCM', 10.78602, 106.70305],
  ['ussh2', 'ĐH KHXH&NV TP.HCM (cơ sở Linh Trung)', 'TP.HCM', 10.87103, 106.80158],
  ['ueh', 'ĐH Kinh tế TP.HCM – UEH (cơ sở Nguyễn Đình Chiểu)', 'TP.HCM', 10.78289, 106.6942],
  ['uel', 'ĐH Kinh tế – Luật (UEL)', 'TP.HCM', 10.87134, 106.77852],
  ['uit', 'ĐH Công nghệ Thông tin (UIT)', 'TP.HCM', 10.86981, 106.80337],
  ['hcmiu', 'ĐH Quốc tế (ĐHQG-HCM)', 'TP.HCM', 10.87751, 106.80153],
  ['hcmue', 'ĐH Sư phạm TP.HCM', 'TP.HCM', 10.76195, 106.6818],
  ['hcmute', 'ĐH Sư phạm Kỹ thuật TP.HCM', 'TP.HCM', 10.85279, 106.77256],
  ['tdtu', 'ĐH Tôn Đức Thắng', 'TP.HCM', 10.73201, 106.69847],
  ['hutech', 'ĐH Công nghệ TP.HCM – HUTECH (cơ sở Điện Biên Phủ)', 'TP.HCM', 10.80125, 106.71481],
  ['hsu', 'ĐH Hoa Sen', 'TP.HCM', 10.77032, 106.69244],
  ['iuh', 'ĐH Công nghiệp TP.HCM (IUH)', 'TP.HCM', 10.82202, 106.68757],
  ['nlu', 'ĐH Nông Lâm TP.HCM', 'TP.HCM', 10.87233, 106.78898],
  ['ftu2', 'ĐH Ngoại thương (cơ sở II, Bình Thạnh)', 'TP.HCM', 10.8064, 106.71387],
  ['hcmulaw', 'ĐH Luật TP.HCM (cơ sở Nguyễn Tất Thành)', 'TP.HCM', 10.76723, 106.70605],
  ['ump', 'ĐH Y Dược TP.HCM', 'TP.HCM', 10.75522, 106.66457],
  ['ou', 'ĐH Mở TP.HCM (cơ sở Võ Văn Tần)', 'TP.HCM', 10.77616, 106.69036],
  ['hub', 'ĐH Ngân hàng TP.HCM (cơ sở Thủ Đức)', 'TP.HCM', 10.8572, 106.7622],
  ['ufm', 'ĐH Tài chính – Marketing (cơ sở Thủ Đức)', 'TP.HCM', 10.81487, 106.81018],
  ['rmit', 'ĐH RMIT (Nam Sài Gòn)', 'TP.HCM', 10.72976, 106.69401],
  ['fpthcm', 'ĐH FPT TP.HCM', 'TP.HCM', 10.84142, 106.81007],
  ['ntt', 'ĐH Nguyễn Tất Thành (cơ sở Quận 4)', 'TP.HCM', 10.76114, 106.70952],
  ['sgu', 'ĐH Sài Gòn', 'TP.HCM', 10.7597, 106.68176],
  ['uth', 'ĐH Giao thông Vận tải TP.HCM', 'TP.HCM', 10.80486, 106.71676],
  ['uah', 'ĐH Kiến trúc TP.HCM', 'TP.HCM', 10.78242, 106.69444],
  ['huflit', 'ĐH Ngoại ngữ – Tin học (HUFLIT, Sư Vạn Hạnh)', 'TP.HCM', 10.7759, 106.66751],
  ['huit', 'ĐH Công Thương TP.HCM', 'TP.HCM', 10.80704, 106.6287],
  ['hust', 'ĐH Bách khoa Hà Nội', 'Hà Nội', 21.00553, 105.84359],
  ['vnu', 'ĐH Quốc gia Hà Nội (Xuân Thủy)', 'Hà Nội', 21.03881, 105.78189],
  ['neu', 'ĐH Kinh tế Quốc dân', 'Hà Nội', 20.99975, 105.8435],
  ['ftu', 'ĐH Ngoại thương (Hà Nội)', 'Hà Nội', 21.0225, 105.80515],
  ['tmu', 'ĐH Thương mại', 'Hà Nội', 21.03647, 105.77516],
  ['hanu', 'ĐH Hà Nội', 'Hà Nội', 20.98929, 105.79525],
  ['huce', 'ĐH Xây dựng Hà Nội', 'Hà Nội', 21.00323, 105.84327],
  ['utc', 'ĐH Giao thông Vận tải (Hà Nội)', 'Hà Nội', 21.0276, 105.80265],
  ['hnue', 'ĐH Sư phạm Hà Nội', 'Hà Nội', 21.039, 105.78426],
  ['hvnh', 'Học viện Ngân hàng', 'Hà Nội', 21.00951, 105.82906],
  ['aof', 'Học viện Tài chính', 'Hà Nội', 21.07969, 105.77964],
  ['tlu', 'ĐH Thủy lợi', 'Hà Nội', 21.00699, 105.8251],
  ['hlu', 'ĐH Luật Hà Nội', 'Hà Nội', 21.02124, 105.81003],
  ['hmu', 'ĐH Y Hà Nội', 'Hà Nội', 21.00223, 105.83132],
  ['ptit', 'Học viện Công nghệ Bưu chính Viễn thông (Hà Đông)', 'Hà Nội', 20.98052, 105.788],
  ['fpthn', 'ĐH FPT Hà Nội (Hòa Lạc)', 'Hà Nội', 21.01353, 105.52526],
  ['dut', 'ĐH Bách khoa Đà Nẵng', 'Đà Nẵng', 16.07502, 108.15272],
  ['due', 'ĐH Kinh tế Đà Nẵng', 'Đà Nẵng', 16.04752, 108.23979],
  ['dtu', 'ĐH Duy Tân', 'Đà Nẵng', 16.06006, 108.20967],
  ['ued', 'ĐH Sư phạm Đà Nẵng', 'Đà Nẵng', 16.06165, 108.15912],
  ['ctu', 'ĐH Cần Thơ', 'Cần Thơ', 10.03215, 105.76831],
];
export const SCHOOLS = RAW.map(([id, name, city, lat, lng]) => ({ id, name, city, lat, lng }));
export const schoolById = (id) => SCHOOLS.find((s) => s.id === id);

const fold = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase()
  .replace(/\b(truong|dai hoc|dh|hoc vien|tp\.?\s?hcm|thanh pho ho chi minh|co so[^)]*)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
// Trường ghi trong hồ sơ (chữ tự do) → cơ sở đầu tiên trong danh sách có tên khớp: "Đại học Văn Lang" khớp "ĐH Văn Lang (cơ sở chính…)"
export const schoolByName = (text) => {
  const t = fold(text);
  if (t.length < 3) return undefined;
  // Khớp đúng tên trước, rồi tên trong danh sách dài hơn ("kinh te" → UEH), rồi tên hồ sơ nằm trong tên danh sách ("hutech")
  const names = SCHOOLS.map((s) => [s, fold(s.name)]);
  return (names.find(([, n]) => n === t) || names.find(([, n]) => n.startsWith(`${t} `)) || names.find(([, n]) => ` ${n} `.includes(` ${t} `)))?.[0];
};

// Tâm bản đồ mặc định theo thành phố (form đăng tin, bản đồ chưa có ghim)
export const CITY_CENTER = { 'TP.HCM': [10.7769, 106.7009], 'Hà Nội': [21.0285, 105.8542], 'Đà Nẵng': [16.0544, 108.2022], 'Cần Thơ': [10.0452, 105.7469] };
export const cityCenter = (city) => {
  const t = fold(city);
  const key = /ha noi/.test(t) ? 'Hà Nội' : /da nang/.test(t) ? 'Đà Nẵng' : /can tho/.test(t) ? 'Cần Thơ' : 'TP.HCM';
  return CITY_CENTER[key];
};

// Job.location (GeoJSON [kinh độ, vĩ độ]) → { lat, lng }
export const pointOf = (job) => {
  const c = job?.location?.coordinates;
  return c?.length === 2 ? { lat: c[1], lng: c[0] } : null;
};

// Khoảng cách đường chim bay (mét), công thức haversine
export const distanceM = (a, b) => {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
};
// 850 → "850 m"; 1234 → "1,2 km"; 12345 → "12 km"
export const fmtDistance = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('vi-VN', { maximumFractionDigits: m < 10000 ? 1 : 0 })} km`);

export const RADII = [1, 3, 5, 10];

// Điểm xuất phát đang lọc, đọc từ URL: school=<id> (trường trong danh sách) hoặc near=<vĩ độ>,<kinh độ> (vị trí hiện tại / điểm tự chọn)
export const originOf = ({ school, near }) => {
  const s = school && schoolById(school);
  if (s) return { lat: s.lat, lng: s.lng, label: s.name, school: s.id };
  const [lat, lng] = String(near || '').split(',').map(Number);
  return near && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng, label: 'vị trí của bạn' } : null;
};

// Điểm xuất phát chọn lần gần nhất, lưu trên trình duyệt để trang chi tiết việc ghi "Cách … km" (không gửi lên máy chủ để lưu)
const ORIGIN_KEY = 'jobsv.origin';
export const readOrigin = () => { try { return JSON.parse(localStorage.getItem(ORIGIN_KEY)); } catch { return null; } };
export const writeOrigin = (o) => { try { if (o) localStorage.setItem(ORIGIN_KEY, JSON.stringify(o)); else localStorage.removeItem(ORIGIN_KEY); } catch { /* trình duyệt chặn lưu trữ */ } };
