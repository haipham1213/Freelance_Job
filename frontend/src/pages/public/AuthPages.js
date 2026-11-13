import React, { Component } from 'react';
import { ArrowLeft, Check, Eye, EyeOff, GraduationCap, Store } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { api, fieldErrors, setAccessToken } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Field, Alert, Spinner, ErrorState } from '../../components/ui';
import { homeOf } from '../../utils/format';
import withRouter from '../../utils/withRouter';

// Bố cục chia đôi kiểu hero saucelabs: bên trái lời giới thiệu và lợi ích ngay trên nền tối, bên phải thẻ form mint bo 40
const PERKS = ['Lương và ca làm công khai trước khi nộp', 'Một CV dùng cho mọi đơn ứng tuyển', 'Đánh giá hai chiều sau mỗi công việc'];
const Shell = ({ title, subtitle, children }) => (
  <div className="container page pub-auth">
    <div className="pub-auth-art" aria-hidden="true">
      <span className="eyebrow eyebrow-dot">UniShift</span>
      <strong className="display">Việc part-time an toàn cho sinh viên</strong>
      <ul>{PERKS.map((p) => <li key={p}><Check size={16} />{p}</li>)}</ul>
    </div>
    <div className="panel pub-auth-form">
      <h1 className="pub-auth-title">{title}</h1>
      {subtitle && <p className="muted pub-auth-sub">{subtitle}</p>}
      <div className="stack-lg pub-auth-body">{children}</div>
    </div>
  </div>
);

// Bàn phím ảo chỉ tự bật khi màn rộng (trên điện thoại autoFocus làm bàn phím che mất form)
const wide = () => !!window.matchMedia?.('(min-width: 768px)').matches;
const EMAIL_PROPS = { type: 'email', required: true, autoComplete: 'email', spellCheck: false, autoCapitalize: 'none' };
// Lỗi theo ô: ném từ client để hiện ngay dưới ô (cùng dạng với lỗi server trả về)
const fail = (field, message) => Object.assign(new Error(message), { details: [{ field, message }] });
// Quy tắc mật khẩu giống server (auth.routes.js): 8–64 ký tự, có chữ và số
const PW_HINT = '8–64 ký tự, có chữ và số';
const checkPassword = (field, p) => {
  if (!p || p.length < 8 || p.length > 64) throw fail(field, 'Mật khẩu cần 8–64 ký tự.');
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) throw fail(field, 'Mật khẩu cần có cả chữ và số.');
};
// next chỉ dùng khi là đường dẫn nội bộ và không thuộc khu vực của vai trò khác (SV kèm next=/admin thì về trang của SV)
const safeNext = (next, role) => (next?.startsWith('/') && !next.startsWith('//') && !['/student', '/employer', '/admin'].some((p) => next.startsWith(p) && p !== homeOf(role)) ? next : null);

// Gửi lại link xác thực: chỉ báo "đã gửi" khi API thành công; lỗi (vd. quá 3 lần/giờ) thì báo thật. comp cần state resending/resent/resendError
const resendVerification = async (comp, email) => {
  comp.setState({ resending: true, resent: false, resendError: '' });
  try {
    await api.post('/auth/resend-verification', { email });
    comp.setState({ resent: true });
  } catch (e) {
    comp.setState({ resendError: e.message });
  }
  comp.setState({ resending: false });
};

// Mẫu form dùng chung: state.form, state.errors (theo trường), state.error (chung)
class FormPage extends Component {
  state = { form: this.initial || {}, errors: {}, error: '', done: '', busy: false, show: {}, resending: false, resent: false, resendError: '' };
  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value }, errors: { ...this.state.errors, [k]: '' } });
  run = async (e, fn) => {
    e.preventDefault();
    this.setState({ busy: true, error: '', errors: {} });
    try {
      await fn();
    } catch (err) {
      const errors = fieldErrors(err);
      // Lỗi đã gắn vào ô hiển thị thì không lặp lại ở Alert chung
      const inline = Object.keys(errors).some((k) => k in this.state.form);
      this.setState({ error: inline ? '' : err.message, errors }, () => document.querySelector('.pub-auth-form [aria-invalid="true"]')?.focus());
    }
    this.setState({ busy: false });
  };
  input = (k, label, { hint, ...props } = {}) => (
    <Field label={label} hint={hint} error={this.state.errors[k]}>
      <input className="input" name={k} value={this.state.form[k] || ''} onChange={this.set(k)} {...props} />
    </Field>
  );
  // Ô mật khẩu có nút hiện / ẩn; nhãn nút cố định, trạng thái nằm ở aria-pressed
  password = (k, label, props = {}) => {
    const shown = !!this.state.show[k];
    return (
      <Field label={label} hint={props.hint} error={this.state.errors[k]}>
        <input className="input" name={k} type={shown ? 'text' : 'password'} autoCapitalize="none" spellCheck={false} value={this.state.form[k] || ''} onChange={this.set(k)} {...props} hint={undefined} />
        <button type="button" className="pw-toggle" aria-pressed={shown} onClick={() => this.setState({ show: { ...this.state.show, [k]: !shown } })}>
          {shown ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}Hiện mật khẩu
        </button>
      </Field>
    );
  };
}

