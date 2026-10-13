import React from 'react';
import { Link } from 'react-router-dom';

// Footer kiểu job board: logo + mô tả, các cột link, dòng bản quyền
const GROUPS = [
  ['Dành cho sinh viên', [['/jobs', 'Tìm việc'], ['/register', 'Tạo hồ sơ'], ['/student/saved-jobs', 'Việc đã lưu']]],
  ['Dành cho nhà tuyển dụng', [['/register?role=EMPLOYER', 'Đăng ký tuyển dụng'], ['/employer/jobs/new', 'Đăng tin'], ['/employer/premium', 'Gói Premium']]],
  ['Về JobSV', [[null, 'Chuyên đề tốt nghiệp 2'], [null, 'Trường ĐH Văn Lang']]],
];

const Footer = () => (
  <footer className="footer">
    <div className="container foot-grid">
      <div className="foot-brand">
        <Link to="/" className="logo"><span className="logo-mark" />jobsv</Link>
        <p className="muted small">Việc làm part-time an toàn, minh bạch cho sinh viên. Lương và ca làm công khai trước khi ứng tuyển.</p>
      </div>
      {GROUPS.map(([title, links]) => (
        <nav key={title} className="foot-col" aria-label={title}>
          <strong>{title}</strong>
          {links.map(([to, label]) => (to ? <Link key={label} to={to}>{label}</Link> : <span key={label}>{label}</span>))}
        </nav>
      ))}
    </div>
    <div className="foot-bar">
      <div className="container">© {new Date().getFullYear()} JobSV. Đồ án Chuyên đề tốt nghiệp 2, Trường ĐH Văn Lang.</div>
    </div>
  </footer>
);

export default Footer;
