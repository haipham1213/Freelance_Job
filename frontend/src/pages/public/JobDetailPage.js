import React, { Component } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Clock, FileText, Flag, Heart, Link2, X, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Stars, JobBadge, AppBadge, Modal, Field, Alert, ErrorState } from '../../components/ui';
import { JobCard, MiniWeek, busyOf, hoursOf, loadSavedIds, saveToggler } from '../../components/JobRow';
import { categoryIcon } from '../../components/Illustrations';
import ReportModal from '../../components/ReportModal';
import ErrorPage from './ErrorPage';
import { date, money, salary, timeAgo, jobStatusOf, describeShifts, SALARY_TYPE } from '../../utils/format';
import withRouter from '../../utils/withRouter';

// Hộp ứng tuyển: ghi rõ việc nào và CV nào sẽ được gửi. Thiếu CV / số điện thoại thì chặn gửi và chỉ chỗ bổ sung (server cũng kiểm tra: CV_REQUIRED, PHONE_REQUIRED)
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
    const { job, cv, phone } = this.props;
    const missing = [!cv?.url && 'CV', !phone && 'số điện thoại'].filter(Boolean);
    return (
      <Modal title={`Ứng tuyển: ${job.title}`} onClose={this.props.onClose} busy={busy} dirty={!!coverLetter.trim()}>
        <form className="stack" onSubmit={this.submit}>
          <div className="jd-cv">
            <FileText size={20} aria-hidden="true" />
            {cv?.url
              ? <span>CV sẽ gửi: <strong>{cv.fileName || 'CV trong hồ sơ'}</strong></span>
              : <span>Bạn chưa tải CV lên hồ sơ.</span>}
            <Link to="/student/profile">{cv?.url ? 'Đổi CV' : 'Tải CV'}</Link>
          </div>
          {missing.length > 0 && (
            <Alert type="warn">
              Hồ sơ còn thiếu {missing.join(' và ')}, cần bổ sung trước khi gửi đơn.{' '}
              <Link to="/student/profile" className="accent ico-row jd-inline">Bổ sung hồ sơ <ArrowRight size={16} aria-hidden="true" /></Link>
            </Alert>
          )}
          <Field label="Thư giới thiệu (không bắt buộc)">
            <textarea className="textarea" name="coverLetter" maxLength={1000} placeholder="Giới thiệu ngắn về bạn, thời gian có thể đi làm…" value={coverLetter} onChange={(e) => this.setState({ coverLetter: e.target.value })} />
          </Field>
          {error && (
            <Alert>
              {error.message}{' '}
              {error.code === 'CV_REQUIRED' && <Link to="/student/profile" className="accent ico-row jd-inline">Tải CV ngay <ArrowRight size={16} aria-hidden="true" /></Link>}
              {error.code === 'PHONE_REQUIRED' && <Link to="/student/profile" className="accent ico-row jd-inline">Thêm số điện thoại <ArrowRight size={16} aria-hidden="true" /></Link>}
            </Alert>
          )}
          <button className="btn" disabled={busy || missing.length > 0}>{busy ? 'Đang gửi…' : 'Gửi đơn ứng tuyển'}</button>
        </form>
      </Modal>
    );
  }
}

const DAY = 864e5;

// Khung xương lúc tải: đúng hình 3 cột (danh sách | nội dung | công ty) để trang không nhảy bố cục khi dữ liệu về
const DetailSkeleton = () => (
  <div className="container page jd" role="status" aria-busy="true">
    <span className="sr-only">Đang tải tin tuyển dụng…</span>
    <div aria-hidden="true">
      <span className="sk sk-line jd-sk-back" />
      <div className="jv">
        <div className="jv-list">{[0, 1, 2].map((i) => <div key={i} className="sk sk-card" />)}</div>
        <div className="jv-panel">
          <div className="jv-main">
            <div className="jv-head"><span className="sk sk-line jd-sk-title" /></div>
            {[90, 100, 70, 40, 95, 60].map((w, i) => <span key={i} className={`sk sk-line sk-w${w} ${i === 0 ? 'jd-sk-first' : 'jd-sk-next'}`} />)}
          </div>
          <div className="jv-side"><div className="jv-sec">{[70, 40, 55, 35].map((w) => <span key={w} className={`sk sk-line sk-w${w}`} />)}</div></div>
        </div>
      </div>
    </div>
  </div>
);

