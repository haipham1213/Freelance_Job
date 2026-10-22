// Bộ component trình bày của UniShift, dùng cho đồng bộ claude.ai/design (npm run build:ds).
// Chỉ gồm component không phụ thuộc đăng nhập/API; Navbar, VerifyBanner, ReportModal nằm ngoài.
export { Spinner, Empty, Alert, JobBadge, AppBadge, PayBadge, Stars, Avatar, CompanyLogo, Field, Pagination, Tabs, Modal, ReasonModal, BackLink } from '../components/ui';
export { default as JobCard } from '../components/JobCard';
export { default as Footer } from '../components/Footer';
export { HeroIllustrationLeft, HeroIllustrationRight, Mascot } from '../components/Illustrations';
// Link/BackLink/JobCard/Footer cần nằm trong một Router
export { MemoryRouter, BrowserRouter } from 'react-router-dom';
