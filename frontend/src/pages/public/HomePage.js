import React, { Component } from 'react';
import { Ban, CalendarClock, Check, Lock, LockOpen, Plus, RotateCcw, Search, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner } from '../../components/ui';
import { categoryIcon } from '../../components/Illustrations';
import JobTile from '../../components/JobTile';
import withRouter from '../../utils/withRouter';
import { money, salary } from '../../utils/format';
import { AuthContext } from '../../context/AuthContext';

// Bốn cam kết an toàn, mỗi cam kết là một business rule backend đang chặn
const PROMISES = [
  [Ban, 'Không phí, không đặt cọc', 'Nhà tuyển dụng không được thu tiền của sinh viên. Tin đòi đặt cọc bị ẩn, tài khoản lừa đảo bị khóa.'],
  [Lock, 'Liên hệ chỉ mở khi được nhận', 'Số điện thoại và email của hai bên chỉ hiện khi đơn đã được nhận, không lộ cho người lạ.'],
  [Star, 'Đánh giá từ người đã làm', 'Chỉ đơn đã hoàn thành mới được đánh giá, mỗi bên một lần trong 14 ngày.'],
  [CalendarClock, 'Tin luôn còn hiệu lực', 'Tin tự hết hạn sau 14 ngày (30 ngày với Premium). Tin đã đủ người không còn hiện.'],
];

// Khoảnh khắc chính của trang: liên hệ nhà tuyển dụng mờ khi "Đang chờ", hiện ra khi "Được nhận" (BR-12).
// Tự chạy một lần khi cuộn tới; người dùng bấm "Xem lại" để chạy lại; giảm chuyển động thì hiện sẵn trạng thái cuối.
class ContactUnlock extends Component {
  state = { open: false };
  ref = React.createRef();
  componentDidMount() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches || !('IntersectionObserver' in window)) return this.setState({ open: true });
    this.io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      this.io.disconnect();
      this.t = setTimeout(() => this.setState({ open: true }), 700);
    }, { threshold: 0.6 });
    this.io.observe(this.ref.current);
  }
  componentWillUnmount() { this.io?.disconnect(); clearTimeout(this.t); }
  replay = () => {
    clearTimeout(this.t);
    this.setState({ open: false });
    this.t = setTimeout(() => this.setState({ open: true }), 900);
  };
  render() {
    const { open } = this.state;
    return (
      <div className="gn-unlock" ref={this.ref}>
        <div className="row-between">
          <span className="gn-unlock-meta">Đơn ứng tuyển</span>
          <span className={`chip ${open ? 'chip-green' : 'chip-yellow'}`}>{open ? 'Được nhận' : 'Đang chờ'}</span>
        </div>
        <h3>Phục vụ ca tối, The Coffee Corner</h3>
        <p className="gn-unlock-meta">Nộp 12/10 kèm CV_NguyenMinhAn.pdf</p>
        <div className={`gn-contact ${open ? 'open' : ''}`}>
          <span className="gn-contact-ico">{open ? <LockOpen size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}</span>
          <div>
            <span className="gn-unlock-meta">Liên hệ nhà tuyển dụng</span>
            <strong className="gn-phone" aria-hidden={!open}>0901 234 567</strong>
            <span className="gn-mail" aria-hidden={!open}>ha.tran@coffeecorner.vn</span>
          </div>
        </div>
        <div className="row-between gn-unlock-foot">
          <p aria-live="polite">{open ? 'Đã được nhận, hai bên thấy liên hệ của nhau.' : 'Liên hệ chỉ mở khi bạn được nhận.'}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={this.replay}><RotateCcw size={14} aria-hidden="true" />Xem lại</button>
        </div>
      </div>
    );
  }
}

