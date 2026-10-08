import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { salary, timeAgo } from '../utils/format';
import { Scene } from './Illustrations';

// Thẻ việc dạng "library card" của headspace.com: minh họa tự sinh theo id + ngành, logo công ty ở góc
const JobTile = ({ job: j, category, badge }) => (
  <Link to={`/jobs/${j._id}`} className="lib-card">
    <div className="lib-art">
      <Scene seed={j._id} category={category} className="lib-scene" />
      {badge && j.isFeatured && <span className="chip chip-dark tiny lib-badge">★ Nổi bật</span>}
      <span className="lib-logo">
        {j.companySnapshot?.logoUrl ? <img src={j.companySnapshot.logoUrl} alt="" /> : (j.companySnapshot?.name || '?')[0]}
      </span>
    </div>
    <div className="lib-salary">{salary(j)}</div>
    <h3 className="lib-title">{j.title}</h3>
    <div className="lib-meta muted small">{j.companySnapshot?.name}{category && ` · ${category}`}</div>
    <div className="lib-meta fog small ico-row"><MapPin size={14} />{[j.district, j.city].filter(Boolean).join(', ')} · {timeAgo(j.createdAt)}</div>
  </Link>
);

export default JobTile;
