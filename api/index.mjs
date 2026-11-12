// Vercel Function: toàn bộ /api/* chạy Express app (vercel.json rewrite). Local vẫn dùng server/src/server.js
import app from '../server/src/app.js';
import { connectDB } from '../server/src/config/db.js';
import { sweepExpired } from '../server/src/modules/jobs/jobs.service.js';

const ready = connectDB();
let lastSweep = 0;

export default async function handler(req, res) {
  await ready;
  // Thay setInterval của server.js: quét tin hết hạn tối đa mỗi giờ một lần, kích hoạt bởi request (Hobby chỉ cho cron mỗi ngày)
  if (Date.now() - lastSweep > 60 * 60_000) {
    lastSweep = Date.now();
    await sweepExpired().catch((e) => console.warn(`[sweep] ${e.message}`));
  }
  return app(req, res);
}
