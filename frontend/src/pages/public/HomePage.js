import React, { Component } from 'react';
import { ArrowRight, Ban, Bell, Bookmark, Building2, CalendarClock, CalendarDays, Check, FileText, GraduationCap, Heart, Hourglass, Lock, MapPin, Plus, Search, Star, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Alert, Dropdown, Stars } from '../../components/ui';
import { categoryIcon } from '../../components/Illustrations';
import { loadSavedIds, saveToggler, MiniWeek, busyOf, shiftText, PERIOD_ICON, FitBadge } from '../../components/JobRow';
import withRouter from '../../utils/withRouter';
import { money, salary, shiftParts, describeShifts } from '../../utils/format';
import { AuthContext } from '../../context/AuthContext';

// Bốn cam kết an toàn, mỗi cam kết là một business rule backend đang chặn
// t = meta.tiers của GET /plans (null khi chưa tải xong hoặc lỗi)
const promises = (t) => [
  [Ban, 'Không phí, không đặt cọc', 'Nhà tuyển dụng không được thu tiền của sinh viên. Tin đòi đặt cọc bị ẩn, tài khoản lừa đảo bị khóa.'],
  [Lock, 'Liên hệ chỉ mở khi được nhận', 'Số điện thoại và email của hai bên chỉ hiện khi đơn đã được nhận, không lộ cho người lạ.'],
  [Star, 'Đánh giá từ người đã làm', 'Chỉ đơn đã hoàn thành mới được đánh giá, mỗi bên một lần trong 14 ngày.'],
  [CalendarClock, 'Tin luôn còn hiệu lực', `Tin tự hết hạn${t ? ` sau ${t.free.days} ngày (${t.premium.days} ngày với Premium)` : ''}. Tin đã đủ người không còn hiện.`],
];

// Bảng so sánh với cách tìm việc qua group mạng xã hội; mỗi dòng ứng với một cam kết bên trái
const COMPARE = [
  ['Bị đòi đặt cọc, phí đồng phục', 'Tự xoay xở, khó đòi lại tiền', 'Báo cáo tin, admin ẩn tin hoặc khóa tài khoản'],
  ['Số điện thoại của bạn', 'Để công khai dưới bài đăng', 'Chỉ nhà tuyển dụng đã nhận bạn mới thấy'],
  ['Quán có uy tín không', 'Hỏi quanh, nghe lời đồn', 'Điểm đánh giá từ người đã làm xong việc'],
  ['Tin đã cũ', 'Bài cũ vẫn trôi, gọi mới biết đủ người', 'Tin tự ẩn khi hết hạn hoặc đủ người'],
];

const STUDENT_STEPS = [['Tạo hồ sơ', 'Điền trường, ngành, kỹ năng và tải CV'], ['Ứng tuyển', 'Nộp đơn kèm thư giới thiệu ngắn'], ['Đi làm', 'Được nhận thì thấy liên hệ, xong việc thì đánh giá']];
const EMPLOYER_STEPS = [['Đăng tin', 'Mô tả việc, mức lương và chọn ca làm trong tuần'], ['Duyệt hồ sơ', 'Xem CV và điểm đánh giá, nhận hoặc từ chối'], ['Xác nhận kết quả', 'Xong việc thì xác nhận và đánh giá sinh viên']];

