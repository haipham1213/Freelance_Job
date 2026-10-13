import { Router } from 'express';
import Category from '../../models/Category.js';
import Job from '../../models/Job.js';
import { ok } from '../../utils/http.js';
import { visibleMatch } from '../jobs/jobs.service.js';

const router = Router();

// API-19, kèm số Job đang tuyển và khoảng lương phổ biến của mỗi danh mục cho trang chủ.
// pay = hình thức trả lương nhiều tin nhất trong ngành, lương min/max trung bình làm tròn nghìn đồng.
router.get('/categories', async (req, res) => {
  const [cats, groups] = await Promise.all([
    Category.find({ isActive: true }).sort('name').lean(),
    Job.aggregate([
      { $match: await visibleMatch() },
      { $group: { _id: { cat: '$categoryId', type: '$salaryType' }, n: { $sum: 1 }, lo: { $avg: '$salaryMin' }, hi: { $avg: '$salaryMax' } } },
    ]),
  ]);
  const byCat = {};
  for (const g of groups) {
    const c = (byCat[g._id.cat] ||= { jobCount: 0, top: null });
    c.jobCount += g.n;
    if (!c.top || g.n > c.top.n) c.top = g;
  }
  const k = (v) => Math.round(v / 1000) * 1000;
  ok(res, cats.map((c) => {
    const s = byCat[c._id];
    return { ...c, jobCount: s?.jobCount || 0, pay: s ? { salaryType: s.top._id.type, salaryMin: k(s.top.lo), salaryMax: k(s.top.hi) } : null };
  }));
});

export default router;
