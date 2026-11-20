import React, { Component } from 'react';
import { Flag, Star } from 'lucide-react';
import { api } from '../api';
import { Avatar, CompanyLogo, Empty, ErrorState, Pagination, Stars } from './ui';
import ReportModal from './ReportModal';
import { timeAgo, dateTime } from '../utils/format';

// Đánh giá người khác dành cho mình (FR-REV-02), dùng ở Hồ sơ sinh viên và Hồ sơ công ty. Đánh giá bị Admin ẩn không hiện.
// Mỗi đánh giá có nút Khiếu nại (BR-48); đã khiếu nại thì hiện trạng thái thay cho nút
export default class ReviewsReceived extends Component {
  state = { items: null, meta: null, error: null, complaints: {}, complain: null };
  box = React.createRef();
  componentDidMount() { this.dead = false; this.load(1); this.loadComplaints(); } // StrictMode (dev) gỡ rồi gắn lại cùng instance
  componentWillUnmount() { this.dead = true; }
  load = async (page) => {
    this.setState({ error: null });
    try {
      const r = await api.get(`/users/${this.props.userId}/reviews?page=${page}&limit=5`);
      if (this.dead) return;
      // Pagination chung cuộn lên đầu trang; đổi trang ở đây thì đưa mục đánh giá trở lại khung nhìn
      this.setState({ items: r.data, meta: r.meta }, () => this.paged && this.box.current?.scrollIntoView({ block: 'start' }));
    } catch (error) {
      if (!this.dead) this.setState({ error });
    }
  };

  // Không tải được thì chỉ mất trạng thái khiếu nại, nút vẫn bấm được (server chặn khiếu nại trùng)
  loadComplaints = () => api.get('/reports/mine?targetType=REVIEW')
    .then((r) => !this.dead && this.setState({ complaints: Object.fromEntries(r.data.map((x) => [x.targetId, x.status])) }))
    .catch(() => {});

  render() {
    const { items, meta, error, complaints, complain } = this.state;
    const fromEmployer = this.props.role === 'STUDENT';
    return (
      <section ref={this.box} className="card stack rcv" aria-labelledby="rcv-h">
        <div className="row-between">
          <h2 className="h-md" id="rcv-h">Đánh giá về bạn</h2>
          {meta?.ratingCount > 0 && <Stars value={meta.ratingAvg} count={meta.ratingCount} />}
        </div>
        {error ? <ErrorState error={error} title="Không tải được đánh giá" onRetry={() => this.load(meta?.page || 1)} />
          : !items ? <div className="sk sk-card" aria-hidden="true" />
          : !items.length ? (
            <Empty icon={Star} title="Chưa có đánh giá nào">
              {fromEmployer ? 'Sau mỗi công việc hoàn thành, nhà tuyển dụng có 14 ngày để đánh giá bạn.' : 'Sinh viên đánh giá công ty trong 14 ngày sau khi công việc kết thúc.'}
            </Empty>
          ) : (
            <ul className="rcv-list">
              {items.map((r) => {
                const who = r.reviewerId;
                const company = who?.employer?.company;
                const name = (company?.name || who?.fullName) || (fromEmployer ? 'Nhà tuyển dụng' : 'Sinh viên');
                return (
                  <li key={r._id} className="rcv-item">
                    {company ? <CompanyLogo src={company.logoUrl} name={name} /> : <Avatar src={who?.avatarUrl} name={name} />}
                    <div className="rcv-body">
                      <div className="row-between">
                        <span className="h-sm">{name}</span>
                        <time className="fog tiny" dateTime={new Date(r.createdAt).toISOString()} title={dateTime(r.createdAt)}>{timeAgo(r.createdAt)}</time>
                      </div>
                      <Stars value={r.rating} />
                      {r.jobId?.title && <div className="muted small">{r.jobId.title}</div>}
                      {r.comment ? <p className="pre">{r.comment}</p> : <p className="fog small">Không có nhận xét</p>}
                      {complaints[r._id] === 'OPEN' ? <span className="chip chip-yellow rcv-state">Đang chờ xử lý khiếu nại</span>
                        : complaints[r._id] ? <span className="chip rcv-state">Khiếu nại không được chấp nhận</span>
                        : <button type="button" className="btn-link small rcv-complain" onClick={() => this.setState({ complain: r._id })}>
                          <Flag size={14} aria-hidden="true" /> Khiếu nại<span className="sr-only"> đánh giá của {name}</span>
                        </button>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        <Pagination meta={meta} onPage={(n) => { this.paged = true; this.load(n); }} />
        {complain && <ReportModal targetType="REVIEW" targetId={complain} onDone={this.loadComplaints} onClose={() => this.setState({ complain: null })} />}
      </section>
    );
  }
}
