import React, { Component } from 'react';
import { AlertTriangle, ArrowLeft, Building2, Check, ChevronDown, Inbox, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { APP_STATUS, JOB_STATUS, PAY_STATUS, DAYS, DAY_NAMES, PERIODS } from '../utils/format';

export const Spinner = () => (
  <div role="status">
    <div className="spinner" aria-hidden="true" />
    <span className="sr-only">Đang tải…</span>
  </div>
);

export const Empty = ({ icon: Icon = Inbox, title, children }) => (
  <div className="empty">
    <div className="empty-icon"><Icon size={24} aria-hidden="true" /></div>
    <div className="h-sm">{title}</div>
    {children && <div className="muted small empty-body">{children}</div>}
  </div>
);

// Trạng thái lỗi tải dữ liệu dùng chung: thông báo + nút "Thử lại" (thay cho spinner vô hạn)
export const ErrorState = ({ error, onRetry, title = 'Không tải được dữ liệu' }) => (
  <div className="empty" role="alert">
    <div className="empty-icon"><AlertTriangle size={24} aria-hidden="true" /></div>
    <div className="h-sm">{title}</div>
    <div className="muted small empty-body">{(typeof error === 'string' ? error : error?.message) || 'Đã có lỗi xảy ra. Kiểm tra kết nối rồi thử lại.'}</div>
    {onRetry && <button type="button" className="btn btn-outline btn-sm empty-action" onClick={onRetry}>Thử lại</button>}
  </div>
);

// Vùng live luôn nằm trong DOM, nội dung đổ vào sau → trình đọc màn hình đọc được thông báo mới
export const Alert = ({ type = 'error', children }) => (
  <div className="alert-live" role={type === 'error' ? 'alert' : 'status'}>
    {children ? <div className={`alert alert-${type}`}>{children}</div> : null}
  </div>
);

const badge = (map) => ({ status }) => {
  const [label, cls] = map[status] || [status, ''];
  return <span className={`chip ${cls}`}>{label}</span>;
};
export const JobBadge = badge(JOB_STATUS);
export const AppBadge = badge(APP_STATUS);
export const PayBadge = badge(PAY_STATUS);

const rating1 = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const Stars = ({ value = 0, count }) => {
  const n = Math.min(5, Math.max(0, Math.round(value)));
  return (
    <span className="small">
      <span className="stars" role="img" aria-label={`${rating1.format(value)} trên 5 sao`}>{'★'.repeat(n)}<span className="stars-off">{'★'.repeat(5 - n)}</span></span>
      {count !== undefined && <span className="fog"> {count ? `${rating1.format(value)} (${count})` : 'Chưa có đánh giá'}</span>}
    </span>
  );
};

export const Avatar = ({ src, name = '?', size }) =>
  src ? <img className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`} src={src} alt="" /> : <div className={`avatar ${size === 'lg' ? 'avatar-lg' : ''}`}>{name.trim()[0]?.toUpperCase()}</div>;

export const CompanyLogo = ({ src, name = '' }) => (
  <div className="logo-box">{src ? <img src={src} alt={name} /> : <Building2 size={22} />}</div>
);

// Lưới 7 ngày × 3 buổi để tô lịch học (tone="busy") hoặc ca làm (tone="work"). Bấm tên ngày / tên buổi để chọn cả cột / cả hàng
export const ShiftGrid = ({ value, onChange, tone = 'work', label }) => {
  const on = new Set(value);
  const word = tone === 'busy' ? 'Học' : 'Làm';
  const toggle = (cells) => {
    const all = cells.every((c) => on.has(c));
    cells.forEach((c) => (all ? on.delete(c) : on.add(c)));
    onChange([...on].sort((a, b) => a - b));
  };
  return (
    <div className={`shift-grid shift-${tone}`} role="group" aria-label={label}>
      <span />
      {DAYS.map((d, di) => (
        <button key={d} type="button" className="shift-head" onClick={() => toggle([0, 1, 2].map((p) => di * 3 + p))} aria-label={`${d}, chọn cả ngày ${DAY_NAMES[di]}`}>{d}</button>
      ))}
      {PERIODS.map((p, pi) => (
        <React.Fragment key={p}>
          <button type="button" className="shift-head shift-row" onClick={() => toggle(DAYS.map((_, di) => di * 3 + pi))} aria-label={`${p}, chọn mọi buổi ${p.toLowerCase()}`}>{p}</button>
          {DAYS.map((_, di) => {
            const i = di * 3 + pi;
            return (
              <button key={i} type="button" className="shift-cell" aria-pressed={on.has(i)} aria-label={`${p} ${DAY_NAMES[di]}`} onClick={() => toggle([i])}>
                {on.has(i) && word}
              </button>
            );
          })}
        </React.Fragment>
      ))}
    </div>
  );
};

const CONTROLS = ['input', 'select', 'textarea'];
let fieldSeq = 0;
// Một control → <label for> + aria-invalid/aria-describedby gắn vào control; nhiều control (lưới ca, nhóm radio…) → role="group".
// Lỗi nằm ngoài <label>. Textarea có maxLength tự hiện bộ đếm ký tự.
export class Field extends Component {
  id = `f-${++fieldSeq}`;
  render() {
    const { label, error, hint, children } = this.props;
    const kids = React.Children.toArray(children);
    const controls = kids.filter((k) => React.isValidElement(k) && CONTROLS.includes(k.type));
    const single = controls.length === 1 ? controls[0] : null;
    const errId = `${this.id}-err`;
    const hintId = `${this.id}-hint`;
    const describedBy = [error && errId, hint && hintId].filter(Boolean).join(' ') || undefined;
    const max = single?.props.maxLength;
    const len = typeof single?.props.value === 'string' ? single.props.value.length : null;
    const body = kids.map((k) => (k === single
      ? React.cloneElement(k, { id: k.props.id || this.id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })
      : k));
    return (
      <div className="field" role={single ? undefined : 'group'} aria-labelledby={single ? undefined : `${this.id}-lbl`} aria-describedby={single ? undefined : describedBy}>
        {single
          ? <label className="field-label" id={`${this.id}-lbl`} htmlFor={single.props.id || this.id}>{label}</label>
          : <span className="field-label" id={`${this.id}-lbl`}>{label}</span>}
        {body}
        {max && len !== null && <div className="field-count" aria-hidden="true">{len}/{max}</div>}
        {hint && <div className="field-hint small muted" id={hintId}>{hint}</div>}
        {error && <div className="field-error" id={errId}>{error}</div>}
      </div>
    );
  }
}

export const Pagination = ({ meta, onPage }) => {
  if (!meta || meta.total <= meta.limit) return null;
  const pages = Math.ceil(meta.total / meta.limit);
  const go = (n) => { onPage(n); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  const nums = [...new Set([1, meta.page - 1, meta.page, meta.page + 1, pages])].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  return (
    <nav className="pagination" aria-label="Phân trang">
      <button className="page-btn page-arrow" disabled={meta.page <= 1} onClick={() => go(meta.page - 1)} aria-label="Trang trước">‹</button>
      {nums.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && n - nums[i - 1] > 1 && <span className="page-gap" aria-hidden="true">…</span>}
          <button className={`page-btn ${n === meta.page ? 'active' : ''}`} onClick={() => go(n)} aria-label={`Trang ${n}`} aria-current={n === meta.page ? 'page' : undefined}>{n}</button>
        </React.Fragment>
      ))}
      <button className="page-btn page-arrow" disabled={meta.page >= pages} onClick={() => go(meta.page + 1)} aria-label="Trang sau">›</button>
    </nav>
  );
};

// Bộ lọc dạng tab: các nút bật/tắt (aria-pressed) trong một nhóm có tên; nội dung bên dưới do trang tự đổi nên không dùng role="tab"
export const Tabs = ({ items, value, onChange, label = 'Lọc theo trạng thái' }) => (
  <div className="tabs" role="group" aria-label={label}>
    {items.map(([v, text]) => (
      <button key={v} type="button" aria-pressed={v === value} className={`tab ${v === value ? 'active' : ''}`} onClick={() => onChange(v)}>{text}</button>
    ))}
  </div>
);

// Hộp thoại: focus vào ô đầu tiên khi mở (và khi đổi tiêu đề/focusKey), Tab vòng trong hộp, Esc để đóng, trả focus khi đóng, khóa cuộn nền.
// busy: không đóng được (Esc/nền/nút X) khi đang gửi; dirty: hỏi lại trước khi bỏ nội dung đang nhập.
const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
let modalSeq = 0;
let scrollLocks = 0;
export class Modal extends Component {
  box = React.createRef();
  titleId = `modal-${++modalSeq}`;
  state = { askDiscard: false };
  requestClose = () => {
    const { busy, dirty, onClose } = this.props;
    if (busy) return;
    if (dirty && !this.state.askDiscard) return this.setState({ askDiscard: true });
    onClose();
  };
  onKey = (e) => {
    if (e.key === 'Escape') return this.requestClose();
    if (e.key !== 'Tab') return;
    const els = [...this.box.current.querySelectorAll(FOCUSABLE)];
    const [first, last] = [els[0], els[els.length - 1]];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  focusFirst = () => {
    const els = [...this.box.current.querySelectorAll(FOCUSABLE)];
    (els.find((el) => el.matches('textarea, input, select')) || els[0] || this.box.current)?.focus();
  };
  componentDidMount() {
    this.returnTo = document.activeElement;
    document.addEventListener('keydown', this.onKey);
    if (scrollLocks++ === 0) document.body.style.overflow = 'hidden';
    this.focusFirst();
  }
  componentDidUpdate(prev) {
    if (prev.title !== this.props.title || prev.focusKey !== this.props.focusKey) this.focusFirst();
  }
  componentWillUnmount() {
    document.removeEventListener('keydown', this.onKey);
    if (--scrollLocks === 0) document.body.style.overflow = '';
    this.returnTo?.focus?.();
  }
  render() {
    const { title, children, busy } = this.props;
    return (
      <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && this.requestClose()}>
        <div className="modal stack-lg" role="dialog" aria-modal="true" aria-labelledby={this.titleId} tabIndex={-1} ref={this.box}>
          <div className="modal-head">
            <h2 className="h-md" id={this.titleId}>{title}</h2>
            <button type="button" className="modal-x" onClick={this.requestClose} disabled={busy} aria-label="Đóng"><X size={20} aria-hidden="true" /></button>
          </div>
          {children}
          {this.state.askDiscard && (
            <div className="alert alert-warn stack" role="alertdialog" aria-label="Xác nhận bỏ nội dung">
              <div>Nội dung bạn đang nhập sẽ bị mất. Đóng hộp thoại?</div>
              <div className="row">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => this.setState({ askDiscard: false }, this.focusFirst)}>Tiếp tục nhập</button>
                <button type="button" className="btn btn-danger btn-sm" onClick={this.props.onClose}>Bỏ nội dung</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
}

// Hộp thoại xác nhận hành động khó hoàn tác: nêu hậu quả trong children, nút đổi nhãn khi đang xử lý
export class ConfirmModal extends Component {
  state = { busy: false, error: '' };
  submit = async () => {
    this.setState({ busy: true, error: '' });
    try {
      await this.props.onConfirm();
      this.props.onClose();
    } catch (err) {
      this.setState({ error: err.message, busy: false });
    }
  };
  render() {
    const { title, confirm = 'Xác nhận', danger, onClose, children } = this.props;
    const { busy, error } = this.state;
    return (
      <Modal title={title} onClose={onClose} busy={busy}>
        <div className="stack">{children}</div>
        <Alert>{error}</Alert>
        <div className="row row-end">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : ''}`} onClick={this.submit} disabled={busy}>{busy ? 'Đang xử lý…' : confirm}</button>
        </div>
      </Modal>
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
    const { title, label = 'Lý do', confirm = 'Xác nhận', danger, onClose, children, required } = this.props;
    const { reason, error, busy } = this.state;
    // Lỗi bắt buộc nhập gắn vào ô lý do; lỗi từ máy chủ hiện ở Alert
    const missing = required && error === 'Vui lòng nhập lý do';
    return (
      <Modal title={title} onClose={onClose} busy={busy} dirty={!!reason.trim()}>
        <form className="stack" onSubmit={this.submit}>
          {children}
          <Field label={label} error={missing ? error : ''}>
            <textarea className="textarea" maxLength={500} value={reason} onChange={(e) => this.setState({ reason: e.target.value, error: '' })} />
          </Field>
          {!missing && <Alert>{error}</Alert>}
          <div className="row row-end">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Hủy</button>
            <button className={`btn ${danger ? 'btn-danger' : ''}`} disabled={busy}>{busy ? 'Đang xử lý…' : confirm}</button>
          </div>
        </form>
      </Modal>
    );
  }
}

