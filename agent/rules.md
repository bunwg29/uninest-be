# Quy chuẩn code — uninest-be

> Mỗi quy tắc có ví dụ ✅ nên / ❌ không. Code vi phạm quy tắc **bắt buộc** thì không được commit.

---

## 1. Công nghệ cố định

NestJS 11 · TypeScript strict · TypeORM 1.x + `SnakeNamingStrategy` · PostgreSQL 14+ với PostGIS, unaccent, pg_trgm (pgvector từ Sprint 4) · class-validator + class-transformer · Swagger · Socket.IO (`@nestjs/websockets`) · `@nestjs/event-emitter` · `@nestjs/schedule` · bcryptjs · AWS SDK v3 cho Cloudflare R2. Redis + BullMQ **chỉ** cho Thông báo (Sprint 3).

**Không tự cài thư viện mới, không đổi phiên bản** khi chưa được đồng ý.

---

## 2. Cấu trúc module

```
src/
  common/      # constants, decorators, dtos, filters, guards, interceptors, pipes, utils
  core/        # config, database (data-source, migrations, seeders), storage (R2)
  modules/<tên>/
    constants/   controllers/   dtos/   entities/   services/
    <tên>.module.ts
    index.ts     # barrel export
```

Module mới phải: tên `kebab-case`, đủ thư mục trên, đăng ký trong `app.module.ts`, export qua `modules/index.ts`. Chỉ tạo khi được giao.

---

## 3. Quy tắc bắt buộc

### R1. Tái sử dụng trước, tạo mới sau
Tra [`reuse-catalog.md`](./reuse-catalog.md) và `grep` code trước khi tạo guard, decorator, helper, DTO, hằng số. Gần giống → mở rộng, không viết bản thứ hai.

### R2. Mọi input đi qua DTO
Không nhận `body`/`query`/`param` kiểu `any` hay object trần. DTO có class-validator, message **tiếng Việt**, Swagger `@ApiProperty`/`@ApiPropertyOptional`. Con số validation **khớp `business-logic.md` và form bên app**.

```ts
// ❌
@Post()
create(@Body() body: any) {}

// ✅
export class CreateXxxDto {
  @ApiProperty({ example: 'Phòng gần ĐH Bách khoa' })
  @IsString({ message: 'Tiêu đề phải là chuỗi' })
  @MaxLength(150, { message: 'Tiêu đề tối đa 150 ký tự' })
  title!: string;
}
```

### R3. Phân quyền ở mọi endpoint
- Endpoint không công khai: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` + `@ApiBearerAuth()`.
- Công khai: `@Public()` và chỉ trả dữ liệu được phép công khai.
- **Kiểm tra quyền sở hữu trong service** (chủ tin, người tham gia hội thoại…), không chỉ dựa vào role.
- Không bao giờ trả `password_hash`, token, mã OTP, dữ liệu nhạy cảm trong response — kể cả API admin.

### R4. Response và lỗi
- Controller **chỉ `return data`**; `TransformInterceptor` tự bọc envelope `{ status, data, error, messages }`.
- Lỗi: `throw new BadRequestException('…')`, `NotFoundException`, `ForbiddenException`, `ConflictException`… với **message tiếng Việt**. Cần mã lỗi máy đọc → `throw new ConflictException({ message: '…', error: 'BOOKING_ALREADY_EXISTS' })`.
- Không tự `try/catch` để trả `{ status: false }`.

### R5. Ngôn ngữ
- Message trả về client, validation, Swagger description: **tiếng Việt**.
- `Logger` / log nội bộ / log seeder: **tiếng Anh**. Mã lỗi máy đọc: tiếng Anh viết hoa.
- Không log dữ liệu nhạy cảm (mật khẩu, token, OTP ở production).

### R6. Database
- Entity trong module của nó; PK `uuid` (`@PrimaryGeneratedColumn('uuid')`), `@CreateDateColumn`, `@UpdateDateColumn`; bảng cần lưu vết dùng `@DeleteDateColumn` (xoá mềm).
- Tên bảng/cột `snake_case` (tự sinh bởi naming strategy). Khoá ngoại `<thực_thể>_id`, có ràng buộc FK ở DB.
- **Đổi entity = phải có migration**: `npm run migration:generate -- src/core/database/migrations/<Tên>` → đọc lại file sinh ra → chạy `migration:run` và `migration:revert` thử. Không sửa migration đã merge, tạo migration mới.
- Truy vấn: Repository hoặc QueryBuilder **có tham số** (`:id`). **Cấm ghép chuỗi vào SQL.** Từ khoá `LIKE` dùng `escapeLikePattern`.
- PostGIS: `geography` SRID 4326, `ST_DWithin` / `ST_Distance`, có index GIST.
- Thao tác nhiều bảng phải nhất quán → dùng transaction. Tranh chấp (trùng khung giờ, thanh toán) → khoá dòng + ràng buộc unique ở DB.
- Tránh N+1: lấy quan hệ bằng join/`In(...)` theo lô, không query trong vòng lặp.

### R7. Trạng thái và nghiệp vụ
- Trạng thái dùng **enum**, không chuỗi trần.
- Chuyển trạng thái bằng cập nhật có điều kiện (`WHERE status = <trạng thái hợp lệ trước đó>`), đúng sơ đồ trạng thái trong `business-logic.md`, và ghi lịch sử nếu nghiệp vụ yêu cầu.
- Con số nghiệp vụ (thời hạn, ngưỡng) là hằng số `UPPER_SNAKE_CASE` trong `constants/`, hoặc biến môi trường có giá trị mặc định nếu cần cấu hình.

### R8. Tác vụ nền và realtime
- Tác vụ định kỳ: `@Cron` của `@nestjs/schedule`, cập nhật có điều kiện (`WHERE status = ...`) để chạy lại an toàn. **Không Redis/BullMQ** ngoài pipeline Thông báo.
- Giao tiếp giữa module: phát sự kiện bằng `EventEmitter2` với tên hằng số; module nhận dùng `@OnEvent`.
- Realtime tới app: thêm sự kiện vào `ChatGateway` (`CHAT_SOCKET_EVENTS`), không tạo gateway mới.

### R9. Cấu hình
Đọc qua `ConfigService`. Biến mới khai báo trong `src/core/config/env.schema.ts` **và** `.env.example`. Không hard-code secret, URL, khoá.

### R10. Không comment, không `any`, không bỏ qua lỗi
- Không comment trong code (kể cả `// TODO`). Không code chết, code bị comment out.
- Không `any`, `as any`, `@ts-ignore`, `eslint-disable`.
- Không `catch {}` nuốt lỗi im lặng; lỗi bất ngờ để filter xử lý, hoặc log tiếng Anh rồi ném lỗi phù hợp.
- Không `console.log` trong `src/modules` (dùng `Logger`).

