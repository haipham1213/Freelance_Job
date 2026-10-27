# Kiểm thử

## Backend

Dùng test runner có sẵn của Node (`node:test`), không cần thư viện ngoài. Test khởi động app Express thật trên cổng ngẫu nhiên và gọi API bằng `fetch`, dữ liệu ghi vào DB riêng `student_marketplace_test`.

| File | Nội dung |
| --- | --- |
| `server/tests/flow.test.js` | Luồng end-to-end: đăng ký → đăng tin → ứng tuyển → duyệt → kết quả → admin |
| `server/tests/rules.test.js` | Các business rule: khóa trường, hạn mức, chặn trạng thái sai… |

```bash
npm test -w server
```

Trên Windows (PowerShell/cmd), script `NODE_ENV=test ...` không chạy được. Dùng Git Bash, hoặc chạy trực tiếp:

```powershell
$env:NODE_ENV = "test"; cd server; node --test "tests/**/*.test.js"
```

MongoDB phải đang chạy dạng replica set như khi dev.

### Viết test mới

- Dùng helper `api(method, path, body, who)` và `register(who, role)` có sẵn trong file test.
- Mỗi test nên tự tạo dữ liệu cần thiết, không phụ thuộc dữ liệu seed.
- Kiểm tra cả `status` và `body.error.code` khi test lỗi.

## Frontend

```bash
CI=true npm test -w frontend
```

PowerShell: `$env:CI = "true"; npm test -w frontend`.
