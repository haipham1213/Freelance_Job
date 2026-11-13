import React, { Component } from 'react';
import { ArrowRight, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, JobBadge, Tabs, Pagination, Alert, ErrorState, ConfirmModal } from '../../components/ui';
import { date, salary, jobStatusOf, statusTabs, JOB_STATUS } from '../../utils/format';
import { param, intParam, setParams } from '../../utils/urlState';
import withRouter from '../../utils/withRouter';

const TABS = statusTabs(JOB_STATUS, ['OPEN', 'FILLED', 'CLOSED', 'EXPIRED', 'COMPLETED', 'HIDDEN']);

// SCR-E04 / FR-JOB-03, FR-JOB-04
class MyJobsPage extends Component {
  state = { items: null, meta: null, msg: '', error: '', loadError: null, busyId: '', confirm: null };
  req = 0;
  componentDidMount() {
    // JobFormPage điều hướng về đây kèm location.state.flash; đọc rồi xóa để tải lại trang không hiện lại
    const flash = this.props.location.state?.flash;
    if (flash) {
      this.setState({ msg: flash });
      this.props.navigate(`${this.props.location.pathname}${this.props.location.search}`, { replace: true, state: null });
    }
    this.load(true);
  }
  componentDidUpdate(prev) {
    if (prev.searchParams.toString() !== this.props.searchParams.toString()) this.load(true);
  }
  load = async (reset) => {
    const id = ++this.req;
    const page = intParam(this.props, 'page');
    if (reset) this.setState({ items: null, loadError: null });
    try {
      const r = await api.get(`/employers/me/jobs${qs({ status: param(this.props, 'tab'), page })}`);
      if (id !== this.req) return;
      // Xóa tin cuối cùng của trang sau thì lùi về trang 1
      if (!r.data.length && page > 1) return setParams(this.props, { page: 1 });
      this.setState({ items: r.data, meta: r.meta, loadError: null });
    } catch (loadError) {
      if (id === this.req) this.setState({ loadError, items: null });
    }
  };
  // Hành động không cần xác nhận (mở lại): khóa nút của tin đó khi đang gửi
  act = async (job, fn, msg) => {
    this.setState({ msg: '', error: '', busyId: job._id });
    try {
      await fn();
      this.setState({ msg: `${msg} “${job.title}”` });
      await this.load(false);
    } catch (e) {
      this.setState({ error: e.message });
    }
    this.setState({ busyId: '' });
  };
  // Hành động khó hoàn tác: ConfirmModal tự hiện lỗi trong hộp thoại nếu thất bại
  doConfirmed = async () => {
    const { job, kind } = this.state.confirm;
    if (kind === 'close') await api.patch(`/jobs/${job._id}/close`);
    else await api.del(`/jobs/${job._id}`);
    this.setState({ msg: `${kind === 'close' ? 'Đã đóng tin' : 'Đã xóa tin'} “${job.title}”`, error: '' });
    await this.load(false);
  };
  render() {
    const { items, meta, loadError, busyId, confirm } = this.state;
    const status = param(this.props, 'tab');
    return (
      <div className="container page">
        <header className="emp-head emp-mb16">
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">Tin tuyển dụng</h1>
            <p className="muted">{meta ? `${meta.total} tin. ` : ''}Theo dõi ứng viên, sửa, đóng hoặc mở lại tin.</p>
          </div>
          <Link to="/employer/jobs/new" className="btn"><Plus size={18} aria-hidden="true" />Đăng tin mới</Link>
        </header>
        <div className="emp-mb20"><Tabs items={TABS} value={status} onChange={(s) => setParams(this.props, { tab: s, page: '' }, false)} /></div>
        <div className="stack emp-mb16 emp-flash"><Alert type="ok">{this.state.msg}</Alert><Alert>{this.state.error}</Alert></div>
        {loadError ? <ErrorState error={loadError} onRetry={() => this.load(true)} /> : !items ? <Spinner /> : !items.length ? (
          <div className="card">
            {status
              ? <Empty title="Không có tin nào ở trạng thái này"><button type="button" className="accent" onClick={() => setParams(this.props, { tab: '', page: '' })}>Xem tất cả tin</button></Empty>
              : <Empty title="Chưa có tin nào"><Link to="/employer/jobs/new" className="accent ico-row emp-center">Đăng tin đầu tiên <ArrowRight size={16} aria-hidden="true" /></Link></Empty>}
          </div>
        ) : (
          <div className="emp-jobs">
            {items.map((j) => {
              const st = jobStatusOf(j);
              const busy = busyId === j._id;
              return (
                <article key={j._id} className="emp-job">
                  <div className="emp-job-art">
                    <strong>{j.applicationCount}</strong>
                    <span className="small">ứng viên</span>
                  </div>
                  <div className="emp-job-body">
                    <div className="row emp-gap8">
                      <JobBadge status={st} />
                      {j.counts.PENDING ? <span className="chip chip-yellow tiny">{j.counts.PENDING} đang chờ</span> : null}
                    </div>
                    <h2 className="h-sm"><Link to={`/jobs/${j._id}`}>{j.title}</Link></h2>
                    <div className="emp-meta small"><span className="hl">{salary(j)}</span><span>{j.viewCount} lượt xem</span><span>Đã nhận {j.acceptedCount}/{j.slots}</span><span>Từ chối {j.counts.REJECTED || 0}</span><span>Hết hạn {date(j.expiresAt)}</span></div>
                    {st === 'HIDDEN' && <div className="small emp-alert-text">Lý do: {j.hiddenReason}</div>}
                    <div className="row emp-actions">
                      <Link to={`/employer/jobs/${j._id}/applicants`} className="btn btn-sm btn-ghost">Ứng viên</Link>
                      {st !== 'HIDDEN' && <Link to={`/employer/jobs/${j._id}/edit`} className="btn btn-sm btn-ghost">Sửa</Link>}
                      {st === 'OPEN' && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => this.setState({ confirm: { job: j, kind: 'close' } })}>Đóng</button>}
                      {st === 'CLOSED' && <button type="button" className="btn btn-sm btn-ghost" disabled={busy} onClick={() => this.act(j, () => api.patch(`/jobs/${j._id}/reopen`), 'Đã mở lại tin')}>{busy ? 'Đang mở…' : 'Mở lại'}</button>}
                      {j.applicationCount === 0 && st !== 'HIDDEN' && <button type="button" className="btn btn-sm btn-ghost emp-danger" disabled={busy} onClick={() => this.setState({ confirm: { job: j, kind: 'delete' } })}>Xóa</button>}
                      {j.applicationCount > 0 && st !== 'HIDDEN' && <span className="fog tiny">Không xóa được vì đã có ứng viên. Hãy đóng tin nếu không tuyển nữa.</span>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <Pagination meta={meta} onPage={(n) => setParams(this.props, { page: n === 1 ? '' : n })} />
        {confirm && (
          <ConfirmModal
            title={confirm.kind === 'close' ? 'Đóng tin này?' : 'Xóa tin này?'}
            confirm={confirm.kind === 'close' ? 'Đóng tin' : 'Xóa tin'}
            danger
            onConfirm={this.doConfirmed}
            onClose={() => this.setState({ confirm: null })}
          >
            <p><strong>{confirm.job.title}</strong></p>
            <p className="muted">{confirm.kind === 'close' ? 'Các đơn đang chờ duyệt của tin này sẽ bị từ chối. Bạn có thể mở lại tin sau.' : 'Tin sẽ bị xóa vĩnh viễn và không khôi phục được.'}</p>
          </ConfirmModal>
        )}
      </div>
    );
  }
}

export default withRouter(MyJobsPage);
