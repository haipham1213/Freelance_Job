import React, { Component } from 'react';
import { CalendarDays, Check, MapPin, Search, SlidersHorizontal, Sparkle, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Empty, ErrorState, Alert, Pagination, Dropdown, ShiftGrid } from '../../components/ui';
import { JobCard, loadSavedIds, saveToggler, readWeek, writeWeek } from '../../components/JobRow';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';
import { money, describeShifts, SALARY_TYPE } from '../../utils/format';

const SALARY_TYPES = [['HOURLY', 'Theo giờ'], ['DAILY', 'Theo ngày'], ['PROJECT', 'Theo dự án']];
const FILTERS = ['q', 'categoryId', 'city', 'district', 'salaryType', 'salaryMin', 'salaryMax', 'busy', 'page'];
const NUM = new Intl.NumberFormat('vi-VN');
const smooth = () => (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 'auto' : 'smooth');
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

// SCR-C04 / FR-SRC-01: hai cột, bộ lọc bên trái (dính khi cuộn), danh sách tin bên phải; bộ lọc nằm trên URL để chia sẻ và quay lại được
class JobsPage extends Component {
  static contextType = AuthContext;
  state = { categories: [], locations: [], jobs: null, meta: null, form: {}, week: [], loading: false, filtersOpen: false, savedIds: new Set(), error: null, facetError: '', weekBusy: false, weekMsg: '', weekError: '', payError: '', saveError: '' };
  reqId = 0;

  params = () => Object.fromEntries(FILTERS.map((k) => [k, this.props.searchParams.get(k) || '']));

  componentDidMount() {
    // Lịch học trong cột lọc: lịch đang lọc, nếu chưa có thì lịch đã lưu (hồ sơ sinh viên, rồi trình duyệt)
    const cur = this.params().busy;
    const saved = this.context.user?.student?.busySlots;
    this.setState({ week: cur ? slots(cur) : saved?.length ? saved : readWeek() });
    // Các nút "Tô lịch học" ở trang chủ và trang chi tiết dẫn tới /jobs#lich-hoc: mở cột lọc và cuộn tới lưới
    if (this.props.location.hash === '#lich-hoc') {
      this.setState({ filtersOpen: true }, () => document.getElementById('lich-hoc')?.scrollIntoView({ block: 'start', behavior: smooth() }));
    }
    this.syncSaved();
    // Danh sách tin không phụ thuộc danh mục / địa điểm: tải song song, lỗi một bên không làm kẹt bên kia
    this.loadFacets();
    this.load();
  }

