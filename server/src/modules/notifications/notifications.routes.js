import { Router } from 'express';
import Notification from '../../models/Notification.js';
import AppError from '../../utils/AppError.js';
import { ok, paging, oid } from '../../utils/http.js';
import { authenticate } from '../../middlewares/auth.js';

const router = Router();
router.use('/notifications', authenticate);

// API-41
router.get('/notifications', async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = { userId: req.user._id, ...(req.query.isRead !== undefined && { isRead: req.query.isRead === 'true' }) };
  const [items, total] = await Promise.all([Notification.find(filter).sort('-createdAt').skip(skip).limit(limit), Notification.countDocuments(filter)]);
  ok(res, items, { page, limit, total });
});

// API-42
router.get('/notifications/unread-count', async (req, res) =>
  ok(res, { count: await Notification.countDocuments({ userId: req.user._id, isRead: false }) }));

// API-44 (khai báo trước :id/read)
router.patch('/notifications/read-all', async (req, res) => {
  const r = await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
  ok(res, { updated: r.modifiedCount });
});

// API-43
router.patch('/notifications/:id/read', async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: oid(req.params.id), userId: req.user._id }, { isRead: true }, { returnDocument: 'after' });
  if (!n) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy thông báo');
  ok(res, n);
});

export default router;
