import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import Plan from '../../models/Plan.js';
import Payment from '../../models/Payment.js';
import AuditLog from '../../models/AuditLog.js';
import AppError from '../../utils/AppError.js';
import { ok } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, requireVerified } from '../../middlewares/auth.js';
import { notify } from '../../utils/notify.js';
import { buildPaymentUrl, verifyQuery, isConfigured } from './vnpay.js';
import { extendPremium } from './payments.service.js';

const router = Router();

// API-45
router.get('/plans', async (req, res) => ok(res, await Plan.find({ isActive: true }).sort('price')));

// API-46: BR-35 số tiền lấy từ DB, không nhận từ client
router.post('/payments', authenticate, authorize('EMPLOYER'), requireVerified, validate(z.object({ planCode: z.string() })), async (req, res) => {
  if (!isConfigured()) throw new AppError(503, 'PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình VNPay (VNP_TMN_CODE, VNP_HASH_SECRET)');
  const plan = await Plan.findOne({ code: req.body.planCode, isActive: true });
  if (!plan) throw new AppError(400, 'INVALID_PLAN', 'Gói không tồn tại hoặc đã ngừng bán');
  const txnRef = `${Date.now()}${Math.floor(Math.random() * 1e4)}`;
  const payment = await Payment.create({
    employerId: req.user._id,
    planId: plan._id,
    planSnapshot: { code: plan.code, name: plan.name, durationDays: plan.durationDays },
    amount: plan.price,
    txnRef,
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });
  const paymentUrl = buildPaymentUrl({
    txnRef,
    amount: plan.price,
    orderInfo: `Thanh toan ${plan.code} ${txnRef}`,
    ip: (req.headers['x-forwarded-for'] || req.ip || '127.0.0.1').split(',')[0].replace('::ffff:', ''),
    returnUrl: `${process.env.CLIENT_URL}/employer/payments/result`,
    expiresAt: payment.expiresAt,
  });
  ok(res, { paymentId: payment._id, paymentUrl }, null, 201);
});

// API-47: luôn trả 200 { RspCode, Message } theo giao thức VNPay (BR-36)
router.get('/payments/vnpay-ipn', async (req, res) => {
  const q = req.query;
  const reply = async (RspCode, Message, payment) => {
    await AuditLog.create({ action: 'PAYMENT_IPN', targetType: 'PAYMENT', targetId: payment?._id, detail: { RspCode, txnRef: q.vnp_TxnRef } });
    res.json({ RspCode, Message });
  };
  if (!verifyQuery(q)) return reply('97', 'Invalid signature');
  const payment = await Payment.findOne({ txnRef: q.vnp_TxnRef });
  if (!payment) return reply('01', 'Order not found');
  if (Number(q.vnp_Amount) !== payment.amount * 100) return reply('04', 'Invalid amount', payment);
  if (payment.status !== 'PENDING') return reply('02', 'Order already confirmed', payment);
  // BR-38: quá 15 phút thì Payment hết hạn; tiền đã trừ (nếu có) xử lý bằng kích hoạt thủ công FR-ADM-08
  if (payment.expiresAt < new Date()) {
    await Payment.updateOne({ _id: payment._id, status: 'PENDING' }, { status: 'EXPIRED', vnpResponseCode: q.vnp_ResponseCode, ipnRaw: q });
    return reply('02', 'Order expired', payment);
  }
  const success = q.vnp_ResponseCode === '00' && q.vnp_TransactionStatus === '00';
  await mongoose.connection.transaction(async (session) => {
    // Điều kiện status PENDING trong lệnh cập nhật → IPN gửi 2 lần chỉ cộng hạn 1 lần
    const p = await Payment.findOneAndUpdate(
      { _id: payment._id, status: 'PENDING' },
      { status: success ? 'SUCCESS' : 'FAILED', vnpTransactionNo: q.vnp_TransactionNo, vnpResponseCode: q.vnp_ResponseCode, bankCode: q.vnp_BankCode, ipnRaw: q, ...(success && { paidAt: new Date() }) },
      { returnDocument: 'after', session },
    );
    if (!p || !success) return;
    const until = await extendPremium(p.employerId, p.planSnapshot.durationDays, session);
    await notify(p.employerId, 'PAYMENT_SUCCESS', 'Thanh toán thành công', `${p.planSnapshot.name} có hiệu lực đến ${until.toLocaleDateString('vi-VN')}`, '/employer/payments', session);
  });
  reply('00', 'Confirm Success', payment);
});

// API-48: nhận _id hoặc txnRef (VNPay trả về vnp_TxnRef trên Return URL)
router.get('/payments/:id', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const id = req.params.id;
  const payment = await Payment.findOne({ employerId: req.user._id, ...(mongoose.isValidObjectId(id) && id.length === 24 ? { _id: id } : { txnRef: id }) }).select('-ipnRaw');
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch');
  ok(res, { payment, premiumUntil: req.user.employer?.premiumUntil });
});

export default router;
