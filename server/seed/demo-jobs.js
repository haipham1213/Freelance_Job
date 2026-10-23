// Thêm tin đang tuyển cho dữ liệu demo: chép nội dung các tin đã đóng/hết hạn của mỗi nhà tuyển dụng thành tin OPEN mới,
// không vượt hạn mức gói (BR-15). Chỉ thêm, không sửa tin cũ. Chạy lại khi tin hết hạn: npm run seed:jobs
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import { TIERS, quotaOf, visibleMatch } from '../src/modules/jobs/jobs.service.js';
import { DAY } from '../src/utils/http.js';

await mongoose.connect(process.env.MONGODB_URI);

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
let added = 0;

for (const u of await User.find({ role: 'EMPLOYER', status: 'ACTIVE', 'employer.company.name': { $exists: true } })) {
  const { used, limit } = await quotaOf(u);
  if (used >= limit) continue;
  const openTitles = await Job.find({ ...(await visibleMatch()), employerId: u._id }).distinct('title');
  const sources = (await Job.find({ employerId: u._id, deletedAt: null, title: { $nin: openTitles } }).sort('-createdAt').lean())
    .filter((j, i, all) => all.findIndex((x) => x.title === j.title) === i)
    .slice(0, limit - used);
  for (const s of sources) {
    const startDate = new Date(Date.now() + rand(1, 10) * DAY);
    await Job.create({
      ...s,
      _id: undefined,
      status: 'OPEN',
      acceptedCount: 0,
      applicationCount: 0,
      viewCount: rand(5, 120),
      startDate,
      endDate: s.endDate && new Date(+startDate + Math.max(DAY, s.endDate - s.startDate)),
      expiresAt: new Date(Date.now() + rand(5, u.isPremium() ? TIERS.premium.days : TIERS.free.days) * DAY),
      featuredUntil: u.isPremium() ? u.employer.premiumUntil : undefined,
      hiddenFromStatus: undefined,
      hiddenReason: undefined,
      createdAt: undefined,
      updatedAt: undefined,
    });
    added++;
  }
}

console.log(`+ ${added} tin đang tuyển, hiện có ${await Job.countDocuments(await visibleMatch())} tin hiển thị`);
await mongoose.disconnect();
