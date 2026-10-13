import React from 'react';
import { Link } from 'react-router-dom';
import { SearchX, ServerCrash, ShieldOff } from 'lucide-react';

const TEXT = {
  403: 'Bạn không có quyền truy cập trang này',
  404: 'Không tìm thấy trang',
  500: 'Máy chủ đang gặp sự cố',
};

const ErrorPage = ({ code = 404, message }) => (
  <div className="container page">
    <div className="card pub-error">
      <div className="empty-icon">{React.createElement({ 403: ShieldOff, 500: ServerCrash }[code] || SearchX, { size: 24, 'aria-hidden': true })}</div>
      <h1 className="pub-error-code">{code}</h1>
      <p className="muted" style={{ margin: 0 }}>{message || TEXT[code]}</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn">Về trang chủ</Link>
        <Link to="/jobs" className="btn btn-ghost">Tìm việc</Link>
      </div>
    </div>
  </div>
);

export default ErrorPage;
