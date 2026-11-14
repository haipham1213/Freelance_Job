import React, { Component } from 'react';
import { Bell as BellIcon, BellOff, ChevronRight, Menu } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';
import { Avatar, Popover } from './ui';
import { homeOf, timeAgo, ROLE } from '../utils/format';
import withRouter from '../utils/withRouter';

const LINKS = {
  GUEST: [['/', 'Trang chủ'], ['/jobs', 'Tìm việc']],
  STUDENT: [['/', 'Trang chủ'], ['/jobs', 'Tìm việc'], ['/student/applications', 'Đơn của tôi'], ['/student/saved-jobs', 'Đã lưu']],
  EMPLOYER: [['/', 'Trang chủ'], ['/employer', 'Dashboard'], ['/employer/jobs', 'Tin tuyển dụng'], ['/employer/jobs/new', 'Đăng tin'], ['/employer/premium', 'Premium']],
};

// FR-NOT-01: hỏi số chưa đọc mỗi 30 giây (AS-15, không WebSocket)
class Bell extends Component {
  state = { count: 0, items: [] };
  componentDidMount() {
    this.poll();
    this.timer = setInterval(this.poll, 30000);
  }
  componentWillUnmount() { clearInterval(this.timer); }
  poll = () => api.get('/notifications/unread-count').then((r) => this.setState({ count: r.data.count })).catch(() => {});
  load = async () => {
    const r = await api.get('/notifications?limit=6');
    this.setState({ items: r.data });
  };
  open = async (n, close) => {
    close(false);
    if (!n.isRead) await api.patch(`/notifications/${n._id}/read`).catch(() => {});
    this.poll();
    if (n.link) this.props.navigate(n.link);
  };
  readAll = async () => {
    await api.patch('/notifications/read-all');
    this.setState({ count: 0, items: this.state.items.map((n) => ({ ...n, isRead: true })) });
  };
  render() {
    const { count, items } = this.state;
    return (
      <Popover label={`Thông báo, ${count} chưa đọc`} panelLabel="Thông báo" btnClass="btn btn-sm btn-ghost bell-btn" trigger={<BellIcon size={18} aria-hidden="true" />}
        after={count > 0 && <span className="bell-count" aria-hidden="true">{count > 99 ? '99+' : count}</span>} onOpen={this.load}>
        {({ close }) => (
          <>
            <div className="row-between" style={{ padding: '4px 12px 8px' }}>
              <strong>Thông báo</strong>
              {count > 0 && <button className="btn-link small" onClick={this.readAll}>Đánh dấu đã đọc</button>}
            </div>
            {!items.length && <div className="bell-empty fog small"><BellOff size={20} aria-hidden="true" />Chưa có thông báo</div>}
            {items.map((n) => (
              <button key={n._id} className="menu-item" onClick={() => this.open(n, close)} style={{ opacity: n.isRead ? 0.6 : 1 }}>
                <div className="small">{!n.isRead && <span className="accent">● </span>}{n.title}</div>
                <div className="fog tiny">{n.message}</div>
                <div className="fog tiny">{timeAgo(n.createdAt)}</div>
              </button>
            ))}
            <Link to="/notifications" className="menu-item center small accent" onClick={() => close(false)}>Xem tất cả</Link>
          </>
        )}
      </Popover>
    );
  }
}
const BellWithRouter = withRouter(Bell);

class UserMenu extends Component {
  static contextType = AuthContext;
  go = (to, close) => { close(false); this.props.navigate(to); };
  logout = async (close) => { close(false); await this.context.logout(); this.props.navigate('/'); };
  render() {
    const { user } = this.context;
    const profile = { STUDENT: ['/student/profile', 'Hồ sơ & CV'], EMPLOYER: ['/employer/company', 'Hồ sơ công ty'] }[user.role];
    return (
      <Popover label="Menu tài khoản" btnClass="btn-link bell-btn bell-avatar" panelStyle={{ width: 260 }}
        trigger={<Avatar src={user.avatarUrl || user.employer?.company?.logoUrl} name={user.fullName} />}>
        {({ close }) => (
          <>
            <div style={{ padding: '8px 12px' }}>
              <div>{user.fullName}</div>
              <div className="fog tiny">{user.email} · {ROLE[user.role]}{user.isPremium && ' · ★ Premium'}</div>
            </div>
            <button className="menu-item" onClick={() => this.go(homeOf(user.role), close)}>Trang của tôi</button>
            {profile && <button className="menu-item" onClick={() => this.go(profile[0], close)}>{profile[1]}</button>}
            <button className="menu-item" onClick={() => this.go('/account/password', close)}>Đổi mật khẩu</button>
            <button className="menu-item" onClick={() => this.logout(close)} style={{ color: 'var(--alert)' }}>Đăng xuất</button>
          </>
        )}
      </Popover>
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
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="logo" aria-label="UniShift, về trang chủ"><span className="logo-mark" aria-hidden="true" /><span>Uni<span className="logo-shift">Shift</span></span></Link>
          <nav className={`nav-links ${this.state.open ? 'open' : ''}`}>
            {links.map(([to, label]) => <NavLink key={to} to={to} end className="nav-link" data-label={label}>{label}</NavLink>)}
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
