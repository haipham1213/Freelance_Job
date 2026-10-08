---
category: Overlays
---

# ReasonModal

Hộp thoại nhập lý do cho thao tác cần giải trình: từ chối đơn, ẩn tin, khóa tài khoản. `danger` cho nút đỏ, `required` bắt buộc nhập. `onSubmit` trả Promise; lỗi ném ra hiện ngay trong hộp thoại.

```jsx
<ReasonModal title="Ẩn tin" required danger confirm="Ẩn tin" onClose={close} onSubmit={(reason) => api.hide(id, reason)} />
```
