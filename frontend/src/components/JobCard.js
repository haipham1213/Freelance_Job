import React from 'react';
import { Clock, MapPin, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CompanyLogo } from './ui';
import { salary, timeAgo } from '../utils/format';

const JobCard = ({ job, category, extra }) => {
  const featured = job.isFeatured ?? new Date(job.featuredUntil) > new Date();
  return (
    <Link to={`/jobs/${job._id}`} className={`job-card ${featured ? 'featured' : ''}`}>
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <CompanyLogo src={job.companySnapshot?.logoUrl} name={job.companySnapshot?.name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row-between" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <h3 className="h-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</h3>
            {featured && <span className="chip chip-featured tiny">★ Nổi bật</span>}
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>{job.companySnapshot?.name}</div>
        </div>
      </div>
      <div className="row-between" style={{ marginTop: 16 }}>
        <span className="salary">{salary(job)}</span>
        {extra}
      </div>
      <div className="job-meta" style={{ marginTop: 12 }}>
        <span className="ico-row"><MapPin size={14} />{[job.district, job.city].filter(Boolean).join(', ')}</span>
        {job.schedule && <span className="ico-row"><Clock size={14} />{job.schedule}</span>}
        {category && <span className="ico-row"><Tag size={14} />{category}</span>}
        <span className="fog">{timeAgo(job.createdAt)}</span>
      </div>
    </Link>
  );
};

export default JobCard;
