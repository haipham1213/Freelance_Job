import React, { Component } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, CalendarClock, Check, CheckCircle2, Clock, FileText, Hourglass, Link2, MapPin, Users, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Stars, JobBadge, AppBadge, Modal, Field, Alert } from '../../components/ui';
import JobRow, { MiniWeek, PERIOD_ICON, busyOf } from '../../components/JobRow';
import { categoryIcon } from '../../components/Illustrations';
import ErrorPage from './ErrorPage';
import { date, salary, timeAgo, jobStatusOf, shiftParts } from '../../utils/format';
import withRouter from '../../utils/withRouter';

// Hộp ứng tuyển: ghi rõ việc nào và CV nào sẽ được gửi
class ApplyModal extends Component {
  state = { coverLetter: '', error: null, busy: false };
  submit = async (e) => {
    e.preventDefault();
    this.setState({ busy: true, error: null });
    try {
      await api.post(`/jobs/${this.props.job._id}/applications`, { coverLetter: this.state.coverLetter || undefined });
      this.props.onDone();
    } catch (err) {
      this.setState({ error: err, busy: false });
    }
  };
  render() {
    const { error, busy, coverLetter } = this.state;
    const { job, cv } = this.props;
    return (
      <Modal title={`Ứng tuyển: ${job.title}`} onClose={this.props.onClose}>
        <form className="stack" onSubmit={this.submit}>
          <div className="jd-cv">
            <FileText size={20} aria-hidden="true" />
            {cv?.url
              ? <span>CV sẽ gửi: <strong>{cv.fileName || 'CV trong hồ sơ'}</strong></span>
              : <span>Bạn chưa tải CV lên hồ sơ.</span>}
            <Link to="/student/profile">{cv?.url ? 'Đổi CV' : 'Tải CV'}</Link>
          </div>
          <Field label="Thư giới thiệu (không bắt buộc)">
            <textarea className="textarea" name="coverLetter" maxLength={1000} placeholder="Giới thiệu ngắn về bạn, thời gian có thể đi làm…" value={coverLetter} onChange={(e) => this.setState({ coverLetter: e.target.value })} />
          </Field>
          <div className="fog tiny" aria-live="polite">{coverLetter.length}/1000</div>
          {error && (
            <Alert>
              {error.message}{' '}
              {error.code === 'CV_REQUIRED' && <Link to="/student/profile" className="accent ico-row" style={{ display: 'inline-flex' }}>Tải CV ngay <ArrowRight size={16} aria-hidden="true" /></Link>}
            </Alert>
          )}
          <button className="btn" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đơn ứng tuyển'}</button>
        </form>
      </Modal>
    );
  }
}

const DAY = 864e5;
// Hai cam kết liên quan trực tiếp tới lúc nộp đơn (BR-12, không thu phí)
const PROMISES = ['Không phí, không đặt cọc khi ứng tuyển.', 'Số điện thoại hai bên chỉ hiện khi bạn được nhận.'];

class JobDetailPage extends Component {
  static contextType = AuthContext;
  state = { data: null, error: null, modal: null, flash: '', similar: [], copied: false };

  // Nền xám xanh giống trang Tìm việc để các thẻ trắng nổi lên
  componentDidMount() { document.body.classList.add('page-canvas'); this.load(); }
  componentWillUnmount() { document.body.classList.remove('page-canvas'); clearTimeout(this.copyTimer); }
  // Tải lại khi đổi tin hoặc khi phiên đăng nhập vừa khôi phục xong (mở thẳng link: API gọi trước khi có token,
  // nên myApplication của sinh viên bị thiếu)
  componentDidUpdate(prev) {
    if (prev.params.id !== this.props.params.id || (this.context.user?._id || null) !== this.loadedFor) this.load();
  }

