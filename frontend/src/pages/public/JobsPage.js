import React, { Component } from 'react';
import { CalendarDays, MapPin, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, Pagination, Dropdown, ShiftGrid } from '../../components/ui';
import JobRow, { readWeek, writeWeek } from '../../components/JobRow';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';
import { money, describeShifts, SALARY_TYPE } from '../../utils/format';

const SALARY_TYPES = [['HOURLY', 'Theo giờ'], ['DAILY', 'Theo ngày'], ['PROJECT', 'Theo dự án']];
const FILTERS = ['q', 'categoryId', 'city', 'district', 'salaryType', 'salaryMin', 'salaryMax', 'busy', 'page'];
const slots = (csv) => (csv ? csv.split(',').map(Number) : []);
const sameSlots = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// Nhóm lựa chọn một giá trị (ngành nghề, hình thức lương): hàng radio, có mục "Tất cả" đứng đầu
const Choices = ({ name, value, options, onPick }) => (
  <div className="jx-choices" role="radiogroup">
    {[{ value: '', label: 'Tất cả' }, ...options].map((o) => (
      <label key={o.value || 'all'} className={`jx-choice ${value === o.value ? 'on' : ''}`}>
        <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onPick(o.value)} />
        <span className="jx-choice-label">{o.label}</span>
        {o.count !== undefined && <span className="jx-choice-count">{o.count}</span>}
      </label>
    ))}
  </div>
);

// SCR-C04 / FR-SRC-01: hai cột, bộ lọc bên trái (dính khi cuộn), danh sách tin bên phải; bộ lọc nằm trên URL để chia sẻ và quay lại được
class JobsPage extends Component {
  static contextType = AuthContext;
  state = { categories: [], locations: [], jobs: null, meta: null, form: {}, week: [], loading: false, filtersOpen: false };

  params = () => Object.fromEntries(FILTERS.map((k) => [k, this.props.searchParams.get(k) || '']));

