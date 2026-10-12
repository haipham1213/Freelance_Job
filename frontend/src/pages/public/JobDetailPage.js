import React, { Component } from 'react';
import { ArrowRight, CalendarDays, Clock, Flag, Heart, Hourglass, MapPin, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Stars, CompanyLogo, JobBadge, AppBadge, Modal, Field, Alert, BackLink } from '../../components/ui';
import ReportModal from '../../components/ReportModal';
import ErrorPage from './ErrorPage';
import { money, date, SALARY_TYPE, jobStatusOf } from '../../utils/format';
import withRouter from '../../utils/withRouter';

class ApplyModal extends Component {
  state = { coverLetter: '', error: null, busy: false };
  submit = async (e) => {
    e.preventDefault();
    this.setState({ busy: true, error: null });
    try {
      await api.post(`/jobs/${this.props.jobId}/applications`, { coverLetter: this.state.coverLetter || undefined });
      this.props.onDone();
    } catch (err) {
      this.setState({ error: err, busy: false });
    }
  };
  render() {
    const { error } = this.state;
    return (
      <Modal title="Ứng tuyển" onClose={this.props.onClose}>
        <form className="stack" onSubmit={this.submit}>
          <p className="muted small">Nhà tuyển dụng sẽ nhận CV hiện tại trong hồ sơ của bạn cùng thư giới thiệu.</p>
          <Field label="Thư giới thiệu (không bắt buộc)">
            <textarea className="textarea" maxLength={1000} placeholder="Giới thiệu ngắn về bạn, thời gian có thể đi làm…" value={this.state.coverLetter} onChange={(e) => this.setState({ coverLetter: e.target.value })} />
          </Field>
          <div className="fog tiny">{this.state.coverLetter.length}/1000</div>
          {error && (
            <Alert>
              {error.message}{' '}
              {error.code === 'CV_REQUIRED' && <Link to="/student/profile" className="accent ico-row" style={{ display: 'inline-flex' }}>Tải CV ngay <ArrowRight size={16} /></Link>}
            </Alert>
          )}
          <button className="btn" disabled={this.state.busy}>Gửi đơn ứng tuyển</button>
        </form>
      </Modal>
    );
  }
}

class JobDetailPage extends Component {
  static contextType = AuthContext;
  state = { data: null, error: null, modal: null, flash: '' };

  componentDidMount() { this.load(); }
  componentDidUpdate(prev) { if (prev.params.id !== this.props.params.id) this.load(); }

  load = async () => {
    try {
      const r = await api.get(`/jobs/${this.props.params.id}`);
      this.setState({ data: r.data, error: null });
    } catch (error) {
      this.setState({ error });
    }
  };

  toggleSave = async () => {
    const { data } = this.state;
    const path = `/students/me/saved-jobs/${data.job._id}`;
    try {
      await (data.isSaved ? api.del(path) : api.put(path));
      this.setState({ data: { ...data, isSaved: !data.isSaved } });
    } catch (e) {
      this.setState({ flash: e.message });
    }
  };

  actions() {
    const { user } = this.context;
    const { data } = this.state;
    const { job, myApplication } = data;
    const next = encodeURIComponent(this.props.location.pathname);
    if (!user) return <Link to={`/login?next=${next}`} className="btn btn-block">Đăng nhập để ứng tuyển</Link>;
    if (user.role === 'STUDENT') {
      return (
        <div className="stack">
          {myApplication ? (
            <Link to={`/student/applications/${myApplication._id}`} className="btn btn-block btn-ghost">Đã ứng tuyển · <AppBadge status={myApplication.status} /></Link>
          ) : jobStatusOf(job) === 'OPEN' ? (
            <button className="btn btn-block" onClick={() => this.setState({ modal: 'apply' })} disabled={!user.emailVerified}>Ứng tuyển ngay</button>
          ) : null}
          {!user.emailVerified && !myApplication && <div className="fog tiny center">Xác thực email để ứng tuyển</div>}
          <button className="btn btn-block btn-ghost" onClick={this.toggleSave}><Heart size={18} fill={data.isSaved ? 'currentColor' : 'none'} />{data.isSaved ? 'Đã lưu' : 'Lưu tin'}</button>
        </div>
      );
    }
    if (user.role === 'EMPLOYER' && String(job.employerId) === String(user._id)) {
      return (
        <div className="stack">
          <Link to={`/employer/jobs/${job._id}/applicants`} className="btn btn-block">Xem ứng viên ({job.applicationCount})</Link>
          <Link to={`/employer/jobs/${job._id}/edit`} className="btn btn-block btn-ghost">Sửa tin</Link>
        </div>
      );
    }
    return null;
  }

