import React, { Component } from 'react';
import { CalendarDays, Check, ChevronDown, Info, LocateFixed, MapPin, Search, SlidersHorizontal, Tag, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Empty, ErrorState, Alert, Pagination, Dropdown, ShiftGrid, Tabs } from '../../components/ui';
import MapView from '../../components/MapView';
import { JobCard, loadSavedIds, saveToggler, readWeek, writeWeek } from '../../components/JobRow';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';
import { money, describeShifts, SALARY_TYPE } from '../../utils/format';
import { SCHOOLS, RADII, schoolByName, originOf, writeOrigin, pointOf, cityCenter } from '../../utils/geo';

const SALARY_TYPES = [['HOURLY', 'Theo giờ'], ['DAILY', 'Theo ngày'], ['PROJECT', 'Theo dự án']];
// school / near / radius: lọc theo khoảng cách (FR-SRC-05); view=map: xem kết quả trên bản đồ
const FILTERS = ['q', 'categoryId', 'city', 'district', 'salaryType', 'salaryMin', 'salaryMax', 'busy', 'school', 'near', 'radius', 'view', 'page'];
const radiusOf = (f) => Number(f.radius) || 5;
// Lỗi của navigator.geolocation theo mã (1 từ chối quyền, 2 không xác định được, 3 quá thời gian)
const GEO_ERRORS = { 1: 'Trình duyệt chưa được phép dùng vị trí. Hãy cho phép, hoặc chọn trường trong danh sách.', 2: 'Không xác định được vị trí của bạn. Hãy chọn trường trong danh sách.', 3: 'Lấy vị trí quá lâu. Thử lại hoặc chọn trường trong danh sách.' };
const NUM = new Intl.NumberFormat('vi-VN');
const smooth = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth');
const CAT_SHOWN = 6;
const slots = (csv) => (csv ? csv.split(',').map(Number) : []);
const sameSlots = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Nhóm lựa chọn một giá trị (ngành nghề, hình thức lương): hàng radio, có mục "Tất cả" đứng đầu
const Choices = ({ name, value, options, onPick, labelledBy }) => (
  <div className="jx-choices" role="radiogroup" aria-labelledby={labelledBy}>
    {[{ value: '', label: 'Tất cả' }, ...options].map((o) => (
      <label key={o.value || 'all'} className={`jx-choice ${value === o.value ? 'on' : ''}`}>
        <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onPick(o.value)} />
        <span className="jx-box" aria-hidden="true"><Check size={13} strokeWidth={3} /></span>
        <span className="jx-choice-label">{o.label}</span>
        {o.count !== undefined && <span className="jx-choice-count">{o.count}</span>}
      </label>
    ))}
  </div>
);

// Nhóm lọc gập được (P1-3): tiêu đề là nút, nội dung ẩn khi gập; chú thích dài nằm trong tooltip ⓘ
const Sec = ({ id, icon: Icon, title, open, onToggle, tip, extra, children }) => (
  <section id={id} className={`jx-sec ${open ? 'open' : ''}`}>
    <div className="jx-sec-head">
      <h2 className="jx-sec-title">
        <button type="button" className="jx-sec-btn" aria-expanded={open} aria-controls={`${id}-body`} onClick={onToggle}>
          {Icon && <Icon size={18} aria-hidden="true" />}<span>{title}</span><ChevronDown className="jx-sec-chev" size={18} aria-hidden="true" />
        </button>
      </h2>
      {tip && <span className="jx-tip" role="img" tabIndex={0} title={tip} aria-label={tip}><Info size={16} aria-hidden="true" /></span>}
      {extra}
    </div>
    <div id={`${id}-body`} className="jx-sec-body" hidden={!open}>{children}</div>
  </section>
);

// SCR-C04 / FR-SRC-01: hai cột, bộ lọc bên trái (dính khi cuộn), danh sách tin bên phải; bộ lọc nằm trên URL để chia sẻ và quay lại được
class JobsPage extends Component {
  static contextType = AuthContext;
  state = { categories: [], locations: [], jobs: null, meta: null, form: {}, week: [], loading: false, filtersOpen: false, savedIds: new Set(), error: null, facetError: '', weekBusy: false, weekError: '', payError: '', saveError: '', pins: null, sel: null, hot: null, locating: false, geoError: '', open: { 'lich-hoc': true }, catsAll: false, saveWeek: true, toast: '' };
  reqId = 0;

