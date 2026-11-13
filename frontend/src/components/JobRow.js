import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Heart, Moon, Sun, Sunset } from 'lucide-react';
import { categoryIcon } from './Illustrations';
import { describeShifts, salary, timeAgo, DAYS, PERIODS } from '../utils/format';
import { api } from '../api';

// "Ca làm": có ô buổi thì ghi buổi + khung giờ lấy từ ghi chú ("Tối T2–T6, 18h–22h"), không lặp lại ngày;
// không có ô buổi thì dùng nguyên ghi chú của nhà tuyển dụng
export const HOURS = /\d{1,2}h(\d{2})?\s*[–-]\s*\d{1,2}h(\d{2})?/;
export const hoursOf = (j) => j.schedule?.match(HOURS)?.[0];
export const shiftText = (j) => {
  const d = describeShifts(j.shifts);
  if (!d) return j.schedule || '';
  const h = hoursOf(j);
  return h ? `${d}, ${h}` : d;
};

// Nhãn mức hợp lịch, chỉ có khi đang lọc theo lịch học (API trả fit/shiftCount)
export const FitBadge = ({ job: j }) => (j.fit === undefined ? null
  : <span className={`jx-fit ${j.shiftCount ? '' : 'flex'}`}>{j.shiftCount ? `Hợp ${j.fit}/${j.shiftCount} ca` : 'Linh hoạt'}</span>);

// Lịch học: khách lưu trên trình duyệt (key này), sinh viên đăng nhập lưu ở hồ sơ (student.busySlots)
export const WEEK_KEY = 'jobsv.busySlots';
export const readWeek = () => { try { return JSON.parse(localStorage.getItem(WEEK_KEY)) || []; } catch { return []; } };
export const writeWeek = (v) => { try { localStorage.setItem(WEEK_KEY, JSON.stringify(v)); } catch { /* trình duyệt chặn lưu trữ */ } };
// Lịch học để so với ca làm: hồ sơ sinh viên trước, rồi trình duyệt
export const busyOf = (user) => (user?.student?.busySlots?.length ? user.student.busySlots : readWeek());

// Lưới tuần thu nhỏ trong khung xem trước: ca làm của tin (xanh lá) chồng lên lịch học của người xem (xám),
// ô trùng tô đỏ — liếc là biết tin có hợp lịch không
export const MiniWeek = ({ shifts, busy }) => {
  const work = new Set(shifts);
  const study = new Set(busy);
  const clash = shifts.filter((i) => study.has(i)).length;
  const summary = `Ca làm: ${describeShifts(shifts)}.${busy.length ? ` ${shifts.length - clash}/${shifts.length} ca không trùng giờ học.` : ''}`;
  return (
    <figure className="jx-mini">
      <div className="jx-mini-grid" role="img" aria-label={summary}>
        <span />
        {DAYS.map((d) => <span key={d} className="jx-mini-day">{d}</span>)}
        {PERIODS.map((p, pi) => (
          <React.Fragment key={p}>
            <span className="jx-mini-p">{p}</span>
            {DAYS.map((_, di) => {
              const i = di * 3 + pi;
              const c = work.has(i) && study.has(i) ? 'x' : work.has(i) ? 'w' : study.has(i) ? 'h' : '';
              return <span key={i} className={`jx-mini-cell ${c}`} />;
            })}
          </React.Fragment>
        ))}
      </div>
      <figcaption>
        <span><i className="jx-mini-cell w" />Ca làm</span>
        {busy.length > 0 && <span><i className="jx-mini-cell h" />Giờ học</span>}
        {clash > 0 && <span><i className="jx-mini-cell x" />Trùng giờ học</span>}
      </figcaption>
    </figure>
  );
};
// Icon theo buổi: sáng mặt trời, chiều hoàng hôn, tối mặt trăng — nhìn icon là biết ca sáng hay tối
export const PERIOD_ICON = [Sun, Sunset, Moon];

