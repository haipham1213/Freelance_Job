import React, { Component } from 'react';
import { Ban, Building2, CalendarClock, Check, GraduationCap, Lock, MapPin, Plus, Search, Star, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Dropdown, Spinner } from '../../components/ui';
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

// Bảng so sánh với cách tìm việc qua group mạng xã hội; mỗi dòng ứng với một cam kết bên trái
const COMPARE = [
  ['Bị đòi đặt cọc, phí đồng phục', 'Tự xoay xở, khó đòi lại tiền', 'Báo cáo tin, admin ẩn tin hoặc khóa tài khoản'],
  ['Số điện thoại của bạn', 'Để công khai dưới bài đăng', 'Chỉ nhà tuyển dụng đã nhận bạn mới thấy'],
  ['Quán có uy tín không', 'Hỏi quanh, nghe lời đồn', 'Điểm đánh giá từ người đã làm xong việc'],
  ['Tin đã cũ', 'Bài cũ vẫn trôi, gọi mới biết đủ người', 'Tin tự ẩn khi hết hạn hoặc đủ người'],
];

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

// Thời khóa biểu minh họa trong khung điện thoại: h = giờ học, w = ca làm thêm, . = trống
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEK = [['Sáng', 'hhhhh.'], ['Chiều', 'h.h.hw'], ['Tối', 'w.w.w.']];

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
    total: 0, reviews: [], rating: null, plans: [],
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
    const busiest = categories.filter((c) => c.jobCount > 0).sort((a, b) => b.jobCount - a.jobCount).slice(0, 4);
    return (
      <>
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
                    <input value={q} onChange={this.set('q')} placeholder="Vị trí hoặc kỹ năng" aria-label="Từ khóa" />
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
            <table className="gn-compare">
              <caption className="sr-only">So sánh tìm việc qua group mạng xã hội và qua JobSV</caption>
              <thead><tr><th scope="col">Tình huống</th><th scope="col">Group mạng xã hội</th><th scope="col">JobSV</th></tr></thead>
              <tbody>
                {COMPARE.map(([when, group, jobsv]) => (
                  <tr key={when}>
                    <th scope="row">{when}</th>
                    <td className="gn-compare-no" data-label="Group mạng xã hội"><X size={16} aria-hidden="true" />{group}</td>
                    <td className="gn-compare-yes" data-label="JobSV"><Check size={16} aria-hidden="true" />{jobsv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="container">
          <section className="gn-sec" aria-labelledby="gn-who">
            <div className="gn-head">
              <h2 id="gn-who" className="gn-h2">Dành cho cả hai phía</h2>
              <p>Sinh viên tìm việc vừa lịch học, nhà tuyển dụng tìm người làm được ngay.</p>
            </div>
            {/* Hai ô xám cạnh nhau kiểu Letters: mỗi phía một nhãn, tiêu đề, lợi ích, các ô trắng bên trong và nút */}
            <div className="gn-who">
              <article className="gn-panel">
                <span className="gn-pill"><GraduationCap size={18} aria-hidden="true" />Sinh viên</span>
                <h3 className="gn-panel-title">Tìm việc không mất phí</h3>
                <ul className="gn-perks">{STUDENT_PERKS.map((t) => <li key={t}><Check size={18} aria-hidden="true" />{t}</li>)}</ul>
                <ol className="gn-steps">
                  {STUDENT_STEPS.map(([t, d], i) => <li key={t}><span className="gn-step-num">{i + 1}</span><div><strong>{t}</strong><span>{d}</span></div></li>)}
                </ol>
                <Link to={user?.role === 'STUDENT' ? '/student/profile' : '/register'} className="btn btn-lg">{user?.role === 'STUDENT' ? 'Hoàn thiện hồ sơ' : 'Tạo hồ sơ miễn phí'}</Link>
              </article>
              <article className="gn-panel">
                <span className="gn-pill"><Building2 size={18} aria-hidden="true" />Nhà tuyển dụng</span>
                <h3 className="gn-panel-title">Tuyển sinh viên trong vài ngày</h3>
                <ul className="gn-perks">{EMPLOYER_PERKS.map((t) => <li key={t}><Check size={18} aria-hidden="true" />{t}</li>)}</ul>
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
                <Link to={postJob} className="btn btn-lg">Đăng tin tuyển dụng</Link>
              </article>
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
