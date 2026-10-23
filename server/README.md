# Thư mục `server` — Giải thích cho người mới

Đây là phần **backend** (máy chủ) của UniShift — sàn việc làm part-time cho sinh viên.
Frontend (giao diện web) **không** tự lưu dữ liệu; mỗi khi cần (đăng nhập, xem tin, nộp đơn…) nó gửi yêu cầu (request) tới server này, server xử lý rồi trả về dữ liệu dạng JSON.

> **So sánh dễ hiểu:** Hãy tưởng tượng server là một **nhà hàng**.
> - **Route** = người phục vụ nhận order ("tôi muốn xem danh sách việc").
> - **Middleware** = bảo vệ ở cửa kiểm tra vé ("bạn đã đăng nhập chưa? bạn có phải nhà tuyển dụng không?").
> - **Model** = kho nguyên liệu có quy định rõ ràng (mỗi món phải có tên, giá…).
> - **Database (MongoDB)** = cái kho thật sự chứa đồ.
> - **Utils** = dụng cụ nhà bếp dùng chung (dao, thớt…).

---

## 1. Công nghệ dùng

| Thư viện | Dùng để làm gì |
|---|---|
| **Node.js** (≥ 22) | Chạy JavaScript ở phía máy chủ |
| **Express** | Khung (framework) để tạo API: định nghĩa đường dẫn `/api/v1/jobs`… |
| **MongoDB + Mongoose** | Cơ sở dữ liệu lưu user, tin việc, đơn ứng tuyển… Mongoose giúp mô tả "hình dạng" dữ liệu |
| **Zod** | Kiểm tra dữ liệu người dùng gửi lên có hợp lệ không (email đúng dạng, mật khẩu đủ dài…) |
| **bcryptjs** | Mã hóa mật khẩu trước khi lưu (không bao giờ lưu mật khẩu gốc) |
| **jsonwebtoken (JWT)** | Tạo "vé" đăng nhập để biết ai đang gửi request |
| **helmet, cors, express-rate-limit** | Bảo mật: thêm header an toàn, chỉ cho frontend gọi, chặn gửi quá nhiều lần |
| **cookie-parser** | Đọc cookie (nơi lưu refresh token) |

Dịch vụ bên ngoài: **Resend** (gửi email), **VNPay** (thanh toán gói Premium).

---

## 2. Sơ đồ thư mục

```
server/
├── package.json        ← danh sách thư viện + các lệnh chạy (npm run dev, …)
├── .env.example        ← mẫu biến môi trường (copy thành .env rồi điền)
├── .env                ← cấu hình thật (mật khẩu, khóa bí mật) — KHÔNG commit
├── seed/
│   └── index.js        ← tạo dữ liệu ban đầu: tài khoản admin, gói Premium, danh mục
├── tests/              ← kiểm thử tự động
├── uploads/            ← file người dùng tải lên (CV, logo, avatar, ảnh bìa…)
└── src/                ← TOÀN BỘ mã nguồn chính
    ├── server.js       ← điểm khởi động
    ├── app.js          ← lắp ráp ứng dụng Express
    ├── config/         ← kết nối DB, gửi email
    ├── middlewares/    ← các "trạm kiểm tra" chạy trước khi xử lý request
    ├── models/         ← định nghĩa cấu trúc dữ liệu (bảng) trong MongoDB
    ├── modules/        ← các nhóm chức năng (auth, jobs, applications…)
    └── utils/          ← hàm tiện ích dùng chung
```

---

## 3. Một request đi qua server như thế nào?

Ví dụ: sinh viên bấm **"Ứng tuyển"** → frontend gửi `POST /api/v1/jobs/123/applications`.