  params = () => Object.fromEntries(FILTERS.map((k) => [k, this.props.searchParams.get(k) || '']));

  componentDidMount() {
    // Lịch học trong cột lọc: lịch đang lọc, nếu chưa có thì lịch đã lưu (hồ sơ sinh viên, rồi trình duyệt)
    const cur = this.params().busy;
    const saved = this.context.user?.student?.busySlots;
    this.setState({ week: cur ? slots(cur) : saved?.length ? saved : readWeek() });
    // Các nút "Tô lịch học" ở trang chủ và trang chi tiết dẫn tới /jobs#lich-hoc: mở cột lọc và cuộn tới lưới
    // Tương tự với "Chọn trường để xem khoảng cách" → /jobs#gan-truong
    const { hash } = this.props.location;
    if (hash === '#lich-hoc' || hash === '#gan-truong') {
      this.setState((s) => ({ filtersOpen: true, open: { ...s.open, [hash.slice(1)]: true } }), () => document.getElementById(hash.slice(1))?.scrollIntoView({ block: 'start', behavior: smooth() }));
    }
    this.syncSaved();
    // Danh sách tin không phụ thuộc danh mục / địa điểm: tải song song, lỗi một bên không làm kẹt bên kia
    this.loadFacets();
    this.load();
  }

  componentWillUnmount() { this.reqId += 1; clearTimeout(this.toastTimer); }

  // Bấm ghim → chọn thẻ tương ứng và cuộn danh sách tới thẻ đó
  selectPin = (id) => this.setState({ sel: id }, () => document.getElementById(`jx-job-${id}`)?.scrollIntoView({ block: 'nearest', behavior: smooth() }));
  toggleSec = (id) => this.setState((s) => ({ open: { ...s.open, [id]: !s.open[id] } }));
  showToast = (toast) => { clearTimeout(this.toastTimer); this.setState({ toast }); this.toastTimer = setTimeout(() => this.setState({ toast: '' }), 3500); };

  loadFacets = async () => {
    try {
      const [c, l] = await Promise.all([api.get('/categories'), api.get('/jobs/locations')]);
      this.setState({ categories: c.data, locations: l.data, facetError: '' });
    } catch {
      this.setState({ facetError: 'Không tải được danh mục và địa điểm để lọc.' });
    }
  };

  componentDidUpdate(prev) {
    if (prev.location.search !== this.props.location.search) this.load();
    this.syncSaved();
  }

  // Tin đã lưu của sinh viên (FR-SAV-01); tải lại khi phiên đăng nhập khôi phục xong hoặc đổi tài khoản
  syncSaved = () => {
    const u = this.context.user;
    const key = u?.role === 'STUDENT' ? u._id : null;
    if (key === this.savedFor) return;
    this.savedFor = key;
    // Lỗi tải (unknown) thì giữ nguyên trạng thái đang có, không coi như chưa lưu tin nào
    if (key) loadSavedIds().then((savedIds) => { if (!savedIds.unknown) this.setState({ savedIds }); });
    else this.setState({ savedIds: new Set() });
  };

  toggleSave = saveToggler(this);

