import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { api, fieldErrors } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Field, Alert, CompanyLogo, ErrorState, LeaveGuard } from '../../components/ui';

// SCR-E02 / FR-PRO-03
export default class CompanyPage extends Component {
  static contextType = AuthContext;
  state = { form: null, cities: [], logoUrl: '', isPremium: false, errors: {}, msg: '', error: '', logo: { type: 'ok', text: '' }, logoBusy: false, loadError: null, busy: false, dirty: false };

  componentDidMount() { this.load(); }

  load = async () => {
    this.setState({ loadError: null });
    try {
      // Gợi ý thành phố có sẵn để nhập thống nhất với bộ lọc; lỗi thì chỉ mất gợi ý
      const [{ data }, loc] = await Promise.all([api.get('/employers/me'), api.get('/jobs/locations').catch(() => ({ data: [] }))]);
      const cities = loc.data.map((l) => l.city);
      const c = data.company || {};
      this.setState({
        cities,
        isPremium: data.isPremium,
        logoUrl: c.logoUrl,
        form: { fullName: data.user.fullName, name: c.name || '', address: c.address || '', phone: c.phone || '', city: c.city || '', district: c.district || '', website: c.website || '', description: c.description || '' },
      });
    } catch (loadError) {
      this.setState({ loadError });
    }
  };

  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value }, errors: { ...this.state.errors, [k]: '' }, dirty: true });

  save = async (e) => {
    e.preventDefault();
    this.setState({ busy: true, msg: '', error: '', errors: {} });
    try {
      await api.put('/employers/me', this.state.form);
      this.setState({ msg: 'Đã lưu hồ sơ công ty', dirty: false });
      await this.context.reloadUser().catch(() => {});
    } catch (err) {
      this.setState({ error: err.message, errors: fieldErrors(err) });
    }
    this.setState({ busy: false });
  };

  uploadLogo = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type)) return this.setState({ logo: { type: 'error', text: 'Chỉ nhận ảnh JPG hoặc PNG' } });
    if (file.size > 2 * 1024 * 1024) return this.setState({ logo: { type: 'error', text: 'Ảnh vượt quá 2 MB' } });
    this.setState({ logoBusy: true, logo: { type: 'ok', text: '' } });
    try {
      const { data } = await api.post('/employers/me/logo', file);
      this.setState({ logoUrl: data.logoUrl, logo: { type: 'ok', text: 'Đã cập nhật logo' } });
      this.context.reloadUser();
    } catch (err) {
      this.setState({ logo: { type: 'error', text: err.message } });
    }
    this.setState({ logoBusy: false });
  };

  render() {
    const { form, errors, logoUrl, loadError, cities, logo, logoBusy, busy, dirty } = this.state;
    if (loadError) return <div className="container page"><ErrorState error={loadError} onRetry={this.load} /></div>;
    if (!form) return <Spinner />;
    const input = (k, label, props = {}) => (
      <Field label={label} error={errors[k]}><input className="input" name={k} value={form[k]} onChange={this.set(k)} {...props} /></Field>
    );
    return (
      <div className="container page">
        <LeaveGuard when={dirty} />
        <header className="emp-head">
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">Hồ sơ công ty</h1>
            <p className="muted">Thông tin rõ ràng giúp sinh viên tin tưởng và ứng tuyển nhiều hơn.</p>
          </div>
          <Link to={`/employers/${this.context.user._id}`} className="btn btn-ghost">Xem trang công khai</Link>
        </header>
        <div className="layout-main">
          <form className="card stack-lg" onSubmit={this.save}>
            <div className="grid-2">
              {input('name', 'Tên công ty / cửa hàng *', { required: true, minLength: 2, maxLength: 150, autoComplete: 'organization' })}
              {input('phone', 'Số điện thoại *', { type: 'tel', required: true, placeholder: '09xxxxxxxx', autoComplete: 'tel' })}
            </div>
            {input('address', 'Địa chỉ *', { required: true, maxLength: 200, autoComplete: 'street-address' })}
            <div className="grid-2">
              {input('city', 'Thành phố', { placeholder: 'TP.HCM', list: 'emp-cities', autoComplete: 'address-level2' })}
              {input('district', 'Quận / huyện', { autoComplete: 'address-level3' })}
              {input('website', 'Website', { type: 'url', placeholder: 'https://', autoComplete: 'url' })}
              {input('fullName', 'Người liên hệ', { autoComplete: 'name' })}
            </div>
            <Field label="Giới thiệu" error={errors.description}>
              <textarea className="textarea" maxLength={2000} value={form.description} onChange={this.set('description')} />
            </Field>
            <datalist id="emp-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
            <Alert>{this.state.error}</Alert>
            <Alert type="ok">{this.state.msg}</Alert>
            <div><button className="btn" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div>
          </form>
          <aside className="card emp-logo-card">
            <CompanyLogo src={logoUrl} />
            {this.state.isPremium && <span className="chip chip-featured"><span aria-hidden="true">★ </span>Premium</span>}
            <label className={`btn btn-ghost file-pick ${logoBusy ? 'is-disabled' : ''}`}>
              {logoBusy ? 'Đang tải logo…' : 'Đổi logo'}
              <input type="file" className="sr-only" accept="image/jpeg,image/png" disabled={logoBusy} onChange={this.uploadLogo} />
            </label>
            <div className="fog tiny">JPG hoặc PNG, tối đa 2 MB</div>
            <Alert type={logo.type}>{logo.text}</Alert>
          </aside>
        </div>
      </div>
    );
  }
}