```
Trình duyệt
   │  POST /api/v1/jobs/123/applications  (kèm "vé" JWT)
   ▼
server.js  → khởi động, kết nối MongoDB
   ▼
app.js     → helmet, cors, đọc JSON, đọc cookie
   ▼
modules/applications/applications.routes.js  → tìm đúng route
   ▼
middlewares/auth.js       authenticate   → Có vé không? Vé còn hạn không? Tài khoản có bị khóa không?
                          authorize('STUDENT') → Có phải sinh viên không?
                          requireVerified → Đã xác thực email chưa?
   ▼
middlewares/validate.js   → Dữ liệu gửi lên (thư giới thiệu…) có hợp lệ không?
   ▼
Hàm xử lý chính  → dùng models/ để đọc/ghi MongoDB, gọi utils/notify.js báo cho nhà tuyển dụng
   ▼
utils/http.js  ok(res, data) → trả về { success: true, data: ... }

Nếu có lỗi ở bất kỳ bước nào → middlewares/errorHandler.js trả về
   { success: false, error: { code, message } }
```

Mọi phản hồi của API đều có cùng một dạng, frontend chỉ cần kiểm tra `success`.

---

## 4. Giải thích từng phần

### 4.1. Điểm khởi động

| File | Làm gì |
|---|---|
| `src/server.js` | Kết nối MongoDB rồi mở cổng (mặc định `5050`). Đây là file được chạy đầu tiên. |
| `src/app.js` | Tạo app Express, bật các lớp bảo mật, cho phép truy cập file tải lên qua `/api/v1/files/...`, gắn tất cả route của các module, và cuối cùng gắn bộ xử lý lỗi. Có thêm `/api/v1/health` để kiểm tra server còn sống. |

### 4.2. `config/` — Cấu hình kết nối ra ngoài

| File | Làm gì |
|---|---|
| `db.js` | Kết nối MongoDB bằng địa chỉ trong `MONGODB_URI`. |
| `mailer.js` | Gửi email qua Resend: email **xác thực tài khoản**, **đặt lại mật khẩu**, **thông báo việc mới**. Nếu gửi lỗi thì chỉ ghi log, không làm hỏng việc đăng ký. Khi chạy ở máy dev, link trong email được in ra terminal để thử mà không cần email thật. |

### 4.3. `middlewares/` — Các trạm kiểm tra

Middleware là hàm chạy **trước** hàm xử lý chính, có quyền cho đi tiếp (`next()`) hoặc chặn lại.

| File | Làm gì |
|---|---|
| `auth.js` | `authenticate`: bắt buộc đăng nhập, đọc JWT ở header `Authorization: Bearer ...`, nạp user vào `req.user`. Tài khoản bị khóa thì chặn ngay.<br>`optionalAuth`: không bắt buộc đăng nhập, nhưng nếu có thì vẫn biết là ai.<br>`authorize('EMPLOYER')`: chỉ cho vai trò được liệt kê.<br>`requireVerified`: bắt buộc đã xác thực email. |
| `validate.js` | Dùng Zod kiểm tra dữ liệu gửi lên. Sai thì trả lỗi 400 kèm danh sách trường sai. |
| `errorHandler.js` | "Lưới an toàn" cuối cùng: bắt mọi lỗi, đổi thành JSON dễ hiểu (trùng dữ liệu → 409, ID sai → 400…). Ở production không lộ chi tiết lỗi hệ thống. |

### 4.4. `models/` — Cấu trúc dữ liệu

Mỗi file = một **collection** (giống "bảng") trong MongoDB.

