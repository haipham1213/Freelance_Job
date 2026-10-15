import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { salary, timeAgo } from '../utils/format';
import { categoryIcon } from './Illustrations';

// Thẻ việc gọn kiểu TopCV: logo vuông bên trái (thiếu logo thì dùng minh họa tự sinh), tiêu đề, công ty, chip lương + địa điểm
// Thiếu logo thì dùng icon ngành trên nền ngà (DESIGN: không minh họa)
const JobTile = ({ job: j, category, badge }) => (
  <Link to={`/jobs/${j._id}`} className={`jt ${badge && j.isFeatured ? 'jt-hot' : ''}`}>
    <span className="jt-logo">
      {j.companySnapshot?.logoUrl ? <img src={j.companySnapshot.logoUrl} alt="" width="64" height="64" loading="lazy" />
        : React.createElement(categoryIcon(category), { className: 'jt-ico', 'aria-hidden': true })}
    </span>
    <span className="jt-body">
      <span className="jt-title">{badge && j.isFeatured && <span className="jt-badge">Nổi bật</span>}{j.title}</span>
      <span className="jt-company">{j.companySnapshot?.name}</span>
      <span className="jt-chips">
        <span className="jt-chip jt-salary">{salary(j)}</span>
        <span className="jt-chip ico-row"><MapPin size={13} aria-hidden="true" />{j.city || j.district}</span>
        <span className="jt-time">{timeAgo(j.createdAt)}</span>
      </span>
    </span>
  </Link>
);

export default JobTile;
