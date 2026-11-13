import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { api, fieldErrors } from '../../api';
import { Spinner, Field, Alert, Modal, ConfirmModal, LeaveGuard, ErrorState, BackLink, ShiftGrid } from '../../components/ui';
import { toInputDate } from '../../utils/format';
import withRouter from '../../utils/withRouter';

const EMPTY = { title: '', description: '', requirements: '', categoryId: '', city: '', district: '', address: '', salaryType: 'HOURLY', salaryMin: '', salaryMax: '', schedule: '', shifts: [], startDate: toInputDate(new Date()), endDate: '', slots: 1 };
const NUMERIC = ['salaryMin', 'salaryMax', 'slots'];

// Kiểm tra phía client bằng tiếng Việt (thay thông báo mặc định của trình duyệt), lỗi theo từng ô
const validate = (f) => {
  const e = {};
  if (!f.title.trim()) e.title = 'Vui lòng nhập tiêu đề';
  else if (f.title.trim().length < 10) e.title = 'Tiêu đề tối thiểu 10 ký tự';
  if (!f.categoryId) e.categoryId = 'Vui lòng chọn danh mục';
  const slots = Number(f.slots);
  if (!Number.isInteger(slots) || slots < 1 || slots > 50) e.slots = 'Số người cần tuyển từ 1–50';
  if (f.description.trim().length < 50) e.description = `Mô tả tối thiểu 50 ký tự (hiện có ${f.description.trim().length})`;
  if (!(Number(f.salaryMin) > 0)) e.salaryMin = 'Nhập mức lương lớn hơn 0';
  if (!(Number(f.salaryMax) > 0)) e.salaryMax = 'Nhập mức lương lớn hơn 0';
  else if (!e.salaryMin && Number(f.salaryMin) > Number(f.salaryMax)) e.salaryMax = 'Lương đến phải lớn hơn hoặc bằng lương từ';
  if (!f.startDate) e.startDate = 'Vui lòng chọn ngày bắt đầu';
  if (f.endDate && f.startDate && f.endDate < f.startDate) e.endDate = 'Ngày kết thúc phải sau ngày bắt đầu';
  if (!f.city.trim()) e.city = 'Vui lòng nhập thành phố';
  return e;
};

// SCR-E03 / FR-JOB-01, FR-JOB-02
class JobFormPage extends Component {
  state = { form: null, categories: [], cities: [], locked: false, errors: {}, error: '', loadError: null, busy: false, quota: false, dirty: false, leave: false };
  formRef = React.createRef();
  isEdit = () => !!this.props.params.id;

  componentDidMount() { this.load(); }

