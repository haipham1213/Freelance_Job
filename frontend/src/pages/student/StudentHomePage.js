import React, { Component } from 'react';
import { ArrowRight, Bookmark, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, AppBadge, Empty } from '../../components/ui';
import JobTile from '../../components/JobTile';
import { timeAgo } from '../../utils/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? 'Chào buổi sáng' : h < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
};

// SCR-S01: bảng điều khiển ứng viên (lời chào, số liệu, việc phù hợp, đơn gần đây)
export default class StudentHomePage extends Component {
  static contextType = AuthContext;
  state = { profile: null, apps: null, jobs: null, counts: {} };

  async componentDidMount() {
    const [p, a, j] = await Promise.all([api.get('/students/me'), api.get('/students/me/applications?limit=5'), api.get('/jobs?limit=6')]);
    const counts = {};
    await Promise.all(['PENDING', 'ACCEPTED', 'COMPLETED'].map((s) => api.get(`/students/me/applications?status=${s}&limit=1`).then((r) => { counts[s] = r.meta.total; })));
    this.setState({ profile: p.data, apps: a.data, jobs: j.data, counts });
  }

  render() {
    const { profile, apps, jobs, counts } = this.state;
    if (!profile) return <Spinner />;
    const u = profile.profile;
    const stats = [['Đang chờ', counts.PENDING], ['Được nhận', counts.ACCEPTED], ['Hoàn thành', counts.COMPLETED], ['Điểm uy tín', u.ratingCount ? `${u.ratingAvg}★` : '-']];
    return (
      <div className="container page">
        <header className="stu-head">
          <div className="stu-head-text">
            <span className="eyebrow eyebrow-dot">Sinh viên</span>
            <h1 className="display">{greeting()}, {u.fullName.trim().split(' ').pop()}</h1>
            <p className="muted">Hôm nay bạn muốn tìm ca làm nào?</p>
          </div>
          <div className="row">
            <Link to="/jobs" className="btn"><Search size={16} /> Tìm việc</Link>
            <Link to="/student/saved-jobs" className="btn btn-ghost"><Bookmark size={16} /> Việc đã lưu</Link>
          </div>
        </header>

        <section className="stu-stats">
          {stats.map(([k, v], i) => (
            <Link key={k} to={i < 3 ? '/student/applications' : '/student/profile'} className="stu-stat">
              <strong>{v ?? 0}</strong>
              <span className="muted small">{k}</span>
            </Link>
          ))}
        </section>

        <div className="layout-main section">
          <section>
            <div className="row-between">
              <h2 className="h-lg">Việc làm phù hợp</h2>
              <Link to="/jobs" className="accent ico-row small">Xem tất cả <ArrowRight size={16} aria-hidden="true" /></Link>
            </div>
            {!jobs ? <Spinner /> : <div className="stu-jobs">{jobs.map((j) => <JobTile key={j._id} job={j} badge />)}</div>}
          </section>

          <aside className="stack">
            {profile.completion < 100 && (
              <section className="card stu-complete">
                <h2 className="h-sm">Hồ sơ hoàn thiện {profile.completion}%</h2>
                <div className="progress"><div style={{ width: `${profile.completion}%` }} /></div>
                <p className="muted small">{u.student?.cv?.url ? 'Thêm vài thông tin để nhà tuyển dụng tin tưởng bạn hơn.' : 'Bạn chưa có CV. CV là bắt buộc để ứng tuyển.'}</p>
                <Link to="/student/profile" className="btn btn-block">Hoàn thiện hồ sơ</Link>
              </section>
            )}
            <section className="card">
              <div className="row-between">
                <h2 className="h-sm">Đơn gần đây</h2>
                <Link to="/student/applications" className="accent small">Tất cả đơn</Link>
              </div>
              {!apps.length ? (
                <Empty title="Chưa có đơn nào">Hãy ứng tuyển công việc đầu tiên.</Empty>
              ) : (
                <div className="dash-apps">
                  {apps.map((a) => (
                    <Link key={a._id} to={`/student/applications/${a._id}`} className="dash-app">
                      <div style={{ minWidth: 0 }}>
                        <div className="h-sm lib-meta">{a.jobSnapshot.title}</div>
                        <div className="muted small lib-meta">{a.jobSnapshot.companyName}, {timeAgo(a.createdAt)}</div>
                      </div>
                      <AppBadge status={a.status} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    );
  }
}
