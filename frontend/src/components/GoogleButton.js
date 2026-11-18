import React, { Component } from 'react';

// Nút Google Identity Services (FR-AUTH-08): script của Google chỉ tải khi trang có nút; trả ID token qua onCredential.
// Không có REACT_APP_GOOGLE_CLIENT_ID thì không hiện gì (tắt đăng nhập Google)
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
let gsi;
const loadGsi = () => (gsi ||= new Promise((resolve, reject) => {
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = () => resolve(window.google.accounts.id);
  s.onerror = () => { gsi = null; reject(new Error('Không tải được Google')); };
  document.head.appendChild(s);
}));

export default class GoogleButton extends Component {
  ref = React.createRef();
  state = { failed: false };

  async componentDidMount() {
    if (!CLIENT_ID) return;
    try {
      const id = await loadGsi();
      if (!this.ref.current) return;
      // initialize dùng chung cho cả trang: callback trỏ tới nút đang hiển thị
      id.initialize({ client_id: CLIENT_ID, callback: (r) => this.props.onCredential(r.credential), ux_mode: 'popup' });
      id.renderButton(this.ref.current, { theme: 'outline', size: 'large', shape: 'pill', text: this.props.text || 'continue_with', locale: 'vi', width: this.ref.current.offsetWidth || 320 });
    } catch {
      this.setState({ failed: true });
    }
  }

  render() {
    if (!CLIENT_ID) return null;
    return (
      <>
        <div className="auth-or small muted"><span>hoặc</span></div>
        {this.state.failed ? <p className="small muted center">Không tải được nút Google, thử tải lại trang.</p> : <div ref={this.ref} className="google-btn" />}
      </>
    );
  }
}
