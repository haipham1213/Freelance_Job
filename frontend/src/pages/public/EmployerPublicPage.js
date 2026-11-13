import React, { Component } from 'react';
import { Flag, Globe, MapPin } from 'lucide-react';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Stars, Empty, Avatar, Pagination, ErrorState } from '../../components/ui';
import { JobCard } from '../../components/JobRow';
import ReportModal from '../../components/ReportModal';
import ErrorPage from './ErrorPage';
import { date, timeAgo } from '../../utils/format';
import withRouter from '../../utils/withRouter';

// Chỉ nhận liên kết http/https (người dùng tự nhập); trả { href, host } hoặc null
const safeSite = (raw) => {
  try {
    const u = new URL(raw);
    return /^https?:$/.test(u.protocol) ? { href: u.href, host: u.host.replace(/^www\./, '') } : null;
  } catch { return null; }
};

const rating1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// SCR-C06 / FR-PRO-04
class EmployerPublicPage extends Component {
  static contextType = AuthContext;
  state = { data: null, meta: null, error: null, pageError: null, report: false };
  componentDidMount() { this.load(1); }
  // Đổi :id trong cùng route: bỏ dữ liệu cũ rồi tải lại
  componentDidUpdate(prev) {
    if (prev.params.id !== this.props.params.id) {
      this.setState({ data: null, meta: null, error: null, pageError: null });
      this.load(1);
    }
  }
  load = async (page) => {
    const id = this.props.params.id;
    try {
      const r = await api.get(`/employers/${id}?page=${page}`);
      if (id !== this.props.params.id) return;
      const c = r.data.employer.company || {};
      document.title = `${c.name || r.data.employer.fullName || 'Nhà tuyển dụng'} – UniShift`;
      this.setState({ data: r.data, meta: r.meta, error: null, pageError: null });
    } catch (error) {
      if (id !== this.props.params.id) return;
      // Lỗi khi chuyển trang đánh giá không được thay cả trang
      this.setState(this.state.data ? { pageError: error } : { error });
    }
  };
  retry = () => { this.setState({ error: null }); this.load(1); };
  render() {
    const { data, meta, error, pageError, report } = this.state;
    if (error) {
      return error.status === 404 ? <ErrorPage code={404} message={error.message} /> : (
        <div className="container page"><ErrorState error={error} onRetry={this.retry} /></div>
      );
    }
    if (!data) return <Spinner />;
    const { employer, openJobs, reviews } = data;
    const c = employer.company || {};
    const user = this.context.user;
    const site = c.website ? safeSite(c.website) : null;
    const name = c.name || employer.fullName;
    const openTotal = meta?.openJobsTotal ?? openJobs.length;
    return (
      <div className="container page">
        {/* Đầu trang trên nền tối: logo, tên, địa chỉ; dưới là hàng số liệu chia vạch dọc */}
        <header className="pub-co-head">
          <div className="pub-logo-lg">
            {c.logoUrl ? <img src={c.logoUrl} alt="" /> : <Avatar name={name || '?'} size="lg" />}
          </div>
          <div className="pub-co-main">
            {employer.isPremium && <span className="chip chip-featured">Premium</span>}
            <h1 className="display">{c.name || employer.fullName}</h1>
            <div className="pub-co-meta">
              {c.address && <span className="ico-row"><MapPin size={16} aria-hidden="true" />{[c.address, c.district, c.city].filter(Boolean).join(', ')}</span>}
              {site && <a href={site.href} target="_blank" rel="noopener noreferrer nofollow ugc" className="ico-row text-link pub-co-site" title={site.href}><Globe size={16} aria-hidden="true" /><span>{site.host}</span><span className="sr-only"> (mở trong tab mới)</span></a>}
            </div>
          </div>
          {user && user.role !== 'ADMIN' && String(user._id) !== String(employer._id) && (
            <button className="btn btn-ghost btn-sm" onClick={() => this.setState({ report: true })}><Flag size={14} aria-hidden="true" />Báo cáo nhà tuyển dụng</button>
          )}
        </header>

        <dl className="stat-row pub-co-stats">
          <div><dt className="pub-co-stat-label">Đang tuyển</dt><dd className="stat-num">{openTotal}</dd></div>
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
          <h2 id="pub-open" className="display">Đang tuyển ({openTotal})</h2>
          {openJobs.length ? (
            <>
              <ol className="pub-open-grid">{openJobs.map((j) => <li key={j._id}><JobCard job={j} /></li>)}</ol>
              {openTotal > openJobs.length && <p className="muted small pub-open-all">Đang hiển thị {openJobs.length} trong {openTotal} tin mới nhất.</p>}
            </>
          ) : <div className="card pub-empty-card"><Empty title="Chưa có tin đang tuyển" /></div>}
        </section>

        <section className="pub-sec-block" aria-labelledby="pub-reviews">
          <span className="eyebrow">Đánh giá</span>
          <h2 id="pub-reviews" className="display">Đánh giá từ sinh viên</h2>
          {!reviews.length && <p className="muted pub-muted-gap">Chưa có đánh giá nào.</p>}
          <div className="pub-grid">
            {reviews.map((r) => (
              <figure key={r._id} className="voice">
                <blockquote>{r.comment ? `“${r.comment}”` : <span className="fog">Không có bình luận</span>}</blockquote>
                <figcaption className="row pub-voice-cap">
                  <Avatar src={r.reviewerId?.avatarUrl} name={r.reviewerId?.fullName || 'Sinh viên'} />
                  <div><div className="small">{r.reviewerId?.fullName || 'Sinh viên'}</div><Stars value={r.rating} /> <span className="fog tiny">{timeAgo(r.createdAt)}</span></div>
                </figcaption>
              </figure>
            ))}
          </div>
          {pageError && <div className="pub-review-err"><ErrorState error={pageError} title="Không tải được trang đánh giá" onRetry={() => this.load(meta?.page || 1)} /></div>}
          <Pagination meta={meta} onPage={this.load} />
        </section>
        {report && <ReportModal targetType="USER" targetId={employer._id} onClose={() => this.setState({ report: false })} />}
      </div>
    );
  }
}

export default withRouter(EmployerPublicPage);
