import { Router } from 'express';
import { z } from 'zod';
import Job from '../../models/Job.js';
import Category from '../../models/Category.js';
import AppError from '../../utils/AppError.js';
import { ok, oid, slugify } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { rawFile, saveUpload } from '../../utils/files.js';

const router = Router();
router.use('/admin', authenticate, authorize('ADMIN'));

// Danh mục (cả đang ẩn) cho trang quản trị
router.get('/admin/categories', async (req, res) => {
  const [cats, counts] = await Promise.all([
    Category.find().sort('name'),
    Job.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: '$categoryId', n: { $sum: 1 } } }]),
  ]);
  const byId = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  ok(res, cats.map((c) => ({ ...c.toObject(), jobCount: byId[c._id] || 0 })));
});

const categoryName = z.string().trim().min(2, 'Tên 2–60 ký tự').max(60, 'Tên 2–60 ký tự');
const dupCategory = (e) => {
  if (e.code === 11000) throw new AppError(409, 'CATEGORY_EXISTS', 'Tên danh mục đã tồn tại');
  throw e;
};

// API-58
router.post('/admin/categories', validate(z.object({ name: categoryName })), async (req, res) => {
  const c = await Category.create({ name: req.body.name, slug: slugify(req.body.name) }).catch(dupCategory);
  ok(res, c, null, 201);
});

// API-59: BR-40 chỉ ẩn, không xóa
router.put('/admin/categories/:id', validate(z.object({ name: categoryName.optional(), isActive: z.boolean().optional() })), async (req, res) => {
  const update = { ...req.body, ...(req.body.name && { slug: slugify(req.body.name) }) };
  const c = await Category.findByIdAndUpdate(oid(req.params.id), update, { returnDocument: 'after', runValidators: true }).catch(dupCategory);
  if (!c) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy danh mục');
  ok(res, c);
});

router.post('/admin/categories/:id/image', rawFile(2), async (req, res) => {
  const imageUrl = await saveUpload(req.body, 'categories', ['jpg', 'png']);
  const c = await Category.findByIdAndUpdate(oid(req.params.id), { imageUrl }, { returnDocument: 'after' });
  ok(res, c);
});

export default router;
