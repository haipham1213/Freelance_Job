import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Hourglass, MapPin, Moon, Sun, Sunset, Users } from 'lucide-react';
import { categoryIcon } from './Illustrations';
import { describeShifts, shiftParts, salary, DAYS, PERIODS } from '../utils/format';

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

// Thẻ việc (trang Tìm việc, việc tương tự). Đọc từ trên xuống theo thứ tự sinh viên quyết định: việc gì ở đâu, lương bao nhiêu,
// làm ngày nào buổi nào (dải 7 ngày, ngày có ca tô xanh), rồi các tín hiệu phụ trên một dòng mảnh. Cả thẻ bấm được nhờ link tên việc
// phủ toàn thẻ (::after).
const JobRow = ({ job: j, category, on, onClick, badge = true }) => {
  const Icon = categoryIcon(category);
  const left = j.slots - (j.acceptedCount || 0);
  const daysLeft = Math.ceil((new Date(j.expiresAt) - Date.now()) / DAY);
  const isNew = Date.now() - new Date(j.createdAt) < 2 * DAY;
  const featured = badge && j.isFeatured;
  const workDays = new Set((j.shifts || []).map((i) => Math.floor(i / 3)));
  return (
    <article className={`jx-row ${on ? 'on' : ''}`}>
      <span className="jx-logo">
        {j.companySnapshot?.logoUrl ? <img src={j.companySnapshot.logoUrl} alt="" width="48" height="48" loading="lazy" /> : <Icon size={22} aria-hidden="true" />}
      </span>
      <div className="jr-head">
        <h3 className="jr-title">
          <Link to={`/jobs/${j._id}`} className="jr-link" aria-current={on ? 'true' : undefined} onClick={onClick}>{j.title}</Link>
        </h3>
        <p className="jr-company">
          <span>{j.companySnapshot?.name}</span>
          <span className="jr-where"><MapPin size={13} aria-hidden="true" />{j.district || j.city}</span>
        </p>
      </div>
      <p className="jr-salary">{salary(j)}{featured && <span className="jt-badge">Nổi bật</span>}{isNew && <span className="jr-new">Mới</span>}</p>
      {j.shifts?.length > 0 ? (
        <div className="jr-sched">
          <ol className="jr-days" aria-hidden="true">{DAYS.map((d, i) => <li key={d} className={workDays.has(i) ? 'on' : ''}>{d}</li>)}</ol>
          <span className="jr-periods" aria-hidden="true">
            {shiftParts(j.shifts).map((p) => { const PIcon = PERIOD_ICON[p.period]; return <span key={p.period} className={`jr-p${p.period}`}><PIcon size={15} />{p.label}</span>; })}
          </span>
          <span className="sr-only">Ca làm: {shiftText(j)}</span>
        </div>
      ) : <p className="jr-sched jr-flex"><Clock size={15} aria-hidden="true" />{j.schedule || 'Giờ linh hoạt'}</p>}
      <div className="jr-foot">
        <FitBadge job={j} />
        <span><Users size={14} aria-hidden="true" />{j.applicationCount ? `${j.applicationCount} ứng viên` : 'Ứng tuyển đầu tiên'}</span>
        <span>{left > 0 ? `Còn ${left}/${j.slots} chỗ` : 'Đã đủ người'}</span>
        <span className={daysLeft <= 3 ? 'jr-urgent' : ''}><Hourglass size={14} aria-hidden="true" />{daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`}</span>
      </div>
    </article>
  );
};

export default JobRow;