| Model | Lưu gì |
|---|---|
| `User` | Tài khoản. Có 3 vai trò: `STUDENT` (sinh viên), `EMPLOYER` (nhà tuyển dụng), `ADMIN`. Sinh viên có thêm trường học, kỹ năng, CV, lịch học bận (`busySlots`), tin đã lưu. Nhà tuyển dụng có thông tin công ty và hạn Premium (`premiumUntil`). Mật khẩu chỉ lưu dạng mã hóa (`passwordHash`). |
| `Job` | Tin tuyển dụng: tiêu đề, mô tả, lương, địa điểm, số chỗ, ca làm (`shifts`), trạng thái (`OPEN`, `FILLED`, `CLOSED`, `COMPLETED`, `HIDDEN`), hạn hiển thị (`expiresAt`). Lưu sẵn tên/logo công ty (`companySnapshot`) để khỏi phải tra lại. |
| `Application` | Đơn ứng tuyển của sinh viên vào một Job. Trạng thái: `PENDING` (chờ) → `ACCEPTED` (nhận) / `REJECTED` (từ chối) / `WITHDRAWN` (rút) → `COMPLETED` / `NOT_COMPLETED`. Có lịch sử đổi trạng thái. |
| `Review` | Đánh giá 1–5 sao sau khi làm xong (hai chiều: SV ↔ NTD). |
| `Category` | Danh mục ngành: Phục vụ, Gia sư, IT… |
| `Plan` | Gói Premium (1 tháng, 3 tháng) và giá. |
| `Payment` | Giao dịch thanh toán VNPay. Quá 15 phút chưa trả thì coi là hết hạn. |
| `Notification` | Thông báo trong web (được nhận, bị từ chối, có đơn mới…). Tự xóa sau 90 ngày. |
| `Report` | Báo cáo vi phạm (lừa đảo, sai thông tin…) gửi lên admin. |
| `Violation` | Kết luận vi phạm của admin: V1 cảnh cáo, V2 ẩn nội dung, V3 khóa tài khoản. |
| `Token` | Các mã một lần: refresh token, mã xác thực email, mã đặt lại mật khẩu. Chỉ lưu dạng băm (hash). Tự xóa khi hết hạn. |
| `JobAlert` | Email đăng ký nhận thông báo việc mới (không cần tài khoản). |
| `AuditLog` | Nhật ký hành động quan trọng của admin và thanh toán — để tra lại "ai làm gì, lúc nào". |

**Mẹo đọc ca làm (`shifts`, `busySlots`):** một tuần chia 21 ô = 7 ngày × 3 buổi.
Số ô = `ngày * 3 + buổi` (ngày 0 = Thứ 2 … 6 = CN; buổi 0 = sáng, 1 = chiều, 2 = tối).
Ví dụ: Thứ 3 buổi tối = `1*3 + 2 = 5`.

### 4.5. `modules/` — Các nhóm chức năng (API)

Mỗi thư mục là một nhóm chức năng. File `*.routes.js` chứa các đường dẫn API; file `*.service.js` chứa logic dùng chung cho nhiều nơi. Mọi đường dẫn bắt đầu bằng `/api/v1`.

#### `auth/` — Đăng ký, đăng nhập
- `POST /auth/register` — đăng ký (chọn vai trò SV hoặc NTD), gửi email xác thực.
- `POST /auth/verify-email` — bấm link trong email để xác thực.
- `POST /auth/login` — đăng nhập, trả về **access token** (sống 15 phút) và đặt **refresh token** vào cookie (sống 7 ngày).
- `POST /auth/refresh` — access token hết hạn thì dùng refresh token đổi lấy cái mới. Mỗi lần đổi, refresh token cũ bị hủy; nếu ai đó dùng lại token cũ (dấu hiệu bị đánh cắp) → hủy mọi phiên.
- `POST /auth/logout`, `forgot-password`, `reset-password`, `change-password`, `GET /auth/me`.
- Có giới hạn số lần gọi mỗi phút để chống dò mật khẩu.

> **Vì sao 2 loại token?** Access token ngắn hạn để lỡ bị lộ thì cũng nhanh hết hạn. Refresh token nằm trong cookie `httpOnly` (JavaScript không đọc được) nên an toàn hơn, dùng để xin access token mới.

#### `jobs/` — Tin tuyển dụng
- `GET /jobs` — tìm kiếm & lọc (từ khóa không dấu, danh mục, thành phố, lương, **hợp lịch học**). Tin Nổi bật (Premium) hiện trước.
- `GET /jobs/locations` — danh sách thành phố/quận đang có việc.
- `GET /jobs/:id` — chi tiết một tin.
- `POST /jobs` — NTD đăng tin (phải có hồ sơ công ty, chưa vượt hạn mức). Sau khi đăng sẽ gửi email cho người đăng ký nhận tin phù hợp.
- `PUT /jobs/:id` sửa, `PATCH /jobs/:id/close` đóng, `/reopen` mở lại, `DELETE /jobs/:id` xóa (chỉ khi chưa có đơn).
- `jobs.service.js`:
  - `TIERS` — hạn mức: tài khoản thường tối đa **3 tin** đang mở, hiển thị **14 ngày**; Premium **20 tin**, **30 ngày**.
  - `visibleMatch` — điều kiện để một tin được hiện công khai (đang mở, còn hạn, chưa xóa, NTD không bị khóa).
  - `rejectPending` — khi đóng/ẩn tin, tự từ chối các đơn đang chờ.

