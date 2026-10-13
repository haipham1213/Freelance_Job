import React, { Component } from 'react';
import { ArrowLeft, Building2, Check, ChevronDown, Inbox, Search } from 'lucide-react';
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

// Bỏ dấu để lọc "phuc vu" khớp "Phục vụ"
const fold = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();
let ddSeq = 0;

// Dropdown thay <select> ở ô tìm kiếm/bộ lọc: danh sách mở được tùy biến (icon, số việc, dấu tích, ô lọc).
// options: [{ value, label, icon?, count? }]; onChange nhận { target: { value } } như sự kiện của <select>.
// Bàn phím: ↑↓ Home End để di chuyển, Enter chọn, Esc/Tab đóng; mở bằng Enter, Space hoặc ↓.
export class Dropdown extends Component {
  state = { open: false, active: 0, filter: '' };
  root = React.createRef();
  btn = React.createRef();
  list = React.createRef();
  input = React.createRef();
  id = `dd-${++ddSeq}`;

  componentDidMount() { document.addEventListener('mousedown', this.outside); }
  componentWillUnmount() { document.removeEventListener('mousedown', this.outside); }
  componentDidUpdate() {
    if (this.state.open) this.list.current?.querySelector('[data-active]')?.scrollIntoView({ block: 'nearest' });
  }
  outside = (e) => this.state.open && !this.root.current.contains(e.target) && this.close(false);

  items = () => {
    const all = [{ value: '', label: this.props.placeholder }, ...this.props.options];
    const f = fold(this.state.filter.trim());
    return f ? all.filter((o) => o.value !== '' && fold(o.label).includes(f)) : all;
  };

  open = () => {
    const active = Math.max(0, this.items().findIndex((o) => String(o.value) === String(this.props.value ?? '')));
    this.setState({ open: true, active, filter: '' }, () => (this.input.current || this.list.current)?.focus());
  };

  close = (refocus = true) => {
    this.setState({ open: false, filter: '' });
    if (refocus) this.btn.current?.focus();
  };

  select = (o) => {
    this.props.onChange({ target: { value: o.value } });
    this.close();
  };

  key = (e) => {
    const n = this.items().length;
    const move = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (move) { e.preventDefault(); this.setState(({ active }) => ({ active: (active + move + n) % Math.max(n, 1) })); }
    else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); this.setState({ active: e.key === 'Home' ? 0 : n - 1 }); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = this.items()[this.state.active]; if (o) this.select(o); }
    else if (e.key === 'Escape') { e.preventDefault(); this.close(); }
    else if (e.key === 'Tab') this.close(false);
  };

  render() {
    const { value, options, placeholder, ariaLabel, className = '', searchable } = this.props;
    const { open, active, filter } = this.state;
    const current = options.find((o) => String(o.value) === String(value ?? ''));
    const items = open ? this.items() : [];
    const activeId = items[active] ? `${this.id}-${active}` : undefined;
    return (
      <div className={`dd ${className} ${open ? 'open' : ''}`} ref={this.root}>
        <button type="button" ref={this.btn} className="dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
          onClick={() => (open ? this.close() : this.open())}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.open(); } }}>
          <span className="dd-value">{current ? current.label : placeholder}</span>
          <ChevronDown size={16} className="dd-chevron" aria-hidden="true" />
        </button>
        {open && (
          <div className="dd-pop" onKeyDown={this.key}>
            {searchable && (
              <label className="dd-filter">
                <Search size={15} aria-hidden="true" />
                <input ref={this.input} value={filter} placeholder="Gõ để lọc" aria-label={`Lọc ${ariaLabel.toLowerCase()}`}
                  aria-controls={this.id} aria-activedescendant={activeId}
                  onChange={(e) => this.setState({ filter: e.target.value, active: 0 })} />
              </label>
            )}
            <ul id={this.id} ref={this.list} role="listbox" tabIndex={-1} aria-label={ariaLabel} aria-activedescendant={activeId}>
              {items.map((o, i) => {
                const Icon = o.icon;
                const selected = String(o.value) === String(value ?? '');
                return (
                  <li key={o.value === '' ? '_all' : o.value} id={`${this.id}-${i}`} role="option" aria-selected={selected}
                    className={`${i === active ? 'active' : ''} ${selected ? 'selected' : ''}`} data-active={i === active || undefined}
                    onMouseEnter={() => this.setState({ active: i })} onMouseDown={(e) => e.preventDefault()} onClick={() => this.select(o)}>
                    {Icon && <Icon size={16} className="dd-icon" aria-hidden="true" />}
                    <span className="dd-label">{o.label}</span>
                    {o.count > 0 && <span className="dd-count">{o.count}</span>}
                    {selected && <Check size={16} className="dd-check" aria-hidden="true" />}
                  </li>
                );
              })}
              {!items.length && <li className="dd-empty" role="presentation">Không có mục nào khớp "{filter}"</li>}
            </ul>
          </div>
        )}
      </div>
    );
  }
}