  load = async () => {
    const p = this.params();
    const id = ++this.reqId; // chỉ nhận phản hồi của lần gọi mới nhất
    // Giữ danh sách cũ (làm mờ) trong lúc tải để trang không giật
    this.setState({ loading: true, error: null, form: p });
    // Điểm xuất phát (trường / vị trí hiện tại) → near + radius cho API; nhớ lại để trang chi tiết việc ghi khoảng cách
    const origin = originOf(p);
    if (origin) writeOrigin(origin);
    const { school, view, near, radius, page, ...rest } = p;
    const query = { ...rest, minDays: p.busy ? 3 : undefined, near: origin ? `${origin.lat},${origin.lng}` : undefined, radius: origin ? radiusOf(p) : undefined };
    try {
      // Lọc theo lịch học: chỉ hiện việc có ca rảnh rơi vào ít nhất 3 ngày trong tuần
      const r = await api.get(view === 'map' ? `/jobs/map${qs(query)}` : `/jobs${qs({ ...query, page, limit: 12 })}`);
      if (id !== this.reqId) return;
      // pins lưu trong state để mảng giữ nguyên giữa các lần render (MapView chỉ căn lại khung nhìn khi mảng đổi)
      const pins = view === 'map' ? r.data.map((j) => ({ id: j._id, ...pointOf(j), title: j.title, featured: j.isFeatured })) : null;
      this.setState((s) => ({ jobs: r.data, meta: r.meta, loading: false, pins, sel: r.data.some((j) => j._id === s.sel) ? s.sel : null }));
    } catch (error) {
      if (id === this.reqId) this.setState({ error, loading: false });
    }
  };

  // Chọn trường / vị trí hiện tại làm điểm xuất phát; chọn cái này thì bỏ cái kia. Bỏ điểm xuất phát thì bỏ luôn bán kính
  setOrigin = (patch) => { this.setState({ geoError: '' }); this.apply({ school: '', near: '', ...patch, ...(!patch.school && !patch.near && { radius: '' }) }); };
  locate = () => {
    if (!navigator.geolocation) { this.setState({ geoError: 'Trình duyệt này không hỗ trợ lấy vị trí. Hãy chọn trường trong danh sách.' }); return; }
    this.setState({ locating: true, geoError: '' });
    navigator.geolocation.getCurrentPosition(
      ({ coords: { latitude: lat, longitude: lng } }) => {
        this.setState({ locating: false });
        if (lat < 8 || lat > 24 || lng < 102 || lng > 110) { this.setState({ geoError: 'Vị trí của bạn nằm ngoài Việt Nam. Hãy chọn trường trong danh sách.' }); return; }
        // Làm tròn 3 chữ số (~100 m): đủ để tính khoảng cách mà không đưa vị trí chính xác lên URL
        this.setOrigin({ near: `${lat.toFixed(3)},${lng.toFixed(3)}` });
      },
      (e) => this.setState({ locating: false, geoError: GEO_ERRORS[e.code] || GEO_ERRORS[2] }),
      { timeout: 10000, maximumAge: 300000 },
    );
  };

  apply = (patch) => {
    const next = { ...this.state.form, ...patch, page: patch.page || '' };
    if (patch.city !== undefined) next.district = '';
    this.props.setSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
    // Chỉ cuộn lên khi chuyển trang; đổi bộ lọc thì giữ nguyên chỗ đang xem
    if (patch.page) window.scrollTo({ top: 0, behavior: smooth() });
  };

  applyWeek = async () => {
    const { week } = this.state;
    writeWeek(week);
    this.apply({ busy: week.join(',') });
    if (this.context.user?.role !== 'STUDENT' || !this.state.saveWeek) return;
    // Sinh viên: lưu lịch vào hồ sơ; chỉ báo "đã lưu" khi API trả thành công
    this.setState({ weekBusy: true, weekError: '' });
    try {
      await api.put('/students/me/schedule', { busySlots: week });
      this.setState({ weekBusy: false });
      this.showToast('Đã lưu lịch học');
      this.context.reloadUser?.();
    } catch (e) {
      this.setState({ weekBusy: false, weekError: `Đã lọc theo lịch nhưng chưa lưu được vào hồ sơ: ${e.message}` });
    }
  };

  clearAll = () => { this.setState({ week: [], payError: '', geoError: '' }); this.props.setSearchParams(this.params().view ? { view: this.params().view } : {}); };

