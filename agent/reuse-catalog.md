# Danh mục tái sử dụng — uninest-be

> **Đọc file này TRƯỚC KHI tạo module, service, guard, decorator, DTO dùng chung, hàm tiện ích hay hằng số.**
> Có sẵn thì dùng lại. Gần giống thì mở rộng (không đổi hành vi cũ). Chỉ tạo mới khi chắc chắn không có gì phù hợp, và phải nêu lý do trong báo cáo.
>
> Danh mục phản ánh code ngày 08/10/2026. Ai thêm thứ dùng chung mới thì **bổ sung vào đây trong cùng commit**.

---

## 1. Quy tắc chọn chỗ đặt code

| Thứ cần viết | Đặt ở đâu |
| --- | --- |
| Nghiệp vụ của một domain | `src/modules/<module>/services` |
| Endpoint | `src/modules/<module>/controllers` (hoặc `<module>.controller.ts` nếu module nhỏ) |
| DTO request/response | `src/modules/<module>/dtos` |
| Entity | `src/modules/<module>/entities` |
| Hằng số, tên sự kiện của module | `src/modules/<module>/constants` |
| Decorator, guard, filter, interceptor, pipe, DTO, tiện ích dùng ≥ 2 module | `src/common/<loại>` |
| Hạ tầng (DB, config, storage) | `src/core/<loại>` |
| Migration | `src/core/database/migrations` |
| Danh mục cố định (vai trò, tiện ích, địa giới, trường, từ khoá cấm forum) | `src/core/database/seeders/catalog.seeder.ts` + `seeders/data/*.json` |
| Dữ liệu mẫu (tài khoản, tin, chat) | `src/core/database/seeders/demo.seeder.ts` |

Module hiện có: `auth`, `users`, `listings`, `search`, `booking`, `chat`, `forum`, `universities`, `locations`, `health`, và khung rỗng chờ làm: `reviews`, `notifications`, `payment`, `ai-chat`, `recommendations`. **Viết tiếp vào khung đã có**, không tạo module trùng nghĩa. Module mới (vd `admin`, `price-comparison`, `premium`) chỉ tạo khi được giao, theo cấu trúc ở `rules.md`.

Module A cần dữ liệu của module B → import **service đã export** của B (B khai báo trong `exports` của module), không truy vấn thẳng bảng của B từ A trừ khi chỉ đọc đơn giản qua `DataSource`/repository có sẵn.

---

## 2. `@common`

| Thứ | Dùng khi |
| --- | --- |
| `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRoleType.X)` | Endpoint cần đăng nhập + đúng vai trò. **Mọi endpoint không công khai phải có.** |
| `@Public()` | Endpoint công khai (tìm kiếm, tiện ích, health…) |
| `@CurrentUser('userId')` / `@CurrentUser()` | Lấy người đang gọi. **Không** đọc `req.user` thủ công |
| `UserRoleType` (`STUDENT 0`, `LANDLORD 1`, `ADMIN 2`), `ROLE_NAMES`, `ROLE_CODES` | Vai trò |
| `PAGINATION_DEFAULTS` (trang 1, 20, tối đa 100) | Phân trang mặc định |
| `PaginationQueryDto`, `PaginatedResultDto`, `createPaginatedResult()` | Query `page`/`limit` và kết quả phân trang chuẩn |
| `ApiResponseDto` | Mô tả envelope trong Swagger |
| `HTTP_STATUS_CODES`, `SYSTEM_CONSTANTS` | Hằng số hệ thống |
| `TransformInterceptor` (đã bật toàn cục) | Tự bọc response `{ status, data, error, messages }` — controller chỉ `return data` |
| `AllExceptionsFilter`, `HttpExceptionFilter` (đã bật toàn cục) | Tự bọc lỗi — chỉ cần `throw new XxxException('thông báo tiếng Việt')` |
| `LoggingInterceptor` (đã bật) | Log request |
| `createGlobalValidationPipe()` (đã bật) | Validate DTO toàn cục, `whitelist` |
| `escapeLikePattern(text)` | Mọi truy vấn `LIKE`/`ILIKE` từ khoá người dùng nhập |

---

## 3. `@core`

| Thứ | Dùng khi |
| --- | --- |
| `ConfigService` + `EnvironmentVariables` / `validateEnv` (`core/config/env.schema.ts`) | Đọc cấu hình. **Biến môi trường mới phải khai báo trong `env.schema.ts` và `.env.example`** |
| `DatabaseModule`, `data-source.ts` | Kết nối TypeORM, `SnakeNamingStrategy`, migration |
| `LISTING_SEARCH_INDEXES_SQL`, `UNACCENT_FUNCTION_SQL`, `KEYWORD_TRIGRAM_INDEXES_SQL` | Index tìm kiếm, hàm `uninest_unaccent` (tìm không dấu) |
| `R2StorageService` | Mọi việc với file: `generatePresignedUploadUrlForImage`, `generatePresignedUploadUrlForVideo`, `getPresignedDownloadUrl`, `getPublicUrl(key)`, `getObjectKey(urlOrKey)`, `getKeyFromPublicUrl`, `assertValidImageObject(key)`, `assertValidVideoObject(key)`, `objectExists`, `deleteFile`, `uploadDemoImageIfMissing` |
| `DEMO_SEED_IMAGE_PREFIX`, `demo-assets.ts`, `seed-assets.ts` | Bộ 400 ảnh mẫu dùng chung: key bất biến trong R2; `seed:assets` chỉ upload khi có `--upload`, `seed` chỉ ghi database |
| `STORAGE_LIMITS` | Định dạng, dung lượng, thời hạn presigned URL |
| `POST /storage/presign-upload`, `/storage/presign-video-upload` | App xin URL tải ảnh/video (video nhận `folder`: `listings`, `forum`) — **không viết endpoint presign mới cho từng module** (trừ avatar đã có `/profile/avatar/presign`) |

