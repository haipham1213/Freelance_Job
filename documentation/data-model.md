# Mô hình dữ liệu

Tất cả collection có `createdAt`/`updatedAt` (timestamps của Mongoose).

## User
| Trường | Ghi chú |
| --- | --- |
| `email` | unique, chữ thường |
| `passwordHash` | bcrypt, mặc định không select |
| `role` | `STUDENT` · `EMPLOYER` · `ADMIN` |
| `status` | `ACTIVE` · `LOCKED` (+ `lockReason`) |
| `emailVerified` | phải `true` mới được ứng tuyển / duyệt đơn |
| `fullName`, `phone`, `avatarUrl` | |
| `ratingAvg`, `ratingCount` | điểm đánh giá |
| `student` | `school`, `major`, `yearOfStudy`, `skills[]`, `bio`, `cv { url, fileName, uploadedAt }`, `busySlots[]` |
| `employer` | `company { name, address, phone, city, district, description, website, logoUrl }`, `premiumUntil` |

## Job
| Trường | Ghi chú |
| --- | --- |
| `employerId`, `categoryId` | tham chiếu User, Category |
| `companySnapshot` | `name`, `logoUrl`, `city` tại thời điểm đăng |
| `title`, `description`, `requirements` | tiêu đề 10–120 ký tự, mô tả ≥ 50 ký tự |
| `city`, `district`, `address` | |
| `salaryType` | `HOURLY` · `DAILY` · `PROJECT`; `salaryMin ≤ salaryMax` |
| `shifts` | các ô buổi 0–20 (7 ngày × 3 buổi); rỗng = linh hoạt |
| `startDate`, `endDate`, `expiresAt` | |
| `slots`, `acceptedCount`, `applicationCount`, `viewCount` | `slots` 1–50 |
| `status` | `OPEN` · `FILLED` · `CLOSED` · `COMPLETED` · `HIDDEN` |
| `featuredUntil` | tin nổi bật (Premium) |
| `deletedAt` | xóa mềm |
| `searchText` | chuỗi đã bỏ dấu dùng cho tìm kiếm |

## Application
| Trường | Ghi chú |
| --- | --- |
| `jobId`, `studentId`, `employerId` | mỗi sinh viên chỉ ứng tuyển 1 lần / tin |
| `jobSnapshot` | `title`, `companyName`, `startDate` |
| `coverLetter` | ≤ 1000 ký tự |
| `cvUrl` | snapshot CV lúc nộp |
| `status` | `PENDING` · `ACCEPTED` · `REJECTED` · `COMPLETED` · `NOT_COMPLETED` |
| `employerNote`, `rejectReason`, `notCompletedReason` | ≤ 500 ký tự |
| `statusHistory[]` | `{ status, at, by }` |

## Các collection khác
- **Category**: `name`, `slug`, `imageUrl`, `isActive`.
- **Plan**: gói Premium — `code`, `name`, `durationDays`, `price`, `isActive`.
- **Token**: `REFRESH` · `VERIFY_EMAIL` · `RESET_PASSWORD`, chỉ lưu `tokenHash`, có `expiresAt`, `revokedAt`, `replacedBy`.
- **Notification**: `userId`, `type`, `title`, `message`, `link`, `isRead`.
- **JobAlert**: đăng ký nhận email việc mới — `email`, `busySlots[]`, `token` (để hủy đăng ký).
