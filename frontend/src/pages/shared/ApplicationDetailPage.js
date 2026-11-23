import React, { Component } from 'react';
import { Check, FileText, GraduationCap, Lock, Mail, Phone, Send, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, AppBadge, Stars, Avatar, CompanyLogo, Modal, ConfirmModal, Field, Alert, ReasonModal, BackLink, ErrorState } from '../../components/ui';
import ErrorPage from '../public/ErrorPage';
import { date, dateTime, APP_STATUS, salary, vnDay } from '../../utils/format';
import withRouter from '../../utils/withRouter';

// SCR-S06 / SCR-E07: chấm 1–5 sao, nhận xét ≤ 500 ký tự
class ReviewModal extends Component {
  state = { rating: 0, comment: '', error: '', busy: false };
  submit = async (e) => {
    e.preventDefault();
    if (!this.state.rating) return this.setState({ error: 'Vui lòng chọn số sao' });
    this.setState({ busy: true, error: '' });
    try {
      await api.post(`/applications/${this.props.appId}/reviews`, { rating: this.state.rating, comment: this.state.comment || undefined });
      this.props.onDone();
    } catch (err) {
      this.setState({ error: err.message, busy: false });
    }
  };
  render() {
    return (
      <Modal title={`Đánh giá ${this.props.name}`} onClose={this.props.onClose} busy={this.state.busy} dirty={!!this.state.rating || !!this.state.comment.trim()}>
        <form className="stack" onSubmit={this.submit}>
          <div className="center" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" role="radio" aria-checked={n === this.state.rating} key={n} className={`star-btn ${n <= this.state.rating ? 'on' : ''}`} onClick={() => this.setState({ rating: n, error: '' })} aria-label={`${n} sao`}><span aria-hidden="true">★</span></button>
            ))}
          </div>
          <Field label="Nhận xét (không bắt buộc)">
            <textarea className="textarea" name="comment" maxLength={500} value={this.state.comment} onChange={(e) => this.setState({ comment: e.target.value })} />
          </Field>
          <p className="fog tiny">Đánh giá không sửa hoặc xóa được sau khi gửi.</p>
          <Alert>{this.state.error}</Alert>
          <button className="btn" disabled={this.state.busy}>{this.state.busy ? 'Đang gửi…' : 'Gửi đánh giá'}</button>
        </form>
      </Modal>
    );
  }
}

// FR-MSG-01: trò chuyện theo đơn, hỏi tin mới định kỳ (không dùng WebSocket).
// Hỏi chậm dần khi không có gì mới: 4 → 7 → 10 giây (trễ tối đa 10 giây); có tin mới, vừa gửi hoặc quay lại tab thì về 4 giây. Tab ẩn thì không hỏi
const POLL = [4000, 7000, 10000];
class Chat extends Component {
  state = { items: [], canSend: false, waitEmployer: false, seenId: null, hasMore: false, older: false, text: '', err: '', busy: false, loaded: false, loadErr: '' };
  list = React.createRef();
  step = 0;

  componentDidMount() {
    this.dead = false; // StrictMode (dev) gỡ rồi gắn lại cùng instance: phải xóa cờ của lần gỡ
    this.fetch();
    document.addEventListener('visibilitychange', this.onVisible);
  }
  componentDidUpdate(prev) {
    // Bấm thông báo tin nhắn khi đang ở đúng trang này: URL không đổi nhưng location.key đổi → tải ngay + cuộn tới khung
    if (prev.ping !== this.props.ping) this.fetch(true).then(this.reveal);
  }
  componentWillUnmount() { clearTimeout(this.timer); this.dead = true; document.removeEventListener('visibilitychange', this.onVisible); }

