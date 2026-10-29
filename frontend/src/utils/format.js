export const money = (n) => (n || n === 0 ? `${Number(n).toLocaleString('vi-VN')}đ` : '');
export const shortMoney = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}tr` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`);
export const date = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');
// Ngày theo giờ máy người dùng (toISOString là giờ UTC, 0h–7h sáng ở VN sẽ ra ngày hôm qua)
export const toInputDate = (d) => (d ? new Date(d).toLocaleDateString('sv-SE') : '');

export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 30 * 86400) return `${Math.floor(s / 86400)} ngày trước`;
  return date(d);
};

export const SALARY_TYPE = { HOURLY: 'giờ', DAILY: 'ngày', PROJECT: 'dự án' };
export const salary = (j) =>
  `${j.salaryMin === j.salaryMax ? shortMoney(j.salaryMin) : `${shortMoney(j.salaryMin)}–${shortMoney(j.salaryMax)}`}/${SALARY_TYPE[j.salaryType]}`;

export const JOB_STATUS = {
  OPEN: ['Đang tuyển', 'chip-green'], FILLED: ['Đã đủ người', 'chip-blue'], CLOSED: ['Đã đóng', ''],
  COMPLETED: ['Hoàn thành', 'chip-purple'], HIDDEN: ['Bị ẩn', 'chip-red'], EXPIRED: ['Hết hạn', 'chip-yellow'],
};
export const APP_STATUS = {
  PENDING: ['Đang chờ', 'chip-yellow'], ACCEPTED: ['Được nhận', 'chip-green'], REJECTED: ['Bị từ chối', 'chip-red'],
  COMPLETED: ['Hoàn thành', 'chip-purple'], NOT_COMPLETED: ['Không hoàn thành', 'chip-red'],
};
export const ROLE = { STUDENT: 'Sinh viên', EMPLOYER: 'Nhà tuyển dụng', ADMIN: 'Quản trị viên' };
export const jobStatusOf = (j) => (j.status === 'OPEN' && new Date(j.expiresAt) < new Date() ? 'EXPIRED' : j.status);
export const homeOf = (role) => ({ STUDENT: '/student', EMPLOYER: '/employer', ADMIN: '/admin' })[role] || '/';
export const WASHES = ['wash-powder', 'wash-lavender', 'wash-mint', 'wash-solar'];
// Nền minh họa (Scene) và ô số liệu: tông pastel nhạt quanh màu xanh thương hiệu
export const PANEL_BG = ['#e3f5ea', '#e6effd', '#fff1d6', '#fde6ee', '#ece7fd', '#e2f4f4'];

// Ca làm theo buổi: ô = ngày * 3 + buổi (ngày 0 = T2 … 6 = CN; buổi 0 sáng, 1 chiều, 2 tối), giống Job.shifts ở backend
export const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const DAY_NAMES = ['thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7', 'chủ nhật'];
export const PERIODS = ['Sáng', 'Chiều', 'Tối'];
// Ca làm tách theo buổi: [{ period: 0, label: 'Sáng', days: 'T2, T4, T6' }, …]; ngày liền nhau viết gọn bằng gạch nối
export const shiftParts = (shifts = []) => PERIODS.map((label, period) => {
  const days = shifts.filter((i) => i % 3 === period).map((i) => Math.floor(i / 3));
  if (!days.length) return null;
  const runs = [];
  for (const d of days) {
    const last = runs[runs.length - 1];
    if (last && d === last[1] + 1) last[1] = d; else runs.push([d, d]);
  }
  return { period, label, days: runs.map(([a, b]) => (b - a >= 2 ? `${DAYS[a]}–${DAYS[b]}` : b > a ? `${DAYS[a]}, ${DAYS[b]}` : DAYS[a])).join(', ') };
}).filter(Boolean);
// [2, 5, 8, 11, 14, 17, 18] → "Tối T2–T7, Sáng CN"
export const describeShifts = (shifts = []) => shiftParts(shifts).map((p) => `${p.label} ${p.days}`).join('; ');
