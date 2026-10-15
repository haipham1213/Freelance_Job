import React, { Component } from 'react';
import { ArrowRight, Building2, CalendarDays, Clock, Flag, Heart, Hourglass, MapPin, ShieldCheck, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Stars, JobBadge, AppBadge, Modal, Field, Alert, BackLink } from '../../components/ui';
import JobTile from '../../components/JobTile';
import { categoryIcon } from '../../components/Illustrations';
import ReportModal from '../../components/ReportModal';
import ErrorPage from './ErrorPage';
import { date, salary, timeAgo, describeShifts, jobStatusOf } from '../../utils/format';
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

const DAY = 864e5;
// Hai cam kết liên quan trực tiếp tới lúc nộp đơn (BR-12, không thu phí)
const PROMISES = ['Không phí, không đặt cọc. Bị đòi tiền thì báo cáo tin ngay.', 'Số điện thoại hai bên chỉ hiện khi bạn được nhận.'];

class JobDetailPage extends Component {
  static contextType = AuthContext;
  state = { data: null, error: null, modal: null, flash: '', similar: [] };

  componentDidMount() { this.load(); }
  // Tải lại khi đổi tin hoặc khi phiên đăng nhập vừa khôi phục xong (mở thẳng link: API gọi trước khi có token,
  // nên myApplication / isSaved của sinh viên bị thiếu)
  componentDidUpdate(prev) {
    if (prev.params.id !== this.props.params.id || (this.context.user?._id || null) !== this.loadedFor) this.load();
  }

