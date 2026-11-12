// Chép toàn bộ dữ liệu từ DB local (MONGODB_URI) sang DB đích (TARGET_URI, vd Atlas) và nạp file trong uploads/ vào collection files.
// Chạy: TARGET_URI='mongodb+srv://…' npm run copy-to -w server   — DB đích bị XÓA SẠCH trước khi chép
// FILES_ONLY=1 npm run copy-to -w server: chỉ nạp file uploads/ vào DB (mặc định TARGET_URI = MONGODB_URI), không xóa gì
import mongoose from 'mongoose';
import fs from 'node:fs/promises';
import path from 'node:path';

const { MONGODB_URI, FILES_ONLY } = process.env;
const TARGET_URI = process.env.TARGET_URI || (FILES_ONLY && MONGODB_URI);
if (!TARGET_URI) throw new Error('Thiếu TARGET_URI');
const src = await mongoose.createConnection(MONGODB_URI).asPromise();
const dst = await mongoose.createConnection(TARGET_URI).asPromise();

if (!FILES_ONLY) {
  await dst.dropDatabase();
  for (const { name } of await src.db.listCollections().toArray()) {
    const docs = await src.db.collection(name).find().toArray();
    if (docs.length) await dst.db.collection(name).insertMany(docs);
    console.log(`${name}: ${docs.length}`);
  }
}

const TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', webp: 'image/webp' };
const root = path.resolve('uploads');
let n = 0;
for (const folder of await fs.readdir(root).catch(() => [])) {
  for (const name of await fs.readdir(path.join(root, folder)).catch(() => [])) {
    const type = TYPES[path.extname(name).slice(1).toLowerCase()];
    if (!type) continue;
    const _id = `${folder}/${name}`;
    await dst.db.collection('files').replaceOne({ _id }, { _id, contentType: type, data: await fs.readFile(path.join(root, folder, name)), createdAt: new Date() }, { upsert: true });
    n++;
  }
}
console.log(`files: ${n}`);
await Promise.all([src.close(), dst.close()]);
