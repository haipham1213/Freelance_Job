import React, { Component } from 'react';
import { Check, FileText, GraduationCap, Mail, Phone, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { AuthContext } from '../../context/AuthContext';
import { Spinner, AppBadge, Stars, Avatar, CompanyLogo, Modal, Field, Alert, ReasonModal, BackLink } from '../../components/ui';
import ErrorPage from '../public/ErrorPage';
import { date, dateTime, APP_STATUS, salary } from '../../utils/format';
import withRouter from '../../utils/withRouter';

// SCR-S06 / SCR-E07: chấm 1–5 sao, nhận xét ≤ 500 ký tự
class ReviewModal extends Component {
  state = { rating: 0, comment: '', error: '', busy: false };
  submit = async (e) => {
    e.preventDefault();
    if (!this.state.rating) return this.setState({ error: 'Vui lòng chọn số sao' });
    this.setState({ busy: true, error: '' });
    try {
      await api.post(`/applications/${this.props.appId}/reviews`, { rating: this.state.rating, comment: this.state.comment || undefined });
      this.props.onDone();
    } catch (err) {
      this.setState({ error: err.message, busy: false });
    }
  };
  render() {
    return (
      <Modal title={`Đánh giá ${this.props.name}`} onClose={this.props.onClose}>
        <form className="stack" onSubmit={this.submit}>
          <div className="center" role="radiogroup" aria-label="Số sao">
            {[1, 2, 3, 4, 5].map((n) => (
              <button type="button" key={n} className={`star-btn ${n <= this.state.rating ? 'on' : ''}`} onClick={() => this.setState({ rating: n })} aria-label={`${n} sao`}>★</button>
            ))}
          </div>
          <Field label="Nhận xét (không bắt buộc)">
            <textarea className="textarea" maxLength={500} value={this.state.comment} onChange={(e) => this.setState({ comment: e.target.value })} />
          </Field>
          <p className="fog tiny">Đánh giá không sửa hoặc xóa được sau khi gửi.</p>
          <Alert>{this.state.error}</Alert>
          <button className="btn" disabled={this.state.busy}>Gửi đánh giá</button>
        </form>
      </Modal>
    );
  }
}

class ApplicationDetailPage extends Component {
  static contextType = AuthContext;
  state = { data: null, error: null, modal: null, note: '', msg: '', busy: false };

  componentDidMount() { this.load(); }
  load = async () => {
    try {
      const r = await api.get(`/applications/${this.props.params.id}`);
      this.setState({ data: r.data, modal: null });
    } catch (error) {
      this.setState({ error });
    }
  };

  act = async (fn, msg) => {
    this.setState({ busy: true, msg: '' });
    try {
      await fn();
      await this.load();
      this.setState({ msg });
    } catch (e) {
      this.setState({ msg: e.message, modal: null });
    }
    this.setState({ busy: false });
  };

  employerActions(app, job) {
    const id = app._id;
    if (app.status === 'PENDING')
      return (
        <div className="stack">
          <Field label="Ghi chú hướng dẫn khi nhận (ngày giờ, người liên hệ…)">
            <textarea className="textarea" maxLength={500} value={this.state.note} onChange={(e) => this.setState({ note: e.target.value })} placeholder="VD: Đến chi nhánh lúc 17h45 ngày 15/10, gặp chị Hà" />
          </Field>
          <div className="row">
            <button className="btn" disabled={this.state.busy} onClick={() => this.act(() => api.patch(`/applications/${id}/accept`, { employerNote: this.state.note || undefined }), 'Đã nhận ứng viên')}><Check size={18} /> Nhận</button>
            <button className="btn btn-ghost" onClick={() => this.setState({ modal: 'reject' })}>Từ chối</button>
          </div>
        </div>
      );
    if (app.status === 'ACCEPTED') {
      const started = new Date(job.startDate) <= new Date();
      return (
        <div className="stack">
          <p className="muted small">Xác nhận kết quả sau khi công việc bắt đầu ({date(job.startDate)}).</p>
          <div className="row">
            <button className="btn" disabled={!started || this.state.busy} onClick={() => this.act(() => api.patch(`/applications/${id}/result`, { result: 'COMPLETED' }), 'Đã xác nhận hoàn thành')}><Check size={18} /> Hoàn thành</button>
            <button className="btn btn-ghost" disabled={!started} onClick={() => this.setState({ modal: 'notCompleted' })}>Không hoàn thành</button>
          </div>
        </div>
      );
    }
    return null;
  }

  render() {
    const { data, error, modal, msg } = this.state;
    if (error) return <ErrorPage code={error.status === 403 ? 403 : 404} message={error.message} />;
    if (!data) return <Spinner />;
    const { application: app, job, student, employer, reviews, canReview, reviewDeadline } = data;
    const role = this.context.user.role;
    const isEmployer = role === 'EMPLOYER';
    const other = isEmployer ? student : employer;
    const contactOpen = ['ACCEPTED', 'COMPLETED', 'NOT_COMPLETED'].includes(app.status);
    return (
      <div className="container page">
        <BackLink to={isEmployer ? `/employer/jobs/${app.jobId}/applicants` : '/student/applications'}>{isEmployer ? 'Danh sách ứng viên' : 'Đơn của tôi'}</BackLink>
        <header className="stu-app-hero pub-app-head">
          {isEmployer ? <Avatar src={student.avatarUrl} name={student.fullName} size="lg" /> : <CompanyLogo src={employer.company?.logoUrl} name={app.jobSnapshot.companyName} />}
          <div className="stu-hero-main">
            <div className="row" style={{ gap: 10 }}>
              <AppBadge status={app.status} />
              <span className="fog small">Nộp lúc {dateTime(app.createdAt)}</span>
            </div>
            <h1 className="display"><Link to={`/jobs/${app.jobId}`} className="stu-detail-title">{app.jobSnapshot.title}</Link></h1>
            <p className="muted">{app.jobSnapshot.companyName}{job && `, ${salary(job)}, bắt đầu ${date(job.startDate)}`}</p>
          </div>
          <a href={app.cvUrl} target="_blank" rel="noreferrer" className="btn btn-ghost"><FileText size={18} /> Xem CV đã nộp</a>
        </header>
        <div className="layout-main pub-app">
          <div className="stack-lg">
            <div className="card stack pub-app-card">
              {app.coverLetter && <div className="card-sm card-white"><div className="fog small">Thư giới thiệu</div><p className="pre">{app.coverLetter}</p></div>}
              {app.employerNote && <Alert type="ok"><strong>Hướng dẫn từ nhà tuyển dụng:</strong> {app.employerNote}</Alert>}
              {app.rejectReason && <Alert>Lý do từ chối: {app.rejectReason}</Alert>}
              {app.notCompletedReason && <Alert>Lý do không hoàn thành: {app.notCompletedReason}</Alert>}
              <Alert type="info">{msg}</Alert>
              {isEmployer ? this.employerActions(app, job) : app.status === 'PENDING' && (
                <button className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} onClick={() => this.act(() => api.patch(`/applications/${app._id}/withdraw`), 'Đã rút đơn')}>Rút đơn</button>
              )}
              {!app.coverLetter && !app.employerNote && !app.rejectReason && !app.notCompletedReason && !msg && !(isEmployer ? ['PENDING', 'ACCEPTED'] : ['PENDING']).includes(app.status) && (
                <p className="muted">Không có thao tác nào cần làm với đơn này.</p>
              )}
            </div>
            <div className="card pub-app-card">
              <h2 className="h-md">Lịch sử trạng thái</h2>
              <ol className="stu-timeline">
                {app.statusHistory.map((h, i) => (
                  <li key={i}><span className="h-sm">{APP_STATUS[h.status]?.[0]}</span><span className="fog small">{dateTime(h.at)}</span></li>
                ))}
              </ol>
            </div>
            {(reviews.length > 0 || canReview) && (
              <div className="card stack pub-app-card">
                <h2 className="h-md">Đánh giá</h2>
                {reviews.map((r) => (
                  <div key={r._id} className="card-sm card-white">
                    <div className="small">{r.reviewerRole === 'STUDENT' ? 'Sinh viên' : 'Nhà tuyển dụng'} đánh giá <Stars value={r.rating} /></div>
                    {r.comment && <p className="muted small">{r.comment}</p>}
                  </div>
                ))}
                {canReview && (
                  <div className="row-between">
                    <span className="muted small">Hạn đánh giá: {date(reviewDeadline)}</span>
                    <button className="btn" onClick={() => this.setState({ modal: 'review' })}><Star size={18} /> Đánh giá {isEmployer ? 'sinh viên' : 'nhà tuyển dụng'}</button>
                  </div>
                )}
              </div>
            )}
          </div>
          <aside className="card stack pub-app-side">
            <h2 className="h-md">{isEmployer ? 'Ứng viên' : 'Nhà tuyển dụng'}</h2>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              {isEmployer ? <Avatar src={student.avatarUrl} name={student.fullName} size="lg" /> : <CompanyLogo src={employer.company?.logoUrl} />}
              <div style={{ minWidth: 0 }}>
                <div className="h-sm">{isEmployer ? student.fullName : employer.company?.name}</div>
                <Stars value={other.ratingAvg} count={other.ratingCount} />
              </div>
            </div>
            {isEmployer && student.student && (
              <div className="stack small">
                {student.student.school && <div className="ico-row"><GraduationCap size={16} />{student.student.school}{student.student.major && `, ${student.student.major}`}{student.student.yearOfStudy && `, năm ${student.student.yearOfStudy}`}</div>}
                {student.student.skills?.length > 0 && <div className="row" style={{ gap: 6 }}>{student.student.skills.map((s) => <span key={s} className="chip">{s}</span>)}</div>}
                {student.student.bio && <p className="muted pre">{student.student.bio}</p>}
              </div>
            )}
            {!isEmployer && <Link to={`/employers/${employer._id}`} className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }}>Trang công ty</Link>}
            <div className="stu-contact">
              <h3 className="h-sm">Liên hệ</h3>
              {contactOpen ? (
                <div className="stack small stu-contact-open">
                  <div className="ico-row"><Mail size={16} /><a href={`mailto:${other.email}`}>{other.email}</a></div>
                  {other.phone && <div className="ico-row"><Phone size={16} /><a href={`tel:${other.phone}`}>{other.phone}</a></div>}
                </div>
              ) : <p className="fog small">Thông tin liên hệ hiển thị khi đơn được nhận.</p>}
            </div>
          </aside>
        </div>
        {modal === 'review' && <ReviewModal appId={app._id} name={isEmployer ? student.fullName : employer.company?.name} onClose={() => this.setState({ modal: null })} onDone={() => { this.load(); this.setState({ msg: 'Cảm ơn bạn đã đánh giá!' }); }} />}
        {modal === 'reject' && (
          <ReasonModal title="Từ chối ứng viên" label="Lý do (không bắt buộc, sinh viên sẽ thấy)" confirm="Từ chối" danger onClose={() => this.setState({ modal: null })}
            onSubmit={(reason) => api.patch(`/applications/${app._id}/reject`, { reason: reason || undefined }).then(this.load)} />
        )}
        {modal === 'notCompleted' && (
          <ReasonModal title="Không hoàn thành công việc" required confirm="Xác nhận" danger onClose={() => this.setState({ modal: null })}
            onSubmit={(reason) => api.patch(`/applications/${app._id}/result`, { result: 'NOT_COMPLETED', reason }).then(this.load)} />
        )}
      </div>
    );
  }
}

export default withRouter(ApplicationDetailPage);
