# UniNest Backend

## Chạy môi trường phát triển

1. Sao chép `.env.example` thành `.env` và cập nhật thông tin PostgreSQL, JWT, R2.
2. Tạo database `uninest` trong pgAdmin 4.
3. Chạy `document/booking-schema.sql` trong Query Tool nếu `DB_SYNCHRONIZE=false` và chưa dùng migration.
4. Cài dependency bằng `npm install`.
5. Chạy seed nền bằng `npm run seed`.
6. Khởi động bằng `npm run start:dev`.

API mặc định tại `http://localhost:3000/api/v1`, Swagger tại `http://localhost:3000/api/docs`.

Để nạp lại toàn bộ 55 phòng từ `rooms-data.json` cùng tài khoản sinh viên dùng cho kiểm thử, chạy `npm run seed -- rooms`. Tài khoản mẫu: `0900000001` / `UniNest@123`.

## Rooms API

- `GET /rooms`: trả toàn bộ phòng chưa xóa, không phân trang, lọc hay sắp xếp.
- `GET /rooms/:id`: trả chi tiết một phòng hoặc HTTP 404.

API dùng thực thể và bảng `listings` hiện có làm nguồn dữ liệu phòng; `resourceId` ở luồng booking chính là `listing.id`. Có thể kiểm tra dữ liệu trong pgAdmin bằng:

```sql
SELECT COUNT(*) FROM listings;
SELECT * FROM listings LIMIT 5;
```

## Booking API

- `GET /bookings/slots?listingId=&date=YYYY-MM-DD`: lấy slot theo lịch phòng.
- `POST /bookings`: tạo yêu cầu `pending`, hết hạn sau 15 phút.
- `GET /bookings`: danh sách lịch hẹn của tài khoản hiện tại.
- `GET /bookings/:id`: chi tiết, phòng và timeline.
- `PATCH /bookings/:id/confirm`: chủ trọ xác nhận.
- `PATCH /bookings/:id/hold`: giữ chỗ 7 ngày.
- `DELETE /bookings/:id`: hủy; dưới 24 giờ phải gửi `reason`.

Cron trong `BookingExpirationService` chạy mỗi phút. Có thể gọi trực tiếp `handleExpiredBookings()` trong kiểm thử; truy vấn cập nhật có điều kiện bảo đảm chạy lặp không đổi kết quả.

## Kiểm tra chất lượng

```bash
npm run test
npm run test:cov
npm run test:e2e
npm run test:e2e:cov
npm run typecheck
npm run build
npm run lint
npm run format:check
```

Trong pgAdmin, kiểm tra `bookings`, `booking_events` và các index `idx_bookings_*` tại `Schemas > public > Tables`.
