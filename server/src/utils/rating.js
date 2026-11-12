import Review from '../models/Review.js';
import User from '../models/User.js';

// BR-34: chỉ tính Review đang hiển thị, làm tròn 1 chữ số
export const recomputeRating = async (userId, session) => {
  const [r] = await Review.aggregate([
    { $match: { revieweeId: userId, isHidden: false } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]).session(session || null);
  await User.updateOne(
    { _id: userId },
    { ratingAvg: r ? Math.round(r.avg * 10) / 10 : 0, ratingCount: r?.count || 0 },
    { session },
  );
};
