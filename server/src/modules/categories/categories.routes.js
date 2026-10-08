import { Router } from 'express';
import Category from '../../models/Category.js';
import Job from '../../models/Job.js';
import { ok } from '../../utils/http.js';
import { visibleMatch } from '../jobs/jobs.service.js';

const router = Router();

// API-19, kèm số Job đang tuyển của mỗi danh mục cho trang chủ
router.get('/categories', async (req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find({ isActive: true }).sort('name').lean(),
    Job.aggregate([{ $match: await visibleMatch() }, { $group: { _id: '$categoryId', n: { $sum: 1 } } }]),
  ]);
  const byId = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  ok(res, cats.map((c) => ({ ...c, jobCount: byId[c._id] || 0 })));
});

export default router;
