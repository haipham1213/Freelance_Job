export const money = (n) => (n || n === 0 ? `${Number(n).toLocaleString('vi-VN')}đ` : '');
export const shortMoney = (n) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}tr` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`);
export const date = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '');
export const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');

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
  WITHDRAWN: ['Đã rút', ''], COMPLETED: ['Hoàn thành', 'chip-purple'], NOT_COMPLETED: ['Không hoàn thành', 'chip-red'],
};
export const PAY_STATUS = {
  PENDING: ['Đang xử lý', 'chip-yellow'], SUCCESS: ['Thành công', 'chip-green'], FAILED: ['Thất bại', 'chip-red'], EXPIRED: ['Hết hạn', ''],
};
export const REPORT_REASONS = {
  SCAM: 'Lừa đảo / thu phí', WRONG_INFO: 'Thông tin sai', HARASSMENT: 'Quấy rối', UNPAID_OR_ABSENT: 'Không trả lương / bỏ việc', OTHER: 'Khác',
};
export const ROLE = { STUDENT: 'Sinh viên', EMPLOYER: 'Nhà tuyển dụng', ADMIN: 'Quản trị viên' };
export const jobStatusOf = (j) => (j.status === 'OPEN' && new Date(j.expiresAt) < new Date() ? 'EXPIRED' : j.status);
export const homeOf = (role) => ({ STUDENT: '/student', EMPLOYER: '/employer', ADMIN: '/admin' })[role] || '/';
export const WASHES = ['wash-powder', 'wash-lavender', 'wash-mint', 'wash-solar'];
// Màu khối nổi bật theo chủ đề, như bảng chọn của headspace.com
export const PANEL_BG = ['#ffd55c', '#a8c8ff', '#f2a7cb', '#f9a24b', '#a6e3bf', '#cdb6ff'];
