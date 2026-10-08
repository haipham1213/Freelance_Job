import React, { Component } from 'react';
import { ArrowRight, Building2, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, qs } from '../../api';
import { Spinner, Empty, Pagination, Tabs, Alert, ReasonModal, JobBadge, PayBadge, Stars, Field, Modal } from '../../components/ui';
import { money, shortMoney, date, dateTime, ROLE, REPORT_REASONS, jobStatusOf } from '../../utils/format';
import { Mascot } from '../../components/Illustrations';

// Tiêu đề trang kiểu headspace.com: chữ lớn đậm + nhân vật nhỏ
const Head = ({ title, sub, mascot = 'cloud', children }) => (
  <div className="adm-head">
    <Mascot kind={mascot} size={64} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <h1 className="display">{title}</h1>
      {sub && <p className="muted adm-sub">{sub}</p>}
    </div>
    {children}
  </div>
);

// Khung chung cho các trang danh sách có lọc + phân trang
class ListPage extends Component {
  filters = {};
  state = { items: null, meta: null, f: { ...this.filters }, modal: null, msg: '', error: '' };
  componentDidMount() { this.load(1); }
  load = async (page = this.state.meta?.page || 1) => {
    const r = await api.get(`${this.endpoint}${qs({ ...this.state.f, page })}`);
    this.setState({ items: r.data, meta: r.meta });
  };
  filter = (patch) => this.setState({ f: { ...this.state.f, ...patch }, items: null }, () => this.load(1));
  act = async (fn, msg) => {
    this.setState({ msg: '', error: '' });
    try {
      await fn();
      this.setState({ msg });
      await this.load();
    } catch (e) {
      this.setState({ error: e.message });
      throw e;
    }
  };
  closeModal = () => this.setState({ modal: null });
  body() {
    const { items, meta, msg, error } = this.state;
    return (
      <>
        <div className="stack" style={{ marginBottom: 16 }}><Alert type="ok">{msg}</Alert><Alert>{error}</Alert></div>
        {!items ? <Spinner /> : !items.length ? <div className="card"><Empty title="Không có dữ liệu" mascot="blob" /></div> : <div className="card adm-table-card table-wrap">{this.table(items)}</div>}
        <Pagination meta={meta} onPage={this.load} />
      </>
    );
  }
}

