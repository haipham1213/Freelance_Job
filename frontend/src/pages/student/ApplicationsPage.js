import React, { Component } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, AppBadge, Tabs, Pagination, ErrorState } from '../../components/ui';
import { date, APP_STATUS, statusTabs } from '../../utils/format';
import { param, intParam, setParams } from '../../utils/urlState';
import withRouter from '../../utils/withRouter';

// Nhãn khớp badge; "Đã kết thúc" gộp COMPLETED + NOT_COMPLETED
const TABS = [...statusTabs(APP_STATUS, ['PENDING', 'ACCEPTED', 'REJECTED']), ['COMPLETED,NOT_COMPLETED', 'Đã kết thúc'], ...statusTabs(APP_STATUS, ['WITHDRAWN']).slice(1)];
const EMPTY = { '': 'Bạn chưa ứng tuyển việc nào.', PENDING: 'Không có đơn nào đang chờ.', ACCEPTED: 'Chưa có đơn nào được nhận.', REJECTED: 'Không có đơn nào bị từ chối.', 'COMPLETED,NOT_COMPLETED': 'Chưa có đơn nào đã kết thúc.', WITHDRAWN: 'Bạn chưa rút đơn nào.' };

// SCR-S04 / FR-APP-03
class ApplicationsPage extends Component {
  state = { items: null, meta: null, error: null };
  reqId = 0;
  get status() { const t = param(this.props, 'tab'); return TABS.some(([k]) => k === t) ? t : ''; }
  componentDidMount() { this.load(); }
  componentDidUpdate(prev) { if (prev.searchParams.toString() !== this.props.searchParams.toString()) this.load(); }
  componentWillUnmount() { this.reqId++; }
  load = async () => {
    const id = ++this.reqId;
    this.setState({ items: null, error: null });
    try {
      const r = await api.get(`/students/me/applications${qs({ status: this.status, page: intParam(this.props, 'page') })}`);
      if (id === this.reqId) this.setState({ items: r.data, meta: r.meta });
    } catch (error) {
      if (id === this.reqId) this.setState({ error });
    }
  };
  render() {
    const { items, meta, error } = this.state;
    const status = this.status;
    return (
      <div className="container page">
        <header className="stu-head">
          <div className="stu-head-text">
            <span className="eyebrow eyebrow-dot">Sinh viên</span>
            <h1 className="display">Việc làm đã ứng tuyển</h1>
            <p className="muted">Theo dõi trạng thái mọi đơn ứng tuyển ở một nơi.</p>
          </div>
        </header>
        <Tabs items={TABS} value={status} onChange={(s) => setParams(this.props, { tab: s, page: '' })} />
        <div>
          {error ? <ErrorState error={error} onRetry={this.load} /> : !items ? <Spinner /> : !items.length ? (
            <div className="card section"><Empty title="Không có đơn nào">
              <p>{EMPTY[status]}</p>
              {status ? <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams(this.props, { tab: '', page: '' })}>Xóa bộ lọc</button>
                : <Link to="/jobs" className="accent ico-row stu-center">Tìm việc ngay <ArrowRight size={16} aria-hidden="true" /></Link>}
            </Empty></div>
          ) : (
            <div className="stu-list">
              {items.map((a) => (
                <Link key={a._id} to={`/student/applications/${a._id}`} className="stu-app">
                  <span className="logo-box">{(a.jobSnapshot.companyName || '?')[0]}</span>
                  <div className="stu-app-main">
                    <div className="h-sm stu-ellipsis stu-app-title">{a.jobSnapshot.title}</div>
                    <div className="muted small stu-ellipsis">{a.jobSnapshot.companyName}</div>
                    <div className="fog tiny">Nộp {date(a.createdAt)}, cập nhật {date(a.updatedAt)}{a.jobSnapshot.startDate && `, bắt đầu ${date(a.jobSnapshot.startDate)}`}</div>
                  </div>
                  <div className="stu-app-side">
                    <AppBadge status={a.status} />
                    {(a.status === 'COMPLETED' || a.status === 'NOT_COMPLETED') && !a.reviewedByStudent && <div className="accent tiny">Chưa đánh giá</div>}
                  </div>
                  <ChevronRight className="stu-chev" size={20} aria-hidden="true" />
                </Link>
              ))}
            </div>
          )}
        </div>
        <Pagination meta={meta} onPage={(page) => setParams(this.props, { page: page > 1 ? page : '' })} />
      </div>
    );
  }
}

export default withRouter(ApplicationsPage);
