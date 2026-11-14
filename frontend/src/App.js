import React, { Component, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import withRouter from './utils/withRouter';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider } from './context/AuthContext';
import RequireRole from './routes/RequireRole';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import VerifyBanner from './components/VerifyBanner';
import HomePage from './pages/public/HomePage';
import JobsPage from './pages/public/JobsPage';
import JobDetailPage from './pages/public/JobDetailPage';
import EmployerPublicPage from './pages/public/EmployerPublicPage';
import ErrorPage from './pages/public/ErrorPage';
import { LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage, ChangePasswordPage } from './pages/public/AuthPages';
import { Spinner } from './components/ui';

// Trang công khai nằm trong bundle chính; trang theo vai trò (sinh viên, nhà tuyển dụng, admin) tải riêng khi vào lần đầu
const page = (load, name = 'default') => lazy(() => load().then((m) => ({ default: m[name] })));
const NotificationsPage = page(() => import('./pages/public/NotificationsPage'));
const TermsPage = page(() => import('./pages/public/LegalPages'), 'TermsPage');
const PrivacyPage = page(() => import('./pages/public/LegalPages'), 'PrivacyPage');
const ApplicationDetailPage = page(() => import('./pages/shared/ApplicationDetailPage'));
const StudentHomePage = page(() => import('./pages/student/StudentHomePage'));
const ProfilePage = page(() => import('./pages/student/ProfilePage'));
const ApplicationsPage = page(() => import('./pages/student/ApplicationsPage'));
const SavedJobsPage = page(() => import('./pages/student/SavedJobsPage'));
const EmployerHomePage = page(() => import('./pages/employer/EmployerHomePage'));
const CompanyPage = page(() => import('./pages/employer/CompanyPage'));
const JobFormPage = page(() => import('./pages/employer/JobFormPage'));
const MyJobsPage = page(() => import('./pages/employer/MyJobsPage'));
const ApplicantsPage = page(() => import('./pages/employer/ApplicantsPage'));
const PremiumPage = page(() => import('./pages/employer/PremiumPages'), 'PremiumPage');
const PaymentResultPage = page(() => import('./pages/employer/PremiumPages'), 'PaymentResultPage');
const PaymentHistoryPage = page(() => import('./pages/employer/PremiumPages'), 'PaymentHistoryPage');
const AdminLayout = page(() => import('./pages/admin/AdminLayout'));
const admin = (name) => page(() => import('./pages/admin/AdminPages'), name);
const AdminDashboardPage = admin('AdminDashboardPage');
const UsersPage = admin('UsersPage');
const AdminJobsPage = admin('AdminJobsPage');
const ReportsPage = admin('ReportsPage');
const ReviewsPage = admin('ReviewsPage');
const CategoriesPage = admin('CategoriesPage');
const AdminPaymentsPage = admin('AdminPaymentsPage');

// Tiêu đề tab theo route (khớp theo tiền tố dài nhất); trang động (chi tiết việc, nhà tuyển dụng) tự đặt document.title riêng
const TITLES = [
  ['/jobs', 'Tìm việc part-time'], ['/employers/', 'Nhà tuyển dụng'], ['/login', 'Đăng nhập'], ['/register', 'Đăng ký'],
  ['/verify-email', 'Xác thực email'], ['/forgot-password', 'Quên mật khẩu'], ['/reset-password', 'Đặt lại mật khẩu'],
  ['/dieu-khoan', 'Điều khoản sử dụng'], ['/quyen-rieng-tu', 'Quyền riêng tư'], ['/notifications', 'Thông báo'],
  ['/account/password', 'Đổi mật khẩu'], ['/student/profile', 'Hồ sơ'], ['/student/applications', 'Đơn ứng tuyển'],
  ['/student/saved-jobs', 'Việc đã lưu'], ['/student', 'Trang của tôi'], ['/employer/company', 'Công ty'],
  ['/employer/jobs/new', 'Đăng tin tuyển dụng'], ['/employer/jobs', 'Tin tuyển dụng'], ['/employer/applications', 'Đơn ứng tuyển'],
  ['/employer/premium', 'Gói Premium'], ['/employer/payments', 'Thanh toán'], ['/employer', 'Trang nhà tuyển dụng'], ['/admin', 'Quản trị'],
];
const SITE = 'UniShift';
export const titleFor = (path) => {
  if (path === '/') return `${SITE} – Việc làm part-time cho sinh viên`;
  const hit = TITLES.filter(([p]) => path.startsWith(p)).sort((a, b) => b[0].length - a[0].length)[0];
  return hit ? `${hit[1]} – ${SITE}` : SITE;
};

