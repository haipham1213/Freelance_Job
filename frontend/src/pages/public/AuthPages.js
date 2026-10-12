import React, { Component } from 'react';
import { ArrowLeft, Check, GraduationCap, Store } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { api, fieldErrors } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Field, Alert, Spinner } from '../../components/ui';
import { homeOf } from '../../utils/format';
import { Mascot } from '../../components/Illustrations';
import withRouter from '../../utils/withRouter';

// Bố cục chia đôi kiểu job board: card form + bảng thương hiệu xanh nhạt với lợi ích và một mascot nhỏ
const PERKS = ['Lương và ca làm công khai trước khi nộp', 'Một CV dùng cho mọi đơn ứng tuyển', 'Đánh giá hai chiều sau mỗi công việc'];
const Shell = ({ title, subtitle, emoji, children }) => (
  <div className="container page">
    <div className="card pub-auth">
      <div className="pub-auth-form">
        <h1 className="display">{title}</h1>
        {subtitle && <p className="muted" style={{ marginTop: 8 }}>{subtitle}</p>}
        <div className="stack" style={{ marginTop: 24 }}>{children}</div>
      </div>
      <div className="pub-auth-art" aria-hidden="true">
        <Mascot kind={emoji} size={96} />
        <strong className="h-md">Việc part-time an toàn cho sinh viên</strong>
        <ul>{PERKS.map((p) => <li key={p} className="ico-row"><Check size={18} />{p}</li>)}</ul>
      </div>
    </div>
  </div>
);

// Mẫu form dùng chung: state.form, state.errors (theo trường), state.error (chung)
class FormPage extends Component {
  state = { form: this.initial || {}, errors: {}, error: '', done: '', busy: false };
  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value }, errors: { ...this.state.errors, [k]: '' } });
  run = async (e, fn) => {
    e.preventDefault();
    this.setState({ busy: true, error: '', errors: {} });
    try {
      await fn();
    } catch (err) {
      this.setState({ error: err.message, errors: fieldErrors(err) });
    }
    this.setState({ busy: false });
  };
  input = (k, label, props = {}) => (
    <Field label={label} error={this.state.errors[k]}>
      <input className="input" value={this.state.form[k] || ''} onChange={this.set(k)} {...props} />
    </Field>
  );
}

class Login extends FormPage {
  static contextType = AuthContext;
  submit = (e) => this.run(e, async () => {
    const user = await this.context.login(this.state.form.email, this.state.form.password);
    this.props.navigate(this.props.searchParams.get('next') || homeOf(user.role), { replace: true });
  });
  render() {
    if (!this.context.ready) return <Spinner />;
    if (this.context.user && !this.state.busy) return <Navigate to={homeOf(this.context.user.role)} replace />;
    return (
      <Shell title="Chào mừng trở lại" emoji="blob">
        <form className="stack" onSubmit={this.submit}>
          {this.input('email', 'Email', { type: 'email', required: true, autoComplete: 'email', autoFocus: true })}
          {this.input('password', 'Mật khẩu', { type: 'password', required: true, autoComplete: 'current-password' })}
          <Alert>{this.state.error}</Alert>
          <button className="btn btn-block" disabled={this.state.busy}>Đăng nhập</button>
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
    if (body.password !== confirm) throw Object.assign(new Error('Mật khẩu xác nhận không khớp'), { details: [{ field: 'confirm', message: 'Không khớp' }] });
    await api.post('/auth/register', body);
    this.setState({ done: body.email });
  });
  render() {
    if (this.state.done)
      return (
        <Shell title="Kiểm tra email của bạn" emoji="cloud">
          <p className="muted">Chúng tôi đã gửi link xác thực tới <strong>{this.state.done}</strong>. Link có hiệu lực trong 24 giờ.</p>
          <Link to="/login" className="btn btn-block">Đến trang đăng nhập</Link>
        </Shell>
      );
    const { role } = this.state.form;
    return (
      <Shell title="Tạo tài khoản" subtitle="Miễn phí cho sinh viên và nhà tuyển dụng" emoji="flower">
        <form className="stack" onSubmit={this.submit}>
          <div className="grid-2" role="radiogroup" aria-label="Vai trò">
            {[['STUDENT', GraduationCap, 'Sinh viên', 'Tìm việc làm thêm'], ['EMPLOYER', Store, 'Nhà tuyển dụng', 'Đăng tin tuyển người']].map(([v, Ico, t, d]) => (
              <button type="button" key={v} role="radio" aria-checked={role === v} onClick={() => this.setState({ form: { ...this.state.form, role: v } })}
                className={`pub-role ${role === v ? 'active' : ''}`}>
                <Ico size={28} strokeWidth={1.75} /><div>{t}</div><div className="fog tiny">{d}</div>
              </button>
            ))}
          </div>
          {this.input('fullName', role === 'EMPLOYER' ? 'Họ tên người liên hệ' : 'Họ và tên', { required: true, minLength: 2, maxLength: 100 })}
          {this.input('email', 'Email', { type: 'email', required: true, autoComplete: 'email' })}
          {this.input('password', 'Mật khẩu (8-64 ký tự, có chữ và số)', { type: 'password', required: true, minLength: 8, maxLength: 64, autoComplete: 'new-password' })}
          {this.input('confirm', 'Nhập lại mật khẩu', { type: 'password', required: true, autoComplete: 'new-password' })}
          <Alert>{this.state.error}</Alert>
          <button className="btn btn-block" disabled={this.state.busy}>Đăng ký</button>
        </form>
        <p className="small muted center">Đã có tài khoản? <Link to="/login" className="accent">Đăng nhập</Link></p>
      </Shell>
    );
  }
}
export const RegisterPage = withRouter(Register);

