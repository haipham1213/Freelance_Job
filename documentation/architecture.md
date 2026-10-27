# Kiến trúc

UniShift là ứng dụng 2 tầng chạy trong một npm workspace:

```
Trình duyệt (React 19, CRA)  ──HTTP/JSON──▶  API Express 5 (/api/v1)  ──▶  MongoDB (replica set)
        :3000                                         :5050                    │
                                                       ├──▶ Resend (email)     │
                                                       └──▶ VNPay sandbox      │
```

## Backend (`server/src`)

| Thư mục | Vai trò |
| --- | --- |
| `server.js` | Điểm khởi động: kết nối DB rồi mở cổng |
| `app.js` | Gắn middleware (helmet, cors, json 1mb, cookie-parser), router, xử lý 404 và lỗi |
| `config/` | Kết nối MongoDB (`db.js`), gửi email (`mailer.js`) |
| `middlewares/` | `authenticate`, `optionalAuth`, `authorize(...roles)`, `requireVerified`, `validate(zodSchema)`, `errorHandler` |
| `models/` | Schema Mongoose: User, Job, Application, Category, Plan, Token, Notification, JobAlert |
| `modules/<tên>/` | Router theo chức năng: auth, jobs, applications, students, employers, notifications, alerts, categories, payments, admin |
| `utils/` | `AppError`, `http.js` (ok, paging, oid, unaccent…), `notify.js`, `files.js` |

## Quy ước phản hồi

- Thành công: `{ "success": true, "data": ..., "meta"?: { page, limit, total } }`
- Lỗi: `{ "success": false, "error": { "code": "JOB_FULL", "message": "..." } }`
- Phân trang: `?page=1&limit=10`, `limit` tối đa 50.

## Xác thực

- Access token JWT (15 phút) gửi qua header `Authorization: Bearer <token>`.
- Refresh token (7 ngày) lưu trong cookie `httpOnly` `refreshToken`, path `/api/v1/auth`; DB chỉ lưu hash SHA-256.
- Tài khoản bị khóa (`LOCKED`) bị chặn ngay ở request kế tiếp.

## Tính nhất quán

Các thao tác ảnh hưởng nhiều document (duyệt ứng viên, IPN VNPay) chạy trong **transaction** MongoDB, vì vậy MongoDB phải chạy dạng replica set. Việc chuyển trạng thái dùng `findOneAndUpdate` có điều kiện để hai tab bấm cùng lúc chỉ một lệnh thành công.

## Frontend (`frontend/src`)

React 19 dùng class component, React Router 6. `api.js` bọc fetch và tự gọi `/auth/refresh` khi access token hết hạn; `context/AuthContext.js` giữ người dùng hiện tại; `routes/RequireRole.js` chặn trang theo vai trò.
