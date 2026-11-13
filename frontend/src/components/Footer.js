import React from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

// Footer kiểu job board: logo + mô tả, các cột link, dòng bản quyền.
// Cột theo vai trò: khách thấy Đăng ký/Đăng nhập thay vì link bị chặn; sinh viên không thấy link tuyển dụng và ngược lại
const STUDENT = {
  GUEST: ['Dành cho sinh viên', [['/jobs', 'Tìm việc'], ['/register', 'Tạo hồ sơ'], ['/login', 'Đăng nhập']]],
  STUDENT: ['Dành cho sinh viên', [['/jobs', 'Tìm việc'], ['/student/profile', 'Hồ sơ & CV'], ['/student/saved-jobs', 'Việc đã lưu']]],
};
const EMPLOYER = {
  GUEST: ['Dành cho nhà tuyển dụng', [['/register?role=EMPLOYER', 'Đăng ký tuyển dụng']]],
  EMPLOYER: ['Dành cho nhà tuyển dụng', [['/employer/jobs/new', 'Đăng tin'], ['/employer/jobs', 'Tin tuyển dụng'], ['/employer/premium', 'Gói Premium']]],
};
const SUPPORT = ['Hỗ trợ', [['/#hoi-dap', 'Hỏi đáp'], ['/dieu-khoan#bao-cao', 'Báo cáo lừa đảo'], ['/dieu-khoan', 'Điều khoản sử dụng'], ['/quyen-rieng-tu', 'Quyền riêng tư']]];

const Footer = () => (
  <AuthContext.Consumer>
    {({ user }) => {
      const role = user?.role || 'GUEST';
      const groups = [STUDENT[role], EMPLOYER[role], SUPPORT].filter(Boolean);
      return (
        <footer className="footer">
          <div className="container foot-grid">
            <div className="foot-brand">
              <Link to="/" className="logo" aria-label="UniShift, về trang chủ"><span className="logo-mark" aria-hidden="true" /><span>Uni<span className="logo-shift">Shift</span></span></Link>
              <p className="muted small">Việc làm part-time an toàn, minh bạch cho sinh viên. Lương và ca làm công khai trước khi ứng tuyển.</p>
            </div>
            {groups.map(([title, links]) => (
              <nav key={title} className="foot-col" aria-label={title}>
                <strong>{title}</strong>
                {links.map(([to, label]) => <Link key={label} to={to}>{label}</Link>)}
              </nav>
            ))}
          </div>
          <div className="foot-bar">
            {/* Giữ nguyên câu đồ án; chủ dự án quyết định có bỏ khỏi footer công khai không */}
            <div className="container">© {new Date().getFullYear()} UniShift. <small>Đồ án Chuyên đề tốt nghiệp 2, Trường ĐH Văn Lang.</small></div>
          </div>
        </footer>
      );
    }}
  </AuthContext.Consumer>
);

export default Footer;
