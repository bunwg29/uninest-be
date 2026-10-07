# UniNest Backend Rules & Enterprise Coding Standards

## 1. QUY TẮC BẮT BUỘC (CRITICAL MANDATES FOR ALL DEVELOPERS & AI)

### [MANDATE-1] NGUYÊN TẮC QUẢN LÝ & SỬ DỤNG MODULE (SCREAMING ARCHITECTURE)

- **Dự án làm theo team với kiến trúc module hóa đặc trưng của NestJS**.
- **Ưu tiên tuyệt đối các module đã define sẵn**: Mọi AI và thành viên trong nhóm phải kiểm tra và chỉ được triển khai code bên trong các module domain đã định nghĩa sẵn:
  - **Core Packages**: `@core/database`, `@core/config`, `@core/storage`.
  - **Common Packages**: `@common/filters`, `@common/interceptors`, `@common/pipes`, `@common/decorators`, `@common/constants`, `@common/dtos`.
  - **Predefined Feature Modules**:
    `@modules/auth`, `@modules/users`, `@modules/listings`, `@modules/search`,
    `@modules/comparison`, `@modules/booking`, `@modules/chat`, `@modules/forum`,
    `@modules/reviews`, `@modules/notifications`, `@modules/payment`,
    `@modules/ai-chat`, `@modules/recommendations`, `@modules/health`.
- **RÀNG BUỘC TẠO MODULE MỚI**: **TRỪ KHI** là tính năng mới hoàn toàn và **CHƯA CÓ** module define sẵn trong danh sách trên, thì mới được phép tạo module mới. Khi tạo mới:
  - Phải đặt tên chuẩn `kebab-case`.
  - Tuân thủ đầy đủ cấu trúc con (`dto/`, `entities/`, `controllers/`, `services/`, `*.module.ts`).
  - Phải export module và đăng ký vào `app.module.ts`.

### [MANDATE-2] 100% VALIDATION QUA DTO & CLASS-VALIDATOR

- **CẤM TUYỆT ĐỐI** nhận request body, query params hoặc route params ở dạng `any` hoặc raw object.
- 100% endpoint nhận dữ liệu phải khai báo DTO class với decorator validation đầy đủ (`@IsString()`, `@IsNumber()`, `@IsUUID()`, `@IsOptional()`, `@Min()`, `@Max()`,...).
- Toàn bộ DTO phải được annotate Swagger decorator (`@ApiProperty()`, `@ApiPropertyOptional()`) để tài liệu hóa API tự động.

### [MANDATE-3] HẰNG SỐ PHẢI ĐẶT TÊN IN HOA (UPPER_SNAKE_CASE)

- Mọi biến đại diện cho hằng số (system constants, error codes, database table names, config keys, roles enum) **BẮT BUỘC PHẢI VIẾT IN HOA TOÀN BỘ**.
- Ví dụ: `SYSTEM_CONSTANTS`, `HTTP_STATUS_CODES`, `USER_ROLES`, `LISTING_STATUS`, `R2_CONFIG`.

### [MANDATE-4] TÁI SỬ DỤNG HẠ TẦNG CỐT LÕI (ZERO DUPLICATION)

- Bắt buộc đọc và tái sử dụng các package nền tảng đã dựng sẵn:
  - Database: Các entity được khai báo độc lập trong từng module theo nhu cầu nghiệp vụ, dùng các decorator chuẩn của TypeORM (`@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn()`, `@UpdateDateColumn()`, `@DeleteDateColumn()`).
  - Storage: Gọi `R2StorageService` từ `@core/storage` để sinh Presigned URLs upload/download. Cấm lưu trữ binary file trực tiếp vào ổ cứng server.
  - Exception Handling: Dùng `HttpExceptionFilter`, `AllExceptionsFilter` tự động bắt và đóng gói lỗi thành chuẩn API envelope.
  - API Envelope: 100% response trả về từ server đều tự động tuân thủ cấu trúc chuẩn (thành công qua `TransformInterceptor`, lỗi qua Filters):
    ```json
    {
      "status": true,
      "data": { ... },
      "error": null,
      "messages": "Thao tác thành công"
    }
    ```
    (Khi gặp lỗi: `"status": false`, `"data": null`, `"error": "Lỗi máy chủ nội bộ" | "Lỗi ngoại lệ"`, `"messages": string | string[]`). Controller chỉ cần return data bình thường, Interceptor sẽ tự động đóng gói.

