import React, { Component } from 'react';
import { CalendarClock, CalendarDays, ChevronDown, Clock, Heart, Hourglass, MapPin, Search, Users, Wallet, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { categoryIcon } from '../../components/Illustrations';
import { Spinner, Empty, Pagination, Dropdown, ShiftGrid } from '../../components/ui';
import JobRow, { FitBadge, MiniWeek, shiftText, plainClick, loadSavedIds, saveToggler, readWeek, WEEK_KEY } from '../../components/JobRow';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';
import { date, money, shortMoney, salary, describeShifts, SALARY_TYPE } from '../../utils/format';

const SALARY_TYPES = [['HOURLY', 'Theo giờ'], ['DAILY', 'Theo ngày'], ['PROJECT', 'Theo dự án']];
const FILTERS = ['q', 'categoryId', 'city', 'district', 'salaryType', 'salaryMin', 'salaryMax', 'busy', 'page'];
// Lịch học của khách lưu trên trình duyệt; sinh viên đăng nhập thì lưu vào hồ sơ (student.busySlots)
const writeWeek = (v) => { try { localStorage.setItem(WEEK_KEY, JSON.stringify(v)); } catch { /* trình duyệt chặn lưu trữ */ } };
const HINT_KEY = 'jobsv.hideWeekHint';
const hintHidden = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };
const slots = (csv) => (csv ? csv.split(',').map(Number) : []);
const rating1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Xem trước bên phải chỉ khi màn hình đủ rộng cho 2 cột; hẹp hơn thì bấm tin là sang trang chi tiết
const WIDE = '(min-width: 1100px)';

// Khung xem trước tin đang chọn: dữ liệu cơ bản có sẵn từ danh sách, mô tả + trạng thái đã lưu tải thêm từ API-21
const Preview = ({ job: j, detail, catName, busy, user, saved, onSave }) => {
  const Icon = categoryIcon(catName[j.categoryId]);
  const left = j.slots - (j.acceptedCount || 0);
  const facts = [
    [Wallet, 'Mức lương', <span className="hl">{salary(j)}</span>],
    [Clock, 'Ca làm', shiftText(j) || 'Thỏa thuận khi phỏng vấn'],
    [MapPin, 'Địa điểm', [j.address, j.district, j.city].filter(Boolean).join(', ')],
    [CalendarClock, 'Bắt đầu', date(j.startDate)],
    [Users, 'Số chỗ', left > 0 ? `Còn ${left}/${j.slots} chỗ` : 'Đã đủ người'],
    [Hourglass, 'Hạn nhận hồ sơ', date(j.expiresAt)],
  ];
  return (
    <article className="jx-preview" aria-label={`Xem trước: ${j.title}`}>
      {/* Đầu khung dính khi cuộn đọc mô tả: tên việc và nút ứng tuyển luôn trong tầm mắt */}
      <div className="jx-preview-top">
        <div className="jx-preview-head">
          <span className="jx-logo jx-logo-lg">{j.companySnapshot?.logoUrl ? <img src={j.companySnapshot.logoUrl} alt="" width="64" height="64" /> : <Icon size={26} aria-hidden="true" />}</span>
          <div>
            <h2>{j.title}</h2>
            <FitBadge job={j} />
            <Link to={`/employers/${j.employerId}`} className="jx-company">{j.companySnapshot?.name}</Link>
            {detail?.employer?.ratingCount > 0 && <span className="jx-rating"> ★ {rating1.format(detail.employer.ratingAvg)} ({detail.employer.ratingCount})</span>}
          </div>
        </div>
        <div className="jx-preview-actions">
          <Link to={`/jobs/${j._id}`} className="btn btn-lg jx-apply">Xem chi tiết và ứng tuyển</Link>
          {!user ? <Link to={`/login?next=${encodeURIComponent(`/jobs/${j._id}`)}`} className="btn btn-lg btn-ghost"><Heart size={18} aria-hidden="true" />Lưu tin</Link>
            : user.role === 'STUDENT' && (
              <button type="button" className="btn btn-lg btn-ghost" onClick={() => onSave(j._id, saved)} aria-pressed={saved}>
                <Heart size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />{saved ? 'Đã lưu' : 'Lưu tin'}
              </button>
            )}
        </div>
      </div>
      <dl className="jx-facts">
        {facts.map(([I, k, v]) => <div key={k}><dt><I size={16} aria-hidden="true" />{k}</dt><dd>{v}</dd></div>)}
      </dl>
      {j.shifts?.length > 0 && <><h3>Ca làm trong tuần</h3><MiniWeek shifts={j.shifts} busy={busy} /></>}
      <h3>Mô tả công việc</h3>
      {detail ? <p className="jx-desc">{detail.job.description}</p> : <p className="jx-desc jx-loading" aria-busy="true">Đang tải mô tả…</p>}
      {detail?.job.requirements && <><h3>Yêu cầu</h3><p className="jx-desc">{detail.job.requirements}</p></>}
    </article>
  );
};