  // Hẹn lần hỏi kế tiếp; active = vừa có hoạt động → quay về nhịp nhanh nhất
  schedule = (active) => {
    clearTimeout(this.timer);
    if (this.dead) return;
    this.step = active ? 0 : Math.min(this.step + 1, POLL.length - 1);
    this.timer = setTimeout(() => (document.hidden ? this.schedule(false) : this.fetch()), POLL[this.step]);
  };
  onVisible = () => { if (!document.hidden && this.state.loaded) this.fetch(true); };

  // Link thông báo / email có #chat thì cuộn tới khung tin nhắn và đặt con trỏ vào ô nhập
  reveal = () => {
    if (this.dead || window.location.hash !== '#chat') return;
    const el = document.getElementById('chat');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('chat-text')?.focus({ preventScroll: true });
  };

  // Chỉ xin máy chủ những gì còn thiếu: "Đã xem" khi tin cuối của mình chưa được xem, bỏ kiểm tra BR-47 khi đã thấy tin của nhà tuyển dụng
  query = () => {
    const { items, seenId } = this.state;
    const last = items[items.length - 1];
    if (!last) return '';
    const me = String(this.props.me);
    const lastMine = [...items].reverse().find((m) => String(m.senderId) === me);
    const p = new URLSearchParams({ after: last.createdAt });
    if (lastMine && String(lastMine._id) !== String(seenId)) p.set('seen', '1');
    if (items.some((m) => String(m.senderId) === String(this.props.employerId))) p.set('started', '1');
    return `?${p}`;
  };

  fetch = async (active = false) => {
    const first = !this.state.loaded;
    let fresh = [];
    try {
      const r = await api.get(`/applications/${this.props.appId}/messages${this.query()}`);
      if (this.dead) return;
      const known = new Set(this.state.items.map((m) => m._id));
      fresh = r.data.filter((m) => !known.has(m._id));
      this.setState((s) => ({
        items: fresh.length ? [...s.items, ...fresh] : s.items,
        canSend: r.meta.canSend, waitEmployer: !!r.meta.waitEmployer, loaded: true, loadErr: '',
        ...('seenId' in r.meta && { seenId: r.meta.seenId }),
        ...(first && { hasMore: !!r.meta.hasMore }),
      }), () => {
        if (fresh.length) this.toBottom();
        if (first) this.reveal();
      });
    } catch (e) {
      // Lần đầu lỗi thì báo ra; các lần hỏi sau lỗi mạng tạm thời thì bỏ qua, lần kế tiếp thử lại
      if (!this.dead && !this.state.loaded) this.setState({ loadErr: e.message || 'Không tải được tin nhắn' });
    }
    this.schedule(active || fresh.length > 0);
  };

  // "Xem tin cũ hơn": chèn lên đầu danh sách, giữ nguyên vị trí đang đọc
  loadOlder = async () => {
    const el = this.list.current;
    const oldest = this.state.items[0];
    if (!oldest || this.state.older) return;
    this.setState({ older: true, err: '' });
    try {
      const r = await api.get(`/applications/${this.props.appId}/messages?before=${encodeURIComponent(oldest.createdAt)}`);
      if (this.dead) return;
      const keep = el ? el.scrollHeight - el.scrollTop : 0;
      this.setState((s) => ({ items: [...r.data, ...s.items], hasMore: !!r.meta.hasMore, older: false }), () => {
        if (el) el.scrollTop = el.scrollHeight - keep;
      });
    } catch (e) {
      if (!this.dead) this.setState({ older: false, err: `Không tải được tin cũ hơn: ${e.message}` });
    }
  };

  toBottom = () => { const el = this.list.current; if (el) el.scrollTop = el.scrollHeight; };

  send = async (e) => {
    e.preventDefault();
    const text = this.state.text.trim();
    if (!text || this.state.busy) return;
    this.setState({ busy: true, err: '' });
    try {
      await api.post(`/applications/${this.props.appId}/messages`, { text });
      this.setState({ text: '' });
      await this.fetch(true);
    } catch (err) {
      this.setState({ err: err.message });
      if (err.code === 'CHAT_CLOSED') this.setState({ canSend: false });
    } finally {
      this.setState({ busy: false });
    }
  };

