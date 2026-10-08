import React, { Component } from 'react';
import { Flag, Globe, MapPin } from 'lucide-react';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Stars, Empty, Avatar, Pagination } from '../../components/ui';
import JobTile from '../../components/JobTile';
import { Mascot } from '../../components/Illustrations';
import ReportModal from '../../components/ReportModal';
import ErrorPage from './ErrorPage';
import { date, timeAgo, PANEL_BG } from '../../utils/format';
import withRouter from '../../utils/withRouter';

// SCR-C06 / FR-PRO-04
class EmployerPublicPage extends Component {
  static contextType = AuthContext;
  state = { data: null, meta: null, error: null, report: false };
  componentDidMount() { this.load(1); }
  load = async (page) => {
    try {
      const r = await api.get(`/employers/${this.props.params.id}?page=${page}`);
      this.setState({ data: r.data, meta: r.meta });
    } catch (error) {
      this.setState({ error });
    }
  };
  render() {
    const { data, meta, error, report } = this.state;
    if (error) return <ErrorPage code={404} message={error.message} />;
    if (!data) return <Spinner />;
    const { employer, openJobs, reviews } = data;
    const c = employer.company || {};
    const user = this.context.user;
    return (
      <div className="container page">
        <header className="pub-hero" style={{ background: PANEL_BG[1] }}>
          <div className="stack-lg" style={{ minWidth: 0 }}>
            <div className="pub-logo-lg">
              {c.logoUrl ? <img src={c.logoUrl} alt="" /> : (c.name || employer.fullName || '?')[0]}
            </div>
            <div className="row">
              <h1 className="display">{c.name || employer.fullName}</h1>
              {employer.isPremium && <span className="chip chip-dark">★ Premium</span>}
            </div>
            <Stars value={employer.ratingAvg} count={employer.ratingCount} />
            <div className="job-meta" style={{ color: 'var(--ink)' }}>
              {c.address && <span className="ico-row"><MapPin size={16} />{[c.address, c.district, c.city].filter(Boolean).join(', ')}</span>}
              {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="ico-row" style={{ textDecoration: 'underline' }}><Globe size={16} />{c.website}</a>}
              <span>Tham gia {date(employer.createdAt)}</span>
            </div>
            {c.description && <p className="pre" style={{ margin: 0, fontSize: 17, maxWidth: 680 }}>{c.description}</p>}
            {user && user.role !== 'ADMIN' && String(user._id) !== String(employer._id) && (
              <div><button className="btn-link small ico-row" style={{ color: 'var(--ink)' }} onClick={() => this.setState({ report: true })}><Flag size={14} />Báo cáo</button></div>
            )}
          </div>
          <span className="pub-hero-art" aria-hidden="true"><Mascot kind="cloud" size={160} /></span>
        </header>

        <section className="section">
          <h2 className="display">Đang tuyển ({openJobs.length})</h2>
          {openJobs.length ? (
            <div className="jobs-grid">{openJobs.map((j, i) => <JobTile key={j._id} job={j} badge />)}</div>
          ) : <div className="card" style={{ marginTop: 24 }}><Empty title="Chưa có tin đang tuyển" /></div>}
        </section>

        <section className="section">
          <h2 className="display">Đánh giá từ sinh viên</h2>
          {!reviews.length && <p className="muted" style={{ marginTop: 16 }}>Chưa có đánh giá nào.</p>}
          <div className="pub-grid">
            {reviews.map((r) => (
              <figure key={r._id} className="voice" style={{ minHeight: 0 }}>
                <blockquote>{r.comment ? `“${r.comment}”` : <span className="fog">Không có bình luận</span>}</blockquote>
                <figcaption className="row" style={{ flexWrap: 'nowrap' }}>
                  <Avatar src={r.reviewerId?.avatarUrl} name={r.reviewerId?.fullName} />
                  <div><div className="small">{r.reviewerId?.fullName}</div><Stars value={r.rating} /> <span className="fog tiny">· {timeAgo(r.createdAt)}</span></div>
                </figcaption>
              </figure>
            ))}
          </div>
          <Pagination meta={meta} onPage={this.load} />
        </section>
        {report && <ReportModal targetType="USER" targetId={employer._id} onClose={() => this.setState({ report: false })} />}
      </div>
    );
  }
}

export default withRouter(EmployerPublicPage);
