# API tin tuyển dụng

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/jobs` | 🌐 | Tìm kiếm, lọc, phân trang |
| GET | `/jobs/locations` | 🌐 | Thành phố/quận đang có tin và số lượng |
| GET | `/jobs/:id` | 🌐 | Chi tiết tin, kèm `myApplication` nếu là sinh viên đã nộp |
| POST | `/jobs` | 🏢 ✉️ | Đăng tin mới |
| PUT | `/jobs/:id` | 🏢 | Sửa tin của mình |
| PATCH | `/jobs/:id/close` | 🏢 | Đóng tin đang `OPEN` |
| PATCH | `/jobs/:id/reopen` | 🏢 | Mở lại tin `CLOSED` |
| DELETE | `/jobs/:id` | 🏢 | Xóa mềm, chỉ khi chưa có đơn |

## Tham số `GET /jobs`

| Tham số | Ý nghĩa |
| --- | --- |
| `q` | Từ khóa, không phân biệt dấu ("phuc vu" khớp "phục vụ") |
| `categoryId`, `city`, `district`, `salaryType` | Lọc chính xác |
| `salaryMin`, `salaryMax` | Khoảng lương giao nhau với khoảng của tin |
| `busy` | Danh sách ô buổi bận, ví dụ `0,3,14`. Giữ tin còn ít nhất 1 ca rảnh, tin hợp nhiều ca xếp trước |
| `page`, `limit` | Phân trang, `limit` ≤ 50 |

Mặc định sắp xếp: tin nổi bật trước, rồi mới nhất.

## Body khi đăng/sửa tin

```json
{
  "title": "Phục vụ quán cà phê ca tối",
  "description": "Mô tả tối thiểu 50 ký tự ...",
  "categoryId": "<ObjectId>",
  "city": "Hồ Chí Minh",
  "district": "Bình Thạnh",
  "salaryType": "HOURLY",
  "salaryMin": 25000,
  "salaryMax": 30000,
  "shifts": [2, 5, 8],
  "startDate": "2026-11-01",
  "slots": 3
}
```

Ô ca `shifts`: chỉ số = `ngày * 3 + buổi`, ngày 0 = Thứ 2 … 6 = Chủ nhật; buổi 0 sáng, 1 chiều, 2 tối.

## Lỗi thường gặp

| Mã | Khi nào |
| --- | --- |
| `COMPANY_PROFILE_REQUIRED` | Hồ sơ công ty thiếu tên/địa chỉ/SĐT |
| `FIELD_LOCKED` | Sửa lương, địa điểm, ngày bắt đầu khi đã nhận người |
| `JOB_HAS_APPLICATIONS` | Xóa tin đã có đơn |
| `JOB_EXPIRED`, `JOB_FULL` | Mở lại tin hết hạn hoặc đã đủ người |