### [MANDATE-5] CẤM COMMENT BỪA BÃI (NO TRIVIAL COMMENTS)

- **Tuyệt đối không viết comment giải thích các dòng code hiển nhiên** (ví dụ: `// import module`, `// inject service`, `// handle get request`, `// return data`, `// find in database`).
- Code phải tự tường minh thông qua cách đặt tên hàm, class, biến rõ nghĩa (Self-documenting code).
- **Chỉ người lập trình trực tiếp tự comment** khi thật sự cần thiết cho các logic nghiệp vụ phức tạp, câu truy vấn SQL không gian/vector phức tạp hay ngữ cảnh phi hiển nhiên.

### [MANDATE-6] KHOẢNG CÁCH DÒNG GIỮA CÁC BLOCK LOGIC (PADDED BLOCKS)

- **Tuyệt đối không viết code dính sát nhau**.
- Phải luôn có 1 dòng trống phân cách giữa các khối logic rõ ràng:
  - Giữa các nhóm dependency injection trong constructor.
  - Giữa nhóm khai báo biến cục bộ và logic xử lý nghiệp vụ.
  - Giữa các câu lệnh điều kiện, luồng xử lý (`if`, `switch`, `try-catch`, `for`).
  - Trước câu lệnh `return` hoặc khối throw exception.
- ESLint rule `padding-line-between-statements` và Prettier sẽ tự động hỗ trợ định dạng khoảng cách chuẩn mực này.

### [MANDATE-7] AN TOÀN TRUY VẤN CƠ SỞ DỮ LIỆU & TYPEORM

- Sử dụng TypeORM Repository hoặc QueryBuilder có parameterization (`:id`, `:name`). Cấm ghép chuỗi trực tiếp vào câu lệnh SQL để chống SQL Injection.
- Các bảng cần lưu vết lịch sử (như Listings, Bookings, Users) bắt buộc dùng Soft-delete (`@DeleteDateColumn()`).
- Truy vấn không gian PostGIS dùng `ST_DWithin`, `ST_Distance`, `ST_MakePoint` với SRID 4326 (WGS 84).

### [MANDATE-8] QUY TẮC PHÂN NHÁNH GIT & TRÁCH NHIỆM MÃ NGUỒN (BRANCH RESPONSIBILITY)

- **Phát triển theo cấu trúc phân nhánh tính năng (Feature Branching)**: Dự án chia làm các nhánh tính năng độc lập (ví dụ: `feat/sp1-base-backend-local`, `feat/sp1-api-auth-rbac`, ...).
- **Trách nhiệm mã nguồn theo nhánh**: Khi thực hiện thay đổi, **BẮT BUỘC** xác định file thay đổi thuộc phạm vi nhánh nào:
  - Checkout sang đúng nhánh đó để thực hiện code, kiểm tra và commit.
  - Không gộp file của nhánh hạ tầng/base vào commit của nhánh tính năng downstream.
  - Khi cần đồng bộ giữa các nhánh, thực hiện merge theo thứ tự kế thừa: nhánh base -> nhánh feature -> kiểm tra build/lint -> push lên `origin`.
- **Format commit message chuẩn Conventional Commits**: `<type>(<scope>): <mô tả ngắn> (<TASK-ID>)` (ví dụ: `feat(auth): implement authentication endpoints (TSK-SP1-02)`).

### [MANDATE-9] 100% TIẾNG VIỆT THỐNG NHẤT TOÀN HỆ THỐNG

