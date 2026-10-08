import React, { Component } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireRole from './routes/RequireRole';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import VerifyBanner from './components/VerifyBanner';
import HomePage from './pages/public/HomePage';
import JobsPage from './pages/public/JobsPage';
import JobDetailPage from './pages/public/JobDetailPage';
import EmployerPublicPage from './pages/public/EmployerPublicPage';
import NotificationsPage from './pages/public/NotificationsPage';
import ErrorPage from './pages/public/ErrorPage';
import { LoginPage, RegisterPage, VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage, ChangePasswordPage } from './pages/public/AuthPages';
import ApplicationDetailPage from './pages/shared/ApplicationDetailPage';
import StudentHomePage from './pages/student/StudentHomePage';
import ProfilePage from './pages/student/ProfilePage';
import ApplicationsPage from './pages/student/ApplicationsPage';
import SavedJobsPage from './pages/student/SavedJobsPage';
import EmployerHomePage from './pages/employer/EmployerHomePage';
import CompanyPage from './pages/employer/CompanyPage';
import JobFormPage from './pages/employer/JobFormPage';
import MyJobsPage from './pages/employer/MyJobsPage';
import ApplicantsPage from './pages/employer/ApplicantsPage';
import { PremiumPage, PaymentResultPage, PaymentsPage } from './pages/employer/PremiumPages';
import AdminLayout from './pages/admin/AdminLayout';
import { AdminDashboardPage, UsersPage, AdminJobsPage, ReportsPage, ReviewsPage, CategoriesPage, AdminPaymentsPage } from './pages/admin/AdminPages';

class SiteLayout extends Component {
  componentDidUpdate() { window.scrollTo(0, 0); }
  render() {
    return (
      <>
        <Navbar />
        <VerifyBanner />
        <main><Outlet /></main>
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
                <Route path="payments" element={<PaymentsPage />} />
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
        </BrowserRouter>
      </AuthProvider>
    );
  }
}

export default App;
