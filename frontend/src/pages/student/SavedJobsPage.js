import React, { Component } from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Spinner, Empty, ErrorState, Alert } from '../../components/ui';
import { JobCard } from '../../components/JobRow';

// SCR-S07 / FR-SAV-01
export default class SavedJobsPage extends Component {
  state = { jobs: null, error: null, msg: '', removeErr: '' };
  reqId = 0;
  componentDidMount() { this.load(); }
  componentWillUnmount() { this.reqId++; }
  load = async () => {
    const id = ++this.reqId;
    this.setState({ error: null });
    try {
      const r = await api.get('/students/me/saved-jobs');
      if (id === this.reqId) this.setState({ jobs: r.data });
    } catch (error) {
      if (id === this.reqId) this.setState({ error });
    }
  };
  remove = async (id) => {
    this.setState({ msg: '', removeErr: '' });
    try {
      await api.del(`/students/me/saved-jobs/${id}`);
      this.setState({ msg: 'Đã bỏ lưu việc làm' });
    } catch (e) {
      return this.setState({ removeErr: `Không bỏ lưu được: ${e.message}` });
    }
    this.load();
  };
  render() {
    const { jobs, error } = this.state;
    return (
      <div className="container page">
        <header className="stu-head">
          <div className="stu-head-text">
            <span className="eyebrow eyebrow-dot">Sinh viên</span>
            <h1 className="display">Việc làm đã lưu</h1>
            <p className="muted">{jobs ? `${jobs.length} việc bạn đang để mắt tới` : 'Đang tải…'}</p>
          </div>
          <Link to="/jobs" className="btn btn-ghost">Tìm thêm việc</Link>
        </header>
        <div className="section">
          <Alert>{this.state.removeErr}</Alert>
          <Alert type="ok">{this.state.msg}</Alert>
          {error ? <ErrorState error={error} onRetry={this.load} /> : !jobs ? <Spinner /> : !jobs.length ? (
            <div className="card"><Empty title="Chưa lưu việc nào"><Link to="/jobs" className="accent ico-row stu-center">Khám phá việc làm <ArrowRight size={16} aria-hidden="true" /></Link></Empty></div>
          ) : (
            <ul className="jx-grid">
              {jobs.map((j) => (
                <li key={j._id} className={`stu-saved ${j.isAvailable ? '' : 'off'}`}>
                  <JobCard job={j} saved onSave={this.remove} />
                  {!j.isAvailable && <span className="chip chip-dark tiny stu-off">Không còn tuyển</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }
}
