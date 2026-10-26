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

const rating1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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
        {/* Đầu trang trên nền tối: logo, tên, địa chỉ; dưới là hàng số liệu chia vạch dọc */}
        <header className="pub-co-head">
          <div className="pub-logo-lg">
            {c.logoUrl ? <img src={c.logoUrl} alt="" /> : (c.name || employer.fullName || '?')[0]}
          </div>
          <div className="pub-co-main">
            {employer.isPremium && <span className="chip chip-featured">★ Premium</span>}
            <h1 className="display">{c.name || employer.fullName}</h1>
            <div className="pub-co-meta">
              {c.address && <span className="ico-row"><MapPin size={16} aria-hidden="true" />{[c.address, c.district, c.city].filter(Boolean).join(', ')}</span>}
              {c.website && <a href={c.website} target="_blank" rel="noreferrer" className="ico-row text-link"><Globe size={16} aria-hidden="true" />{c.website}</a>}
            </div>
          </div>
          {user && user.role !== 'ADMIN' && String(user._id) !== String(employer._id) && (
            <button className="btn btn-ghost btn-sm" onClick={() => this.setState({ report: true })}><Flag size={14} aria-hidden="true" />Báo cáo</button>
          )}
        </header>

        <dl className="stat-row pub-co-stats">
          <div><dt className="pub-co-stat-label">Đang tuyển</dt><dd className="stat-num">{openJobs.length}</dd></div>
          <div><dt className="pub-co-stat-label">Đánh giá</dt><dd className="stat-num">{employer.ratingCount ? rating1.format(employer.ratingAvg) : '–'}</dd><dd className="stat-label">{employer.ratingCount ? `${employer.ratingCount} đánh giá` : 'Chưa có đánh giá'}</dd></div>
          <div><dt className="pub-co-stat-label">Tham gia</dt><dd className="stat-num pub-co-date">{date(employer.createdAt)}</dd></div>
        </dl>

        {c.description && (
          <section className="pub-row" aria-labelledby="pub-about">
            <h2 id="pub-about" className="pub-row-label">Giới thiệu công ty</h2>
            <p className="pre pub-row-text">{c.description}</p>
          </section>
        )}

        <section className="pub-sec-block" aria-labelledby="pub-open">
          <span className="eyebrow">Việc làm</span>
          <h2 id="pub-open" className="display">Đang tuyển ({openJobs.length})</h2>
          {openJobs.length ? (
            <div className="jobs-grid">{openJobs.map((j) => <JobTile key={j._id} job={j} badge />)}</div>
          ) : <div className="card" style={{ marginTop: 24 }}><Empty title="Chưa có tin đang tuyển" /></div>}
        </section>

        <section className="pub-sec-block" aria-labelledby="pub-reviews">
          <span className="eyebrow">Đánh giá</span>
          <h2 id="pub-reviews" className="display">Đánh giá từ sinh viên</h2>
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