// Tin đã lưu của sinh viên (để tô tim trên thẻ). Lỗi tải thì trả Set rỗng có cờ unknown = true: trang biết là "chưa rõ"
// (không ghi đè trạng thái đang có) thay vì coi như người dùng chưa lưu tin nào
export const loadSavedIds = () => api.get('/students/me/saved-jobs').then((r) => new Set(r.data.map((j) => j._id)))
  .catch(() => Object.assign(new Set(), { unknown: true }));
// Lưu / bỏ lưu cho component có state.savedIds: đổi ngay trên giao diện rồi mới gọi API; lỗi thì trả lại như cũ
// và ghi state.saveError (trang hiển thị bằng <Alert>)
export const saveToggler = (comp) => async (id, saved) => {
  const flip = (on) => comp.setState((s) => {
    const savedIds = new Set(s.savedIds);
    if (on) savedIds.add(id); else savedIds.delete(id);
    return { savedIds };
  });
  flip(!saved);
  comp.setState({ saveError: '' });
  try {
    await (saved ? api.del : api.put)(`/students/me/saved-jobs/${id}`);
  } catch (e) {
    flip(saved);
    comp.setState({ saveError: e.message || 'Không lưu được tin này. Thử lại sau.' });
  }
};

// Thẻ việc dạng lưới (trang Tìm việc): logo + tên + "công ty • số ứng viên" + tim; chip ngành / hình thức / nơi làm;
// 2 dòng mô tả; vạch mảnh; lương lớn bên trái, thời gian đăng bên phải. Cả thẻ bấm được nhờ link tên việc phủ thẻ
export const JobCard = ({ job: j, category, on, saved, onSave, saveHref }) => {
  const Icon = categoryIcon(category);
  const [amount, unit] = salary(j).split('/');
  return (
    <article className={`jc ${on ? 'on' : ''}`}>
      <div className="jc-head">
        <span className="jc-logo">
          {j.companySnapshot?.logoUrl ? <img src={j.companySnapshot.logoUrl} alt="" width="48" height="48" loading="lazy" /> : <Icon size={22} aria-hidden="true" />}
        </span>
        <div className="jc-title-wrap">
          <h3 className="jc-title"><Link to={`/jobs/${j._id}`} state={{ from: window.location.pathname }} className="jr-link" aria-current={on ? 'true' : undefined}>{j.title}</Link></h3>
          <p className="jc-meta">
            <span className="jc-company">{j.companySnapshot?.name}</span>
            <span aria-hidden="true">•</span>
            <span>{j.district || j.city}</span>
          </p>
        </div>
        {onSave ? (
          <button type="button" className={`jc-save ${saved ? 'on' : ''}`} aria-pressed={!!saved} aria-label={`Lưu tin: ${j.title}`} onClick={() => onSave(j._id, saved)}>
            <Heart size={20} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
          </button>
        ) : saveHref && (
          <Link to={saveHref} className="jc-save" aria-label={`Đăng nhập để lưu tin: ${j.title}`}><Heart size={20} aria-hidden="true" /></Link>
        )}
      </div>
      <ul className="jc-tags">
        {j.isFeatured && <li className="jc-tag t-gold">Nổi bật</li>}
        {category && <li className="jc-tag t-plum">{category}</li>}
        <li className="jc-tag t-mint t-shift">{j.shifts?.length ? describeShifts(j.shifts) : 'Giờ linh hoạt'}</li>
        {j.applicationCount > 0 && <li className="jc-tag t-peach">{j.applicationCount} ứng viên</li>}
        {j.fit !== undefined && j.shiftCount > 0 && <li className="jc-tag t-ink">Hợp {j.fit}/{j.shiftCount} ca</li>}
      </ul>
      {j.excerpt && <p className="jc-desc">{j.excerpt}</p>}
      <div className="jc-foot">
        <p className="jc-pay">{amount}<span>/{unit}</span></p>
        <span className="jc-time"><Clock size={16} aria-hidden="true" />Đăng {timeAgo(j.createdAt)}</span>
      </div>
    </article>
  );
};
