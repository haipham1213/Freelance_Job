import React, { Component } from 'react';
import { ArrowRight, Bell as BellIcon, ChevronRight, Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import { Avatar } from './ui';
import { homeOf, timeAgo, ROLE } from '../utils/format';
import withRouter from '../utils/withRouter';

const LINKS = {
  GUEST: [['/', 'Trang chủ'], ['/jobs', 'Tìm việc']],
  STUDENT: [['/', 'Trang chủ'], ['/jobs', 'Tìm việc'], ['/student/applications', 'Đơn của tôi']],
  EMPLOYER: [['/', 'Trang chủ'], ['/employer', 'Dashboard'], ['/employer/jobs', 'Tin tuyển dụng'], ['/employer/jobs/new', 'Đăng tin']],
};

// FR-NOT-01: hỏi số chưa đọc mỗi 30 giây (AS-15, không WebSocket)
class Bell extends Component {
  state = { count: 0, open: false, items: [] };
  ref = React.createRef();
  componentDidMount() {
    this.poll();
    this.timer = setInterval(this.poll, 30000);
    document.addEventListener('mousedown', this.outside);
  }
  componentWillUnmount() {
    clearInterval(this.timer);
    document.removeEventListener('mousedown', this.outside);
  }
  outside = (e) => this.state.open && !this.ref.current?.contains(e.target) && this.setState({ open: false });
  poll = () => api.get('/notifications/unread-count').then((r) => this.setState({ count: r.data.count })).catch(() => {});
  toggle = async () => {
    if (this.state.open) return this.setState({ open: false });
    this.setState({ open: true });
    const r = await api.get('/notifications?limit=6');
    this.setState({ items: r.data });
  };
  open = async (n) => {
    this.setState({ open: false });
    if (!n.isRead) await api.patch(`/notifications/${n._id}/read`).catch(() => {});
    this.poll();
    if (n.link) this.props.navigate(n.link);
  };
  readAll = async () => {
    await api.patch('/notifications/read-all');
    this.setState({ count: 0, items: this.state.items.map((n) => ({ ...n, isRead: true })) });
  };
  render() {
    const { count, open, items } = this.state;
    return (
      <div className="bell" ref={this.ref}>
        <button className="btn btn-sm btn-ghost" onClick={this.toggle} aria-label={`Thông báo, ${count} chưa đọc`}><BellIcon size={18} /></button>
        {count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}
        {open && (
          <div className="dropdown">
            <div className="row-between" style={{ padding: '4px 12px 8px' }}>
              <strong>Thông báo</strong>
              {count > 0 && <button className="btn-link small" onClick={this.readAll}>Đánh dấu đã đọc</button>}
            </div>
            {!items.length && <div className="fog small" style={{ padding: 12 }}>Chưa có thông báo</div>}
            {items.map((n) => (
              <button key={n._id} className="menu-item" onClick={() => this.open(n)} style={{ opacity: n.isRead ? 0.6 : 1 }}>
                <div className="small">{!n.isRead && <span className="accent">● </span>}{n.title}</div>
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
}
const BellWithRouter = withRouter(Bell);

class UserMenu extends Component {
  static contextType = AuthContext;
  state = { open: false };
  ref = React.createRef();
  componentDidMount() { document.addEventListener('mousedown', this.outside); }
  componentWillUnmount() { document.removeEventListener('mousedown', this.outside); }
  outside = (e) => this.state.open && !this.ref.current?.contains(e.target) && this.setState({ open: false });
  go = (to) => { this.setState({ open: false }); this.props.navigate(to); };
  logout = async () => { this.setState({ open: false }); await this.context.logout(); this.props.navigate('/'); };
  render() {
    const { user } = this.context;
    const profile = { STUDENT: ['/student/profile', 'Hồ sơ & CV'], EMPLOYER: ['/employer/company', 'Hồ sơ công ty'] }[user.role];
    return (
      <div className="bell" ref={this.ref}>
        <button className="btn-link" onClick={() => this.setState({ open: !this.state.open })} aria-label="Menu tài khoản">
          <Avatar src={user.avatarUrl || user.employer?.company?.logoUrl} name={user.fullName} />
        </button>
        {this.state.open && (
          <div className="dropdown" style={{ width: 260 }}>
            <div style={{ padding: '8px 12px' }}>
              <div>{user.fullName}</div>
              <div className="fog tiny">{user.email} · {ROLE[user.role]}{user.isPremium && ' · ★ Premium'}</div>
            </div>
            <button className="menu-item" onClick={() => this.go(homeOf(user.role))}>Trang của tôi</button>
            {profile && <button className="menu-item" onClick={() => this.go(profile[0])}>{profile[1]}</button>}
            <button className="menu-item" onClick={this.logout} style={{ color: 'var(--alert)' }}>Đăng xuất</button>
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
  componentDidUpdate(prev) {
    if (prev.location.pathname !== this.props.location.pathname && this.state.open) this.setState({ open: false });
  }
  render() {
    const { user } = this.context;
    const links = LINKS[user?.role || 'GUEST'] || LINKS.GUEST;
    return (
      <>
      {!user && this.props.location.pathname !== '/' && (
        <div className="promo-bar">
          <Link to="/jobs" className="ico-row" style={{ justifyContent: 'center' }}>Mới: Việc làm thêm dịp Tết, lương cao gấp đôi <ArrowRight size={16} /></Link>
        </div>
      )}
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="logo" aria-label="UniShift, về trang chủ"><span className="logo-mark" aria-hidden="true" /><span>Uni<span className="logo-shift">Shift</span></span></Link>
          <nav className={`nav-links ${this.state.open ? 'open' : ''}`}>
            {links.map(([to, label]) => <NavLink key={to} to={to} end className="nav-link">{label}</NavLink>)}
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
                <Link to="/register?role=EMPLOYER" className="btn btn-box">Nhà tuyển dụng</Link>
              </>
            )}
            <button className="btn btn-sm btn-ghost nav-burger" onClick={() => this.setState({ open: !this.state.open })} aria-label="Mở menu"><Menu size={18} /></button>
          </div>
        </div>
      </header>
      </>
    );
  }
}

export default withRouter(Navbar);
