import React, { Component } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, CalendarClock, CheckCircle2, Clock, FileText, Flag, Heart, Link2, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Stars, JobBadge, AppBadge, Modal, Field, Alert } from '../../components/ui';
import { JobCard, MiniWeek, busyOf } from '../../components/JobRow';
import { categoryIcon } from '../../components/Illustrations';
import ReportModal from '../../components/ReportModal';
import ErrorPage from './ErrorPage';
import { date, salary, timeAgo, jobStatusOf, describeShifts } from '../../utils/format';
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
              {error.code === 'PHONE_REQUIRED' && <Link to="/student/profile" className="accent ico-row" style={{ display: 'inline-flex' }}>Thêm số điện thoại <ArrowRight size={16} aria-hidden="true" /></Link>}
            </Alert>
          )}
          <button className="btn" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi đơn ứng tuyển'}</button>
        </form>
      </Modal>
    );
  }
}

const DAY = 864e5;

// Khung xương lúc tải: đúng hình 3 cột (danh sách | nội dung | công ty) để trang không nhảy bố cục khi dữ liệu về
const DetailSkeleton = () => (
  <div className="container page jd" aria-busy="true" aria-label="Đang tải tin tuyển dụng">
    <span className="sk sk-line" style={{ width: 120, marginBottom: 20 }} />
    <div className="jv">
      <div className="jv-list">{[0, 1, 2].map((i) => <div key={i} className="sk sk-card" />)}</div>
      <div className="jv-panel">
        <div className="jv-main">
          <div className="jv-head"><span className="sk sk-line" style={{ width: '55%', height: 34 }} /></div>
          {[90, 100, 70, 40, 95, 60].map((w, i) => <span key={i} className="sk sk-line" style={{ width: `${w}%`, marginTop: i === 0 ? 36 : 14 }} />)}
        </div>
        <div className="jv-side"><div className="jv-sec">{[70, 40, 55, 35].map((w, i) => <span key={i} className="sk sk-line" style={{ width: `${w}%` }} />)}</div></div>
      </div>
    </div>
  </div>
);

class JobDetailPage extends Component {
  static contextType = AuthContext;
  state = { data: null, error: null, modal: null, flash: '', similar: [], copied: false };

  // Nền xám xanh giống trang Tìm việc để các thẻ trắng nổi lên
  componentDidMount() { document.body.classList.add('page-canvas'); this.load(); }
  componentWillUnmount() { document.body.classList.remove('page-canvas'); clearTimeout(this.copyTimer); }
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

