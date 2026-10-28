# API hồ sơ

## Sinh viên

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/students/me` | 🎓 | Hồ sơ và mức độ hoàn thiện (`completion`) |
| PUT | `/students/me` | 🎓 | `fullName`, `phone`, `school`, `major`, `yearOfStudy` (1–6), `skills` (≤ 15), `bio` (≤ 1000) |
| PUT | `/students/me/schedule` | 🎓 | `{ busySlots: number[] }` — lịch bận theo ô buổi 0–20 |
| POST | `/students/me/cv` | 🎓 | Tải CV PDF ≤ 5 MB, `?fileName=` |
| GET | `/students/:id` | 🏢 🛡️ | NTD chỉ xem được sinh viên đã nộp vào tin của mình |

## Nhà tuyển dụng

| Method | Đường dẫn | Quyền | Mô tả |
| --- | --- | --- | --- |
| GET | `/employers/me` | 🏢 | Hồ sơ công ty |
| PUT | `/employers/me` | 🏢 | Cập nhật thông tin công ty |
| POST | `/employers/me/logo` | 🏢 | Logo JPG/PNG ≤ 2 MB |
| GET | `/employers/me/jobs` | 🏢 | Tin của mình |
| GET | `/employers/me/stats` | 🏢 | Thống kê cho trang tổng quan |
| GET | `/employers/hiring` | 🌐 | Công ty đang tuyển (trang chủ) |

## Tải file lên

Upload gửi **body nhị phân thô** (không phải multipart). Server kiểm tra chữ ký file (magic bytes) chứ không tin phần mở rộng:

```js
await fetch('/api/v1/students/me/cv?fileName=CV.pdf', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/pdf' },
  body: file, // đối tượng File từ <input type="file">
});
```

File được lưu ở `server/uploads/<loại>/` và phục vụ qua `/api/v1/files/...`. CV cũ không bị xóa nên đơn đã nộp vẫn giữ link CV lúc nộp.