// Đổi route: cuộn lên đầu (trừ khi có #hash), chuyển focus vào <main>, cập nhật tiêu đề tab
class RouteEffects extends Component {
  componentDidMount() { document.title = titleFor(this.props.location.pathname); }
  componentDidUpdate(prev) {
    const { pathname, hash } = this.props.location;
    if (pathname === prev.location.pathname && hash === prev.location.hash) return;
    if (pathname !== prev.location.pathname) document.title = titleFor(pathname);
    if (hash) return;
    if (pathname === prev.location.pathname) return; // chỉ đổi query (bộ lọc, trang): giữ vị trí cuộn
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  }
  render() { return null; }
}
const RouteEffectsWithRouter = withRouter(RouteEffects);

class SiteLayout extends Component {
  render() {
    return (
      <>
        <a className="skip-link" href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView(); }}>Bỏ qua điều hướng</a>
        <Navbar />
        <VerifyBanner />
        <main id="main" tabIndex={-1}><ErrorBoundary><Suspense fallback={<Spinner />}><Outlet /></Suspense></ErrorBoundary></main>
        <Footer />
      </>
    );
  }
}

// Route theo mục N (33 màn hình); guard theo role, sai role → 403
class App extends Component {
  render() {
    return (
      <AuthProvider>
        <BrowserRouter>
          <RouteEffectsWithRouter />
          <Suspense fallback={<Spinner />}>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/jobs" element={<JobsPage />} />
              <Route path="/jobs/:id" element={<JobDetailPage />} />
              <Route path="/employers/:id" element={<EmployerPublicPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/dieu-khoan" element={<TermsPage />} />
              <Route path="/quyen-rieng-tu" element={<PrivacyPage />} />

              <Route element={<RequireRole />}>
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/account/password" element={<ChangePasswordPage />} />
              </Route>

              <Route path="/student" element={<RequireRole role="STUDENT" />}>
                <Route index element={<StudentHomePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="applications" element={<ApplicationsPage />} />
                <Route path="applications/:id" element={<ApplicationDetailPage />} />
                <Route path="saved-jobs" element={<SavedJobsPage />} />
              </Route>

              <Route path="/employer" element={<RequireRole role="EMPLOYER" />}>
                <Route index element={<EmployerHomePage />} />
                <Route path="company" element={<CompanyPage />} />
                <Route path="jobs" element={<MyJobsPage />} />
                <Route path="jobs/new" element={<JobFormPage />} />
                <Route path="jobs/:id/edit" element={<JobFormPage />} />
                <Route path="jobs/:id/applicants" element={<ApplicantsPage />} />
                <Route path="applications/:id" element={<ApplicationDetailPage />} />
                <Route path="premium" element={<PremiumPage />} />
                <Route path="payments" element={<PaymentHistoryPage />} />
                <Route path="payments/result" element={<PaymentResultPage />} />
              </Route>

              <Route path="*" element={<ErrorPage code={404} />} />
            </Route>

            <Route path="/admin" element={<RequireRole role="ADMIN" />}>
              <Route element={<AdminLayout />}>
                <Route index element={<AdminDashboardPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="jobs" element={<AdminJobsPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="reviews" element={<ReviewsPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="payments" element={<AdminPaymentsPage />} />
              </Route>
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    );
  }
}

export default App;