  load = async () => {
    this.setState({ loadError: null });
    try {
      const cats = (await api.get('/categories')).data;
      // Gợi ý thành phố có sẵn để nhập thống nhất với bộ lọc; lỗi thì chỉ mất gợi ý
      const cities = (await api.get('/jobs/locations').catch(() => ({ data: [] }))).data.map((l) => l.city);
      let form = { ...EMPTY };
      let locked = false;
      let noCompany = false;
      if (this.isEdit()) {
        const { job, category } = (await api.get(`/jobs/${this.props.params.id}`)).data;
        // Danh mục đã bị admin ẩn sau khi đăng: vẫn hiện để giữ nguyên khi sửa
        if (category && !cats.some((c) => c._id === category._id)) cats.push(category);
        form = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, job[k] ?? '']));
        form.startDate = toInputDate(job.startDate);
        form.endDate = toInputDate(job.endDate);
        form.categoryId = String(job.categoryId);
        form.shifts = job.shifts || [];
        locked = job.acceptedCount > 0;
      } else {
        // US-13: chưa đủ tên, địa chỉ, SĐT công ty thì nhắc ngay thay vì để điền hết form mới báo lỗi
        const { company } = (await api.get('/employers/me')).data;
        noCompany = !(company?.name && company?.address && company?.phone);
      }
      form.slots = String(form.slots);
      NUMERIC.forEach((k) => { form[k] = form[k] === '' ? '' : String(form[k]); });
      this.setState({ form, categories: cats, cities, locked, noCompany });
    } catch (loadError) {
      this.setState({ loadError });
    }
  };

  // Tiền / số người: ô text chỉ nhận chữ số (không bị lăn chuột đổi giá trị như type=number)
  set = (k) => (e) => {
    const v = NUMERIC.includes(k) ? e.target.value.replace(/\D/g, '') : e.target.value;
    this.setState({ form: { ...this.state.form, [k]: v }, errors: { ...this.state.errors, [k]: '' }, dirty: true });
  };

  // Cuộn và focus tới ô lỗi đầu tiên (ô, hoặc nút đầu của nhóm như lưới ca)
  focusFirstError = () => {
    const err = this.formRef.current?.querySelector('.field-error');
    const target = err?.closest('.field')?.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button');
    target?.focus();
    (target || err)?.scrollIntoView?.({ block: 'center' });
  };

  submit = async (e) => {
    e.preventDefault();
    const f = this.state.form;
    const local = validate(f);
    if (Object.keys(local).length) return this.setState({ errors: local, error: 'Vui lòng kiểm tra lại các ô báo lỗi.' }, this.focusFirstError);
    const body = { ...f, salaryMin: Number(f.salaryMin), salaryMax: Number(f.salaryMax), slots: Number(f.slots), endDate: f.endDate || null };
    for (const k of ['requirements', 'district', 'address', 'schedule']) if (!body[k]) delete body[k];
    this.setState({ busy: true, error: '', errors: {} });
    try {
      const r = this.isEdit() ? await api.put(`/jobs/${this.props.params.id}`, body) : await api.post('/jobs', body);
      // Về danh sách tin kèm thông báo thành công (MyJobsPage đọc location.state.flash)
      this.setState({ dirty: false }, () => this.props.navigate('/employer/jobs', { state: { flash: this.isEdit() ? `Đã lưu thay đổi tin “${r.data.job.title}”` : `Đã đăng tin “${r.data.job.title}”` } }));
    } catch (err) {
      // FR-JOB-01 bước 4a: hết hạn mức → mời nâng cấp, dữ liệu form vẫn giữ
      this.setState({ busy: false, error: err.message, errors: fieldErrors(err), quota: err.code === 'QUOTA_EXCEEDED' }, this.focusFirstError);
    }
  };

  render() {
    const { form, categories, cities, locked, errors, noCompany, loadError, busy, dirty, leave } = this.state;
    if (loadError) return <div className="container page"><ErrorState error={loadError} onRetry={this.load} /></div>;
    if (!form) return <Spinner />;
    if (noCompany)
      return (
        <div className="container page emp-narrow">
          <BackLink to="/employer/jobs">Tin tuyển dụng</BackLink>
          <div className="card section stack emp-mt16">
            <h1 className="h-sm">Hoàn thiện hồ sơ công ty trước khi đăng tin</h1>
            <p className="muted">Tin tuyển dụng cần tên, địa chỉ và số điện thoại công ty để sinh viên tin tưởng ứng tuyển.</p>
            <Link to="/employer/company" className="btn emp-start">Cập nhật hồ sơ công ty</Link>
          </div>
        </div>
      );
    const input = (k, label, props = {}) => (
      <Field label={label} error={errors[k]} hint={props.hint}><input className="input" value={form[k]} onChange={this.set(k)} {...{ ...props, hint: undefined }} /></Field>
    );
    const money = (k, label) => input(k, label, { type: 'text', inputMode: 'numeric', autoComplete: 'off', disabled: locked });
    return (
      <div className="container page emp-narrow">
        <LeaveGuard when={dirty} />
        <BackLink to="/employer/jobs">Tin tuyển dụng</BackLink>
        <header className="emp-head emp-mt16">
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">{this.isEdit() ? 'Sửa tin tuyển dụng' : 'Đăng tin tuyển dụng'}</h1>
            <p className="muted">Mô tả rõ ràng, lương minh bạch giúp tin của bạn nhận nhiều ứng viên hơn.</p>
          </div>
        </header>
        {locked && <div className="emp-mb16"><Alert type="warn">Tin đã nhận người: không sửa được lương, địa điểm, ngày bắt đầu; số chỗ không được nhỏ hơn số người đã nhận.</Alert></div>}
        <form className="panel emp-form" onSubmit={this.submit} noValidate ref={this.formRef}>
          <section className="emp-form-sec">
            <div><h2>Thông tin chung</h2><p className="muted small">Tiêu đề, danh mục và mô tả công việc.</p></div>
            <div className="stack-lg">
              {input('title', 'Tiêu đề *', { required: true, maxLength: 120, placeholder: 'VD: Nhân viên phục vụ ca tối, Quận 1', hint: 'Tối thiểu 10 ký tự.' })}
              <div className="grid-2">
                <Field label="Danh mục *" error={errors.categoryId}>
                  <select className="select" required value={form.categoryId} onChange={this.set('categoryId')}>
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </Field>
                {input('slots', 'Số người cần tuyển * (1–50)', { type: 'text', inputMode: 'numeric', autoComplete: 'off', required: true })}
              </div>
              <Field label="Mô tả công việc *" error={errors.description} hint="Tối thiểu 50 ký tự.">
                <textarea className="textarea emp-textarea-lg" required maxLength={5000} value={form.description} onChange={this.set('description')} />
              </Field>
              <Field label="Yêu cầu" error={errors.requirements}>
                <textarea className="textarea" maxLength={2000} value={form.requirements} onChange={this.set('requirements')} />
              </Field>
            </div>
          </section>
          <section className="emp-form-sec">
            <div><h2>Lương và thời gian</h2><p className="muted small">Mức lương hiển thị công khai trên tin.</p></div>
            <div className="grid-3">
              <Field label="Hình thức trả *" error={errors.salaryType}>
                <select className="select" value={form.salaryType} onChange={this.set('salaryType')} disabled={locked}>
                  <option value="HOURLY">Theo giờ</option><option value="DAILY">Theo ngày</option><option value="PROJECT">Theo dự án</option>
                </select>
              </Field>
              {money('salaryMin', 'Lương từ (đ) *')}
              {money('salaryMax', 'Lương đến (đ) *')}
              {input('startDate', 'Ngày bắt đầu *', { type: 'date', required: true, disabled: locked, min: this.isEdit() ? undefined : toInputDate(new Date()) })}
              {input('endDate', 'Ngày kết thúc', { type: 'date', min: form.startDate })}
              {input('schedule', 'Giờ làm cụ thể', { maxLength: 200, placeholder: '18h–22h' })}
            </div>
          </section>
          <section className="emp-form-sec">
            <div><h2>Ca làm trong tuần</h2><p className="muted small">Chọn các buổi cần người. Sinh viên lọc việc theo lịch học sẽ thấy tin khi còn ít nhất một buổi rảnh. Bỏ trống nếu giờ làm linh hoạt hoặc làm online.</p></div>
            {/* ShiftGrid không phải control gốc nên Field tự bọc thành role="group" có tên */}
            <Field label="Buổi làm" error={errors.shifts}>
              <ShiftGrid tone="work" value={form.shifts} onChange={(v) => this.setState({ form: { ...form, shifts: v }, dirty: true })} label="Ca làm trong tuần" />
            </Field>
          </section>
          <section className="emp-form-sec">
            <div><h2>Địa điểm</h2><p className="muted small">Nơi sinh viên đến làm việc.</p></div>
            <div className="grid-3">
              {input('city', 'Thành phố *', { required: true, disabled: locked, placeholder: 'TP.HCM', list: 'emp-cities', autoComplete: 'off' })}
              {input('district', 'Quận / huyện', { disabled: locked })}
              {input('address', 'Địa chỉ', { disabled: locked, maxLength: 200 })}
            </div>
            <datalist id="emp-cities">{cities.map((c) => <option key={c} value={c} />)}</datalist>
          </section>
          <Alert>{!this.state.quota && this.state.error}</Alert>
          <div className="row emp-form-actions">
            <button className="btn" disabled={busy}>{busy ? 'Đang lưu…' : this.isEdit() ? 'Lưu thay đổi' : 'Đăng tin'}</button>
            {dirty
              ? <button type="button" className="btn btn-ghost" onClick={() => this.setState({ leave: true })}>Hủy</button>
              : <Link to="/employer/jobs" className="btn btn-ghost">Hủy</Link>}
          </div>
        </form>
        {leave && (
          <ConfirmModal title="Bỏ thay đổi?" confirm="Bỏ thay đổi" danger onConfirm={() => this.props.navigate('/employer/jobs')} onClose={() => this.setState({ leave: false })}>
            <p className="muted">Những gì bạn đã nhập trong form này sẽ bị mất.</p>
          </ConfirmModal>
        )}
        {this.state.quota && (
          <Modal title="Đã hết hạn mức tin" onClose={() => this.setState({ quota: false })}>
            <p className="muted">{this.state.error}</p>
            <div className="row">
              {/* Mở tab mới để form đang nhập không bị mất */}
              <a href="/employer/premium" target="_blank" rel="noopener noreferrer" className="btn">Xem gói Premium (tab mới)</a>
              <button type="button" className="btn btn-ghost" onClick={() => this.setState({ quota: false })}>Để sau</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }
}

export default withRouter(JobFormPage);