### R11. Không phá cái đang chạy
- Không đổi đường dẫn, tên trường response, kiểu dữ liệu của API đang được app dùng. Cần đổi → giữ alias cũ (như `/auth/refresh-token`) và báo người dùng.
- Không đổi nghiệp vụ khi không được giao. Sửa service dùng chung → gọi thử lại các endpoint đang dùng nó.


---

## 4. Đặt tên

| Loại | Quy tắc | Ví dụ |
| --- | --- | --- |
| Controller | `<tên>.controller.ts`, class `XxxController` | `listings.controller.ts` |
| Service | `<tên>.service.ts`, class `XxxService` | `booking.service.ts` |
| Module | `<tên>.module.ts` | `chat.module.ts` |
| Entity | file theo tên thực thể, class số ít | `listing.ts` → `Listing` |
| DTO | `<hành-động>-<tên>.dto.ts`, class `XxxDto` | `create-listing.dto.ts` |
| File trong `@common` | không lặp hậu tố (`transform.ts`, không `transform.interceptor.ts`) | `current-user.ts` |
| Hằng số / enum | `UPPER_SNAKE_CASE` / `PascalCase` enum | `BOOKING_DEFAULTS`, `BookingStatus` |
| Boolean | `is`, `has`, `can`, `should` | `isRevoked` |
| Method | động từ | `findById`, `confirmBooking`, `searchNearby` |

Import qua alias `@common`, `@core`, `@modules/...`; tương đối tối đa 1 cấp trong cùng module.

---

## 5. Định dạng

- Prettier + ESLint (`npm run lint:fix`, `npm run format`).
- Dòng trống sau khối khai báo, trước `return`, trước/sau `if`/`for`/`switch`/`try`, giữa các nhóm inject trong constructor (`padding-line-between-statements` là **error**).
- Service > ~400 dòng → tách service con theo nhiệm vụ (như `forum-posts`, `forum-comments`, `forum-reports`).

---

## 6. Hiệu năng (NFR)

- API đọc thông thường ≤ 500ms P95; tìm kiếm ≤ 1,5s P95 với 5.000 tin.
- Luôn phân trang danh sách. Chỉ `select` cột cần dùng ở danh sách lớn.
- Thêm index cho cột lọc/sắp xếp thường dùng (qua migration).
- Không gọi dịch vụ ngoài (R2, LLM, cổng thanh toán) trong vòng lặp; gom lô hoặc chạy song song có giới hạn.
