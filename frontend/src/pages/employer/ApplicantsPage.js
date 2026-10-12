import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, AppBadge, Tabs, Pagination, Avatar, Stars, JobBadge, BackLink } from '../../components/ui';
import ErrorPage from '../public/ErrorPage';
import { timeAgo } from '../../utils/format';
import withRouter from '../../utils/withRouter';

const TABS = [['', 'Tất cả'], ['PENDING', 'Chờ duyệt'], ['ACCEPTED', 'Đã nhận'], ['REJECTED', 'Từ chối'], ['COMPLETED', 'Hoàn thành'], ['NOT_COMPLETED', 'Không hoàn thành'], ['WITHDRAWN', 'Đã rút']];

// SCR-E05 / FR-APP-04
class ApplicantsPage extends Component {
  state = { status: '', items: null, meta: null, error: null };
  componentDidMount() { this.load(1); }
  load = async (page) => {
    try {
      const r = await api.get(`/jobs/${this.props.params.id}/applications${qs({ status: this.state.status, page })}`);
      this.setState({ items: r.data, meta: r.meta });
    } catch (error) {
      this.setState({ error });
    }
  };
  render() {
    const { items, meta, status, error } = this.state;
    if (error) return <ErrorPage code={error.status === 403 ? 403 : 404} message={error.message} />;
    const job = meta?.job;
    return (
      <div className="container page">
        <BackLink to="/employer/jobs">Tin tuyển dụng</BackLink>
        {job && (
          <section className="card emp-head" style={{ marginTop: 12 }}>
            <div className="stack">
              <div className="row"><JobBadge status={job.status} /><span>Đã nhận {job.acceptedCount}/{job.slots} người</span></div>
              <h1 className="h-lg">{job.title}</h1>
            </div>
            <Link to={`/jobs/${job._id}`} className="btn btn-ghost">Xem tin</Link>
          </section>
        )}
        <div style={{ margin: '20px 0 16px' }}><Tabs items={TABS} value={status} onChange={(s) => this.setState({ status: s, items: null }, () => this.load(1))} /></div>
        {!items ? <Spinner /> : !items.length ? <div className="card"><Empty title="Chưa có ứng viên" /></div> : (
          <div className="grid-2">
            {items.map((a) => {
              const s = a.studentId || {};
              return (
                <Link key={a._id} to={`/employer/applications/${a._id}`} className="job-card stack">
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <Avatar src={s.avatarUrl} name={s.fullName} />
                    <div style={{ flex: 1 }}>
                      <div className="h-sm">{s.fullName}</div>
                      <Stars value={s.ratingAvg} count={s.ratingCount} />
                    </div>
                    <AppBadge status={a.status} />
                  </div>
                  <div className="muted small">{[s.student?.school, s.student?.major, s.student?.yearOfStudy && `năm ${s.student.yearOfStudy}`].filter(Boolean).join(' · ')}</div>
                  {s.student?.skills?.length > 0 && <div className="row" style={{ gap: 6 }}>{s.student.skills.slice(0, 5).map((k) => <span key={k} className="chip tiny">{k}</span>)}</div>}
                  {a.coverLetter && <p className="muted small" style={{ overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>“{a.coverLetter}”</p>}
                  <div className="fog tiny">Nộp {timeAgo(a.createdAt)}</div>
                </Link>
              );
            })}
          </div>
        )}
        <Pagination meta={meta} onPage={this.load} />
      </div>
    );
  }
}

export default withRouter(ApplicantsPage);