  // FR-SAV-01
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
      const save = (
        <button type="button" className={`btn btn-ghost ${compact ? 'jd-icon-btn' : 'btn-lg btn-block'}`} onClick={this.toggleSave} aria-pressed={!!data.isSaved} aria-label={data.isSaved ? 'Bỏ lưu tin' : 'Lưu tin'}>
          <Heart size={18} fill={data.isSaved ? 'currentColor' : 'none'} aria-hidden="true" />{!compact && (data.isSaved ? 'Đã lưu' : 'Lưu tin')}
        </button>
      );
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
    if (!data) return <DetailSkeleton />;
    const { job, employer, category } = data;
    const { user } = this.context;
    const status = jobStatusOf(job);
    const company = employer.company || {};
    const canReport = user && ['STUDENT', 'EMPLOYER'].includes(user.role) && String(job.employerId) !== String(user._id);
    const daysLeft = Math.max(0, Math.ceil((new Date(job.expiresAt) - Date.now()) / DAY));
    const Icon = categoryIcon(category?.name);
    const busy = busyOf(user);
    const verdict = this.fitVerdict(job, busy);
    const hours = job.schedule?.match(/\d{1,2}h(\d{2})?\s*[–-]\s*\d{1,2}h(\d{2})?/)?.[0];
    const bar = status === 'OPEN' && this.actions(true);
    const companyName = company.name || employer.fullName;
    // Nhãn xám cuối nội dung (như "Required skills" của mẫu): các thông tin để quyết định ứng tuyển
    const quick = [
      ['Lương', salary(job)],
      ['Giờ làm', hours || (job.shifts?.length ? 'Theo ca trong tuần' : job.schedule || 'Thỏa thuận')],
      ['Thời gian', `${date(job.startDate)}${job.endDate ? ` - ${date(job.endDate)}` : ''}`],
      ['Hạn nộp', status === 'OPEN' ? `Còn ${daysLeft} ngày` : date(job.expiresAt)],
      ['Số chỗ', job.remainingSlots > 0 ? `Còn ${job.remainingSlots}/${job.slots}` : 'Đã đủ người'],
      ['Địa chỉ', [job.address, job.district, job.city].filter(Boolean).join(', ')],
      ['Ứng viên', job.applicationCount || 0],
      ['Đăng', timeAgo(job.createdAt)],
    ];
    // Thẻ nhãn xám ở cột phải (như "Services" của mẫu): cam kết an toàn của UniShift
    const SAFE = ['Không thu phí', 'Không đặt cọc', 'Lương công khai', 'SĐT hiện khi được nhận'];
    return (
      <div className={`container page jd ${bar ? 'jd-has-bar' : ''}`}>
        <Link to="/jobs" onClick={this.back} className="jd-back"><ArrowLeft size={16} aria-hidden="true" />{this.props.location.key === 'default' ? 'Danh sách việc' : 'Quay lại kết quả'}</Link>

        {/* Ba cột theo mẫu: danh sách việc (tin đang xem viền xanh ở đầu) | nội dung tin | công ty + ứng tuyển.
            Hai cột sau chung một thẻ trắng, ngăn bằng vạch dọc */}
        <div className="jv">
          <aside className="jv-list" aria-label="Tin đang xem và việc tương tự">
            <JobCard job={{ ...job, excerpt: job.description }} category={category?.name} on />
            {similar.map((j) => <JobCard key={j._id} job={j} />)}
            {category && <Link to={`/jobs?categoryId=${category._id}`} className="text-link small">Xem thêm việc {category.name.toLowerCase()} <ArrowRight size={16} aria-hidden="true" /></Link>}
          </aside>

          <div className="jv-panel">
            <article className="jv-main">
              <header className="jv-head">
                <h1 className="jv-title">{job.title}</h1>
                <ul className="jc-tags jv-tags">
                  {job.isFeatured && <li className="jc-tag t-gold">Nổi bật</li>}
                  {category && <li className="jc-tag t-plum"><Link to={`/jobs?categoryId=${category._id}`}>{category.name}</Link></li>}
                  <li className="jc-tag t-mint">{job.shifts?.length ? describeShifts(job.shifts).split(';')[0] : 'Giờ linh hoạt'}</li>
                  <li className="jc-tag t-peach">{job.district || job.city}</li>
                  {status !== 'OPEN' && <li><JobBadge status={status} /></li>}
                </ul>
              </header>

              <section className="jd-sec" aria-labelledby="jd-desc">
                <h2 id="jd-desc" className="jd-h2">Về công việc</h2>
                <p className="jd-text">{job.description}</p>
              </section>
              {job.requirements && (
                <section className="jd-sec" aria-labelledby="jd-req">
                  <h2 id="jd-req" className="jd-h2">Yêu cầu và trách nhiệm</h2>
                  <ul className="jv-bullets">{job.requirements.split(/\n+|(?<=\.)\s+/).filter((t) => t.trim()).map((t) => <li key={t}>{t.trim()}</li>)}</ul>
                </section>
              )}
              <section className="jd-sec" aria-labelledby="jd-shift">
                <h2 id="jd-shift" className="jd-h2">Ca làm trong tuần</h2>
                {verdict
                  ? <p className={`jd-fit ${verdict.tone}`}><verdict.Icon size={18} aria-hidden="true" />{verdict.text}</p>
                  : <p className="jd-fit info"><CalendarClock size={18} aria-hidden="true" />Chưa có lịch học để so. <Link to="/jobs#lich-hoc">Tô lịch học để kiểm tra</Link></p>}
                {job.shifts?.length > 0 && <MiniWeek shifts={job.shifts} busy={busy} />}
              </section>
              <section className="jd-sec" aria-labelledby="jd-quick">
                <h2 id="jd-quick" className="jd-h2">Thông tin cần biết:</h2>
                <ul className="jv-pills">{quick.map(([k, v]) => <li key={k}><span>{k}:</span> {v}</li>)}</ul>
              </section>
            </article>

            <aside className="jv-side" aria-label="Nhà tuyển dụng và ứng tuyển">
              <section className="jv-sec">
                <div className="jv-company">
                  <h2 className="jv-company-name"><Link to={`/employers/${employer._id}`}>{companyName}</Link>{employer.isPremium && <BadgeCheck size={18} className="jv-verified" aria-label="Premium" />}</h2>
                  <span className="jv-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" width="56" height="56" /> : <Icon size={24} aria-hidden="true" />}</span>
                </div>
                <dl className="jv-dl">
                  {employer.createdAt && <div><dt>Tham gia UniShift</dt><dd>{date(employer.createdAt)}</dd></div>}
                  <div><dt>Địa điểm</dt><dd>{[company.address, company.district, company.city].filter(Boolean).join(', ') || job.city}</dd></div>
                </dl>
              </section>
              <section className="jv-sec">
                <h2 className="jv-h3">Thông tin khác</h2>
                <div className="jv-pair">
                  <Stars value={employer.ratingAvg} count={employer.ratingCount} />
                  {employer.ratingCount > 0 && <p>Từ {employer.ratingCount} sinh viên đã làm</p>}
                </div>
                <div className="jv-pair">
                  <strong>{salary(job)}</strong>
                  <p>Lương công bố trên tin</p>
                </div>
              </section>
              <section className="jv-sec">
                <h2 className="jv-h4">Cam kết</h2>
                <ul className="jv-pills jv-pills-sm">{SAFE.map((t) => <li key={t}>{t}</li>)}</ul>
              </section>
              <section className="jv-sec jv-apply">
                <Alert type="info">{flash}</Alert>
                {this.actions(false)}
                {user?.role === 'STUDENT' && !user.emailVerified && !data.myApplication && <p className="jd-note">Xác thực email để ứng tuyển.</p>}
                {status !== 'OPEN' && <p className="jd-note">Tin này không còn nhận hồ sơ. Xem các việc tương tự bên trái.</p>}
                <div className="jv-minor">
                  <button type="button" className="jd-copy" onClick={this.copyLink}><Link2 size={14} aria-hidden="true" /><span role="status">{copied ? 'Đã sao chép' : 'Sao chép link'}</span></button>
                  {canReport && <button type="button" className="jd-report" onClick={() => this.setState({ modal: 'report' })}><Flag size={14} aria-hidden="true" />Báo cáo tin này</button>}
                </div>
              </section>
            </aside>
          </div>
        </div>

        {bar && (
          <div className="jd-bar">
            <span className="jd-bar-pay"><span className="hl">{salary(job)}</span><small>Còn {daysLeft} ngày</small></span>
            {bar}
          </div>
        )}

        {modal === 'apply' && <ApplyModal job={job} cv={user?.student?.cv} onClose={() => this.setState({ modal: null })} onDone={() => { this.setState({ modal: null, flash: 'Đã gửi đơn ứng tuyển. Theo dõi trạng thái trong “Đơn của tôi”.' }); this.load(); }} />}
        {modal === 'report' && <ReportModal targetType="JOB" targetId={job._id} onClose={() => this.setState({ modal: null })} />}
      </div>
    );
  }
}

export default withRouter(JobDetailPage);
