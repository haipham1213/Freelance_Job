import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Check, ShieldAlert } from 'lucide-react';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import withRouter from '../utils/withRouter';

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

// Tuần mẫu trong dải đầu footer (chỉ trang chủ): cùng ngôn ngữ với lưới "Tuần của bạn" ở hero, ô xanh lá = ca làm. Chỉ để trang trí nên aria-hidden
const MINI = [['Sáng', 'xx.x..'], ['Chiều', '.x..xx'], ['Tối', 'x.x...']];
const MINI_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const PROMISES = ['Không phí, không đặt cọc', 'Liên hệ chỉ mở khi được nhận', 'Lương ghi rõ trên từng tin'];
// 5 quận nhiều tin nhất, ghép từ /jobs/locations (đã cache CDN)
const topAreas = (locations) => locations
  .flatMap((l) => l.districts.map((d) => ({ city: l.city, district: d, n: l.counts?.[d] || 0 })))
  .sort((a, b) => b.n - a.n).slice(0, 5);

const AUTH_PAGES = ['/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

class Footer extends Component {
  state = { areas: [] };

  componentDidMount() { this.loadAreas(); }
  componentDidUpdate() { this.loadAreas(); }

  // Chỉ trang chủ có cột "Gần trường"; tải một lần
  loadAreas = () => {
    if (this.props.location.pathname !== '/' || this.loaded) return;
    this.loaded = true;
    api.get('/jobs/locations').then((r) => this.setState({ areas: topAreas(r.data) })).catch(() => { this.loaded = false; });
  };

  render() {
    const home = this.props.location.pathname === '/';
    const { areas } = this.state;
    return (
      <AuthContext.Consumer>
        {({ user }) => {
          const role = user?.role || 'GUEST';
          const groups = [STUDENT[role], EMPLOYER[role], SUPPORT].filter(Boolean);
          // Trang xác thực: footer gọn một dòng để người dùng tập trung vào biểu mẫu
          if (AUTH_PAGES.includes(this.props.location.pathname)) return (
            <footer className="footer foot-mini">
              <div className="container foot-bar-in">
                <span>© {new Date().getFullYear()} UniShift</span>
                <nav className="foot-mini-links" aria-label="Pháp lý"><Link to="/dieu-khoan">Điều khoản</Link><Link to="/quyen-rieng-tu">Quyền riêng tư</Link><Link to="/#hoi-dap">Hỏi đáp</Link></nav>
              </div>
            </footer>
          );
          return (
            <footer className="footer">
              {home && (
                <div className="container foot-hero">
                  <div>
                    <p className="foot-pitch">Học xong, đi làm.<br />Không trùng giờ.</p>
                    <Link to="/jobs#lich-hoc" className="btn foot-cta">Tìm ca hợp lịch</Link>
                  </div>
                  <div className="foot-week" aria-hidden="true">
                    <span />
                    {MINI_DAYS.map((d) => <span key={d} className="foot-day">{d}</span>)}
                    {MINI.map(([label, cells]) => (
                      <React.Fragment key={label}>
                        <span className="foot-period">{label}</span>
                        {[...cells].map((c, i) => <span key={i} className={`foot-cell${c === 'x' ? ' on' : ''}`} />)}
                      </React.Fragment>
                    ))}
                  </div>
                  <ul className="foot-promises">
                    {PROMISES.map((p) => <li key={p}><Check size={16} aria-hidden="true" />{p}</li>)}
                  </ul>
                </div>
              )}
              <div className={`container foot-grid ${home && areas.length ? 'has-areas' : ''}`}>
                <div className="foot-brand">
                  <Link to="/" className="logo" aria-label="UniShift, về trang chủ"><span className="logo-mark" aria-hidden="true" /><span>Uni<span className="logo-shift">Shift</span></span></Link>
                  <p className="muted small">Việc làm part-time an toàn, minh bạch cho sinh viên. Lương và ca làm công khai trước khi ứng tuyển.</p>
                  <Link to="/dieu-khoan#bao-cao" className="foot-report"><ShieldAlert size={16} aria-hidden="true" />Báo cáo lừa đảo</Link>
                </div>
                {groups.map(([title, links]) => (
                  <nav key={title} className="foot-col" aria-label={title}>
                    <strong>{title}</strong>
                    {links.map(([to, label]) => <Link key={label} to={to}>{label}</Link>)}
                  </nav>
                ))}
                {home && areas.length > 0 && (
                  <nav className="foot-col" aria-label="Gần trường">
                    <strong>Gần trường</strong>
                    {areas.map((a) => <Link key={a.city + a.district} to={`/jobs?${new URLSearchParams({ city: a.city, district: a.district })}`}>{a.district}{a.n > 0 && <span className="foot-n" aria-label={`${a.n} tin`}>{a.n}</span>}</Link>)}
                  </nav>
                )}
              </div>
              {home && <div className="foot-mark" aria-hidden="true"><span>UniShift</span></div>}
              <div className="foot-bar">
                {/* Giữ nguyên câu đồ án; chủ dự án quyết định có bỏ khỏi footer công khai không */}
                <div className="container foot-bar-in">
                  <span>© {new Date().getFullYear()} UniShift. <small>Đồ án Chuyên đề tốt nghiệp 2, Trường ĐH Văn Lang.</small></span>
                  <button type="button" className="foot-top" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>Lên đầu trang<ArrowUp size={16} aria-hidden="true" /></button>
                </div>
              </div>
            </footer>
          );
        }}
      </AuthContext.Consumer>
    );
  }
}

export default withRouter(Footer);
