import React from 'react';
import { Link } from 'react-router-dom';
import { SearchX, ServerCrash, ShieldOff } from 'lucide-react';

const TEXT = {
  403: 'Bạn không có quyền truy cập trang này',
  404: 'Không tìm thấy trang',
  500: 'Máy chủ đang gặp sự cố',
};

// Trang lỗi thẳng trên nền tối: nhãn, mã lỗi cỡ lớn màu neon, lời nhắn, hai nút
const ErrorPage = ({ code = 404, message }) => (
  <div className="container page pub-error">
    <span className="eyebrow-chip pub-error-chip">{React.createElement({ 403: ShieldOff, 500: ServerCrash }[code] || SearchX, { size: 16, 'aria-hidden': true })}Lỗi</span>
    <h1 className="pub-error-code">{code}</h1>
    <p className="lede">{message || TEXT[code]}</p>
    <div className="pub-error-actions">
      <Link to="/" className="btn">Về trang chủ</Link>
      <Link to="/jobs" className="btn btn-ghost">Tìm việc</Link>
    </div>
  </div>
);

export default ErrorPage;
