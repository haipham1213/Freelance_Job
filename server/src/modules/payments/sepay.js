import crypto from 'node:crypto';
import { SePayPgClient } from 'sepay-pg-node';

// SePay Payment Gateway: server ký form, trình duyệt POST sang trang thanh toán của SePay, SePay gọi IPN khi thanh toán xong.
// Tài liệu: https://developer.sepay.vn/vi/cong-thanh-toan/bat-dau
const env = (k) => process.env[k];

export const isConfigured = () => !!(env('SEPAY_MERCHANT_ID') && env('SEPAY_SECRET_KEY'));

// Mã đơn (order_invoice_number) phải duy nhất
export const newCode = () => 'UNI' + crypto.randomBytes(5).toString('hex').toUpperCase();

// Form POST tới SePay. Thứ tự khóa đúng như tài liệu SDK vì chữ ký phụ thuộc thứ tự
const client = () => new SePayPgClient({ env: env('SEPAY_ENV') === 'production' ? 'production' : 'sandbox', merchant_id: env('SEPAY_MERCHANT_ID'), secret_key: env('SEPAY_SECRET_KEY') });

export const checkoutForm = ({ amount, txnRef, description, id }) => {
  const client_ = client();
  const back = (status) => `${env('CLIENT_URL')}/employer/payments/result?paymentId=${id}&status=${status}`;
  return {
    url: client_.checkout.initCheckoutUrl(),
    fields: client_.checkout.initOneTimePaymentFields({
      operation: 'PURCHASE',
      payment_method: 'BANK_TRANSFER',
      order_invoice_number: txnRef,
      order_amount: amount,
      currency: 'VND',
      order_description: description,
      success_url: back('success'),
      error_url: back('error'),
      cancel_url: back('cancel'),
    }),
  };
};

const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

// IPN có header X-Secret-Key (khi đã cấu hình kiểu xác thực Secret Key ở SePay): true = đúng, false = sai, null = không gửi
export const verifyIpn = (req) => {
  const key = req.get('x-secret-key');
  return key === undefined ? null : !!env('SEPAY_IPN_SECRET') && safeEq(key, env('SEPAY_IPN_SECRET'));
};

// IPN không có secret thì không tin body: hỏi lại SePay (API có Basic auth bằng Merchant ID + Secret Key) trạng thái thật của đơn
export const fetchOrder = async (invoice) => {
  try { return (await client().order.retrieve(invoice)).data.data; } catch { return null; }
};
