// Proxy trong package.json bỏ qua request trình duyệt mở trực tiếp (Accept: text/html),
// nên link/khung xem CV trên cổng 3000 nhận về index.html. File upload luôn chuyển sang backend.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = (app) => {
  app.use('/api/v1/files', createProxyMiddleware({ target: 'http://localhost:5050' }));
};
