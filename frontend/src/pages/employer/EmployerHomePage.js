import React, { Component } from 'react';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Spinner, Empty, Avatar, ErrorState } from '../../components/ui';
import { date, timeAgo } from '../../utils/format';

// SCR-E01: bảng điều khiển nhà tuyển dụng (lời chào làm tiêu đề trang, hàng số liệu, gói, đơn chờ duyệt)
export default class EmployerHomePage extends Component {
  state = { data: null, error: null };
  componentDidMount() { this.load(); }
  load = async () => {
    this.setState({ error: null });
    try {
      this.setState({ data: (await api.get('/employers/me/stats')).data });
    } catch (error) {
      this.setState({ error });
    }
  };
  render() {
    const { data, error } = this.state;
    if (error) return <div className="container page"><ErrorState error={error} onRetry={this.load} /></div>;
    if (!data) return <Spinner />;
    const { jobs, applications: apps, quota, isPremium, premiumUntil, company, recentPending, user, tiers: { free, premium } } = data;
    const hasCompany = company?.name && company?.address && company?.phone;
    const h = new Date().getHours();
    const hello = h < 11 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
    const stats = [
      // Ô thứ ba: đơn đã nhận nằm rải ở nhiều trạng thái tin nên dẫn tới danh sách đầy đủ
      ['Tin đang mở', `${quota.used}/${quota.limit}`, '/employer/jobs?tab=OPEN'],
      ['Đơn chờ duyệt', apps.PENDING || 0, '/employer/jobs?tab=OPEN'],
      ['Đã nhận', (apps.ACCEPTED || 0) + (apps.COMPLETED || 0) + (apps.NOT_COMPLETED || 0), '/employer/jobs'],
      ['Tổng tin đã đăng', Object.values(jobs).reduce((a, b) => a + b, 0), '/employer/jobs'],
    ];
    return (
      <div className="container page stack-lg">
        <header className="emp-head">
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">{[hello, user.fullName?.trim().split(' ').pop()].filter(Boolean).join(', ')}</h1>
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
          {stats.map(([k, v, to]) => (
            <Link key={k} to={to}><strong>{v}</strong><span>{k}</span></Link>
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
                    <Avatar src={a.studentId?.avatarUrl} name={a.studentId?.fullName || undefined} />
                    <div className="emp-row-body">
                      <div className="h-sm lib-meta">{a.studentId?.fullName || 'Sinh viên đã xóa tài khoản'}</div>
                      <div className="muted small lib-meta">{a.jobSnapshot?.title}</div>
                    </div>
                    <span className="fog small">{timeAgo(a.createdAt)}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <aside className="emp-upsell">
            <span className={`chip ${isPremium ? 'chip-featured' : ''}`}>{isPremium ? <><span aria-hidden="true">★ </span>Premium</> : 'Gói miễn phí'}</span>
            <h2 className="h-md">{isPremium ? 'Bạn đang dùng Premium' : 'Tuyển nhanh hơn với Premium'}</h2>
            <p className="muted small">
              {isPremium ? `Hiệu lực đến ${date(premiumUntil)}. Tin của bạn được ghim Nổi bật và hiển thị ${premium.days} ngày.` : `Tối đa ${free.quota} tin đang mở, mỗi tin hiển thị ${free.days} ngày. Premium: ${premium.quota} tin, ${premium.days} ngày, ghim Nổi bật.`}
            </p>
            <Link to="/employer/premium" className="btn btn-block">{isPremium ? 'Gia hạn' : 'Nâng cấp Premium'}</Link>
          </aside>
        </div>
      </div>
    );
  }
}