const STUDENT_PERKS = [
  'Tìm theo ngành, khu vực và mức lương, gõ không dấu vẫn ra',
  'Một CV PDF dùng lại cho mọi đơn ứng tuyển',
  'Theo dõi trạng thái đơn, có thông báo khi được nhận hoặc bị từ chối',
  'Lưu tối đa 100 việc để xem lại sau',
];
const STUDENT_STEPS = [['Tạo hồ sơ', 'Điền trường, ngành, kỹ năng và tải CV'], ['Ứng tuyển', 'Nộp đơn kèm thư giới thiệu ngắn'], ['Đi làm', 'Được nhận thì thấy liên hệ, xong việc thì đánh giá']];
const EMPLOYER_PERKS = [
  'Đăng 3 tin miễn phí, mỗi tin hiển thị 14 ngày',
  'Nhận hồ sơ có sẵn CV và điểm đánh giá của sinh viên',
  'Duyệt, từ chối và xác nhận kết quả ngay trên một trang',
  'Đủ người thì tin tự đóng, đơn còn lại được báo từ chối',
];

// Tab lọc theo salaryType của API-20
const TABS = [['', 'Tất cả'], ['HOURLY', 'Theo giờ'], ['DAILY', 'Theo ngày'], ['PROJECT', 'Theo dự án']];
const FAQ = [
  ['Ứng tuyển có mất phí không?', 'Hoàn toàn miễn phí với sinh viên. Nhà tuyển dụng không được thu bất kỳ khoản phí nào của bạn.'],
  ['Bị yêu cầu đặt cọc hoặc đóng phí thì làm gì?', 'Đừng chuyển tiền. Bấm "Báo cáo tin này" ở trang chi tiết việc và chọn lý do "Lừa đảo / thu phí". Quản trị viên xử lý theo 3 bậc: cảnh cáo, ẩn tin hoặc khóa tài khoản.'],
  ['Tôi cần chuẩn bị gì để ứng tuyển?', 'Đăng ký bằng email trường, điền hồ sơ và tải lên một CV PDF. CV này được dùng lại cho mọi đơn ứng tuyển.'],
  ['Làm sao biết nhà tuyển dụng đáng tin?', 'Mỗi nhà tuyển dụng có trang công khai với điểm đánh giá từ những sinh viên đã từng làm việc ở đó.'],
  ['Nhà tuyển dụng đăng tin thế nào?', 'Mỗi tài khoản được đăng tối đa 3 tin miễn phí. Gói Premium nâng lên 20 tin, mỗi tin hiển thị 30 ngày và được ghim Nổi bật.'],
];

class HomePage extends Component {
  static contextType = AuthContext;
  state = {
    q: '', categoryId: '', city: '', categories: [], locations: [], jobs: null, tab: '',
    total: 0, reviews: [], rating: null, plans: [], audience: null,
  };

