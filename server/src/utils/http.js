import mongoose from 'mongoose';
import crypto from 'node:crypto';
import AppError from './AppError.js';
import { signFile } from './files.js';

// Danh sách ô buổi (0–20, xem Job.shifts) từ mảng hoặc chuỗi "0,3,14": bỏ ô sai, bỏ trùng, sắp xếp
export const slotList = (v) => [...new Set((Array.isArray(v) ? v : String(v ?? '').split(',').filter(Boolean)).map(Number))]
  .filter((n) => Number.isInteger(n) && n >= 0 && n <= 20).sort((a, b) => a - b);

// Mọi URL CV trong phản hồi được ký lại mỗi lần trả về (xem signFile)
// ponytail: quét chuỗi JSON ở một chỗ thay vì ký trong từng route có trả CV
const CV_URL = /\/api\/v1\/files\/cv\/[0-9a-f]+\.pdf/g;
export const ok = (res, data, meta, status = 200) =>
  res.status(status).type('json').send(JSON.stringify(meta ? { success: true, data, meta } : { success: true, data }).replace(CV_URL, (u) => signFile(u)));

// ?page=1&limit=10, limit tối đa 50 (NFR-04)
export const paging = (q) => {
  const page = Math.max(1, parseInt(q.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(q.limit) || 10));
  return { page, limit, skip: (page - 1) * limit };
};

export const oid = (id) => {
  if (!mongoose.isValidObjectId(id)) throw new AppError(400, 'INVALID_ID', 'ID không hợp lệ');
  return new mongoose.Types.ObjectId(String(id));
};

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = () => crypto.randomBytes(32).toString('hex');

// Bỏ dấu tiếng Việt để tìm kiếm ("phuc vu" khớp "phục vụ")
export const unaccent = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();

export const slugify = (s) => unaccent(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const DAY = 24 * 60 * 60 * 1000;
