# API khác

## Thông báo

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/notifications` | 🔑 | Danh sách, phân trang |
| GET | `/notifications/unread-count` | 🔑 | Số chưa đọc (badge trên navbar) |
| PATCH | `/notifications/read-all` | 🔑 | Đánh dấu tất cả đã đọc |
| PATCH | `/notifications/:id/read` | 🔑 | Đánh dấu một thông báo |

Loại thông báo: `NEW_APPLICATION`, `APPLICATION_ACCEPTED`, `APPLICATION_REJECTED`, `WORK_RESULT`, `REVIEW_RECEIVED`, `PAYMENT_SUCCESS`, `VIOLATION`.

## Đăng ký email việc mới

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| POST | `/job-alerts` | 🌐 | `{ email, busySlots? }`, giới hạn 10 request/phút. Gửi lại cùng email thì cập nhật lịch |
| GET | `/job-alerts/unsubscribe?token=` | 🌐 | Hủy đăng ký, chuyển về `/?alerts=off` |

Khi có tin mới, email gửi cho người đăng ký có ít nhất một ca của tin không trùng lịch bận (tin linh hoạt gửi cho tất cả).

## Danh mục và gói

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/categories` | 🌐 | Danh mục đang dùng |
| GET | `/plans` | 🌐 | Gói Premium, kèm `meta.tiers` (hạn mức miễn phí/Premium) |

## Quản trị

Tất cả route `/admin/*` yêu cầu vai trò 🛡️ ADMIN.

| Method | Đường dẫn | Mô tả |
| --- | --- | --- |
| GET | `/admin/categories` | Tất cả danh mục (cả đang ẩn) kèm số tin |
| POST | `/admin/categories` | Tạo `{ name }` (2–60 ký tự) |
| PUT | `/admin/categories/:id` | Đổi tên hoặc ẩn `{ name?, isActive? }` — danh mục chỉ ẩn, không xóa |
| POST | `/admin/categories/:id/image` | Ảnh JPG/PNG ≤ 2 MB |
