import React, { Component } from 'react';
import { ArrowRight, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../api';
import { Spinner, Empty } from '../../components/ui';
import JobTile from '../../components/JobTile';

// SCR-S07 / FR-SAV-01
export default class SavedJobsPage extends Component {
  state = { jobs: null };
  componentDidMount() { this.load(); }
  load = async () => this.setState({ jobs: (await api.get('/students/me/saved-jobs')).data });
  remove = async (e, id) => {
    e.preventDefault();
    await api.del(`/students/me/saved-jobs/${id}`);
    this.load();
  };
  render() {
    const { jobs } = this.state;
    return (
      <div className="container page">
        <header className="card stu-head">
          <h1 className="display">Việc làm đã lưu</h1>
          <p className="muted">{jobs ? `${jobs.length} việc bạn đang để mắt tới` : 'Đang tải…'}</p>
        </header>
        <div style={{ marginTop: 16 }}>
          {!jobs ? <Spinner /> : !jobs.length ? (
            <div className="card"><Empty mascot="flower" title="Chưa lưu việc nào"><Link to="/jobs" className="accent ico-row" style={{ justifyContent: 'center' }}>Khám phá việc làm <ArrowRight size={16} /></Link></Empty></div>
          ) : (
            <div className="jobs-grid">
              {jobs.map((j) => (
                <div key={j._id} className={`stu-saved ${j.isAvailable ? '' : 'off'}`}>
                  <JobTile job={j} />
                  <button className="stu-unsave" onClick={(e) => this.remove(e, j._id)} aria-label={`Bỏ lưu ${j.title}`} title="Bỏ lưu"><Heart size={16} fill="currentColor" /></button>
                  {!j.isAvailable && <span className="chip chip-dark tiny stu-off">Không còn tuyển</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
}
