import React, { Component } from 'react';
import { ArrowLeft, ArrowRight, Clock, PenLine, Sparkles, Star, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner } from '../../components/ui';
import { HeroIllustrationRight, Mascot, categoryIcon } from '../../components/Illustrations';
import { PANEL_BG } from '../../utils/format';
import JobTile from '../../components/JobTile';
import withRouter from '../../utils/withRouter';
import { AuthContext } from '../../context/AuthContext';

const STEPS = [
  ['cloud', 'Tạo hồ sơ & CV', 'Đăng ký bằng email trường, tải CV PDF một lần dùng cho mọi đơn.'],
  ['triangle', 'Ứng tuyển minh bạch', 'Mức lương, ca làm, số chỗ còn trống hiển thị rõ ràng trước khi nộp.'],
  ['blob', 'Đánh giá hai chiều', 'Sau mỗi công việc, sinh viên và nhà tuyển dụng chấm điểm cho nhau.'],
];

// Tab như "Explore our library" của headspace.com; key = salaryType của API-20
const LIB_TABS = [['', Star, 'Nổi bật'], ['HOURLY', Clock, 'Theo giờ'], ['DAILY', Sun, 'Theo ngày'], ['PROJECT', PenLine, 'Theo dự án']];
const ROTATE = ['Tìm ca làm hợp lịch học', 'Nhận lương minh bạch', 'Tích lũy kinh nghiệm', 'Gặp nhà tuyển dụng uy tín'];
const TRUST = ['Hơn 100 việc part-time mỗi tuần', 'Lương & ca làm công khai trước khi nộp', 'Đánh giá hai chiều sau mỗi công việc'];
const FAQ = [
  ['Ứng tuyển có mất phí không?', 'Hoàn toàn miễn phí với sinh viên. Nếu nhà tuyển dụng yêu cầu đóng phí, hãy báo cáo tin đó ngay.'],
  ['Tôi cần chuẩn bị gì để ứng tuyển?', 'Đăng ký bằng email trường, điền hồ sơ và tải lên một CV PDF — dùng lại cho mọi đơn ứng tuyển.'],
  ['Làm sao biết nhà tuyển dụng đáng tin?', 'Mỗi nhà tuyển dụng có trang công khai với điểm đánh giá từ những sinh viên đã từng làm việc ở đó.'],
  ['Nhà tuyển dụng đăng tin thế nào?', 'Mỗi tài khoản được đăng tối đa 3 tin miễn phí; gói Premium giúp tin được ghim nổi bật.'],
];
const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

class HomePage extends Component {
  static contextType = AuthContext;
  state = { q: '', categoryId: '', categories: [], jobs: null, tab: '', lib: null, reviews: [] };
  track = React.createRef();

  async componentDidMount() {
    const [c, j] = await Promise.all([api.get('/categories'), api.get('/jobs?limit=10')]);
    this.setState({ categories: c.data, jobs: j.data, lib: j.data, categoryId: c.data[0]?._id || '' });
    // Lời chứng thực thật: đánh giá có bình luận của sinh viên dành cho các nhà tuyển dụng đang đăng tin
    const ids = [...new Set(j.data.map((x) => x.employerId))].slice(0, 6);
    const rs = await Promise.all(ids.map((id) => api.get(`/users/${id}/reviews?limit=3`).catch(() => ({ data: [] }))));
    this.setState({ reviews: rs.flatMap((r) => r.data).filter((r) => r.comment).slice(0, 3) });
  }

  loadTab = async (tab) => {
    this.setState({ tab, lib: null });
    const r = await api.get(`/jobs${qs({ limit: 10, salaryType: tab })}`);
    if (this.state.tab === tab) this.setState({ lib: r.data });
  };

  slide = (dir) => {
    const el = this.track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  }

  search = (e) => {
    e.preventDefault();
    this.props.navigate(`/jobs${qs({ q: this.state.q, categoryId: this.state.categoryId })}`);
  };