// SCR-C04 / FR-SRC-01: bộ lọc nằm trên URL để chia sẻ và quay lại được
class JobsPage extends Component {
  static contextType = AuthContext;
  state = { categories: [], locations: [], jobs: null, meta: null, form: {}, sel: null, details: {}, wide: false, week: null, loading: false, hint: !hintHidden(), savedIds: new Set() };

  params = () => Object.fromEntries(FILTERS.map((k) => [k, this.props.searchParams.get(k) || '']));

  async componentDidMount() {
    // Trang hai cột cần khung rộng hơn; header, nội dung và footer cùng nới để mép thẳng hàng
    document.body.classList.add('page-wide', 'page-canvas');
    this.mq = window.matchMedia?.(WIDE);
    this.mq?.addEventListener?.('change', this.onWide);
    document.addEventListener('mousedown', this.outsidePay);
    this.setState({ wide: !!this.mq?.matches });
    this.syncSaved();
    const [c, l] = await Promise.all([api.get('/categories'), api.get('/jobs/locations')]);
    this.setState({ categories: c.data, locations: l.data });
    this.load();
    // Nút "Tìm ca hợp lịch" ở trang chủ dẫn tới /jobs#lich-hoc: mở sẵn bảng lịch học
    if (this.props.location.hash === '#lich-hoc') this.openWeek();
  }

  componentWillUnmount() {
    document.body.classList.remove('page-wide', 'page-canvas');
    this.mq?.removeEventListener?.('change', this.onWide);
    document.removeEventListener('mousedown', this.outsidePay);
  }

  // Ô "Mức lương" là <details>: bấm ra ngoài thì đóng
  pay = React.createRef();
  outsidePay = (e) => { if (this.pay.current?.open && !this.pay.current.contains(e.target)) this.pay.current.open = false; };

  componentDidUpdate(prev) {
    if (prev.location.search !== this.props.location.search) this.load();
    this.syncSaved();
  }

  // Tin đã lưu của sinh viên; tải lại khi phiên đăng nhập khôi phục xong hoặc đổi tài khoản
  syncSaved = () => {
    const u = this.context.user;
    const key = u?.role === 'STUDENT' ? u._id : null;
    if (key === this.savedFor) return;
    this.savedFor = key;
    if (key) loadSavedIds().then((savedIds) => this.setState({ savedIds }));
    else this.setState({ savedIds: new Set() });
  };

  onWide = (e) => this.setState({ wide: e.matches });

  load = async () => {
    const p = this.params();
    // Giữ danh sách cũ (làm mờ) trong lúc tải để trang không giật
    this.setState({ loading: true, form: p });
    const r = await api.get(`/jobs${qs({ ...p, limit: 12 })}`);
    this.setState({ jobs: r.data, meta: r.meta, loading: false });
    if (r.data[0]) this.select(r.data[0]._id);
  };

  // Chọn tin để xem trước; mô tả tải một lần rồi giữ lại
  select = async (id) => {
    this.setState({ sel: id });
    if (this.state.details[id]) return;
    const r = await api.get(`/jobs/${id}`).catch(() => null);
    if (r) this.setState((s) => ({ details: { ...s.details, [id]: r.data } }));
  };

  apply = (patch) => {
    const next = { ...this.state.form, ...patch, page: patch.page || '' };
    if (patch.city !== undefined) next.district = '';
    this.props.setSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
    // Chỉ cuộn lên khi chuyển trang; đổi bộ lọc thì giữ nguyên chỗ đang xem
    if (patch.page) window.scrollTo({ top: 0, behavior: 'smooth' });
    if (this.pay.current) this.pay.current.open = false;
  };