// SCR-A01 / FR-ADM-01
export class AdminDashboardPage extends Component {
  state = { d: null };
  async componentDidMount() { this.setState({ d: (await api.get('/admin/dashboard')).data }); }
  render() {
    const { d } = this.state;
    if (!d) return <Spinner />;
    const max = Math.max(...d.revenueByMonth.map((m) => m.total), 1);
    const total = d.revenueByMonth.reduce((a, m) => a + m.total, 0);
    const stats = [
      ['Người dùng', (d.users.STUDENT || 0) + (d.users.EMPLOYER || 0), `${d.users.STUDENT || 0} SV · ${d.users.EMPLOYER || 0} NTD`, 'wash-powder', '/admin/users'],
      ['Tin đang tuyển', d.openJobs, 'Đang hiển thị công khai', 'wash-mint', '/admin/jobs'],
      ['Đơn 30 ngày', d.applications30d, 'Đơn ứng tuyển mới', 'wash-lavender'],
      ['Tỷ lệ được nhận', `${d.acceptRate}%`, 'Trong 30 ngày', 'wash-solar'],
      ['Báo cáo chờ xử lý', d.openReports, 'Cần xem xét', d.openReports ? 'wash-solar' : 'wash-mist', '/admin/reports'],
      ['Doanh thu 12 tháng', shortMoney(total), 'Premium', 'wash-powder', '/admin/payments'],
    ];
    return (
      <div className="stack-lg">
        <Head title="Tổng quan hệ thống" sub="Số liệu người dùng, tin tuyển dụng và doanh thu Premium." mascot="triangle" />
        <div className="grid-3 adm-stats">
          {stats.map(([k, v, sub, w, to]) => {
            const inner = <><div className="join-num">{v}</div><div><div className="adm-stat-label">{k}</div><div className="small adm-stat-sub">{sub}</div></div></>;
            return to ? <Link key={k} to={to} className={`tile adm-stat adm-stat-link ${w}`}>{inner}</Link> : <div key={k} className={`tile adm-stat ${w}`}>{inner}</div>;
          })}
        </div>
        <div className="card stack adm-chart">
          <div className="row-between">
            <h2 className="h-lg">Doanh thu Premium theo tháng</h2>
            <span className="chip chip-dark">{shortMoney(total)} / 12 tháng</span>
          </div>
          <div className="bar-chart" role="img" aria-label="Biểu đồ doanh thu theo tháng">
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

// SCR-A02 / FR-ADM-02 (+ FR-ADM-08 kích hoạt Premium thủ công)
export class UsersPage extends ListPage {
  endpoint = '/admin/users';
  state = { ...this.state, plans: [] };
  async componentDidMount() {
    super.componentDidMount();
    this.setState({ plans: (await api.get('/admin/plans')).data });
  }
  table(items) {
    return (
      <table className="table">
        <thead><tr><th>Người dùng</th><th>Vai trò</th><th>Email xác thực</th><th>Điểm</th><th>Ngày tạo</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>
          {items.map((u) => (
            <tr key={u._id}>
              <td><div>{u.fullName}</div><div className="fog tiny">{u.email}</div>{u.employer?.company?.name && <div className="tiny ico-row"><Building2 size={14} />{u.employer.company.name}{u.isPremium && <span className="accent"> ★</span>}</div>}</td>
              <td>{ROLE[u.role]}</td>
              <td>{u.emailVerified ? <Check size={18} aria-label="Đã xác thực" /> : <span className="fog">Chưa</span>}</td>
              <td>{u.ratingCount ? `${u.ratingAvg}★ (${u.ratingCount})` : '—'}</td>
              <td>{date(u.createdAt)}</td>
              <td>{u.status === 'LOCKED' ? <span className="chip chip-red" title={u.lockReason}>Bị khóa</span> : <span className="chip chip-green">Hoạt động</span>}</td>
              <td>
                {u.role !== 'ADMIN' && (
                  <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                    {u.status === 'LOCKED'
                      ? <button className="btn btn-sm btn-ghost" onClick={() => this.act(() => api.patch(`/admin/users/${u._id}/unlock`), `Đã mở khóa ${u.email}`).catch(() => {})}>Mở khóa</button>
                      : <button className="btn btn-sm btn-ghost" style={{ color: 'var(--alert)' }} onClick={() => this.setState({ modal: { type: 'lock', u } })}>Khóa</button>}
                    {u.role === 'EMPLOYER' && u.status === 'ACTIVE' && <button className="btn btn-sm btn-ghost" onClick={() => this.setState({ modal: { type: 'premium', u } })}>+ Premium</button>}
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
    const { f, modal, plans } = this.state;
    return (
      <div>
        <Head title="Người dùng" sub="Khóa / mở khóa tài khoản và kích hoạt Premium thủ công." mascot="blob" />
        <div className="row adm-toolbar">
          <input className="input adm-search" placeholder="Tìm theo email hoặc tên" defaultValue={f.q} onKeyDown={(e) => e.key === 'Enter' && this.filter({ q: e.target.value })} />
          <select className="pill-select" value={f.role || ''} onChange={(e) => this.filter({ role: e.target.value })}>
            <option value="">Mọi vai trò</option><option value="STUDENT">Sinh viên</option><option value="EMPLOYER">Nhà tuyển dụng</option><option value="ADMIN">Admin</option>
          </select>
          <select className="pill-select" value={f.status || ''} onChange={(e) => this.filter({ status: e.target.value })}>
            <option value="">Mọi trạng thái</option><option value="ACTIVE">Hoạt động</option><option value="LOCKED">Bị khóa</option>
          </select>
        </div>
        {this.body()}
        {modal?.type === 'lock' && (
          <ReasonModal title={`Khóa ${modal.u.email}`} required danger confirm="Khóa tài khoản" onClose={this.closeModal}
            onSubmit={(reason) => this.act(() => api.patch(`/admin/users/${modal.u._id}/lock`, { reason }), `Đã khóa ${modal.u.email}`)}>
            <p className="muted small">Người dùng bị đăng xuất ngay và mất quyền Premium còn lại (BR-38).</p>
          </ReasonModal>
        )}
        {modal?.type === 'premium' && <PremiumModal u={modal.u} plans={plans} onClose={this.closeModal} onSubmit={(body) => this.act(() => api.post(`/admin/employers/${modal.u._id}/premium`, body), 'Đã kích hoạt Premium')} />}
      </div>
    );
  }
}

class PremiumModal extends Component {
  state = { planCode: this.props.plans[0]?.code || '', reason: '', error: '' };
  submit = async (e) => {
    e.preventDefault();
    try {
      await this.props.onSubmit(this.state);
      this.props.onClose();
    } catch (err) {
      this.setState({ error: err.message });
    }
  };
  render() {
    return (
      <Modal title={`Kích hoạt Premium cho ${this.props.u.fullName}`} onClose={this.props.onClose}>
        <form className="stack" onSubmit={this.submit}>
          <Field label="Gói">
            <select className="select" value={this.state.planCode} onChange={(e) => this.setState({ planCode: e.target.value })}>
              {this.props.plans.map((p) => <option key={p.code} value={p.code}>{p.name} ({p.durationDays} ngày)</option>)}
            </select>
          </Field>
          <Field label="Lý do (ghi vào nhật ký)"><textarea className="textarea" required value={this.state.reason} onChange={(e) => this.setState({ reason: e.target.value })} /></Field>
          <Alert>{this.state.error}</Alert>
          <button className="btn">Kích hoạt</button>
        </form>
      </Modal>
    );
  }
}

// SCR-A03 / FR-ADM-03
export class AdminJobsPage extends ListPage {
  endpoint = '/admin/jobs';
  table(items) {
    return (
      <table className="table">
        <thead><tr><th>Tin</th><th>Công ty</th><th>Trạng thái</th><th>Đơn</th><th>Ngày đăng</th><th /></tr></thead>
        <tbody>
          {items.map((j) => (
            <tr key={j._id}>
              <td><Link to={`/jobs/${j._id}`}>{j.title}</Link>{j.hiddenReason && <div className="tiny" style={{ color: 'var(--alert)' }}>Ẩn: {j.hiddenReason}</div>}</td>
              <td>{j.companySnapshot?.name}</td>
              <td><JobBadge status={jobStatusOf(j)} /></td>
              <td>{j.applicationCount}</td>
              <td>{date(j.createdAt)}</td>
              <td>
                {j.status === 'HIDDEN'
                  ? <button className="btn btn-sm btn-ghost" onClick={() => this.act(() => api.patch(`/admin/jobs/${j._id}/unhide`), 'Đã hiện lại tin').catch(() => {})}>Hiện lại</button>
                  : <button className="btn btn-sm btn-ghost" style={{ color: 'var(--alert)' }} onClick={() => this.setState({ modal: j })}>Ẩn</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const { f, modal } = this.state;
    return (
      <div>
        <Head title="Tin tuyển dụng" sub="Kiểm duyệt tin đăng, ẩn tin vi phạm." mascot="cloud" />
        <div className="row adm-toolbar">
          <input className="input adm-search" placeholder="Tìm theo tiêu đề" onKeyDown={(e) => e.key === 'Enter' && this.filter({ q: e.target.value })} />
          <Tabs items={[['', 'Tất cả'], ['OPEN', 'Đang tuyển'], ['FILLED', 'Đủ người'], ['CLOSED', 'Đã đóng'], ['COMPLETED', 'Hoàn thành'], ['HIDDEN', 'Bị ẩn']]} value={f.status || ''} onChange={(status) => this.filter({ status })} />
        </div>
        {this.body()}
        {modal && (
          <ReasonModal title={`Ẩn tin “${modal.title}”`} required danger confirm="Ẩn tin" onClose={this.closeModal}
            onSubmit={(reason) => this.act(() => api.patch(`/admin/jobs/${modal._id}/hide`, { reason }), 'Đã ẩn tin')}>
            <p className="muted small">Tin biến mất khỏi tìm kiếm; các đơn đang chờ bị từ chối, đơn đã nhận giữ nguyên.</p>
          </ReasonModal>
        )}
      </div>
    );
  }
}

// SCR-A04 / FR-ADM-05
class ResolveModal extends Component {
  state = { decision: 'V1', note: '', error: '' };
  submit = async (e) => {
    e.preventDefault();
    try {
      await this.props.onSubmit(this.state);
      this.props.onClose();
    } catch (err) {
      this.setState({ error: err.message });
    }
  };
  render() {
    const opts = [['DISMISS', 'Bác bỏ', 'Không vi phạm'], ['V1', 'V1 · Cảnh cáo', 'Ghi vi phạm, gửi cảnh cáo'], ['V2', 'V2 · Ẩn nội dung', 'Ẩn tin bị báo cáo'], ['V3', 'V3 · Khóa tài khoản', 'Khóa người vi phạm']];
    return (
      <Modal title="Kết luận báo cáo" onClose={this.props.onClose}>
        <form className="stack" onSubmit={this.submit}>
          {opts.map(([v, l, d]) => (
            <label key={v} className="card-sm row" style={{ cursor: 'pointer', flexWrap: 'nowrap', boxShadow: this.state.decision === v ? 'inset 0 0 0 2px var(--ink)' : 'none' }}>
              <input type="radio" checked={this.state.decision === v} onChange={() => this.setState({ decision: v })} />
              <div><div>{l}</div><div className="fog tiny">{d}</div></div>
            </label>
          ))}
          <Field label="Ghi chú kết luận *"><textarea className="textarea" required maxLength={500} value={this.state.note} onChange={(e) => this.setState({ note: e.target.value })} /></Field>
          <Alert>{this.state.error}</Alert>
          <button className={`btn ${this.state.decision === 'V3' ? 'btn-danger' : ''}`}>Xác nhận</button>
        </form>
      </Modal>
    );
  }
}

export class ReportsPage extends ListPage {
  endpoint = '/admin/reports';
  filters = { status: 'OPEN' };
  state = { ...this.state, f: { status: 'OPEN' } };
  table(items) {
    const st = { OPEN: ['Chờ xử lý', 'chip-yellow'], RESOLVED: ['Đã xử lý', 'chip-green'], DISMISSED: ['Bác bỏ', ''] };
    return (
      <table className="table">
        <thead><tr><th>Đối tượng</th><th>Lý do</th><th>Người báo cáo</th><th>Thời gian</th><th>Trạng thái</th><th /></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r._id}>
              <td>
                <span className="chip tiny">{r.targetType === 'JOB' ? 'Tin' : 'Người dùng'}</span>{' '}
                {r.targetType === 'JOB' ? <Link to={`/jobs/${r.targetId}`}>{r.target?.title || '(đã xóa)'}</Link> : <span>{r.target?.fullName} <span className="fog tiny">{r.target?.email}</span></span>}
              </td>
              <td>{REPORT_REASONS[r.reason]}{r.description && <div className="fog tiny">{r.description}</div>}</td>
              <td>{r.reporterId?.fullName}</td>
              <td>{dateTime(r.createdAt)}</td>
              <td><span className={`chip ${st[r.status][1]}`}>{st[r.status][0]}</span>{r.resolution?.level && <span className="chip chip-red tiny" style={{ marginLeft: 4 }}>{r.resolution.level}</span>}{r.resolution?.note && <div className="fog tiny">{r.resolution.note}</div>}</td>
              <td>{r.status === 'OPEN' && <button className="btn btn-sm" onClick={() => this.setState({ modal: r })}>Xử lý</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const { f, modal } = this.state;
    return (
      <div>
        <Head title="Báo cáo vi phạm" sub="Xem xét và kết luận các báo cáo từ người dùng." mascot="flower" />
        <div className="adm-toolbar"><Tabs items={[['OPEN', 'Chờ xử lý'], ['RESOLVED', 'Đã xử lý'], ['DISMISSED', 'Bác bỏ'], ['', 'Tất cả']]} value={f.status ?? ''} onChange={(status) => this.filter({ status })} /></div>
        {this.body()}
        {modal && <ResolveModal onClose={this.closeModal} onSubmit={(body) => this.act(() => api.patch(`/admin/reports/${modal._id}/resolve`, body), 'Đã xử lý báo cáo')} />}
      </div>
    );
  }
}

// SCR-A05 / FR-ADM-06
export class ReviewsPage extends ListPage {
  endpoint = '/admin/reviews';
  table(items) {
    return (
      <table className="table">
        <thead><tr><th>Người đánh giá → Người được đánh giá</th><th>Điểm</th><th>Nhận xét</th><th>Thời gian</th><th /></tr></thead>
        <tbody>
          {items.map((r) => (
            <tr key={r._id} style={{ opacity: r.isHidden ? 0.55 : 1 }}>
              <td>{r.reviewerId?.fullName} <span className="fog tiny">({ROLE[r.reviewerRole]})</span> <ArrowRight size={14} style={{ verticalAlign: '-2px' }} aria-label="đánh giá" /> {r.revieweeId?.fullName}</td>
              <td><Stars value={r.rating} /></td>
              <td style={{ maxWidth: 320 }}>{r.comment || <span className="fog">—</span>}{r.isHidden && <div className="tiny" style={{ color: 'var(--alert)' }}>Đã ẩn: {r.hiddenReason}</div>}</td>
              <td>{date(r.createdAt)}</td>
              <td>
                {r.isHidden
                  ? <button className="btn btn-sm btn-ghost" onClick={() => this.act(() => api.patch(`/admin/reviews/${r._id}/unhide`), 'Đã hiện lại đánh giá').catch(() => {})}>Hiện lại</button>
                  : <button className="btn btn-sm btn-ghost" style={{ color: 'var(--alert)' }} onClick={() => this.setState({ modal: r })}>Ẩn</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const { f, modal } = this.state;
    return (
      <div>
        <Head title="Đánh giá" sub="Ẩn đánh giá không phù hợp; điểm trung bình tự tính lại." mascot="triangle" />
        <div className="row adm-toolbar">
          <Tabs items={[['', 'Tất cả'], ['false', 'Đang hiển thị'], ['true', 'Đã ẩn']]} value={f.isHidden || ''} onChange={(isHidden) => this.filter({ isHidden })} />
          <select className="pill-select" value={f.rating || ''} onChange={(e) => this.filter({ rating: e.target.value })}>
            <option value="">Mọi điểm</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} sao</option>)}
          </select>
        </div>
        {this.body()}
        {modal && (
          <ReasonModal title="Ẩn đánh giá" required danger confirm="Ẩn" onClose={this.closeModal}
            onSubmit={(reason) => this.act(() => api.patch(`/admin/reviews/${modal._id}/hide`, { reason }), 'Đã ẩn đánh giá, điểm trung bình đã được tính lại')} />
        )}
      </div>
    );
  }
}

// SCR-A06 / FR-ADM-04
export class CategoriesPage extends Component {
  state = { items: null, name: '', edit: null, msg: '', error: '' };
  componentDidMount() { this.load(); }
  load = async () => this.setState({ items: (await api.get('/admin/categories')).data });
  act = async (fn, msg) => {
    this.setState({ msg: '', error: '' });
    try {
      await fn();
      this.setState({ msg, name: '', edit: null });
      this.load();
    } catch (e) {
      this.setState({ error: e.message });
    }
  };
  uploadImage = async (c, e) => {
    const file = e.target.files[0];
    if (file) await this.act(() => api.post(`/admin/categories/${c._id}/image`, file), 'Đã cập nhật ảnh');
  };
  render() {
    const { items, name, edit, msg, error } = this.state;
    return (
      <div>
        <Head title="Danh mục" sub="Ngành nghề hiển thị trên trang chủ và bộ lọc tìm việc." mascot="cloud" />
        <form className="search-bar adm-add" onSubmit={(e) => { e.preventDefault(); this.act(() => api.post('/admin/categories', { name }), 'Đã thêm danh mục'); }}>
          <input className="input" style={{ flex: 1, minWidth: 0 }} placeholder="Tên danh mục mới" maxLength={60} value={name} onChange={(e) => this.setState({ name: e.target.value })} required />
          <button className="btn">+ Thêm danh mục</button>
        </form>
        <div className="stack" style={{ marginBottom: 16 }}><Alert type="ok">{msg}</Alert><Alert>{error}</Alert></div>
        {!items ? <Spinner /> : (
          <div className="card adm-table-card table-wrap">
            <table className="table">
              <thead><tr><th>Ảnh</th><th>Tên</th><th>Số tin</th><th>Trạng thái</th><th /></tr></thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <label style={{ cursor: 'pointer' }} title="Đổi ảnh">
                        {c.imageUrl ? <img src={c.imageUrl} alt="" className="adm-cat-img" /> : <span className="chip">+ ảnh</span>}
                        <input type="file" accept="image/jpeg,image/png" hidden onChange={(e) => this.uploadImage(c, e)} />
                      </label>
                    </td>
                    <td>
                      {edit?._id === c._id ? (
                        <form className="row" style={{ flexWrap: 'nowrap' }} onSubmit={(e) => { e.preventDefault(); this.act(() => api.put(`/admin/categories/${c._id}`, { name: edit.name }), 'Đã đổi tên'); }}>
                          <input className="input" value={edit.name} onChange={(e) => this.setState({ edit: { ...edit, name: e.target.value } })} autoFocus />
                          <button className="btn btn-sm">Lưu</button>
                        </form>
                      ) : c.name}
                    </td>
                    <td>{c.jobCount}</td>
                    <td>{c.isActive ? <span className="chip chip-green">Đang dùng</span> : <span className="chip">Đã ẩn</span>}</td>
                    <td>
                      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => this.setState({ edit: { _id: c._id, name: c.name } })}>Sửa</button>
                        <button className="btn btn-sm btn-ghost" onClick={() => this.act(() => api.put(`/admin/categories/${c._id}`, { isActive: !c.isActive }), c.isActive ? 'Đã ẩn danh mục' : 'Đã hiện danh mục')}>{c.isActive ? 'Ẩn' : 'Hiện'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="fog small" style={{ marginTop: 12 }}>Danh mục đang có tin chỉ ẩn được, không xóa (BR-40). Danh mục ẩn không dùng được cho tin mới.</p>
      </div>
    );
  }
}

// SCR-A07 / FR-ADM-07
export class AdminPaymentsPage extends ListPage {
  endpoint = '/admin/payments';
  state = { ...this.state, plans: null };
  async componentDidMount() {
    super.componentDidMount();
    this.loadPlans();
  }
  loadPlans = async () => this.setState({ plans: (await api.get('/admin/plans')).data });
  savePlan = (p, patch) => this.act(() => api.put(`/admin/plans/${p._id}`, patch), 'Đã cập nhật gói').then(this.loadPlans).catch(() => {});
  table(items) {
    return (
      <table className="table">
        <thead><tr><th>Thời gian</th><th>Nhà tuyển dụng</th><th>Gói</th><th>Số tiền</th><th>Mã GD</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {items.map((p) => (
            <tr key={p._id}>
              <td>{dateTime(p.createdAt)}</td>
              <td>{p.employerId?.employer?.company?.name || p.employerId?.fullName}<div className="fog tiny">{p.employerId?.email}</div></td>
              <td>{p.planSnapshot.name}</td>
              <td>{money(p.amount)}</td>
              <td className="fog tiny">{p.txnRef}</td>
              <td><PayBadge status={p.displayStatus} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  render() {
    const { f, plans, meta } = this.state;
    return (
      <div className="stack-lg">
        <Head title="Gói & giao dịch" sub="Giá gói Premium và lịch sử thanh toán VNPay." mascot="blob" />
        <div className="grid-2">
          {(plans || []).map((p) => (
            <form key={p._id} className={`tile stack adm-plan ${p.isActive ? 'wash-solar' : 'wash-mist'}`} onSubmit={(e) => { e.preventDefault(); this.savePlan(p, { price: Number(e.target.price.value) }); }}>
              <div className="row-between"><h2 className="h-lg">{p.name}</h2><span className={`chip ${p.isActive ? 'chip-dark' : ''}`}>{p.isActive ? 'Đang bán' : 'Đã tắt'}</span></div>
              <div className="small">{p.code} · {p.durationDays} ngày · <strong>{money(p.price)}</strong></div>
              <Field label="Giá (VNĐ) — chỉ áp dụng cho giao dịch mới">
                <div className="row" style={{ flexWrap: 'nowrap' }}>
                  <input name="price" className="input" type="number" min="1000" step="1000" defaultValue={p.price} />
                  <button className="btn btn-sm">Lưu</button>
                </div>
              </Field>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => this.savePlan(p, { isActive: !p.isActive })}>{p.isActive ? 'Tắt gói' : 'Bật gói'}</button>
            </form>
          ))}
        </div>
        <div>
          <div className="row-between adm-toolbar">
            <Tabs items={[['', 'Tất cả'], ['SUCCESS', 'Thành công'], ['PENDING', 'Đang xử lý'], ['FAILED', 'Thất bại']]} value={f.status || ''} onChange={(status) => this.filter({ status })} />
            <div className="row">
              <input className="input adm-search adm-month" type="month" value={f.month || ''} onChange={(e) => this.filter({ month: e.target.value })} aria-label="Lọc theo tháng" />
              {meta && <span className="muted">Doanh thu: <strong>{money(meta.revenue)}</strong></span>}
            </div>
          </div>
          {this.body()}
        </div>
      </div>
    );
  }
}
