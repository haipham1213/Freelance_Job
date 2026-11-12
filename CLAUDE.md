# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

UniShift — marketplace việc làm part-time cho sinh viên (đồ án tốt nghiệp). Giao diện, thông báo lỗi và comment trong code đều bằng tiếng Việt. Yêu cầu nghiệp vụ nằm trong `docs/` (SRS, backlog) — comment trong code tham chiếu mã ở đó (`FR-APP-01`, `BR-12`, `NFR-22`, `API-28`…).

## Lệnh

npm workspaces: `server/` (API) và `frontend/` (CRA). Chạy từ thư mục gốc:

```bash
npm install
cp server/.env.example server/.env      # JWT_ACCESS_SECRET, RESEND_API_KEY, SEPAY_*, ADMIN_*
npm run seed -w server                   # admin, gói Premium, danh mục (seed:jobs, seed:applicants cho dữ liệu demo)
npm run dev                              # API :5050 (node --watch) + web :3000
npm test -w server                       # node:test, cần MongoDB local
cd server && NODE_ENV=test node --test --test-name-pattern="<tên test>" tests/flow.test.js   # chạy 1 test
CI=true npm test -w frontend
npm run build:ds -w frontend             # đóng gói src/design-system → ds-dist/ cho đồng bộ claude.ai/design
```

- MongoDB phải chạy dạng **replica set**: ứng tuyển, duyệt ứng viên, IPN SePay dùng `mongoose.connection.transaction`.
- Test server là test tích hợp: khởi `app` trên cổng ngẫu nhiên, `dropDatabase` DB `student_marketplace_test` (flow) / DB riêng (rules) rồi gọi API bằng `fetch`. Không có mock.
- Cổng API 5050 (macOS chiếm 5000). Frontend proxy `/api` qua `package.json` `proxy`; `src/setupProxy.js` ép `/api/v1/files` sang backend để mở CV trực tiếp.
- Dev không gửi được email thật thì link xác thực / đặt lại mật khẩu in ra log server.

## Kiến trúc backend (`server/src`, ESM, Express 5)

- `app.js` gắn mọi router của `modules/<tên>/<tên>.routes.js` dưới `/api/v1`. Mỗi module thường chỉ có một file routes (logic viết thẳng trong handler); `jobs.service.js` chứa hàm dùng chung như `isVisible`, `findOwnJob`, `sweepExpired` (chạy mỗi giờ từ `server.js`).
- Express 5 tự bắt lỗi từ handler async → cứ `throw new AppError(status, CODE, message, details?)`; `middlewares/errorHandler.js` chuẩn hóa thành `{ success:false, error:{ code, message, details } }` (cả lỗi Mongo trùng khóa/CastError).
- Phản hồi thành công luôn qua `ok(res, data, meta?, status?)` trong `utils/http.js` — nó còn **ký lại mọi URL CV** trong JSON (`/api/v1/files/cv/*.pdf` cần chữ ký, xem `utils/files.js`). Đừng `res.json` trực tiếp khi dữ liệu có thể chứa CV.
- Dùng sẵn trong `utils/http.js`: `paging` (limit ≤ 50), `oid` (validate ObjectId → 400), `unaccent`/`slugify` (tìm kiếm không dấu), `slotList`.
- Middleware chuỗi chuẩn: `authenticate` → `authorize('STUDENT'|'EMPLOYER'|'ADMIN')` → `requireVerified` → `validate(zodSchema, 'body'|'query')`. `validate` ghi đè `req.body`, còn query đã parse nằm ở `req.valid`.
- Auth: access token JWT (Bearer) + refresh token trong cookie httpOnly. Token bị vô hiệu khi đổi mật khẩu (`passwordChangedAt`); tài khoản `LOCKED` bị chặn ngay request kế tiếp.
- Đổi trạng thái đơn ứng tuyển dùng `findOneAndUpdate` có điều kiện trạng thái cũ (chống race), đẩy vào `statusHistory`, gửi thông báo qua `utils/notify.js`.
- `Job.shifts`: mảng ô buổi 0–20 (7 ngày × 3 buổi), dùng để khớp lịch học sinh viên.
- Thanh toán Premium qua **SePay Payment Gateway** (`modules/payments/`, SDK `sepay-pg-node`): `POST /payments` tạo Payment với `txnRef` = `order_invoice_number` (`UNI` + 10 hex); `GET /payments/:id` trả `checkout {url, fields}` đã ký để trình duyệt POST form sang SePay (sandbox `pay-sandbox.sepay.vn`, đổi bằng `SEPAY_ENV`); SePay gọi `POST /payments/sepay-ipn` (header `X-Secret-Key` = `SEPAY_IPN_SECRET`, chỉ nhận `ORDER_PAID` + `CAPTURED`, số tiền phải khớp) rồi `settle()` kích hoạt Premium đúng một lần. Cần `SEPAY_*` trong `.env` và khai báo IPN ở SePay (local dùng ngrok).
- File upload lưu ở `server/uploads/`, phục vụ tại `/api/v1/files/...`.

## Kiến trúc frontend (`frontend/src`, React 19, CRA)

- **Class component** toàn bộ (không hooks); cần router props thì bọc `utils/withRouter.js`.
- `api.js`: access token chỉ giữ trong bộ nhớ, gặp 401 tự refresh một lần rồi gửi lại; lỗi ném `Error` có `code/status/details`. `context/AuthContext.js` khôi phục phiên bằng refresh cookie khi tải trang.
- `App.js` định nghĩa route; `routes/RequireRole.js` chặn theo vai trò. Trang chia theo vai trò trong `pages/{public,student,employer,admin,shared}`.
- Component dùng chung trong `components/ui.js` (Spinner, Empty, Alert, JobBadge/AppBadge, Field, Modal, Tabs…); nhãn trạng thái/enum tiếng Việt ở `utils/format.js`.
- CSS thuần: `index.css` (token + class chung) và `styles/*.css` theo khu vực. Không có thư viện UI; icon từ `lucide-react`.

## Ràng buộc giao diện

- **Hero trang chủ (`.rv-hero`) bị đóng băng**: CSS khóa trong `styles/hero.css` (`@scope (.rv-hero)`), còn CSS chung nằm trong `@scope (:root) to (.rv-hero)` để không lọt vào hero. Không sửa hero khi chưa hỏi chủ dự án.
- `html { zoom: .8 }` — dùng `var(--vh)` thay cho `vh`.
- `ds-bundle/README.md` mô tả quy ước hệ thiết kế (class `card`, `btn`, `chip`…, token `var(--*)`, không gradient, không đổ bóng card).