  clearWeek = () => { this.setState({ week: [] }); this.apply({ busy: '' }); };

  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value } });
  // Ô tiền: chỉ giữ chữ số (type=text nên con lăn chuột không đổi giá trị)
  setMoney = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value.replace(/\D/g, '') }, payError: '' });
  applyPay = (e) => {
    e.preventDefault();
    const { salaryMin, salaryMax } = this.state.form;
    if (salaryMin && salaryMax && Number(salaryMin) > Number(salaryMax)) { this.setState({ payError: '“Lương từ” không được lớn hơn “Lương đến”.' }); return; }
    this.setState({ payError: '' });
    this.apply({ salaryMin, salaryMax });
  };
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
      originOf(f) && ['origin', `Cách ${originOf(f).label} ≤ ${radiusOf(f)} km`],
    ].filter(Boolean);
  };

  render() {
    const { categories, locations, jobs, meta, form, week, loading, filtersOpen, savedIds, error, facetError, weekBusy, weekError, payError, saveError, pins, sel, hot, locating, geoError, open, catsAll, saveWeek, toast } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const districts = locations.find((l) => l.city === form.city)?.districts || [];
    const chips = this.activeChips(catName);
    // Ngành nghề: nhiều tin nhất trước; gập còn CAT_SHOWN mục nhưng luôn giữ ngành đang chọn
    const catOptions = categories.map((c) => ({ value: c._id, label: c.name, count: c.jobCount })).sort((a, b) => (b.count || 0) - (a.count || 0) || a.label.localeCompare(b.label, 'vi'));
    const catShown = catsAll ? catOptions : catOptions.filter((c, i) => i < CAT_SHOWN || c.value === form.categoryId);
    const user = this.context.user;
    const weekDirty = !sameSlots(week, slots(form.busy));
    const origin = originOf(form);
    const radius = radiusOf(form);
    const isMap = form.view === 'map';
    // Trường ghi trong hồ sơ sinh viên (nếu có trong danh sách) đứng đầu để chọn nhanh
    const mine = schoolByName(user?.student?.school);
    const schools = [...(mine ? [{ value: mine.id, label: `${mine.name} · trường của bạn` }] : []), ...SCHOOLS.filter((x) => x !== mine).map((x) => ({ value: x.id, label: x.name }))];
    const card = (j) => (
      <JobCard job={j} category={catName[j.categoryId]} saved={savedIds.has(j._id)}
        onSave={user?.role === 'STUDENT' ? this.toggleSave : undefined}
        // Khách bấm tim: đăng nhập xong quay lại tin và tự lưu (?save=1, xử lý ở trang chi tiết)
        saveHref={user ? undefined : `/login?next=${encodeURIComponent(`/jobs/${j._id}?save=1`)}`} />
    );
    const weekWhy = !week.length ? 'Tô ít nhất một buổi có tiết học để lọc.' : !weekDirty ? 'Lịch này đang được áp dụng.' : '';
    return (
      <>
        <section className="jx-band">
          <div className="container">
            <h1 className="display jx-title">Tìm việc part-time hợp lịch học</h1>
            <p className="jx-sub">Lương và ca làm ghi rõ trên từng tin. Tô lịch học để chỉ thấy việc không trùng giờ.</p>
            <form className="hx-search jx-search" onSubmit={(e) => { e.preventDefault(); this.apply({ q: form.q }); }} role="search">
              <label className="hx-field hx-q">
                <Search size={18} aria-hidden="true" />
                <input type="search" name="q" autoComplete="off" enterKeyHint="search" value={form.q || ''} onChange={this.set('q')}
                  placeholder="Vị trí hoặc kỹ năng: phục vụ, gia sư, Canva…" aria-label="Từ khóa việc làm" />
              </label>
              <Dropdown className="hx-field" value={form.city || ''} onChange={this.pick('city')} ariaLabel="Thành phố" placeholder="Tất cả địa điểm"
                options={locations.map((l) => ({ value: l.city, label: l.city, icon: MapPin }))} />
              <button className="btn btn-lg">Tìm việc</button>
            </form>
          </div>
        </section>

        <div className="container page jx-page">
          <div className="jx-layout">
            {/* Cột trái: bộ lọc. Điện thoại: ẩn sau nút "Bộ lọc" */}
            <button type="button" className="btn btn-ghost jx-filter-toggle" aria-expanded={filtersOpen} aria-controls="jx-side"
              onClick={() => this.setState({ filtersOpen: !filtersOpen })}>
              <SlidersHorizontal size={18} aria-hidden="true" />Bộ lọc{chips.length > 0 ? ` (${chips.length})` : ''}
            </button>
            <aside id="jx-side" className={`jx-side ${filtersOpen ? 'open' : ''}`} aria-label="Bộ lọc">
              <Sec id="lich-hoc" icon={CalendarDays} title="Lịch học" open={!!open['lich-hoc']} onToggle={() => this.toggleSec('lich-hoc')}
                tip="Tô các buổi có tiết học. Chỉ hiện việc có ca rảnh ít nhất 3 ngày trong tuần.">
                {facetError && <Alert>{facetError} <button type="button" className="btn-link" onClick={this.loadFacets}>Thử lại</button></Alert>}
                <p className="jx-sec-note">{form.busy ? `Đang lọc: bận ${describeShifts(slots(form.busy))}` : 'Chỉ hiện việc có ≥3 ngày rảnh/tuần.'}</p>
                <ShiftGrid tone="busy" value={week} onChange={(v) => this.setState({ week: v })} label="Lịch học trong tuần" />
                <p className="jx-legend"><span className="jx-legend-dot" aria-hidden="true" />Ô đậm = bận học</p>
                <div className="jx-sec-actions">
                  <button type="button" className="btn btn-sm" onClick={this.applyWeek} disabled={!week.length || !weekDirty || weekBusy} aria-describedby={weekWhy ? 'jx-week-why' : undefined}>{weekBusy ? 'Đang lưu…' : 'Lọc theo lịch'}</button>
                  {(week.length > 0 || form.busy) && <button type="button" className="btn btn-sm btn-ghost" onClick={this.clearWeek}>Xóa lịch</button>}
                </div>
                {user?.role === 'STUDENT' && (
                  <label className="jx-switch"><input type="checkbox" checked={saveWeek} onChange={(e) => this.setState({ saveWeek: e.target.checked })} />Lưu lịch vào hồ sơ</label>
                )}
                {weekWhy && <p className="jx-sec-hint" id="jx-week-why">{weekWhy}</p>}
                {user?.role !== 'STUDENT' && <p className="jx-sec-hint">Lịch lưu trên trình duyệt này.</p>}
                <Alert>{weekError}</Alert>
              </Sec>

              <Sec id="gan-truong" icon={MapPin} title="Gần trường" open={!!open['gan-truong']} onToggle={() => this.toggleSec('gan-truong')}
                tip="Khoảng cách đo theo đường chim bay, chỉ tính được với tin đã ghim vị trí. Vị trí của bạn không được lưu lại.">
                <p className="jx-sec-note">{origin ? `Đang lọc: cách ${origin.label} tối đa ${radius} km.` : 'Chọn trường hoặc dùng vị trí của bạn.'}</p>
                <Dropdown className="select" searchable value={form.school || ''} onChange={(e) => this.setOrigin({ school: e.target.value })} ariaLabel="Trường của bạn" placeholder={form.near ? 'Đang dùng vị trí hiện tại' : 'Chọn trường'} options={schools} />
                <div className="jx-sec-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={this.locate} disabled={locating}><LocateFixed size={18} aria-hidden="true" />{locating ? 'Đang lấy vị trí…' : 'Vị trí hiện tại'}</button>
                  {origin && <button type="button" className="btn btn-sm btn-ghost" onClick={() => this.setOrigin({})}>Bỏ lọc</button>}
                </div>
                {origin && <div className="jx-radius"><Tabs label="Bán kính" value={String(radius)} onChange={(v) => this.apply({ radius: v })} items={RADII.map((km) => [String(km), `${km} km`])} /></div>}
                <Alert>{geoError}</Alert>
              </Sec>

              <Sec id="nganh-nghe" icon={Tag} title="Ngành nghề" open={open['nganh-nghe'] !== false} onToggle={() => this.setState((s2) => ({ open: { ...s2.open, 'nganh-nghe': s2.open['nganh-nghe'] === false } }))}>
                <Choices name="categoryId" labelledBy="nganh-nghe" value={form.categoryId || ''} onPick={(v) => this.apply({ categoryId: v })} options={catShown} />
                {catOptions.length > CAT_SHOWN && (
                  <button type="button" className="btn-link jx-more" aria-expanded={catsAll} onClick={() => this.setState({ catsAll: !catsAll })}>{catsAll ? 'Thu gọn' : `Xem thêm ${catOptions.length - CAT_SHOWN} ngành`}</button>
                )}
              </Sec>

              {districts.length > 0 && (
                <section className="jx-sec">
                  <h2 className="jx-sec-title">Quận / huyện</h2>
                  <Dropdown className="select" value={form.district || ''} onChange={this.pick('district')} ariaLabel="Quận / huyện" placeholder="Mọi quận / huyện"
                    options={districts.map((d) => ({ value: d, label: d }))} />
                </section>
              )}

              <section className="jx-sec">
                <h2 className="jx-sec-title" id="jx-type-title">Hình thức lương</h2>
                <Choices name="salaryType" labelledBy="jx-type-title" value={form.salaryType || ''} onPick={(v) => this.apply({ salaryType: v })}
                  options={SALARY_TYPES.map(([value, label]) => ({ value, label }))} />
              </section>

              <section className="jx-sec">
                <h2 className="jx-sec-title">Mức lương</h2>
                <form className="jx-pay" onSubmit={this.applyPay}>
                  <label><span>Lương từ</span><input className="input" type="text" name="salaryMin" inputMode="numeric" autoComplete="off" placeholder="20000" value={form.salaryMin || ''} onChange={this.setMoney('salaryMin')} aria-invalid={payError ? true : undefined} aria-describedby={payError ? 'jx-pay-err' : undefined} /></label>
                  <label><span>Lương đến</span><input className="input" type="text" name="salaryMax" inputMode="numeric" autoComplete="off" placeholder="50000" value={form.salaryMax || ''} onChange={this.setMoney('salaryMax')} aria-invalid={payError ? true : undefined} aria-describedby={payError ? 'jx-pay-err' : undefined} /></label>
                  {payError && <p className="jx-pay-err" id="jx-pay-err" role="alert">{payError}</p>}
                  <p className="jx-sec-hint">Đồng, tính theo {form.salaryType ? `mỗi ${SALARY_TYPE[form.salaryType]}` : 'giờ, ngày hoặc dự án của tin'}.</p>
                  <button className="btn btn-sm btn-ghost">Áp dụng</button>
                </form>
              </section>
            </aside>

            {/* Cột phải: số kết quả, chip bộ lọc đang bật, danh sách tin */}
            <div className="jx-main">
            <div className="jx-summary-head">
              <h2 className="jx-h2">{form.busy ? (origin ? 'Việc hợp lịch học, gần bạn' : 'Việc hợp lịch học của bạn') : origin ? 'Việc gần bạn' : 'Việc làm gợi ý'}</h2>
              <span className="jx-count" aria-live="polite">{meta ? `${NUM.format(meta.total)} việc` : error ? '' : 'Đang tìm…'}</span>
              <div className="jx-view"><Tabs label="Cách xem kết quả" value={form.view || ''} onChange={(view) => this.apply({ view })} items={[['', 'Danh sách'], ['map', 'Bản đồ']]} /></div>
            </div>
              {chips.length > 0 && (
                <div className="jx-summary">
                  <ul className="jx-chips" aria-label="Bộ lọc đang bật">
                    {chips.map(([k, label]) => (
                      <li key={k}><button type="button" onClick={() => (k === 'origin' ? this.setOrigin({}) : this.apply({ [k]: '' }))} aria-label={`Bỏ lọc ${label}`}>{label}<X size={14} aria-hidden="true" /></button></li>
                    ))}
                    <li><button type="button" className="jx-clear" onClick={this.clearAll}>Xóa tất cả</button></li>
                  </ul>
                </div>
              )}
              <Alert>{saveError}</Alert>

              {error ? <div className="panel"><ErrorState error={error} onRetry={this.load} title="Không tải được danh sách việc" /></div>
                : !jobs ? (
                  <div className="jx-skel" role="status" aria-busy="true">
                    <span className="sr-only">Đang tải danh sách việc…</span>
                    {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="sk sk-card" aria-hidden="true" />)}
                  </div>
                ) : isMap && pins ? (
                  <div className={`jx-mapview ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                    <div className="jx-map-pane">
                      <MapView className="mp-lg" label="Bản đồ việc làm" markers={pins} selectedId={hot || sel} onSelect={this.selectPin}
                        origin={origin} radiusKm={origin ? radius : undefined} center={cityCenter(form.city)} zoom={12} />
                      <p className="jx-map-note" aria-live="polite">
                        {pins.length ? `${NUM.format(pins.length)} việc có ghim${meta.total > pins.length ? ` (hiện ${pins.length} tin đầu trong ${NUM.format(meta.total)})` : ''}.` : origin ? `Không có việc nào đã ghim vị trí trong bán kính ${radius} km.` : 'Chưa có việc nào ghim vị trí khớp bộ lọc.'}
                        {meta.noLocation > 0 && ` ${NUM.format(meta.noLocation)} tin khác chưa ghim vị trí nên không hiện ở đây.`}{' '}
                        {meta.noLocation > 0 && <button type="button" className="btn-link" onClick={() => this.apply({ view: '', school: '', near: '', radius: '' })}>Xem tất cả dạng danh sách</button>}
                      </p>
                    </div>
                    <ol className="jx-map-list" aria-label="Việc có ghim trên bản đồ">
                      {jobs.map((j) => (
                        <li key={j._id} id={`jx-job-${j._id}`} className={`jx-map-item ${j._id === sel ? 'on' : ''}`}
                          onMouseEnter={() => this.setState({ hot: j._id })} onMouseLeave={() => this.setState({ hot: null })}>{card(j)}</li>
                      ))}
                    </ol>
                  </div>
                ) : !jobs.length ? (
                  <div className="panel">
                    <Empty title={origin ? `Không có việc trong bán kính ${radius} km` : 'Không có việc phù hợp'}>
                      {origin ? 'Thử nới bán kính, hoặc bỏ lọc khoảng cách để xem cả tin chưa ghim vị trí.' : 'Thử bỏ bớt bộ lọc, hoặc dùng từ khóa ngắn hơn như “phục vụ”.'}
                      {origin && radius < 10 && <div><button type="button" className="btn btn-sm jx-empty-action" onClick={() => this.apply({ radius: '10' })}>Nới lên 10 km</button></div>}
                      {chips.length > 0 && <div><button type="button" className="btn btn-ghost btn-sm jx-empty-action" onClick={this.clearAll}>Xóa bộ lọc</button></div>}
                    </Empty>
                  </div>
                ) : (
                  <ol className={`jx-grid ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                    {jobs.map((j) => <li key={j._id}>{card(j)}</li>)}
                  </ol>
                )}
              {!isMap && origin && meta?.noLocation > 0 && !error && (
                <p className="jx-map-note">{NUM.format(meta.noLocation)} tin khớp các bộ lọc khác nhưng chưa ghim vị trí nên không tính được khoảng cách. <button type="button" className="btn-link" onClick={() => this.setOrigin({})}>Bỏ lọc khoảng cách để xem</button></p>
              )}
              {!isMap && <Pagination meta={meta} onPage={(page) => this.apply({ page: String(page) })} />}

              {!user && (
                <div className="jx-cta">
                  <div><h2>Chưa thấy việc hợp ý?</h2><p>Tạo hồ sơ và tải CV một lần, có việc mới là ứng tuyển ngay.</p></div>
                  <Link to="/register" className="btn btn-dark">Tạo hồ sơ miễn phí</Link>
                </div>
              )}
            </div>
          </div>
        </div>
        {toast && <div className="jx-toast" role="status">{toast}</div>}
      </>
    );
  }
}

export default withRouter(JobsPage);
