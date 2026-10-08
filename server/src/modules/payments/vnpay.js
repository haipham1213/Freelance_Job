import crypto from 'node:crypto';

// Ký/kiểm tra theo chuẩn VNPay 2.1.0: sắp xếp key, encode giá trị (khoảng trắng → +), HMAC-SHA512
const signData = (params) =>
  Object.keys(params).sort().map((k) => `${k}=${encodeURIComponent(params[k]).replace(/%20/g, '+')}`).join('&');

const hmac = (data) => crypto.createHmac('sha512', process.env.VNP_HASH_SECRET).update(Buffer.from(data, 'utf-8')).digest('hex');

const vnDate = (d) => {
  const t = new Date(d.getTime() + 7 * 3600_000).toISOString(); // giờ Việt Nam
  return t.slice(0, 19).replace(/[-T:]/g, '');
};

export const isConfigured = () => !!(process.env.VNP_TMN_CODE && process.env.VNP_HASH_SECRET);

export const buildPaymentUrl = ({ txnRef, amount, orderInfo, ip, returnUrl, expiresAt }) => {
  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: process.env.VNP_TMN_CODE,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: txnRef,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100,
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: ip,
    vnp_CreateDate: vnDate(new Date()),
    vnp_ExpireDate: vnDate(expiresAt),
  };
  const data = signData(params);
  return `${process.env.VNP_URL}?${data}&vnp_SecureHash=${hmac(data)}`;
};

export const verifyQuery = (query) => {
  const { vnp_SecureHash, vnp_SecureHashType, ...rest } = query;
  const params = Object.fromEntries(Object.entries(rest).filter(([k]) => k.startsWith('vnp_')));
  const expected = hmac(signData(params));
  return !!vnp_SecureHash && vnp_SecureHash.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(vnp_SecureHash.toLowerCase()), Buffer.from(expected));
};