  render() {
    const { items, canSend, seenId, hasMore, older, text, err, busy, loaded, loadErr } = this.state;
    const { waitEmployer } = this.state;
    if (loaded && !canSend && !waitEmployer && !items.length) return null;
    const me = String(this.props.me);
    return (
      <section className="card stack pub-app-card chat-card" id="chat" aria-labelledby="chat-h">
        <h2 className="h-md" id="chat-h">Tin nhắn với {this.props.name}</h2>
        {!loaded && (loadErr ? <Alert>Không tải được tin nhắn: {loadErr}</Alert> : <p className="fog small">Đang tải tin nhắn…</p>)}
        {loaded && <ol className="chat-list" ref={this.list} aria-live="polite">
          {hasMore && (
            <li className="chat-older">
              <button type="button" className="btn btn-ghost btn-sm" onClick={this.loadOlder} disabled={older}>{older ? 'Đang tải…' : 'Xem tin cũ hơn'}</button>
            </li>
          )}
          {items.length === 0 && !waitEmployer && <li className="fog small chat-empty">Chưa có tin nhắn. Hãy hỏi thêm về công việc, giờ làm hoặc lịch phỏng vấn.</li>}
          {items.map((m) => {
            const mine = String(m.senderId) === me;
            return (
              <li key={m._id} className={`chat-msg ${mine ? 'mine' : ''}`}>
                <p className="pre">{m.text}</p>
                <span className="tiny">{dateTime(m.createdAt)}{mine && String(m._id) === String(seenId) && ' · Đã xem'}</span>
              </li>
            );
          })}
        </ol>}
        {!loaded ? null : canSend ? (
          <form className="chat-form" onSubmit={this.send}>
            <label className="sr-only" htmlFor="chat-text">Nội dung tin nhắn</label>
            <textarea id="chat-text" className="textarea" rows={2} maxLength={1000} value={text} placeholder="Nhập tin nhắn…"
              onChange={(e) => this.setState({ text: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) this.send(e); }} />
            <button className="btn" disabled={busy || !text.trim()}><Send size={18} aria-hidden="true" /> Gửi</button>
          </form>
        ) : waitEmployer ? (
          // BR-47: khóa có giải thích để sinh viên không tưởng là lỗi
          <div className="chat-locked" role="note">
            <Lock size={20} aria-hidden="true" />
            <div>
              <div className="h-sm">Chờ nhà tuyển dụng nhắn tin trước</div>
              <p className="muted small">Để tránh làm phiền, chỉ nhà tuyển dụng mới bắt đầu được cuộc trò chuyện. Khi họ nhắn, bạn sẽ nhận thông báo và email, rồi trả lời ngay tại đây.</p>
            </div>
          </div>
        ) : <p className="fog small">Đơn đã kết thúc, bạn chỉ xem lại được tin nhắn.</p>}
        <Alert>{err}</Alert>
      </section>
    );
  }
}

class ApplicationDetailPage extends Component {
  static contextType = AuthContext;
  state = { data: null, error: null, modal: null, note: '', msg: '', err: '', busy: false };
  reqId = 0;

  componentDidMount() { this.load(); }
  // Đang xem đơn A, bấm thông báo của đơn B: cùng route nên component không gắn lại → phải tự tải đơn mới
  componentDidUpdate(prev) { if (prev.params.id !== this.props.params.id) { this.setState({ data: null, msg: '', err: '', note: '' }); this.load(); } }
  componentWillUnmount() { this.reqId++; }
  load = async () => {
    const id = ++this.reqId;
    this.setState({ error: null });
    try {
      const r = await api.get(`/applications/${this.props.params.id}`);
      if (id === this.reqId) this.setState({ data: r.data, modal: null });
    } catch (error) {
      if (id === this.reqId) this.setState({ error });
    }
  };

