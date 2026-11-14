import React, { Component } from 'react';
import { ArrowRight, BriefcaseBusiness, Building2, Check, FileText, Flag, Percent, Search, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, ErrorState, Pagination, Tabs, Alert, ReasonModal, ConfirmModal, JobBadge, PayBadge, Stars, Field, Modal } from '../../components/ui';
import { money, shortMoney, date, dateTime, ROLE, REPORT_REASONS, JOB_STATUS, PAY_STATUS, statusTabs, jobStatusOf } from '../../utils/format';
import { param, intParam, setParams } from '../../utils/urlState';
import withRouter from '../../utils/withRouter';

// 12 tháng gần nhất dạng YYYY-MM cho bộ lọc giao dịch (tính lúc dùng, không chốt lúc tải module)
const monthOptions = () => Array.from({ length: 12 }, (_, i) => {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
});

// Mức xử lý báo cáo: mã gửi lên API giữ nguyên (V1–V3), giao diện chỉ hiện tên dễ hiểu
const LEVEL = { V1: 'Cảnh cáo', V2: 'Ẩn nội dung', V3: 'Khóa tài khoản' };
const DASH = '—';

// Tiêu đề trang quản trị: gọn, tiêu đề + mô tả một dòng + hành động bên phải
const Head = ({ title, sub, children }) => (
  <div className="adm-head">
    <div className="adm-head-main">
      <span className="eyebrow eyebrow-dot">Quản trị</span>
      <h1 className="adm-title">{title}</h1>
      {sub && <p className="muted adm-sub">{sub}</p>}
    </div>
    {children}
  </div>
);

// Ô tìm: type=search + nút Tìm, giá trị nằm trên URL
class SearchBox extends Component {
  state = { v: this.props.value };
  componentDidUpdate(prev) { if (prev.value !== this.props.value) this.setState({ v: this.props.value }); }
  render() {
    return (
      <form className="adm-search-form" role="search" onSubmit={(e) => { e.preventDefault(); this.props.onSearch(this.state.v.trim()); }}>
        <label className="adm-search">
          <Search size={16} aria-hidden="true" />
          <input type="search" placeholder={this.props.placeholder} aria-label={this.props.label} value={this.state.v} onChange={(e) => this.setState({ v: e.target.value })} />
        </label>
        <button className="btn btn-sm">Tìm</button>
      </form>
    );
  }
}

// Khung chung cho các trang danh sách có lọc + phân trang. Tab/tìm/bộ lọc/trang nằm trên URL (bọc withRouter khi export)
class ListPage extends Component {
  keys = [];
  defaults = {};
  noun = 'dữ liệu';
  tableLabel = 'Danh sách';
  state = { items: null, meta: null, modal: null, msg: '', error: '', loadError: '' };
  req = 0;
  timer = null;
  getF = () => Object.fromEntries(this.keys.map((k) => [k, param(this.props, k, this.defaults[k] || '')]));
  query = (f) => f;
  componentDidMount() { this.load(); }
  componentDidUpdate(prev) {
    if (prev.searchParams.toString() !== this.props.searchParams.toString()) { this.setState({ items: null }); this.load(); }
  }
  componentWillUnmount() { clearTimeout(this.timer); this.req++; }
  load = async () => {
    const id = ++this.req;
    this.setState({ loadError: '' });
    try {
      const r = await api.get(`${this.endpoint}${qs({ ...this.query(this.getF()), page: intParam(this.props, 'page') })}`);
      if (id === this.req) this.setState({ items: r.data, meta: r.meta });
    } catch (e) {
      if (id === this.req) this.setState({ loadError: e.message || 'Không tải được dữ liệu' });
    }
  };
  setF = (patch) => setParams(this.props, { ...patch, page: '' });
  goPage = (n) => setParams(this.props, { page: n > 1 ? n : '' });
  clearFilters = () => setParams(this.props, { ...Object.fromEntries(this.keys.map((k) => [k, ''])), page: '' });
  hasFilter = () => { const f = this.getF(); return this.keys.some((k) => f[k] !== (this.defaults[k] || '')); };
  // Thao tác trong hộp thoại: lỗi ném lại để hộp thoại tự hiện
  act = async (fn, msg) => {
    this.setState({ msg: '', error: '' });
    await fn();
    this.say(msg);
    await this.load();
  };
  // Thao tác bấm thẳng trên dòng: lỗi hiện ở vùng thông báo
  quick = async (fn, msg) => {
    try { await this.act(fn, msg); } catch (e) { this.setState({ error: e.message }); }
  };
  say = (msg) => { clearTimeout(this.timer); this.setState({ msg }); this.timer = setTimeout(() => this.setState({ msg: '' }), 6000); };
  closeModal = () => this.setState({ modal: null });
  toast() {
    return <div className="adm-toast"><Alert type="ok">{this.state.msg}</Alert><Alert>{this.state.error}</Alert></div>;
  }
  body(items = this.state.items) {
    const { meta, loadError } = this.state;
    if (loadError) return <div className="card"><ErrorState error={loadError} onRetry={this.load} /></div>;
    return (
      <>
        {this.toast()}
        {!items ? <Spinner /> : !items.length
          ? <div className="card"><Empty title={this.hasFilter() ? `Không có ${this.noun} phù hợp` : `Chưa có ${this.noun}`}>
            {this.hasFilter() && <button type="button" className="btn btn-ghost btn-sm" onClick={this.clearFilters}>Xóa bộ lọc</button>}
          </Empty></div>
          : <div className="card adm-table-card table-wrap" tabIndex={0} role="region" aria-label={this.tableLabel}>{this.table(items)}</div>}
        <Pagination meta={meta} onPage={this.goPage} />
      </>
    );
  }
}