// Lương đầy đủ (không rút gọn) cho khối thông tin chi tiết
const fullSalary = (j) => {
  const unit = SALARY_TYPE[j.salaryType];
  const range = j.salaryMin === j.salaryMax || j.salaryMax == null ? money(j.salaryMin) : `${money(j.salaryMin)} – ${money(j.salaryMax)}`;
  return range ? `${range}${unit ? `/${unit}` : ''}` : 'Thỏa thuận';
};
// Tách yêu cầu thành các dòng: theo xuống dòng; câu liền nhau thì tách ở dấu câu + chữ hoa kế tiếp (không tách "3.5 năm", "v.v.")
const requirementLines = (text) => text.replace(/([.!?])\s+(?=\p{Lu})/gu, '$1\n').split(/\n+/).map((t) => t.trim()).filter(Boolean);

class JobDetailPage extends Component {
  static contextType = AuthContext;
  state = { data: null, error: null, modal: null, flash: null, similar: [], copied: '', savedIds: new Set(), saveError: '' };
  reqId = 0;
  flashEl = React.createRef();
  toggleSimilarSave = saveToggler(this);

  // Nền xám xanh giống trang Tìm việc để các thẻ trắng nổi lên
  componentDidMount() { document.body.classList.add('page-canvas'); this.load(); }
  componentWillUnmount() { document.body.classList.remove('page-canvas'); clearTimeout(this.copyTimer); clearTimeout(this.flashTimer); this.reqId += 1; }
  // Tải lại khi đổi tin (xóa dữ liệu cũ → hiện skeleton) hoặc khi phiên đăng nhập vừa khôi phục xong (mở thẳng link:
  // API gọi trước khi có token, nên myApplication / isSaved của sinh viên bị thiếu)
  componentDidUpdate(prev) {
    if (prev.params.id !== this.props.params.id) {
      this.setState({ data: null, similar: [], error: null, flash: null, copied: '' });
      this.load();
    } else if ((this.context.user?._id || null) !== this.loadedFor) this.load();
  }

  // Thông báo ngắn gần chỗ thao tác: nhận focus để trình đọc màn hình đọc và để cuộn tới vùng nhìn thấy (mobile), tự tắt sau 8 giây
  notify = (type, text) => {
    clearTimeout(this.flashTimer);
    this.setState({ flash: { type, text } }, () => this.flashEl.current?.focus());
    this.flashTimer = setTimeout(() => this.setState({ flash: null }), 8000);
  };
  closeFlash = () => { clearTimeout(this.flashTimer); this.setState({ flash: null }); };

  load = async () => {
    this.loadedFor = this.context.user?._id || null;
    const id = ++this.reqId;
    this.setState({ error: null });
    try {
      const r = await api.get(`/jobs/${this.props.params.id}`);
      if (id !== this.reqId) return;
      this.setState({ data: r.data });
      document.title = `${r.data.job.title} – UniShift`;
      this.consumeSaveIntent(r.data);
      if (this.context.user?.role === 'STUDENT') loadSavedIds().then((savedIds) => { if (id === this.reqId && !savedIds.unknown) this.setState({ savedIds }); });
      // Việc tương tự: cùng ngành trước, thiếu thì thêm việc cùng thành phố; bỏ chính tin đang xem, tối đa 4
      const { job } = r.data;
      const [byCat, byCity] = await Promise.all([
        api.get(`/jobs${qs({ categoryId: job.categoryId, limit: 5 })}`).catch(() => ({ data: [] })),
        api.get(`/jobs${qs({ city: job.city, limit: 5 })}`).catch(() => ({ data: [] })),
      ]);
      if (id !== this.reqId) return;
      const seen = new Set([job._id]);
      const similar = [...byCat.data, ...byCity.data].filter((j) => !seen.has(j._id) && seen.add(j._id)).slice(0, 4);
      this.setState({ similar });
    } catch (error) {
      if (id === this.reqId) this.setState({ error });
    }
  };