export const BackLink = ({ to, children = 'Quay lại' }) => <Link to={to} className="muted small ico-row back-link"><ArrowLeft size={16} aria-hidden="true" />{children}</Link>;

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
        <button type="button" ref={this.btn} className="dd-btn" aria-haspopup="listbox" aria-expanded={open} aria-labelledby={ariaLabel ? `${this.id}-lbl ${this.id}-val` : undefined}
          onClick={() => (open ? this.close() : this.open())}
          onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.open(); } }}>
          {ariaLabel && <span id={`${this.id}-lbl`} className="sr-only">{ariaLabel}: </span>}
          <span className="dd-value" id={`${this.id}-val`}>{current ? current.label : placeholder}</span>
          <ChevronDown size={16} className="dd-chevron" aria-hidden="true" />
        </button>
        {open && (
          <div className="dd-pop" onKeyDown={this.key}>
            {searchable && (
              <label className="dd-filter">
                <Search size={15} aria-hidden="true" />
                <input ref={this.input} value={filter} placeholder="Gõ để lọc" aria-label={`Lọc ${(ariaLabel || placeholder || '').toLowerCase()}`}
                  aria-controls={this.id} aria-activedescendant={activeId}
                  onChange={(e) => this.setState({ filter: e.target.value, active: 0 })} />
              </label>
            )}
            <ul id={this.id} ref={this.list} role="listbox" tabIndex={-1} aria-label={ariaLabel || placeholder} aria-activedescendant={activeId}>
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
              {!items.length && <li className="dd-empty" role="presentation">Không có mục nào khớp “{filter}”</li>}
            </ul>
          </div>
        )}
      </div>
    );
  }
}
