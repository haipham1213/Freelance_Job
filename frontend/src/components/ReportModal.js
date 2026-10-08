import React, { Component } from 'react';
import { api } from '../api';
import { Modal, Field, Alert } from './ui';
import { REPORT_REASONS } from '../utils/format';

// FR-RPT-01: 5 lý do (AS-14) + mô tả ≤ 500 ký tự
export default class ReportModal extends Component {
  state = { reason: '', description: '', error: '', done: false, busy: false };
  submit = async (e) => {
    e.preventDefault();
    if (!this.state.reason) return this.setState({ error: 'Vui lòng chọn lý do' });
    this.setState({ busy: true, error: '' });
    try {
      await api.post('/reports', { targetType: this.props.targetType, targetId: this.props.targetId, reason: this.state.reason, description: this.state.description || undefined });
      this.setState({ done: true });
    } catch (err) {
      this.setState({ error: err.message, busy: false });
    }
  };
  render() {
    const { onClose, targetType } = this.props;
    if (this.state.done)
      return (
        <Modal title="Đã gửi báo cáo" onClose={onClose}>
          <p className="muted">Cảm ơn bạn. Quản trị viên sẽ xem xét và xử lý báo cáo này.</p>
          <button className="btn" onClick={onClose}>Đóng</button>
        </Modal>
      );
    return (
      <Modal title={targetType === 'JOB' ? 'Báo cáo tin tuyển dụng' : 'Báo cáo người dùng'} onClose={onClose}>
        <form className="stack" onSubmit={this.submit}>
          <div className="stack" role="radiogroup" aria-label="Lý do">
            {Object.entries(REPORT_REASONS).map(([k, v]) => (
              <label key={k} className="row" style={{ gap: 8, cursor: 'pointer' }}>
                <input type="radio" name="reason" checked={this.state.reason === k} onChange={() => this.setState({ reason: k })} /> {v}
              </label>
            ))}
          </div>
          <Field label="Mô tả thêm (không bắt buộc)">
            <textarea className="textarea" maxLength={500} value={this.state.description} onChange={(e) => this.setState({ description: e.target.value })} />
          </Field>
          <Alert>{this.state.error}</Alert>
          <button className="btn btn-danger" disabled={this.state.busy}>Gửi báo cáo</button>
        </form>
      </Modal>
    );
  }
}
