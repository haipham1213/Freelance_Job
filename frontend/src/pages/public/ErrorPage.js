import React from 'react';
import { Link } from 'react-router-dom';
import { Mascot } from '../../components/Illustrations';
import { PANEL_BG } from '../../utils/format';

const TEXT = {
  403: 'Bạn không có quyền truy cập trang này',
  404: 'Không tìm thấy trang',
  500: 'Máy chủ đang gặp sự cố',
};

const ErrorPage = ({ code = 404, message }) => (
  <div className="container page">
    <div className="pub-error" style={{ background: { 403: PANEL_BG[0], 404: PANEL_BG[1], 500: PANEL_BG[3] }[code] }}>
      <Mascot kind={{ 403: 'triangle', 404: 'cloud', 500: 'blob' }[code]} size={130} />
      <h1 className="pub-error-code">{code}</h1>
      <p style={{ fontSize: 19, margin: 0 }}>{message || TEXT[code]}</p>
      <div className="row" style={{ justifyContent: 'center' }}>
        <Link to="/" className="btn btn-lg">Về trang chủ</Link>
        <Link to="/jobs" className="btn btn-lg btn-ghost">Tìm việc</Link>
      </div>
    </div>
  </div>
);

export default ErrorPage;
