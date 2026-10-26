import React, { Component } from 'react';
import { AuthContext } from '../context/AuthContext';
import { api } from '../api';

// BR-04 / FR-AUTH-03 bước 3a: nhắc xác thực email
export default class VerifyBanner extends Component {
  static contextType = AuthContext;
  state = { sent: false };
  resend = async () => {
    await api.post('/auth/resend-verification', { email: this.context.user.email }).catch(() => {});
    this.setState({ sent: true });
  };
  render() {
    const { user } = this.context;
    if (!user || user.emailVerified || user.role === 'ADMIN') return null;
    return (
      <div className="container" style={{ marginTop: 16 }}>
        <div className="alert alert-warn row-between">
          <span>Email của bạn chưa được xác thực. Bạn cần xác thực để {user.role === 'STUDENT' ? 'ứng tuyển' : 'đăng tin'}.</span>
          {this.state.sent ? <span>Đã gửi lại link, hãy kiểm tra hộp thư.</span> : <button className="btn btn-sm" onClick={this.resend}>Gửi lại email</button>}
        </div>
      </div>
    );
  }
}