  load = async () => {
    this.loadedFor = this.context.user?._id || null;
    try {
      const r = await api.get(`/jobs/${this.props.params.id}`);
      this.setState({ data: r.data, error: null });
      // Việc tương tự: cùng ngành trước, thiếu thì thêm việc cùng thành phố; bỏ chính tin đang xem, tối đa 4
      const { job } = r.data;
      const [byCat, byCity] = await Promise.all([
        api.get(`/jobs${qs({ categoryId: job.categoryId, limit: 5 })}`).catch(() => ({ data: [] })),
        api.get(`/jobs${qs({ city: job.city, limit: 5 })}`).catch(() => ({ data: [] })),
      ]);
      const seen = new Set([job._id]);
      const similar = [...byCat.data, ...byCity.data].filter((j) => !seen.has(j._id) && seen.add(j._id)).slice(0, 4);
      this.setState({ similar });
    } catch (error) {
      this.setState({ error });
    }
  };

  copyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href).catch(() => null);
    this.setState({ copied: true });
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.setState({ copied: false }), 2000);
  };

  // Quay lại đúng trang kết quả (giữ bộ lọc) nếu đến từ trong site; mở thẳng link thì về danh sách việc
  back = (e) => {
    if (this.props.location.key === 'default') return;
    e.preventDefault();
    this.props.navigate(-1);
  };

  // Nút hành động theo vai trò và trạng thái đơn; dùng chung cho khung bên phải và thanh dưới trên mobile
  actions(compact) {
    const { user } = this.context;
    const { data } = this.state;
    const { job, myApplication } = data;
    const next = encodeURIComponent(this.props.location.pathname);
    const open = jobStatusOf(job) === 'OPEN';
    if (!user) return open ? <Link to={`/login?next=${next}`} className="btn btn-lg btn-block">{compact ? 'Ứng tuyển' : 'Đăng nhập để ứng tuyển'}</Link> : null;
    if (user.role === 'STUDENT') {
      const main = myApplication
        ? <Link to={`/student/applications/${myApplication._id}`} className="btn btn-lg btn-block btn-ghost">Đã ứng tuyển, xem đơn <AppBadge status={myApplication.status} /></Link>
        : open ? <button type="button" className="btn btn-lg btn-block" onClick={() => this.setState({ modal: 'apply' })} disabled={!user.emailVerified}>Ứng tuyển ngay</button> : null;
      return <div className={compact ? 'jd-bar-actions' : 'jd-actions'}>{main}</div>;
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

  // Câu kết luận cho khung ca làm: so ca làm của tin với lịch học đã lưu
  fitVerdict(job, busy) {
    const n = job.shifts?.length || 0;
    if (!n) return { tone: 'info', Icon: Clock, text: 'Giờ làm linh hoạt, thỏa thuận khi phỏng vấn.' };
    if (!busy.length) return null;
    const clash = job.shifts.filter((i) => busy.includes(i)).length;
    if (!clash) return { tone: 'ok', Icon: CheckCircle2, text: `Hợp cả ${n} ca với lịch học của bạn.` };
    if (clash === n) return { tone: 'bad', Icon: XCircle, text: `Trùng toàn bộ ${n} ca với giờ học của bạn.` };
    return { tone: 'warn', Icon: AlertTriangle, text: `Hợp ${n - clash}/${n} ca, trùng ${clash} ca với giờ học.` };
  }

  render() {
    const { data, error, modal, flash, similar, copied } = this.state;
    if (error) return <ErrorPage code={error.status === 404 ? 404 : 500} message={error.message} />;
    if (!data) return <Spinner />;
    const { job, employer, category } = data;
    const { user } = this.context;
    const status = jobStatusOf(job);
    const company = employer.company || {};
    const daysLeft = Math.max(0, Math.ceil((new Date(job.expiresAt) - Date.now()) / DAY));
    const Icon = categoryIcon(category?.name);
    const busy = busyOf(user);
    const verdict = this.fitVerdict(job, busy);
    const hours = job.schedule?.match(/\d{1,2}h(\d{2})?\s*[–-]\s*\d{1,2}h(\d{2})?/)?.[0];
    const when = [
      [Clock, 'Giờ làm', hours || (job.shifts?.length ? 'Theo ca trong tuần' : job.schedule || 'Thỏa thuận khi phỏng vấn')],
      [CalendarClock, 'Thời gian', `Từ ${date(job.startDate)}${job.endDate ? ` đến ${date(job.endDate)}` : ''}`],
      [Hourglass, 'Hạn nhận hồ sơ', `${date(job.expiresAt)}${status === 'OPEN' ? `, còn ${daysLeft} ngày` : ''}`],
      [MapPin, 'Địa chỉ', [job.address, job.district, job.city].filter(Boolean).join(', ')],
    ];
    const bar = status === 'OPEN' && this.actions(true);
    return (
      <>
      {/* Dải đầu trang nền abyss như trang Tìm việc: tóm tắt đủ để quyết định (lương, nơi làm, ca làm, độ cạnh tranh, hạn) */}
      <section className="jd-band">
        <div className="container">
          <Link to="/jobs" onClick={this.back} className="jd-back"><ArrowLeft size={16} aria-hidden="true" />{this.props.location.key === 'default' ? 'Danh sách việc' : 'Quay lại kết quả'}</Link>
          {/* Trái: việc gì, của ai. Phải: thẻ 4 thông tin để quyết định (lương, nơi làm, ca làm, hạn), thẳng cột ứng tuyển bên dưới */}
          <header className="jd-head">
            <div className="jd-head-main">
              {category && <Link to={`/jobs?categoryId=${category._id}`} className="eyebrow-chip jd-cat">{category.name}</Link>}
              <h1 className="jd-title">{job.title}</h1>
              <p className="jd-meta">
                <span className="jd-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" width="40" height="40" /> : <Icon size={20} aria-hidden="true" />}</span>
                <span className="jd-company">{company.name || employer.fullName}</span>
                {job.isFeatured && <span className="jt-badge">Nổi bật</span>}
                {status !== 'OPEN' && <JobBadge status={status} />}
              </p>
              <div className="jd-signals">
                <span><Users size={14} aria-hidden="true" />{job.applicationCount ? `${job.applicationCount} ứng viên` : 'Ứng tuyển đầu tiên'}</span>
                <span>Đăng {timeAgo(job.createdAt)}</span>
                <span>{job.viewCount} lượt xem</span>
                <button type="button" className="jd-copy" onClick={this.copyLink}><Link2 size={14} aria-hidden="true" /><span role="status">{copied ? 'Đã sao chép' : 'Sao chép link'}</span></button>
              </div>
            </div>
            <dl className="jd-facts">
              <div className="jd-fact jd-fact-pay"><dt>Mức lương</dt><dd>{salary(job)}</dd></div>
              <div className="jd-fact"><dt><MapPin size={14} aria-hidden="true" />Khu vực</dt><dd>{job.district || job.city}</dd></div>
              <div className="jd-fact">
                <dt><Clock size={14} aria-hidden="true" />Ca làm</dt>
                <dd>{shiftParts(job.shifts).map((p) => {
                  const PIcon = PERIOD_ICON[p.period];
                  return <span key={p.period} className="jd-fact-shift"><PIcon size={14} aria-hidden="true" />{p.label} {p.days}</span>;
                })}{!job.shifts?.length && (hours || 'Linh hoạt')}</dd>
              </div>
              <div className="jd-fact">
                <dt><Hourglass size={14} aria-hidden="true" />Hạn nộp</dt>
                <dd className={status === 'OPEN' && daysLeft <= 3 ? 'jr-urgent' : ''}>{status === 'OPEN' ? `Còn ${daysLeft} ngày` : date(job.expiresAt)}</dd>
              </div>
              <div className="jd-fact"><dt><Users size={14} aria-hidden="true" />Số chỗ</dt><dd>{job.remainingSlots > 0 ? `Còn ${job.remainingSlots}/${job.slots}` : 'Đã đủ người'}</dd></div>
            </dl>
          </header>
        </div>
      </section>

      <div className={`container page jd ${bar ? 'jd-has-bar' : ''}`}>
        <div className="jd-grid">
          {/* Một thẻ duy nhất, các phần ngăn bằng vạch mảnh: ca làm so với lịch học, mô tả, yêu cầu */}
          <article className="jd-card jd-main">
            <section className="jd-sec" aria-labelledby="jd-shift">
              <h2 id="jd-shift" className="jd-h2">Ca làm và lịch học của bạn</h2>
              {verdict
                ? <p className={`jd-fit ${verdict.tone}`}><verdict.Icon size={18} aria-hidden="true" />{verdict.text}</p>
                : <p className="jd-fit info"><CalendarClock size={18} aria-hidden="true" />Chưa có lịch học để so. <Link to="/jobs#lich-hoc">Tô lịch học để kiểm tra</Link></p>}
              {job.shifts?.length > 0 && <MiniWeek shifts={job.shifts} busy={busy} />}
              <dl className="jd-when">
                {when.map(([I, k, v]) => <div key={k}><dt><I size={15} aria-hidden="true" />{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </section>

            <section className="jd-sec" aria-labelledby="jd-desc">
              <h2 id="jd-desc" className="jd-h2">Mô tả công việc</h2>
              <p className="jd-text">{job.description}</p>
            </section>
            {job.requirements && (
              <section className="jd-sec" aria-labelledby="jd-req">
                <h2 id="jd-req" className="jd-h2">Yêu cầu</h2>
                <p className="jd-text">{job.requirements}</p>
              </section>
            )}

          </article>

          <aside className="jd-aside" aria-label="Ứng tuyển và nhà tuyển dụng">
            <div className="jd-card jd-apply">
              <h2 className="jd-h2 jd-apply-title">{status === 'OPEN' ? 'Ứng tuyển việc này' : 'Đã ngừng nhận hồ sơ'}</h2>
              <Alert type="info">{flash}</Alert>
              {this.actions(false)}
              {user?.role === 'STUDENT' && !user.emailVerified && !data.myApplication && <p className="jd-note">Xác thực email để ứng tuyển.</p>}
              {status !== 'OPEN' && <p className="jd-note">Tin này không còn nhận hồ sơ. Xem các việc tương tự bên dưới.</p>}
              <ul className="jd-promises">
                {PROMISES.map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}
              </ul>
            </div>
            <section className="jd-card jd-company-card" aria-labelledby="jd-employer">
              <span className="jd-logo jd-logo-sm">{company.logoUrl ? <img src={company.logoUrl} alt="" width="56" height="56" /> : <Building2 size={22} aria-hidden="true" />}</span>
              <div className="jd-company-body">
                <h2 id="jd-employer" className="jd-company-name">{company.name || employer.fullName}</h2>
                <div className="jd-company-meta">
                  <Stars value={employer.ratingAvg} count={employer.ratingCount} />
                  {employer.isPremium && <span className="chip chip-featured tiny">★ Premium</span>}
                </div>
                {company.address && <p className="jd-muted"><MapPin size={14} aria-hidden="true" />{[company.address, company.district, company.city].filter(Boolean).join(', ')}</p>}
                {company.description && <p className="jd-text jd-clamp">{company.description}</p>}
              </div>
            </section>
          </aside>
        </div>

        {similar.length > 0 && (
          <section className="jd-similar" aria-labelledby="jd-similar">
            <div className="jd-similar-head">
              <h2 id="jd-similar" className="jd-similar-title">Việc tương tự</h2>
              {category && <Link to={`/jobs?categoryId=${category._id}`} className="text-link small">Xem thêm việc {category.name.toLowerCase()} <ArrowRight size={16} aria-hidden="true" /></Link>}
            </div>
            <ul className="jd-similar-list">{similar.map((j) => <li key={j._id}><JobRow job={j} /></li>)}</ul>
          </section>
        )}

        {bar && (
          <div className="jd-bar">
            <span className="jd-bar-pay"><span className="hl">{salary(job)}</span><small>Còn {daysLeft} ngày</small></span>
            {bar}
          </div>
        )}

        {modal === 'apply' && <ApplyModal job={job} cv={user?.student?.cv} onClose={() => this.setState({ modal: null })} onDone={() => { this.setState({ modal: null, flash: 'Đã gửi đơn ứng tuyển. Theo dõi trạng thái trong “Đơn của tôi”.' }); this.load(); }} />}
      </div>
      </>
    );
  }
}

export default withRouter(JobDetailPage);
