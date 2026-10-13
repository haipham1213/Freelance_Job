import React, { Component } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Spinner, Empty, Avatar } from '../../components/ui';
import { date, timeAgo } from '../../utils/format';

// SCR-E01: bảng điều khiển nhà tuyển dụng (lời chào làm tiêu đề trang, hàng số liệu, gói, đơn chờ duyệt)
export default class EmployerHomePage extends Component {
  state = { data: null };
  async componentDidMount() { this.setState({ data: (await api.get('/employers/me/stats')).data }); }
  render() {
    const { data } = this.state;
    if (!data) return <Spinner />;
    const { jobs, applications: apps, quota, isPremium, premiumUntil, company, recentPending, user } = data;
    const hasCompany = company?.name && company?.address && company?.phone;
    const h = new Date().getHours();
    const hello = h < 11 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const stats = [
      ['Tin đang mở', `${quota.used}/${quota.limit}`],
      ['Đơn chờ duyệt', apps.PENDING || 0],
      ['Đã nhận', (apps.ACCEPTED || 0) + (apps.COMPLETED || 0) + (apps.NOT_COMPLETED || 0)],
      ['Tổng tin đã đăng', Object.values(jobs).reduce((a, b) => a + b, 0)],
    ];
    return (
      <div className="container page stack-lg">
        <header className="emp-head" style={{ marginBottom: 0 }}>
          <div>
            <h1 className="display">{hello}, {user.fullName.trim().split(' ').pop()}</h1>
            <p className="muted">{company?.name ? `Quản lý tuyển dụng của ${company.name}` : 'Hoàn thiện hồ sơ công ty để bắt đầu tuyển người.'}</p>
          </div>
          <div className="row">
            <Link to="/employer/jobs" className="btn btn-ghost">Tin tuyển dụng</Link>
            <Link to="/employer/jobs/new" className="btn"><Plus size={18} />Đăng tin mới</Link>
          </div>
        </header>

        {!hasCompany && (
          <section className="emp-note">
            <div>
              <strong>Hồ sơ công ty chưa đầy đủ</strong>
              <p className="muted small">Bạn cần điền tên, địa chỉ và số điện thoại trước khi đăng tin.</p>
            </div>
            <Link to="/employer/company" className="btn btn-sm">Hoàn thiện hồ sơ</Link>
          </section>
        )}

        <section className="emp-stats" aria-label="Số liệu tuyển dụng">
          {stats.map(([k, v]) => (
            <Link key={k} to="/employer/jobs"><strong>{v}</strong><span>{k}</span></Link>
          ))}
        </section>

        <div className="layout-main">
          <section className="card">
            <div className="row-between">
              <h2 className="h-lg">Đơn mới chờ duyệt</h2>
              <Link to="/employer/jobs" className="accent small">Quản lý tin</Link>
            </div>
            {!recentPending.length ? <Empty title="Chưa có đơn mới" /> : (
              <div className="emp-rows">
                {recentPending.map((a) => (
                  <Link key={a._id} to={`/employer/applications/${a._id}`} className="emp-row">
                    <Avatar src={a.studentId?.avatarUrl} name={a.studentId?.fullName} />
                    <div className="emp-row-body">
                      <div className="h-sm lib-meta">{a.studentId?.fullName}</div>
                      <div className="muted small lib-meta">{a.jobSnapshot.title}</div>
                    </div>
                    <span className="fog small">{timeAgo(a.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="emp-upsell">
            <span className={`chip ${isPremium ? 'chip-featured' : ''}`}>{isPremium ? '★ Premium' : 'Gói miễn phí'}</span>
            <h2 className="h-md">{isPremium ? 'Bạn đang dùng Premium' : 'Tuyển nhanh hơn với Premium'}</h2>
            <p className="muted small">
              {isPremium ? `Hiệu lực đến ${date(premiumUntil)}. Tin của bạn được ghim Nổi bật và hiển thị 30 ngày.` : 'Tối đa 3 tin đang mở, mỗi tin hiển thị 14 ngày. Premium: 20 tin, 30 ngày, ghim Nổi bật.'}
            </p>
            <Link to="/employer/premium" className="btn btn-block">{isPremium ? 'Gia hạn' : 'Nâng cấp Premium'}</Link>
          </aside>
        </div>
      </div>
    );
  }
}