  load = async () => {
    this.loadedFor = this.context.user?._id || null;
    try {
      const r = await api.get(`/jobs/${this.props.params.id}`);
      this.setState({ data: r.data, error: null });
      // Việc tương tự: cùng ngành, bỏ chính tin đang xem
      const s = await api.get(`/jobs${qs({ categoryId: r.data.job.categoryId, limit: 4 })}`).catch(() => ({ data: [] }));
      this.setState({ similar: s.data.filter((j) => j._id !== r.data.job._id).slice(0, 3) });
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

  // Nút hành động theo vai trò và trạng thái đơn; dùng chung cho khung bên phải và thanh dưới trên mobile
  actions(compact) {
    const { user } = this.context;
    const { data } = this.state;
    const { job, myApplication } = data;
    const next = encodeURIComponent(this.props.location.pathname);
    const open = jobStatusOf(job) === 'OPEN';
    if (!user) return open ? <Link to={`/login?next=${next}`} className="btn btn-lg btn-block">Đăng nhập để ứng tuyển</Link> : null;
    if (user.role === 'STUDENT') {
      const save = <button type="button" className={`btn btn-ghost ${compact ? 'jd-icon-btn' : 'btn-lg btn-block'}`} onClick={this.toggleSave} aria-pressed={!!data.isSaved} aria-label={data.isSaved ? 'Bỏ lưu tin' : 'Lưu tin'}><Heart size={18} fill={data.isSaved ? 'currentColor' : 'none'} aria-hidden="true" />{!compact && (data.isSaved ? 'Đã lưu' : 'Lưu tin')}</button>;
      const main = myApplication
        ? <Link to={`/student/applications/${myApplication._id}`} className="btn btn-lg btn-block btn-ghost">Đã ứng tuyển, xem đơn <AppBadge status={myApplication.status} /></Link>
        : open ? <button type="button" className="btn btn-lg btn-block" onClick={() => this.setState({ modal: 'apply' })} disabled={!user.emailVerified}>Ứng tuyển ngay</button> : null;
      return <div className={compact ? 'jd-bar-actions' : 'jd-actions'}>{main}{save}</div>;
    }
    if (user.role === 'EMPLOYER' && String(job.employerId) === String(user._id)) {
      return (
        <div className={compact ? 'jd-bar-actions' : 'jd-actions'}>
          <Link to={`/employer/jobs/${job._id}/applicants`} className="btn btn-lg btn-block">Xem ứng viên ({job.applicationCount})</Link>
          {!compact && <Link to={`/employer/jobs/${job._id}/edit`} className="btn btn-lg btn-block btn-ghost">Sửa tin</Link>}
        </div>
      );
    }
    return null;
  }

  render() {
    const { data, error, modal, flash, similar } = this.state;
    if (error) return <ErrorPage code={error.status === 404 ? 404 : 500} message={error.message} />;
    if (!data) return <Spinner />;
    const { job, employer, category } = data;
    const { user } = this.context;
    const status = jobStatusOf(job);
    const company = employer.company || {};
    const canReport = user && ['STUDENT', 'EMPLOYER'].includes(user.role) && String(job.employerId) !== String(user._id);
    const daysLeft = Math.max(0, Math.ceil((new Date(job.expiresAt) - Date.now()) / DAY));
    const Icon = categoryIcon(category?.name);
    const facts = [
      [Clock, 'Ca làm', describeShifts(job.shifts) || job.schedule ? <>{describeShifts(job.shifts)}{job.shifts?.length > 0 && job.schedule && <br />}{job.schedule && <span className={job.shifts?.length ? 'muted' : ''}>{job.schedule}</span>}</> : 'Thỏa thuận khi phỏng vấn'],
      [MapPin, 'Địa điểm', [job.address, job.district, job.city].filter(Boolean).join(', ')],
      [CalendarDays, 'Thời gian', `Từ ${date(job.startDate)}${job.endDate ? ` đến ${date(job.endDate)}` : ''}`],
      [Users, 'Số chỗ', job.remainingSlots > 0 ? `Còn ${job.remainingSlots}/${job.slots} chỗ` : 'Đã đủ người'],
      [Hourglass, 'Hạn nhận hồ sơ', `${date(job.expiresAt)}${status === 'OPEN' ? `, còn ${daysLeft} ngày` : ''}`],
    ];
    const bar = status === 'OPEN' && this.actions(true);
    return (
      <div className={`container page jd ${bar ? 'jd-has-bar' : ''}`}>
        <BackLink to="/jobs">Danh sách việc</BackLink>

        <header className="jd-head">
          <span className="jd-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : <Icon size={30} aria-hidden="true" />}</span>
          <div className="jd-head-main">
            <div className="jd-tags">
              {job.isFeatured && <span className="chip chip-featured">★ Nổi bật</span>}
              {status !== 'OPEN' && <JobBadge status={status} />}
              {category && <Link to={`/jobs?categoryId=${category._id}`} className="chip">{category.name}</Link>}
            </div>
            <h1 className="jd-title">{job.title}</h1>
            <p className="jd-meta">
              <Link to={`/employers/${employer._id}`} className="jd-company">{company.name || employer.fullName}</Link>
              {employer.ratingCount > 0 && <span>★ {employer.ratingAvg.toFixed(1)} ({employer.ratingCount} đánh giá)</span>}
              <span>Đăng {timeAgo(job.createdAt)}</span>
              <span>{job.viewCount} lượt xem</span>
            </p>
          </div>
        </header>

        <div className="jd-grid">
          <article className="jd-main">
            {/* Lương đã nằm ở khung ứng tuyển nên bảng này chỉ còn ca làm, địa điểm và các mốc thời gian */}
            <dl className="jx-facts jd-facts">
              {facts.map(([I, k, v]) => <div key={k}><dt><I size={16} aria-hidden="true" />{k}</dt><dd>{v}</dd></div>)}
            </dl>
            <h2 className="jd-h2">Mô tả công việc</h2>
            <p className="jd-text">{job.description}</p>
            {job.requirements && <><h2 className="jd-h2">Yêu cầu</h2><p className="jd-text">{job.requirements}</p></>}

            <h2 className="jd-h2">Về nhà tuyển dụng</h2>
            <div className="jd-company-card">
              <span className="jd-logo jd-logo-sm">{company.logoUrl ? <img src={company.logoUrl} alt="" /> : <Building2 size={22} aria-hidden="true" />}</span>
              <div className="jd-company-body">
                <Link to={`/employers/${employer._id}`} className="jd-company-name">{company.name || employer.fullName}</Link>
                <div className="jd-company-meta">
                  <Stars value={employer.ratingAvg} count={employer.ratingCount} />
                  {employer.isPremium && <span className="chip chip-featured tiny">★ Premium</span>}
                </div>
                {company.address && <p className="jd-muted"><MapPin size={14} aria-hidden="true" />{[company.address, company.district, company.city].filter(Boolean).join(', ')}</p>}
                {company.description && <p className="jd-text jd-clamp">{company.description}</p>}
                <Link to={`/employers/${employer._id}`} className="accent small">Xem trang công ty và các tin khác</Link>
              </div>
            </div>
          </article>

          <aside className="jd-aside" aria-label="Ứng tuyển">
            <div className="jd-apply">
              <span className="jd-apply-label">Mức lương</span>
              <strong className="jd-pay"><span className="hl">{salary(job)}</span></strong>
              <p className="jd-apply-meta">
                {job.remainingSlots > 0 ? `Còn ${job.remainingSlots}/${job.slots} chỗ` : 'Đã đủ người'}
                {status === 'OPEN' && <>, hạn còn {daysLeft} ngày</>}
              </p>
              <Alert type="info">{flash}</Alert>
              {this.actions(false)}
              {user?.role === 'STUDENT' && !user.emailVerified && !data.myApplication && <p className="jd-note">Xác thực email để ứng tuyển.</p>}
              {status !== 'OPEN' && <p className="jd-note">Tin này không còn nhận hồ sơ. Xem các việc tương tự bên dưới.</p>}
              <ul className="jd-promises">
                {PROMISES.map((t) => <li key={t}><ShieldCheck size={16} aria-hidden="true" />{t}</li>)}
              </ul>
              {canReport && <button type="button" className="jd-report" onClick={() => this.setState({ modal: 'report' })}><Flag size={14} aria-hidden="true" />Báo cáo tin này</button>}
            </div>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="jd-similar" aria-labelledby="jd-similar">
            <div className="row-between">
              <h2 id="jd-similar" className="jd-h2">Việc tương tự</h2>
              {category && <Link to={`/jobs?categoryId=${category._id}`} className="accent small">Xem thêm việc {category.name.toLowerCase()}</Link>}
            </div>
            <div className="jobs-grid">{similar.map((j) => <JobTile key={j._id} job={j} category={category?.name} badge />)}</div>
          </section>
        )}

        {bar && (
          <div className="jd-bar">
            <span className="jd-bar-pay"><span className="hl">{salary(job)}</span><small>Còn {daysLeft} ngày</small></span>
            {bar}
          </div>
        )}

        {modal === 'apply' && <ApplyModal jobId={job._id} onClose={() => this.setState({ modal: null })} onDone={() => { this.setState({ modal: null, flash: 'Đã gửi đơn ứng tuyển. Theo dõi trạng thái trong "Đơn của tôi".' }); this.load(); }} />}
        {modal === 'report' && <ReportModal targetType="JOB" targetId={job._id} onClose={() => this.setState({ modal: null })} />}
      </div>
    );
  }
}

export default withRouter(JobDetailPage);
