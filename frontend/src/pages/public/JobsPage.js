import React, { Component } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { api, qs } from '../../api';
import { Link } from 'react-router-dom';
import JobTile from '../../components/JobTile';
import { Spinner, Empty, Pagination } from '../../components/ui';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';

const SALARY_TYPES = [['', 'Tất cả'], ['HOURLY', 'Theo giờ'], ['DAILY', 'Theo ngày'], ['PROJECT', 'Theo dự án']];
const FILTERS = ['q', 'categoryId', 'city', 'district', 'salaryType', 'salaryMin', 'salaryMax', 'page'];

// SCR-C04 / FR-SRC-01: bộ lọc nằm trên URL để chia sẻ và quay lại được
class JobsPage extends Component {
  static contextType = AuthContext;
  state = { categories: [], locations: [], jobs: null, meta: null, form: {} };

  params = () => Object.fromEntries(FILTERS.map((k) => [k, this.props.searchParams.get(k) || '']));

  async componentDidMount() {
    const [c, l] = await Promise.all([api.get('/categories'), api.get('/jobs/locations')]);
    this.setState({ categories: c.data, locations: l.data });
    this.load();
  }

  componentDidUpdate(prev) {
    if (prev.location.search !== this.props.location.search) this.load();
  }

  load = async () => {
    const p = this.params();
    this.setState({ jobs: null, form: p });
    const r = await api.get(`/jobs${qs({ ...p, limit: 12 })}`);
    this.setState({ jobs: r.data, meta: r.meta });
  };

  apply = (patch) => {
    const next = { ...this.state.form, ...patch, page: patch.page || '' };
    if (patch.city !== undefined) next.district = '';
    this.props.setSearchParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value } });
  pick = (k) => (e) => this.apply({ [k]: e.target.value });

  render() {
    const { categories, locations, jobs, meta, form } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const districts = locations.find((l) => l.city === form.city)?.districts || [];
    const user = this.context.user;
    return (
      <>
        <section className="jp-band">
          <div className="container">
            <h1 className="display">Tìm việc part-time</h1>
            <form className="hx-search" onSubmit={(e) => { e.preventDefault(); this.apply({ q: form.q }); }} role="search">
              <label className="hx-field hx-q">
                <Search size={18} aria-hidden="true" />
                <input value={form.q || ''} onChange={this.set('q')} placeholder="Vị trí, kỹ năng: phục vụ, gia sư, Canva" aria-label="Từ khóa" />
              </label>
              <select className="hx-field" value={form.city || ''} onChange={this.pick('city')} aria-label="Thành phố">
                <option value="">Tất cả địa điểm</option>
                {locations.map((l) => <option key={l.city}>{l.city}</option>)}
              </select>
              <button className="btn btn-lg">Tìm việc</button>
            </form>
          </div>
        </section>

        <div className="container page jp-layout">
          <aside className="card jp-filters" aria-label="Bộ lọc">
            <div className="row-between">
              <strong className="ico-row"><SlidersHorizontal size={18} />Lọc nâng cao</strong>
              <button className="btn-link small" onClick={() => this.props.setSearchParams({})}>Xóa lọc</button>
            </div>
            <fieldset>
              <legend>Hình thức trả lương</legend>
              {SALARY_TYPES.map(([v, label]) => (
                <label key={v} className="jp-radio"><input type="radio" name="salaryType" checked={(form.salaryType || '') === v} onChange={() => this.apply({ salaryType: v })} />{label}</label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Ngành nghề</legend>
              <select className="select" value={form.categoryId || ''} onChange={this.pick('categoryId')} aria-label="Ngành nghề">
                <option value="">Tất cả ngành nghề</option>
                {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </fieldset>
            {districts.length > 0 && (
              <fieldset>
                <legend>Quận / huyện</legend>
                <select className="select" value={form.district || ''} onChange={this.pick('district')} aria-label="Quận / huyện">
                  <option value="">Tất cả quận</option>
                  {districts.map((d) => <option key={d}>{d}</option>)}
                </select>
              </fieldset>
            )}
            <form onSubmit={(e) => { e.preventDefault(); this.apply({ salaryMin: form.salaryMin, salaryMax: form.salaryMax }); }}>
              <fieldset>
                <legend>Mức lương (VNĐ)</legend>
                <div className="jp-range">
                  <input className="input" type="number" min="0" step="1000" placeholder="Từ" value={form.salaryMin || ''} onChange={this.set('salaryMin')} aria-label="Lương từ (VNĐ)" />
                  <input className="input" type="number" min="0" step="1000" placeholder="Đến" value={form.salaryMax || ''} onChange={this.set('salaryMax')} aria-label="Lương đến (VNĐ)" />
                </div>
              </fieldset>
              <button className="btn btn-block">Áp dụng</button>
            </form>
          </aside>

          <section>
            <div className="jp-head">
              <h2 className="h-lg">{meta ? <>Tìm thấy {meta.total} việc làm phù hợp</> : 'Đang tìm…'}</h2>
            </div>
            {!jobs ? <Spinner /> : !jobs.length ? (
              <div className="card"><Empty title="Không có việc phù hợp">Thử bỏ bớt bộ lọc hoặc dùng từ khóa khác.</Empty></div>
            ) : (
              <div className="jp-list">{jobs.map((j) => <JobTile key={j._id} job={j} category={catName[j.categoryId]} badge />)}</div>
            )}
            <Pagination meta={meta} onPage={(page) => this.apply({ page: String(page) })} />
            {!user && (
              <div className="card jp-cta">
                <div>
                  <strong>Chưa thấy việc hợp ý?</strong>
                  <p className="muted small">Tạo hồ sơ và tải CV một lần, ứng tuyển nhanh khi có việc mới.</p>
                </div>
                <Link to="/register" className="btn">Tạo hồ sơ</Link>
              </div>
            )}
          </section>
        </div>
      </>
    );
  }
}

export default withRouter(JobsPage);
