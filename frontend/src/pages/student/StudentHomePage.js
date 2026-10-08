import React, { Component } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, AppBadge, Empty } from '../../components/ui';
import { Mascot } from '../../components/Illustrations';
import JobTile from '../../components/JobTile';
import { timeAgo, PANEL_BG } from '../../utils/format';

const greeting = () => {
  const h = new Date().getHours();
  return h < 11 ? ['Chào buổi sáng', 'cloud'] : h < 18 ? ['Chào buổi chiều', 'triangle'] : ['Chào buổi tối', 'blob'];
};

// SCR-S01 — bố cục theo phong cách headspace.com: lời chào lớn, khối màu, carousel việc
export default class StudentHomePage extends Component {
  static contextType = AuthContext;
  state = { profile: null, apps: null, jobs: null, counts: {} };
  track = React.createRef();

  async componentDidMount() {
    const [p, a, j] = await Promise.all([api.get('/students/me'), api.get('/students/me/applications?limit=5'), api.get('/jobs?limit=8')]);
    const counts = {};
    await Promise.all(['PENDING', 'ACCEPTED', 'COMPLETED'].map((s) => api.get(`/students/me/applications?status=${s}&limit=1`).then((r) => { counts[s] = r.meta.total; })));
    this.setState({ profile: p.data, apps: a.data, jobs: j.data, counts });
  }

  slide = (dir) => this.track.current?.scrollBy({ left: dir * this.track.current.clientWidth * 0.8, behavior: 'smooth' });

  render() {
    const { profile, apps, jobs, counts } = this.state;
    if (!profile) return <Spinner />;
    const u = profile.profile;
    const [hello, mascot] = greeting();
    const stats = [['Đang chờ', counts.PENDING], ['Được nhận', counts.ACCEPTED], ['Hoàn thành', counts.COMPLETED], ['Điểm uy tín', u.ratingCount ? `${u.ratingAvg}★` : '—']];
    return (
      <div className="container page">
        <section className="dash-hello">
          <Mascot kind={mascot} size={96} />
          <h1 className="display">{hello}, {u.fullName.trim().split(' ').pop()}</h1>
          <p className="muted">Hôm nay bạn muốn tìm ca làm nào?</p>
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to="/jobs" className="btn btn-lg">Tìm việc ngay</Link>
            <Link to="/student/saved-jobs" className="btn btn-lg btn-ghost">Việc đã lưu</Link>
          </div>
        </section>

        {profile.completion < 100 && (
          <section className="dash-profile" style={{ background: PANEL_BG[1] }}>
            <div className="stack">
              <h2 className="h-lg">Hồ sơ của bạn đã hoàn thiện {profile.completion}%</h2>
              <p>{u.student?.cv?.url ? 'Thêm vài thông tin nữa để nhà tuyển dụng tin tưởng bạn hơn.' : 'Bạn chưa có CV — bắt buộc phải có để ứng tuyển.'}</p>
              <div className="dash-progress"><div style={{ width: `${profile.completion}%` }} /></div>
            </div>
            <Link to="/student/profile" className="btn btn-lg">Hoàn thiện hồ sơ</Link>
          </section>
        )}

        <section className="dash-stats">
          {stats.map(([k, v], i) => (
            <Link key={k} to={i < 3 ? '/student/applications' : '/student/profile'} className="dash-stat" style={{ background: PANEL_BG[(i + 2) % PANEL_BG.length] }}>
              <span className="join-num">{v ?? 0}</span>
              <span>{k}</span>
            </Link>
          ))}
        </section>

        <section className="section">
          <div className="lib-head" style={{ marginTop: 0 }}>
            <h2 className="display">Việc mới cho bạn</h2>
            <div className="row">
              <Link to="/jobs" className="accent">Xem tất cả</Link>
              <div className="lib-arrows">
                <button className="lib-arrow" onClick={() => this.slide(-1)} aria-label="Trước"><ArrowLeft size={20} /></button>
                <button className="lib-arrow" onClick={() => this.slide(1)} aria-label="Sau"><ArrowRight size={20} /></button>
              </div>
            </div>
          </div>
          {!jobs ? <Spinner /> : (
            <div className="lib-track" ref={this.track}>
              {jobs.map((j, i) => <JobTile key={j._id} job={j} badge />)}
            </div>
          )}
        </section>

        <section className="section">
          <div className="row-between">
            <h2 className="display">Đơn gần đây</h2>
            <Link to="/student/applications" className="accent">Tất cả đơn</Link>
          </div>
          {!apps.length ? (
            <div className="voice" style={{ marginTop: 24, minHeight: 0 }}><Empty title="Chưa có đơn nào">Hãy ứng tuyển công việc đầu tiên!</Empty></div>
          ) : (
            <div className="dash-apps">
              {apps.map((a) => (
                <Link key={a._id} to={`/student/applications/${a._id}`} className="dash-app">
                  <div style={{ minWidth: 0 }}>
                    <div className="h-sm lib-meta">{a.jobSnapshot.title}</div>
                    <div className="muted small">{a.jobSnapshot.companyName} · {timeAgo(a.createdAt)}</div>
                  </div>
                  <AppBadge status={a.status} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }
}
