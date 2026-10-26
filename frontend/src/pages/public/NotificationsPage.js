import React, { Component } from 'react';
import { Bell, CircleCheck, CreditCard, Inbox, MailX, PartyPopper, Star, TriangleAlert } from 'lucide-react';
import { api, qs } from '../../api';
import { Spinner, Empty, Pagination, Tabs } from '../../components/ui';
import { dateTime } from '../../utils/format';
import withRouter from '../../utils/withRouter';

const ICON = { NEW_APPLICATION: Inbox, APPLICATION_ACCEPTED: PartyPopper, APPLICATION_REJECTED: MailX, WORK_RESULT: CircleCheck, REVIEW_RECEIVED: Star, PAYMENT_SUCCESS: CreditCard, VIOLATION: TriangleAlert };

class NotificationsPage extends Component {
  state = { items: null, meta: null, filter: '' };
  componentDidMount() { this.load(1); }
  load = async (page) => {
    const r = await api.get(`/notifications${qs({ page, isRead: this.state.filter })}`);
    this.setState({ items: r.data, meta: r.meta });
  };
  open = async (n) => {
    if (!n.isRead) await api.patch(`/notifications/${n._id}/read`);
    if (n.link) this.props.navigate(n.link);
    else this.load(this.state.meta.page);
  };
  readAll = async () => { await api.patch('/notifications/read-all'); this.load(1); };
  render() {
    const { items, meta, filter } = this.state;
    return (
      <div className="container page pub-notifs-page">
        <div className="pub-page-head">
          <h1 className="display">Thông báo</h1>
          <button className="btn btn-ghost btn-sm" onClick={this.readAll}>Đánh dấu tất cả đã đọc</button>
        </div>
        <div className="pub-notifs-tabs">
          <Tabs items={[['', 'Tất cả'], ['false', 'Chưa đọc']]} value={filter} onChange={(f) => this.setState({ filter: f, items: null }, () => this.load(1))} />
        </div>
        {!items ? <Spinner /> : !items.length ? <div className="card"><Empty title="Không có thông báo" /></div> : (
          <div className="pub-notifs">
            {items.map((n) => (
              <button key={n._id} className={`pub-notif ${n.isRead ? '' : 'unread'}`} onClick={() => this.open(n)}>
                <span className="pub-notif-icon" aria-hidden="true">{React.createElement(ICON[n.type] || Bell, { size: 22 })}</span>
                <div className="pub-notif-body">
                  <div className="pub-notif-title">{n.title}</div>
                  <div className="pub-notif-msg">{n.message}</div>
                </div>
                <span className="pub-notif-time">{dateTime(n.createdAt)}</span>
              </button>
            ))}
          </div>
        )}
        <Pagination meta={meta} onPage={this.load} />
      </div>
    );
  }
}

export default withRouter(NotificationsPage);
