import React, { Component } from 'react';
import { Bell, CircleCheck, CreditCard, Inbox, MailX, PartyPopper, Star, TriangleAlert } from 'lucide-react';
import { api, qs } from '../../api';
import { Empty, ErrorState, Alert, Pagination, Tabs } from '../../components/ui';
import { dateTime, timeAgo } from '../../utils/format';
import { param, intParam, setParams } from '../../utils/urlState';
import withRouter from '../../utils/withRouter';

const ICON = { NEW_APPLICATION: Inbox, APPLICATION_ACCEPTED: PartyPopper, APPLICATION_REJECTED: MailX, WORK_RESULT: CircleCheck, REVIEW_RECEIVED: Star, PAYMENT_SUCCESS: CreditCard, VIOLATION: TriangleAlert };
const TABS = [['', 'Tất cả'], ['unread', 'Chưa đọc']];

// Tab và trang nằm trên URL (?tab=unread&page=2) để Back / chia sẻ link hoạt động
class NotificationsPage extends Component {
  state = { items: null, meta: null, error: null, actionError: '', busy: false };
  reqId = 0;
  componentDidMount() { this.load(); }
  componentDidUpdate(prev) { if (prev.location.search !== this.props.location.search) this.load(); }
  componentWillUnmount() { this.reqId += 1; }

  tab = () => (param(this.props, 'tab') === 'unread' ? 'unread' : '');

  load = async () => {
    const id = ++this.reqId; // đổi tab nhanh thì bỏ phản hồi cũ
    this.setState({ items: null, error: null });
    try {
      const r = await api.get(`/notifications${qs({ page: intParam(this.props, 'page'), isRead: this.tab() === 'unread' ? 'false' : '' })}`);
      if (id === this.reqId) this.setState({ items: r.data, meta: r.meta });
    } catch (error) {
      if (id === this.reqId) this.setState({ error });
    }
  };

  open = async (n) => {
    this.setState({ actionError: '' });
    try {
      if (!n.isRead) await api.patch(`/notifications/${n._id}/read`);
    } catch (e) {
      this.setState({ actionError: `Không đánh dấu đã đọc được: ${e.message}` });
      return;
    }
    if (n.link) this.props.navigate(n.link);
    else this.load();
  };

  readAll = async () => {
    this.setState({ busy: true, actionError: '' });
    try {
      await api.patch('/notifications/read-all');
      this.load();
    } catch (e) {
      this.setState({ actionError: `Không đánh dấu tất cả đã đọc được: ${e.message}` });
    }
    this.setState({ busy: false });
  };

  render() {
    const { items, meta, error, actionError, busy } = this.state;
    const tab = this.tab();
    return (
      <div className="container page pub-notifs-page">
        <div className="pub-page-head">
          <h1 className="display">Thông báo</h1>
          <button type="button" className="btn btn-ghost btn-sm" onClick={this.readAll} disabled={busy}>{busy ? 'Đang xử lý…' : 'Đánh dấu tất cả đã đọc'}</button>
        </div>
        <div className="pub-notifs-tabs">
          <Tabs items={TABS} value={tab} label="Lọc thông báo" onChange={(t) => setParams(this.props, { tab: t, page: '' }, false)} />
        </div>
        <Alert>{actionError}</Alert>
        {error ? <div className="card"><ErrorState error={error} onRetry={this.load} title="Không tải được thông báo" /></div>
          : !items ? (
            <div role="status" aria-busy="true"><div className="sk sk-card" aria-hidden="true" /><span className="sr-only">Đang tải thông báo…</span></div>
          ) : !items.length ? (
            <div className="card"><Empty icon={Bell} title={tab === 'unread' ? 'Bạn đã đọc hết thông báo' : 'Chưa có thông báo nào'}>{tab === 'unread' ? 'Không còn thông báo chưa đọc.' : 'Thông báo về đơn ứng tuyển, đánh giá và thanh toán sẽ hiện ở đây.'}</Empty></div>
          ) : (
            <ul className="pub-notifs">
              {items.map((n) => {
                const Icon = ICON[n.type] || Bell;
                const body = (
                  <>
                    <span className="pub-notif-icon" aria-hidden="true"><Icon size={22} /></span>
                    <span className="pub-notif-body">
                      <span className="pub-notif-title">{!n.isRead && <span className="sr-only">Chưa đọc: </span>}{n.title}</span>
                      <span className="pub-notif-msg">{n.message}</span>
                    </span>
                    <time className="pub-notif-time" dateTime={new Date(n.createdAt).toISOString()} title={dateTime(n.createdAt)}>{timeAgo(n.createdAt)}</time>
                  </>
                );
                // Chỉ bấm được khi có việc để làm: mở link, hoặc đánh dấu đã đọc. Đã đọc và không có link thì chỉ là nội dung
                const actionable = n.link || !n.isRead;
                return (
                  <li key={n._id}>
                    {actionable
                      ? <button type="button" className={`pub-notif ${n.isRead ? '' : 'unread'}`} onClick={() => this.open(n)}>{body}</button>
                      : <div className="pub-notif static">{body}</div>}
                  </li>
                );
              })}
            </ul>
          )}
        <Pagination meta={meta} onPage={(page) => setParams(this.props, { page: page > 1 ? page : '' }, false)} />
      </div>
    );
  }
}

export default withRouter(NotificationsPage);