  // Bảng lịch học: lấy lịch đang lọc, nếu chưa có thì lịch đã lưu (hồ sơ sinh viên, rồi trình duyệt)
  openWeek = () => {
    const cur = this.params().busy;
    const saved = this.context.user?.student?.busySlots;
    this.setState({ week: cur ? slots(cur) : saved?.length ? saved : readWeek() },
      () => document.getElementById('jx-week')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  };

  applyWeek = async () => {
    const { week } = this.state;
    writeWeek(week);
    this.setState({ week: null });
    this.apply({ busy: week.join(',') });
    if (this.context.user?.role === 'STUDENT') {
      await api.put('/students/me/schedule', { busySlots: week }).catch(() => {});
      this.context.reloadUser?.();
    }
  };

  toggleSave = saveToggler(this);

  hideHint = () => {
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* trình duyệt chặn lưu trữ */ }
    this.setState({ hint: false });
  };

  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value } });
  pick = (k) => (e) => this.apply({ [k]: e.target.value });

  // Chip cho từng bộ lọc đang bật, bấm × để bỏ đúng bộ lọc đó
  activeChips = (catName) => {
    const f = this.params();
    const unit = f.salaryType ? `/${SALARY_TYPE[f.salaryType]}` : '';
    return [
      f.q && ['q', `“${f.q}”`],
      f.categoryId && ['categoryId', catName[f.categoryId] || 'Ngành nghề'],
      f.city && ['city', f.city],
      f.district && ['district', f.district],
      f.salaryType && ['salaryType', SALARY_TYPES.find(([v]) => v === f.salaryType)?.[1]],
      f.salaryMin && ['salaryMin', `Từ ${money(f.salaryMin)}${unit}`],
      f.salaryMax && ['salaryMax', `Đến ${money(f.salaryMax)}${unit}`],
      f.busy && ['busy', 'Hợp lịch học của tôi'],
    ].filter(Boolean);
  };

  render() {
    const { categories, locations, jobs, meta, form, sel, details, wide, week, loading, hint, savedIds } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const districts = locations.find((l) => l.city === form.city)?.districts || [];
    const chips = this.activeChips(catName);
    const selected = jobs?.find((j) => j._id === sel);
    const user = this.context.user;
    // Lịch học để so với ca làm trong khung xem trước: đang lọc thì lấy lịch lọc, chưa lọc thì lịch đã lưu
    const busy = form.busy ? slots(form.busy) : user?.student?.busySlots?.length ? user.student.busySlots : readWeek();
    const payLabel = form.salaryMin || form.salaryMax
      ? [form.salaryMin && `Từ ${shortMoney(+form.salaryMin)}`, form.salaryMax && `đến ${shortMoney(+form.salaryMax)}`].filter(Boolean).join(' ')
      : 'Mức lương';
    return (
      <>
        <section className="jx-band">
          <div className="container">
            <h1 className="jx-title">Tìm việc part-time</h1>
            <form className="hx-search jx-search" onSubmit={(e) => { e.preventDefault(); this.apply({ q: form.q }); }} role="search">
              <label className="hx-field hx-q">
                <Search size={18} aria-hidden="true" />
                <input type="search" name="q" autoComplete="off" enterKeyHint="search" value={form.q || ''} onChange={this.set('q')}
                  placeholder="Vị trí hoặc kỹ năng: phục vụ, gia sư, Canva…" aria-label="Từ khóa" />
              </label>
              <Dropdown className="hx-field" value={form.categoryId || ''} onChange={this.pick('categoryId')} ariaLabel="Ngành nghề" placeholder="Tất cả ngành nghề" searchable
                options={categories.map((c) => ({ value: c._id, label: c.name, icon: categoryIcon(c.name), count: c.jobCount }))} />
              <Dropdown className="hx-field" value={form.city || ''} onChange={this.pick('city')} ariaLabel="Thành phố" placeholder="Tất cả địa điểm"
                options={locations.map((l) => ({ value: l.city, label: l.city, icon: MapPin }))} />
              <button className="btn btn-lg">Tìm việc</button>
            </form>

            {/* Hàng bộ lọc cùng một kiểu nút; lịch học đứng đầu vì là bộ lọc đặc trưng của JobSV */}
            <div className="jx-filters" aria-label="Bộ lọc">
              <button type="button" className={`jx-fbtn jx-week-btn ${form.busy ? 'on' : ''}`} aria-expanded={!!week} aria-controls="jx-week"
                onClick={() => (week ? this.setState({ week: null }) : this.openWeek())}>
                <CalendarDays size={16} aria-hidden="true" />
                <span>{form.busy ? `Bận: ${describeShifts(slots(form.busy))}` : 'Lịch học: chưa tô'}</span>
                <ChevronDown size={16} aria-hidden="true" />
              </button>
              <Dropdown className={`jx-pill ${form.salaryType ? 'on' : ''}`} value={form.salaryType || ''} onChange={this.pick('salaryType')}
                ariaLabel="Hình thức lương" placeholder="Hình thức lương" options={SALARY_TYPES.map(([value, label]) => ({ value, label }))} />
              <details className={`jx-pop ${form.salaryMin || form.salaryMax ? 'on' : ''}`} ref={this.pay}>
                <summary className="jx-fbtn">{payLabel}<ChevronDown size={16} aria-hidden="true" /></summary>
                <form className="jx-pop-body" onSubmit={(e) => { e.preventDefault(); this.apply({ salaryMin: form.salaryMin, salaryMax: form.salaryMax }); }}>
                  <p>Tính theo đơn vị của tin ({form.salaryType ? `mỗi ${SALARY_TYPE[form.salaryType]}` : 'giờ, ngày hoặc dự án'}).</p>
                  <label>Từ (đồng)<input type="number" name="salaryMin" inputMode="numeric" min="0" step="1000" placeholder="20000" value={form.salaryMin || ''} onChange={this.set('salaryMin')} /></label>
                  <label>Đến (đồng)<input type="number" name="salaryMax" inputMode="numeric" min="0" step="1000" placeholder="50000" value={form.salaryMax || ''} onChange={this.set('salaryMax')} /></label>
                  <button className="btn btn-sm">Áp dụng mức lương</button>
                </form>
              </details>
              {districts.length > 0 && (
                <Dropdown className={`jx-pill ${form.district ? 'on' : ''}`} value={form.district || ''} onChange={this.pick('district')} ariaLabel="Quận / huyện" placeholder="Mọi quận / huyện"
                  options={districts.map((d) => ({ value: d, label: d }))} />
              )}
            </div>

            {week && (
              <div id="jx-week" className="jx-week">
                <div className="jx-week-head">
                  <h2>Tô các buổi bạn có lịch học</h2>
                  <p>Hệ thống chỉ hiện việc còn ít nhất một ca không trùng giờ học, việc hợp nhiều ca nhất lên đầu.</p>
                </div>
                <ShiftGrid tone="busy" value={week} onChange={(v) => this.setState({ week: v })} label="Lịch học trong tuần" />
                <div className="jx-week-actions">
                  <button type="button" className="btn" onClick={this.applyWeek}>Tìm ca hợp lịch</button>
                  {week.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => this.setState({ week: [] })}>Xóa lịch</button>}
                  <span className="jx-week-note">
                    {user?.role === 'STUDENT' ? 'Lịch được lưu vào hồ sơ, lần sau mở là có sẵn.' : 'Lịch lưu trên trình duyệt này. Đăng nhập tài khoản sinh viên để dùng trên mọi máy.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="container page jx-page">
          <div className="jx-summary">
            <h2 className="h-lg" aria-live="polite">{meta ? `${meta.total} việc ${form.busy ? 'hợp lịch học của bạn' : 'phù hợp'}` : 'Đang tìm…'}</h2>
            {chips.length > 0 && (
              <ul className="jx-chips" aria-label="Bộ lọc đang bật">
                {chips.map(([k, label]) => (
                  <li key={k}><button type="button" onClick={() => this.apply({ [k]: '' })} aria-label={`Bỏ lọc ${label}`}>{label}<X size={14} aria-hidden="true" /></button></li>
                ))}
                <li><button type="button" className="jx-clear" onClick={() => this.props.setSearchParams({})}>Xóa tất cả</button></li>
              </ul>
            )}
          </div>

          {hint && !form.busy && (
            <div className="jx-hint">
              <CalendarDays size={20} aria-hidden="true" />
              <p><strong>Có lịch học cố định?</strong> Tô lịch một lần, chỉ thấy việc còn ca rảnh.</p>
              <button type="button" className="btn btn-sm" onClick={this.openWeek}>Tô lịch học</button>
              <button type="button" className="jx-hint-x" onClick={this.hideHint} aria-label="Ẩn gợi ý"><X size={16} aria-hidden="true" /></button>
            </div>
          )}

          {!jobs ? <Spinner /> : !jobs.length ? (
            <div className="card"><Empty title="Không có việc phù hợp">Bỏ bớt một bộ lọc ở trên, hoặc thử từ khóa ngắn hơn như “phục vụ”.</Empty></div>
          ) : (
            <div className={`jx-split ${wide ? 'wide' : ''} ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
              <ol className="jx-list">
                {jobs.map((j) => {
                  const on = wide && j._id === sel;
                  return (
                    <li key={j._id}>
                      <JobRow job={j} category={catName[j.categoryId]} on={on} saved={savedIds.has(j._id)}
                        onSave={user?.role === 'STUDENT' ? this.toggleSave : undefined} saveHref={user ? undefined : `/login?next=${encodeURIComponent(`/jobs/${j._id}`)}`}
                        onClick={(e) => { if (wide && plainClick(e)) { e.preventDefault(); this.select(j._id); } }} />
                    </li>
                  );
                })}
              </ol>
              {wide && selected && <div className="jx-aside"><Preview job={selected} detail={details[selected._id]} catName={catName} busy={busy} user={user} saved={savedIds.has(selected._id)} onSave={this.toggleSave} /></div>}
            </div>
          )}
          <Pagination meta={meta} onPage={(page) => this.apply({ page: String(page) })} />

          {!user && (
            <div className="jx-cta">
              <div><strong>Chưa thấy việc hợp ý?</strong><p>Tạo hồ sơ và tải CV một lần, có việc mới là ứng tuyển ngay.</p></div>
              <Link to="/register" className="btn btn-ghost">Tạo hồ sơ miễn phí</Link>
            </div>
          )}
        </div>
      </>
    );
  }
}

export default withRouter(JobsPage);
