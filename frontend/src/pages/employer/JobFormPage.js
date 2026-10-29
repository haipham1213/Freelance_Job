import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { api, fieldErrors } from '../../api';
import { Spinner, Field, Alert, Modal, BackLink, ShiftGrid } from '../../components/ui';
import { toInputDate } from '../../utils/format';
import withRouter from '../../utils/withRouter';

const EMPTY = { title: '', description: '', requirements: '', categoryId: '', city: '', district: '', address: '', salaryType: 'HOURLY', salaryMin: '', salaryMax: '', schedule: '', shifts: [], startDate: toInputDate(new Date()), endDate: '', slots: 1 };

// SCR-E03 / FR-JOB-01, FR-JOB-02
class JobFormPage extends Component {
  state = { form: null, categories: [], locked: false, errors: {}, error: '', busy: false, quota: false };
  isEdit = () => !!this.props.params.id;

  async componentDidMount() {
    const cats = (await api.get('/categories')).data;
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
    this.setState({ form, categories: cats, locked, noCompany });
  }

  set = (k) => (e) => this.setState({ form: { ...this.state.form, [k]: e.target.value }, errors: { ...this.state.errors, [k]: '' } });

  submit = async (e) => {
    e.preventDefault();
    const f = this.state.form;
    const body = { ...f, salaryMin: Number(f.salaryMin), salaryMax: Number(f.salaryMax), slots: Number(f.slots), endDate: f.endDate || null };
    for (const k of ['requirements', 'district', 'address', 'schedule']) if (!body[k]) delete body[k];
    this.setState({ busy: true, error: '', errors: {} });
    try {
      const r = this.isEdit() ? await api.put(`/jobs/${this.props.params.id}`, body) : await api.post('/jobs', body);
      this.props.navigate(`/jobs/${r.data.job._id}`);
    } catch (err) {
      // FR-JOB-01 bước 4a: hết hạn mức → mời nâng cấp, dữ liệu form vẫn giữ
      this.setState({ busy: false, error: err.message, errors: fieldErrors(err), quota: err.code === 'QUOTA_EXCEEDED' });
    }
  };

