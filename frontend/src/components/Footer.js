import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { homeOf } from '../utils/format';

// Bố cục theo footer headspace.com: khối tài khoản, nhóm link dạng accordion, thanh tối dưới cùng
const GROUPS = [
  ['Dành cho sinh viên', [['/jobs', 'Tìm việc'], ['/register', 'Tạo hồ sơ'], ['/student/saved-jobs', 'Việc đã lưu']]],
  ['Dành cho nhà tuyển dụng', [['/employer/jobs/new', 'Đăng tin'], ['/employer/premium', 'Gói Premium']]],
  ['Về JobSV', [[null, 'Chuyên đề tốt nghiệp 2'], [null, 'ĐH Văn Lang']]],
];

const Footer = () => {
  const { user } = useContext(AuthContext);
  return (
  <footer className="footer">
    <div className="foot-inner">
      <div className="foot-account">
        <div className="h-md">JobSV của bạn</div>
        {user ? <Link to={homeOf(user.role)} className="btn">Trang của tôi</Link> : <Link to="/login" className="btn">Đăng nhập</Link>}
      </div>
      {GROUPS.map(([title, links]) => (
        <details key={title}>
          <summary>{title}</summary>
          {links.map(([to, label]) => (to ? <Link key={label} to={to}>{label}</Link> : <span key={label}>{label}</span>))}
        </details>
      ))}
    </div>
    <div className="foot-bar">
      <div className="container">
        <span>© {new Date().getFullYear()} JobSV · Việc làm part-time an toàn, minh bạch cho sinh viên</span>
        <span>Đồ án Chuyên đề tốt nghiệp 2 – ĐH Văn Lang</span>
      </div>
    </div>
  </footer>
  );
};

export default Footer;
