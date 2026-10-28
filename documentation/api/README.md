# REST API

Base URL: `http://localhost:5050/api/v1`. Ký hiệu quyền: 🌐 công khai · 🔑 cần đăng nhập · 🎓 sinh viên · 🏢 nhà tuyển dụng · 🛡️ admin · ✉️ cần xác thực email.

- [Xác thực](#xác-thực-auth)
- [Tin tuyển dụng](jobs.md)
- [Đơn ứng tuyển](applications.md)
- [Hồ sơ sinh viên và nhà tuyển dụng](profiles.md)
- [Thông báo, đăng ký email, danh mục, gói, admin](others.md)

## Xác thực (`/auth`)

Các route đăng ký/đăng nhập bị giới hạn 20 request/phút (đổi bằng `AUTH_RATE_LIMIT`).

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | `/auth/register` | 🌐 | `{ fullName, email, password, role: STUDENT \| EMPLOYER }`. Mật khẩu 8–64 ký tự, có chữ và số |
| POST | `/auth/verify-email` | 🌐 | `{ token }` từ link trong email |
| POST | `/auth/resend-verification` | 🔑 | Gửi lại email xác thực |
| POST | `/auth/login` | 🌐 | Trả `accessToken`, đặt cookie `refreshToken` |
| POST | `/auth/refresh` | cookie | Cấp access token mới, xoay vòng refresh token |
| POST | `/auth/logout` | cookie | Thu hồi refresh token, xóa cookie |
| POST | `/auth/forgot-password` | 🌐 | `{ email }` → gửi link đặt lại |
| POST | `/auth/reset-password` | 🌐 | `{ token, password }` |
| GET | `/auth/me` | 🔑 | Thông tin người dùng hiện tại |

Token xác thực email và đặt lại mật khẩu chỉ dùng được một lần.

### Ví dụ

```bash
curl -X POST http://localhost:5050/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student47@demo.vn","password":"Matkhau123"}' -c cookies.txt
```