  render() {
    const { form, categories, locked, errors, noCompany } = this.state;
    if (!form) return <Spinner />;
    if (noCompany)
      return (
        <div className="container page" style={{ maxWidth: 1000 }}>
          <BackLink to="/employer/jobs">Tin tuyển dụng</BackLink>
          <div className="card section stack" style={{ marginTop: 16 }}>
            <h1 className="h-sm">Hoàn thiện hồ sơ công ty trước khi đăng tin</h1>
            <p className="muted">Tin tuyển dụng cần tên, địa chỉ và số điện thoại công ty để sinh viên tin tưởng ứng tuyển.</p>
            <Link to="/employer/company" className="btn" style={{ alignSelf: 'flex-start' }}>Cập nhật hồ sơ công ty</Link>
          </div>
        </div>
      );
    const input = (k, label, props = {}) => (
      <Field label={label} error={errors[k]}><input className="input" value={form[k]} onChange={this.set(k)} {...props} /></Field>
    );
    return (
      <div className="container page" style={{ maxWidth: 1000 }}>
        <BackLink to="/employer/jobs">Tin tuyển dụng</BackLink>
        <header className="emp-head" style={{ marginTop: 16 }}>
          <div>
            <span className="eyebrow eyebrow-dot">Nhà tuyển dụng</span>
            <h1 className="display">{this.isEdit() ? 'Sửa tin tuyển dụng' : 'Đăng tin tuyển dụng'}</h1>
            <p className="muted">Mô tả rõ ràng, lương minh bạch giúp tin của bạn nhận nhiều ứng viên hơn.</p>
          </div>
        </header>
        {locked && <div style={{ marginBottom: 16 }}><Alert type="warn">Tin đã nhận người: không sửa được lương, địa điểm, ngày bắt đầu; số chỗ không được nhỏ hơn số người đã nhận.</Alert></div>}
        <form className="panel emp-form" onSubmit={this.submit}>
          <section className="emp-form-sec">
            <div><h2>Thông tin chung</h2><p className="muted small">Tiêu đề, danh mục và mô tả công việc.</p></div>
            <div className="stack-lg">
              {input('title', `Tiêu đề * (${form.title.length}/120)`, { required: true, minLength: 10, maxLength: 120, placeholder: 'VD: Nhân viên phục vụ ca tối, Quận 1' })}
              <div className="grid-2">
                <Field label="Danh mục *" error={errors.categoryId}>
                  <select className="select" required value={form.categoryId} onChange={this.set('categoryId')}>
                    <option value="">Chọn danh mục</option>
                    {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </Field>
                {input('slots', 'Số người cần tuyển * (1 - 50)', { type: 'number', required: true, min: 1, max: 50 })}
              </div>
              <Field label={`Mô tả công việc * (tối thiểu 50 ký tự · ${form.description.length}/5000)`} error={errors.description}>
                <textarea className="textarea" required minLength={50} maxLength={5000} value={form.description} onChange={this.set('description')} style={{ minHeight: 180 }} />
              </Field>
              <Field label="Yêu cầu" error={errors.requirements}>
                <textarea className="textarea" maxLength={2000} value={form.requirements} onChange={this.set('requirements')} />
              </Field>
            </div>
          </section>
          <section className="emp-form-sec">
            <div><h2>Lương & thời gian</h2><p className="muted small">Mức lương hiển thị công khai trên tin.</p></div>
            <div className="grid-3">
              <Field label="Hình thức trả *" error={errors.salaryType}>
                <select className="select" value={form.salaryType} onChange={this.set('salaryType')} disabled={locked}>
                  <option value="HOURLY">Theo giờ</option><option value="DAILY">Theo ngày</option><option value="PROJECT">Theo dự án</option>
                </select>
              </Field>
              {input('salaryMin', 'Lương từ (VNĐ) *', { type: 'number', required: true, min: 1, step: 1, disabled: locked })}
              {input('salaryMax', 'Lương đến (VNĐ) *', { type: 'number', required: true, min: 1, step: 1, disabled: locked })}
              {input('startDate', 'Ngày bắt đầu *', { type: 'date', required: true, disabled: locked, min: this.isEdit() ? undefined : toInputDate(new Date()) })}
              {input('endDate', 'Ngày kết thúc', { type: 'date', min: form.startDate })}
              {input('schedule', 'Giờ làm cụ thể', { maxLength: 200, placeholder: '18h–22h' })}
            </div>
          </section>
          <section className="emp-form-sec">
            <div><h2>Ca làm trong tuần</h2><p className="muted small">Chọn các buổi cần người. Sinh viên lọc việc theo lịch học sẽ thấy tin khi còn ít nhất một buổi rảnh. Bỏ trống nếu giờ làm linh hoạt hoặc làm online.</p></div>
            <Field label="Buổi làm" error={errors.shifts}>
              <ShiftGrid tone="work" value={form.shifts} onChange={(v) => this.setState({ form: { ...form, shifts: v } })} label="Ca làm trong tuần" />
            </Field>
          </section>
          <section className="emp-form-sec">
            <div><h2>Địa điểm</h2><p className="muted small">Nơi sinh viên đến làm việc.</p></div>
            <div className="grid-3">
              {input('city', 'Thành phố *', { required: true, disabled: locked, placeholder: 'TP.HCM' })}
              {input('district', 'Quận / huyện', { disabled: locked })}
              {input('address', 'Địa chỉ', { disabled: locked, maxLength: 200 })}
            </div>
          </section>
          <Alert>{!this.state.quota && this.state.error}</Alert>
          <div className="row" style={{ marginTop: 16, paddingTop: 24, boxShadow: 'inset 0 1px 0 var(--line)' }}>
            <button className="btn" disabled={this.state.busy}>{this.isEdit() ? 'Lưu thay đổi' : 'Đăng tin'}</button>
            <Link to="/employer/jobs" className="btn btn-ghost">Hủy</Link>
          </div>
        </form>
        {this.state.quota && (
          <Modal title="Đã hết hạn mức tin" onClose={() => this.setState({ quota: false })}>
            <p className="muted">{this.state.error}</p>
            <div className="row">
              <Link to="/employer/jobs" className="btn">Đóng bớt tin cũ</Link>
              <button className="btn btn-ghost" onClick={() => this.setState({ quota: false })}>Để sau</button>
            </div>
          </Modal>
        )}
      </div>
    );
  }
}

export default withRouter(JobFormPage);
