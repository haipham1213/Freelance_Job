import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import withRouter from '../utils/withRouter';

// Bắt lỗi render để không ra trang trắng; đổi route thì tự thoát khỏi trạng thái lỗi
class ErrorBoundary extends Component {
  state = { error: null, path: this.props.location?.pathname };

  static getDerivedStateFromError(error) { return { error }; }

  static getDerivedStateFromProps(props, state) {
    const path = props.location?.pathname;
    return path !== state.path ? { error: null, path } : null;
  }

  componentDidCatch(error, info) { console.error(error, info?.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container page">
        <div className="empty" role="alert">
          <h1 className="h-md">Trang gặp sự cố</h1>
          <p className="muted empty-body">Đã có lỗi khi hiển thị trang này. Thử tải lại; nếu vẫn lỗi, quay về trang chủ.</p>
          <div className="row row-center empty-action">
            <button type="button" className="btn" onClick={() => window.location.reload()}>Tải lại trang</button>
            <Link className="btn btn-ghost" to="/">Về trang chủ</Link>
          </div>
        </div>
      </div>
    );
  }
}

export default withRouter(ErrorBoundary);