  // Thực hiện hành động rồi tải lại; lỗi ném tiếp để modal xác nhận tự hiện
  run = async (fn, msg) => {
    this.setState({ busy: true, msg: '', err: '' });
    try {
      await fn();
      await this.load();
      this.setState({ msg });
    } finally {
      this.setState({ busy: false });
    }
  };

  // Nút bấm trực tiếp (không qua modal): lỗi hiện ở Alert
  act = (fn, msg) => this.run(fn, msg).catch((e) => this.setState({ err: e.message }));

  employerActions(app, job) {
    const id = app._id;
    if (app.status === 'PENDING')
      return (
        <div className="stack">
          <Field label="Ghi chú hướng dẫn khi nhận (ngày giờ, người liên hệ…)">
            <textarea className="textarea" maxLength={500} value={this.state.note} onChange={(e) => this.setState({ note: e.target.value })} placeholder="VD: Đến chi nhánh lúc 17h45 ngày 15/10, gặp chị Hà" />
          </Field>
          <div className="row">
            <button className="btn" disabled={this.state.busy} onClick={() => this.setState({ modal: 'accept' })}><Check size={18} aria-hidden="true" /> Nhận</button>
            <button className="btn btn-ghost" disabled={this.state.busy} onClick={() => this.setState({ modal: 'reject' })}>Từ chối</button>
          </div>
        </div>
      );
    if (app.status === 'ACCEPTED') {
      // So theo ngày giờ VN như server (BR-29): startDate lưu 00:00 UTC = 7h sáng VN, so thời điểm sẽ khóa nút từ 0h–7h ngày bắt đầu
      const started = vnDay(job.startDate) <= vnDay();
      return (
        <div className="stack">
          <p className="muted small">Xác nhận kết quả sau khi công việc bắt đầu ({date(job.startDate)}).</p>
          <div className="row">
            <button className="btn" disabled={!started || this.state.busy} onClick={() => this.act(() => api.patch(`/applications/${id}/result`, { result: 'COMPLETED' }), 'Đã xác nhận hoàn thành')}><Check size={18} aria-hidden="true" /> Hoàn thành</button>
            <button className="btn btn-ghost" disabled={!started || this.state.busy} onClick={() => this.setState({ modal: 'notCompleted' })}>Không hoàn thành</button>
          </div>
        </div>
      );
    }
    return null;
  }

