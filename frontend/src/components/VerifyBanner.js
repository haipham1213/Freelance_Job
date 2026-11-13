import React, { Component } from 'react';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';

// BR-04 / FR-AUTH-03 bước 3a: nhắc xác thực email
export default class VerifyBanner extends Component {
  static contextType = AuthContext;
  state = { sent: false, busy: false, error: '' };
  resend = async () => {
    this.setState({ busy: true, error: '' });
    try {
      await api.post('/auth/resend-verification', { email: this.context.user.email });
      this.setState({ sent: true });
    } catch (e) {
      this.setState({ error: e.message || 'Không gửi được email, thử lại sau.' });
    }
    this.setState({ busy: false });
  };
  render() {
    const { user } = this.context;
    if (!user || user.emailVerified || user.role === 'ADMIN') return null;
    const { sent, busy, error } = this.state;
    return (
      <div className="container verify-banner">
        <div className="alert alert-warn row-between">
          <span>Email của bạn chưa được xác thực. Bạn cần xác thực để {user.role === 'STUDENT' ? 'ứng tuyển, đánh giá' : 'đăng tin, mua Premium, đánh giá'}.</span>
          <span role="status">
            {sent ? 'Đã gửi lại link, hãy kiểm tra hộp thư.' : error && <span>{error} </span>}
          </span>
          {!sent && <button type="button" className="btn btn-sm" onClick={this.resend} disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi lại email'}</button>}
        </div>
      </div>
    );
  }
}