  async componentDidMount() {
    const [c, l, j, p] = await Promise.all([
      api.get('/categories'), api.get('/jobs/locations'), api.get('/jobs?limit=9'), api.get('/plans').catch(() => ({ data: [] })),
    ]);
    this.setState({ categories: c.data, locations: l.data, jobs: j.data, total: j.meta?.total || j.data.length, plans: p.data });
    // Lời chứng thực thật: đánh giá của các nhà tuyển dụng đang đăng tin; điểm tính trên đúng những đánh giá đã tải
    const ids = [...new Set(j.data.map((x) => x.employerId))].slice(0, 6);
    const rs = (await Promise.all(ids.map((id) => api.get(`/users/${id}/reviews?limit=3`).catch(() => ({ data: [] }))))).flatMap((r) => r.data);
    this.setState({
      reviews: rs.filter((r) => r.comment).slice(0, 3),
      rating: rs.length ? { avg: rs.reduce((n, r) => n + r.rating, 0) / rs.length, count: rs.length } : null,
    });
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
    const { q, categoryId, city, categories, locations, jobs, tab, total, reviews, rating, plans } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const user = this.context.user;
    // Sinh viên đã đăng nhập không vào được /employer/* (403) → dẫn sang đăng ký tài khoản nhà tuyển dụng
    const postJob = user?.role === 'EMPLOYER' ? '/employer/jobs/new' : '/register?role=EMPLOYER';
    const audience = this.state.audience || (user?.role === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT');
    const busiest = categories.filter((c) => c.jobCount > 0).sort((a, b) => b.jobCount - a.jobCount).slice(0, 4);
    return (
      <>
        <section className="gn-hero">
          <h1 className="gn-title">Việc part-time vừa với lịch học</h1>
          <p className="gn-sub">Lương, ca làm và đánh giá thật hiện rõ trước khi bạn nộp đơn. Không phí, không đặt cọc.</p>
          <form className="hx-search gn-search" onSubmit={this.search} role="search">
            <label className="hx-field hx-q">
              <Search size={18} aria-hidden="true" />
              <input value={q} onChange={this.set('q')} placeholder="Vị trí hoặc kỹ năng" aria-label="Từ khóa" />
            </label>
            <select className="hx-field" value={categoryId} onChange={this.set('categoryId')} aria-label="Ngành nghề">
              <option value="">Ngành nghề</option>
              {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select className="hx-field" value={city} onChange={this.set('city')} aria-label="Thành phố">
              <option value="">Địa điểm</option>
              {locations.map((l) => <option key={l.city}>{l.city}</option>)}
            </select>
            <button className="btn btn-lg">Tìm việc</button>
          </form>
          {busiest.length > 0 && (
            <p className="gn-chips">
              <span>Đang tuyển nhiều:</span>
              {busiest.map((c) => <Link key={c._id} to={`/jobs?categoryId=${c._id}`} className="gn-chip">{c.name}</Link>)}
            </p>
          )}
        </section>

        <div className="container">
          <section className="gn-sec" aria-labelledby="gn-jobs">
            <div className="gn-head">
              <h2 id="gn-jobs" className="gn-h2">Việc đang tuyển</h2>
              <p>{total ? `${total} tin đang mở` : 'Tin mới nhất'} từ quán cà phê, trung tâm gia sư và cửa hàng gần trường.</p>
              <div className="gn-tabs" role="tablist" aria-label="Hình thức trả lương">
                {TABS.map(([key, label]) => (
                  <button key={key} role="tab" aria-selected={tab === key} className="gn-tab" onClick={() => this.loadTab(key)}>{label}</button>
                ))}
              </div>
            </div>
            {!jobs ? <Spinner /> : !jobs.length ? (
              <div className="gn-empty">
                <p>{tab ? 'Chưa có việc nào trả lương theo hình thức này. Thử tab khác nhé.' : 'Chưa có tin tuyển dụng nào đang mở.'}</p>
                {!tab && user?.role !== 'STUDENT' && <Link to={postJob} className="gn-link">Đăng tin tuyển dụng đầu tiên</Link>}
              </div>
            ) : (
              <div className="gn-head">
                <div className="jobs-grid" style={{ textAlign: 'left' }}>{jobs.map((j) => <JobTile key={j._id} job={j} category={catName[j.categoryId]} badge />)}</div>
                <Link to={`/jobs${qs({ salaryType: tab })}`} className="gn-link gn-more">Xem tất cả việc làm →</Link>
              </div>
            )}
          </section>

        </div>

        <section className="gn-safe" aria-labelledby="gn-safe">
          <div className="container gn-safe-grid">
            <div>
              <h2 id="gn-safe" className="gn-h2">An toàn là mặc định</h2>
              <p className="gn-safe-lede">Làm thêm qua group mạng xã hội dễ gặp tin đòi đặt cọc hay đóng phí đồng phục. Trên JobSV, những điều dưới đây được hệ thống chặn sẵn.</p>
              <dl className="gn-promises">
                {PROMISES.map(([Icon, title, text]) => (
                  <div key={title}>
                    <dt><Icon size={20} aria-hidden="true" />{title}</dt>
                    <dd>{text}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <ContactUnlock />
          </div>
        </section>

        <div className="container">
          <section className="gn-sec" aria-labelledby="gn-who">
            <div className="gn-head">
              <h2 id="gn-who" className="gn-h2">Dành cho cả hai phía</h2>
              <p>Sinh viên tìm việc vừa lịch học, nhà tuyển dụng tìm người làm được ngay.</p>
              <div className="gn-tabs gn-who-tabs" role="tablist" aria-label="Bạn là">
                {[['STUDENT', 'Sinh viên'], ['EMPLOYER', 'Nhà tuyển dụng']].map(([k, label]) => (
                  <button key={k} role="tab" aria-selected={audience === k} className="gn-tab" onClick={() => this.setState({ audience: k })}>{label}</button>
                ))}
              </div>
            </div>
            <div key={audience} className="gn-who" role="tabpanel">
              <div>
                <h3 className="gn-who-title">{audience === 'STUDENT' ? 'Tìm việc không mất phí' : 'Tuyển sinh viên trong vài ngày'}</h3>
                <ul className="gn-perks">
                  {(audience === 'STUDENT' ? STUDENT_PERKS : EMPLOYER_PERKS).map((t) => <li key={t}><Check size={18} aria-hidden="true" />{t}</li>)}
                </ul>
                {audience === 'STUDENT'
                  ? <Link to={user?.role === 'STUDENT' ? '/student/profile' : '/register'} className="btn btn-lg">{user?.role === 'STUDENT' ? 'Hoàn thiện hồ sơ' : 'Tạo hồ sơ miễn phí'}</Link>
                  : <Link to={postJob} className="btn btn-lg">Đăng tin tuyển dụng</Link>}
              </div>
              {audience === 'STUDENT' ? (
                <ol className="gn-steps">
                  {STUDENT_STEPS.map(([t, d], i) => <li key={t}><span className="gn-step-num">{i + 1}</span><div><strong>{t}</strong><span>{d}</span></div></li>)}
                </ol>
              ) : (
                <div className="gn-plans">
                  <div className="gn-plan">
                    <span className="gn-plan-name">Miễn phí</span>
                    <strong className="gn-plan-price">0đ</strong>
                    <span className="gn-plan-note">3 tin đang mở, mỗi tin 14 ngày</span>
                  </div>
                  {plans.map((p) => (
                    <div key={p._id} className="gn-plan">
                      <span className="gn-plan-name">{p.name}</span>
                      <strong className="gn-plan-price">{money(p.price)}</strong>
                      <span className="gn-plan-note">20 tin đang mở, mỗi tin 30 ngày, ghim Nổi bật</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {categories.length > 0 && (
            <section className="gn-sec" aria-labelledby="gn-cats">
              <div className="gn-head">
                <h2 id="gn-cats" className="gn-h2">Lương theo ngành</h2>
                <p>Mức lương phổ biến của các tin đang mở trong từng ngành, cập nhật theo tin thật.</p>
              </div>
              <ul className="gn-cats">
                {categories.map((c) => {
                  const Icon = categoryIcon(c.name);
                  return (
                    <li key={c._id}>
                      <Link to={`/jobs?categoryId=${c._id}`} className="gn-cat">
                        <Icon size={22} aria-hidden="true" />
                        <strong>{c.name}</strong>
                        {c.pay ? <span className="gn-pay">{salary(c.pay)}</span> : <span>Chưa có tin đang mở</span>}
                        {c.jobCount > 0 && <span>{c.jobCount} việc đang tuyển</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {reviews.length > 0 && (
            <section className="gn-sec" aria-labelledby="gn-voices">
              <div className="gn-head">
                <h2 id="gn-voices" className="gn-h2">Sinh viên nói gì sau ca làm</h2>
                {rating && <p>{rating.avg.toFixed(1).replace('.', ',')} sao trung bình từ {rating.count} đánh giá gần nhất của người đã làm xong việc.</p>}
              </div>
              <div className="gn-quotes">
                {reviews.map((r) => (
                  <figure key={r._id} className="gn-quote">
                    <blockquote>“{r.comment}”</blockquote>
                    <figcaption>
                      <span>{r.reviewerId?.fullName || 'Sinh viên'}</span>
                      <span className="gn-stars" aria-label={`${r.rating} trên 5 sao`}>{'★'.repeat(r.rating)}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          )}

          <section className="gn-sec gn-faq" aria-labelledby="gn-faq">
            <h2 id="gn-faq" className="gn-h2">Câu hỏi thường gặp</h2>
            <div>
              {FAQ.map(([question, answer]) => (
                <details key={question}>
                  <summary>{question}<Plus size={20} aria-hidden="true" /></summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </section>
        </div>

        <section className="gn-band" aria-labelledby="gn-employer">
          <h2 id="gn-employer" className="gn-h2">Cần người cho ca làm tuần này?</h2>
          <p>Đăng tối đa 3 tin miễn phí, nhận hồ sơ có CV sẵn và xem đánh giá thật từ những sinh viên từng làm cho bạn.</p>
          <Link to={postJob} className="btn btn-lg gn-btn-white">Đăng tin tuyển dụng</Link>
        </section>
      </>
    );
  }
}

export default withRouter(HomePage);
