import React, { Component } from 'react';
import { ArrowRight, Eye, Search, Star, UserRoundCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner } from '../../components/ui';
import { HeroIllustrationRight, Scene } from '../../components/Illustrations';
import JobTile from '../../components/JobTile';
import withRouter from '../../utils/withRouter';
import { AuthContext } from '../../context/AuthContext';

const STEPS = [
  [UserRoundCheck, 'Tạo hồ sơ một lần', 'Đăng ký bằng email trường, tải CV PDF một lần và dùng lại cho mọi đơn.'],
  [Eye, 'Thấy rõ trước khi nộp', 'Mức lương, ca làm và số chỗ còn trống hiển thị ngay trên tin tuyển dụng.'],
  [Star, 'Đánh giá hai chiều', 'Sau mỗi công việc, sinh viên và nhà tuyển dụng chấm điểm cho nhau.'],
];
// Tab lọc theo salaryType của API-20
const TABS = [['', 'Tất cả'], ['HOURLY', 'Theo giờ'], ['DAILY', 'Theo ngày'], ['PROJECT', 'Theo dự án']];
const FAQ = [
  ['Ứng tuyển có mất phí không?', 'Hoàn toàn miễn phí với sinh viên. Nếu nhà tuyển dụng yêu cầu đóng phí, hãy báo cáo tin đó ngay.'],
  ['Tôi cần chuẩn bị gì để ứng tuyển?', 'Đăng ký bằng email trường, điền hồ sơ và tải lên một CV PDF. CV này được dùng lại cho mọi đơn ứng tuyển.'],
  ['Làm sao biết nhà tuyển dụng đáng tin?', 'Mỗi nhà tuyển dụng có trang công khai với điểm đánh giá từ những sinh viên đã từng làm việc ở đó.'],
  ['Nhà tuyển dụng đăng tin thế nào?', 'Mỗi tài khoản được đăng tối đa 3 tin miễn phí. Gói Premium giúp tin được ghim nổi bật.'],
];

// Trang chủ bố cục kiểu TopCV: banner tìm kiếm, việc làm tốt nhất, ngành nổi bật, khối nhà tuyển dụng
class HomePage extends Component {
  static contextType = AuthContext;
  state = { q: '', categoryId: '', city: '', categories: [], locations: [], jobs: null, tab: '', reviews: [] };

  async componentDidMount() {
    const [c, l, j] = await Promise.all([api.get('/categories'), api.get('/jobs/locations'), api.get('/jobs?limit=9')]);
    this.setState({ categories: c.data, locations: l.data, jobs: j.data });
    // Lời chứng thực thật: đánh giá có bình luận dành cho các nhà tuyển dụng đang đăng tin
    const ids = [...new Set(j.data.map((x) => x.employerId))].slice(0, 6);
    const rs = await Promise.all(ids.map((id) => api.get(`/users/${id}/reviews?limit=3`).catch(() => ({ data: [] }))));
    this.setState({ reviews: rs.flatMap((r) => r.data).filter((r) => r.comment).slice(0, 3) });
  }

  loadTab = async (tab) => {
    this.setState({ tab, jobs: null });
    const r = await api.get(`/jobs${qs({ limit: 9, salaryType: tab })}`);
    if (this.state.tab === tab) this.setState({ jobs: r.data });
  };

  search = (e) => {
    e.preventDefault();
    const { q, categoryId, city } = this.state;
    this.props.navigate(`/jobs${qs({ q, categoryId, city })}`);
  };

  set = (k) => (e) => this.setState({ [k]: e.target.value });

