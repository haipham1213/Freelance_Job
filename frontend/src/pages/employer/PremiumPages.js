import React, { Component } from 'react';
import { Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Alert, PayBadge, Empty, Pagination } from '../../components/ui';
import { Mascot } from '../../components/Illustrations';
import { money, date, dateTime } from '../../utils/format';
import withRouter from '../../utils/withRouter';

const COMPARE = [
  ['Số tin đang mở cùng lúc', '3', '20'],
  ['Thời gian hiển thị mỗi tin', '14 ngày', '30 ngày'],
  ['Ghim “Nổi bật” đầu kết quả tìm kiếm', 'Không', true],
  ['Huy hiệu Premium trên trang công ty', 'Không', true],
];

// SCR-E08 / FR-PAY-01, FR-PAY-03
export class PremiumPage extends Component {
  static contextType = AuthContext;
  state = { plans: null, error: '', busy: '' };
  async componentDidMount() { this.setState({ plans: (await api.get('/plans')).data }); }
  buy = async (code) => {
    this.setState({ busy: code, error: '' });
    try {
      const { data } = await api.post('/payments', { planCode: code });
      window.location.href = data.paymentUrl; // chuyển sang VNPay
    } catch (e) {
      this.setState({ error: e.message, busy: '' });
    }
  };
  render() {
    const { plans, error, busy } = this.state;
    const user = this.context.user;
    if (!plans) return <Spinner />;
    return (
      <div className="container page stack-lg">
        <div className="card center stack emp-premium-head">
          <Mascot kind="flower" size={64} />
          <h1 className="display">Nâng cấp Premium</h1>
          <p className="muted">Tuyển nhanh hơn với nhiều tin hơn và vị trí nổi bật.</p>
          {user.isPremium && <Alert type="ok">Bạn đang là Premium đến {date(user.employer?.premiumUntil)}. Mua thêm sẽ cộng dồn thời hạn.</Alert>}
          {!user.emailVerified && <Alert type="warn">Cần xác thực email trước khi thanh toán.</Alert>}
        </div>
        <Alert>{error}</Alert>
        <div className="emp-plans">
          {plans.map((p, i) => (
            <div key={p._id} className={`emp-plan ${i > 0 ? 'emp-plan-best' : ''}`}>
              {i > 0 && <span className="chip chip-featured emp-plan-tag">Tiết kiệm hơn</span>}
              <h2 className="h-md">{p.name}</h2>
              <div className="emp-price">{money(p.price)}</div>
              <div className="small muted">{p.durationDays} ngày, khoảng {money(Math.round(p.price / p.durationDays))}/ngày</div>
              <ul className="emp-perks">{COMPARE.map(([k, , b]) => <li key={k}>{b === true ? k : `${k}: ${b}`}</li>)}</ul>
              <button className={`btn btn-block ${i > 0 ? '' : 'btn-ghost'}`} disabled={!!busy || !user.emailVerified} onClick={() => this.buy(p.code)}>{busy === p.code ? 'Đang chuyển sang VNPay…' : 'Thanh toán qua VNPay'}</button>
            </div>
          ))}
        </div>
        <h2 className="h-lg" style={{ marginTop: 32 }}>So sánh các gói</h2>
        <div className="card table-wrap">
          <table className="table">
            <thead><tr><th>Quyền lợi</th><th>Miễn phí</th><th className="accent">Premium</th></tr></thead>
            <tbody>{COMPARE.map(([k, a, b]) => <tr key={k}><td>{k}</td><td className="muted">{a}</td><td className="accent">{b === true ? <Check size={20} aria-label="Có" /> : b}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="fog small center">Thanh toán qua cổng VNPay (môi trường thử nghiệm). Không hoàn tiền trong hệ thống.</p>
      </div>
    );
  }
}

// SCR-E09 / FR-PAY-04: chỉ đọc trạng thái từ DB; IPN mới là nơi kích hoạt Premium
class PaymentResult extends Component {
  static contextType = AuthContext;
  state = { payment: null, error: '', tries: 0 };
  componentDidMount() { this.poll(); }
  componentWillUnmount() { clearTimeout(this.timer); }
  poll = async () => {
    const sp = this.props.searchParams;
    const id = sp.get('paymentId') || sp.get('vnp_TxnRef');
    try {
      const { data } = await api.get(`/payments/${id}`);
      this.setState({ payment: data.payment });
      // IPN chưa tới: hỏi lại sau 3 giây, tối đa 5 lần
      if (data.payment.displayStatus === 'PENDING' && this.state.tries < 5) {
        this.setState({ tries: this.state.tries + 1 });
        this.timer = setTimeout(this.poll, 3000);
      } else if (data.payment.status === 'SUCCESS') this.context.reloadUser();
    } catch (e) {
      this.setState({ error: e.message });
    }
  };
  render() {
    const { payment, error } = this.state;
    if (error) return <div className="container page"><Alert>{error}</Alert></div>;
    if (!payment) return <Spinner />;
    const s = payment.displayStatus;
    const view = { SUCCESS: ['flower', 'Thanh toán thành công'], FAILED: ['cloud', 'Thanh toán không thành công'], EXPIRED: ['triangle', 'Giao dịch đã hết hạn'], PENDING: ['blob', 'Đang xử lý giao dịch…'] }[s];
    return (
      <div className="container page center stack-lg" style={{ maxWidth: 640 }}>
        <div className="emp-result-art"><Mascot kind={view[0]} size={80} /></div>
        <h1 className="display">{view[1]}</h1>
        <div className="card stack" style={{ textAlign: 'left' }}>
          <div className="row-between"><span className="muted">Gói</span><span>{payment.planSnapshot.name}</span></div>
          <div className="row-between"><span className="muted">Số tiền</span><span>{money(payment.amount)}</span></div>
          <div className="row-between"><span className="muted">Mã giao dịch</span><span>{payment.txnRef}</span></div>
          <div className="row-between"><span className="muted">Trạng thái</span><PayBadge status={s} /></div>
          {s === 'SUCCESS' && <div className="row-between"><span className="muted">Premium đến</span><span>{date(this.context.user?.employer?.premiumUntil)}</span></div>}
        </div>
        {s === 'PENDING' && <p className="muted small">Nếu trạng thái chưa cập nhật, hãy tải lại trang sau ít phút.</p>}
        <div className="row" style={{ justifyContent: 'center' }}>
          <Link to="/employer" className="btn">Về Dashboard</Link>
          <Link to="/employer/payments" className="btn btn-ghost">Lịch sử giao dịch</Link>
        </div>
      </div>
    );
  }
}
export const PaymentResultPage = withRouter(PaymentResult);

// SCR-E10
export class PaymentsPage extends Component {
  state = { items: null, meta: null };
  componentDidMount() { this.load(1); }
  load = async (page) => {
    const r = await api.get(`/employers/me/payments?page=${page}`);
    this.setState({ items: r.data, meta: r.meta });
  };
  render() {
    const { items, meta } = this.state;
    return (
      <div className="container page">
        <header className="card emp-head">
          <div>
            <h1 className="display">Lịch sử giao dịch</h1>
            <p className="muted">Các lần thanh toán gói Premium qua VNPay.</p>
          </div>
          <Link to="/employer/premium" className="btn">Mua Premium</Link>
        </header>
        <div style={{ marginTop: 20 }}>
          {!items ? <Spinner /> : !items.length ? <div className="card"><Empty title="Chưa có giao dịch" /></div> : (
            <div className="card table-wrap">
              <table className="table">
                <thead><tr><th>Thời gian</th><th>Gói</th><th>Số tiền</th><th>Mã giao dịch</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {items.map((p) => (
                    <tr key={p._id}><td>{dateTime(p.createdAt)}</td><td>{p.planSnapshot.name}</td><td>{money(p.amount)}</td><td className="fog">{p.txnRef}</td><td><PayBadge status={p.displayStatus} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <Pagination meta={meta} onPage={this.load} />
      </div>
    );
  }
}