#### `applications/` — Ứng tuyển & đánh giá
- `POST /jobs/:id/applications` — SV nộp đơn (kèm CV).
- `GET /jobs/:id/applications` — NTD xem danh sách đơn của tin mình.
- `GET /applications/:id` — xem chi tiết đơn. Số điện thoại/email hai bên **chỉ hiện khi đã được nhận**.
- `PATCH .../withdraw` (SV rút đơn), `.../accept` (NTD nhận), `.../reject` (từ chối), `.../result` (đánh dấu hoàn thành / không hoàn thành).
- Khi nhận đủ số chỗ → tin tự chuyển `FILLED`, các đơn còn chờ tự bị từ chối. Việc này chạy trong **transaction** (hoặc làm hết, hoặc không làm gì) để hai người bấm cùng lúc không bị nhận lố.
- `POST /applications/:id/reviews` — đánh giá sau khi làm xong (trong 14 ngày).
- `GET /reviews/recent`, `GET /users/:id/reviews` — xem đánh giá.

#### `students/` — Hồ sơ sinh viên
- Xem/sửa hồ sơ (`/students/me`), tính **% hoàn thiện hồ sơ**.
- Lưu lịch học bận (`/students/me/schedule`) để lọc việc hợp lịch.
- Tải CV PDF ≤ 5MB (`/students/me/cv`).
- Danh sách đơn đã nộp, tin đã lưu (tối đa 100).
- NTD chỉ xem được hồ sơ SV đã nộp vào tin của mình.

#### `employers/` — Nhà tuyển dụng
- Xem/sửa hồ sơ công ty, tải logo (JPG/PNG ≤ 2MB).
- Danh sách tin của tôi kèm số đơn theo trạng thái, số liệu dashboard, lịch sử thanh toán.
- `GET /employers/hiring` — các công ty đang tuyển (dải logo ở trang chủ).
- `GET /employers/:id` — trang công khai của công ty.

#### `payments/` — Mua gói Premium qua VNPay
- `GET /plans` — danh sách gói.
- `POST /payments` — tạo giao dịch, trả về link chuyển sang trang VNPay. **Số tiền lấy từ database**, không tin số tiền client gửi.
- `GET /payments/vnpay-ipn` — VNPay gọi ngược về báo kết quả. Server kiểm tra chữ ký, số tiền, trạng thái, rồi cộng thêm ngày Premium. Có chặn trường hợp VNPay gọi 2 lần.
- `vnpay.js` — tạo link và kiểm tra chữ ký (HMAC-SHA512) theo chuẩn VNPay.
- `payments.service.js` — `extendPremium`: cộng dồn ngày Premium và đánh dấu Nổi bật cho các tin đang mở.

#### `categories/`
- `GET /categories` — danh sách danh mục kèm số việc đang tuyển và mức lương phổ biến.

#### `notifications/`
- Danh sách thông báo, số chưa đọc, đánh dấu đã đọc từng cái hoặc tất cả.

#### `reports/`
- `POST /reports` — báo cáo một tin hoặc một người. Không tự báo cáo mình, không báo cáo trùng khi báo cáo cũ chưa xử lý.

#### `alerts/` — Nhận email việc mới
- `POST /job-alerts` — nhập email + lịch học bận, không cần tài khoản.
- `GET /job-alerts/unsubscribe` — link hủy trong email.
- Khi có tin mới, chỉ gửi cho ai có ít nhất một ca rảnh trùng với ca của tin.

#### `admin/` — Trang quản trị (chỉ ADMIN)
- Dashboard số liệu tổng.
- Quản lý người dùng (khóa/mở khóa), tin (ẩn/hiện), danh mục (thêm/sửa/ảnh), đánh giá (ẩn/hiện), gói (giá, bật/tắt), thanh toán.
- Xử lý báo cáo: bỏ qua, hoặc kết luận vi phạm V1/V2/V3.
- Kích hoạt Premium thủ công (khi thanh toán có sự cố).
- Mọi thao tác đều ghi vào `AuditLog`.

