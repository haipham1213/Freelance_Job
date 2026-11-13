import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { SearchX, ServerCrash, ShieldOff } from 'lucide-react';
import { AuthContext } from '../../context/AuthContext';
import { homeOf } from '../../utils/format';

const TEXT = {
  403: 'Bạn không có quyền truy cập trang này',
  404: 'Không tìm thấy trang',
  500: 'Máy chủ đang gặp sự cố',
};

// Trang lỗi thẳng trên nền tối: nhãn, mã lỗi cỡ lớn màu neon, lời nhắn, các nút
class ErrorPage extends Component {
  static contextType = AuthContext;
  h1 = React.createRef();
  componentDidMount() {
    this.h1.current?.focus({ preventScroll: true });
    // RouteEffects (App.js) đặt lại tiêu đề sau khi con gắn xong → đặt trễ một nhịp để tiêu đề lỗi thắng
    this.timer = setTimeout(() => { document.title = `${TEXT[this.props.code || 404]} – UniShift`; }, 0);
  }
  componentWillUnmount() { clearTimeout(this.timer); }
  render() {
    const { code = 404, message, onRetry } = this.props;
    const user = this.context?.user;
    return (
      <div className="container page pub-error">
        <span className="eyebrow-chip pub-error-chip">{React.createElement({ 403: ShieldOff, 500: ServerCrash }[code] || SearchX, { size: 16, 'aria-hidden': true })}Lỗi</span>
        <h1 className="pub-error-code" ref={this.h1} tabIndex={-1}>
          <span aria-hidden="true">{code}</span>
          <span className="sr-only">Lỗi {code}: {TEXT[code] || TEXT[404]}</span>
        </h1>
        <p className="lede">{message || TEXT[code]}</p>
        <div className="pub-error-actions">
          {code === 500 && <button type="button" className="btn" onClick={onRetry || (() => window.location.reload())}>Thử lại</button>}
          {code === 403 && user && <Link to={homeOf(user.role)} className="btn">Trang của tôi</Link>}
          <Link to="/" className={code === 500 || (code === 403 && user) ? 'btn btn-ghost' : 'btn'}>Về trang chủ</Link>
          <Link to="/jobs" className="btn btn-ghost">Tìm việc</Link>
        </div>
      </div>
    );
  }
}

export default ErrorPage;
