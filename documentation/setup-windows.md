# Cài đặt trên Windows

README ở gốc viết cho macOS/Linux. Các bước dưới đây dành cho Windows 10/11.

## 1. Cài phần mềm

- [Node.js 22 LTS](https://nodejs.org) trở lên — kiểm tra bằng `node -v`.
- [MongoDB Community Server](https://www.mongodb.com/try/download/community) và `mongosh`.
- Git for Windows.

## 2. Chạy MongoDB dạng replica set

Backend dùng transaction nên MongoDB **bắt buộc** là replica set (một node là đủ).

```powershell
mkdir C:\data\rs0
mongod --replSet rs0 --dbpath C:\data\rs0 --port 27017
```

Mở cửa sổ khác, khởi tạo một lần:

```powershell
mongosh --eval "rs.initiate({ _id: 'rs0', members: [{ _id: 0, host: '127.0.0.1:27017' }] })"
```

Nếu MongoDB đã cài dạng Windows Service, thêm vào `C:\Program Files\MongoDB\Server\<version>\bin\mongod.cfg`:

```yaml
replication:
  replSetName: rs0
```

rồi khởi động lại service `MongoDB` và chạy `rs.initiate()` như trên.

## 3. Cấu hình và chạy

```powershell
npm install
Copy-Item server\.env.example server\.env
```

Mở `server\.env` và điền:

| Biến | Ghi chú |
| --- | --- |
| `JWT_ACCESS_SECRET` | Chuỗi ngẫu nhiên dài, ví dụ `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tài khoản admin do `seed` tạo |
| `RESEND_API_KEY` | Có thể để trống khi dev — link xác thực in ra log server |
| `VNP_TMN_CODE`, `VNP_HASH_SECRET` | Chỉ cần khi thử thanh toán |

```powershell
npm run seed -w server
npm run seed:jobs -w server   # tùy chọn: thêm tin demo
npm run dev
```

## Lỗi thường gặp

| Hiện tượng | Cách xử lý |
| --- | --- |
| `Transaction numbers are only allowed on a replica set member` | MongoDB chưa chạy replica set (bước 2) |
| `'NODE_ENV' is not recognized` khi `npm test` | Script test dùng cú pháp POSIX; chạy bằng Git Bash, hoặc xem [testing.md](testing.md) |
| Cổng 5050/3000 bị chiếm | `netstat -ano \| findstr :5050` rồi `taskkill /PID <pid> /F` |