// SCR-A01 / FR-ADM-01
class DashboardPage extends Component {
  state = { d: null, error: '' };
  req = 0;
  componentDidMount() { this.load(); }
  componentWillUnmount() { this.req++; }
  load = async () => {
    const id = ++this.req;
    this.setState({ error: '' });
    try {
      const r = await api.get('/admin/dashboard');
      if (id === this.req) this.setState({ d: r.data });
    } catch (e) {
      if (id === this.req) this.setState({ error: e.message || 'Không tải được số liệu' });
    }
  };
  render() {
    const { d, error } = this.state;
    if (error) return <ErrorState error={error} onRetry={this.load} />;
    if (!d) return <Spinner />;
    const max = Math.max(...d.revenueByMonth.map((m) => m.total), 1);
    const total = d.revenueByMonth.reduce((a, m) => a + m.total, 0);
    const stats = [
      ['Người dùng', (d.users.STUDENT || 0) + (d.users.EMPLOYER || 0), `${d.users.STUDENT || 0} sinh viên, ${d.users.EMPLOYER || 0} nhà tuyển dụng`, Users, '/admin/users'],
      ['Tin đang tuyển', d.openJobs, 'Đang hiển thị công khai', BriefcaseBusiness, '/admin/jobs'],
      ['Đơn 30 ngày', d.applications30d, 'Đơn ứng tuyển mới', FileText],
      ['Tỷ lệ được nhận', `${d.acceptRate}%`, 'Trong 30 ngày', Percent],
      ['Báo cáo chờ xử lý', d.openReports, 'Cần xem xét', Flag, '/admin/reports'],
      ['Doanh thu 12 tháng', shortMoney(total), 'Gói Premium', Wallet, '/admin/payments'],
    ];
    const chartLabel = `Doanh thu Premium theo tháng. ${d.revenueByMonth.map((m) => `Tháng ${+m.month.slice(5)}/${m.month.slice(0, 4)}: ${money(m.total)}, ${m.count} giao dịch`).join('; ')}.`;
    return (
      <div className="stack-lg">
        <Head title="Tổng quan hệ thống" sub="Số liệu người dùng, tin tuyển dụng và doanh thu Premium." />
        <div className="adm-stats">
          {stats.map(([k, v, sub, Icon, to]) => {
            const inner = <><span className="adm-stat-ico"><Icon size={20} aria-hidden="true" /></span><div><div className="adm-stat-label">{k}</div><div className="adm-stat-num">{v}</div><div className="tiny fog">{sub}</div></div></>;
            return to ? <Link key={k} to={to} className="adm-stat adm-stat-link">{inner}</Link> : <div key={k} className="adm-stat">{inner}</div>;
          })}
        </div>
        <div className="card stack adm-chart">
          <div className="row-between">
            <h2 className="h-md">Doanh thu Premium theo tháng</h2>
            <span className="chip">{shortMoney(total)} / 12 tháng</span>
          </div>
          <div className="bar-chart" role="img" aria-label={chartLabel}>
            {d.revenueByMonth.map((m) => (
              <div key={m.month} title={`${m.month}: ${money(m.total)} (${m.count} giao dịch)`}>
                <span className="fog tiny">{m.total ? shortMoney(m.total) : ''}</span>
                <div className="bar" style={{ height: `${(m.total / max) * 100}%` }} />
                <span className="fog tiny">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
}
export const AdminDashboardPage = DashboardPage;

// SCR-A02 / FR-ADM-02 (+ FR-ADM-08 kích hoạt Premium thủ công)
class UsersList extends ListPage {
  endpoint = '/admin/users';
  keys = ['q', 'role', 'status'];
  noun = 'người dùng';
  tableLabel = 'Danh sách người dùng';
  state = { ...this.state, plans: [], plansError: '' };
  componentDidMount() {
    super.componentDidMount();
    this.loadPlans();
  }
  loadPlans = async () => {
    try { this.setState({ plans: (await api.get('/admin/plans')).data, plansError: '' }); } catch (e) { this.setState({ plansError: e.message }); }
  };
  table(items) {
    return (
      <table className="table">
        <thead><tr><th scope="col">Người dùng</th><th scope="col">Vai trò</th><th scope="col">Email xác thực</th><th scope="col">Điểm</th><th scope="col">Ngày tạo</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>
          {items.map((u) => (
            <tr key={u._id}>
              <td><div>{u.fullName}</div><div className="fog tiny">{u.email}</div>{u.employer?.company?.name && <div className="tiny ico-row"><Building2 size={14} aria-hidden="true" />{u.employer.company.name}{u.isPremium && <span className="accent"> ★ Premium</span>}</div>}</td>
              <td>{ROLE[u.role]}</td>
              <td>{u.emailVerified ? <><Check size={18} role="img" aria-label="Đã xác thực" /></> : <span className="fog">Chưa</span>}</td>
              <td>{u.ratingCount ? `${u.ratingAvg}★ (${u.ratingCount})` : <span className="fog">{DASH}</span>}</td>
              <td>{date(u.createdAt)}</td>
              <td>
                {u.status === 'LOCKED' ? <span className="chip chip-red">Bị khóa</span> : <span className="chip chip-green">Hoạt động</span>}
                {u.status === 'LOCKED' && u.lockReason && <div className="fog tiny adm-reason">Lý do: {u.lockReason}</div>}
              </td>
              <td>
                {u.role !== 'ADMIN' && (
                  <div className="row adm-actions">
                    {u.status === 'LOCKED'
                      ? <button className="btn btn-sm btn-ghost" aria-label={`Mở khóa ${u.email}`} onClick={() => this.quick(() => api.patch(`/admin/users/${u._id}/unlock`), `Đã mở khóa ${u.email}`)}>Mở khóa</button>
                      : <button className="btn btn-sm btn-ghost adm-danger" aria-label={`Khóa ${u.email}`} onClick={() => this.setState({ modal: { type: 'lock', u } })}>Khóa</button>}
                    {u.role === 'EMPLOYER' && u.status === 'ACTIVE' && <button className="btn btn-sm btn-ghost" aria-label={`Cộng Premium cho ${u.email}`} onClick={() => this.setState({ modal: { type: 'premium', u } })}>+ Premium</button>}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const f = this.getF();
    const { modal, plans, plansError } = this.state;
    return (
      <div>
        <Head title="Người dùng" sub="Khóa hoặc mở khóa tài khoản và kích hoạt Premium thủ công." />
        <div className="adm-toolbar">
          <SearchBox value={f.q} label="Tìm người dùng" placeholder="Tìm theo email hoặc tên" onSearch={(q) => this.setF({ q })} />
          <select className="pill-select" aria-label="Lọc theo vai trò" value={f.role} onChange={(e) => this.setF({ role: e.target.value })}>
            <option value="">Mọi vai trò</option><option value="STUDENT">{ROLE.STUDENT}</option><option value="EMPLOYER">{ROLE.EMPLOYER}</option><option value="ADMIN">{ROLE.ADMIN}</option>
          </select>
          <select className="pill-select" aria-label="Lọc theo trạng thái tài khoản" value={f.status} onChange={(e) => this.setF({ status: e.target.value })}>
            <option value="">Mọi trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Bị khóa</option>
          </select>
        </div>
        {this.body()}
        {modal?.type === 'lock' && (
          // BR-38: khóa → đăng xuất ngay, mất Premium còn lại
          <ReasonModal title={`Khóa ${modal.u.email}`} required danger confirm="Khóa tài khoản" onClose={this.closeModal}
            onSubmit={(reason) => this.act(() => api.patch(`/admin/users/${modal.u._id}/lock`, { reason }), `Đã khóa ${modal.u.email}`)}>
            <p className="muted small">Người dùng bị đăng xuất ngay, không đăng nhập lại được và mất thời hạn Premium còn lại. Bạn có thể mở khóa sau, nhưng Premium đã mất không tự khôi phục.</p>
          </ReasonModal>
        )}
        {modal?.type === 'premium' && <PremiumModal u={modal.u} plans={plans} plansError={plansError} onRetry={this.loadPlans} onClose={this.closeModal} onSubmit={(body) => this.act(() => api.post(`/admin/employers/${modal.u._id}/premium`, body), `Đã kích hoạt Premium cho ${modal.u.fullName}`)} />}
      </div>
    );
  }
}
export const UsersPage = withRouter(UsersList);

class PremiumModal extends Component {
  state = { planCode: this.props.plans[0]?.code || '', reason: '', error: '', busy: false };
  submit = async (e) => {
    e.preventDefault();
    if (this.state.busy) return; // chống bấm đúp cộng dồn Premium
    this.setState({ busy: true, error: '' });
    try {
      await this.props.onSubmit({ planCode: this.state.planCode, reason: this.state.reason });
      this.props.onClose();
    } catch (err) {
      this.setState({ error: err.message, busy: false });
    }
  };
  render() {
    const { plans, plansError, onRetry, u, onClose } = this.props;
    const { planCode, reason, error, busy } = this.state;
    return (
      <Modal title={`Kích hoạt Premium cho ${u.fullName}`} onClose={onClose} busy={busy} dirty={!!reason.trim()}>
        {plansError || !plans.length
          ? <ErrorState title="Chưa có gói để kích hoạt" error={plansError || 'Chưa có gói Premium nào đang bán.'} onRetry={plansError ? onRetry : undefined} />
          : (
            <form className="stack" onSubmit={this.submit}>
              <Field label="Gói" hint="Thời hạn của gói được cộng thêm cho nhà tuyển dụng này. Mỗi lần bấm là một lần cộng.">
                <select className="select" value={planCode || plans[0].code} onChange={(e) => this.setState({ planCode: e.target.value })}>
                  {plans.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.durationDays} ngày)</option>)}
                </select>
              </Field>
              <Field label="Lý do (ghi vào nhật ký)"><textarea className="textarea" required maxLength={500} value={reason} onChange={(e) => this.setState({ reason: e.target.value })} /></Field>
              <Alert>{error}</Alert>
              <div className="row row-end">
                <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
                <button className="btn" disabled={busy}>{busy ? 'Đang kích hoạt…' : 'Kích hoạt'}</button>
              </div>
            </form>
          )}
      </Modal>
    );
  }
}

// SCR-A03 / FR-ADM-03
// ponytail: "Hết hạn" không lưu ở DB (= OPEN quá hạn) nên server không lọc được; tab này lấy status=OPEN rồi lọc phía client, số trang/tổng có thể lệch
class AdminJobsList extends ListPage {
  endpoint = '/admin/jobs';
  keys = ['q', 'status'];
  noun = 'tin tuyển dụng';
  tableLabel = 'Danh sách tin tuyển dụng';
  query = (f) => (f.status === 'EXPIRED' ? { ...f, status: 'OPEN' } : f);
  visible = (items) => {
    const s = this.getF().status;
    return s === 'EXPIRED' ? items.filter((j) => jobStatusOf(j) === 'EXPIRED') : s === 'OPEN' ? items.filter((j) => jobStatusOf(j) === 'OPEN') : items;
  };
  table(items) {
    return (
      <table className="table">
        <thead><tr><th scope="col">Tin</th><th scope="col">Công ty</th><th scope="col">Trạng thái</th><th scope="col">Đơn</th><th scope="col">Ngày đăng</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>
          {items.map((j) => (
            <tr key={j._id}>
              <td><Link to={`/jobs/${j._id}`}>{j.title}</Link>{j.hiddenReason && <div className="tiny adm-warn">Ẩn: {j.hiddenReason}</div>}</td>
              <td>{j.companySnapshot?.name}</td>
              <td><JobBadge status={jobStatusOf(j)} /></td>
              <td>{j.applicationCount}</td>
              <td>{date(j.createdAt)}</td>
              <td>
                {j.status === 'HIDDEN'
                  ? <button className="btn btn-sm btn-ghost" aria-label={`Hiện lại tin ${j.title}`} onClick={() => this.quick(() => api.patch(`/admin/jobs/${j._id}/unhide`), 'Đã hiện lại tin')}>Hiện lại</button>
                  : <button className="btn btn-sm btn-ghost adm-danger" aria-label={`Ẩn tin ${j.title}`} onClick={() => this.setState({ modal: j })}>Ẩn</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  body() { return super.body(this.state.items && this.visible(this.state.items)); }
  render() {
    const f = this.getF();
    const { modal } = this.state;
    return (
      <div>
        <Head title="Tin tuyển dụng" sub="Kiểm duyệt tin đăng, ẩn tin vi phạm." />
        <div className="adm-toolbar">
          <SearchBox value={f.q} label="Tìm tin tuyển dụng" placeholder="Tìm theo tiêu đề" onSearch={(q) => this.setF({ q })} />
          <Tabs label="Lọc tin theo trạng thái" items={statusTabs(JOB_STATUS, ['OPEN', 'FILLED', 'CLOSED', 'COMPLETED', 'EXPIRED', 'HIDDEN'])} value={f.status} onChange={(status) => this.setF({ status })} />
        </div>
        {this.body()}
        {modal && (
          <ReasonModal title={`Ẩn tin “${modal.title}”`} required danger confirm="Ẩn tin" onClose={this.closeModal}
            onSubmit={(reason) => this.act(() => api.patch(`/admin/jobs/${modal._id}/hide`, { reason }), 'Đã ẩn tin')}>
            <p className="muted small">Tin biến mất khỏi tìm kiếm; các đơn đang chờ bị từ chối, đơn đã nhận giữ nguyên. Nhà tuyển dụng không tự hiện lại được, chỉ quản trị viên mới hiện lại.</p>
          </ReasonModal>
        )}
      </div>
    );
  }
}
export const AdminJobsPage = withRouter(AdminJobsList);

// SCR-A04 / FR-ADM-05
class ResolveModal extends Component {
  state = { decision: '', note: '', error: '', busy: false };
  submit = async (e) => {
    e.preventDefault();
    if (this.state.busy) return;
    if (!this.state.decision) return this.setState({ error: 'Chọn một kết luận' });
    this.setState({ busy: true, error: '' });
    try {
      await this.props.onSubmit({ decision: this.state.decision, note: this.state.note });
      this.props.onClose();
    } catch (err) {
      this.setState({ error: err.message, busy: false });
    }
  };
  render() {
    const { targetType, violationCount = 0, onClose } = this.props;
    const { decision, note, error, busy } = this.state;
    // V2 (ẩn nội dung) chỉ áp dụng cho tin; không chọn sẵn kết luận nào
    const opts = [
      ['DISMISS', 'Bác bỏ', 'Báo cáo không đúng; không xử lý ai, báo cáo được đóng.'],
      ['V1', LEVEL.V1, 'Ghi một lần vi phạm và gửi cảnh cáo cho người vi phạm.'],
      ...(targetType === 'JOB' ? [['V2', LEVEL.V2, 'Ẩn tin bị báo cáo khỏi tìm kiếm; các đơn đang chờ bị từ chối.']] : []),
      ['V3', LEVEL.V3, 'Khóa tài khoản người vi phạm: bị đăng xuất ngay và mất Premium còn lại.'],
    ];
    return (
      <Modal title="Kết luận báo cáo" onClose={onClose} busy={busy} dirty={!!note.trim()}>
        <form className="stack" onSubmit={this.submit}>
          <div className="muted tiny">Người vi phạm đã bị xử lý <strong>{violationCount}</strong> lần{violationCount >= 2 ? ' — tái phạm lần này có thể áp dụng khóa tài khoản' : ''}.</div>
          <fieldset className="adm-fieldset">
            <legend className="field-label">Kết luận</legend>
            {opts.map(([v, l, d]) => (
              <label key={v} className="radio-row adm-radio">
                <input type="radio" name="decision" value={v} checked={decision === v} onChange={() => this.setState({ decision: v, error: '' })} />
                <div><div>{l}</div><div className="fog tiny">{d}</div></div>
              </label>
            ))}
          </fieldset>
          <Field label="Ghi chú kết luận *"><textarea className="textarea" required maxLength={500} value={note} onChange={(e) => this.setState({ note: e.target.value })} /></Field>
          <Alert>{error}</Alert>
          <div className="row row-end">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
            <button className={`btn ${decision === 'V3' ? 'btn-danger' : ''}`} disabled={busy}>{busy ? 'Đang xử lý…' : 'Xác nhận'}</button>
          </div>
        </form>
      </Modal>
    );
  }
}

class ReportsList extends ListPage {
  endpoint = '/admin/reports';
  keys = ['status'];
  defaults = { status: 'OPEN' };
  noun = 'báo cáo';
  tableLabel = 'Danh sách báo cáo vi phạm';
  query = (f) => ({ ...f, status: f.status === 'all' ? '' : f.status });
  hasFilter = () => this.getF().status !== 'OPEN';
  clearFilters = () => setParams(this.props, { status: '', page: '' });
  table(items) {
    const st = { OPEN: ['Chờ xử lý', 'chip-yellow'], RESOLVED: ['Đã xử lý', 'chip-green'], DISMISSED: ['Bác bỏ', ''] };
    return (
      <table className="table">
        <thead><tr><th scope="col">Đối tượng</th><th scope="col">Lý do</th><th scope="col">Người báo cáo</th><th scope="col">Thời gian</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r._id}>
              <td>
                <span className="chip tiny">{r.targetType === 'JOB' ? 'Tin' : 'Người dùng'}</span>{' '}
                {r.targetType === 'JOB' ? <Link to={`/jobs/${r.targetId}`}>{r.target?.title || '(đã xóa)'}</Link> : <span>{r.target?.fullName} <span className="fog tiny">{r.target?.email}</span></span>}
                {r.violationCount > 0 && <div className="fog tiny">Đã vi phạm {r.violationCount} lần</div>}
              </td>
              <td>{REPORT_REASONS[r.reason]}{r.description && <div className="fog tiny">{r.description}</div>}</td>
              <td>{r.reporterId?.fullName}</td>
              <td>{dateTime(r.createdAt)}</td>
              <td><span className={`chip ${st[r.status][1]}`}>{st[r.status][0]}</span>{r.resolution?.level && <span className="chip chip-red tiny adm-chip-gap">{LEVEL[r.resolution.level] || r.resolution.level}</span>}{r.resolution?.note && <div className="fog tiny">{r.resolution.note}</div>}</td>
              <td>{r.status === 'OPEN' && <button className="btn btn-sm btn-ghost" aria-label={`Xử lý báo cáo về ${r.targetType === 'JOB' ? r.target?.title || 'tin đã xóa' : r.target?.fullName || 'người dùng'}`} onClick={() => this.setState({ modal: r })}>Xử lý</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const f = this.getF();
    const { modal } = this.state;
    return (
      <div>
        <Head title="Báo cáo vi phạm" sub="Xem xét và kết luận các báo cáo từ người dùng." />
        <div className="adm-toolbar"><Tabs label="Lọc báo cáo theo trạng thái" items={[['OPEN', 'Chờ xử lý'], ['RESOLVED', 'Đã xử lý'], ['DISMISSED', 'Bác bỏ'], ['all', 'Tất cả']]} value={f.status} onChange={(status) => this.setF({ status })} /></div>
        {this.body()}
        {modal && <ResolveModal targetType={modal.targetType} violationCount={modal.violationCount} onClose={this.closeModal} onSubmit={(body) => this.act(() => api.patch(`/admin/reports/${modal._id}/resolve`, body), 'Đã xử lý báo cáo')} />}
      </div>
    );
  }
}
export const ReportsPage = withRouter(ReportsList);

// SCR-A05 / FR-ADM-06
class ReviewsList extends ListPage {
  endpoint = '/admin/reviews';
  keys = ['isHidden', 'rating'];
  noun = 'đánh giá';
  tableLabel = 'Danh sách đánh giá';
  table(items) {
    return (
      <table className="table">
        <thead><tr><th scope="col">Người đánh giá → Người được đánh giá</th><th scope="col">Điểm</th><th scope="col">Nhận xét</th><th scope="col">Thời gian</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r._id}>
              <td>{r.reviewerId?.fullName} <span className="fog tiny">({ROLE[r.reviewerRole]})</span> <ArrowRight size={14} className="adm-arrow" role="img" aria-label="đánh giá" /> {r.revieweeId?.fullName}</td>
              <td><Stars value={r.rating} /></td>
              <td className="adm-comment">{r.isHidden && <span className="chip chip-red tiny">Đã ẩn</span>} {r.comment || <span className="fog">Không có nhận xét</span>}{r.isHidden && <div className="tiny adm-warn">Lý do ẩn: {r.hiddenReason}</div>}</td>
              <td>{date(r.createdAt)}</td>
              <td>
                {r.isHidden
                  ? <button className="btn btn-sm btn-ghost" aria-label={`Hiện lại đánh giá của ${r.reviewerId?.fullName}`} onClick={() => this.quick(() => api.patch(`/admin/reviews/${r._id}/unhide`), 'Đã hiện lại đánh giá')}>Hiện lại</button>
                  : <button className="btn btn-sm btn-ghost adm-danger" aria-label={`Ẩn đánh giá của ${r.reviewerId?.fullName}`} onClick={() => this.setState({ modal: r })}>Ẩn</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const f = this.getF();
    const { modal } = this.state;
    return (
      <div>
        <Head title="Đánh giá" sub="Ẩn đánh giá không phù hợp; điểm trung bình tự tính lại." />
        <div className="adm-toolbar">
          <Tabs label="Lọc đánh giá theo hiển thị" items={[['', 'Tất cả'], ['false', 'Đang hiển thị'], ['true', 'Đã ẩn']]} value={f.isHidden} onChange={(isHidden) => this.setF({ isHidden })} />
          <select className="pill-select" aria-label="Lọc theo số sao" value={f.rating} onChange={(e) => this.setF({ rating: e.target.value })}>
            <option value="">Mọi điểm</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} sao</option>)}
          </select>
        </div>
        {this.body()}
        {modal && (
          <ReasonModal title="Ẩn đánh giá" required danger confirm="Ẩn đánh giá" onClose={this.closeModal}
            onSubmit={(reason) => this.act(() => api.patch(`/admin/reviews/${modal._id}/hide`, { reason }), 'Đã ẩn đánh giá, điểm trung bình đã được tính lại')}>
            <p className="muted small">Đánh giá không còn hiện công khai và điểm trung bình của người được đánh giá được tính lại. Bạn có thể hiện lại sau.</p>
          </ReasonModal>
        )}
      </div>
    );
  }
}
export const ReviewsPage = withRouter(ReviewsList);

// SCR-A06 / FR-ADM-04
export class CategoriesPage extends Component {
  state = { items: null, name: '', edit: null, msg: '', error: '', loadError: '', uploading: '' };
  req = 0;
  timer = null;
  componentDidMount() { this.load(); }
  componentWillUnmount() { this.req++; clearTimeout(this.timer); }
  load = async () => {
    const id = ++this.req;
    this.setState({ loadError: '' });
    try {
      const r = await api.get('/admin/categories');
      if (id === this.req) this.setState({ items: r.data });
    } catch (e) {
      if (id === this.req) this.setState({ loadError: e.message || 'Không tải được danh mục' });
    }
  };
  // clear: các trường cần xóa khi thành công (chỉ xóa đúng ô liên quan, không động vào ô đang gõ của việc khác)
  act = async (fn, msg, clear = {}) => {
    clearTimeout(this.timer);
    this.setState({ msg: '', error: '' });
    try {
      await fn();
      this.setState({ msg, ...clear });
      this.timer = setTimeout(() => this.setState({ msg: '' }), 6000);
      this.load();
    } catch (e) {
      this.setState({ error: e.message });
    }
  };
  uploadImage = async (c, e) => {
    const input = e.target;
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return this.setState({ msg: '', error: 'Chỉ nhận ảnh JPG hoặc PNG' });
    if (file.size > 2 * 1024 * 1024) return this.setState({ msg: '', error: 'Ảnh vượt quá 2 MB' });
    this.setState({ uploading: c._id });
    await this.act(() => api.post(`/admin/categories/${c._id}/image`, file), `Đã cập nhật ảnh danh mục ${c.name}`);
    this.setState({ uploading: '' });
  };
  cancelEdit = () => this.setState({ edit: null });
  render() {
    const { items, name, edit, msg, error, loadError, uploading } = this.state;
    return (
      <div>
        <Head title="Danh mục" sub="Ngành nghề hiển thị trên trang chủ và bộ lọc tìm việc." />
        <form className="adm-add" onSubmit={(e) => { e.preventDefault(); this.act(() => api.post('/admin/categories', { name }), `Đã thêm danh mục “${name.trim()}”`, { name: '' }); }}>
          <Field label="Tên danh mục mới"><input className="input" maxLength={60} value={name} onChange={(e) => this.setState({ name: e.target.value })} required /></Field>
          <button className="btn">+ Thêm danh mục</button>
        </form>
        <div className="adm-toast"><Alert type="ok">{msg}</Alert><Alert>{error}</Alert></div>
        {loadError ? <div className="card"><ErrorState error={loadError} onRetry={this.load} /></div> : !items ? <Spinner /> : !items.length ? <div className="card"><Empty title="Chưa có danh mục">Thêm danh mục đầu tiên ở ô phía trên.</Empty></div> : (
          <div className="card adm-table-card table-wrap" tabIndex={0} role="region" aria-label="Danh sách danh mục">
            <table className="table">
              <thead><tr><th scope="col">Ảnh</th><th scope="col">Tên</th><th scope="col">Số tin</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <label className={`file-pick adm-cat-pick ${uploading === c._id ? 'is-disabled' : ''}`}>
                        {c.imageUrl ? <img src={c.imageUrl} alt="" className="adm-cat-img" loading="lazy" decoding="async" /> : <span className="chip">+ ảnh</span>}
                        <span className="sr-only">{uploading === c._id ? 'Đang tải ảnh lên…' : `Đổi ảnh danh mục ${c.name}`}</span>
                        <input type="file" accept="image/jpeg,image/png" className="sr-only" disabled={!!uploading} onChange={(e) => this.uploadImage(c, e)} />
                      </label>
                    </td>
                    <td>
                      {edit?._id === c._id ? (
                        <form className="row adm-edit" onSubmit={(e) => { e.preventDefault(); this.act(() => api.put(`/admin/categories/${c._id}`, { name: edit.name }), 'Đã đổi tên danh mục', { edit: null }); }}>
                          <input className="input" aria-label={`Tên mới của danh mục ${c.name}`} maxLength={60} required value={edit.name} onChange={(e) => this.setState({ edit: { ...edit, name: e.target.value } })} onKeyDown={(e) => e.key === 'Escape' && this.cancelEdit()} autoFocus />
                          <button className="btn btn-sm">Lưu</button>
                          <button type="button" className="btn btn-sm btn-ghost" onClick={this.cancelEdit}>Hủy</button>
                        </form>
                      ) : c.name}
                    </td>
                    <td>{c.jobCount}</td>
                    <td>{c.isActive ? <span className="chip chip-green">Đang dùng</span> : <span className="chip">Đã ẩn</span>}</td>
                    <td>
                      <div className="row adm-actions">
                        <button className="btn btn-sm btn-ghost" aria-label={`Sửa tên danh mục ${c.name}`} onClick={() => this.setState({ edit: { _id: c._id, name: c.name } })}>Sửa</button>
                        <button className="btn btn-sm btn-ghost" aria-label={`${c.isActive ? 'Ẩn' : 'Hiện'} danh mục ${c.name}`} onClick={() => this.act(() => api.put(`/admin/categories/${c._id}`, { isActive: !c.isActive }), c.isActive ? `Đã ẩn danh mục ${c.name}` : `Đã hiện danh mục ${c.name}`)}>{c.isActive ? 'Ẩn' : 'Hiện'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* BR-40: danh mục đang có tin chỉ ẩn được, không xóa */}
        <p className="fog small adm-note">Danh mục đang có tin chỉ ẩn được, không xóa. Danh mục ẩn không dùng được cho tin mới.</p>
      </div>
    );
  }
}

// SCR-A07 / FR-ADM-07
class PaymentsList extends ListPage {
  endpoint = '/admin/payments';
  keys = ['status', 'month'];
  noun = 'giao dịch';
  tableLabel = 'Lịch sử giao dịch';
  state = { ...this.state, plans: null, plansError: '' };
  componentDidMount() {
    super.componentDidMount();
    this.loadPlans();
  }
  loadPlans = async () => {
    try { this.setState({ plans: (await api.get('/admin/plans')).data, plansError: '' }); } catch (e) { this.setState({ plansError: e.message || 'Không tải được danh sách gói' }); }
  };
  savePlan = (p, patch, msg) => this.act(() => api.put(`/admin/plans/${p._id}`, patch), msg).then(this.loadPlans);
  table(items) {
    return (
      <table className="table">
        <thead><tr><th scope="col">Thời gian</th><th scope="col">Nhà tuyển dụng</th><th scope="col">Gói</th><th scope="col">Số tiền</th><th scope="col">Mã giao dịch</th><th scope="col">Trạng thái</th><th scope="col"><span className="sr-only">Thao tác</span></th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p._id}>
              <td>{dateTime(p.createdAt)}</td>
              <td>{p.employerId?.employer?.company?.name || p.employerId?.fullName}<div className="fog tiny">{p.employerId?.email}</div></td>
              <td>{p.planSnapshot.name}</td>
              <td>{money(p.amount)}</td>
              <td className="fog tiny">{p.txnRef}</td>
              <td><PayBadge status={p.displayStatus} /></td>
              {/* FR-ADM-08: tiền đã vào nhưng lệch số / IPN không đến → chốt tay giao dịch này */}
              <td>{p.status === 'PENDING' && p.employerId?._id && <button className="btn btn-sm btn-ghost" aria-label={`Kích hoạt thủ công giao dịch ${p.txnRef}`} onClick={() => this.setState({ modal: { type: 'activate', p } })}>Kích hoạt</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const f = this.getF();
    const { plans, plansError, meta, modal } = this.state;
    const who = (p) => p.employerId?.employer?.company?.name || p.employerId?.fullName;
    return (
      <div className="stack-lg">
        <Head title="Gói & giao dịch" sub="Giá gói Premium và lịch sử thanh toán qua cổng SePay." />
        {plansError && <ErrorState title="Không tải được các gói Premium" error={plansError} onRetry={this.loadPlans} />}
        {!plans && !plansError && <Spinner />}
        <div className="grid-2">
          {(plans || []).map((p) => (
            <form key={p._id} className={`card stack adm-plan ${p.isActive ? 'adm-plan-on' : ''}`} onSubmit={(e) => { e.preventDefault(); this.setState({ modal: { type: 'price', p, price: Number(e.target.price.value) } }); }}>
              <div className="row-between"><h2 className="h-md">{p.name}</h2><span className={`chip ${p.isActive ? 'chip-green' : ''}`}>{p.isActive ? 'Đang bán' : 'Đã tắt'}</span></div>
              <div className="small muted">Thời hạn {p.durationDays} ngày</div>
              <div className="adm-stat-num">{money(p.price)}</div>
              <div className="row adm-plan-price">
                <Field label="Giá mới (VNĐ), áp dụng cho giao dịch mới"><input name="price" className="input" type="number" min="1000" step="1000" defaultValue={p.price} /></Field>
                <button className="btn btn-sm" aria-label={`Lưu giá mới cho ${p.name}`}>Lưu</button>
              </div>
              <button type="button" className="btn btn-sm btn-ghost" aria-label={`${p.isActive ? 'Tắt' : 'Bật'} gói ${p.name}`}
                onClick={() => (p.isActive ? this.setState({ modal: { type: 'off', p } }) : this.savePlan(p, { isActive: true }, `Đã bật gói ${p.name}`).catch((e) => this.setState({ error: e.message })))}>{p.isActive ? 'Tắt gói' : 'Bật gói'}</button>
            </form>
          ))}
        </div>
        <div>
          <div className="adm-toolbar">
            <Tabs label="Lọc giao dịch theo trạng thái" items={statusTabs(PAY_STATUS, ['SUCCESS', 'PENDING', 'EXPIRED'])} value={f.status} onChange={(status) => this.setF({ status })} />
            <div className="row adm-toolbar-end">
              <select className="pill-select" value={f.month} onChange={(e) => this.setF({ month: e.target.value })} aria-label="Lọc theo tháng">
                <option value="">Mọi tháng</option>
                {monthOptions().map((m) => <option key={m} value={m}>Tháng {+m.slice(5)}/{m.slice(0, 4)}</option>)}
              </select>
              {meta && <span className="muted">Doanh thu: <strong>{money(meta.revenue)}</strong></span>}
            </div>
          </div>
          {this.body()}
        </div>
        {modal?.type === 'activate' && (
          <ReasonModal title="Kích hoạt Premium thủ công" label="Lý do kích hoạt (ghi vào nhật ký)" required confirm="Kích hoạt Premium" onClose={this.closeModal}
            onSubmit={(reason) => this.act(() => api.post(`/admin/employers/${modal.p.employerId._id}/premium`, { paymentId: modal.p._id, reason }), `Đã kích hoạt Premium cho ${who(modal.p)}`)}>
            <dl className="adm-summary">
              <dt>Giao dịch</dt><dd>{modal.p.txnRef}</dd>
              <dt>Gói</dt><dd>{modal.p.planSnapshot.name}</dd>
              <dt>Số tiền</dt><dd>{money(modal.p.amount)}</dd>
              <dt>Nhà tuyển dụng</dt><dd>{who(modal.p)} ({modal.p.employerId?.email})</dd>
            </dl>
            <p className="muted small">Premium được bật ngay cho nhà tuyển dụng này và giao dịch chuyển sang Thành công. Chỉ làm khi bạn đã đối soát tiền đã về tài khoản; không hoàn tác được.</p>
          </ReasonModal>
        )}
        {modal?.type === 'price' && (
          <ConfirmModal title={`Đổi giá gói ${modal.p.name}`} confirm="Đổi giá" onClose={this.closeModal}
            onConfirm={() => this.savePlan(modal.p, { price: modal.price }, `Đã đổi giá gói ${modal.p.name}`)}>
            <p>Giá gói đổi từ <strong>{money(modal.p.price)}</strong> thành <strong>{money(modal.price)}</strong>.</p>
            <p className="muted small">Giá mới áp dụng cho mọi giao dịch tạo từ bây giờ; giao dịch đã thanh toán không đổi.</p>
          </ConfirmModal>
        )}
        {modal?.type === 'off' && (
          <ConfirmModal title={`Tắt gói ${modal.p.name}`} confirm="Tắt gói" danger onClose={this.closeModal}
            onConfirm={() => this.savePlan(modal.p, { isActive: false }, `Đã tắt gói ${modal.p.name}`)}>
            <p className="muted small">Nhà tuyển dụng sẽ không mua được gói này cho đến khi bạn bật lại. Giao dịch đang chờ thanh toán của gói này có thể không hoàn tất được.</p>
          </ConfirmModal>
        )}
      </div>
    );
  }
}
export const AdminPaymentsPage = withRouter(PaymentsList);
