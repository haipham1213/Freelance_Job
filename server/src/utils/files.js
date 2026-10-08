import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import AppError from './AppError.js';

export const UPLOAD_DIR = path.resolve('uploads');

// File gửi thẳng trong body (Content-Type: application/pdf | image/*), không cần multipart
export const rawFile = (maxMb) => express.raw({ type: () => true, limit: `${maxMb}mb` });

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
  await fs.mkdir(path.join(UPLOAD_DIR, folder), { recursive: true });
  await fs.writeFile(path.join(UPLOAD_DIR, folder, name), buf);
  return `/api/v1/files/${folder}/${name}`;
};