  render() {
    const { data, error, modal, flash } = this.state;
    if (error) return <ErrorPage code={error.status === 404 ? 404 : 500} message={error.message} />;
    if (!data) return <Spinner />;
    const { job, employer, category } = data;
    const { user } = this.context;
    const status = jobStatusOf(job);
    const canReport = user && ['STUDENT', 'EMPLOYER'].includes(user.role) && String(job.employerId) !== String(user._id);
    const info = [
      [Wallet, 'Mức lương', `${money(job.salaryMin)}${job.salaryMax !== job.salaryMin ? ` - ${money(job.salaryMax)}` : ''} / ${SALARY_TYPE[job.salaryType]}`],
      [MapPin, 'Địa điểm', [job.address, job.district, job.city].filter(Boolean).join(', ')],
      [Clock, 'Ca làm', job.schedule || 'Thỏa thuận'],
      [CalendarDays, 'Bắt đầu', `${date(job.startDate)}${job.endDate ? ` → ${date(job.endDate)}` : ''}`],
      [Users, 'Số chỗ còn', `${job.remainingSlots}/${job.slots}`],
      [Hourglass, 'Hạn nhận hồ sơ', date(job.expiresAt)],
    ];
    const key = info.filter(([, k]) => ['Mức lương', 'Địa điểm', 'Hạn nhận hồ sơ'].includes(k));
    return (
      <div className="container page">
        <BackLink to="/jobs">Danh sách việc</BackLink>
        <header className="card pub-head">
          <CompanyLogo src={employer.company?.logoUrl} name={employer.company?.name} />
          <div className="pub-head-main">
            <div className="row">
              {job.isFeatured && <span className="chip chip-featured">★ Nổi bật</span>}
              {status !== 'OPEN' && <JobBadge status={status} />}
              {category && <Link to={`/jobs?categoryId=${category._id}`} className="chip">{category.name}</Link>}
              <span className="fog small">{job.viewCount} lượt xem</span>
            </div>
            <h1 className="display">{job.title}</h1>
            <Link to={`/employers/${employer._id}`} className="muted">{employer.company?.name || employer.fullName}</Link>
            <div className="pub-key">
              {key.map(([Ico, k, v]) => (
                <div key={k} className="pub-key-item">
                  <span className="pub-key-icon"><Ico size={20} /></span>
                  <span><span className="fog small">{k}</span><strong>{v}</strong></span>
                </div>
              ))}
            </div>
          </div>
          <div className="pub-head-actions">
            <Alert type="info">{flash}</Alert>
            {this.actions()}
          </div>
        </header>
        <div className="layout-main" style={{ marginTop: 20 }}>
          <article className="card pub-body">
            <h2 className="pub-sec">Mô tả công việc</h2>
            <p className="pre">{job.description}</p>
            {job.requirements && (
              <>
                <h2 className="pub-sec">Yêu cầu</h2>
                <p className="pre">{job.requirements}</p>
              </>
            )}
          </article>
          <aside className="stack-lg pub-aside">
            <div className="card stack">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <CompanyLogo src={employer.company?.logoUrl} name={employer.company?.name} />
                <div style={{ minWidth: 0 }}>
                  <Link to={`/employers/${employer._id}`} className="h-sm">{employer.company?.name || employer.fullName}</Link>
                  {employer.isPremium && <div className="accent tiny">★ Nhà tuyển dụng Premium</div>}
                </div>
              </div>
              <Stars value={employer.ratingAvg} count={employer.ratingCount} />
              {employer.company?.address && <div className="muted small ico-row"><MapPin size={14} />{employer.company.address}</div>}
              <Link to={`/employers/${employer._id}`} className="btn btn-ghost btn-sm">Xem trang công ty</Link>
            </div>
            <div className="card">
              <h2 className="h-sm">Thông tin chung</h2>
              <ul className="pub-facts">
                {info.map(([Ico, k, v]) => (
                  <li key={k}>
                    <span className="pub-key-icon"><Ico size={18} /></span>
                    <span><span className="fog small">{k}</span><span>{v}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            {canReport && <button className="btn-link small ico-row" style={{ color: 'var(--muted)' }} onClick={() => this.setState({ modal: 'report' })}><Flag size={14} />Báo cáo tin này</button>}
          </aside>
        </div>
        {modal === 'apply' && <ApplyModal jobId={job._id} onClose={() => this.setState({ modal: null })} onDone={() => { this.setState({ modal: null, flash: 'Đã gửi đơn ứng tuyển! Theo dõi trạng thái trong "Đơn của tôi".' }); this.load(); }} />}
        {modal === 'report' && <ReportModal targetType="JOB" targetId={job._id} onClose={() => this.setState({ modal: null })} />}
      </div>
    );
  }
}

export default withRouter(JobDetailPage);
