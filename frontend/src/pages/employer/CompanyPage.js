import React, { Component } from 'react';
import { api, fieldErrors } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Field, Alert, CompanyLogo } from '../../components/ui';

// SCR-E02 / FR-PRO-03
export default class CompanyPage extends Component {
  static contextType = AuthContext;
  state = { form: null, logoUrl: '', isPremium: false, errors: {}, msg: '', error: '', logoMsg: '', busy: false };

  async componentDidMount() {
    const { data } = await api.get('/employers/me');
    const c = data.company || {};
    this.setState({
      isPremium: data.isPremium,
      logoUrl: c.logoUrl,
      form: { fullName: data.user.fullName, name: c.name || '', address: c.address || '', phone: c.phone || '', city: c.city || '', district: c.district || '', website: c.website || '', description: c.description || '' },
    });
  }

  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value } });

  save = async (e) => {
    e.preventDefault();
    this.setState({ busy: true, msg: '', error: '', errors: {} });
    try {
      await api.put('/employers/me', this.state.form);
      this.setState({ msg: 'Đã lưu hồ sơ công ty' });
      this.context.reloadUser();
    } catch (err) {
      this.setState({ error: err.message, errors: fieldErrors(err) });
    }
    this.setState({ busy: false });
  };

  uploadLogo = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return this.setState({ logoMsg: 'Chỉ nhận ảnh JPG hoặc PNG' });
    if (file.size > 2 * 1024 * 1024) return this.setState({ logoMsg: 'Ảnh vượt quá 2 MB' });
    try {
      const { data } = await api.post('/employers/me/logo', file);
      this.setState({ logoUrl: data.logoUrl, logoMsg: 'Đã cập nhật logo' });
      this.context.reloadUser();
    } catch (err) {
      this.setState({ logoMsg: err.message });
    }
  };

  render() {
    const { form, errors, logoUrl } = this.state;
    if (!form) return <Spinner />;
    const input = (k, label, props = {}) => (
      <Field label={label} error={errors[k]}><input className="input" value={form[k]} onChange={this.set(k)} {...props} /></Field>
    );
    return (
      <div className="container page">
        <header className="emp-head">
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">Hồ sơ công ty</h1>
            <p className="muted">Thông tin rõ ràng giúp sinh viên tin tưởng và ứng tuyển nhiều hơn.</p>
          </div>
        </header>
        <div className="layout-main">
          <form className="card stack-lg" onSubmit={this.save}>
            <div className="grid-2">
              {input('name', 'Tên công ty / cửa hàng *', { required: true, minLength: 2, maxLength: 150 })}
              {input('phone', 'Số điện thoại *', { required: true, placeholder: '09xxxxxxxx' })}
            </div>
            {input('address', 'Địa chỉ *', { required: true, maxLength: 200 })}
            <div className="grid-2">
              {input('city', 'Thành phố', { placeholder: 'TP.HCM' })}
              {input('district', 'Quận / huyện')}
              {input('website', 'Website', { type: 'url', placeholder: 'https://' })}
              {input('fullName', 'Người liên hệ')}
            </div>
            <Field label={`Giới thiệu (${form.description.length}/2000)`} error={errors.description}>
              <textarea className="textarea" maxLength={2000} value={form.description} onChange={this.set('description')} />
            </Field>
            <Alert>{this.state.error}</Alert>
            <Alert type="ok">{this.state.msg}</Alert>
            <div><button className="btn" disabled={this.state.busy}>Lưu hồ sơ</button></div>
          </form>
          <aside className="card emp-logo-card">
            <CompanyLogo src={logoUrl} />
            {this.state.isPremium && <span className="chip chip-featured">★ Premium</span>}
            <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
              Đổi logo
              <input type="file" accept="image/jpeg,image/png" hidden onChange={this.uploadLogo} />
            </label>
            <div className="fog tiny">JPG hoặc PNG, tối đa 2 MB</div>
            {this.state.logoMsg && <div className="small">{this.state.logoMsg}</div>}
          </aside>
        </div>
      </div>
    );
  }
}
