import React, { Component } from 'react';
import { Check, CircleAlert, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Alert, PayBadge, Empty, Pagination } from '../../components/ui';
import { money, date, dateTime } from '../../utils/format';
import withRouter from '../../utils/withRouter';

const compare = ({ free, premium }) => [
  ['Số tin đang mở cùng lúc', `${free.quota}`, `${premium.quota}`],
  ['Thời gian hiển thị mỗi tin', `${free.days} ngày`, `${premium.days} ngày`],
  ['Ghim “Nổi bật” đầu kết quả tìm kiếm', 'Không', true],
  ['Huy hiệu Premium trên trang công ty', 'Không', true],
];

// SCR-E08 / FR-PAY-01, FR-PAY-03
class Premium extends Component {
  static contextType = AuthContext;
  state = { plans: null, tiers: null, error: '', busy: '' };
  async componentDidMount() {
    const r = await api.get('/plans');
    this.setState({ plans: r.data, tiers: r.meta.tiers });
  }
  buy = async (code) => {
    this.setState({ busy: code, error: '' });
    try {
      const { data } = await api.post('/payments', { planCode: code });
      this.props.navigate(`/employer/payments/result?paymentId=${data.paymentId}`); // trang chuyển sang cổng thanh toán SePay
    } catch (e) {
      this.setState({ error: e.message, busy: '' });
    }
  };
  render() {
    const { plans, tiers, error, busy } = this.state;
    const user = this.context.user;
    if (!plans) return <Spinner />;
    const COMPARE = compare(tiers);
    return (
      <div className="container page stack-lg">
        <div className="stack emp-premium-head">
          <span className="eyebrow eyebrow-dot">Gói dịch vụ</span>
          <h1 className="display">Nâng cấp Premium</h1>
          <p className="lede muted">Tuyển nhanh hơn với nhiều tin hơn và vị trí nổi bật.</p>
          {user.isPremium && <Alert type="ok">Bạn đang là Premium đến {date(user.employer?.premiumUntil)}. Mua thêm sẽ cộng dồn thời hạn.</Alert>}
          {!user.emailVerified && <Alert type="warn">Cần xác thực email trước khi thanh toán.</Alert>}
          <Link to="/employer/payments" className="small">Xem lịch sử giao dịch</Link>
        </div>
        <Alert>{error}</Alert>
        <div className="emp-plans">
          {plans.map((p, i) => (
            <div key={p._id} className={`emp-plan ${i > 0 ? 'panel' : ''}`}>
              {i > 0 && <span className="chip chip-featured emp-plan-tag">Tiết kiệm hơn</span>}
              <h2 className="h-md">{p.name}</h2>
              <div className="emp-price">{money(p.price)}</div>
              <div className="small muted">{p.durationDays} ngày, khoảng {money(Math.round(p.price / p.durationDays))}/ngày</div>
              <div className="eyebrow emp-perks-label">Bao gồm</div>
              <ul className="emp-perks">{COMPARE.map(([k, , b]) => <li key={k}><Check size={16} aria-hidden="true" />{b === true ? k : `${k}: ${b}`}</li>)}</ul>
              <button className={`btn btn-block ${i > 0 ? '' : 'btn-ghost'}`} disabled={!!busy || !user.emailVerified} onClick={() => this.buy(p.code)}>{busy === p.code ? 'Đang tạo giao dịch…' : 'Thanh toán qua SePay'}</button>
            </div>
          ))}
        </div>
        <h2 className="h-lg" style={{ marginTop: 32 }}>So sánh các gói</h2>
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Quyền lợi</th><th>Miễn phí</th><th>Premium</th></tr></thead>
            <tbody>{COMPARE.map(([k, a, b]) => <tr key={k}><td>{k}</td><td className="muted">{a}</td><td>{b === true ? <Check size={20} aria-label="Có" /> : b}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="fog small center">Thanh toán qua cổng SePay (chuyển khoản/QR ngân hàng), Premium tự kích hoạt ngay khi thanh toán thành công. Không hoàn tiền trong hệ thống.</p>
      </div>
    );
  }
}

// SCR-E09: nút chuyển sang cổng SePay; server chốt trạng thái khi SePay gọi IPN, trang chỉ hỏi lại mỗi 3 giây (FR-PAY-02 AC4)
class PaymentResult extends Component {
  static contextType = AuthContext;
  state = { payment: null, error: '' };
  componentDidMount() { this.poll(); }
  componentWillUnmount() { clearTimeout(this.timer); }
  poll = async () => {
    const sp = this.props.searchParams;
    const id = sp.get('paymentId') || sp.get('orderCode');
    try {
      const { data } = await api.get(`/payments/${id}`);
      this.setState({ payment: data.payment });
      // Chưa thấy tiền về: hỏi lại sau 3 giây cho tới khi thành công hoặc hết hạn
      if (data.payment.displayStatus === 'PENDING') this.timer = setTimeout(this.poll, 3000);
      else if (data.payment.status === 'SUCCESS') this.context.reloadUser();
    } catch (e) {
      this.setState({ error: e.message });
    }
  };
  render() {
    const { payment, error } = this.state;
    if (error) return <div className="container page"><Alert>{error}</Alert></div>;
    if (!payment) return <Spinner />;
    const s = payment.displayStatus;
    const waiting = s === 'PENDING' && this.props.searchParams.get('status') === 'success';
    const view = { SUCCESS: [Check, 'ok', 'Thanh toán thành công'], EXPIRED: [CircleAlert, '', 'Giao dịch đã hết hạn'], PENDING: [Clock, '', waiting ? 'Đang xác nhận thanh toán' : 'Chờ thanh toán'] }[s];
    const Icon = view[0];
    return (
      <div className="container page center stack-lg" style={{ maxWidth: 640 }}>
        <div className={`emp-result-icon ${view[1]}`}><Icon size={32} aria-hidden="true" /></div>
        <h1 className="display">{view[2]}</h1>
        {s === 'PENDING' && this.props.searchParams.get('status') === 'success' && (
          <div className="card stack center"><Spinner /><p className="muted">SePay báo thanh toán thành công, đang xác nhận và kích hoạt Premium…</p></div>
        )}
        {payment.checkout && this.props.searchParams.get('status') !== 'success' && (
          <form action={payment.checkout.url} method="POST" className="card stack" style={{ textAlign: 'left' }}>
            {Object.entries(payment.checkout.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            <button className="btn btn-block" type="submit">Thanh toán qua SePay</button>
            <p className="muted small">Bạn sẽ được chuyển sang trang thanh toán của SePay (quét mã QR ngân hàng). Premium tự kích hoạt khi SePay xác nhận, trang này tự cập nhật; giao dịch có hiệu lực đến {new Date(payment.expiresAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.</p>
          </form>
        )}
        <div className="card stack" style={{ textAlign: 'left' }}>
          <div className="row-between"><span className="muted">Gói</span><span>{payment.planSnapshot.name}</span></div>
          <div className="row-between"><span className="muted">Số tiền</span><span>{money(payment.amount)}</span></div>
          <div className="row-between"><span className="muted">Mã giao dịch</span><span>{payment.txnRef}</span></div>
          <div className="row-between"><span className="muted">Trạng thái</span><PayBadge status={s} /></div>
          {s === 'SUCCESS' && <div className="row-between"><span className="muted">Premium đến</span><span>{date(this.context.user?.employer?.premiumUntil)}</span></div>}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/employer" className="btn">Về Dashboard</Link>
          <Link to="/employer/premium" className="btn btn-ghost">Gói Premium</Link>
          <Link to="/employer/payments" className="btn btn-ghost">Lịch sử giao dịch</Link>
        </div>
      </div>
    );
  }
}
// SCR-E10: lịch sử giao dịch, mới nhất ở trên. Giao dịch còn chờ mở lại trang kết quả để tiếp tục thanh toán
class PaymentHistory extends Component {
  state = { items: null, meta: null, error: '' };
  componentDidMount() { this.load(1); }
  load = async (page) => {
    try {
      const r = await api.get(`/payments?page=${page}&limit=10`);
      this.setState({ items: r.data, meta: r.meta });
    } catch (e) {
      this.setState({ error: e.message });
    }
  };
  render() {
    const { items, meta, error } = this.state;
    if (error) return <div className="container page"><Alert>{error}</Alert></div>;
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
            <thead><tr><th>Ngày</th><th>Gói</th><th>Số tiền</th><th>Mã GD</th><th>Trạng thái</th><th /></tr></thead>
            <tbody>
              {items.map((p) => (
                <tr key={p._id}>
                  <td>{dateTime(p.createdAt)}</td>
                  <td>{p.planSnapshot.name}</td>
                  <td>{money(p.amount)}</td>
                  <td className="fog tiny">{p.txnRef}</td>
                  <td><PayBadge status={p.displayStatus} /></td>
                  <td><Link to={`/employer/payments/result?paymentId=${p._id}`}>Chi tiết</Link></td>
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

