import React, { Component } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, JobBadge, Tabs, Pagination, Alert } from '../../components/ui';
import { date, salary, jobStatusOf } from '../../utils/format';

const TABS = [['', 'Tất cả'], ['OPEN', 'Đang tuyển'], ['FILLED', 'Đủ người'], ['CLOSED', 'Đã đóng'], ['EXPIRED', 'Hết hạn'], ['COMPLETED', 'Hoàn thành'], ['HIDDEN', 'Bị ẩn']];

// SCR-E04 / FR-JOB-03, FR-JOB-04
export default class MyJobsPage extends Component {
  state = { status: '', items: null, meta: null, msg: '', error: '' };
  componentDidMount() { this.load(1); }
  load = async (page = this.state.meta?.page || 1) => {
    const r = await api.get(`/employers/me/jobs${qs({ status: this.state.status, page })}`);
    this.setState({ items: r.data, meta: r.meta });
  };
  act = async (fn, msg) => {
    this.setState({ msg: '', error: '' });
    try {
      await fn();
      this.setState({ msg });
      this.load();
    } catch (e) {
      this.setState({ error: e.message });
    }
  };
  render() {
    const { items, meta, status } = this.state;
    return (
      <div className="container page">
        <header className="emp-head" style={{ marginBottom: 16 }}>
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">Tin tuyển dụng</h1>
            <p className="muted">{meta ? `${meta.total} tin. ` : ''}Theo dõi ứng viên, sửa, đóng hoặc mở lại tin.</p>
          </div>
          <Link to="/employer/jobs/new" className="btn"><Plus size={18} />Đăng tin mới</Link>
        </header>
        <div style={{ marginBottom: 20 }}><Tabs items={TABS} value={status} onChange={(s) => this.setState({ status: s, items: null }, () => this.load(1))} /></div>
        <div className="stack" style={{ marginBottom: 16 }}><Alert type="ok">{this.state.msg}</Alert><Alert>{this.state.error}</Alert></div>
        {!items ? <Spinner /> : !items.length ? (
          <div className="card"><Empty title="Chưa có tin nào"><Link to="/employer/jobs/new" className="accent ico-row" style={{ justifyContent: 'center' }}>Đăng tin đầu tiên <ArrowRight size={16} /></Link></Empty></div>
        ) : (
          <div className="emp-jobs">
            {items.map((j) => {
              const st = jobStatusOf(j);
              return (
                <article key={j._id} className="emp-job">
                  <div className="emp-job-art">
                    <strong>{j.applicationCount}</strong>
                    <span className="small">ứng viên</span>
                  </div>
                  <div className="emp-job-body">
                    <div className="row" style={{ gap: 8 }}>
                      <JobBadge status={st} />
                      {j.counts.PENDING ? <span className="chip chip-yellow tiny">{j.counts.PENDING} mới</span> : null}
                    </div>
                    <h2 className="h-sm"><Link to={`/jobs/${j._id}`}>{j.title}</Link></h2>
                    <div className="emp-meta small"><span className="hl">{salary(j)}</span><span>{j.viewCount} lượt xem</span><span>Đã nhận {j.acceptedCount}/{j.slots}</span><span>Chờ duyệt {j.counts.PENDING || 0}</span><span>Từ chối {j.counts.REJECTED || 0}</span><span>Hết hạn {date(j.expiresAt)}</span></div>
                    {st === 'HIDDEN' && <div className="small" style={{ color: 'var(--alert)' }}>Lý do: {j.hiddenReason}</div>}
                    <div className="row emp-actions">
                      <Link to={`/employer/jobs/${j._id}/applicants`} className="btn btn-sm btn-ghost">Ứng viên</Link>
                      {st !== 'HIDDEN' && <Link to={`/employer/jobs/${j._id}/edit`} className="btn btn-sm btn-ghost">Sửa</Link>}
                      {st === 'OPEN' && <button className="btn btn-sm btn-ghost" onClick={() => window.confirm('Đóng tin? Các đơn đang chờ sẽ bị từ chối.') && this.act(() => api.patch(`/jobs/${j._id}/close`), 'Đã đóng tin')}>Đóng</button>}
                      {st === 'CLOSED' && <button className="btn btn-sm btn-ghost" onClick={() => this.act(() => api.patch(`/jobs/${j._id}/reopen`), 'Đã mở lại tin')}>Mở lại</button>}
                      {j.applicationCount === 0 && st !== 'HIDDEN' && <button className="btn btn-sm btn-ghost emp-danger" onClick={() => window.confirm('Xóa tin này?') && this.act(() => api.del(`/jobs/${j._id}`), 'Đã xóa tin')}>Xóa</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <Pagination meta={meta} onPage={this.load} />
      </div>
    );
  }
}