class Login extends FormPage {
  static contextType = AuthContext;
  submit = (e) => this.run(e, async () => {
    this.setState({ unverified: false, resent: false });
    try {
      const user = await this.context.login(this.state.form.email, this.state.form.password);
      this.props.navigate(safeNext(this.props.searchParams.get('next'), user.role) || homeOf(user.role), { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') this.setState({ unverified: true });
      throw err;
    }
  });
  render() {
    if (!this.context.ready) return <Spinner />;
    // Đã đăng nhập mà mở /login?next=… thì vẫn đi tiếp tới next (nếu hợp lệ)
    if (this.context.user && !this.state.busy) return <Navigate to={safeNext(this.props.searchParams.get('next'), this.context.user.role) || homeOf(this.context.user.role)} replace />;
    return (
      <Shell title="Chào mừng trở lại">
        <form className="stack" onSubmit={this.submit} noValidate>
          {this.input('email', 'Email', { ...EMAIL_PROPS, autoFocus: wide() })}
          {this.password('password', 'Mật khẩu', { required: true, autoComplete: 'current-password' })}
          {this.props.searchParams.get('expired') === '1' && !this.state.error && <Alert type="warn">Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.</Alert>}
          <Alert>{this.state.error}</Alert>
          {this.state.unverified && (this.state.resent
            ? <Alert type="ok">Đã gửi lại link xác thực tới {this.state.form.email}. Kiểm tra cả mục Spam.</Alert>
            : <>
              <Alert>{this.state.resendError}</Alert>
              <button type="button" className="btn btn-block btn-ghost" disabled={this.state.resending} onClick={() => resendVerification(this, this.state.form.email)}>{this.state.resending ? 'Đang gửi…' : 'Gửi lại link xác thực'}</button>
            </>)}
          <button className="btn btn-block" disabled={this.state.busy}>{this.state.busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
        </form>
        <div className="row-between small">
          <Link to="/forgot-password" className="accent">Quên mật khẩu?</Link>
          <span className="muted">Chưa có tài khoản? <Link to="/register" className="accent">Đăng ký</Link></span>
        </div>
      </Shell>
    );
  }
}
export const LoginPage = withRouter(Login);

// FR-AUTH-01
class Register extends FormPage {
  initial = { role: this.props.searchParams.get('role') === 'EMPLOYER' ? 'EMPLOYER' : 'STUDENT' };
  state = { ...this.state, form: this.initial };
  submit = (e) => this.run(e, async () => {
    const { confirm, ...body } = this.state.form;
    checkPassword('password', body.password);
    if (body.password !== confirm) throw fail('confirm', 'Mật khẩu xác nhận không khớp');
    await api.post('/auth/register', body);
    this.setState({ done: body.email });
  });
  render() {
    if (this.state.done)
      return (
        <Shell title="Kiểm tra email của bạn">
          <p className="muted">Chúng tôi đã gửi link xác thực tới <strong>{this.state.done}</strong>. Link có hiệu lực trong 24 giờ. Chưa thấy thư? Kiểm tra cả mục Spam.</p>
          {this.state.resent ? <Alert type="ok">Đã gửi lại link xác thực. Kiểm tra cả mục Spam.</Alert> : (
            <>
              <Alert>{this.state.resendError}</Alert>
              <button type="button" className="btn btn-block btn-ghost" disabled={this.state.resending} onClick={() => resendVerification(this, this.state.done)}>{this.state.resending ? 'Đang gửi…' : 'Gửi lại link xác thực'}</button>
            </>
          )}
          <Link to="/login" className="btn btn-block">Đến trang đăng nhập</Link>
        </Shell>
      );
    const { role } = this.state.form;
    return (
      <Shell title="Tạo tài khoản" subtitle="Miễn phí cho sinh viên và nhà tuyển dụng">
        <form className="stack" onSubmit={this.submit} noValidate>
          <fieldset className="pub-role-set">
            <legend className="field-label">Bạn là</legend>
            {[['STUDENT', GraduationCap, 'Sinh viên'], ['EMPLOYER', Store, 'Nhà tuyển dụng']].map(([v, Ico, t]) => (
              <label key={v} className="radio-row">
                <input type="radio" name="role" value={v} checked={role === v} onChange={() => this.setState({ form: { ...this.state.form, role: v } })} />
                <Ico size={16} aria-hidden="true" />{t}
              </label>
            ))}
          </fieldset>
          <p className="fog tiny pub-role-note" aria-live="polite">{role === 'EMPLOYER' ? 'Nhà tuyển dụng: đăng tin tuyển người' : 'Sinh viên: tìm việc làm thêm'}</p>
          {this.input('fullName', role === 'EMPLOYER' ? 'Họ tên người liên hệ' : 'Họ và tên', { required: true, maxLength: 100, autoComplete: 'name' })}
          {this.input('email', 'Email', EMAIL_PROPS)}
          {this.password('password', 'Mật khẩu', { required: true, maxLength: 64, autoComplete: 'new-password', hint: PW_HINT })}
          {this.password('confirm', 'Nhập lại mật khẩu', { required: true, maxLength: 64, autoComplete: 'new-password' })}
          <Alert>{this.state.error}</Alert>
          <p className="small muted">Khi bấm “Đăng ký”, bạn đồng ý với <Link to="/dieu-khoan" className="accent" target="_blank" rel="noopener">Điều khoản sử dụng</Link> và <Link to="/quyen-rieng-tu" className="accent" target="_blank" rel="noopener">Quyền riêng tư</Link> của UniShift (mở ở tab mới).</p>
          <button className="btn btn-block" disabled={this.state.busy}>{this.state.busy ? 'Đang đăng ký…' : 'Đăng ký'}</button>
        </form>
        <p className="small muted center">Đã có tài khoản? <Link to="/login" className="accent">Đăng nhập</Link></p>
      </Shell>
    );
  }
}
export const RegisterPage = withRouter(Register);

// FR-AUTH-02
// Token chỉ dùng được 1 lần; StrictMode (dev) mount 2 lần nên dùng chung một request cho mỗi token,
// tránh lần gọi thứ hai báo "Link không hợp lệ" dù lần đầu đã xác thực xong
const verifying = new Map();
const verifyOnce = (token) => {
  // Lỗi (mất mạng…) thì bỏ khỏi bộ nhớ đệm để "Thử lại" gọi lại được
  if (!verifying.has(token)) verifying.set(token, api.post('/auth/verify-email', { token }).catch((e) => { verifying.delete(token); throw e; }));
  return verifying.get(token);
};

class VerifyEmail extends Component {
  static contextType = AuthContext;
  state = { status: 'loading', message: '', error: null, email: '', resending: false, resent: false, resendError: '' };
  componentDidMount() { this.verify(); }
  verify = async () => {
    this.setState({ status: 'loading' });
    try {
      const r = await verifyOnce(this.props.searchParams.get('token'));
      this.setState({ status: 'ok', message: r.data.message });
      if (this.context.user) this.context.reloadUser().catch(() => {});
    } catch (e) {
      // Có mã trạng thái 4xx = link thật sự không dùng được; mất mạng / 5xx thì cho thử lại
      this.setState({ status: e.status && e.status < 500 ? 'error' : 'failed', message: e.message, error: e });
    }
  };
  resend = (e) => {
    e.preventDefault();
    resendVerification(this, this.state.email);
  };
  render() {
    const { status, message } = this.state;
    if (status === 'loading') return <Spinner />;
    if (status === 'failed') return <Shell title="Chưa xác thực được"><ErrorState error={this.state.error} onRetry={this.verify} title="Không kết nối được máy chủ" /></Shell>;
    if (status === 'ok')
      return (
        <Shell title="Xác thực thành công">
          <p className="muted center">{message.replace(/[.\s]+$/, '')}. Bạn đã có thể dùng đầy đủ chức năng.</p>
          <Link to={this.context.user ? homeOf(this.context.user.role) : '/login'} className="btn btn-block">Tiếp tục</Link>
        </Shell>
      );
    return (
      <Shell title="Link không hợp lệ">
        <Alert>{message}</Alert>
        {this.state.resent ? <Alert type="ok">Nếu email chưa được xác thực, chúng tôi đã gửi link mới.</Alert> : (
          <form className="stack" onSubmit={this.resend}>
            <Field label="Nhập email để nhận link mới"><input className="input" name="email" {...EMAIL_PROPS} value={this.state.email} onChange={(e) => this.setState({ email: e.target.value })} /></Field>
            <Alert>{this.state.resendError}</Alert>
            <button className="btn btn-block" disabled={this.state.resending}>{this.state.resending ? 'Đang gửi…' : 'Gửi lại link xác thực'}</button>
          </form>
        )}
      </Shell>
    );
  }
}
export const VerifyEmailPage = withRouter(VerifyEmail);

// FR-AUTH-05
class Forgot extends FormPage {
  submit = (e) => this.run(e, async () => {
    const r = await api.post('/auth/forgot-password', { email: this.state.form.email });
    this.setState({ done: r.data.message });
  });
  render() {
    return (
      <Shell title="Quên mật khẩu" subtitle="Nhập email, chúng tôi sẽ gửi link đặt lại (hiệu lực 30 phút)">
        {this.state.done ? <Alert type="ok">{this.state.done}</Alert> : (
          <form className="stack" onSubmit={this.submit} noValidate>
            {this.input('email', 'Email', { ...EMAIL_PROPS, autoFocus: wide() })}
            <Alert>{this.state.error}</Alert>
            <button className="btn btn-block" disabled={this.state.busy}>{this.state.busy ? 'Đang gửi…' : 'Gửi link đặt lại'}</button>
          </form>
        )}
        <Link to="/login" className="small accent ico-row pub-auth-back"><ArrowLeft size={16} aria-hidden="true" />Quay lại đăng nhập</Link>
      </Shell>
    );
  }
}
export const ForgotPasswordPage = withRouter(Forgot);

class Reset extends FormPage {
  submit = (e) => this.run(e, async () => {
    const { newPassword, confirm } = this.state.form;
    checkPassword('newPassword', newPassword);
    if (newPassword !== confirm) throw fail('confirm', 'Mật khẩu xác nhận không khớp');
    await api.post('/auth/reset-password', { token: this.props.searchParams.get('token'), newPassword });
    this.setState({ done: 'Đặt lại mật khẩu thành công. Mọi phiên đăng nhập cũ đã bị đăng xuất.' });
  });
  render() {
    // Link không có token thì không có gì để đặt lại: báo ngay thay vì để người dùng nhập rồi mới lỗi
    if (!this.props.searchParams.get('token'))
      return (
        <Shell title="Link không hợp lệ">
          <p className="muted">Link đặt lại mật khẩu thiếu mã xác nhận hoặc đã bị cắt. Hãy yêu cầu một link mới.</p>
          <Link to="/forgot-password" className="btn btn-block">Yêu cầu link mới</Link>
        </Shell>
      );
    return (
      <Shell title="Đặt mật khẩu mới">
        {this.state.done ? (
          <><Alert type="ok">{this.state.done}</Alert><Link to="/login" className="btn btn-block">Đăng nhập</Link></>
        ) : (
          <form className="stack" onSubmit={this.submit} noValidate>
            {this.password('newPassword', 'Mật khẩu mới', { required: true, maxLength: 64, autoComplete: 'new-password', hint: PW_HINT })}
            {this.password('confirm', 'Nhập lại mật khẩu mới', { required: true, maxLength: 64, autoComplete: 'new-password' })}
            <Alert>{this.state.error}</Alert>
            <button className="btn btn-block" disabled={this.state.busy}>{this.state.busy ? 'Đang lưu…' : 'Đặt lại mật khẩu'}</button>
            <p className="small muted center">Link hết hạn? <Link to="/forgot-password" className="accent">Yêu cầu link mới</Link></p>
          </form>
        )}
      </Shell>
    );
  }
}
export const ResetPasswordPage = withRouter(Reset);

// FR-AUTH-06
class ChangePassword extends FormPage {
  submit = (e) => this.run(e, async () => {
    const { currentPassword, newPassword, confirm } = this.state.form;
    checkPassword('newPassword', newPassword);
    if (newPassword !== confirm) throw fail('confirm', 'Mật khẩu xác nhận không khớp');
    // Server thu hồi mọi phiên khác và cấp token mới cho thiết bị này
    const { data } = await api.put('/auth/change-password', { currentPassword, newPassword });
    setAccessToken(data.accessToken);
    this.setState({ done: 'Đổi mật khẩu thành công', form: {} });
  });
  render() {
    return (
      <Shell title="Đổi mật khẩu">
        <form className="stack" onSubmit={this.submit} noValidate>
          {this.password('currentPassword', 'Mật khẩu hiện tại', { required: true, autoComplete: 'current-password' })}
          {this.password('newPassword', 'Mật khẩu mới', { required: true, maxLength: 64, autoComplete: 'new-password', hint: PW_HINT })}
          {this.password('confirm', 'Nhập lại mật khẩu mới', { required: true, maxLength: 64, autoComplete: 'new-password' })}
          <Alert>{this.state.error}</Alert>
          <Alert type="ok">{this.state.done}</Alert>
          <button className="btn btn-block" disabled={this.state.busy}>{this.state.busy ? 'Đang lưu…' : 'Lưu'}</button>
        </form>
      </Shell>
    );
  }
}
export const ChangePasswordPage = withRouter(ChangePassword);
