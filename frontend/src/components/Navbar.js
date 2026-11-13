import React, { Component } from 'react';
import { Bell as BellIcon, ChevronRight, Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import { Avatar, ErrorState } from './ui';
import { homeOf, timeAgo, ROLE } from '../utils/format';
import withRouter from '../utils/withRouter';

const LINKS = {
  GUEST: [['/', 'Trang chủ'], ['/jobs', 'Tìm việc']],
  STUDENT: [['/', 'Trang chủ'], ['/jobs', 'Tìm việc'], ['/student/applications', 'Đơn của tôi'], ['/student/saved-jobs', 'Đã lưu']],
  EMPLOYER: [['/', 'Trang chủ'], ['/employer', 'Tổng quan'], ['/employer/jobs', 'Tin tuyển dụng'], ['/employer/jobs/new', 'Đăng tin'], ['/employer/premium', 'Premium']],
};

// FR-NOT-01: hỏi số chưa đọc mỗi 30 giây (AS-15, không WebSocket)
class Bell extends Component {
  state = { count: 0, open: false, items: [], loading: false, error: null };
  ref = React.createRef();
  btn = React.createRef();
  panel = React.createRef();
  componentDidMount() {
    this.poll();
    this.timer = setInterval(this.poll, 30000);
    document.addEventListener('mousedown', this.outside);
    document.addEventListener('keydown', this.esc);
  }
  componentWillUnmount() {
    clearInterval(this.timer);
    document.removeEventListener('mousedown', this.outside);
    document.removeEventListener('keydown', this.esc);
  }
  outside = (e) => this.state.open && !this.ref.current?.contains(e.target) && this.setState({ open: false });
  // Esc đóng dropdown và trả focus về nút chuông
  esc = (e) => { if (e.key === 'Escape' && this.state.open) { this.setState({ open: false }); this.btn.current?.focus(); } };
  poll = () => api.get('/notifications/unread-count').then((r) => this.setState({ count: r.data.count })).catch(() => {});
  toggle = async () => {
    if (this.state.open) return this.setState({ open: false });
    this.setState({ open: true, loading: true, error: null }, () => this.panel.current?.focus());
    try {
      const r = await api.get('/notifications?limit=6');
      this.setState({ items: r.data, loading: false });
    } catch (error) {
      this.setState({ error, loading: false });
    }
  };
  open = async (n) => {
    this.setState({ open: false });
    if (!n.isRead) await api.patch(`/notifications/${n._id}/read`).catch(() => {});
    this.poll();
    if (n.link) this.props.navigate(n.link);
  };
  readAll = async () => {
    try {
      await api.patch('/notifications/read-all');
      this.setState({ count: 0, items: this.state.items.map((n) => ({ ...n, isRead: true })) });
    } catch (error) {
      this.setState({ error });
    }
  };
  render() {
    const { count, open, items, loading, error } = this.state;
    return (
      <div className="bell" ref={this.ref}>
        <button ref={this.btn} className="btn btn-sm btn-ghost" onClick={this.toggle} aria-expanded={open} aria-haspopup="true" aria-controls="bell-panel" aria-label={`Thông báo, ${count} chưa đọc`}><BellIcon size={18} /></button>
        {count > 0 && <span className="bell-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>}
        {open && (
          <div className="dropdown" id="bell-panel" ref={this.panel} tabIndex={-1} role="region" aria-label="Thông báo" aria-busy={loading}>
            <div className="row-between dd-head">
              <strong>Thông báo</strong>
              {count > 0 && <button className="btn-link small" onClick={this.readAll}>Đánh dấu đã đọc</button>}
            </div>
            {loading && <div className="fog small dd-pad" role="status">Đang tải…</div>}
            {error && <ErrorState error={error} title="Không tải được thông báo" onRetry={this.toggleRetry} />}
            {!loading && !error && !items.length && <div className="fog small dd-pad">Chưa có thông báo</div>}
            {items.map((n) => (
              <button key={n._id} className={`menu-item ${n.isRead ? '' : 'menu-item-unread'}`} onClick={() => this.open(n)}>
                <div className="small">{!n.isRead && <><span className="accent" aria-hidden="true">● </span><span className="sr-only">Chưa đọc: </span></>}{n.title}</div>
                <div className="fog tiny">{n.message}</div>
                <div className="fog tiny">{timeAgo(n.createdAt)}</div>
              </button>
            ))}
            <Link to="/notifications" className="menu-item center small accent" onClick={() => this.setState({ open: false })}>Xem tất cả</Link>
          </div>
        )}
      </div>
    );
  }
  // Thử lại trong dropdown: đóng rồi mở lại để tải mới
  toggleRetry = () => this.setState({ open: false }, this.toggle);
}
const BellWithRouter = withRouter(Bell);

class UserMenu extends Component {
  static contextType = AuthContext;
  state = { open: false };
  ref = React.createRef();
  btn = React.createRef();
  panel = React.createRef();
  componentDidMount() { document.addEventListener('mousedown', this.outside); document.addEventListener('keydown', this.esc); }
  componentWillUnmount() { document.removeEventListener('mousedown', this.outside); document.removeEventListener('keydown', this.esc); }
  outside = (e) => this.state.open && !this.ref.current?.contains(e.target) && this.setState({ open: false });
  esc = (e) => { if (e.key === 'Escape' && this.state.open) { this.setState({ open: false }); this.btn.current?.focus(); } };
  toggle = () => this.setState({ open: !this.state.open }, () => this.state.open && this.panel.current?.focus());
  close = () => this.setState({ open: false });
  logout = async () => { this.setState({ open: false }); await this.context.logout(); this.props.navigate('/'); };
  render() {
    const { user } = this.context;
    const profile = { STUDENT: ['/student/profile', 'Hồ sơ & CV'], EMPLOYER: ['/employer/company', 'Hồ sơ công ty'] }[user.role];
    return (
      <div className="bell" ref={this.ref}>
        <button ref={this.btn} className="btn-link" onClick={this.toggle} aria-expanded={this.state.open} aria-haspopup="true" aria-controls="user-panel" aria-label="Menu tài khoản">
          <Avatar src={user.avatarUrl || user.employer?.company?.logoUrl} name={user.fullName} />
        </button>
        {this.state.open && (
          <div className="dropdown dd-wide" id="user-panel" ref={this.panel} tabIndex={-1} role="region" aria-label="Tài khoản">
            <div className="dd-head">
              <div>{user.fullName}</div>
              <div className="fog tiny">{user.email} · {ROLE[user.role]}{user.isPremium && ' · Premium'}</div>
            </div>
            <Link to={homeOf(user.role)} className="menu-item" onClick={this.close}>Trang của tôi</Link>
            {profile && <Link to={profile[0]} className="menu-item" onClick={this.close}>{profile[1]}</Link>}
            <Link to="/account/password" className="menu-item" onClick={this.close}>Đổi mật khẩu</Link>
            <button className="menu-item menu-danger" onClick={this.logout}>Đăng xuất</button>
          </div>
        )}
      </div>
    );
  }
}
const UserMenuWithRouter = withRouter(UserMenu);

class Navbar extends Component {
  static contextType = AuthContext;
  state = { open: false };
  burger = React.createRef();
  componentDidMount() { document.addEventListener('keydown', this.esc); }
  componentWillUnmount() { document.removeEventListener('keydown', this.esc); }
  componentDidUpdate(prev) {
    if (prev.location.pathname !== this.props.location.pathname && this.state.open) this.setState({ open: false });
  }
  // Esc đóng menu mobile và trả focus về nút burger
  esc = (e) => { if (e.key === 'Escape' && this.state.open) { this.setState({ open: false }); this.burger.current?.focus(); } };
  render() {
    const { user } = this.context;
    const links = LINKS[user?.role || 'GUEST'] || LINKS.GUEST;
    return (
      <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="logo" aria-label="UniShift, về trang chủ"><span className="logo-mark" aria-hidden="true" /><span>Uni<span className="logo-shift">Shift</span></span></Link>
          <nav id="site-nav" aria-label="Menu chính" className={`nav-links ${this.state.open ? 'open' : ''}`}>
            {links.map(([to, label]) => <NavLink key={to} to={to} end className="nav-link">{label}</NavLink>)}
            {/* Các nút ở nav-right bị ẩn trên màn hình hẹp → đưa vào menu burger */}
            {!user && <NavLink to="/login" className="nav-link nav-m-login">Đăng nhập</NavLink>}
            {!user && <NavLink to="/register?role=EMPLOYER" className="nav-link nav-m-emp">Đăng ký tuyển dụng</NavLink>}
          </nav>
          <div className="nav-right">
            {user ? (
              <>
                {user.role !== 'ADMIN' && <BellWithRouter />}
                {user.role === 'ADMIN' && <Link to="/admin" className="btn btn-sm">Trang quản trị</Link>}
                <UserMenuWithRouter />
              </>
            ) : (
              <>
                <Link to="/login" className="nav-link">Đăng nhập</Link>
                <Link to="/register" className="btn btn-primary">Đăng ký miễn phí <ChevronRight size={16} aria-hidden="true" /></Link>
                <Link to="/register?role=EMPLOYER" className="btn btn-box">Đăng ký tuyển dụng</Link>
              </>
            )}
            <button ref={this.burger} className="btn btn-sm btn-ghost nav-burger" onClick={() => this.setState({ open: !this.state.open })} aria-expanded={this.state.open} aria-controls="site-nav" aria-label={this.state.open ? 'Đóng menu' : 'Mở menu'}><Menu size={18} /></button>
          </div>
        </div>
      </header>
      </>
    );
  }
}

export default withRouter(Navbar);
