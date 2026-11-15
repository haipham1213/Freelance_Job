// Proxy trong package.json bỏ qua request trình duyệt mở trực tiếp (Accept: text/html),
// nên link/khung xem CV trên cổng 3000 nhận về index.html. File upload luôn chuyển sang backend.
const { createProxyMiddleware } = require('http-proxy-middleware');

// API_PROXY: chạy thêm một bản web trỏ sang API khác (vd. bộ test Selenium: API_PROXY=http://localhost:5051 PORT=3001)
module.exports = (app) => {
  const target = process.env.API_PROXY || 'http://localhost:5050';
  app.use(process.env.API_PROXY ? '/api' : '/api/v1/files', createProxyMiddleware({ target }));
};
