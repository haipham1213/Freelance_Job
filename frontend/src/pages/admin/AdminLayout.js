import React, { Component } from 'react';
import { BriefcaseBusiness, CreditCard, Flag, LayoutDashboard, Star, Tags, Users } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';
import { Avatar } from '../../components/ui';

const MENU = [
  ['/admin', LayoutDashboard, 'Dashboard'], ['/admin/users', Users, 'Người dùng'], ['/admin/jobs', BriefcaseBusiness, 'Tin tuyển dụng'],
  ['/admin/reports', Flag, 'Báo cáo vi phạm'], ['/admin/reviews', Star, 'Đánh giá'], ['/admin/categories', Tags, 'Danh mục'], ['/admin/payments', CreditCard, 'Gói & giao dịch'],
];

// SCR-A08
class AdminLayout extends Component {
  static contextType = AuthContext;
  logout = async () => { await this.context.logout(); this.props.navigate('/'); };
  render() {
    return (
      <div className="admin-shell">
        <aside className="sidebar">
          <Link to="/" className="logo adm-logo"><span className="logo-mark" />jobsv <span className="chip chip-dark tiny">Admin</span></Link>
          {MENU.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} end className="side-link"><Icon size={18} className="adm-ico" aria-hidden="true" />{label}</NavLink>
          ))}
          <div className="side-foot adm-side-foot">
            <div className="row" style={{ flexWrap: 'nowrap', gap: 10 }}>
              <Avatar src={this.context.user.avatarUrl} name={this.context.user.fullName} />
              <div style={{ minWidth: 0 }}>
                <div className="small adm-ellipsis"><strong>{this.context.user.fullName}</strong></div>
                <div className="fog tiny adm-ellipsis">{this.context.user.email}</div>
              </div>
            </div>
            <button className="btn btn-sm btn-ghost btn-block" style={{ color: 'var(--alert)' }} onClick={this.logout}>Đăng xuất</button>
          </div>
        </aside>
        <main className="admin-main"><Outlet /></main>
      </div>
    );
  }
}

export default withRouter(AdminLayout);
