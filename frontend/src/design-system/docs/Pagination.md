---
category: Navigation
---

# Pagination

Phân trang dạng pill: Trước · số trang · Sau. Nhận `meta` từ API ({ page, limit, total }) và tự ẩn khi chỉ có 1 trang.

```jsx
<Pagination meta={{ page: 2, limit: 10, total: 124 }} onPage={load} />
```
