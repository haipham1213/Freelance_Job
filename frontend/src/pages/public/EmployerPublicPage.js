import React, { Component } from 'react';
import { Flag, Globe, MapPin } from 'lucide-react';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Stars, Empty, Avatar, Pagination } from '../../components/ui';
import JobTile from '../../components/JobTile';
import ReportModal from '../../components/ReportModal';
import ErrorPage from './ErrorPage';
import { date, timeAgo } from '../../utils/format';
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
        <header className="card">
          <div className="pub-company-body">
            <div className="pub-logo-lg">
              {c.logoUrl ? <img src={c.logoUrl} alt="" /> : (c.name || employer.fullName || '?')[0]}
            </div>
            <div className="stack" style={{ minWidth: 0, flex: 1 }}>
              <div className="row">
                <h1 className="display">{c.name || employer.fullName}</h1>
                {employer.isPremium && <span className="chip chip-featured">★ Premium</span>}
              </div>
              <Stars value={employer.ratingAvg} count={employer.ratingCount} />
              <div className="job-meta">
                {c.address && <span className="ico-row"><MapPin size={16} />{[c.address, c.district, c.city].filter(Boolean).join(', ')}</span>}
                {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="ico-row accent"><Globe size={16} />{c.website}</a>}
                <span>Tham gia {date(employer.createdAt)}</span>
              </div>
            </div>
            {user && user.role !== 'ADMIN' && String(user._id) !== String(employer._id) && (
              <button className="btn-link small ico-row" style={{ color: 'var(--muted)' }} onClick={() => this.setState({ report: true })}><Flag size={14} />Báo cáo</button>
            )}
          </div>
        </header>

        {c.description && (
          <section className="card section">
            <h2 className="pub-sec" style={{ marginTop: 0 }}>Giới thiệu công ty</h2>
            <p className="pre muted" style={{ margin: 0 }}>{c.description}</p>
          </section>
        )}

        <section className="section">
          <h2 className="h-lg">Đang tuyển ({openJobs.length})</h2>
          {openJobs.length ? (
            <div className="jobs-grid">{openJobs.map((j) => <JobTile key={j._id} job={j} badge />)}</div>
          ) : <div className="card" style={{ marginTop: 16 }}><Empty title="Chưa có tin đang tuyển" /></div>}
        </section>

        <section className="section">
          <h2 className="h-lg">Đánh giá từ sinh viên</h2>
          {!reviews.length && <p className="muted" style={{ marginTop: 16 }}>Chưa có đánh giá nào.</p>}
          <div className="pub-grid">
            {reviews.map((r) => (
              <figure key={r._id} className="voice">
                <blockquote>{r.comment ? `“${r.comment}”` : <span className="fog">Không có bình luận</span>}</blockquote>
                <figcaption className="row" style={{ flexWrap: 'nowrap' }}>
                  <Avatar src={r.reviewerId?.avatarUrl} name={r.reviewerId?.fullName} />
                  <div><div className="small">{r.reviewerId?.fullName}</div><Stars value={r.rating} /> <span className="fog tiny">{timeAgo(r.createdAt)}</span></div>
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