// Tab "Ca làm tuần này" theo buổi (ô = ngày * 3 + buổi, xem Job.shifts). Lọc bằng tham số busy của API-20:
// coi mọi ô ngoài tab là bận, API giữ việc còn ít nhất một ca trong tab (và việc linh hoạt, xếp cuối)
const ALL_SLOTS = [...Array(21).keys()];
const PERIOD = (p) => [0, 1, 2, 3, 4, 5, 6].map((d) => d * 3 + p);
const TABS = [['all', 'Tất cả', null], ['morning', 'Buổi sáng', PERIOD(0)], ['afternoon', 'Buổi chiều', PERIOD(1)], ['evening', 'Buổi tối', PERIOD(2)], ['weekend', 'Cuối tuần', [15, 16, 17, 18, 19, 20]]];
const HOME_JOBS = 6;
// Thời khóa biểu minh họa trong khung điện thoại: h = giờ học, w = ca làm thêm, . = trống
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEK = [['Sáng', 'hhhhh.'], ['Chiều', 'h.h.hw'], ['Tối', 'w.w.w.']];
// Ít đánh giá quá thì điểm trung bình gây phản tác dụng → ẩn mục đánh giá
const MIN_REVIEWS = 5;
// Từ khóa đã tìm gần đây (gợi ý sẵn trong ô tìm kiếm bằng <datalist>)
const RECENT_KEY = 'jobsv.recentQ';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || []; } catch { return []; } };
const pushRecent = (q) => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...readRecent().filter((x) => x !== q)].slice(0, 5))); } catch { /* bỏ qua */ } };
const rating1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const faq = (t) => [
  ['Ứng tuyển có mất phí không?', 'Hoàn toàn miễn phí với sinh viên. Nhà tuyển dụng không được thu bất kỳ khoản phí nào của bạn.'],
  ['Bị yêu cầu đặt cọc hoặc đóng phí thì làm gì?', 'Đừng chuyển tiền. Bấm “Báo cáo tin này” ở trang chi tiết việc và chọn lý do “Lừa đảo / thu phí”. Quản trị viên xử lý theo 3 bậc: cảnh cáo, ẩn tin hoặc khóa tài khoản.'],
  ['Tôi cần chuẩn bị gì để ứng tuyển?', 'Đăng ký bằng email trường, điền hồ sơ và tải lên một CV PDF. CV này được dùng lại cho mọi đơn ứng tuyển.'],
  ['Làm sao biết nhà tuyển dụng đáng tin?', 'Mỗi nhà tuyển dụng có trang công khai với điểm đánh giá từ những sinh viên đã từng làm việc ở đó.'],
  t && ['Nhà tuyển dụng đăng tin thế nào?', `Mỗi tài khoản được đăng tối đa ${t.free.quota} tin miễn phí. Gói Premium nâng lên ${t.premium.quota} tin, mỗi tin hiển thị ${t.premium.days} ngày và được ghim Nổi bật.`],
].filter(Boolean);

// "Ca làm tuần này": tin đầu (nổi bật trước, API đã xếp) làm thẻ lớn kèm lịch ca thu nhỏ, các tin còn lại là danh sách gọn.
// Nút lưu: sinh viên bấm lưu ngay, khách được dẫn đi đăng nhập, nhà tuyển dụng không có nút
const DAY = 864e5;
const SaveBtn = ({ job, saved, onSave, saveHref }) => (onSave ? (
  <button type="button" className={`sh-save ${saved ? 'on' : ''}`} aria-pressed={!!saved} aria-label={saved ? 'Bỏ lưu tin' : 'Lưu tin'} onClick={() => onSave(job._id, saved)}>
    <Heart size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
  </button>
) : saveHref ? <Link to={saveHref} className="sh-save" aria-label="Đăng nhập để lưu tin"><Heart size={18} aria-hidden="true" /></Link> : null);

const Logo = ({ job, category, size }) => {
  const Icon = categoryIcon(category);
  return (
    <span className="jx-logo" style={{ width: size, height: size }}>
      {job.companySnapshot?.logoUrl ? <img src={job.companySnapshot.logoUrl} alt="" width={size} height={size} loading="lazy" /> : <Icon size={size / 2.4} aria-hidden="true" />}
    </span>
  );
};

const Shifts = ({ job }) => (job.shifts?.length ? (
  <ul className="sh-shifts">
    {shiftParts(job.shifts).map((p) => {
      const Icon = PERIOD_ICON[p.period];
      return <li key={p.period} className={`jr-p${p.period}`}><Icon size={14} aria-hidden="true" /><b>{p.label}</b> {p.days}</li>;
    })}
  </ul>
) : job.schedule ? <p className="sh-flex">{job.schedule}</p> : null);