  render() {
    const { data, error, modal, msg, err } = this.state;
    if (error && !data) return [403, 404].includes(error.status) ? <ErrorPage code={error.status} message={error.message} /> : <div className="container page"><ErrorState error={error} onRetry={this.load} /></div>;
    if (!data) return <Spinner />;
    const { application: app, job, student, employer, reviews, canReview, reviewDeadline } = data;
    const reasonOf = (h) => h.reason || (h.status === 'REJECTED' && app.rejectReason) || (h.status === 'NOT_COMPLETED' && app.notCompletedReason) || '';
    const role = this.context.user.role;
    const isEmployer = role === 'EMPLOYER';
    const other = isEmployer ? student : employer;
    const contactOpen = ['ACCEPTED', 'COMPLETED', 'NOT_COMPLETED'].includes(app.status);
    return (
      <div className="container page">
        <BackLink to={isEmployer ? `/employer/jobs/${app.jobId}/applicants` : '/student/applications'}>{isEmployer ? 'Danh sách ứng viên' : 'Đơn của tôi'}</BackLink>
        {/* Logo / avatar chỉ hiện ở thẻ bên phải, đầu trang chỉ còn công việc */}
        <header className="stu-app-hero pub-app-head">
          <div className="stu-hero-main">
            <div className="row stu-gap10">
              <AppBadge status={app.status} />
              <span className="fog small">Nộp lúc {dateTime(app.createdAt)}</span>
            </div>
            <h1 className="display"><Link to={`/jobs/${app.jobId}`} className="stu-detail-title">{app.jobSnapshot.title}</Link></h1>
            <p className="muted">{app.jobSnapshot.companyName}{job && `, ${salary(job)}, bắt đầu ${date(job.startDate)}`}</p>
          </div>
          <a href={app.cvUrl} target="_blank" rel="noreferrer" className="btn btn-ghost"><FileText size={18} aria-hidden="true" /> Xem CV đã nộp<span className="sr-only"> (mở tab mới)</span></a>
        </header>
        <div className="layout-main pub-app">
          <div className="stack-lg">
            <div className="card stack pub-app-card">
              {app.coverLetter && <div className="card-sm card-white"><div className="fog small">Thư giới thiệu</div><p className="pre">{app.coverLetter}</p></div>}
              {app.employerNote && <Alert type="ok"><strong>Hướng dẫn từ nhà tuyển dụng:</strong> {app.employerNote}</Alert>}
              {app.rejectReason && <Alert>Lý do từ chối: {app.rejectReason}</Alert>}
              {app.notCompletedReason && <Alert>Lý do không hoàn thành: {app.notCompletedReason}</Alert>}
              <Alert>{err}</Alert>
              <Alert type="ok">{msg}</Alert>
              {isEmployer ? this.employerActions(app, job) : app.status === 'PENDING' && (
                <button className="btn btn-ghost stu-self-start" disabled={this.state.busy} onClick={() => this.setState({ modal: 'withdraw' })}>Rút đơn</button>
              )}
              {!app.coverLetter && !app.employerNote && !app.rejectReason && !app.notCompletedReason && !msg && !(isEmployer ? ['PENDING', 'ACCEPTED'] : ['PENDING']).includes(app.status) && (
                <p className="muted">Không có thao tác nào cần làm với đơn này.</p>
              )}
            </div>
            <Chat key={app._id} appId={app._id} employerId={app.employerId} ping={this.props.location.key} me={this.context.user._id} name={isEmployer ? student.fullName : employer.company?.name || app.jobSnapshot.companyName} />
            <div className="card pub-app-card">
              <h2 className="h-md">Lịch sử trạng thái</h2>
              <ol className="stu-timeline">
                {app.statusHistory.map((h, i) => (
                  <li key={i}><span className="h-sm">{APP_STATUS[h.status]?.[0]}</span><span className="fog small">{dateTime(h.at)}</span>{reasonOf(h) && <span className="muted small">Lý do: {reasonOf(h)}</span>}</li>
                ))}
              </ol>
            </div>
            {(reviews.length > 0 || canReview) && (
              <div className="card stack pub-app-card">
                <h2 className="h-md">Đánh giá</h2>
                {reviews.map((r) => (
                  <div key={r._id} className="card-sm card-white">
                    <div className="small">{r.reviewerRole === 'STUDENT' ? 'Sinh viên' : 'Nhà tuyển dụng'} đánh giá <Stars value={r.rating} /></div>
                    {r.comment && <p className="muted small">{r.comment}</p>}
                  </div>
                ))}
                {canReview && (
                  <div className="row-between">
                    <span className="muted small">Hạn đánh giá: {date(reviewDeadline)}</span>
                    <button className="btn" onClick={() => this.setState({ modal: 'review' })}><Star size={18} aria-hidden="true" /> Đánh giá {isEmployer ? 'sinh viên' : 'nhà tuyển dụng'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <aside className="card stack pub-app-side" aria-label={isEmployer ? 'Ứng viên' : 'Nhà tuyển dụng'}>
            <h2 className="h-md">{isEmployer ? 'Ứng viên' : 'Nhà tuyển dụng'}</h2>
            <div className="row stu-nowrap">
              {isEmployer ? <Avatar src={student.avatarUrl} name={student.fullName} size="lg" /> : <CompanyLogo src={employer.company?.logoUrl} />}
              <div className="stu-min0">
                <div className="h-sm">{isEmployer ? student.fullName : employer.company?.name}</div>
                <Stars value={other.ratingAvg} count={other.ratingCount} />
              </div>
            </div>
            {isEmployer && student.student && (
              <div className="stack small">
                {student.student.school && <div className="ico-row"><GraduationCap size={16} aria-hidden="true" />{student.student.school}{student.student.major && `, ${student.student.major}`}{student.student.yearOfStudy && `, năm ${student.student.yearOfStudy}`}</div>}
                {student.student.skills?.length > 0 && <div className="row stu-gap6">{student.student.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
                {student.student.bio && <p className="muted pre">{student.student.bio}</p>}
              </div>
            )}
            {!isEmployer && <Link to={`/employers/${employer._id}`} className="btn btn-ghost btn-sm stu-self-start">Trang công ty</Link>}
            <div className="stu-contact">
              <h3 className="h-sm">Liên hệ</h3>
              {contactOpen ? (
                <div className="stack small stu-contact-open">
                  <div className="ico-row"><Mail size={16} aria-hidden="true" /><a href={`mailto:${other.email}`}>{other.email}</a></div>
                  {other.phone && <div className="ico-row"><Phone size={16} aria-hidden="true" /><a href={`tel:${other.phone}`}>{other.phone}</a></div>}
                </div>
              ) : <p className="pub-app-locked muted small"><Lock size={16} aria-hidden="true" />Email và số điện thoại hiện khi đơn được nhận.</p>}
            </div>
          </aside>
        </div>
        {modal === 'review' && <ReviewModal appId={app._id} name={isEmployer ? student.fullName : employer.company?.name} onClose={() => this.setState({ modal: null })} onDone={() => { this.load(); this.setState({ modal: null, msg: 'Cảm ơn bạn đã đánh giá!', err: '' }); }} />}
        {modal === 'accept' && (
          <ConfirmModal title="Nhận ứng viên này?" confirm="Nhận ứng viên" onClose={() => this.setState({ modal: null })}
            onConfirm={() => this.run(() => api.patch(`/applications/${app._id}/accept`, { employerNote: this.state.note || undefined }), 'Đã nhận ứng viên')}>
            <p>Ứng viên sẽ được báo ngay và thấy thông tin liên hệ của bạn cùng ghi chú hướng dẫn. Thao tác này không hoàn tác được.</p>
          </ConfirmModal>
        )}
        {modal === 'withdraw' && (
          <ConfirmModal title="Rút đơn ứng tuyển?" confirm="Rút đơn" danger onClose={() => this.setState({ modal: null })}
            onConfirm={() => this.run(() => api.patch(`/applications/${app._id}/withdraw`), 'Đã rút đơn')}>
            <p>Nhà tuyển dụng sẽ không còn xem đơn này nữa và bạn không thể hoàn tác. Muốn quay lại, bạn phải ứng tuyển lại từ đầu (nếu tin còn tuyển).</p>
          </ConfirmModal>
        )}
        {modal === 'reject' && (
          <ReasonModal title="Từ chối ứng viên" label="Lý do (không bắt buộc, sinh viên sẽ thấy)" confirm="Từ chối" danger onClose={() => this.setState({ modal: null })}
            onSubmit={(reason) => this.run(() => api.patch(`/applications/${app._id}/reject`, { reason: reason || undefined }), 'Đã từ chối ứng viên')} />
        )}
        {modal === 'notCompleted' && (
          <ReasonModal title="Không hoàn thành công việc" required confirm="Xác nhận" danger onClose={() => this.setState({ modal: null })}
            onSubmit={(reason) => this.run(() => api.patch(`/applications/${app._id}/result`, { result: 'NOT_COMPLETED', reason }), 'Đã ghi nhận không hoàn thành')} />
        )}
      </div>
    );
  }
}

export default withRouter(ApplicationDetailPage);