---

## 4. Thứ dùng chung nằm trong module

| Thứ | Ở đâu | Dùng khi |
| --- | --- | --- |
| `EventEmitter2` + hằng số sự kiện | `BOOKING_EVENTS`, `CHAT_EVENTS`, `LISTING_EVENTS` trong `constants/` của module | Phát sự kiện cho module khác (Thông báo S3…). Lắng nghe bằng `@OnEvent(TÊN_HẰNG_SỐ)` |
| `ChatGateway` + `CHAT_SOCKET_EVENTS` | `modules/chat/gateways` | Đẩy realtime tới app (phòng `user:<id>`). **Không tạo gateway Socket.IO thứ hai** — thêm sự kiện vào đây |
| `@Cron(...)` (`@nestjs/schedule`) | vd `booking-expiration.service.ts` | Mọi tác vụ định kỳ (hết hạn, tổng hợp giá, embedding, đối soát, Premium). **Không dùng Redis/BullMQ** (trừ Thông báo) |
| `doTimeRangesOverlap()`, `isCancellationReasonRequired()` | `modules/booking/services/booking-policy.ts` | Kiểm tra trùng giờ, bắt buộc lý do huỷ |
| `BOOKING_DEFAULTS`, `ACTIVE_BOOKING_STATUSES`, `activeBookingWhere()` | `modules/booking/constants` | Thời hạn phản hồi, huỷ miễn lý do; điều kiện lịch còn hiệu lực (chờ, hoặc đã xác nhận mà chưa qua giờ xem) |
| `ListingStatus`, `BookingStatus`, `RoomType`, `OtpType`, `LISTING_REPORT_REASONS`, `BOOKING_EVENT_TYPES`, `BOOKING_ACTORS`, enum forum | `entities/*` của module, `forum-enums.ts` | Cột trạng thái/loại lưu bằng enum PostgreSQL — **không viết chuỗi `'active'` trần**, thêm giá trị mới phải kèm migration `ALTER TYPE` |
| `SEARCH_DEFAULTS`, `SEARCH_SORT_VALUES` | `modules/search/search.constants.ts` | Sắp xếp, giới hạn tìm kiếm (loại phòng dùng `RoomType`) |
| `FORUM_CONSTANTS`, `ForumModerationService`, `ForumContentModerationInterceptor` | `modules/forum` | Kiểm duyệt nội dung (từ cấm, số điện thoại, số tài khoản) — dùng lại cho nội dung người dùng khác (vd đánh giá S3) |
| `CHAT_LIMITS` | `modules/chat/constants` | Giới hạn tin nhắn |
| `UniversitiesService`, `LocationsService` | `modules/universities`, `modules/locations` | Danh mục trường, tỉnh/phường |
| `RolesService`, `UsersService` | `modules/users` | Vai trò, thông tin người dùng |

---

## 5. Mẫu code chuẩn đã có (copy cách làm, không copy code)

| Việc | Xem mẫu ở |
| --- | --- |
| Controller có guard, role, Swagger, `@CurrentUser` | `modules/listings/controllers/listings.controller.ts` |
| DTO có class-validator + Swagger + message tiếng Việt | `modules/listings/dtos/create-listing.dto.ts` |
| Chuyển trạng thái có kiểm tra + ghi lịch sử + phát sự kiện | `modules/booking/services/booking.service.ts` |
| Chống tranh chấp (khoá dòng + kiểm tra trong transaction) | Tạo lịch hẹn trong `booking.service.ts` |
| Cron nội bộ cập nhật có điều kiện | `modules/booking/services/booking-expiration.service.ts` |
| Truy vấn PostGIS + query builder có tham số | `modules/search/search.repository.ts` |
| Gateway Socket.IO xác thực JWT | `modules/chat/gateways/chat.gateway.ts` |
| Kiểm duyệt nội dung bằng interceptor | `modules/forum/interceptors/content-moderation.ts` |

---

## 6. Dấu hiệu đang tạo trùng — dừng lại kiểm tra

- Đang viết `req.user` → dùng **`@CurrentUser`**.
- Đang tự bọc `{ status: true, data }` trong controller → **`TransformInterceptor`** đã làm.
- Đang `try/catch` để trả `{ status: false }` → chỉ cần **`throw new XxxException(...)`**.
- Đang viết `new S3Client` / tự ký URL → dùng **`R2StorageService`**.
- Đang ghép từ khoá vào `LIKE '%...%'` → dùng tham số + **`escapeLikePattern`**.
- Đang ghép chuỗi vào câu SQL → dùng **tham số `:name`**.
- Đang viết `setInterval` / BullMQ cho tác vụ định kỳ → dùng **`@Cron`**.
- Đang tạo `@WebSocketGateway` mới → thêm sự kiện vào **`ChatGateway`**.
- Đang đọc `process.env.X` trực tiếp → dùng **`ConfigService`** và khai báo trong `env.schema.ts`.
- Đang viết `if (status === 'pending')` bằng chuỗi → dùng **enum**.
- Đang viết danh sách từ cấm / regex số điện thoại mới → dùng **`ForumModerationService`**.