const Spotlight = ({ job: j, category, busy, save }) => {
  const left = j.slots - (j.acceptedCount || 0);
  const daysLeft = Math.ceil((new Date(j.expiresAt) - Date.now()) / DAY);
  return (
    <article className="sh-spot">
      <div className="sh-spot-top">
        <Logo job={j} category={category} size={56} />
        <span className="sh-company">{j.companySnapshot?.name}{j.isFeatured && <span className="jt-badge">Nổi bật</span>}</span>
        <SaveBtn job={j} {...save} />
      </div>
      <h3 className="sh-spot-title"><Link to={`/jobs/${j._id}`} className="sh-link">{j.title}</Link></h3>
      <p className="sh-spot-pay">{salary(j)}</p>
      <p className="sh-where"><MapPin size={15} aria-hidden="true" />{[j.district, j.city].filter(Boolean).join(', ')}</p>
      {j.shifts?.length ? <MiniWeek shifts={j.shifts} busy={busy} /> : <Shifts job={j} />}
      <div className="sh-spot-foot">
        <span><Users size={15} aria-hidden="true" />{left > 0 ? `Còn ${left}/${j.slots} chỗ` : 'Đã đủ người'}</span>
        <span className={daysLeft <= 3 ? 'jr-urgent' : ''}><Hourglass size={15} aria-hidden="true" />{daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`}</span>
        <span className="sh-go" aria-hidden="true">Xem chi tiết<ArrowRight size={16} /></span>
      </div>
    </article>
  );
};

const ShiftRow = ({ job: j, category, save, i }) => (
  <li className="sh-row" style={{ '--i': i }}>
    <Logo job={j} category={category} size={44} />
    <div className="sh-row-main">
      <h3 className="sh-row-title"><Link to={`/jobs/${j._id}`} className="sh-link" title={shiftText(j) || undefined}>{j.title}</Link></h3>
      <p className="sh-row-sub">{j.companySnapshot?.name}<span aria-hidden="true">, </span>{j.district || j.city}</p>
      <Shifts job={j} />
      {j.fit !== undefined && <div className="sh-fit"><FitBadge job={j} /></div>}
    </div>
    <p className="sh-row-pay">{salary(j)}</p>
    <SaveBtn job={j} {...save} />
  </li>
);

// "Dành cho bạn" (chỉ sinh viên đăng nhập): đơn đang chờ, tin đã lưu sắp hết hạn, lịch học, và việc hợp lịch học trong hồ sơ
const ForYou = ({ user, data, catName, save }) => {
  const busy = user.student?.busySlots || [];
  const soon = data.saved.filter((j) => new Date(j.expiresAt) - Date.now() < 3 * DAY).length;
  const tiles = [
    [FileText, 'Đơn đang chờ duyệt', data.pending, '/student/applications'],
    [Bookmark, soon ? `Tin đã lưu, ${soon} sắp hết hạn` : 'Tin đã lưu', data.saved.length, '/student/saved-jobs'],
    [CalendarDays, busy.length ? 'Buổi học đã tô' : 'Chưa tô lịch học', busy.length, '/jobs#lich-hoc'],
  ];
  return (
    <section className="gn-sec fy" aria-labelledby="fy-title">
      <h2 id="fy-title" className="gn-h2">Dành cho bạn, {user.fullName.trim().split(' ').pop()}</h2>
      <div className="fy-grid">
        <ul className="fy-tiles">
          {tiles.map(([Icon, label, n, to]) => (
            <li key={to}><Link to={to} className="fy-tile"><Icon size={20} aria-hidden="true" /><strong>{n}</strong><span>{label}</span></Link></li>
          ))}
        </ul>
        <div className="fy-jobs">
          <h3 className="gn-h3">{busy.length ? 'Việc hợp lịch học của bạn' : 'Việc mới nhất'}</h3>
          {!data.jobs.length ? <p className="muted">Chưa có việc nào còn ca rảnh so với lịch học của bạn.</p> : (
            <ol className="sh-list">{data.jobs.map((j, i) => <ShiftRow key={j._id} job={j} category={catName[j.categoryId]} save={save(j)} i={i} />)}</ol>
          )}
          {!busy.length && <p className="fy-hint">Tô các buổi có tiết học để UniShift chỉ gợi ý việc không trùng giờ. <Link to="/jobs#lich-hoc" className="gn-link">Tô lịch học</Link></p>}
        </div>
      </div>
    </section>
  );
};

class HomePage extends Component {
  static contextType = AuthContext;
  state = {
    q: '', categoryId: '', city: '', categories: [], locations: [], jobs: null, tab: 'all', loading: false,
    total: 0, reviews: [], rating: null, plans: [], tiers: null, savedIds: new Set(), employers: [],
    forYou: null, recent: readRecent(), alertEmail: '', alertState: '', alertError: '',
  };

  async componentDidMount() {
    this.syncSaved();
    const [c, l, j, p] = await Promise.all([
      api.get('/categories'), api.get('/jobs/locations'), api.get(`/jobs?limit=${HOME_JOBS}`), api.get('/plans').catch(() => ({ data: [], meta: {} })),
    ]);
    this.setState({ categories: c.data, locations: l.data, jobs: j.data, total: j.meta?.total || j.data.length, plans: p.data, tiers: p.meta?.tiers || null },
      // Link /#hoi-dap từ footer: cuộn tới mục sau khi nội dung phía trên đã có chiều cao thật
      () => { const h = this.props.location.hash; if (h) document.getElementById(h.slice(1))?.scrollIntoView(); });
    // Lời chứng thực thật: đánh giá gần nhất của sinh viên, điểm trung bình trên mọi đánh giá đang hiện
    const [r, e] = await Promise.all([api.get('/reviews/recent?limit=3').catch(() => null), api.get('/employers/hiring?limit=12').catch(() => null)]);
    this.setState({
      reviews: r?.data || [],
      rating: r?.meta?.ratingCount ? { avg: r.meta.ratingAvg, count: r.meta.ratingCount } : null,
      employers: e?.data || [],
    });
  }

  componentDidUpdate(prev) {
    this.syncSaved();
    const h = this.props.location.hash;
    if (h && h !== prev.location.hash) document.getElementById(h.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }
  // StrictMode (dev) gỡ rồi gắn lại component: xóa mốc để lần gắn sau tải lại theo người dùng
  componentWillUnmount() { this.savedFor = undefined; }

  // Theo người đang đăng nhập: tô tim tin đã lưu, điền sẵn email, tải mục "Dành cho bạn" của sinh viên
  syncSaved = () => {
    const u = this.context.user;
    const key = u ? `${u._id}:${u.student?.busySlots?.join() || ''}` : 'guest';
    if (key === this.savedFor) return;
    this.savedFor = key;
    this.setState({ alertEmail: u?.email || '' });
    if (u?.role !== 'STUDENT') return this.setState({ forYou: null });
    loadSavedIds().then((savedIds) => this.setState({ savedIds }));
    const busy = u.student?.busySlots || [];
    Promise.all([
      api.get('/students/me/applications?status=PENDING&limit=1'),
      api.get('/students/me/saved-jobs'),
      api.get(`/jobs${qs({ limit: 4, busy: busy.length ? busy.join(',') : undefined })}`),
    ]).then(([a, sv, jb]) => this.setState({ forYou: { pending: a.meta?.total || 0, saved: sv.data, jobs: jb.data } })).catch(() => {});
  };

  subscribe = async (e) => {
    e.preventDefault();
    this.setState({ alertState: 'busy', alertError: '' });
    try {
      await api.post('/job-alerts', { email: this.state.alertEmail, busySlots: busyOf(this.context.user) });
      this.setState({ alertState: 'done' });
    } catch (err) {
      this.setState({ alertState: '', alertError: err.message });
    }
  };

  toggleSave = saveToggler(this);

  // Giữ danh sách cũ (làm mờ) trong lúc tải tab mới để trang không giật
  loadTab = async (tab) => {
    this.setState({ tab, loading: true });
    const cells = TABS.find(([k]) => k === tab)[2];
    const busy = cells && ALL_SLOTS.filter((i) => !cells.includes(i)).join(',');
    const r = await api.get(`/jobs${qs({ limit: HOME_JOBS, busy })}`);
    // fit/shiftCount ở đây tính theo tab chứ không theo lịch học của người xem → bỏ để không hiện nhãn "Hợp x/y ca"
    if (this.state.tab === tab) this.setState({ jobs: r.data.map(({ fit, shiftCount, ...j }) => j), loading: false });
  };

  // Tab theo mẫu WAI-ARIA: mũi tên trái/phải chuyển tab, Home/End về đầu/cuối
  tabKey = (e) => {
    const i = TABS.findIndex(([k]) => k === this.state.tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    const n = (next + TABS.length) % TABS.length;
    document.getElementById(`gn-tab-${TABS[n][0]}`)?.focus();
    this.loadTab(TABS[n][0]);
  };

  search = (e) => {
    e.preventDefault();
    const { q, categoryId, city } = this.state;
    if (q.trim()) pushRecent(q.trim());
    this.props.navigate(`/jobs${qs({ q, categoryId, city })}`);
  };

  set = (k) => (e) => this.setState({ [k]: e.target.value });

  render() {
    const { q, categoryId, city, categories, locations, jobs, tab, loading, total, reviews, rating, plans, tiers, employers, forYou, recent, alertEmail, alertState, alertError } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const user = this.context.user;
    // Sinh viên đã đăng nhập không vào được /employer/* (403) → dẫn sang đăng ký tài khoản nhà tuyển dụng
    const postJob = user?.role === 'EMPLOYER' ? '/employer/jobs/new' : '/register?role=EMPLOYER';
    // Ngành đang có tin, nhiều tin xếp trước (dùng cho chip ở hero và hàng ngành ②)
    const hiring = categories.filter((c) => c.jobCount > 0).sort((a, b) => b.jobCount - a.jobCount);
    const busiest = hiring.slice(0, 4);
    const save = (j) => ({ saved: this.state.savedIds.has(j._id), onSave: user?.role === 'STUDENT' ? this.toggleSave : undefined, saveHref: user ? undefined : `/login?next=${encodeURIComponent(`/jobs/${j._id}`)}` });
    const areas = [...locations].sort((a, b) => b.total - a.total).filter((l) => l.total > 0);
    return (
      <>
        {this.props.searchParams.get('alerts') === 'off' && <div className="container"><Alert type="ok">Bạn đã hủy nhận email thông báo việc mới.</Alert></div>}
        {/* Hero kiểu Revolut: bầu trời phủ kín màn hình, khung điện thoại hiện một tin thật. Khi cuộn (desktop),
            hero được ghim lại, bầu trời thu dần vào khung điện thoại, chữ mờ đi và câu kết hiện lên (CSS scroll-driven) */}
        <section className="rv-hero" aria-labelledby="rv-title">
          <div className="rv-stage">
            <div className="rv-sky" aria-hidden="true" />
            <div className="container rv-inner">
              <div className="rv-copy">
                <h1 id="rv-title" className="rv-title">Việc part-time vừa với lịch học</h1>
                <p className="rv-sub">Lương, ca làm và đánh giá thật hiện rõ trước khi bạn nộp đơn. Không phí, không đặt cọc.</p>
                <form className="hx-search rv-search" onSubmit={this.search} role="search">
                  <label className="hx-field hx-q">
                    <Search size={18} aria-hidden="true" />
                    <input value={q} onChange={this.set('q')} placeholder="Vị trí hoặc kỹ năng" aria-label="Từ khóa" list="rv-recent" autoComplete="off" />
                    <datalist id="rv-recent">{recent.map((x) => <option key={x} value={x} />)}</datalist>
                  </label>
                  <Dropdown className="hx-field" value={categoryId} onChange={this.set('categoryId')} ariaLabel="Ngành nghề" placeholder="Ngành nghề" searchable
                    options={categories.map((c) => ({ value: c._id, label: c.name, icon: categoryIcon(c.name), count: c.jobCount }))} />
                  <Dropdown className="hx-field" value={city} onChange={this.set('city')} ariaLabel="Thành phố" placeholder="Địa điểm"
                    options={locations.map((l) => ({ value: l.city, label: l.city, icon: MapPin }))} />
                  <button className="btn btn-lg">Tìm việc</button>
                </form>
                {busiest.length > 0 && (
                  <p className="gn-chips rv-chips">
                    <span>Đang tuyển nhiều:</span>
                    {busiest.map((c) => {
                      const Icon = categoryIcon(c.name);
                      return <Link key={c._id} to={`/jobs?categoryId=${c._id}`} className="gn-chip"><Icon size={15} aria-hidden="true" />{c.name}<span>{c.jobCount}</span></Link>;
                    })}
                  </p>
                )}
              </div>
              <Link to="/jobs#lich-hoc" className="btn btn-lg gn-btn-white rv-mobile-week"><CalendarDays size={18} aria-hidden="true" />Tô lịch học</Link>
              <p className="rv-after">Mỗi tin đều ghi rõ lương, ca làm và địa điểm. Bạn biết mình nhận gì trước khi nộp đơn.</p>
            </div>

            {/* Khung điện thoại: thời khóa biểu một tuần, giờ học mờ, ca làm thêm xanh lấp vào chỗ trống. Bấm vào là sang danh sách việc */}
            <Link to="/jobs#lich-hoc" className="rv-phone" aria-label="Xem danh sách việc làm part-time">
              <span className="rv-week-head">
                <strong>Tuần của bạn</strong>
                <span>Học xong, đi làm. Không trùng giờ.</span>
              </span>
              <span className="rv-week" aria-hidden="true">
                <span />
                {DAYS.map((d) => <span key={d} className="rv-day">{d}</span>)}
                {WEEK.map(([slot, cells]) => (
                  <React.Fragment key={slot}>
                    <span className="rv-slot">{slot}</span>
                    {[...cells].map((c, i) => <span key={i} className={`rv-cell rv-${c}`} style={c === 'w' ? { '--i': i } : undefined} />)}
                  </React.Fragment>
                ))}
              </span>
              <span className="rv-legend" aria-hidden="true">
                <span><i className="rv-cell rv-h" />Giờ học</span>
                <span><i className="rv-cell rv-w" />Ca làm thêm</span>
              </span>
              <span className="rv-phone-btn">Tìm ca hợp lịch</span>
              <ul className="rv-badges">
                <li><Ban size={18} aria-hidden="true" />Không phí, không đặt cọc</li>
                <li><Lock size={18} aria-hidden="true" />Liên hệ chỉ mở khi được nhận</li>
              </ul>
            </Link>
            <span className="rv-float rv-float-1" aria-hidden="true"><Check size={16} />Ca làm không trùng giờ học</span>
            <span className="rv-float rv-float-2" aria-hidden="true"><Check size={16} />Lương ghi rõ trên từng tin</span>
          </div>
        </section>

        <div className="container">
          {user?.role === 'STUDENT' && forYou && <ForYou user={user} data={forYou} catName={catName} save={save} />}

          {/* ① Ca làm tuần này: lọc theo buổi, nối tiếp khung "Tuần của bạn" ở hero */}
          <section className="gn-sec" aria-labelledby="gn-jobs">
            <div className="sh-head">
              <div>
                <h2 id="gn-jobs" className="gn-h2">Ca làm tuần này</h2>
                <p>{total ? `${total} tin đang mở` : 'Tin mới nhất'} từ quán cà phê, trung tâm gia sư và cửa hàng gần trường.</p>
              </div>
              <div className="sh-seg" role="tablist" aria-label="Buổi làm" onKeyDown={this.tabKey}>
                {TABS.map(([key, label]) => (
                  <button key={key} id={`gn-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls="gn-jobs-panel" tabIndex={tab === key ? 0 : -1}
                    className="sh-seg-btn" onClick={() => this.loadTab(key)}>{label}</button>
                ))}
              </div>
            </div>
            <div id="gn-jobs-panel" role="tabpanel" aria-labelledby={`gn-tab-${tab}`} aria-busy={loading}>
              {!jobs ? (
                <div className="sh-board" aria-hidden="true"><div className="sh-spot sh-sk" /><div className="sh-list">{[0, 1, 2, 3].map((i) => <div key={i} className="sh-row sh-sk" />)}</div></div>
              ) : !jobs.length ? (
                <div className="gn-empty">
                  <p>{tab !== 'all' ? 'Chưa có ca nào vào buổi này. Thử buổi khác nhé.' : 'Chưa có tin tuyển dụng nào đang mở.'}</p>
                  {tab === 'all' && user?.role !== 'STUDENT' && <Link to={postJob} className="gn-link">Đăng tin tuyển dụng đầu tiên</Link>}
                </div>
              ) : (() => {
                const [first, ...rest] = jobs.slice(0, HOME_JOBS);
                return (
                  <div key={jobs.map((j) => j._id).join()} className={`sh-board ${rest.length ? '' : 'solo'} ${loading ? 'is-loading' : ''}`}>
                    <Spotlight job={first} category={catName[first.categoryId]} busy={busyOf(user)} save={save(first)} />
                    {rest.length > 0 && <ol className="sh-list">{rest.map((j, i) => <ShiftRow key={j._id} job={j} category={catName[j.categoryId]} save={save(j)} i={i} />)}</ol>}
                  </div>
                );
              })()}
            </div>
            <div className="sh-more">
              <Link to="/jobs" className="btn btn-ghost">Xem tất cả {total || ''} việc làm<ArrowRight size={18} aria-hidden="true" /></Link>
              <Link to="/jobs#lich-hoc" className="gn-link sh-cal"><CalendarDays size={18} aria-hidden="true" />Tô lịch học</Link>
            </div>
          </section>

          {/* ② Theo ngành: một hàng cuộn ngang, chỉ ngành đang có tin, nhiều tin xếp trước */}
          {hiring.length > 0 && (
            <section className="gn-sec-tight" aria-labelledby="gn-cats">
              <h2 id="gn-cats" className="gn-h3">Lương theo ngành</h2>
              <ul className="gn-cats">
                {hiring.map((c) => {
                  const Icon = categoryIcon(c.name);
                  return (
                    <li key={c._id}>
                      <Link to={`/jobs?categoryId=${c._id}`} className="gn-cat">
                        <Icon size={20} aria-hidden="true" />
                        <span className="gn-cat-text">
                          <strong>{c.name}</strong>
                          <span><span className="gn-pay">{salary(c.pay)}</span> {c.jobCount} việc</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* ③ Nhà tuyển dụng đang có tin mở: logo + tên + số tin, bấm vào sang trang công ty */}
          {employers.length > 0 && (
            <section className="gn-sec-tight" aria-labelledby="gn-emp">
              <h2 id="gn-emp" className="gn-h3">Đang tuyển trên UniShift</h2>
              <ul className="em-grid">
                {employers.map((e) => (
                  <li key={e._id}>
                    <Link to={`/employers/${e._id}`} className="em-tile">
                      <span className="jx-logo">{e.logoUrl ? <img src={e.logoUrl} alt="" width="48" height="48" loading="lazy" /> : <Building2 size={20} aria-hidden="true" />}</span>
                      <span className="em-text"><strong>{e.name}</strong><span>{e.jobs} tin đang mở</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ④ Việc theo khu vực: thành phố nhiều tin trước, mỗi quận một link lọc sẵn */}
          {areas.length > 0 && (
            <section className="gn-sec-tight" aria-labelledby="gn-area">
              <h2 id="gn-area" className="gn-h3">Việc theo khu vực</h2>
              <div className="ar-grid">
                {areas.map((l) => (
                  <div key={l.city} className="ar-city">
                    <Link to={`/jobs${qs({ city: l.city })}`} className="ar-name"><MapPin size={16} aria-hidden="true" />{l.city}<span>{l.total} việc</span></Link>
                    {l.districts.length > 0 && (
                      <ul>{l.districts.map((d) => <li key={d}><Link to={`/jobs${qs({ city: l.city, district: d })}`}>{d}<span>{l.counts?.[d]}</span></Link></li>)}</ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <section className="gn-safe" aria-labelledby="gn-safe">
          <div className="container gn-safe-grid">
            <div>
              <h2 id="gn-safe" className="gn-h2">An toàn là mặc định</h2>
              <p className="gn-safe-lede">Làm thêm qua group mạng xã hội dễ gặp tin đòi đặt cọc hay đóng phí đồng phục. Trên UniShift, những điều dưới đây được hệ thống chặn sẵn.</p>
              <dl className="gn-promises">
                {promises(tiers).map(([Icon, title, text]) => (
                  <div key={title}>
                    <dt><Icon size={20} aria-hidden="true" />{title}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <table className="gn-compare">
              <caption className="sr-only">So sánh tìm việc qua group mạng xã hội và qua UniShift</caption>
              <thead><tr><th scope="col">Tình huống</th><th scope="col">Group mạng xã hội</th><th scope="col">UniShift</th></tr></thead>
              <tbody>
                {COMPARE.map(([when, group, ours]) => (
                  <tr key={when}>
                    <th scope="row">{when}</th>
                    <td className="gn-compare-no" data-label="Group mạng xã hội"><X size={16} aria-hidden="true" />{group}</td>
                    <td className="gn-compare-yes" data-label="UniShift"><Check size={16} aria-hidden="true" />{ours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="container">
          {/* ④ Hai phía: mỗi ô một nhãn, tiêu đề, 3 bước, một dòng chi phí và một nút */}
          <section className="gn-sec" aria-labelledby="gn-who">
            <div className="gn-head">
              <h2 id="gn-who" className="gn-h2">Dành cho cả hai phía</h2>
              <p>Sinh viên tìm việc vừa lịch học, nhà tuyển dụng tìm người làm được ngay.</p>
            </div>
            <div className="gn-who">
              {[
                [GraduationCap, 'Sinh viên', 'Tìm việc không mất phí', STUDENT_STEPS, 'Miễn phí hoàn toàn cho sinh viên.',
                  <Link to={user?.role === 'STUDENT' ? '/student/profile' : '/register'} className="btn btn-lg">{user?.role === 'STUDENT' ? 'Hoàn thiện hồ sơ' : 'Tạo hồ sơ miễn phí'}</Link>],
                [Building2, 'Nhà tuyển dụng', 'Tuyển sinh viên trong vài ngày', EMPLOYER_STEPS,
                  tiers ? `${tiers.free.quota} tin miễn phí, mỗi tin hiển thị ${tiers.free.days} ngày.${plans.length ? ` Premium từ ${money(Math.min(...plans.map((p) => p.price)))} cho ${tiers.premium.quota} tin.` : ''}` : '',
                  <Link to={postJob} className="btn btn-lg">Đăng tin tuyển dụng</Link>],
              ].map(([Icon, who, title, steps, note, cta]) => (
                <article key={who} className="gn-panel">
                  <span className="gn-pill"><Icon size={18} aria-hidden="true" />{who}</span>
                  <h3 className="gn-panel-title">{title}</h3>
                  <ol className="gn-steps">
                    {steps.map(([t, d], i) => <li key={t}><span className="gn-step-num">{i + 1}</span><div><strong>{t}</strong><span>{d}</span></div></li>)}
                  </ol>
                  <p className="gn-panel-note">{note}</p>
                  {cta}
                </article>
              ))}
            </div>
          </section>

          {/* ⑤ Đánh giá: điểm trung bình lớn bên trái, các câu đánh giá bên phải; ít hơn 3 câu thì ẩn */}
          {reviews.length > 0 && rating?.count >= MIN_REVIEWS && (
            <section className="gn-sec gn-voices" aria-labelledby="gn-voices">
              <div className="gn-score">
                <h2 id="gn-voices" className="gn-h2">Sinh viên nói gì sau ca làm</h2>
                <p className="gn-score-num">{rating1.format(rating.avg)}<span aria-hidden="true">★</span></p>
                <p>Trung bình từ {rating.count} đánh giá của sinh viên đã làm xong việc.</p>
              </div>
              <ul className="gn-quotes">
                {reviews.map((r) => (
                  <li key={r._id}>
                    <figure className="gn-quote">
                      <blockquote>“{r.comment}”</blockquote>
                      <figcaption>
                        <span><strong>{r.reviewerId?.fullName || 'Sinh viên'}</strong>{r.jobId && <>, {r.jobId.title} tại {r.jobId.companySnapshot?.name}</>}</span>
                        <span role="img" aria-label={`${r.rating} trên 5 sao`}><Stars value={r.rating} /></span>
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ⑥ FAQ một cột giữa trang */}
          <section className="gn-sec gn-faq" id="hoi-dap" aria-labelledby="gn-faq">
            <h2 id="gn-faq" className="gn-h2">Câu hỏi thường gặp</h2>
            <div>
              {faq(tiers).map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}<Plus size={20} aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        {/* ⑦ Kết trang theo vai trò: sinh viên mở lịch học, nhà tuyển dụng đăng tin (nút cho nhà tuyển dụng đã có ở ④ với khách) */}
        <section className="gn-band" aria-labelledby="gn-end">
          {user?.role === 'EMPLOYER' ? (
            <>
              <h2 id="gn-end" className="gn-h2">Cần người cho ca làm tuần này?</h2>
              <p>Đăng tin kèm ca làm trong tuần để sinh viên có lịch học phù hợp tìm thấy bạn.</p>
              <Link to={postJob} className="btn btn-lg gn-btn-white">Đăng tin tuyển dụng</Link>
            </>
          ) : (
            <>
              <h2 id="gn-end" className="gn-h2">Nhận việc mới hợp lịch qua email</h2>
              <p>{busyOf(user).length ? `Khi có tin còn ca rảnh so với lịch học bạn đã tô (bận ${describeShifts(busyOf(user))}), UniShift gửi email cho bạn.` : 'Có tin mới là UniShift gửi email cho bạn. Tô lịch học ở trang Tìm việc để chỉ nhận việc không trùng giờ.'} Hủy bất cứ lúc nào.</p>
              {alertState === 'done' ? (
                <p className="al-done" role="status"><Bell size={18} aria-hidden="true" />Đã đăng ký. Việc mới sẽ được gửi tới {alertEmail}.</p>
              ) : (
                <form className="al-form" onSubmit={this.subscribe}>
                  <label className="sr-only" htmlFor="al-email">Email nhận thông báo</label>
                  <input id="al-email" type="email" required value={alertEmail} onChange={this.set('alertEmail')} placeholder="email@truong.edu.vn" aria-invalid={!!alertError} aria-describedby={alertError ? 'al-error' : undefined} />
                  <button className="btn btn-lg gn-btn-white" disabled={alertState === 'busy'}>{alertState === 'busy' ? 'Đang gửi…' : 'Nhận thông báo'}</button>
                  {alertError && <p id="al-error" className="al-error">{alertError}</p>}
                </form>
              )}
            </>
          )}
        </section>
      </>
    );
  }
}

export default withRouter(HomePage);