// FR-AUTH-02
class VerifyEmail extends Component {
  static contextType = AuthContext;
  state = { status: 'loading', message: '', email: '', resent: false };
  async componentDidMount() {
    try {
      const r = await api.post('/auth/verify-email', { token: this.props.searchParams.get('token') });
      this.setState({ status: 'ok', message: r.data.message });
      if (this.context.user) this.context.reloadUser().catch(() => {});
    } catch (e) {
      this.setState({ status: 'error', message: e.message });
    }
  }
  resend = async (e) => {
    e.preventDefault();
    await api.post('/auth/resend-verification', { email: this.state.email }).catch(() => {});
    this.setState({ resent: true });
  };
  render() {
    const { status, message } = this.state;
    if (status === 'loading') return <Spinner />;
    if (status === 'ok')
      return (
        <Shell title="Xác thực thành công" emoji="blob">
          <p className="muted center">{message}. Bạn đã có thể dùng đầy đủ chức năng.</p>
          <Link to={this.context.user ? homeOf(this.context.user.role) : '/login'} className="btn btn-block">Tiếp tục</Link>
        </Shell>
      );
    return (
      <Shell title="Link không hợp lệ" emoji="triangle">
        <Alert>{message}</Alert>
        {this.state.resent ? <Alert type="ok">Nếu email chưa được xác thực, chúng tôi đã gửi link mới.</Alert> : (
          <form className="stack" onSubmit={this.resend}>
            <Field label="Nhập email để nhận link mới"><input className="input" type="email" required value={this.state.email} onChange={(e) => this.setState({ email: e.target.value })} /></Field>
            <button className="btn btn-block">Gửi lại link xác thực</button>
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
      <Shell title="Quên mật khẩu" subtitle="Nhập email, chúng tôi sẽ gửi link đặt lại (hiệu lực 30 phút)" emoji="triangle">
        {this.state.done ? <Alert type="ok">{this.state.done}</Alert> : (
          <form className="stack" onSubmit={this.submit}>
            {this.input('email', 'Email', { type: 'email', required: true, autoFocus: true })}
            <Alert>{this.state.error}</Alert>
            <button className="btn btn-block" disabled={this.state.busy}>Gửi link đặt lại</button>
          </form>
        )}
        <Link to="/login" className="small accent ico-row" style={{ justifyContent: 'center' }}><ArrowLeft size={16} />Quay lại đăng nhập</Link>
      </Shell>
    );
  }
}
export const ForgotPasswordPage = withRouter(Forgot);

class Reset extends FormPage {
  submit = (e) => this.run(e, async () => {
    const { newPassword, confirm } = this.state.form;
    if (newPassword !== confirm) throw new Error('Mật khẩu xác nhận không khớp');
    await api.post('/auth/reset-password', { token: this.props.searchParams.get('token'), newPassword });
    this.setState({ done: 'Đặt lại mật khẩu thành công. Mọi phiên đăng nhập cũ đã bị đăng xuất.' });
  });
  render() {
    return (
      <Shell title="Đặt mật khẩu mới" emoji="cloud">
        {this.state.done ? (
          <><Alert type="ok">{this.state.done}</Alert><Link to="/login" className="btn btn-block">Đăng nhập</Link></>
        ) : (
          <form className="stack" onSubmit={this.submit}>
            {this.input('newPassword', 'Mật khẩu mới (8-64 ký tự, có chữ và số)', { type: 'password', required: true, minLength: 8, autoComplete: 'new-password' })}
            {this.input('confirm', 'Nhập lại mật khẩu mới', { type: 'password', required: true })}
            <Alert>{this.state.error}</Alert>
            <button className="btn btn-block" disabled={this.state.busy}>Đặt lại mật khẩu</button>
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
    if (newPassword !== confirm) throw new Error('Mật khẩu xác nhận không khớp');
    await api.put('/auth/change-password', { currentPassword, newPassword });
    this.setState({ done: 'Đổi mật khẩu thành công', form: {} });
  });
  render() {
    return (
      <Shell title="Đổi mật khẩu" emoji="flower">
        <form className="stack" onSubmit={this.submit}>
          {this.input('currentPassword', 'Mật khẩu hiện tại', { type: 'password', required: true, autoComplete: 'current-password' })}
          {this.input('newPassword', 'Mật khẩu mới', { type: 'password', required: true, minLength: 8, autoComplete: 'new-password' })}
          {this.input('confirm', 'Nhập lại mật khẩu mới', { type: 'password', required: true })}
          <Alert>{this.state.error}</Alert>
          <Alert type="ok">{this.state.done}</Alert>
          <button className="btn btn-block" disabled={this.state.busy}>Lưu</button>
        </form>
      </Shell>
    );
  }
}
export const ChangePasswordPage = withRouter(ChangePassword);
