import React from 'react';
import { Link } from 'react-router-dom';
import { Clock, Heart, Hourglass, MapPin, Moon, Sun, Sunset, Users } from 'lucide-react';
import { categoryIcon } from './Illustrations';
import { describeShifts, shiftParts, salary } from '../utils/format';
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

// Icon theo buổi: sáng mặt trời, chiều hoàng hôn, tối mặt trăng — nhìn icon là biết ca sáng hay tối
const PERIOD_ICON = [Sun, Sunset, Moon];
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