  componentWillUnmount() { this.reqId += 1; }

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
    try {
      // Lọc theo lịch học: chỉ hiện việc có ca rảnh rơi vào ít nhất 3 ngày trong tuần
      const r = await api.get(`/jobs${qs({ ...p, limit: 12, minDays: p.busy ? 3 : undefined })}`);
      if (id === this.reqId) this.setState({ jobs: r.data, meta: r.meta, loading: false });
    } catch (error) {
      if (id === this.reqId) this.setState({ error, loading: false });
    }
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
    if (this.context.user?.role !== 'STUDENT') return;
    // Sinh viên: lưu lịch vào hồ sơ; chỉ báo "đã lưu" khi API trả thành công
    this.setState({ weekBusy: true, weekMsg: '', weekError: '' });
    try {
      await api.put('/students/me/schedule', { busySlots: week });
      this.setState({ weekBusy: false, weekMsg: 'Đã lưu lịch học vào hồ sơ của bạn.' });
      this.context.reloadUser?.();
    } catch (e) {
      this.setState({ weekBusy: false, weekError: `Đã lọc theo lịch nhưng chưa lưu được vào hồ sơ: ${e.message}` });
    }
  };

  clearAll = () => { this.setState({ week: [], payError: '' }); this.props.setSearchParams({}); };

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
    ].filter(Boolean);
  };

  render() {
    const { categories, locations, jobs, meta, form, week, loading, filtersOpen, savedIds, error, facetError, weekBusy, weekMsg, weekError, payError, saveError } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const districts = locations.find((l) => l.city === form.city)?.districts || [];
    const chips = this.activeChips(catName);
    const user = this.context.user;
    const weekDirty = !sameSlots(week, slots(form.busy));
    const weekWhy = !week.length ? 'Tô ít nhất một buổi có tiết học để lọc.' : !weekDirty ? 'Lịch này đang được áp dụng.' : '';
    return (
      <>
        <section className="jx-band">
          <div className="container">
            <h1 className="display jx-title">Tìm việc part-time hợp lịch học<Sparkle className="jx-spark" size={40} fill="currentColor" aria-hidden="true" /></h1>
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
          <div className="jx-summary-head">
            <h2 className="jx-h2">{form.busy ? 'Việc hợp lịch học của bạn' : 'Việc làm gợi ý'}</h2>
            <span className="jx-count" aria-live="polite">{meta ? `${NUM.format(meta.total)} việc` : error ? '' : 'Đang tìm…'}</span>
          </div>
          <div className="jx-layout">
            {/* Cột trái: bộ lọc. Điện thoại: ẩn sau nút "Bộ lọc" */}
            <button type="button" className="btn btn-ghost jx-filter-toggle" aria-expanded={filtersOpen} aria-controls="jx-side"
              onClick={() => this.setState({ filtersOpen: !filtersOpen })}>
              <SlidersHorizontal size={18} aria-hidden="true" />Bộ lọc{chips.length > 0 ? ` (${chips.length})` : ''}
            </button>
            <aside id="jx-side" className={`jx-side ${filtersOpen ? 'open' : ''}`} aria-label="Bộ lọc">
              <section id="lich-hoc" className="jx-sec">
                <div className="jx-sec-head">
                  <h2 className="jx-sec-title"><CalendarDays size={18} aria-hidden="true" />Lịch học</h2>
                  {chips.length > 0 && <button type="button" className="jx-clear-all" onClick={this.clearAll}>Xóa tất cả bộ lọc</button>}
                </div>
                {facetError && <Alert>{facetError} <button type="button" className="btn-link" onClick={this.loadFacets}>Thử lại</button></Alert>}
                <p className="jx-sec-note">{form.busy ? `Đang lọc: bận ${describeShifts(slots(form.busy))}` : 'Tô các buổi có tiết học, chỉ hiện việc có ca rảnh ít nhất 3 ngày trong tuần.'}</p>
                <ShiftGrid tone="busy" value={week} onChange={(v) => this.setState({ week: v })} label="Lịch học trong tuần" />
                <div className="jx-sec-actions">
                  <button type="button" className="btn btn-sm" onClick={this.applyWeek} disabled={!week.length || !weekDirty || weekBusy} aria-describedby={weekWhy ? 'jx-week-why' : undefined}>{weekBusy ? 'Đang lưu…' : 'Lọc theo lịch'}</button>
                  {(week.length > 0 || form.busy) && <button type="button" className="btn-link" onClick={this.clearWeek}>Xóa lịch</button>}
                </div>
                {weekWhy && <p className="jx-sec-hint" id="jx-week-why">{weekWhy}</p>}
                <p className="jx-sec-hint">{user?.role === 'STUDENT' ? 'Khi bấm “Lọc theo lịch”, lịch được lưu vào hồ sơ của bạn.' : 'Lịch lưu trên trình duyệt này.'}</p>
                <Alert type="ok">{weekMsg}</Alert>
                <Alert>{weekError}</Alert>
              </section>

              <section className="jx-sec">
                <h2 className="jx-sec-title" id="jx-cat-title">Ngành nghề</h2>
                <Choices name="categoryId" labelledBy="jx-cat-title" value={form.categoryId || ''} onPick={(v) => this.apply({ categoryId: v })}
                  options={categories.map((c) => ({ value: c._id, label: c.name, count: c.jobCount }))} />
              </section>

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
              {chips.length > 0 && (
                <div className="jx-summary">
                  <ul className="jx-chips" aria-label="Bộ lọc đang bật">
                    {chips.map(([k, label]) => (
                      <li key={k}><button type="button" onClick={() => this.apply({ [k]: '' })} aria-label={`Bỏ lọc ${label}`}>{label}<X size={14} aria-hidden="true" /></button></li>
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
                ) : !jobs.length ? (
                  <div className="panel">
                    <Empty title="Không có việc phù hợp">
                      Thử bỏ bớt bộ lọc, hoặc dùng từ khóa ngắn hơn như “phục vụ”.
                      {chips.length > 0 && <div><button type="button" className="btn btn-ghost btn-sm jx-empty-action" onClick={this.clearAll}>Xóa bộ lọc</button></div>}
                    </Empty>
                  </div>
                ) : (
                  <ol className={`jx-grid ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                    {jobs.map((j) => (
                      <li key={j._id}>
                        <JobCard job={j} category={catName[j.categoryId]} saved={savedIds.has(j._id)}
                          onSave={user?.role === 'STUDENT' ? this.toggleSave : undefined}
                          // Khách bấm tim: đăng nhập xong quay lại tin và tự lưu (?save=1, xử lý ở trang chi tiết)
                          saveHref={user ? undefined : `/login?next=${encodeURIComponent(`/jobs/${j._id}?save=1`)}`} />
                      </li>
                    ))}
                  </ol>
                )}
              <Pagination meta={meta} onPage={(page) => this.apply({ page: String(page) })} />

              {!user && (
                <div className="jx-cta">
                  <div><h2>Chưa thấy việc hợp ý?</h2><p>Tạo hồ sơ và tải CV một lần, có việc mới là ứng tuyển ngay.</p></div>
                  <Link to="/register" className="btn btn-dark">Tạo hồ sơ miễn phí</Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }
}

export default withRouter(JobsPage);
