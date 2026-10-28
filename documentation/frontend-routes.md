# Các trang frontend

Định nghĩa trong `frontend/src/App.js`. Trang có vai trò được bọc bởi `RequireRole`, chưa đăng nhập sẽ bị chuyển tới `/login?next=...`, sai vai trò thì hiện trang 403. Đây chỉ là điều hướng giao diện, backend vẫn tự kiểm tra quyền ở mọi API. Dev server CRA proxy `/api` tới `http://localhost:5050`.

## Công khai

| Đường dẫn | Component | File |
| --- | --- | --- |
| `/` | HomePage | `pages/public/HomePage.js` |
| `/jobs` | JobsPage | `pages/public/JobsPage.js` |
| `/jobs/:id` | JobDetailPage | `pages/public/JobDetailPage.js` |
| `/login`, `/register`, `/verify-email`, `/forgot-password`, `/reset-password` | Auth pages | `pages/public/AuthPages.js` |
| `/dieu-khoan`, `/quyen-rieng-tu` | Terms, Privacy | `pages/public/LegalPages.js` |
| `/notifications` | NotificationsPage (cần đăng nhập) | `pages/public/NotificationsPage.js` |

## Sinh viên (`/student`)

| Đường dẫn | File |
| --- | --- |
| `/student` | `pages/student/StudentHomePage.js` |
| `/student/profile` | `pages/student/ProfilePage.js` |
| `/student/applications` | `pages/student/ApplicationsPage.js` |
| `/student/applications/:id` | `pages/shared/ApplicationDetailPage.js` |

## Nhà tuyển dụng (`/employer`)

| Đường dẫn | File |
| --- | --- |
| `/employer` | `pages/employer/EmployerHomePage.js` |
| `/employer/company` | `pages/employer/CompanyPage.js` |
| `/employer/jobs` | `pages/employer/MyJobsPage.js` |
| `/employer/jobs/new`, `/employer/jobs/:id/edit` | `pages/employer/JobFormPage.js` |
| `/employer/jobs/:id/applicants` | `pages/employer/ApplicantsPage.js` |
| `/employer/applications/:id` | `pages/shared/ApplicationDetailPage.js` |

## Quản trị (`/admin`)

| Đường dẫn | File |
| --- | --- |
| `/admin` | Quản lý danh mục — `pages/admin/AdminPages.js` trong `AdminLayout` |

## Gọi API

Dùng `frontend/src/api.js`. Access token chỉ giữ trong bộ nhớ (không lưu localStorage); gặp lỗi 401 thì tự gọi `/auth/refresh` một lần rồi gửi lại request. Component UI dùng chung nằm ở `components/ui.js` và `design-system/` (tài liệu từng component trong `design-system/docs/`).