- **Quy chuẩn thông báo**: Toàn bộ exception message, validation message (`class-validator`) và interceptor response message gửi tới client **BẮT BUỘC PHẢI BẰNG TIẾNG VIỆT 100%**.
- **Ngoại lệ - log nội bộ**: Log phía server (`Logger`, `console.*` trong seeder) **BẮT BUỘC PHẢI BẰNG TIẾNG ANH** để dễ tìm kiếm và dùng với công cụ giám sát. Mã lỗi máy đọc dùng tiếng Anh viết hoa. Mô tả Swagger giữ tiếng Việt.
- Không viết lẫn lộn tiếng Anh trong các chuỗi thông báo lỗi trả về cho client/người dùng.
- Thống nhất các thuật ngữ nghiệp vụ (ví dụ: "Số điện thoại hoặc mật khẩu không chính xác", "Không tìm thấy vai trò", "Quyền hạn đã tồn tại", "Phiên đăng nhập không hợp lệ hoặc đã hết hạn").

---

## 2. Quy chuẩn Đặt tên Toàn diện (Naming Conventions)

### A. Tệp tin (Files) & Thư mục (Folders)

- **Controllers**: `<tên-nghiệp-vụ>.controller.ts` (ví dụ: `listings.controller.ts`, `auth.controller.ts`).
- **Services**: `<tên-nghiệp-vụ>.service.ts` (ví dụ: `listings.service.ts`, `auth.service.ts`).
- **Modules**: `<tên-nghiệp-vụ>.module.ts` (ví dụ: `listings.module.ts`, `database.module.ts`).
- **Entities**: `<tên-nghiệp-vụ>.entity.ts` (ví dụ: `user.entity.ts`, `listing.entity.ts`).
- **DTOs**: `<hành-động>-<nghiệp-vụ>.dto.ts` (ví dụ: `create-listing.dto.ts`, `update-profile.dto.ts`).
- **Interceptors / Filters / Guards / Pipes / Constants / Decorators / DTOs trong `@common`**: Không gắn đuôi lặp lại tên package (`.constant`, `.decorator`, `.dto`, `.filter`, `.interceptor`, `.pipe`) vì thư mục cha đã thể hiện rõ (ví dụ: `transform.ts`, `http-exception.ts`, `validation.ts`, `api-response.ts`, `current-user.ts`, `system.ts`).
- **Thư mục (Folders/Modules)**: `kebab-case` cho tên ghép hoặc chữ thường (ví dụ: `ai-chat`, `modules`, `core`, `common`).

### B. Biến & Hàm (Variables & Methods)

- **Tên Class**: `PascalCase` kèm hậu tố chức năng (ví dụ: `ListingsController`, `AuthService`, `CreateListingDto`, `UserEntity`).
- **Biến & Thuộc tính**: `camelCase` (ví dụ: `userId`, `listingPrice`, `totalCount`).
- **Biến Boolean**: Bắt đầu bằng `is`, `has`, `should`, `can` (ví dụ: `isActive`, `hasPermission`, `isVerified`).
- **Hàm xử lý Controller/Service**: Động từ mô tả hành động (ví dụ: `findById`, `createListing`, `updateStatus`, `searchNearby`).
- **Hằng số (Constants) & Enums**: `UPPER_SNAKE_CASE` (ví dụ: `USER_ROLES`, `HTTP_STATUS_CODES`, `LISTING_STATUS_ENUM`).

### C. Database & TypeORM

- **Tên Bảng (Tables)**: `snake_case` số nhiều (ví dụ: `users`, `listings`, `bookings`, `reviews`). Được quản lý tự động bởi `SnakeNamingStrategy`.
- **Tên Cột (Columns)**: `snake_case` (ví dụ: `created_at`, `phone_number`, `user_id`, `room_type`).
- **Khoá chính (Primary Key)**: Luôn là `id` kiểu UUID (`@PrimaryGeneratedColumn('uuid')`).
- **Khoá ngoại (Foreign Keys)**: `<tên_thực_thể_đơn>_id` (ví dụ: `user_id`, `listing_id`).

### D. Path Imports & Clean Architecture

- Luôn dùng path aliases: `@core`, `@core/*`, `@common`, `@common/*`, `@modules`, `@modules/*`.
- Tuyệt đối không dùng relative path vượt quá 1 cấp (`../../`).
- **Zero Unused Imports & Variables**: ESLint (`unused-imports/no-unused-imports: error`) và TypeScript (`noUnusedLocals: true`, `noUnusedParameters: true`). Chạy `npm run lint:fix` để tự động dọn sạch import thừa.
