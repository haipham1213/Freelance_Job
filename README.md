# UniShift – Marketplace việc làm part-time cho sinh viên

Đồ án Chuyên đề tốt nghiệp 2. Tài liệu: `docs/` (kế hoạch, SRS, backlog, thiết kế giao diện).

| Phần | Công nghệ |
| --- | --- |
| `server/` | Node 22, Express 5, Mongoose 9, zod, JWT + refresh cookie, đăng nhập Google (Google Identity Services), Resend (email), SePay Payment Gateway |
| `frontend/` | React 19 (class component), Create React App, React Router 6 |

## Chạy dự án

Cần Node ≥ 22 và MongoDB chạy dạng **replica set** (transaction dùng cho duyệt ứng viên, IPN SePay).

```bash
npm install
cp server/.env.example server/.env   # điền JWT_ACCESS_SECRET, RESEND_API_KEY, SEPAY_*, GOOGLE_CLIENT_ID, ADMIN_*
echo REACT_APP_GOOGLE_CLIENT_ID=<cùng Client ID> > frontend/.env.local   # bỏ qua thì ẩn nút Google
npm run seed -w server                # tạo admin, gói Premium, danh mục nếu chưa có
npm run dev                           # API http://localhost:5050 · Web http://localhost:3000
```

Cổng API là 5050 vì trên macOS cổng 5000 bị AirPlay Receiver chiếm.

## Test

```bash
npm test -w server                    # luồng end-to-end trên DB student_marketplace_test
CI=true npm test -w frontend
```

## Tài khoản demo (DB student_marketplace)

| Vai trò | Email | Mật khẩu |
| --- | --- | --- |
| Sinh viên | student47@demo.vn | Matkhau123 |
| Nhà tuyển dụng | employer20@demo.vn | Matkhau123 |
| Admin | ADMIN_EMAIL trong `server/.env` | ADMIN_PASSWORD |

## Ghi chú

- Email: Resend chỉ gửi được tới email chủ tài khoản cho tới khi xác minh domain. Ở môi trường dev, link xác thực / đặt lại mật khẩu được in ra log server.
- SePay: cần `SEPAY_MERCHANT_ID`, `SEPAY_SECRET_KEY` (sandbox dùng khóa SP-TEST-…). IPN cần URL public (ngrok) trỏ tới `/api/v1/payments/sepay-ipn`.
- Đăng nhập Google (miễn phí): Google Cloud Console → *Google Auth Platform* → tạo màn hình xin quyền (External, bấm *Publish app*) → tạo OAuth Client loại **Web application**, khai báo *Authorized JavaScript origins* `http://localhost:3000`, `http://localhost` và domain production (không cần redirect URI). Đặt Client ID vào `GOOGLE_CLIENT_ID` (server) và `REACT_APP_GOOGLE_CLIENT_ID` (frontend, đọc lúc build). Trên Vercel phải thêm cả hai biến vào Environment Variables vì file `.env` không được commit.
- Deploy: project Vercel đã nối GitHub, push lên `main` là tự deploy production.
- File tải lên lưu ở `server/uploads/` và phục vụ tại `/api/v1/files/...`.
