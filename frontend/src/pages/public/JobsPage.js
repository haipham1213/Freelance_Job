import React, { Component } from 'react';
import { ArrowRight, Clock, PenLine, Star, Sun } from 'lucide-react';
import { api, qs } from '../../api';
import { Link } from 'react-router-dom';
import JobTile from '../../components/JobTile';
import { Spinner, Empty, Pagination } from '../../components/ui';
import { Mascot } from '../../components/Illustrations';
import { AuthContext } from '../../context/AuthContext';
import withRouter from '../../utils/withRouter';

const SALARY_TABS = [['', Star, 'Tất cả'], ['HOURLY', Clock, 'Theo giờ'], ['DAILY', Sun, 'Theo ngày'], ['PROJECT', PenLine, 'Theo dự án']];
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
      <div className="container page">
        <header className="jobs-head">
          <h1 className="display">Tìm việc part-time</h1>
          <p className="muted">Ca linh hoạt theo lịch học, lương công khai trước khi nộp.</p>
          <form className="search-bar" onSubmit={(e) => { e.preventDefault(); this.apply({ q: form.q }); }} role="search">
            <input className="input" placeholder="Từ khóa: phục vụ, gia sư, Canva…" value={form.q || ''} onChange={this.set('q')} aria-label="Từ khóa" />
            <button className="btn">Tìm việc</button>
          </form>
          <div className="topic-chips" aria-label="Ngành nghề">
            {[{ _id: '', name: 'Tất cả' }, ...categories].map((c) => (
              <button key={c._id} className={`topic-chip ${(form.categoryId || '') === c._id ? 'active' : ''}`} aria-pressed={(form.categoryId || '') === c._id} onClick={() => this.apply({ categoryId: c._id })}>{c.name}</button>
            ))}
          </div>
        </header>

        <div className="filter-row" aria-label="Bộ lọc">
          <div className="lib-tabs">
            {SALARY_TABS.map(([v, Icon, label]) => (
              <button key={v} className={`lib-tab ${(form.salaryType || '') === v ? 'active' : ''}`} aria-pressed={(form.salaryType || '') === v} onClick={() => this.apply({ salaryType: v })}>
                <Icon size={16} aria-hidden="true" />{label}
              </button>
            ))}
          </div>
          <div className="row filter-pills">
            <select className="pill-select" value={form.city || ''} onChange={this.pick('city')} aria-label="Thành phố">
              <option value="">Mọi thành phố</option>
              {locations.map((l) => <option key={l.city}>{l.city}</option>)}
            </select>
            {districts.length > 0 && (
              <select className="pill-select" value={form.district || ''} onChange={this.pick('district')} aria-label="Quận / huyện">
                <option value="">Mọi quận</option>
                {districts.map((d) => <option key={d}>{d}</option>)}
              </select>
            )}
            <form className="pill-range" onSubmit={(e) => { e.preventDefault(); this.apply({ salaryMin: form.salaryMin, salaryMax: form.salaryMax }); }}>
              <input type="number" min="0" step="1000" placeholder="Lương từ" value={form.salaryMin || ''} onChange={this.set('salaryMin')} aria-label="Lương từ (VNĐ)" />
              <span aria-hidden="true">–</span>
              <input type="number" min="0" step="1000" placeholder="đến" value={form.salaryMax || ''} onChange={this.set('salaryMax')} aria-label="Lương đến (VNĐ)" />
              <button className="lib-arrow" aria-label="Áp dụng khoảng lương"><ArrowRight size={18} /></button>
            </form>
          </div>
        </div>

        <section style={{ marginTop: 48 }}>
          <div className="row-between">
            <h2 className="h-lg">{meta ? `${meta.total} việc phù hợp` : 'Đang tìm…'}</h2>
            <button className="btn-link small" onClick={() => this.props.setSearchParams({})}>Xóa bộ lọc</button>
          </div>
          {!jobs ? <Spinner /> : !jobs.length ? (
            <Empty title="Không có việc phù hợp">Thử bỏ bớt bộ lọc hoặc dùng từ khóa khác.</Empty>
          ) : (
            <div className="jobs-grid">{jobs.map((j, i) => <JobTile key={j._id} job={j} category={catName[j.categoryId]} badge />)}</div>
          )}
          <Pagination meta={meta} onPage={(page) => this.apply({ page: String(page) })} />
        </section>

        {!user && (
          <section className="promo">
            <div className="promo-inner">
              <div className="stack-lg">
                <h2 className="display">Chưa thấy việc hợp ý?</h2>
                <p style={{ fontSize: 18 }}>Tạo hồ sơ và tải CV một lần — ứng tuyển chỉ với một cú bấm khi có việc mới phù hợp lịch học của bạn.</p>
                <div><Link to="/register" className="btn btn-lg">Tạo hồ sơ miễn phí</Link></div>
              </div>
              <div className="promo-art" aria-hidden="true">
                <span className="float p1"><Mascot kind="cloud" size={170} /></span>
                <span className="float p2"><Mascot kind="blob" size={120} /></span>
                <span className="float p3"><Mascot kind="flower" size={90} /></span>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  }
}

export default withRouter(JobsPage);
