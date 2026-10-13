import React, { Component } from 'react';
import { ArrowLeft, Building2, Inbox } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_STATUS, JOB_STATUS, PAY_STATUS } from '../utils/format';

export const Spinner = () => <div className="spinner" role="status" aria-label="Đang tải" />;

export const Empty = ({ icon: Icon = Inbox, title, children }) => (
  <div className="empty">
    <div className="empty-icon"><Icon size={24} aria-hidden="true" /></div>
    <div className="h-sm">{title}</div>
    {children && <div className="muted small" style={{ marginTop: 8 }}>{children}</div>}
  </div>
);

export const Alert = ({ type = 'error', children }) => (children ? <div className={`alert alert-${type}`} role={type === 'error' ? 'alert' : 'status'}>{children}</div> : null);

const badge = (map) => ({ status }) => {
  const [label, cls] = map[status] || [status, ''];
  return <span className={`chip ${cls}`}>{label}</span>;
};
export const JobBadge = badge(JOB_STATUS);
export const AppBadge = badge(APP_STATUS);
export const PayBadge = badge(PAY_STATUS);

export const Stars = ({ value = 0, count }) => (
  <span className="small" title={`${value}/5`}>
    <span className="stars">{'★'.repeat(Math.round(value))}<span style={{ color: 'var(--stone-border)' }}>{'★'.repeat(5 - Math.round(value))}</span></span>
    {count !== undefined && <span className="fog"> {count ? `${Number(value).toFixed(1)} (${count})` : 'Chưa có đánh giá'}</span>}
  </span>
);

export const Avatar = ({ src, name = '?', size }) =>
  src ? <img className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`} src={src} alt="" /> : <div className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`}>{name.trim()[0]?.toUpperCase()}</div>;

export const CompanyLogo = ({ src, name = '' }) => (
  <div className="logo-box">{src ? <img src={src} alt={name} /> : <Building2 size={22} />}</div>
);

export const Field = ({ label, error, children }) => (
  <label className="field">
    <span>{label}</span>
    {children}
    {error && <div className="field-error">{error}</div>}
  </label>
);

export const Pagination = ({ meta, onPage }) => {
  if (!meta || meta.total <= meta.limit) return null;
  const pages = Math.ceil(meta.total / meta.limit);
  const nums = [...new Set([1, meta.page - 1, meta.page, meta.page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav className="pagination" aria-label="Phân trang">
      <button className="page-btn page-arrow" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} aria-label="Trang trước">‹</button>
      {nums.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && n - nums[i - 1] > 1 && <span className="page-gap">…</span>}
          <button className={`page-btn ${n === meta.page ? 'active' : ''}`} onClick={() => onPage(n)} aria-current={n === meta.page ? 'page' : undefined}>{n}</button>
        </React.Fragment>
      ))}
      <button className="page-btn page-arrow" disabled={meta.page >= pages} onClick={() => onPage(meta.page + 1)} aria-label="Trang sau">›</button>
    </nav>
  );
};

export const Tabs = ({ items, value, onChange }) => (
  <div className="tabs" role="tablist">
    {items.map(([v, label]) => (
      <button key={v} role="tab" aria-selected={v === value} className={`tab ${v === value ? 'active' : ''}`} onClick={() => onChange(v)}>{label}</button>
    ))}
  </div>
);

export class Modal extends Component {
  onKey = (e) => e.key === 'Escape' && this.props.onClose();
  componentDidMount() { document.addEventListener('keydown', this.onKey); }
  componentWillUnmount() { document.removeEventListener('keydown', this.onKey); }
  render() {
    const { title, onClose, children } = this.props;
    return (
      <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
        <div className="modal stack-lg" role="dialog" aria-modal="true" aria-label={title}>
          <div className="row-between">
            <h2 className="h-md">{title}</h2>
            <button className="btn-link" onClick={onClose} aria-label="Đóng" style={{ fontSize: 24, color: 'var(--muted)', textDecoration: 'none' }}>×</button>
          </div>
          {children}
        </div>
      </div>
    );
  }
}

// Modal nhập lý do (khóa user, ẩn tin, từ chối đơn…)
export class ReasonModal extends Component {
  state = { reason: '', error: '', busy: false };
  submit = async (e) => {
    e.preventDefault();
    if (this.props.required && !this.state.reason.trim()) return this.setState({ error: 'Vui lòng nhập lý do' });
    this.setState({ busy: true, error: '' });
    try {
      await this.props.onSubmit(this.state.reason.trim());
      this.props.onClose();
    } catch (err) {
      this.setState({ error: err.message, busy: false });
    }
  };
  render() {
    const { title, label = 'Lý do', confirm = 'Xác nhận', danger, onClose, children } = this.props;
    return (
      <Modal title={title} onClose={onClose}>
        <form className="stack" onSubmit={this.submit}>
          {children}
          <Field label={label}>
            <textarea className="textarea" maxLength={500} value={this.state.reason} onChange={(e) => this.setState({ reason: e.target.value })} autoFocus />
          </Field>
          <Alert>{this.state.error}</Alert>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
            <button className={`btn ${danger ? 'btn-danger' : ''}`} disabled={this.state.busy}>{confirm}</button>
          </div>
        </form>
      </Modal>
    );
  }
}

export const BackLink = ({ to, children = 'Quay lại' }) => <Link to={to} className="muted small ico-row" style={{ display: 'inline-flex' }}><ArrowLeft size={16} />{children}</Link>;
