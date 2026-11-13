import React, { Component } from 'react';
import { Check, CircleAlert, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Alert, PayBadge, Empty, Pagination, ErrorState } from '../../components/ui';
import { money, date, dateTime } from '../../utils/format';
import withRouter from '../../utils/withRouter';

const compare = ({ free, premium }) => [
  ['Số tin đang mở cùng lúc', `${free.quota}`, `${premium.quota}`],
  ['Thời gian hiển thị mỗi tin', `${free.days} ngày`, `${premium.days} ngày`],
  ['Ghim “Nổi bật” đầu kết quả tìm kiếm', 'Không', true],
  ['Huy hiệu Premium trên trang công ty', 'Không', true],
];

// Gửi form đã ký sang cổng SePay (trình duyệt POST, không qua fetch)
const goCheckout = ({ url, fields }) => {
  const f = document.createElement('form');
  f.method = 'POST';
  f.action = url;
  Object.entries(fields).forEach(([k, v]) => {
    const i = document.createElement('input');
    i.type = 'hidden';
    i.name = k;
    i.value = v;
    f.appendChild(i);
  });
  document.body.appendChild(f);
  f.submit();
};

// SCR-E08 / FR-PAY-01, FR-PAY-03
class Premium extends Component {
  static contextType = AuthContext;
  state = { plans: null, tiers: null, error: '', loadError: null, busy: '', resend: '' };
  componentDidMount() { this.load(); }
  load = async () => {
    this.setState({ loadError: null });
    try {
      const r = await api.get('/plans');
      this.setState({ plans: r.data, tiers: r.meta.tiers });
    } catch (loadError) {
      this.setState({ loadError });
    }
  };
  // Tạo giao dịch rồi chuyển thẳng sang SePay; nếu không lấy được form thì mở trang kết quả để bấm thanh toán
  buy = async (code) => {
    this.setState({ busy: code, error: '' });
    let id;
    try {
      id = (await api.post('/payments', { planCode: code })).data.paymentId;
      const { checkout } = (await api.get(`/payments/${id}`)).data.payment;
      if (!checkout) throw new Error('Không có form thanh toán');
      goCheckout(checkout); // trang rời đi, giữ nút khóa
    } catch (e) {
      if (id) this.props.navigate(`/employer/payments/result?paymentId=${id}`);
      else this.setState({ error: e.message, busy: '' });
    }
  };
  // Giống VerifyBanner: gửi lại email xác thực ngay tại trang thanh toán
  resend = async () => {
    this.setState({ resend: 'sending' });
    try {
      await api.post('/auth/resend-verification', { email: this.context.user.email });
      this.setState({ resend: 'sent' });
    } catch (e) {
      this.setState({ resend: '', error: e.message });
    }
  };
  render() {
    const { plans, tiers, error, loadError, busy, resend } = this.state;
    const user = this.context.user;
    if (loadError) return <div className="container page"><ErrorState error={loadError} onRetry={this.load} /></div>;
    if (!plans) return <Spinner />;
    const COMPARE = compare(tiers);
    // "Tiết kiệm hơn" chỉ gắn cho gói có giá/ngày thấp nhất, và chỉ khi thật sự rẻ hơn gói khác
    const perDay = plans.map((p) => p.price / p.durationDays);
    const best = Math.min(...perDay);
    const cheaper = best < Math.max(...perDay) ? perDay.indexOf(best) : -1;
    return (
      <div className="container page stack-lg">
        <div className="stack emp-premium-head">
          <span className="eyebrow eyebrow-dot">Gói dịch vụ</span>
          <h1 className="display">Nâng cấp Premium</h1>
          <p className="lede muted">Tuyển nhanh hơn với nhiều tin hơn và vị trí nổi bật.</p>
          {user.isPremium && <Alert type="ok">Bạn đang là Premium đến {date(user.employer?.premiumUntil)}. Mua thêm sẽ cộng dồn thời hạn.</Alert>}
          {!user.emailVerified && (
            <Alert type="warn">
              Cần xác thực email trước khi thanh toán.{' '}
              {resend === 'sent' ? 'Đã gửi lại link, hãy kiểm tra hộp thư.' : <button type="button" className="btn btn-sm" onClick={this.resend} disabled={resend === 'sending'}>{resend === 'sending' ? 'Đang gửi…' : 'Gửi lại email xác thực'}</button>}
            </Alert>
          )}
          <Link to="/employer/payments" className="small">Xem lịch sử giao dịch</Link>
        </div>
        <Alert>{error}</Alert>
        <div className="emp-plans">
          {plans.map((p, i) => (
            <div key={p._id} className={`emp-plan ${i > 0 ? 'panel' : ''}`}>
              {i === cheaper && <span className="chip chip-featured emp-plan-tag">Tiết kiệm hơn</span>}
              <h2 className="h-md">{p.name}</h2>
              <div className="emp-price">{money(p.price)}</div>
              <div className="small muted">{p.durationDays} ngày, khoảng {money(Math.round(p.price / p.durationDays))}/ngày</div>
              <div className="eyebrow emp-perks-label">Bao gồm</div>
              <ul className="emp-perks">{COMPARE.map(([k, , b]) => <li key={k}><Check size={16} aria-hidden="true" />{b === true ? k : `${k}: ${b}`}</li>)}</ul>
              <button type="button" className={`btn btn-block ${i > 0 ? '' : 'btn-ghost'}`} disabled={!!busy || !user.emailVerified} onClick={() => this.buy(p.code)}>{busy === p.code ? 'Đang chuyển sang SePay…' : 'Thanh toán qua SePay'}</button>
            </div>
          ))}
        </div>
        <h2 className="h-lg emp-mt32">So sánh các gói</h2>
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th scope="col">Quyền lợi</th><th scope="col">Miễn phí</th><th scope="col">Premium</th></tr></thead>
            <tbody>{COMPARE.map(([k, a, b]) => <tr key={k}><td>{k}</td><td className="muted">{a}</td><td>{b === true ? <span role="img" aria-label="Có"><Check size={20} aria-hidden="true" /></span> : b}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="fog small center">Thanh toán qua cổng SePay (chuyển khoản/QR ngân hàng), Premium tự kích hoạt ngay khi thanh toán thành công. Gói đã mua không được hoàn tiền.</p>
      </div>
    );
  }
}

const SLOW_MS = 60000; // sau ngần này chưa thấy IPN thì thôi quay vòng, mời kiểm tra lại
const MAX_FAILS = 10; // số lần hỏi lỗi liên tiếp trước khi dừng

// SCR-E09: nút chuyển sang cổng SePay; server chốt trạng thái khi SePay gọi IPN, trang chỉ hỏi lại mỗi 3 giây (FR-PAY-02 AC4)
class PaymentResult extends Component {
  static contextType = AuthContext;
  state = { payment: null, error: '', fails: 0, submitting: false, stopped: false };
  started = Date.now();
  paymentId = () => this.props.searchParams.get('paymentId') || this.props.searchParams.get('orderCode');
  componentDidMount() {
    if (!this.paymentId()) return this.setState({ error: 'Thiếu mã giao dịch. Hãy mở lại từ lịch sử giao dịch.' });
    this.poll();
  }
  componentWillUnmount() { clearTimeout(this.timer); }
  // Người dùng quay về từ SePay với status=error|cancel: không cần hỏi liên tục
  failedReturn = () => ['error', 'cancel'].includes(this.props.searchParams.get('status'));
  poll = async () => {
    clearTimeout(this.timer);
    const waiting = this.props.searchParams.get('status') === 'success';
    try {
      const { data } = await api.get(`/payments/${this.paymentId()}`);
      if (data.payment.status === 'SUCCESS') await this.context.reloadUser().catch(() => {});
      this.setState({ payment: data.payment, fails: 0, error: '', stopped: false });
      // Chưa thấy tiền về: hỏi lại sau 3 giây cho tới khi thành công hoặc hết hạn
      if (data.payment.displayStatus !== 'PENDING' || this.failedReturn()) return;
      if (waiting && Date.now() - this.started > SLOW_MS) return this.setState({ stopped: true });
      this.timer = setTimeout(this.poll, 3000);
    } catch (e) {
      // Một lần lỗi mạng không làm mất trang: đã có dữ liệu thì thử lại, quá nhiều lần mới dừng
      const fails = this.state.fails + 1;
      if (!this.state.payment || fails >= MAX_FAILS) return this.setState({ error: e.message, fails });
      this.setState({ fails });
      this.timer = setTimeout(this.poll, 3000);
    }
  };
  recheck = () => {
    this.started = Date.now();
    this.setState({ error: '', stopped: false, fails: 0 }, this.poll);
  };
  render() {
    const { payment, error, fails, submitting, stopped } = this.state;
    if (error) {
      return (
        <div className="container page stack">
          <ErrorState error={error} onRetry={this.paymentId() ? this.recheck : undefined} />
          <div className="row emp-center"><Link to="/employer/payments" className="btn btn-ghost">Lịch sử giao dịch</Link></div>
        </div>
      );
    }
    if (!payment) return <Spinner />;
    const s = payment.displayStatus;
    const ret = this.props.searchParams.get('status');
    const waiting = s === 'PENDING' && ret === 'success';
    const failed = s === 'PENDING' && this.failedReturn();
    const view = {
      SUCCESS: [Check, 'ok', 'Thanh toán thành công'],
      EXPIRED: [CircleAlert, '', 'Giao dịch đã hết hạn'],
      PENDING: failed
        ? [CircleAlert, 'bad', ret === 'cancel' ? 'Bạn đã hủy thanh toán' : 'Thanh toán không thành công']
        : [Clock, '', waiting ? 'Đang xác nhận thanh toán' : 'Giao dịch đang xử lý'],
    }[s];
    const Icon = view[0];
    return (
      <div className="container page center stack-lg emp-narrow-sm">
        <div className="stack-lg" aria-live="polite">
          <div className={`emp-result-icon ${view[1]}`}><Icon size={32} aria-hidden="true" /></div>
          <h1 className="display">{view[2]}</h1>
          {failed && <p className="muted">{ret === 'cancel' ? 'Bạn chưa bị trừ tiền. Có thể thanh toán lại bên dưới khi giao dịch còn hiệu lực.' : 'SePay báo giao dịch không thành công. Nếu đã bị trừ tiền, hãy kiểm tra lại sau ít phút hoặc liên hệ hỗ trợ kèm mã giao dịch bên dưới.'}</p>}
          {waiting && !stopped && <div className="card stack center"><Spinner /><p className="muted">SePay báo thanh toán thành công, đang xác nhận và kích hoạt Premium…</p></div>}
          {waiting && stopped && (
            <div className="card stack center">
              <p className="muted">Chưa nhận được xác nhận từ SePay. Ngân hàng có thể đang xử lý, vui lòng kiểm tra lại sau ít phút. Nếu đã bị trừ tiền mà Premium chưa kích hoạt, hãy liên hệ hỗ trợ kèm mã giao dịch bên dưới.</p>
              <div><button type="button" className="btn" onClick={this.recheck}>Kiểm tra lại</button></div>
            </div>
          )}
          {fails > 0 && <Alert type="warn">Chưa kiểm tra được trạng thái giao dịch, đang thử lại…</Alert>}
        </div>
        {payment.checkout && ret !== 'success' && (
          <form action={payment.checkout.url} method="POST" className="card stack emp-left" onSubmit={() => this.setState({ submitting: true })}>
            {Object.entries(payment.checkout.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <button className="btn btn-block" type="submit" disabled={submitting}>{submitting ? 'Đang chuyển sang SePay…' : failed ? 'Thử thanh toán lại' : 'Thanh toán qua SePay'}</button>
            <p className="muted small">Bạn sẽ được chuyển sang trang thanh toán của SePay (quét mã QR ngân hàng). Premium tự kích hoạt khi SePay xác nhận, trang này tự cập nhật; giao dịch có hiệu lực đến {dateTime(payment.expiresAt)}.</p>
          </form>
        )}
        <div className="card stack emp-left">
          <div className="row-between"><span className="muted">Gói</span><span>{payment.planSnapshot.name}</span></div>
          <div className="row-between"><span className="muted">Số tiền</span><span>{money(payment.amount)}</span></div>
          <div className="row-between"><span className="muted">Mã giao dịch</span><span>{payment.txnRef}</span></div>
          <div className="row-between"><span className="muted">Trạng thái</span><PayBadge status={s} /></div>
          {s === 'SUCCESS' && <div className="row-between"><span className="muted">Premium đến</span><span>{date(this.context.user?.employer?.premiumUntil)}</span></div>}
        </div>
        <div className="row emp-center">
          <Link to="/employer" className="btn">Về trang tổng quan</Link>
          <Link to="/employer/premium" className="btn btn-ghost">Gói Premium</Link>
          <Link to="/employer/payments" className="btn btn-ghost">Lịch sử giao dịch</Link>
        </div>
      </div>
    );
  }
}
// SCR-E10: lịch sử giao dịch, mới nhất ở trên. Giao dịch còn chờ mở lại trang kết quả để tiếp tục thanh toán
class PaymentHistory extends Component {
  state = { items: null, meta: null, error: null };
  req = 0;
  componentDidMount() { this.load(1); }
  load = async (page = 1) => {
    const id = ++this.req;
    this.setState({ error: null });
    try {
      const r = await api.get(`/payments?page=${page}&limit=10`);
      if (id === this.req) this.setState({ items: r.data, meta: r.meta });
    } catch (error) {
      if (id === this.req) this.setState({ error });
    }
  };
  render() {
    const { items, meta, error } = this.state;
    if (error) return <div className="container page"><ErrorState error={error} onRetry={() => this.load(this.state.meta?.page || 1)} /></div>;
    if (!items) return <Spinner />;
    return (
      <div className="container page stack-lg">
        <header className="emp-head">
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">Lịch sử giao dịch</h1>
            <p className="muted">Các lần mua gói Premium của bạn.</p>
          </div>
          <Link to="/employer/premium" className="btn btn-ghost">Gói Premium</Link>
        </header>
        {items.length === 0 ? (
          <div className="card"><Empty title="Chưa có giao dịch nào"><Link to="/employer/premium" className="btn">Xem gói Premium</Link></Empty></div>
        ) : (
          <div className="card table-wrap"><table className="table">
            <thead><tr><th scope="col">Ngày</th><th scope="col">Gói</th><th scope="col">Số tiền</th><th scope="col">Mã GD</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr-only">Chi tiết</span></th></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p._id}>
                  <td>{dateTime(p.createdAt)}</td>
                  <td>{p.planSnapshot.name}</td>
                  <td>{money(p.amount)}</td>
                  <td className="fog tiny">{p.txnRef}</td>
                  <td><PayBadge status={p.displayStatus} /></td>
                  <td><Link to={`/employer/payments/result?paymentId=${p._id}`} aria-label={`Chi tiết giao dịch ${p.txnRef}`}>Chi tiết</Link></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <Pagination meta={meta} onPage={this.load} />
      </div>
    );
  }
}
export const PremiumPage = withRouter(Premium);
export const PaymentHistoryPage = PaymentHistory;
export const PaymentResultPage = withRouter(PaymentResult);

