import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, AppBadge, Tabs, Pagination, Avatar, Stars, JobBadge, BackLink, ErrorState } from '../../components/ui';
import ErrorPage from '../public/ErrorPage';
import { timeAgo, statusTabs, APP_STATUS } from '../../utils/format';
import { param, intParam, setParams } from '../../utils/urlState';
import withRouter from '../../utils/withRouter';

// Nhãn tab trùng nhãn badge (Đang chờ / Được nhận / Bị từ chối…)
const TABS = statusTabs(APP_STATUS, ['PENDING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'NOT_COMPLETED', 'WITHDRAWN']);

// SCR-E05 / FR-APP-04
class ApplicantsPage extends Component {
  state = { items: null, meta: null, error: null };
  req = 0;
  componentDidMount() { this.load(); }
  componentDidUpdate(prev) {
    if (prev.searchParams.toString() !== this.props.searchParams.toString() || prev.params.id !== this.props.params.id) this.load();
  }
  load = async () => {
    const id = ++this.req;
    this.setState({ items: null, error: null });
    try {
      const r = await api.get(`/jobs/${this.props.params.id}/applications${qs({ status: param(this.props, 'tab'), page: intParam(this.props, 'page') })}`);
      if (id === this.req) this.setState({ items: r.data, meta: r.meta });
    } catch (error) {
      if (id === this.req) this.setState({ error });
    }
  };
  render() {
    const { items, meta, error } = this.state;
    const status = param(this.props, 'tab');
    // Chỉ 403/404 mới là trang lỗi; lỗi mạng/máy chủ cho thử lại
    if (error && [403, 404].includes(error.status)) return <ErrorPage code={error.status} message={error.message} />;
    const job = meta?.job;
    return (
      <div className="container page">
        <BackLink to="/employer/jobs">Tin tuyển dụng</BackLink>
        {job && (
          <header className="emp-head emp-mt16 emp-mb16">
            <div className="stack">
              <div className="row"><JobBadge status={job.status} /><span className="muted small">Đã nhận {job.acceptedCount}/{job.slots} người</span></div>
              <h1 className="display">{job.title}</h1>
            </div>
            <Link to={`/jobs/${job._id}`} className="btn btn-ghost">Xem tin</Link>
          </header>
        )}
        <div className="emp-mb20"><Tabs items={TABS} value={status} onChange={(s) => setParams(this.props, { tab: s, page: '' }, false)} /></div>
        {error ? <ErrorState error={error} onRetry={this.load} /> : !items ? <Spinner /> : !items.length ? (
          <div className="card">
            <Empty title={status ? `Chưa có ứng viên ở trạng thái “${APP_STATUS[status][0]}”` : 'Chưa có ứng viên'}>
              {status ? <button type="button" className="accent" onClick={() => setParams(this.props, { tab: '', page: '' })}>Xem tất cả ứng viên</button> : 'Ứng viên sẽ xuất hiện ở đây khi có người nộp đơn.'}
            </Empty>
          </div>
        ) : (
          <div className="grid-2">
            {items.map((a) => {
              const s = a.studentId || {};
              return (
                <Link key={a._id} to={`/employer/applications/${a._id}`} className="job-card stack">
                  <div className="row emp-nowrap">
                    <Avatar src={s.avatarUrl} name={s.fullName} />
                    <div className="emp-grow">
                      <div className="h-sm emp-ellipsis">{s.fullName || 'Sinh viên đã xóa tài khoản'}</div>
                      <Stars value={s.ratingAvg} count={s.ratingCount} />
                    </div>
                    <AppBadge status={a.status} />
                  </div>
                  <div className="muted small">{[s.student?.school, s.student?.major, s.student?.yearOfStudy && `năm ${s.student.yearOfStudy}`].filter(Boolean).join(', ')}</div>
                  {s.student?.skills?.length > 0 && <div className="row emp-gap6">{s.student.skills.slice(0, 5).map((k) => <span key={k} className="chip tiny">{k}</span>)}</div>}
                  {a.coverLetter && <p className="muted small emp-clamp2">“{a.coverLetter}”</p>}
                  <div className="fog tiny">Nộp {timeAgo(a.createdAt)}</div>
                </Link>
              );
            })}
          </div>
        )}
        <Pagination meta={meta} onPage={(n) => setParams(this.props, { page: n === 1 ? '' : n })} />
      </div>
    );
  }
}

export default withRouter(ApplicantsPage);
