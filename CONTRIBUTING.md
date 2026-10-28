# Hướng dẫn đóng góp

## Quy trình

1. Cập nhật `main`: `git checkout main && git pull`.
2. Tạo branch riêng theo tên thành viên hoặc chức năng, ví dụ `duc`, `feature/job-alerts`.
3. Commit nhỏ, mỗi commit một thay đổi có ý nghĩa.
4. Chạy test trước khi push (xem [documentation/testing.md](documentation/testing.md)).
5. Push branch và mở Pull Request vào `main`, nhờ ít nhất một thành viên review.

## Commit message

Viết tiếng Việt, câu ngắn bắt đầu bằng động từ, mô tả **làm gì**:

```
Thêm API đăng ký nhận email việc mới
Sửa lỗi duyệt trùng khi bấm hai tab cùng lúc
```

## Quy ước code

- Backend: ES modules, mỗi chức năng một thư mục trong `server/src/modules/`; validate body bằng `validate(zodSchema)`; báo lỗi bằng `throw new AppError(status, CODE, message)`; trả về bằng `ok(res, data, meta)`.
- Thông báo lỗi cho người dùng viết tiếng Việt, `code` viết HOA_GẠCH_DƯỚI.
- Frontend: class component, gọi API qua `frontend/src/api.js`, ưu tiên component có sẵn trong `components/ui.js` và `design-system/`.
- Không commit `server/.env`, `node_modules/`, hay file CV trong `server/uploads/cv/`.

## Tài liệu

Tài liệu kỹ thuật nằm trong `documentation/` (thư mục `docs/` đang bị `.gitignore` dùng cho tài liệu đồ án nội bộ). Khi thêm hoặc đổi API, cập nhật file tương ứng trong `documentation/api/`.
