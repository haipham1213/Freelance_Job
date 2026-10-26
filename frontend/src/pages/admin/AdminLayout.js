import React, { Component } from 'react';
import { Tags } from 'lucide-react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';
import { Avatar } from '../../components/ui';

const MENU = [['/admin', Tags, 'Danh mục']];

// SCR-A08
class AdminLayout extends Component {
  static contextType = AuthContext;
  logout = async () => { await this.context.logout(); this.props.navigate('/'); };
  render() {
    return (
      <div className="admin-shell">
        <aside className="sidebar">
          <Link to="/" className="logo adm-logo"><span className="logo-mark" aria-hidden="true" /><span>Uni<span className="logo-shift">Shift</span></span> <span className="chip tiny">Admin</span></Link>
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
            <button className="btn btn-sm btn-ghost btn-block adm-danger" onClick={this.logout}>Đăng xuất</button>
          </div>
        </aside>
        <main className="admin-main"><Outlet /></main>
      </div>
    );
  }
}

export default withRouter(AdminLayout);
