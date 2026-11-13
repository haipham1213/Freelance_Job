import React, { Component } from 'react';
import { FileText, Upload } from 'lucide-react';
import { api, fieldErrors } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, Field, Alert, Avatar, ErrorState, LeaveGuard } from '../../components/ui';
import { date } from '../../utils/format';

// SCR-S02 / FR-PRO-01, FR-PRO-02
export default class ProfilePage extends Component {
  static contextType = AuthContext;
  state = { form: null, completion: 0, cv: null, skill: '', errors: {}, msg: '', error: '', loadError: null, dirty: false, cvErr: '', cvOk: '', cvBusy: false, busy: false };
  skillRef = React.createRef();
  reqId = 0;

  componentDidMount() { this.load(); }
  load = async () => {
    const id = ++this.reqId;
    this.setState({ loadError: null });
    try {
      const { data } = await api.get('/students/me');
      if (id !== this.reqId) return;
      const u = data.profile;
      const s = u.student || {};
      this.setState({
        completion: data.completion,
        cv: s.cv,
        form: { fullName: u.fullName, phone: u.phone || '', school: s.school || '', major: s.major || '', yearOfStudy: s.yearOfStudy || '', skills: s.skills || [], bio: s.bio || '' },
      });
    } catch (loadError) {
      if (id === this.reqId) this.setState({ loadError });
    }
  };
  componentWillUnmount() { this.reqId++; }

  // Sửa tiếp thì xóa thông báo "Đã lưu" và đánh dấu chưa lưu
  edit = (patch) => this.setState({ ...patch, msg: '', dirty: true });
  set = (k) => (e) => this.edit({ form: { ...this.state.form, [k]: e.target.value } });

  // Trả về form mới nếu thêm được, null nếu lỗi (đã báo lỗi vào ô Kỹ năng)
  addSkill = (e) => {
    e?.preventDefault();
    const v = this.state.skill.trim();
    const skills = this.state.form.skills;
    const fail = (m) => { this.setState({ errors: { ...this.state.errors, skills: m } }); return null; };
    if (!v) return this.state.form;
    if (skills.some((x) => x.toLowerCase() === v.toLowerCase())) return fail(`Kỹ năng “${v}” đã có trong danh sách`);
    if (skills.length >= 15) return fail('Tối đa 15 kỹ năng, xóa bớt để thêm kỹ năng mới');
    const form = { ...this.state.form, skills: [...skills, v] };
    this.edit({ form, skill: '', errors: { ...this.state.errors, skills: '' } });
    return form;
  };

  removeSkill = (s) => {
    this.edit({ form: { ...this.state.form, skills: this.state.form.skills.filter((x) => x !== s) }, errors: { ...this.state.errors, skills: '' } });
    this.skillRef.current?.focus();
  };

  save = async (e) => {
    e.preventDefault();
    // Chữ đang gõ ở ô Kỹ năng mà chưa bấm "Thêm" thì thêm luôn khi Lưu
    const f = this.addSkill();
    if (!f) return;
    this.setState({ busy: true, msg: '', error: '', errors: {} });
    try {
      const { data } = await api.put('/students/me', { ...f, yearOfStudy: f.yearOfStudy ? Number(f.yearOfStudy) : null });
      this.setState({ completion: data.completion, msg: 'Đã lưu hồ sơ', dirty: false });
      this.context.reloadUser();
    } catch (err) {
      // Lỗi của từng kỹ năng về dạng skills.N → hiện ở ô Kỹ năng
      const errors = fieldErrors(err);
      for (const k of Object.keys(errors)) if (k.startsWith('skills.')) errors.skills = errors[k];
      this.setState({ error: err.message, errors });
    }
    this.setState({ busy: false });
  };

