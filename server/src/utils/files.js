import express from 'express';
import crypto from 'node:crypto';
import AppError from './AppError.js';
import File from '../models/File.js';

// File gửi thẳng trong body (Content-Type: application/pdf | image/*), không cần multipart
export const rawFile = (maxMb) => express.raw({ type: () => true, limit: `${maxMb}mb` });

const TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };
const SIGNATURES = {
  pdf: (b) => b.subarray(0, 4).toString() === '%PDF',
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8,
  png: (b) => b.subarray(1, 4).toString() === 'PNG',
};

// Kiểm tra theo nội dung file (magic bytes), không tin Content-Type từ client
export const saveUpload = async (buf, folder, allowed) => {
  if (!Buffer.isBuffer(buf) || !buf.length) throw new AppError(400, 'FILE_REQUIRED', 'Vui lòng chọn file');
  const ext = allowed.find((e) => SIGNATURES[e](buf));
  if (!ext) throw new AppError(400, 'INVALID_FILE_TYPE', `Chỉ chấp nhận file ${allowed.join(', ').toUpperCase()}`);
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
  await File.create({ _id: `${folder}/${name}`, contentType: TYPES[ext], data: buf });
  return `/api/v1/files/${folder}/${name}`;
};

// T-11: xóa file cũ khi đã thay; bỏ qua nếu file không còn
export const removeUpload = (url) => {
  const m = /^\/api\/v1\/files\/(\w+\/[a-f0-9]{32}\.\w+)$/.exec(url || '');
  return m ? File.deleteOne({ _id: m[1] }) : Promise.resolve();
};

// GET /api/v1/files/:folder/:name — CV đã qua requireSignedFile (cache 1 giờ, chỉ trình duyệt); logo/ảnh danh mục công khai:
// tên file ngẫu nhiên, thay ảnh là ra tên mới nên nội dung không bao giờ đổi → CDN và trình duyệt giữ 1 năm
export const serveFile = async (req, res, next) => {
  const f = await File.findById(`${req.params.folder}/${req.params.name}`);
  if (!f) return next();
  res.set({ 'Content-Type': f.contentType, 'Cache-Control': req.params.folder === 'cv' ? 'private, max-age=3600' : 'public, max-age=31536000, s-maxage=31536000, immutable', 'X-Content-Type-Options': 'nosniff' }).send(f.data);
};

// CV chỉ mở được bằng link có chữ ký, hết hạn sau 1–2 giờ. Mốc hết hạn làm tròn theo giờ để trình duyệt vẫn cache được trong giờ đó
const sigOf = (url, exp) => crypto.createHmac('sha256', process.env.FILE_SIGN_SECRET || process.env.JWT_ACCESS_SECRET).update(`${url}:${exp}`).digest('hex');
export const signFile = (url) => {
  const exp = (Math.floor(Date.now() / 3_600_000) + 2) * 3600;
  return `${url}?exp=${exp}&sig=${sigOf(url, exp)}`;
};
export const requireSignedFile = (req, res, next) => {
  const { exp, sig } = req.query;
  const want = sigOf(req.baseUrl + req.path, exp);
  if (Number(exp) * 1000 > Date.now() && typeof sig === 'string' && sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return next();
  next(new AppError(403, 'FILE_LINK_EXPIRED', 'Link CV đã hết hạn, hãy tải lại trang để lấy link mới'));
};
