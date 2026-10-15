import React, { Component } from 'react';
import { Ban, Building2, CalendarClock, CalendarDays, Check, GraduationCap, Lock, MapPin, Plus, Search, Star, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Dropdown, Spinner, Stars } from '../../components/ui';
import { categoryIcon } from '../../components/Illustrations';
import JobRow, { loadSavedIds, saveToggler } from '../../components/JobRow';
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

const STUDENT_STEPS = [['Tạo hồ sơ', 'Điền trường, ngành, kỹ năng và tải CV'], ['Ứng tuyển', 'Nộp đơn kèm thư giới thiệu ngắn'], ['Đi làm', 'Được nhận thì thấy liên hệ, xong việc thì đánh giá']];
const EMPLOYER_STEPS = [['Đăng tin', 'Mô tả việc, mức lương và chọn ca làm trong tuần'], ['Duyệt hồ sơ', 'Xem CV và điểm đánh giá, nhận hoặc từ chối'], ['Xác nhận kết quả', 'Xong việc thì xác nhận và đánh giá sinh viên']];

// Thời khóa biểu minh họa trong khung điện thoại: h = giờ học, w = ca làm thêm, . = trống
const DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const WEEK = [['Sáng', 'hhhhh.'], ['Chiều', 'h.h.hw'], ['Tối', 'w.w.w.']];

// Tab "Ca làm tuần này" theo buổi (ô = ngày * 3 + buổi, xem Job.shifts). Lọc bằng tham số busy của API-20:
// coi mọi ô ngoài tab là bận, API giữ việc còn ít nhất một ca trong tab (và việc linh hoạt, xếp cuối)
const ALL_SLOTS = [...Array(21).keys()];
const PERIOD = (p) => [0, 1, 2, 3, 4, 5, 6].map((d) => d * 3 + p);
const TABS = [['all', 'Tất cả', null], ['morning', 'Buổi sáng', PERIOD(0)], ['afternoon', 'Buổi chiều', PERIOD(1)], ['evening', 'Buổi tối', PERIOD(2)], ['weekend', 'Cuối tuần', [15, 16, 17, 18, 19, 20]]];
const HOME_JOBS = 6;
const rating1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const FAQ = [
  ['Ứng tuyển có mất phí không?', 'Hoàn toàn miễn phí với sinh viên. Nhà tuyển dụng không được thu bất kỳ khoản phí nào của bạn.'],
  ['Bị yêu cầu đặt cọc hoặc đóng phí thì làm gì?', 'Đừng chuyển tiền. Bấm “Báo cáo tin này” ở trang chi tiết việc và chọn lý do “Lừa đảo / thu phí”. Quản trị viên xử lý theo 3 bậc: cảnh cáo, ẩn tin hoặc khóa tài khoản.'],
  ['Tôi cần chuẩn bị gì để ứng tuyển?', 'Đăng ký bằng email trường, điền hồ sơ và tải lên một CV PDF. CV này được dùng lại cho mọi đơn ứng tuyển.'],
  ['Làm sao biết nhà tuyển dụng đáng tin?', 'Mỗi nhà tuyển dụng có trang công khai với điểm đánh giá từ những sinh viên đã từng làm việc ở đó.'],
  ['Nhà tuyển dụng đăng tin thế nào?', 'Mỗi tài khoản được đăng tối đa 3 tin miễn phí. Gói Premium nâng lên 20 tin, mỗi tin hiển thị 30 ngày và được ghim Nổi bật.'],
];

class HomePage extends Component {
  static contextType = AuthContext;
  state = {
    q: '', categoryId: '', city: '', categories: [], locations: [], jobs: null, tab: 'all', loading: false,
    total: 0, reviews: [], rating: null, plans: [], savedIds: new Set(),
  };