  uploadCv = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (this.state.cvBusy) return;
    if (file.type !== 'application/pdf') return this.setState({ cvErr: 'Chỉ nhận file PDF', cvOk: '' });
    if (file.size > 4 * 1024 * 1024) return this.setState({ cvErr: 'File vượt quá 4 MB', cvOk: '' });
    this.setState({ cvBusy: true, cvErr: '', cvOk: '' });
    try {
      const { data } = await api.post(`/students/me/cv?fileName=${encodeURIComponent(file.name)}`, file);
      this.setState({ cv: data.cv, completion: data.completion, cvOk: 'Đã cập nhật CV. Các đơn đã nộp vẫn giữ CV cũ.' });
      this.context.reloadUser();
    } catch (err) {
      this.setState({ cvErr: err.message });
    }
    this.setState({ cvBusy: false });
  };

  render() {
    const { form, completion, cv, errors, loadError, cvBusy } = this.state;
    if (loadError) return <div className="container page"><ErrorState error={loadError} onRetry={this.load} /></div>;
    if (!form) return <Spinner />;
    const user = this.context.user;
    return (
      <div className="container page">
        <LeaveGuard when={this.state.dirty} />
        <header className="stu-head">
          <div className="stu-head-text">
            <span className="eyebrow eyebrow-dot">Sinh viên</span>
            <h1 className="display">Hồ sơ & CV</h1>
            <p className="muted">Nhà tuyển dụng xem hồ sơ này khi bạn ứng tuyển.</p>
          </div>
        </header>
        <div className="stu-profile">
        <aside className="stack">
          <section className="card stu-me">
            <Avatar src={user.avatarUrl} name={user.fullName} size="lg" />
            <h2 className="h-lg">{form.fullName || user.fullName}</h2>
            <p className="muted small stu-ellipsis">{user.email}</p>
            <div className="stu-me-progress">
              <div className="row-between small"><span>Hồ sơ hoàn thiện</span><strong>{completion}%</strong></div>
              <div className="progress" role="progressbar" aria-label="Hồ sơ hoàn thiện" aria-valuemin={0} aria-valuemax={100} aria-valuenow={completion}><div style={{ width: `${completion}%` }} /></div>
            </div>
          </section>
          <section className="card stu-cv">
            <h2 className="h-sm">CV của bạn</h2>
            <p className="muted small">PDF, tối đa 4 MB. Dùng lại cho mọi đơn ứng tuyển.</p>
            {cv?.url ? (
              <div className="stu-cv-file">
                <FileText size={20} aria-hidden="true" />
                <div>
                  <a href={cv.url} target="_blank" rel="noreferrer" title={cv.fileName}>{cv.fileName}<span className="sr-only"> (mở tab mới)</span></a>
                  <div className="fog tiny">Cập nhật {date(cv.uploadedAt)}</div>
                </div>
                <label className={`btn btn-ghost btn-sm file-pick ${cvBusy ? 'is-disabled' : ''}`}>
                  {cvBusy ? 'Đang tải lên…' : 'Thay CV'}
                  <input type="file" accept="application/pdf" className="sr-only" disabled={cvBusy} onChange={this.uploadCv} />
                </label>
              </div>
            ) : (
              <>
                <Alert type="warn">Bạn cần CV để ứng tuyển.</Alert>
                <label className={`btn btn-block file-pick ${cvBusy ? 'is-disabled' : ''}`}>
                  <Upload size={16} aria-hidden="true" /> {cvBusy ? 'Đang tải lên…' : 'Tải CV lên'}
                  <input type="file" accept="application/pdf" className="sr-only" disabled={cvBusy} onChange={this.uploadCv} />
                </label>
              </>
            )}
            <Alert>{this.state.cvErr}</Alert>
            <Alert type="ok">{this.state.cvOk}</Alert>
            {cvBusy && <div className="small muted" role="status">Đang tải CV lên…</div>}
          </section>
        </aside>
        <form className="card stack-lg" onSubmit={this.save}>
            <h2 className="h-lg">Thông tin cá nhân</h2>
            <div className="grid-2">
              <Field label="Họ và tên *" error={errors.fullName}><input className="input" name="fullName" autoComplete="name" required value={form.fullName} onChange={this.set('fullName')} /></Field>
              <Field label="Số điện thoại" error={errors.phone}><input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={this.set('phone')} placeholder="09xxxxxxxx" /></Field>
              <Field label="Trường" error={errors.school}><input className="input" name="school" autoComplete="organization" value={form.school} onChange={this.set('school')} maxLength={150} /></Field>
              <Field label="Ngành" error={errors.major}><input className="input" name="major" value={form.major} onChange={this.set('major')} maxLength={150} /></Field>
              <Field label="Năm học" error={errors.yearOfStudy}>
                <select className="select" name="yearOfStudy" value={form.yearOfStudy} onChange={this.set('yearOfStudy')}>
                  <option value="">Chọn năm học</option>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>Năm {n}</option>)}
                </select>
              </Field>
            </div>
            <Field label={`Kỹ năng (${form.skills.length}/15)`} error={errors.skills}>
              <div className="row stu-skill-list">
                {form.skills.map((s) => (
                  <span key={s} className="stu-skill">{s}
                    <button type="button" aria-label={`Xóa ${s}`} onClick={() => this.removeSkill(s)}><span aria-hidden="true">×</span></button>
                  </span>
                ))}
              </div>
              <div className="row stu-skill-add">
                <input className="input" name="skill" aria-label="Thêm kỹ năng" ref={this.skillRef} maxLength={30} value={this.state.skill} onChange={(e) => this.setState({ skill: e.target.value, msg: '', dirty: true })} onKeyDown={(e) => e.key === 'Enter' && this.addSkill(e)} placeholder="VD: Excel, Canva, tiếng Anh" />
                <button type="button" className="btn btn-ghost" onClick={this.addSkill}>Thêm</button>
              </div>
            </Field>
            <Field label="Giới thiệu bản thân" error={errors.bio}>
              <textarea className="textarea" name="bio" maxLength={1000} value={form.bio} onChange={this.set('bio')} />
            </Field>
            <Alert>{this.state.error}</Alert>
            <Alert type="ok">{this.state.msg}</Alert>
            <button className="btn btn-lg stu-save" disabled={this.state.busy}>{this.state.busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button>
        </form>
        </div>
      </div>
    );
  }
}
