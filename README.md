# UniShift – Marketplace việc làm part-time cho sinh viên

Đồ án Chuyên đề tốt nghiệp 2. Tài liệu: `docs/` (kế hoạch, SRS, backlog, thiết kế giao diện).

| Phần | Công nghệ |
| --- | --- |
| `server/` | Node 22, Express 5, Mongoose 9, zod, JWT + refresh cookie, Resend (email), VNPay sandbox |
| `frontend/` | React 19 (class component), Create React App, React Router 6 |

## Chạy dự án

Cần Node ≥ 22 và MongoDB chạy dạng **replica set** (transaction dùng cho duyệt ứng viên, IPN VNPay).

```bash
npm install
cp server/.env.example server/.env   # điền JWT_ACCESS_SECRET, RESEND_API_KEY, VNP_*, ADMIN_*
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
- VNPay: cần `VNP_TMN_CODE`, `VNP_HASH_SECRET` (đăng ký sandbox). IPN cần URL public (ngrok) trỏ tới `/api/v1/payments/vnpay-ipn`.
- File tải lên lưu ở `server/uploads/` và phục vụ tại `/api/v1/files/...`.
