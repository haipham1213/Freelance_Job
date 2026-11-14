// Ghim vị trí cho các tin demo chưa có ghim để thử bản đồ "Gần trường" (FR-SRC-05): lấy tọa độ trung tâm quận/huyện của tin từ
// Nominatim (OpenStreetMap, 1 lượt gọi/giây) rồi rải ngẫu nhiên trong ~700 m quanh đó. Vị trí là GIẢ LẬP, chỉ dùng cho dữ liệu demo.
// Chỉ đụng tin chưa ghim và có quận/huyện; tin đã ghim (do nhà tuyển dụng đặt) giữ nguyên. Chạy: npm run seed:geo -w server
import mongoose from 'mongoose';
import Job from '../src/models/Job.js';

await mongoose.connect(process.env.MONGODB_URI);
await Job.syncIndexes();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const jitter = () => (Math.random() - 0.5) * 0.013; // ±0,0065° ≈ ±700 m
const centers = new Map();
const centerOf = async (district, city) => {
  const key = `${district}, ${city.replace(/^TP\.?\s?HCM$/i, 'Thành phố Hồ Chí Minh')}`;
  if (!centers.has(key)) {
    await sleep(1100);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(key)}`, { headers: { 'User-Agent': 'unishift-demo-seed/1.0' } });
    const [hit] = r.ok ? await r.json() : [];
    centers.set(key, hit ? [Number(hit.lon), Number(hit.lat)] : null);
    console.log(hit ? `  ${key}: ${hit.lat}, ${hit.lon}` : `  ${key}: không tìm thấy, bỏ qua`);
  }
  return centers.get(key);
};

let pinned = 0;
for (const job of await Job.find({ location: null, deletedAt: null, district: { $nin: [null, ''] } }).select('city district')) {
  const c = await centerOf(job.district, job.city);
  if (!c) continue;
  await Job.updateOne({ _id: job._id, location: null }, { location: { type: 'Point', coordinates: [c[0] + jitter(), c[1] + jitter()] } });
  pinned++;
}
console.log(`+ ${pinned} tin được ghim, hiện có ${await Job.countDocuments({ location: { $ne: null } })} tin có vị trí`);
await mongoose.disconnect();