### 4.6. `utils/` — Dụng cụ dùng chung

| File | Làm gì |
|---|---|
| `AppError.js` | Lớp lỗi có mã HTTP + mã lỗi. Viết `throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy')` là `errorHandler` tự trả JSON đúng dạng. |
| `http.js` | `ok()` trả kết quả thành công; `paging()` phân trang (`?page=1&limit=10`, tối đa 50); `oid()` kiểm tra ID MongoDB; `unaccent()` bỏ dấu tiếng Việt để "phuc vu" tìm ra "phục vụ"; `slotList()` chuẩn hóa danh sách ô ca làm; `sha256`, `randomToken` tạo/băm mã bí mật. |
| `files.js` | Nhận file tải lên và lưu vào `uploads/`. Kiểm tra loại file bằng **nội dung thật** (vài byte đầu file), không tin đuôi file — tránh ai đó đổi tên `virus.exe` thành `cv.pdf`. Tên file được đặt ngẫu nhiên. |
| `notify.js` | Một hàm duy nhất để tạo thông báo cho người dùng, mọi module đều gọi hàm này. |
| `rating.js` | Tính lại điểm sao trung bình của một người sau khi có đánh giá mới hoặc đánh giá bị ẩn. |

### 4.7. `seed/` và `tests/`

- `seed/index.js` — chạy một lần lúc cài đặt để tạo: tài khoản admin (lấy từ `ADMIN_EMAIL`, `ADMIN_PASSWORD` trong `.env`), 2 gói Premium, 8 danh mục mặc định. Chạy lại nhiều lần cũng không bị trùng.
- `tests/flow.test.js` — kiểm thử luồng chính: đăng ký → đăng tin → nộp đơn → nhận → đánh giá.
- `tests/rules.test.js` — kiểm thử các quy tắc nghiệp vụ (hạn mức tin, quyền truy cập…).

### 4.8. `uploads/`

Chứa file người dùng tải lên, chia theo thư mục `cv/`, `logos/`, `avatars/`, `covers/`, `categories/`. Truy cập qua `http://localhost:5050/api/v1/files/<thư-mục>/<tên-file>`.

---

## 5. Cách chạy

```bash
cd server
cp .env.example .env     # rồi điền JWT_ACCESS_SECRET, ADMIN_PASSWORD, …
npm install
npm run seed             # tạo admin, gói, danh mục
npm run dev              # chạy server, tự khởi động lại khi sửa code
```

Các lệnh khác: `npm start` (chạy thường), `npm test` (chạy kiểm thử).

**Biến môi trường chính (`.env`):**

| Biến | Ý nghĩa |
|---|---|
| `PORT` | Cổng server (mặc định 5050) |
| `MONGODB_URI` | Địa chỉ MongoDB |
| `CLIENT_URL` | Địa chỉ frontend (dùng cho CORS và link trong email) |
| `JWT_ACCESS_SECRET` | Chuỗi bí mật để ký JWT — đặt dài, ngẫu nhiên |
| `RESEND_API_KEY`, `MAIL_FROM` | Gửi email |
| `VNP_TMN_CODE`, `VNP_HASH_SECRET`, `VNP_URL` | Cấu hình VNPay sandbox |
| `API_URL` | Địa chỉ public của server (VNPay gọi về đây; chạy local thì dùng ngrok) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Tài khoản admin tạo bởi seed |

> **Lưu ý:** các thao tác nhận đơn, thanh toán, xử lý vi phạm dùng **transaction** của MongoDB, nên MongoDB phải chạy ở chế độ **replica set** (MongoDB Atlas có sẵn; chạy local thì cần bật replica set).

---

## 6. Muốn thêm một API mới thì làm sao?

1. Nếu cần lưu dữ liệu mới → tạo file trong `src/models/`.
2. Thêm route vào module phù hợp trong `src/modules/<tên>/<tên>.routes.js` (hoặc tạo module mới).
3. Gắn middleware cần thiết: `authenticate`, `authorize(...)`, `validate(schemaZod)`.
4. Trong hàm xử lý: lỗi thì `throw new AppError(...)`, thành công thì `ok(res, data)`.
5. Nếu là module mới → import và thêm vào danh sách route trong `src/app.js`.
