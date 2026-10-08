# UniNest Backend

NestJS (TypeScript) + PostgreSQL (PostGIS, pgvector, unaccent, pg_trgm) + Socket.IO + Cloudflare R2.

## Chạy môi trường phát triển

1. Sao chép `.env.example` thành `.env`, cập nhật PostgreSQL, JWT, R2.
2. Tạo database PostgreSQL (tên theo `DB_DATABASE`, ví dụ `uninest`).
3. `npm install`
4. Nạp dữ liệu: `npm run seed` (xem mục Seeder).
5. `npm run start:dev`

API mặc định tại `http://localhost:3000/api/v1` (đổi bằng `PORT`), Swagger tại `/api/docs`. Tài khoản mẫu dùng mật khẩu `UniNest@123`.

## Schema cơ sở dữ liệu

Hai chế độ, chọn bằng `DB_SYNCHRONIZE`:

- `true` (mặc định khi phát triển): TypeORM đồng bộ bảng theo entity; `DatabaseInitializerService` bật extension và tạo hàm, index tìm kiếm lúc khởi động.
- `false`: schema do migration quản lý. Ứng dụng tự chạy migration còn thiếu khi khởi động.

| Lệnh | Tác dụng |
|---|---|
| `npm run migration:run` | Chạy các migration chưa chạy |
| `npm run migration:revert` | Hoàn tác migration gần nhất |
| `npm run migration:show` | Xem trạng thái migration |
| `npm run migration:generate -- src/core/database/migrations/<Tên>` | Sinh migration từ thay đổi entity |
| `npm run migration:create -- src/core/database/migrations/<Tên>` | Tạo migration trống |
| `npm run migration:run:prod` | Chạy migration từ bản build (`dist`) |

Migration hiện có:

1. `EnableExtensions`: `uuid-ossp`, `postgis`, `unaccent`, `pg_trgm`; `vector` nếu máy chủ có sẵn.
2. `InitialSchema`: toàn bộ bảng, enum, index, khoá ngoại theo entity. Tự bỏ qua nếu database đã có bảng (database từng chạy synchronize), nên có thể chuyển một database cũ sang dùng migration.
3. `SearchIndexes`: index GIST cho toạ độ, hàm `uninest_unaccent` và index trigram cho tìm theo từ khoá.
4. `DropRedundantFavoriteUnique`: gỡ ràng buộc trùng với khoá chính trên các database cũ.

Sau khi đổi entity, chạy `migration:generate` để tạo migration mới thay vì sửa các migration đã có.

## Seeder

| Lệnh | Nội dung |
|---|---|
| `npm run seed` | Danh mục + dữ liệu mẫu Đà Nẵng (tài khoản, 64 tin đăng có gắn trường, 1 hội thoại chat) |
| `npm run seed -- catalog` | Chỉ danh mục: vai trò & quyền, tiện ích, 34 tỉnh/thành + 3.321 phường/xã, 256 trường đại học |
| `npm run seed -- --bulk[=N]` | Như `npm run seed` và sinh thêm N tin (mặc định 5.000) để thử hiệu năng |

- `catalog.seeder.ts`: dữ liệu danh mục, đọc từ `seeders/data/*.json`.
- `demo.seeder.ts`: tài khoản mẫu, tin đăng quanh ĐH Bách khoa, Sư phạm, Kinh tế, VKU.
- Chạy lại nhiều lần không tạo trùng. Không chạy được khi `NODE_ENV=production`.
- Seeder tự đồng bộ schema (`DB_SYNCHRONIZE=true`) hoặc chạy migration (`false`) trước khi nạp.

Tài khoản mẫu (mật khẩu `UniNest@123`): sinh viên `0900000001`, `0900000211`, `0900000212`; chủ trọ đã xác minh `0900000201`→`0900000204`; chủ trọ chờ xác minh `0900000205`; admin `0900000299`.

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
npm run typecheck
npm run lint
npm run format:check
npm run build
```
