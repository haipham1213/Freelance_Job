import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Spinner, Empty, Avatar } from '../../components/ui';
import { Mascot } from '../../components/Illustrations';
import { date, timeAgo, PANEL_BG } from '../../utils/format';

// SCR-E01 — bố cục như trang tổng quan sinh viên (phong cách headspace.com)
export default class EmployerHomePage extends Component {
  state = { data: null };
  async componentDidMount() { this.setState({ data: (await api.get('/employers/me/stats')).data }); }
  render() {
    const { data } = this.state;
    if (!data) return <Spinner />;
    const { jobs, applications: apps, quota, isPremium, premiumUntil, company, recentPending, user } = data;
    const hasCompany = company?.name && company?.address && company?.phone;
    const h = new Date().getHours();
    const [hello, mascot] = h < 11 ? ['Chào buổi sáng', 'cloud'] : h < 18 ? ['Chào buổi chiều', 'triangle'] : ['Chào buổi tối', 'blob'];
    const stats = [
      ['Tin đang mở', `${quota.used}/${quota.limit}`, '/employer/jobs'],
      ['Đơn chờ duyệt', apps.PENDING || 0, '/employer/jobs'],
      ['Đã nhận', (apps.ACCEPTED || 0) + (apps.COMPLETED || 0) + (apps.NOT_COMPLETED || 0), '/employer/jobs'],
      ['Tổng tin đã đăng', Object.values(jobs).reduce((a, b) => a + b, 0), '/employer/jobs'],
    ];
    return (
      <div className="container page">
        <section className="dash-hello">
          <Mascot kind={mascot} size={96} />
          <h1 className="display">{hello}, {user.fullName.trim().split(' ').pop()}</h1>
          <p className="muted">{company?.name ? `Quản lý tuyển dụng của ${company.name}` : 'Hoàn thiện hồ sơ công ty để bắt đầu tuyển người.'}</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/employer/jobs/new" className="btn btn-lg">+ Đăng tin mới</Link>
            <Link to="/employer/jobs" className="btn btn-lg btn-ghost">Tin tuyển dụng</Link>
          </div>
        </section>

        {!hasCompany && (
          <section className="dash-profile" style={{ background: PANEL_BG[1] }}>
            <div className="stack">
              <h2 className="h-lg">Hồ sơ công ty chưa đầy đủ</h2>
              <p>Bạn cần điền tên, địa chỉ và số điện thoại trước khi đăng tin.</p>
            </div>
            <Link to="/employer/company" className="btn btn-lg">Hoàn thiện hồ sơ</Link>
          </section>
        )}

        <section className="dash-stats">
          {stats.map(([k, v, to], i) => (
            <Link key={k} to={to} className="dash-stat" style={{ background: PANEL_BG[(i + 2) % PANEL_BG.length] }}>
              <span className="join-num">{v}</span>
              <span>{k}</span>
            </Link>
          ))}
        </section>

        <section className="emp-premium" style={{ background: isPremium ? PANEL_BG[5] : PANEL_BG[0] }}>
          <div className="stack">
            <span className="chip chip-dark" style={{ alignSelf: 'flex-start' }}>{isPremium ? '★ Premium' : 'Gói miễn phí'}</span>
            <h2 className="display">{isPremium ? 'Bạn đang dùng Premium' : 'Tuyển nhanh hơn với Premium'}</h2>
            <p>
              {isPremium ? `Hiệu lực đến ${date(premiumUntil)}. Tin của bạn được ghim Nổi bật và hiển thị 30 ngày.` : 'Tối đa 3 tin đang mở, mỗi tin hiển thị 14 ngày. Premium: 20 tin, 30 ngày, ghim Nổi bật.'}
            </p>
            <div><Link to="/employer/premium" className="btn btn-lg">{isPremium ? 'Gia hạn' : 'Nâng cấp Premium'}</Link></div>
          </div>
          <Mascot kind={isPremium ? 'flower' : 'cloud'} size={160} />
        </section>

        <section className="section">
          <div className="row-between">
            <h2 className="display">Đơn mới chờ duyệt</h2>
            <Link to="/employer/jobs" className="accent">Quản lý tin</Link>
          </div>
          {!recentPending.length ? (
            <div className="voice" style={{ marginTop: 24, minHeight: 0 }}><Empty title="Chưa có đơn mới" /></div>
          ) : (
            <div className="dash-apps">
              {recentPending.map((a) => (
                <Link key={a._id} to={`/employer/applications/${a._id}`} className="dash-app">
                  <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
                    <Avatar src={a.studentId?.avatarUrl} name={a.studentId?.fullName} />
                    <div style={{ minWidth: 0 }}>
                      <div className="h-sm lib-meta">{a.studentId?.fullName}</div>
                      <div className="muted small lib-meta">{a.jobSnapshot.title} · {timeAgo(a.createdAt)}</div>
                    </div>
                  </div>
                  <span className="btn btn-sm">Xem</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }
}