  render() {
    const { q, categoryId, categories, jobs, tab, lib, reviews } = this.state;
    const companies = [...new Set((jobs || []).map((j) => j.companySnapshot?.name).filter(Boolean))];
    const topics = categories.slice(0, 6);
    const active = topics.find((c) => c._id === categoryId) || topics[0];
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const user = this.context.user;
    // Sinh viên đã đăng nhập không vào được /employer/* (403) → dẫn sang đăng ký tài khoản nhà tuyển dụng
    const isEmployer = user?.role === 'EMPLOYER';
    const postJob = isEmployer ? '/employer/jobs/new' : '/register?role=EMPLOYER';
    const openJobs = categories.reduce((n, c) => n + c.jobCount, 0);
    return (
      <div className="container">
        <section className="hero">
          <h1 className="hero-title">
            <span className="rotator" aria-hidden="true">
              <span className="rotator-track">
                {[...ROTATE, ROTATE[0]].map((t, i) => <span key={i}>{t}</span>)}
              </span>
            </span>
            <span className="sr-only">{ROTATE.join(', ')}, </span>
            tất cả với JobSV
          </h1>
          <ul className="trust-row">
            {TRUST.map((t) => <li key={t}><CheckIcon />{t}</li>)}
          </ul>
        </section>

        <section className="hero-cards">
          <div className="hero-card">
            <h2 className="display">Việc làm thêm hợp lịch học, lương minh bạch</h2>
            <Link to="/jobs" className="btn btn-lg">Tìm việc ngay</Link>
            <div className="hero-card-art">
              <div className="mock-phone">
                <div className="tiny">Việc nổi bật</div>
                <div className="mock-title">{jobs?.[0]?.title || 'Phục vụ quán cà phê'}</div>
                <div className="row" style={{ justifyContent: 'center', gap: 6 }}>
                  <span className="chip chip-white">Ca tối</span>
                  <span className="chip chip-white">25k/giờ</span>
                </div>
                <span className="mock-play"><ArrowRight size={26} /></span>
              </div>
              <div className="sun-face" aria-hidden="true">
                <svg viewBox="0 0 60 20"><path d="M4 4 q10 12 22 2 M34 6 q10 12 22 -2" fill="none" stroke="#2d2c2b" strokeWidth="3.5" strokeLinecap="round" /></svg>
              </div>
              <div className="bubble">Hôm nay làm gì nhỉ?<div className="tiny fog"><span className="accent">●</span> JobSV</div></div>
            </div>
          </div>
          <div className="hero-card">
            <h2 className="display">Tuyển sinh viên nhanh, có đánh giá thật</h2>
            <Link to={postJob} className="btn btn-lg">Đăng tin tuyển dụng</Link>
            <div className="hero-card-art">
              <HeroIllustrationRight className="hero-card-illo" />
            </div>
          </div>
        </section>

        <section className="section center">
          <h2 className="display">Bạn muốn tìm việc gì?</h2>
          <div className="topic-chips" role="tablist" aria-label="Ngành nghề">
            {topics.map((c) => (
              <button key={c._id} role="tab" aria-selected={c === active} className={`topic-chip ${c === active ? 'active' : ''}`} onClick={() => this.setState({ categoryId: c._id })}>
                {c.name}
              </button>
            ))}
          </div>
          {active && (
            <div className="topic-panel" role="tabpanel" style={{ background: PANEL_BG[topics.indexOf(active) % PANEL_BG.length] }}>
              <div className="topic-text">
                <h3 className="display">{active.name}</h3>
                <p className="topic-sub">{active.jobCount} việc đang tuyển · ca linh hoạt theo lịch học</p>
                <form className="search-bar" onSubmit={this.search} role="search">
                  <input className="input" placeholder={`Tìm trong ${active.name.toLowerCase()}…`} value={q} onChange={(e) => this.setState({ q: e.target.value })} aria-label="Từ khóa" />
                  <button className="btn">Tìm việc</button>
                </form>
                <Link to={`/jobs?categoryId=${active._id}`} className="topic-link ico-row">Xem tất cả việc {active.name.toLowerCase()} <ArrowRight size={16} /></Link>
              </div>
              <div className="topic-art" aria-hidden="true">
                {active.imageUrl ? <img src={active.imageUrl} alt="" /> : React.createElement(categoryIcon(active.name), { size: 96, strokeWidth: 1.4 })}
              </div>
            </div>
          )}
        </section>

        <section className="section center voices">
          <div className="voices-head">
            <span className="float f1"><Mascot kind="cloud" size={84} /></span>
            <span className="float f2"><Mascot kind="flower" size={64} /></span>
            <span className="float f3"><Mascot kind="triangle" size={72} /></span>
            <span className="float f4"><Mascot kind="blob" size={60} /></span>
            <h2 className="display">Sinh viên làm thêm an tâm hơn mỗi ngày</h2>
          </div>
          <div className="grid-3 voices-grid">
            {(reviews.length ? reviews : STEPS.map(([, title, text]) => ({ _id: title, comment: text, title }))).map((r) => (
              <figure key={r._id} className="voice">
                <blockquote>“{r.comment}”</blockquote>
                <figcaption className="tiny">
                  {r.title ? r.title : <>{r.reviewerId?.fullName || 'Sinh viên'} · <span className="stars">{'★'.repeat(r.rating)}</span></>}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section partner">
          <div className="partner-logos" aria-label="Nhà tuyển dụng trên JobSV">
            <div className="marquee-track">
              {[...companies, ...companies].map((c, i) => <span key={i} aria-hidden={i >= companies.length}>{c}</span>)}
            </div>
          </div>
          <div className="partner-body">
            <div className="stack-lg">
              <h2 className="display">Được các quán, cửa hàng và doanh nghiệp tin dùng</h2>
              <p style={{ fontSize: 19 }}>Tuyển sinh viên part-time nhanh, có hồ sơ CV sẵn và đánh giá thật sau mỗi công việc.</p>
              <div className="row">
                <Link to={postJob} className="btn btn-sand">Đăng tin tuyển dụng</Link>
                <Link to={isEmployer ? '/employer/premium' : postJob} className="btn btn-outline">Tìm hiểu Premium</Link>
              </div>
            </div>
            <div className="partner-art" aria-hidden="true">
              {categories.filter((c) => c.imageUrl).slice(0, 3).map((c, i) => <img key={c._id} className={`ph ph${i}`} src={c.imageUrl} alt="" />)}
              <span className="ph-star"><Sparkles size={48} /></span>
              <span className="ph-cloud"><Mascot kind="cloud" size={130} /></span>
            </div>
          </div>
        </section>

        <div className="ticker" aria-hidden="true">
          <div className="marquee-track">
            {Array.from({ length: 12 }, (_, i) => <span key={i}>tìm việc cùng jobsv <b className="eyes">{i % 2 ? '◡◡' : '●●'}</b></span>)}
          </div>
        </div>

        <section className="section">
          <h2 className="display center">Việc nổi bật</h2>
          <div className="lib-head">
            <div className="lib-tabs" role="tablist" aria-label="Loại lương">
              {LIB_TABS.map(([key, Icon, label]) => (
                <button key={key} role="tab" aria-selected={tab === key} className={`lib-tab ${tab === key ? 'active' : ''}`} onClick={() => this.loadTab(key)}>
                  <Icon size={16} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            <div className="lib-arrows">
              <button className="lib-arrow" onClick={() => this.slide(-1)} aria-label="Trước"><ArrowLeft size={20} /></button>
              <button className="lib-arrow" onClick={() => this.slide(1)} aria-label="Sau"><ArrowRight size={20} /></button>
            </div>
          </div>
          {!lib ? <Spinner /> : (
            <div className="lib-track" ref={this.track}>
              {lib.map((j, i) => (
                <JobTile key={j._id} job={j} category={catName[j.categoryId]} badge={!!tab} />
              ))}
              {!lib.length && <div className="empty">Chưa có việc nào loại này</div>}
              <Link to={`/jobs${qs({ salaryType: tab })}`} className="lib-card lib-more ico-row">Xem tất cả <ArrowRight size={18} /></Link>
            </div>
          )}
        </section>

        <section className="section join">
          <span className="float j1"><Mascot kind="flower" size={70} /></span>
          <span className="float j2"><Mascot kind="blob" size={62} /></span>
          <span className="float j3"><Mascot kind="triangle" size={66} /></span>
          <span className="float j4"><Mascot kind="cloud" size={74} /></span>
          <div className="live-pill"><span className="live-dot" />{openJobs} việc đang tuyển</div>
          <h2 className="display">Bắt đầu kiếm thêm thu nhập ngay hôm nay</h2>
          <Link to={user ? '/jobs' : '/register'} className="btn">{user ? 'Tìm việc ngay' : 'Tạo tài khoản miễn phí'}</Link>
          <div className="join-stats">
            {[[openJobs, 'Việc đang tuyển'], [categories.length, 'Ngành nghề'], ['3', 'Tin miễn phí cho nhà tuyển dụng'], ['★★★★★', 'Đánh giá hai chiều']].map(([n, l]) => (
              <div key={l}><div className="join-num">{n}</div><div>{l}</div></div>
            ))}
          </div>
        </section>

        <section className="section faq">
          <h2 className="display center">Câu hỏi thường gặp</h2>
          <div style={{ marginTop: 32 }}>
            {FAQ.map(([q, a]) => (
              <details key={q}><summary>{q}</summary><p className="muted">{a}</p></details>
            ))}
          </div>
        </section>

        <section className="mega-cta">
          <span className="float m1"><Mascot kind="cloud" size={110} /></span>
          <span className="float m2"><Mascot kind="blob" size={96} /></span>
          <span className="float m3"><Mascot kind="flower" size={80} /></span>
          <span className="float m4"><Mascot kind="triangle" size={90} /></span>
          <Link to="/jobs" className="mega-btn">Tìm việc cùng JobSV</Link>
        </section>
      </div>
    );
  }
}

export default withRouter(HomePage);