  async componentDidMount() {
    this.syncSaved();
    const [c, l, j, p] = await Promise.all([
      api.get('/categories'), api.get('/jobs/locations'), api.get(`/jobs?limit=${HOME_JOBS}`), api.get('/plans').catch(() => ({ data: [] })),
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

  componentDidUpdate() { this.syncSaved(); }

  // Tin đã lưu của sinh viên để tô tim trên thẻ việc
  syncSaved = () => {
    const u = this.context.user;
    const key = u?.role === 'STUDENT' ? u._id : null;
    if (key === this.savedFor) return;
    this.savedFor = key;
    if (key) loadSavedIds().then((savedIds) => this.setState({ savedIds }));
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
    this.props.navigate(`/jobs${qs({ q, categoryId, city })}`);
  };

  set = (k) => (e) => this.setState({ [k]: e.target.value });

  render() {
    const { q, categoryId, city, categories, locations, jobs, tab, loading, total, reviews, rating, plans } = this.state;
    const catName = Object.fromEntries(categories.map((c) => [c._id, c.name]));
    const user = this.context.user;
    // Sinh viên đã đăng nhập không vào được /employer/* (403) → dẫn sang đăng ký tài khoản nhà tuyển dụng
    const postJob = user?.role === 'EMPLOYER' ? '/employer/jobs/new' : '/register?role=EMPLOYER';
    // Ngành đang có tin, nhiều tin xếp trước (dùng cho chip ở hero và hàng ngành ②)
    const hiring = categories.filter((c) => c.jobCount > 0).sort((a, b) => b.jobCount - a.jobCount);
    const busiest = hiring.slice(0, 4);
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
          {/* ① Ca làm tuần này: lọc theo buổi, nối tiếp khung "Tuần của bạn" ở hero */}
          <section className="gn-sec" aria-labelledby="gn-jobs">
            <div className="gn-head gn-head-row">
              <div>
                <h2 id="gn-jobs" className="gn-h2">Ca làm tuần này</h2>
                <p>{total ? `${total} tin đang mở` : 'Tin mới nhất'} từ quán cà phê, trung tâm gia sư và cửa hàng gần trường.</p>
              </div>
              <Link to="/jobs#lich-hoc" className="btn btn-ghost"><CalendarDays size={18} aria-hidden="true" />Lọc theo lịch học của bạn</Link>
            </div>
            <div className="gn-tabs gn-tabs-left" role="tablist" aria-label="Buổi làm" onKeyDown={this.tabKey}>
              {TABS.map(([key, label]) => (
                <button key={key} id={`gn-tab-${key}`} role="tab" aria-selected={tab === key} aria-controls="gn-jobs-panel" tabIndex={tab === key ? 0 : -1}
                  className="gn-tab" onClick={() => this.loadTab(key)}>{label}</button>
              ))}
            </div>
            <div id="gn-jobs-panel" role="tabpanel" aria-labelledby={`gn-tab-${tab}`} aria-busy={loading}>
              {!jobs ? <Spinner /> : !jobs.length ? (
                <div className="gn-empty">
                  <p>{tab !== 'all' ? 'Chưa có ca nào vào buổi này. Thử buổi khác nhé.' : 'Chưa có tin tuyển dụng nào đang mở.'}</p>
                  {tab === 'all' && user?.role !== 'STUDENT' && <Link to={postJob} className="gn-link">Đăng tin tuyển dụng đầu tiên</Link>}
                </div>
              ) : (
                <ul className={`gn-jobs ${loading ? 'is-loading' : ''}`}>
                  {jobs.slice(0, HOME_JOBS).map((j) => <li key={j._id}>
                    <JobRow job={j} category={catName[j.categoryId]} badge={false} saved={this.state.savedIds.has(j._id)}
                      onSave={user?.role === 'STUDENT' ? this.toggleSave : undefined} saveHref={user ? undefined : `/login?next=${encodeURIComponent(`/jobs/${j._id}`)}`} />
                  </li>)}
                </ul>
              )}
            </div>
            <Link to="/jobs" className="gn-link gn-more">Xem tất cả {total || ''} việc làm</Link>
          </section>

          {/* ② Theo ngành: một hàng cuộn ngang, chỉ ngành đang có tin, nhiều tin xếp trước */}
          {hiring.length > 0 && (
            <section className="gn-sec-tight" aria-labelledby="gn-cats">
              <h2 id="gn-cats" className="gn-h3">Lương theo ngành</h2>
              <ul className="gn-cats">
                {hiring.map((c) => {
                  const Icon = categoryIcon(c.name);
                  return (
                    <li key={c._id}>
                      <Link to={`/jobs?categoryId=${c._id}`} className="gn-cat">
                        <Icon size={20} aria-hidden="true" />
                        <span className="gn-cat-text">
                          <strong>{c.name}</strong>
                          <span><span className="gn-pay">{salary(c.pay)}</span> {c.jobCount} việc</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
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
          {/* ④ Hai phía: mỗi ô một nhãn, tiêu đề, 3 bước, một dòng chi phí và một nút */}
          <section className="gn-sec" aria-labelledby="gn-who">
            <div className="gn-head">
              <h2 id="gn-who" className="gn-h2">Dành cho cả hai phía</h2>
              <p>Sinh viên tìm việc vừa lịch học, nhà tuyển dụng tìm người làm được ngay.</p>
            </div>
            <div className="gn-who">
              {[
                [GraduationCap, 'Sinh viên', 'Tìm việc không mất phí', STUDENT_STEPS, 'Miễn phí hoàn toàn cho sinh viên.',
                  <Link to={user?.role === 'STUDENT' ? '/student/profile' : '/register'} className="btn btn-lg">{user?.role === 'STUDENT' ? 'Hoàn thiện hồ sơ' : 'Tạo hồ sơ miễn phí'}</Link>],
                [Building2, 'Nhà tuyển dụng', 'Tuyển sinh viên trong vài ngày', EMPLOYER_STEPS,
                  `3 tin miễn phí, mỗi tin hiển thị 14 ngày.${plans.length ? ` Premium từ ${money(Math.min(...plans.map((p) => p.price)))} cho 20 tin.` : ''}`,
                  <Link to={postJob} className="btn btn-lg">Đăng tin tuyển dụng</Link>],
              ].map(([Icon, who, title, steps, note, cta]) => (
                <article key={who} className="gn-panel">
                  <span className="gn-pill"><Icon size={18} aria-hidden="true" />{who}</span>
                  <h3 className="gn-panel-title">{title}</h3>
                  <ol className="gn-steps">
                    {steps.map(([t, d], i) => <li key={t}><span className="gn-step-num">{i + 1}</span><div><strong>{t}</strong><span>{d}</span></div></li>)}
                  </ol>
                  <p className="gn-panel-note">{note}</p>
                  {cta}
                </article>
              ))}
            </div>
          </section>

          {/* ⑤ Đánh giá: điểm trung bình lớn bên trái, các câu đánh giá bên phải; ít hơn 3 câu thì ẩn */}
          {reviews.length >= 3 && rating && (
            <section className="gn-sec gn-voices" aria-labelledby="gn-voices">
              <div className="gn-score">
                <h2 id="gn-voices" className="gn-h2">Sinh viên nói gì sau ca làm</h2>
                <p className="gn-score-num">{rating1.format(rating.avg)}<span aria-hidden="true">★</span></p>
                <p>Trung bình từ {rating.count} đánh giá gần nhất của người đã làm xong việc.</p>
              </div>
              <ul className="gn-quotes">
                {reviews.map((r) => (
                  <li key={r._id}>
                    <figure className="gn-quote">
                      <blockquote>“{r.comment}”</blockquote>
                      <figcaption>
                        <span>{r.reviewerId?.fullName || 'Sinh viên'}</span>
                        <span role="img" aria-label={`${r.rating} trên 5 sao`}><Stars value={r.rating} /></span>
                      </figcaption>
                    </figure>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ⑥ FAQ một cột giữa trang */}
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

        {/* ⑦ Kết trang theo vai trò: sinh viên mở lịch học, nhà tuyển dụng đăng tin (nút cho nhà tuyển dụng đã có ở ④ với khách) */}
        <section className="gn-band" aria-labelledby="gn-end">
          {user?.role === 'EMPLOYER' ? (
            <>
              <h2 id="gn-end" className="gn-h2">Cần người cho ca làm tuần này?</h2>
              <p>Đăng tin kèm ca làm trong tuần để sinh viên có lịch học phù hợp tìm thấy bạn.</p>
              <Link to={postJob} className="btn btn-lg gn-btn-white">Đăng tin tuyển dụng</Link>
            </>
          ) : (
            <>
              <h2 id="gn-end" className="gn-h2">Tô lịch học, xem ngay ca hợp với bạn</h2>
              <p>Đánh dấu các buổi có tiết học, JobSV chỉ hiện việc còn ca rảnh và xếp việc hợp nhiều ca nhất lên đầu.</p>
              <Link to="/jobs#lich-hoc" className="btn btn-lg gn-btn-white">Mở lịch học</Link>
            </>
          )}
        </section>
      </>
    );
  }
}

export default withRouter(HomePage);
