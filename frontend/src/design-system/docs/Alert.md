---
category: Feedback
---

# Alert

Hộp thông báo nền màu nhạt, bo 10px. Dùng cho lỗi form (`error`), xác nhận thành công (`ok`), thông tin (`info`), nhắc nhở (`warn`). Không có `children` thì không render gì, nên có thể đặt sẵn và chỉ truyền nội dung khi cần.

```jsx
<Alert type="error">Email hoặc mật khẩu không đúng</Alert>
<Alert type="ok">Đã lưu hồ sơ</Alert>
```
