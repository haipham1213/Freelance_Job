import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { notFound, errorHandler } from './middlewares/errorHandler.js';
import { UPLOAD_DIR } from './utils/files.js';
import authRoutes from './modules/auth/auth.routes.js';
import categoryRoutes from './modules/categories/categories.routes.js';
import jobRoutes from './modules/jobs/jobs.routes.js';
import studentRoutes from './modules/students/students.routes.js';
import employerRoutes from './modules/employers/employers.routes.js';
import applicationRoutes from './modules/applications/applications.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import paymentRoutes from './modules/payments/payments.routes.js';
import reportRoutes from './modules/reports/reports.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import alertRoutes from './modules/alerts/alerts.routes.js';

const app = express();

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/v1/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
// ponytail: file (kể cả CV) phục vụ công khai theo tên ngẫu nhiên; chuyển sang Cloudinary/URL ký khi deploy thật
app.use('/api/v1/files', express.static(UPLOAD_DIR, { maxAge: '7d' }));

app.use('/api/v1/auth', authRoutes);
for (const r of [categoryRoutes, jobRoutes, studentRoutes, employerRoutes, applicationRoutes, notificationRoutes, paymentRoutes, reportRoutes, adminRoutes, alertRoutes])
  app.use('/api/v1', r);

app.use(notFound);
app.use(errorHandler);

export default app;