  async componentDidMount() {
    // Lịch học trong cột lọc: lịch đang lọc, nếu chưa có thì lịch đã lưu (hồ sơ sinh viên, rồi trình duyệt)
    const cur = this.params().busy;
    const saved = this.context.user?.student?.busySlots;
    this.setState({ week: cur ? slots(cur) : saved?.length ? saved : readWeek() });
    // Các nút "Tô lịch học" ở trang chủ và trang chi tiết dẫn tới /jobs#lich-hoc: mở cột lọc và cuộn tới lưới
    if (this.props.location.hash === '#lich-hoc') {
      this.setState({ filtersOpen: true }, () => document.getElementById('lich-hoc')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
    }
    const [c, l] = await Promise.all([api.get('/categories'), api.get('/jobs/locations')]);
    this.setState({ categories: c.data, locations: l.data });
    this.load();
  }

  componentDidUpdate(prev) {
    if (prev.location.search !== this.props.location.search) this.load();
  }

  load = async () => {
    const p = this.params();
    // Giữ danh sách cũ (làm mờ) trong lúc tải để trang không giật
    this.setState({ loading: true, form: p });
    const r = await api.get(`/jobs${qs({ ...p, limit: 12 })}`);
    this.setState({ jobs: r.data, meta: r.meta, loading: false });
  };

  apply = (patch) => {
    const next = { ...this.state.form, ...patch, page: patch.page || '' };
    if (patch.city !== undefined) next.district = '';
    this.props.setSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
    // Chỉ cuộn lên khi chuyển trang; đổi bộ lọc thì giữ nguyên chỗ đang xem
    if (patch.page) window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  applyWeek = async () => {
    const { week } = this.state;
    writeWeek(week);
    this.apply({ busy: week.join(',') });
    if (this.context.user?.role === 'STUDENT') {
      await api.put('/students/me/schedule', { busySlots: week }).catch(() => {});
      this.context.reloadUser?.();
    }
  };

  clearWeek = () => { this.setState({ week: [] }); this.apply({ busy: '' }); };

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
    const { categories, locations, jobs, meta, form, week, loading, filtersOpen } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const districts = locations.find((l) => l.city === form.city)?.districts || [];
    const chips = this.activeChips(catName);
    const user = this.context.user;
    const weekDirty = !sameSlots(week, slots(form.busy));
    return (
      <>
        <section className="jx-band">
          <div className="container">
            <h1 className="display jx-title">Tìm việc part-time</h1>
            <p className="jx-sub">Lương và ca làm ghi rõ trên từng tin. Tô lịch học để chỉ thấy việc không trùng giờ.</p>
            <form className="hx-search jx-search" onSubmit={(e) => { e.preventDefault(); this.apply({ q: form.q }); }} role="search">
              <label className="hx-field hx-q">
                <Search size={18} aria-hidden="true" />
                <input type="search" name="q" autoComplete="off" enterKeyHint="search" value={form.q || ''} onChange={this.set('q')}
                  placeholder="Vị trí hoặc kỹ năng: phục vụ, gia sư, Canva…" aria-label="Từ khóa" />
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
              <SlidersHorizontal size={18} aria-hidden="true" />Bộ lọc{chips.length > 0 && ` (${chips.length})`}
            </button>
            <aside id="jx-side" className={`jx-side ${filtersOpen ? 'open' : ''}`} aria-label="Bộ lọc">
              <section id="lich-hoc" className="jx-sec">
                <h2 className="jx-sec-title"><CalendarDays size={18} aria-hidden="true" />Lịch học</h2>
                <p className="jx-sec-note">{form.busy ? `Đang lọc: bận ${describeShifts(slots(form.busy))}` : 'Tô các buổi có tiết học, chỉ hiện việc còn ca rảnh.'}</p>
                <ShiftGrid tone="busy" value={week} onChange={(v) => this.setState({ week: v })} label="Lịch học trong tuần" />
                <div className="jx-sec-actions">
                  <button type="button" className="btn btn-sm" onClick={this.applyWeek} disabled={!week.length || !weekDirty}>Lọc theo lịch</button>
                  {(week.length > 0 || form.busy) && <button type="button" className="btn-link" onClick={this.clearWeek}>Xóa lịch</button>}
                </div>
                <p className="jx-sec-hint">{user?.role === 'STUDENT' ? 'Lịch được lưu vào hồ sơ của bạn.' : 'Lịch lưu trên trình duyệt này.'}</p>
              </section>

              <section className="jx-sec">
                <h2 className="jx-sec-title">Ngành nghề</h2>
                <Choices name="categoryId" value={form.categoryId || ''} onPick={(v) => this.apply({ categoryId: v })}
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
                <h2 className="jx-sec-title">Hình thức lương</h2>
                <Choices name="salaryType" value={form.salaryType || ''} onPick={(v) => this.apply({ salaryType: v })}
                  options={SALARY_TYPES.map(([value, label]) => ({ value, label }))} />
              </section>

              <section className="jx-sec">
                <h2 className="jx-sec-title">Mức lương</h2>
                <form className="jx-pay" onSubmit={(e) => { e.preventDefault(); this.apply({ salaryMin: form.salaryMin, salaryMax: form.salaryMax }); }}>
                  <label><span>Từ</span><input className="input" type="number" name="salaryMin" inputMode="numeric" min="0" step="1000" placeholder="20.000" value={form.salaryMin || ''} onChange={this.set('salaryMin')} /></label>
                  <label><span>Đến</span><input className="input" type="number" name="salaryMax" inputMode="numeric" min="0" step="1000" placeholder="50.000" value={form.salaryMax || ''} onChange={this.set('salaryMax')} /></label>
                  <p className="jx-sec-hint">Đồng, tính theo {form.salaryType ? `mỗi ${SALARY_TYPE[form.salaryType]}` : 'giờ, ngày hoặc dự án của tin'}.</p>
                  <button className="btn btn-sm btn-ghost">Áp dụng</button>
                </form>
              </section>
            </aside>

            {/* Cột phải: số kết quả, chip bộ lọc đang bật, danh sách tin */}
            <div className="jx-main">
              <div className="jx-summary">
                <h2 className="h-lg" aria-live="polite">{meta ? `${meta.total} việc ${form.busy ? 'hợp lịch học của bạn' : 'phù hợp'}` : 'Đang tìm…'}</h2>
                {chips.length > 0 && (
                  <ul className="jx-chips" aria-label="Bộ lọc đang bật">
                    {chips.map(([k, label]) => (
                      <li key={k}><button type="button" onClick={() => this.apply({ [k]: '' })} aria-label={`Bỏ lọc ${label}`}>{label}<X size={14} aria-hidden="true" /></button></li>
                    ))}
                    <li><button type="button" className="jx-clear" onClick={() => { this.setState({ week: [] }); this.props.setSearchParams({}); }}>Xóa tất cả</button></li>
                  </ul>
                )}
              </div>

              {!jobs ? <Spinner /> : !jobs.length ? (
                <div className="panel"><Empty title="Không có việc phù hợp">Bỏ bớt một bộ lọc bên trái, hoặc thử từ khóa ngắn hơn như “phục vụ”.</Empty></div>
              ) : (
                <ol className={`jx-list ${loading ? 'is-loading' : ''}`} aria-busy={loading}>
                  {jobs.map((j) => <li key={j._id}><JobRow job={j} category={catName[j.categoryId]} /></li>)}
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
