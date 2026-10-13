import React, { Component } from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, AppBadge, Tabs, Pagination } from '../../components/ui';
import { date } from '../../utils/format';

const TABS = [['', 'Tất cả'], ['PENDING', 'Đang chờ'], ['ACCEPTED', 'Được nhận'], ['REJECTED', 'Bị từ chối'], ['COMPLETED,NOT_COMPLETED', 'Đã kết thúc'], ['WITHDRAWN', 'Đã rút']];

// SCR-S04 / FR-APP-03
export default class ApplicationsPage extends Component {
  state = { status: '', items: null, meta: null };
  componentDidMount() { this.load(1); }
  load = async (page) => {
    const r = await api.get(`/students/me/applications${qs({ status: this.state.status, page })}`);
    this.setState({ items: r.data, meta: r.meta });
  };
  render() {
    const { items, meta, status } = this.state;
    return (
      <div className="container page">
        <header className="stu-head">
          <div className="stu-head-text">
            <h1 className="display">Việc làm đã ứng tuyển</h1>
            <p className="muted">Theo dõi trạng thái mọi đơn ứng tuyển ở một nơi.</p>
          </div>
        </header>
        <Tabs items={TABS} value={status} onChange={(s) => this.setState({ status: s, items: null }, () => this.load(1))} />
        <div>
          {!items ? <Spinner /> : !items.length ? (
            <div className="card section"><Empty title="Không có đơn nào"><Link to="/jobs" className="accent ico-row" style={{ justifyContent: 'center' }}>Tìm việc ngay <ArrowRight size={16} /></Link></Empty></div>
          ) : (
            <div className="stu-list">
              {items.map((a) => (
                <Link key={a._id} to={`/student/applications/${a._id}`} className="stu-app">
                  <span className="logo-box">{(a.jobSnapshot.companyName || '?')[0]}</span>
                  <div className="stu-app-main">
                    <div className="h-sm stu-ellipsis stu-app-title">{a.jobSnapshot.title}</div>
                    <div className="muted small stu-ellipsis">{a.jobSnapshot.companyName}</div>
                    <div className="fog tiny">Nộp {date(a.createdAt)}, bắt đầu {date(a.jobSnapshot.startDate)}</div>
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
        <Pagination meta={meta} onPage={this.load} />
      </div>
    );
  }
}