  render() {
    const { q, categoryId, city, categories, locations, jobs, tab, reviews } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const user = this.context.user;
    // Sinh viên đã đăng nhập không vào được /employer/* (403) → dẫn sang đăng ký tài khoản nhà tuyển dụng
    const postJob = user?.role === 'EMPLOYER' ? '/employer/jobs/new' : '/register?role=EMPLOYER';
    const openJobs = categories.reduce((n, c) => n + c.jobCount, 0);
    const logos = [...new Map((jobs || []).filter((j) => j.companySnapshot?.logoUrl).map((j) => [j.companySnapshot.name, j.companySnapshot])).values()].slice(0, 6);
    return (
      <>
        <section className="hx-hero">
          <div className="container hx-hero-grid">
            <div>
              <h1 className="hero-title">Tìm việc part-time hợp lịch học</h1>
              <p className="hx-sub">Lương, ca làm và đánh giá nhà tuyển dụng công khai trước khi bạn ứng tuyển.</p>
              <form className="hx-search" onSubmit={this.search} role="search">
                <label className="hx-field hx-q">
                  <Search size={18} aria-hidden="true" />
                  <input value={q} onChange={this.set('q')} placeholder="Vị trí, kỹ năng: phục vụ, gia sư, Canva" aria-label="Từ khóa" />
                </label>
                <select className="hx-field" value={categoryId} onChange={this.set('categoryId')} aria-label="Ngành nghề">
                  <option value="">Tất cả ngành nghề</option>
                  {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                <select className="hx-field" value={city} onChange={this.set('city')} aria-label="Thành phố">
                  <option value="">Tất cả địa điểm</option>
                  {locations.map((l) => <option key={l.city}>{l.city}</option>)}
                </select>
                <button className="btn btn-lg">Tìm việc</button>
              </form>
            </div>
            <HeroIllustrationRight className="hx-illo" />
          </div>
        </section>

        <div className="container">
          <section className="hx-stats" aria-label="Số liệu JobSV">
            <div><strong>{openJobs}</strong><span>việc đang tuyển</span></div>
            <div><strong>{categories.length}</strong><span>ngành nghề phổ biến</span></div>
            <div><strong>0đ</strong><span>phí ứng tuyển cho sinh viên</span></div>
          </section>

          <section className="section card hx-box">
            <div className="hx-box-head">
              <h2 className="display">Việc làm tốt nhất</h2>
              <Link to={`/jobs${qs({ salaryType: tab })}`} className="accent ico-row">Xem tất cả <ArrowRight size={16} /></Link>
            </div>
            <div className="tabs" role="tablist" aria-label="Hình thức trả lương">
              {TABS.map(([key, label]) => (
                <button key={key} role="tab" aria-selected={tab === key} className={`tab ${tab === key ? 'active' : ''}`} onClick={() => this.loadTab(key)}>{label}</button>
              ))}
            </div>
            {!jobs ? <Spinner /> : !jobs.length ? <p className="muted center" style={{ padding: 32 }}>Chưa có việc nào theo hình thức này.</p> : (
              <div className="jobs-grid">{jobs.map((j) => <JobTile key={j._id} job={j} category={catName[j.categoryId]} badge />)}</div>
            )}
          </section>

          <section className="section">
            <h2 className="display">Top ngành nghề nổi bật</h2>
            <div className="hx-cats">
              {categories.map((c) => (
                <Link key={c._id} to={`/jobs?categoryId=${c._id}`} className="hx-cat">
                  <Scene seed={c._id} category={c.name} className="hx-cat-art" />
                  <span className="h-sm">{c.name}</span>
                  <span className="accent small">{c.jobCount} việc làm</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="section hx-split">
            <div className="card">
              <h2 className="display">Làm thêm an toàn hơn</h2>
              <ul className="hx-steps">
                {STEPS.map(([Icon, title, text]) => (
                  <li key={title}>
                    <span className="hx-step-icon"><Icon size={22} /></span>
                    <span><strong>{title}</strong><span className="muted">{text}</span></span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h2 className="display">Sinh viên nói gì</h2>
              {reviews.length ? reviews.map((r) => (
                <figure key={r._id} className="hx-quote">
                  <blockquote>“{r.comment}”</blockquote>
                  <figcaption className="small muted">{r.reviewerId?.fullName || 'Sinh viên'} <span className="stars">{'★'.repeat(r.rating)}</span></figcaption>
                </figure>
              )) : <p className="muted">Đánh giá của sinh viên sẽ xuất hiện ở đây sau mỗi công việc hoàn thành.</p>}
            </div>
          </section>

          <section className="section card hx-employer">
            <div className="stack">
              <h2 className="display">Bạn cần tuyển sinh viên?</h2>
              <p className="muted">Đăng tối đa 3 tin miễn phí, nhận hồ sơ có CV sẵn và đánh giá thật sau mỗi công việc.</p>
              <div><Link to={postJob} className="btn btn-lg">Đăng tin tuyển dụng</Link></div>
            </div>
            {logos.length > 0 && (
              <div className="hx-logos" aria-label="Nhà tuyển dụng đang đăng tin">
                {logos.map((c) => <span key={c.name} className="logo-box"><img src={c.logoUrl} alt={c.name} /></span>)}
              </div>
            )}
          </section>

          <section className="section card faq">
            <h2 className="display">Câu hỏi thường gặp</h2>
            {FAQ.map(([question, answer]) => (
              <details key={question}><summary>{question}</summary><p className="muted">{answer}</p></details>
            ))}
          </section>
        </div>
      </>
    );
  }
}

export default withRouter(HomePage);
