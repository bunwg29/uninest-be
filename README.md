# UniNest Backend

NestJS (TypeScript) + PostgreSQL (PostGIS, pgvector, unaccent, pg_trgm) + Socket.IO + Cloudflare R2.

## Chạy môi trường phát triển

1. Sao chép `.env.example` thành `.env`, cập nhật PostgreSQL, JWT, R2.
2. Tạo database PostgreSQL (tên theo `DB_DATABASE`, ví dụ `uninest`).
3. `npm install`
4. Nạp dữ liệu nền: `npm run seed -- rooms` (phân quyền, tiện ích, địa giới, trường đại học, tài khoản mẫu, 55 phòng). Chạy `npm run seed` không tham số để xem danh sách seeder.
5. `npm run start:dev`

API mặc định tại `http://localhost:3000/api/v1` (đổi bằng `PORT`), Swagger tại `/api/docs`. Tài khoản mẫu dùng mật khẩu `UniNest@123`.

## Schema cơ sở dữ liệu

- Khi `DB_SYNCHRONIZE=true`, TypeORM tạo bảng theo entity.
- `DatabaseInitializerService` chạy lúc khởi động: bật extension, tạo hàm `uninest_unaccent` và các index tìm kiếm (GIST cho vị trí, GIN trigram cho từ khoá).
- Thư mục `src/core/database/migrations` chứa migration tương ứng cho môi trường không dùng synchronize; hiện chưa có script chạy migration tự động.

## Seeder

| Lệnh | Nội dung |
|---|---|
| `npm run seed -- rbac` | Vai trò và quyền |
| `npm run seed -- amenities` | Danh mục tiện ích |
| `npm run seed -- locations` | 34 tỉnh/thành, 3.321 phường/xã |
| `npm run seed -- universities` | 256 trường đại học, học viện (`seeders/data/universities.json`) |
| `npm run seed -- rooms` | Toàn bộ dữ liệu nền và 55 phòng |
| `npm run seed -- danang [--bulk[=N]]` | Tin đăng quanh các trường ở Đà Nẵng, chế độ bulk mặc định 5.000 tin |
| `npm run seed -- chat` | Dữ liệu thử nhắn tin |

## Quy tắc đặt lịch

- `POST /bookings` tạo yêu cầu `pending`, hết hạn sau `BOOKING_RESPONSE_HOURS` giờ (mặc định 24) nếu chủ trọ không phản hồi.
- `PATCH /bookings/:id/hold` giữ chỗ `HOLDING_DAYS` ngày (mặc định 7).
- Cron `BookingExpirationService` chạy mỗi 5 phút, cập nhật có điều kiện nên chạy lặp không đổi kết quả.
- Mọi thay đổi trạng thái phát sự kiện `booking.updated` qua Socket.IO (namespace `/chat`) tới sinh viên và chủ trọ; thay đổi tình trạng phòng phát `listing.availability_changed`.

## Biến môi trường đáng chú ý

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DB_POOL_SIZE` | 20 | Số kết nối tối đa tới PostgreSQL |
| `DB_LOGGING` | false | Ghi log toàn bộ câu SQL (chỉ bật khi debug) |
| `BOOKING_RESPONSE_HOURS` | 24 | Thời hạn chủ trọ phản hồi yêu cầu đặt lịch |
| `HOLDING_DAYS` | 7 | Thời hạn giữ chỗ |
| `FORUM_REPORT_HIDE_THRESHOLD` | 5 | Số báo cáo để tự ẩn bài viết |

Ở production (`NODE_ENV=production`) mã OTP không được ghi ra log.

## Kiểm tra chất lượng

```bash
npm run test
npm run test:cov
npm run test:e2e
npm run typecheck
npm run lint
npm run format:check
npm run build
```
