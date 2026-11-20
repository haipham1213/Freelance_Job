import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Job from '../../models/Job.js';
import User from '../../models/User.js';
import Review from '../../models/Review.js';
import Report, { REPORT_REASONS, REVIEW_REASONS } from '../../models/Report.js';
import AppError from '../../utils/AppError.js';
import { ok, DAY } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, requireVerified } from '../../middlewares/auth.js';

const router = Router();
// BR-49: 3 báo cáo bị Admin xác định là sai trong 90 ngày → tạm không gửi được báo cáo / khiếu nại
export const ABUSE_LIMIT = 3;
const ABUSE_WINDOW = 90 * DAY;

// API-50: BR-39; REVIEW = khiếu nại đánh giá (BR-48)
router.post('/reports', authenticate, authorize('STUDENT', 'EMPLOYER'), requireVerified,
  validate(z.object({
    targetType: z.enum(['JOB', 'USER', 'REVIEW']),
    targetId: z.string().refine(mongoose.isValidObjectId, 'ID không hợp lệ'),
    reason: z.enum(REPORT_REASONS, 'Vui lòng chọn lý do'),
    description: z.string().trim().max(500, 'Mô tả tối đa 500 ký tự').optional(),
  })),
  async (req, res) => {
    const { targetType, targetId, reason, description } = req.body;
    const abusive = await Report.countDocuments({ reporterId: req.user._id, 'resolution.abusive': true, 'resolution.at': { $gt: new Date(Date.now() - ABUSE_WINDOW) } });
    if (abusive >= ABUSE_LIMIT)
      throw new AppError(403, 'REPORT_BLOCKED', `Bạn có ${abusive} báo cáo bị xác định là sai trong 90 ngày qua nên tạm thời không gửi được báo cáo`);

    if (targetType === 'REVIEW') {
      if (!REVIEW_REASONS.includes(reason)) throw new AppError(400, 'VALIDATION_ERROR', 'Lý do không phù hợp với khiếu nại đánh giá', [{ field: 'reason', message: 'Chọn lý do khiếu nại đánh giá' }]);
      if (!description || description.length < 10) throw new AppError(400, 'VALIDATION_ERROR', 'Vui lòng mô tả vì sao đánh giá không đúng (ít nhất 10 ký tự)', [{ field: 'description', message: 'Ít nhất 10 ký tự' }]);
      const review = await Review.findOne({ _id: targetId, isHidden: false });
      if (!review) throw new AppError(404, 'NOT_FOUND', 'Đánh giá không tồn tại hoặc đã bị ẩn');
      if (!review.revieweeId.equals(req.user._id)) throw new AppError(403, 'FORBIDDEN', 'Chỉ người được đánh giá mới khiếu nại được');
      // Mỗi đánh giá chỉ khiếu nại 1 lần, kể cả khi lần trước đã bị bác bỏ
      if (await Report.exists({ reporterId: req.user._id, targetType, targetId }))
        throw new AppError(409, 'ALREADY_REPORTED', 'Bạn đã khiếu nại đánh giá này rồi');
    } else {
      if (['FALSE_REVIEW', 'RETALIATION'].includes(reason)) throw new AppError(400, 'VALIDATION_ERROR', 'Lý do chỉ dùng cho khiếu nại đánh giá');
      const target = targetType === 'JOB' ? await Job.findOne({ _id: targetId, deletedAt: null }) : await User.findOne({ _id: targetId, role: { $ne: 'ADMIN' } });
      if (!target) throw new AppError(404, 'NOT_FOUND', 'Đối tượng báo cáo không tồn tại');
      const ownerId = targetType === 'JOB' ? target.employerId : target._id;
      if (ownerId.equals(req.user._id)) throw new AppError(400, 'SELF_REPORT', 'Không thể tự báo cáo chính mình');
    }
    try {
      const report = await Report.create({ targetType, targetId, reason, description, reporterId: req.user._id });
      ok(res, { report }, null, 201);
    } catch (e) {
      if (e.code === 11000) throw new AppError(409, 'ALREADY_REPORTED', 'Bạn đã báo cáo đối tượng này và đang chờ xử lý');
      throw e;
    }
  });

// API-83: báo cáo / khiếu nại của tôi (để hiện trạng thái khiếu nại cạnh từng đánh giá)
router.get('/reports/mine', authenticate, async (req, res) => {
  const filter = { reporterId: req.user._id, ...(['JOB', 'USER', 'REVIEW'].includes(req.query.targetType) && { targetType: req.query.targetType }) };
  ok(res, await Report.find(filter).sort('-createdAt').limit(200).select('targetType targetId reason status resolution.level resolution.note createdAt'));
});

export default router;
