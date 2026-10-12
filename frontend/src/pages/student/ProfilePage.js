import React, { Component } from 'react';
import { FileText, Upload } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Field, Alert, Avatar } from '../../components/ui';
import { date } from '../../utils/format';

// SCR-S02 / FR-PRO-01, FR-PRO-02
export default class ProfilePage extends Component {
  static contextType = AuthContext;
  state = { form: null, completion: 0, cv: null, skill: '', errors: {}, msg: '', error: '', cvMsg: '', busy: false };

  async componentDidMount() {
    const { data } = await api.get('/students/me');
    const u = data.profile;
    const s = u.student || {};
    this.setState({
      completion: data.completion,
      cv: s.cv,
      form: { fullName: u.fullName, phone: u.phone || '', school: s.school || '', major: s.major || '', yearOfStudy: s.yearOfStudy || '', skills: s.skills || [], bio: s.bio || '' },
    });
  }

  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value } });

  addSkill = (e) => {
    e.preventDefault();
    const v = this.state.skill.trim();
    const skills = this.state.form.skills;
    if (!v || skills.includes(v) || skills.length >= 15) return;
    this.setState({ form: { ...this.state.form, skills: [...skills, v] }, skill: '' });
  };

  save = async (e) => {
    e.preventDefault();
    this.setState({ busy: true, msg: '', error: '', errors: {} });
    try {
      const f = this.state.form;
      const { data } = await api.put('/students/me', { ...f, yearOfStudy: f.yearOfStudy ? Number(f.yearOfStudy) : null });
      this.setState({ completion: data.completion, msg: 'Đã lưu hồ sơ' });
      this.context.reloadUser();
    } catch (err) {
      this.setState({ error: err.message, errors: fieldErrors(err) });
    }
    this.setState({ busy: false });
  };

  uploadCv = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf') return this.setState({ cvMsg: 'Chỉ nhận file PDF' });
    if (file.size > 5 * 1024 * 1024) return this.setState({ cvMsg: 'File vượt quá 5 MB' });
    this.setState({ cvMsg: 'Đang tải lên…' });
    try {
      const { data } = await api.post(`/students/me/cv?fileName=${encodeURIComponent(file.name)}`, file);
      this.setState({ cv: data.cv, completion: data.completion, cvMsg: 'Đã cập nhật CV. Các đơn đã nộp vẫn giữ CV cũ.' });
      this.context.reloadUser();
    } catch (err) {
      this.setState({ cvMsg: err.message });
    }
  };

  render() {
    const { form, completion, cv, errors } = this.state;
    if (!form) return <Spinner />;
    const user = this.context.user;
    return (
      <div className="container page stu-profile">
        <aside className="stack">
          <section className="card stu-me">
            <Avatar src={user.avatarUrl} name={user.fullName} size="lg" />
            <h1 className="h-lg">{form.fullName || user.fullName}</h1>
            <p className="muted small stu-ellipsis">{user.email}</p>
            <div className="stu-me-progress">
              <div className="row-between small"><span>Hồ sơ hoàn thiện</span><strong className="accent">{completion}%</strong></div>
              <div className="progress"><div style={{ width: `${completion}%` }} /></div>
            </div>
          </section>
          <section className="card stu-cv">
            <h2 className="h-sm">CV của bạn</h2>
            <p className="muted small">PDF, tối đa 5 MB. Dùng lại cho mọi đơn ứng tuyển.</p>
            {cv?.url ? (
              <div className="stu-cv-file">
                <a href={cv.url} target="_blank" rel="noreferrer" className="ico-row accent"><FileText size={18} />{cv.fileName}</a>
                <div className="fog tiny">Cập nhật {date(cv.uploadedAt)}</div>
              </div>
            ) : <Alert type="warn">Bạn cần CV để ứng tuyển.</Alert>}
            <label className="btn btn-block" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> {cv?.url ? 'Thay CV' : 'Tải CV lên'}
              <input type="file" accept="application/pdf" hidden onChange={this.uploadCv} />
            </label>
            {this.state.cvMsg && <div className="small">{this.state.cvMsg}</div>}
          </section>
        </aside>
        <form className="card stack-lg" onSubmit={this.save}>
            <h2 className="h-lg">Thông tin cá nhân</h2>
            <div className="grid-2">
              <Field label="Họ và tên *" error={errors.fullName}><input className="input" required value={form.fullName} onChange={this.set('fullName')} /></Field>
              <Field label="Số điện thoại" error={errors.phone}><input className="input" value={form.phone} onChange={this.set('phone')} placeholder="09xxxxxxxx" /></Field>
              <Field label="Trường" error={errors.school}><input className="input" value={form.school} onChange={this.set('school')} maxLength={150} /></Field>
              <Field label="Ngành" error={errors.major}><input className="input" value={form.major} onChange={this.set('major')} maxLength={150} /></Field>
              <Field label="Năm học" error={errors.yearOfStudy}>
                <select className="select" value={form.yearOfStudy} onChange={this.set('yearOfStudy')}>
                  <option value="">Chọn năm học</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Năm {n}</option>)}
                </select>
              </Field>
            </div>
            <Field label={`Kỹ năng (${form.skills.length}/15)`} error={errors.skills}>
              <div className="row" style={{ gap: 8 }}>
                {form.skills.map((s) => (
                  <span key={s} className="stu-skill">{s}
                    <button type="button" aria-label={`Xóa ${s}`} onClick={() => this.setState({ form: { ...form, skills: form.skills.filter((x) => x !== s) } })}>×</button>
                  </span>
                ))}
              </div>
              <div className="row" style={{ marginTop: 10, flexWrap: 'nowrap' }}>
                <input className="input" maxLength={30} value={this.state.skill} onChange={(e) => this.setState({ skill: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && this.addSkill(e)} placeholder="VD: Excel, Canva, tiếng Anh" />
                <button type="button" className="btn btn-ghost" onClick={this.addSkill}>Thêm</button>
              </div>
            </Field>
            <Field label={`Giới thiệu bản thân (${form.bio.length}/1000)`} error={errors.bio}>
              <textarea className="textarea" maxLength={1000} value={form.bio} onChange={this.set('bio')} />
            </Field>
            <Alert>{this.state.error}</Alert>
            <Alert type="ok">{this.state.msg}</Alert>
            <button className="btn btn-lg" disabled={this.state.busy} style={{ alignSelf: 'flex-start' }}>Lưu hồ sơ</button>
        </form>
      </div>
    );
  }
}
