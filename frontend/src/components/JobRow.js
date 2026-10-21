import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Heart, Hourglass, MapPin, Moon, Sun, Sunset, Users } from 'lucide-react';
import { categoryIcon } from './Illustrations';
import { describeShifts, shiftParts, salary, DAYS, PERIODS } from '../utils/format';
import { api } from '../api';

// "Ca làm": có ô buổi thì ghi buổi + khung giờ lấy từ ghi chú ("Tối T2–T6, 18h–22h"), không lặp lại ngày;
// không có ô buổi thì dùng nguyên ghi chú của nhà tuyển dụng
const HOURS = /\d{1,2}h(\d{2})?\s*[–-]\s*\d{1,2}h(\d{2})?/;
export const shiftText = (j) => {
  const d = describeShifts(j.shifts);
  if (!d) return j.schedule || '';
  const h = j.schedule?.match(HOURS)?.[0];
  return h ? `${d}, ${h}` : d;
};

// Bấm kèm Cmd/Ctrl/Shift hoặc chuột giữa thì để trình duyệt mở tab mới như link thường
export const plainClick = (e) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

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
const DAY = 864e5;

// Tin đã lưu của sinh viên (để tô tim trên thẻ) và lưu / bỏ lưu một tin
export const loadSavedIds = () => api.get('/students/me/saved-jobs').then((r) => new Set(r.data.map((j) => j._id))).catch(() => new Set());
// Lưu / bỏ lưu cho component có state.savedIds: đổi ngay trên giao diện rồi mới gọi API, lỗi thì trả lại như cũ
export const saveToggler = (comp) => async (id, saved) => {
  const flip = (on) => comp.setState((s) => {
    const savedIds = new Set(s.savedIds);
    if (on) savedIds.add(id); else savedIds.delete(id);
    return { savedIds };
  });
  flip(!saved);
  await (saved ? api.del : api.put)(`/students/me/saved-jobs/${id}`).catch(() => flip(saved));
};

// Thẻ việc kiểu sàn tuyển dụng (trang Tìm việc, trang chủ). Cả thẻ bấm được nhờ link tên việc phủ toàn thẻ (::after),
// nút tim nằm trên lớp đó. Chân thẻ là tín hiệu để quyết định nhanh: hợp lịch, số ứng viên, chỗ còn lại, hạn nộp, tin mới.
// Lưu tin: sinh viên truyền onSave + saved; khách truyền saveHref (dẫn đi đăng nhập); nhà tuyển dụng không truyền gì.
const JobRow = ({ job: j, category, on, onClick, badge = true, saved, onSave, saveHref }) => {
  const Icon = categoryIcon(category);
  const left = j.slots - (j.acceptedCount || 0);
  const daysLeft = Math.ceil((new Date(j.expiresAt) - Date.now()) / DAY);
  const isNew = Date.now() - new Date(j.createdAt) < 2 * DAY;
  return (
    <article className={`jx-row ${on ? 'on' : ''}`}>
      <span className="jx-logo">
        {j.companySnapshot?.logoUrl ? <img src={j.companySnapshot.logoUrl} alt="" width="56" height="56" loading="lazy" /> : <Icon size={22} aria-hidden="true" />}
      </span>
      <div className="jr-head">
        <h3 className="jr-title">
          <Link to={`/jobs/${j._id}`} className="jr-link" aria-current={on ? 'true' : undefined} onClick={onClick}>{j.title}</Link>
        </h3>
        <span className="jr-company">{j.companySnapshot?.name}</span>
      </div>
      {onSave ? (
        <button type="button" className={`jr-save ${saved ? 'on' : ''}`} aria-pressed={!!saved} aria-label={saved ? 'Bỏ lưu tin' : 'Lưu tin'} onClick={() => onSave(j._id, saved)}>
          <Heart size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      ) : saveHref && (
        <Link to={saveHref} className="jr-save" aria-label="Đăng nhập để lưu tin"><Heart size={18} aria-hidden="true" /></Link>
      )}
      <ul className="jr-tags">
        <li className="jr-tag jr-pay">{salary(j)}</li>
        <li className="jr-tag"><MapPin size={14} aria-hidden="true" />{j.district || j.city}</li>
        {j.shifts?.length > 0
          ? shiftParts(j.shifts).map((p) => {
            const PIcon = PERIOD_ICON[p.period];
            return <li key={p.period} className={`jr-tag jr-p${p.period}`}><PIcon size={15} aria-hidden="true" /><b>{p.label}</b>{p.days}</li>;
          })
          : j.schedule && <li className="jr-tag"><Clock size={14} aria-hidden="true" />{j.schedule}</li>}
      </ul>
      <div className="jr-foot">
        <FitBadge job={j} />
        <span><Users size={14} aria-hidden="true" />{j.applicationCount ? `${j.applicationCount} ứng viên` : 'Ứng tuyển đầu tiên'}</span>
        <span>{left > 0 ? `Còn ${left}/${j.slots} chỗ` : 'Đã đủ người'}</span>
        <span className={daysLeft <= 3 ? 'jr-urgent' : ''}><Hourglass size={14} aria-hidden="true" />{daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`}</span>
        <span className="jr-end">
          {isNew && <span className="jr-new">Mới</span>}
          {badge && j.isFeatured && <span className="jt-badge">Nổi bật</span>}
        </span>
      </div>
    </article>
  );
};

export default JobRow;
