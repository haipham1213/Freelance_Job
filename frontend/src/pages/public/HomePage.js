import React, { Component } from 'react';
import { ArrowRight, Ban, Bell, Building2, CalendarClock, CalendarDays, Check, Heart, Hourglass, Lock, MapPin, Plus, Search, Star, Users, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Alert, Dropdown, Stars } from '../../components/ui';
import { categoryIcon } from '../../components/Illustrations';
import { loadSavedIds, saveToggler, busyOf, shiftText, PERIOD_ICON, FitBadge } from '../../components/JobRow';
import withRouter from '../../utils/withRouter';
import { money, salary, shiftParts, describeShifts, DAYS as WEEKDAYS, PERIODS } from '../../utils/format';
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

// "Ca làm tuần này": lưới thẻ việc đều nhau (nổi bật trước, API đã xếp).
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

// Tuần thu nhỏ trên thẻ việc: cùng lưới Sáng/Chiều/Tối × T2–CN như "Tuần của bạn" ở hero, ô xanh lá là ca làm.
// focus = các ô thuộc tab buổi đang chọn; ca ngoài tab nhạt đi để thấy ngay ca nào khớp buổi bạn rảnh
const WeekStrip = ({ shifts, focus }) => {
  const on = new Set(shifts);
  const lit = focus && new Set(focus);
  return (
    <div className="sc-week" role="img" aria-label={`Ca làm: ${describeShifts(shifts)}`}>
      <span />
      {WEEKDAYS.map((d) => <span key={d} className="sc-day">{d}</span>)}
      {PERIODS.map((label, p) => (
        <React.Fragment key={label}>
          <span className="sc-period">{label}</span>
          {WEEKDAYS.map((d, day) => {
            const i = day * 3 + p;
            return <span key={d} className={`sc-cell${on.has(i) ? ' on' : ''}${lit && !lit.has(i) ? ' dim' : ''}`} />;
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

// Thẻ việc: công ty và khu vực ở đầu, tên việc, tuần thu nhỏ (hoặc ô giờ linh hoạt cùng chiều cao), chỗ trống, lương
const JobCard = ({ job: j, category, save, focus }) => {
  const left = j.slots - (j.acceptedCount || 0);
  const daysLeft = Math.ceil((new Date(j.expiresAt) - Date.now()) / DAY);
  return (
    <li className="sc">
      <div className="sc-head">
        <Logo job={j} category={category} size={44} />
        <div className="sc-org">
          <p className="sc-company">{j.companySnapshot?.name}</p>
          <p className="sc-where"><MapPin size={13} aria-hidden="true" />{[j.district, j.city].filter(Boolean).join(', ')}</p>
        </div>
        <SaveBtn job={j} {...save} />
      </div>
      <h3 className="sc-title"><Link to={`/jobs/${j._id}`} className="sh-link">{j.title}</Link></h3>
      {j.shifts?.length ? <WeekStrip shifts={j.shifts} focus={focus} />
        : <p className="sc-flex"><CalendarClock size={18} aria-hidden="true" /><span><b>Giờ linh hoạt</b>{j.schedule || 'Tự sắp theo lịch học'}</span></p>}
      <p className="sc-meta">
        <span><Users size={14} aria-hidden="true" />{left > 0 ? `Còn ${left}/${j.slots} chỗ` : 'Đã đủ người'}</span>
        <span className={daysLeft <= 3 ? 'jr-urgent' : ''}><Hourglass size={14} aria-hidden="true" />{daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`}</span>
        {j.isFeatured && <span className="sc-badge">Nổi bật</span>}
      </p>
      <div className="sc-foot">
        <p className="sc-pay">{salary(j)}</p>
        <span className="sc-go" aria-hidden="true">Xem ca<ArrowRight size={16} /></span>
      </div>
    </li>
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
    ['Đơn đang chờ duyệt', data.pending, '/student/applications'],
    [soon ? `Tin đã lưu, ${soon} sắp hết hạn` : 'Tin đã lưu', data.saved.length, '/student/saved-jobs'],
    [busy.length ? 'Buổi học đã tô' : 'Chưa tô lịch học', busy.length, '/jobs#lich-hoc'],
  ];
  // Dải abyss: hàng số liệu neon chia vạch dọc ở trên, việc hợp lịch học (danh sách mint) ở dưới
  return (
    <section className="gn-sec" aria-labelledby="fy-title">
      <div className="band fy">
        <div className="sec-head sec-head-left">
          <span className="eyebrow eyebrow-dot">Tổng quan tuần này</span>
          <h2 id="fy-title" className="display">Dành cho bạn, {user.fullName.trim().split(' ').pop()}</h2>
        </div>
        <ul className="stat-row fy-stats">
          {tiles.map(([label, n, to]) => (
            <li key={to}><Link to={to} className="fy-stat"><span className="stat-num">{n}</span><span className="stat-label">{label}</span></Link></li>
          ))}
        </ul>
        <div className="fy-jobs">
          <h3 className="fy-h3">{busy.length ? 'Việc hợp lịch học của bạn' : 'Việc mới nhất'}</h3>
          {!data.jobs.length ? <p className="muted">Chưa có việc nào còn ca rảnh so với lịch học của bạn.</p> : (
            <ol className="sh-list">{data.jobs.map((j, i) => <ShiftRow key={j._id} job={j} category={catName[j.categoryId]} save={save(j)} i={i} />)}</ol>
          )}
          {!busy.length && <p className="fy-hint">Tô các buổi có tiết học để UniShift chỉ gợi ý việc không trùng giờ. <Link to="/jobs#lich-hoc" className="text-link">Tô lịch học<ArrowRight size={16} aria-hidden="true" /></Link></p>}
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
    // Trang chủ dùng giao diện sáng kiểu saucelabs.com (home.css), các trang khác giữ nền tối
    document.body.classList.add('page-home');
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
  componentWillUnmount() { this.savedFor = undefined; document.body.classList.remove('page-home'); }

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

          {/* Câu chuyện trang chủ tiếp nối lời hứa của hero, mỗi mục một bước:
              Tìm ca trống → Chọn chỗ gần → Biết trước lương → Nơi bạn sẽ làm → Nộp đơn yên tâm → Sau ca làm → Tuần sau (dải cuối).
              Hai phía và hỏi đáp nằm ngoài mạch, đặt sau như phụ lục */}
          {/* Tìm ca trống: tab theo buổi ứng với các hàng Sáng/Chiều/Tối trong lưới "Tuần của bạn" ở hero */}
          <section className="gn-sec sc-sec" aria-labelledby="gn-jobs">
            <div className="sc-top">
              <div>
                <h2 id="gn-jobs" className="sc-h2">Ca làm lấp vào giờ trống</h2>
                <p className="sc-lede">{total ? `${total} tin đang mở` : 'Tin mới nhất'} từ quán cà phê, trung tâm gia sư và cửa hàng gần trường. Chọn buổi bạn rảnh để xem ca khớp giờ.</p>
              </div>
              <div className="sc-tabs" role="tablist" aria-label="Buổi làm" onKeyDown={this.tabKey}>
                {TABS.map(([key, label]) => (
                  <button key={key} id={`gn-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls="gn-jobs-panel" tabIndex={tab === key ? 0 : -1}
                    className="sc-tab" onClick={() => this.loadTab(key)}>{label}</button>
                ))}
              </div>
            </div>
            <div id="gn-jobs-panel" role="tabpanel" aria-labelledby={`gn-tab-${tab}`} aria-busy={loading}>
              {!jobs ? (
                <ul className="sc-grid" aria-hidden="true">{[0, 1, 2].map((i) => <li key={i} className="sc sc-sk" />)}</ul>
              ) : !jobs.length ? (
                <div className="gn-empty">
                  <p>{tab !== 'all' ? 'Chưa có ca nào vào buổi này. Thử buổi khác nhé.' : 'Chưa có tin tuyển dụng nào đang mở.'}</p>
                  {tab === 'all' && user?.role !== 'STUDENT' && <Link to={postJob} className="text-link">Đăng tin tuyển dụng đầu tiên<ArrowRight size={16} aria-hidden="true" /></Link>}
                </div>
              ) : (
                <ol className={`sc-grid ${loading ? 'is-loading' : ''}`}>
                  {jobs.slice(0, HOME_JOBS).map((j) => <JobCard key={j._id} job={j} category={catName[j.categoryId]} save={save(j)} focus={TABS.find(([key]) => key === tab)[2]} />)}
                </ol>
              )}
            </div>
            <div className="sc-more">
              <Link to="/jobs" className="btn btn-ghost">Xem tất cả {total || ''} việc làm<ArrowRight size={18} aria-hidden="true" /></Link>
              <Link to="/jobs#lich-hoc" className="text-link"><CalendarDays size={18} aria-hidden="true" />Tô lịch học của bạn</Link>
            </div>
          </section>

          {/* Chọn chỗ gần: hàng cột chia vạch dọc, mỗi thành phố một số tin lớn và các quận lọc sẵn */}
          {areas.length > 0 && (
            <section className="gn-sec" aria-labelledby="gn-area">
              <div className="sec-head sec-head-left">
                <h2 id="gn-area" className="display">Gần trường, khỏi chạy xa</h2>
                <p className="lede">Học xong là đi làm được ngay. Chọn quận gần trường để không mất giờ đi lại giữa hai ca.</p>
              </div>
              <div className="ar-grid">
                {areas.map((l) => (
                  <div key={l.city} className="ar-city">
                    <h3 className="ar-name">{l.city}</h3>
                    <p className="ar-total"><strong>{l.total}</strong> việc đang mở</p>
                    {l.districts.length > 0 && (
                      <ul>{l.districts.map((d) => <li key={d}><Link to={`/jobs${qs({ city: l.city, district: d })}`}>{d}<span>{l.counts?.[d]}</span></Link></li>)}</ul>
                    )}
                    <Link to={`/jobs${qs({ city: l.city })}`} className="text-link">Xem việc tại {l.city}<ArrowRight size={16} aria-hidden="true" /></Link>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Biết trước lương (lời hứa "Lương ghi rõ trên từng tin" ở hero): dải nền trời nhạt, hàng số liệu chia vạch dọc, lương màu xanh lá */}
          {hiring.length > 0 && (
            <section className="gn-sec" aria-labelledby="gn-cats">
              <div className="band">
                <div className="sec-head">
                  <h2 id="gn-cats" className="display">Biết mình nhận bao nhiêu trước khi nộp</h2>
                  <p className="lede">Khoảng lương trung bình của các tin đang mở, ngành nhiều tin xếp trước.</p>
                </div>
                <ul className="gn-cats">
                  {hiring.map((c) => {
                    const [amount, unit] = salary(c.pay).split('/');
                    return (
                      <li key={c._id}>
                        <Link to={`/jobs?categoryId=${c._id}`} className="gn-cat">
                          <span className="gn-cat-name">{c.name}</span>
                          <span className="gn-cat-pay">{amount}<small>/{unit}</small></span>
                          <span className="gn-cat-count">{c.jobCount} việc đang tuyển</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          )}

          {/* Nơi bạn sẽ làm: nhà tuyển dụng đang có tin mở, dải logo chạy ngang tràn viền như dải khách hàng của Sauce.
              Danh sách lặp hai lần để vòng chạy nối liền; bản lặp ẩn với trình đọc màn hình và không nhận focus */}
          {employers.length > 0 && (
            <section className="gn-sec em-sec" aria-label="Nhà tuyển dụng đang tuyển sinh viên">
              <div className="em-marquee">
                <ul className="em-track" style={{ '--n': employers.length }}>
                  {[...employers, ...employers].map((e, i) => {
                    const copy = i >= employers.length;
                    return (
                      <li key={`${e._id}-${i}`} aria-hidden={copy || undefined}>
                        <Link to={`/employers/${e._id}`} className="em-item" tabIndex={copy ? -1 : undefined} title={`${e.name}, ${e.jobs} tin đang mở`}>
                          <span className="em-logo">{e.logoUrl ? <img src={e.logoUrl} alt="" width="56" height="56" /> : <Building2 size={22} aria-hidden="true" />}</span>
                          <span className="em-name">{e.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          )}

          {/* Nộp đơn yên tâm (hai cam kết dưới khung điện thoại ở hero): giữ giao diện cũ theo yêu cầu — dải nền xám xanh tràn viền,
              trái là tiêu đề + 4 cam kết, phải là bảng so sánh */}
          <section className="gn-sec gn-safe" aria-labelledby="gn-safe">
            <div className="gn-safe-grid">
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

          {/* Sau ca làm: điểm trung bình cỡ lớn bên trái, ba câu đánh giá bên phải, mỗi câu có vạch xanh lá phía trên */}
          {reviews.length > 0 && rating?.count >= MIN_REVIEWS && (
            <section className="gn-sec vo-sec" aria-labelledby="gn-voices">
              <div className="vo">
                <div>
                  <h2 id="gn-voices" className="u-h2">Sinh viên nói gì sau ca làm</h2>
                  <p className="vo-score">{rating1.format(rating.avg)}<span aria-hidden="true">/5</span></p>
                  <p className="vo-cap">Trung bình từ {rating.count} đánh giá của sinh viên đã làm xong việc</p>
                </div>
                <ul className="vo-quotes">
                  {reviews.map((r) => (
                    <li key={r._id}>
                      <figure className="vo-q">
                        <span role="img" aria-label={`${r.rating} trên 5 sao`}><Stars value={r.rating} /></span>
                        <blockquote>“{r.comment}”</blockquote>
                        <figcaption><strong>{r.reviewerId?.fullName || 'Sinh viên'}</strong>{r.jobId && <span>{r.jobId.title} tại {r.jobId.companySnapshot?.name}</span>}</figcaption>
                      </figure>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* Hai phía: mỗi bên một ô nền nhạt (sinh viên xám xanh, nhà tuyển dụng xanh dương nhạt), 3 bước nối bằng đường dọc, dòng chi phí và một nút */}
          <section className="gn-sec tw-sec" aria-labelledby="gn-who">
            <h2 id="gn-who" className="u-h2">Dành cho cả hai phía</h2>
            <p className="u-lede">Ba bước cho mỗi bên, từ lúc đăng ký đến khi xong việc và đánh giá nhau.</p>
            <div className="tw">
              {[
                ['Sinh viên', 'Tìm ca làm khớp lịch học, gần trường.', STUDENT_STEPS, 'Miễn phí hoàn toàn.',
                  <Link to={user?.role === 'STUDENT' ? '/student/profile' : '/register'} className="btn tw-btn">{user?.role === 'STUDENT' ? 'Hoàn thiện hồ sơ' : 'Tạo hồ sơ miễn phí'}</Link>],
                ['Nhà tuyển dụng', 'Tuyển sinh viên cho ca làm trong tuần.', EMPLOYER_STEPS,
                  tiers ? `${tiers.free.quota} tin miễn phí, mỗi tin hiển thị ${tiers.free.days} ngày.${plans.length ? ` Premium từ ${money(Math.min(...plans.map((p) => p.price)))} cho ${tiers.premium.quota} tin.` : ''}` : '',
                  <Link to={postJob} className="btn tw-btn tw-btn-line">Đăng tin tuyển dụng</Link>],
              ].map(([who, sub, steps, note, cta], k) => (
                <article key={who} className={`tw-side ${k ? 'tw-emp' : ''}`}>
                  <h3>{who}</h3>
                  <p className="tw-sub">{sub}</p>
                  <ol className="tw-steps">
                    {steps.map(([t, d], i) => <li key={t}><span className="tw-n" aria-hidden="true">{i + 1}</span><div><strong>{t}</strong><span>{d}</span></div></li>)}
                  </ol>
                  {note && <p className="tw-note">{note}</p>}
                  {cta}
                </article>
              ))}
            </div>
          </section>

          {/* FAQ: giữ giao diện cũ theo yêu cầu — tiêu đề trái, danh sách phải, dấu cộng xoay khi mở */}
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

        {/* Dải cuối trang: nền xanh UniShift, chữ trái, hành động phải (sinh viên/khách nhận email, nhà tuyển dụng đăng tin) */}
        <section className="bd" aria-labelledby="gn-end">
          <div className="container bd-inner">
            {user?.role === 'EMPLOYER' ? (
              <>
                <div className="bd-copy">
                  <h2 id="gn-end">Cần người cho ca làm tuần này?</h2>
                  <p>Đăng tin kèm ca làm trong tuần để sinh viên có lịch học phù hợp tìm thấy bạn.</p>
                </div>
                <Link to={postJob} className="btn bd-btn">Đăng tin tuyển dụng</Link>
              </>
            ) : (
              <>
                <div className="bd-copy">
                  <h2 id="gn-end">Nhận ca mới hợp lịch qua email</h2>
                  <p>{busyOf(user).length ? `Khi có tin còn ca rảnh so với lịch học bạn đã tô (bận ${describeShifts(busyOf(user))}), UniShift gửi email cho bạn.` : 'Có tin còn ca rảnh so với lịch học bạn đã tô, UniShift gửi email cho bạn.'} Hủy bất cứ lúc nào.</p>
                </div>
                {alertState === 'done' ? (
                  <p className="al-done" role="status"><Bell size={18} aria-hidden="true" />Đã đăng ký. Việc mới sẽ được gửi tới {alertEmail}.</p>
                ) : (
                  <form className="al-form" onSubmit={this.subscribe}>
                    <label className="sr-only" htmlFor="al-email">Email nhận thông báo</label>
                    <input id="al-email" type="email" required value={alertEmail} onChange={this.set('alertEmail')} placeholder="email@truong.edu.vn" aria-invalid={!!alertError} aria-describedby={alertError ? 'al-error' : undefined} />
                    <button className="btn bd-btn" disabled={alertState === 'busy'}>{alertState === 'busy' ? 'Đang gửi…' : 'Nhận thông báo'}</button>
                    {alertError && <p id="al-error" className="al-error">{alertError}</p>}
                  </form>
                )}
              </>
            )}
          </div>
        </section>
      </>
    );
  }
}

export default withRouter(HomePage);
