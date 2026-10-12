import React from 'react';
import { Link } from 'react-router-dom';
import { Mascot } from '../../components/Illustrations';

const TEXT = {
  403: 'Bạn không có quyền truy cập trang này',
  404: 'Không tìm thấy trang',
  500: 'Máy chủ đang gặp sự cố',
};

const ErrorPage = ({ code = 404, message }) => (
  <div className="container page">
    <div className="card pub-error">
      <Mascot kind={{ 403: 'triangle', 404: 'cloud', 500: 'blob' }[code]} size={96} />
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
