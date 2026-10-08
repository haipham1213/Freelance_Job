import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Job from '../../models/Job.js';
import User from '../../models/User.js';
import Report, { REPORT_REASONS } from '../../models/Report.js';
import AppError from '../../utils/AppError.js';
import { ok } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, requireVerified } from '../../middlewares/auth.js';

const router = Router();

// API-50: BR-39
router.post('/reports', authenticate, authorize('STUDENT', 'EMPLOYER'), requireVerified,
  validate(z.object({
    targetType: z.enum(['JOB', 'USER']),
    targetId: z.string().refine(mongoose.isValidObjectId, 'ID không hợp lệ'),
    reason: z.enum(REPORT_REASONS, 'Vui lòng chọn lý do'),
    description: z.string().trim().max(500, 'Mô tả tối đa 500 ký tự').optional(),
  })),
  async (req, res) => {
    const { targetType, targetId } = req.body;
    const target = targetType === 'JOB' ? await Job.findById(targetId) : await User.findById(targetId);
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Đối tượng báo cáo không tồn tại');
    const ownerId = targetType === 'JOB' ? target.employerId : target._id;
    if (ownerId.equals(req.user._id)) throw new AppError(400, 'SELF_REPORT', 'Không thể tự báo cáo chính mình');
    try {
      const report = await Report.create({ ...req.body, reporterId: req.user._id });
      ok(res, { report }, null, 201);
    } catch (e) {
      if (e.code === 11000) throw new AppError(409, 'ALREADY_REPORTED', 'Bạn đã báo cáo đối tượng này và đang chờ xử lý');
      throw e;
    }
  });

export default router;