  // Khách bấm tim ở danh sách → đăng nhập → quay lại đây với ?save=1: lưu tin giúp họ rồi bỏ tham số khỏi URL
  consumeSaveIntent = async (d) => {
    if (this.props.searchParams.get('save') !== '1' || this.context.user?.role !== 'STUDENT') return;
    const { location, navigate } = this.props;
    navigate(location.pathname, { replace: true, state: location.state });
    if (d.isSaved) return;
    try {
      await api.put(`/students/me/saved-jobs/${d.job._id}`);
      this.setState((s) => ({ data: { ...s.data, isSaved: true } }));
      this.notify('ok', 'Đã lưu tin này vào danh sách của bạn.');
    } catch (e) {
      this.notify('error', `Chưa lưu được tin: ${e.message}`);
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
      this.notify('error', `Không lưu được tin: ${e.message}`);
    }
  };

  // Chỉ báo "Đã sao chép" khi clipboard thật sự ghi được; không thì hiện ô chọn sẵn link để tự sao chép
  copyLink = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(window.location.href);
      ok = true;
    } catch { /* clipboard bị từ chối hoặc không có (http, trình duyệt cũ) */ }
    this.setState({ copied: ok ? 'ok' : 'fail' }, () => this.urlEl?.select());
    clearTimeout(this.copyTimer);
    if (ok) this.copyTimer = setTimeout(() => this.setState({ copied: '' }), 2000);
  };

  // Chỉ có nút quay lại khi người dùng đến từ một trang trong site (JobCard ghi trang nguồn vào location.state.from)
  back = (e) => {
    if (!this.props.location.state?.from) return;
    e.preventDefault();
    this.props.navigate(-1);
  };

  // Nút hành động theo vai trò và trạng thái đơn; dùng chung cho khung bên phải và thanh dưới trên mobile
  actions(compact) {
    const { user } = this.context;
    const { data } = this.state;
    const { job, myApplication } = data;
    const next = encodeURIComponent(this.props.location.pathname);
    // Lý do nút "Ứng tuyển ngay" bị khóa: khung phải có dòng chữ hiển thị, thanh dưới mobile có bản chỉ dành cho trình đọc
    const whyId = compact ? 'jd-bar-why' : 'jd-apply-why';
    const open = jobStatusOf(job) === 'OPEN';
    if (!user) return open ? <Link to={`/login?next=${next}`} className="btn btn-lg btn-block">{compact ? 'Ứng tuyển' : 'Đăng nhập để ứng tuyển'}</Link> : null;
    if (user.role === 'STUDENT') {
      const main = myApplication
        ? <Link to={`/student/applications/${myApplication._id}`} className="btn btn-lg btn-block btn-ghost">Đã ứng tuyển, xem đơn <AppBadge status={myApplication.status} /></Link>
        : open ? <button type="button" className="btn btn-lg btn-block" onClick={() => this.setState({ modal: 'apply' })} disabled={!user.emailVerified} aria-describedby={user.emailVerified ? undefined : whyId}>Ứng tuyển ngay</button> : null;
      const save = (
        <button type="button" className={`btn btn-ghost ${compact ? 'jd-icon-btn' : 'btn-lg btn-block'}`} onClick={this.toggleSave} aria-pressed={!!data.isSaved} aria-label={`Lưu tin: ${job.title}`}>
          <Heart size={18} fill={data.isSaved ? 'currentColor' : 'none'} aria-hidden="true" />{!compact && (data.isSaved ? 'Đã lưu' : 'Lưu tin')}
        </button>
      );
      return (
        <div className={compact ? 'jd-bar-actions' : 'jd-actions'}>
          {main}{save}
          {compact && !myApplication && open && !user.emailVerified && <span className="sr-only" id={whyId}>Xác thực email để ứng tuyển.</span>}
        </div>
      );
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
    const { data, error, modal, flash, similar, copied, savedIds, saveError } = this.state;
    if (error) {
      if (error.status === 404) return <ErrorPage code={404} />;
      // Mất mạng / lỗi máy chủ: cho thử lại, không giả làm "không tìm thấy"
      return <div className="container page"><ErrorState error={error} onRetry={this.load} title="Không tải được tin tuyển dụng" /></div>;
    }
    if (!data) return <DetailSkeleton />;
    const { job, employer, category } = data;
    const { user } = this.context;
    const status = jobStatusOf(job);
    const company = employer.company || {};
    const canReport = user && ['STUDENT', 'EMPLOYER'].includes(user.role) && String(job.employerId) !== String(user._id);
    const daysLeft = Math.max(0, Math.ceil((new Date(job.expiresAt) - Date.now()) / DAY));
    const deadline = daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`;
    const Icon = categoryIcon(category?.name);
    const busy = busyOf(user);
    const verdict = this.fitVerdict(job, busy);
    const hours = hoursOf(job);
    const bar = status === 'OPEN' && this.actions(true);
    const companyName = company.name || employer.fullName;
    const from = this.props.location.state?.from;
    // Nhãn xám cuối nội dung (như "Required skills" của mẫu): các thông tin để quyết định ứng tuyển; mục thiếu dữ liệu thì ẩn
    const quick = [
      ['Lương', fullSalary(job)],
      ['Giờ làm', hours || (job.shifts?.length ? 'Theo ca trong tuần' : job.schedule || 'Thỏa thuận')],
      ['Thời gian', job.startDate ? `${date(job.startDate)}${job.endDate ? ` – ${date(job.endDate)}` : ''}` : ''],
      ['Hạn nộp', status === 'OPEN' ? deadline : date(job.expiresAt)],
      ['Số chỗ', job.remainingSlots > 0 ? `Còn ${job.remainingSlots}/${job.slots}` : 'Đã đủ người'],
      ['Địa chỉ', [job.address, job.district, job.city].filter(Boolean).join(', ')],
      ['Ứng viên', job.applicationCount || 0],
      ['Đăng', timeAgo(job.createdAt)],
    ].filter(([, v]) => v !== '' && v != null);
    // Thẻ nhãn xám ở cột phải (như "Services" của mẫu): cam kết an toàn của UniShift
    const SAFE = ['Không thu phí', 'Không đặt cọc', 'Lương công khai', 'SĐT hiện khi được nhận'];
    return (
      <div className={`container page jd ${bar ? 'jd-has-bar' : ''}`}>
        <Link to="/jobs" onClick={this.back} className="jd-back"><ArrowLeft size={16} aria-hidden="true" />{from === '/jobs' ? 'Quay lại kết quả' : from ? 'Quay lại' : 'Danh sách việc'}</Link>

        {flash && (
          <div className="jd-flash" ref={this.flashEl} tabIndex={-1}>
            <Alert type={flash.type}>{flash.text}</Alert>
            <button type="button" className="jd-flash-x" onClick={this.closeFlash} aria-label="Đóng thông báo"><X size={16} aria-hidden="true" /></button>
          </div>
        )}

        {/* Hai cột theo mẫu: danh sách việc (tin đang xem viền xanh ở đầu) | nội dung tin + công ty. Trong DOM, nội dung tin (có h1)
            đứng trước danh sách; trên màn rộng danh sách được đưa sang trái bằng CSS order */}
        <div className="jv">
          <div className="jv-panel">
            <article className="jv-main">
              <header className="jv-head">
                <h1 className="jv-title">{job.title}</h1>
                <ul className="jc-tags jv-tags">
                  {job.isFeatured && <li className="jc-tag t-gold">Nổi bật</li>}
                  {category && <li className="jc-tag t-plum"><Link to={`/jobs?categoryId=${category._id}`}>{category.name}</Link></li>}
                  <li className="jc-tag t-mint t-shift">{job.shifts?.length ? describeShifts(job.shifts) : 'Giờ linh hoạt'}</li>
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
                  <ul className="jv-bullets">{requirementLines(job.requirements).map((t, i) => <li key={i}>{t}</li>)}</ul>
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
                <h2 id="jd-quick" className="jd-h2">Thông tin cần biết</h2>
                <ul className="jv-pills">{quick.map(([k, v]) => <li key={k}><span>{k}:</span> {v}</li>)}</ul>
              </section>
            </article>

            <aside className="jv-side" aria-label="Nhà tuyển dụng và ứng tuyển">
              <section className="jv-sec">
                <div className="jv-company">
                  <h2 className="jv-company-name"><Link to={`/employers/${employer._id}`}>{companyName}</Link>{employer.isPremium && <span className="chip chip-featured">Premium</span>}</h2>
                  <span className="jv-logo">{company.logoUrl ? <img src={company.logoUrl} alt="" width="56" height="56" /> : <Icon size={24} aria-hidden="true" />}</span>
                </div>
                <dl className="jv-dl">
                  {employer.createdAt && <div><dt>Tham gia UniShift</dt><dd>{date(employer.createdAt)}</dd></div>}
                  <div><dt>Địa điểm</dt><dd>{[company.address, company.district, company.city].filter(Boolean).join(', ') || job.city}</dd></div>
                </dl>
              </section>
              <section className="jv-sec">
                <h2 className="jv-h3">Đánh giá nhà tuyển dụng</h2>
                <div className="jv-pair">
                  <Stars value={employer.ratingAvg} count={employer.ratingCount} />
                  {employer.ratingCount > 0 && <p>Từ {employer.ratingCount} sinh viên đã làm</p>}
                </div>
              </section>
              <section className="jv-sec">
                <h2 className="jv-h4">Cam kết</h2>
                <ul className="jv-pills jv-pills-sm">{SAFE.map((t) => <li key={t}>{t}</li>)}</ul>
              </section>
              <section className="jv-sec jv-apply">
                {this.actions(false)}
                {user?.role === 'STUDENT' && !user.emailVerified && !data.myApplication && <p className="jd-note" id="jd-apply-why">Xác thực email để ứng tuyển.</p>}
                {status !== 'OPEN' && <p className="jd-note">Tin này không còn nhận hồ sơ. Xem các việc tương tự ở danh sách việc.</p>}
                <div className="jv-minor">
                  <button type="button" className="jd-copy" onClick={this.copyLink}><Link2 size={14} aria-hidden="true" /><span role="status">{copied === 'ok' ? 'Đã sao chép' : copied === 'fail' ? 'Không sao chép được, hãy sao chép link bên dưới' : 'Sao chép link'}</span></button>
                  {canReport && <button type="button" className="jd-report" onClick={() => this.setState({ modal: 'report' })}><Flag size={14} aria-hidden="true" />Báo cáo tin này</button>}
                </div>
                {copied === 'fail' && <input className="input jd-copy-url" readOnly value={window.location.href} aria-label="Link tin tuyển dụng" ref={(el) => { this.urlEl = el; }} onFocus={(e) => e.target.select()} />}
              </section>
            </aside>
          </div>

          <aside className="jv-list" aria-label="Tin đang xem và việc tương tự">
            <Alert>{saveError}</Alert>
            <JobCard job={{ ...job, excerpt: job.description }} category={category?.name} on />
            {similar.map((j) => (
              <JobCard key={j._id} job={j} category={j.categoryId === job.categoryId ? category?.name : undefined} saved={savedIds.has(j._id)}
                onSave={user?.role === 'STUDENT' ? this.toggleSimilarSave : undefined}
                saveHref={user ? undefined : `/login?next=${encodeURIComponent(`/jobs/${j._id}?save=1`)}`} />
            ))}
            {category && <Link to={`/jobs?categoryId=${category._id}`} className="text-link small">Xem thêm việc {category.name.toLowerCase()} <ArrowRight size={16} aria-hidden="true" /></Link>}
          </aside>
        </div>

        {bar && (
          <div className="jd-bar">
            <span className="jd-bar-pay"><span className="hl">{salary(job)}</span><small>{deadline}</small></span>
            {bar}
          </div>
        )}

        {modal === 'apply' && <ApplyModal job={job} cv={user?.student?.cv} phone={user?.phone} onClose={() => this.setState({ modal: null })} onDone={() => { this.setState({ modal: null }); this.notify('ok', 'Đã gửi đơn ứng tuyển. Theo dõi trạng thái trong “Đơn của tôi”.'); this.load(); }} />}
        {modal === 'report' && <ReportModal targetType="JOB" targetId={job._id} onClose={() => this.setState({ modal: null })} />}
      </div>
    );
  }
}

export default withRouter(JobDetailPage);
