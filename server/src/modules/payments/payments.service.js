import User from '../../models/User.js';
import Job from '../../models/Job.js';
import { DAY } from '../../utils/http.js';

// BR-37: premiumUntil mới = max(hiện tại, premiumUntil cũ) + số ngày; Job đang mở được Nổi bật theo
export const extendPremium = async (employerId, durationDays, session) => {
  const u = await User.findById(employerId).session(session || null);
  const base = Math.max(Date.now(), +(u.employer?.premiumUntil || 0));
  const premiumUntil = new Date(base + durationDays * DAY);
  u.set('employer.premiumUntil', premiumUntil);
  await u.save({ session });
  await Job.updateMany({ employerId, status: 'OPEN', deletedAt: null }, { featuredUntil: premiumUntil }, { session });
  return premiumUntil;
};
