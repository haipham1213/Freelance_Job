# API đơn ứng tuyển

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | `/jobs/:id/applications` | 🎓 ✉️ | Nộp đơn `{ coverLetter? }` (≤ 1000 ký tự). CV lấy từ hồ sơ |
| GET | `/jobs/:id/applications` | 🏢 | Danh sách đơn của tin mình, lọc `?status=` |
| GET | `/applications/:id` | 🔑 | Chi tiết đơn (sinh viên, NTD của tin hoặc admin) |
| PATCH | `/applications/:id/accept` | 🏢 ✉️ | Duyệt `{ employerNote? }` |
| PATCH | `/applications/:id/reject` | 🏢 | Từ chối `{ reason? }` |
| PATCH | `/applications/:id/result` | 🏢 | `{ result: COMPLETED \| NOT_COMPLETED, reason? }` — `reason` bắt buộc khi không hoàn thành |
| GET | `/students/me/applications` | 🎓 | Đơn của sinh viên đang đăng nhập |

## Duyệt ứng viên

`accept` chạy trong transaction:

1. Tăng `acceptedCount` của tin **chỉ khi** tin còn `OPEN` và `acceptedCount < slots` — hai tab duyệt cùng lúc thì chỉ một thành công.
2. Đổi đơn `PENDING → ACCEPTED`, gửi thông báo cho sinh viên.
3. Nếu tin vừa đủ người: chuyển tin sang `FILLED`, từ chối mọi đơn `PENDING` còn lại với lý do "Đã đủ số lượng".

## Ghi kết quả

Chỉ ghi được sau ngày bắt đầu công việc (`JOB_NOT_STARTED` nếu chưa tới). Khi tin không còn đơn `ACCEPTED`, tin chuyển sang `COMPLETED`.

## Lỗi thường gặp

| Mã | Khi nào |
| --- | --- |
| `CV_REQUIRED` | Sinh viên chưa tải CV |
| `ALREADY_APPLIED` | Đã nộp đơn cho tin này |
| `JOB_NOT_OPEN` | Tin đã đóng, đủ người hoặc hết hạn |
| `JOB_FULL` | Hết chỗ khi duyệt |
| `INVALID_STATUS` | Trạng thái đơn đã đổi (tải lại trang) |
