import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import User from '../../models/User.js';
import Plan from '../../models/Plan.js';
import Payment from '../../models/Payment.js';
import AuditLog from '../../models/AuditLog.js';
import AppError from '../../utils/AppError.js';
import { ok, paging } from '../../utils/http.js';
import { validate } from '../../middlewares/validate.js';
import { authenticate, authorize, requireVerified } from '../../middlewares/auth.js';
import { newCode, checkoutForm, verifyIpn, fetchOrder, isConfigured } from './sepay.js';
import { settle } from './payments.service.js';
import { TIERS } from '../jobs/jobs.service.js';

const router = Router();

// API-45
router.get('/plans', async (req, res) => ok(res, await Plan.find({ isActive: true }).sort('price'), { tiers: TIERS }));

// API-46: BR-35 số tiền lấy từ DB, không nhận từ client. txnRef là mã đơn gửi SePay (order_invoice_number)
router.post('/payments', authenticate, authorize('EMPLOYER'), requireVerified, validate(z.object({ planCode: z.string() })), async (req, res) => {
  if (!isConfigured()) throw new AppError(503, 'PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình SePay (SEPAY_MERCHANT_ID, SEPAY_SECRET_KEY)');
  const plan = await Plan.findOne({ code: req.body.planCode, isActive: true });
  if (!plan) throw new AppError(400, 'INVALID_PLAN', 'Gói không tồn tại hoặc đã ngừng bán');
  const payment = await Payment.create({
    employerId: req.user._id,
    planId: plan._id,
    planSnapshot: { code: plan.code, name: plan.name, durationDays: plan.durationDays },
    amount: plan.price,
    txnRef: newCode(),
    expiresAt: new Date(Date.now() + 15 * 60_000),
  });
  ok(res, { paymentId: payment._id }, null, 201);
});

// API-47: IPN của SePay (BR-36). Xác thực sai → 401; còn lại luôn trả 200 {"success":true} để SePay không gọi lại vô ích
router.post('/payments/sepay-ipn', async (req, res) => {
  const trusted = verifyIpn(req);
  if (!isConfigured() || trusted === false) return res.status(401).json({ success: false, message: 'Unauthorized' });
  let { notification_type: type, order = {}, transaction = {} } = req.body || {};
  // Không có secret: lấy trạng thái + số tiền thật từ SePay thay vì tin nội dung IPN
  if (trusted === null && type === 'ORDER_PAID') {
    const real = order.order_invoice_number && (await fetchOrder(String(order.order_invoice_number)));
    order = real || {};
    transaction = real?.transactions?.[0] || {};
  }
  const done = async (message, payment) => {
    await AuditLog.create({ action: 'PAYMENT_IPN', targetType: 'PAYMENT', targetId: payment?._id, detail: { message, type, invoice: order.order_invoice_number, amount: order.order_amount } });
    res.json({ success: true });
  };
  if (type !== 'ORDER_PAID' || order.order_status !== 'CAPTURED') return done('Ignored');
  const payment = await Payment.findOne({ txnRef: String(order.order_invoice_number) });
  if (!payment) return done('Order not found');
  if (payment.status !== 'PENDING') return done('Already processed', payment);
  // Số tiền SePay báo phải khớp đơn; lệch thì để PENDING cho admin kích hoạt thủ công (FR-ADM-08)
  if (Number(order.order_amount) !== payment.amount) return done('Amount mismatch', payment);
  await settle(payment, { success: true, gatewayRef: String(transaction.transaction_id || transaction.id || ''), gatewayCode: order.order_status, raw: req.body });
  done('OK', payment);
});

// API-49: lịch sử giao dịch của chính employer, mới nhất ở trên (FR-PAY-04)
router.get('/payments', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const { page, limit, skip } = paging(req.query);
  const filter = { employerId: req.user._id };
  const [items, total] = await Promise.all([Payment.find(filter).select('-ipnRaw').sort('-createdAt').skip(skip).limit(limit), Payment.countDocuments(filter)]);
  ok(res, items, { page, limit, total });
});

// API-48: nhận _id hoặc txnRef. Khi còn PENDING trả kèm form checkout (url + fields đã ký) để trình duyệt POST sang SePay
router.get('/payments/:id', authenticate, authorize('EMPLOYER'), async (req, res) => {
  const id = req.params.id;
  const find = () => Payment.findOne({ employerId: req.user._id, ...(mongoose.isValidObjectId(id) && id.length === 24 ? { _id: id } : { txnRef: id }) }).select('-ipnRaw');
  let payment = await find();
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy giao dịch');
  // IPN có thể đến chậm hoặc không đến: khi còn PENDING thì hỏi thẳng SePay, đã thu tiền đúng số thì chốt ngay (settle chỉ cộng một lần dù IPN đến sau)
  if (payment.status === 'PENDING' && isConfigured()) {
    const real = await fetchOrder(payment.txnRef);
    if (real?.order_status === 'CAPTURED' && Number(real.order_amount) === payment.amount) {
      await settle(payment, { success: true, gatewayRef: String(real.transactions?.[0]?.transaction_id || ''), gatewayCode: real.order_status, raw: real });
      payment = await find();
    }
  }
  const user = await User.findById(req.user._id).select('employer.premiumUntil');
  const checkout = payment.displayStatus === 'PENDING' && isConfigured() ? checkoutForm({ amount: payment.amount, txnRef: payment.txnRef, id: payment._id, description: `Nang cap ${payment.planSnapshot.name}` }) : undefined;
  ok(res, { payment: { ...payment.toJSON(), checkout }, premiumUntil: user.employer?.premiumUntil });
});

export default router;
