# AI Backend Implementation Workflow

Mọi AI coding assistant và thành viên dự án phải tuân thủ nghiêm ngặt quy trình 7 bước sau khi tiếp nhận yêu cầu code backend:

```
[1. Check Mandates & Boundaries] -> [2. Inspect Entities & Base Services] -> [3. Implement Module (DTO, Entity, Service, Controller)]
  -> [4. Verify & Test Endpoints] -> [5. Run Format, Lint & Typecheck] -> [6. Update Docs & Migrations] -> [7. Confirm to User]
```

## Bước 1: Kiểm tra Ràng buộc, Ranh giới & Ràng buộc Bắt buộc
- Đọc [**`agent/rules.md`**](./rules.md):
  - **KIỂM TRA NHÁNH GIT PHỤ TRÁCH**: Xác định file/tính năng sắp sửa thuộc trách nhiệm của nhánh Git nào. Luôn checkout đúng nhánh trước khi code (`feat/sp1-base-backend-local`, `feat/sp1-api-auth-rbac`, ...).
  - **SỬ DỤNG MODULE SẴN CÓ**: Chỉ code trong các module `@modules/*` và hạ tầng `@core/*`, `@common/*` sẵn có.
  - **100% TIẾNG VIỆT THỐNG NHẤT**: Toàn bộ message, exception, validation error đều dùng tiếng Việt.
  - **100% VALIDATION QUA DTO**: Không bao giờ nhận body/params kiểu `any`.
  - **HẰNG SỐ IN HOA**: Mọi hằng số mới phải viết kiểu `UPPER_SNAKE_CASE`.
  - **KHÔNG COMMENT BỪA BÃI**: Để code tự tường minh, không comment giải thích các dòng code hiển nhiên.
  - **KHOẢNG CÁCH DÒNG LOGIC**: Luôn có dòng trống phân cách giữa các block biến, hàm, if/else, return.
- Đọc [**`agent/business-logic.md`**](./business-logic.md): Kiểm tra xem tính năng có thuộc danh sách **Out of scope** (không build) hay không.

## Bước 2: Rà soát & Tái sử dụng Hạ tầng Hiện có
- Tra cứu `@core/database` để tái sử dụng kết nối TypeORM và naming strategy.
- Tra cứu `@core/storage` để dùng `R2StorageService` cho các tác vụ media/ảnh.
- Tra cứu `@common` để dùng `HttpExceptionFilter`, `AllExceptionsFilter`, `TransformInterceptor`, `@CurrentUser`, `@Roles`.

## Bước 3: Triển khai Module theo Kiến trúc Screaming
- Đặt code vào đúng thư mục module: `src/modules/<module-name>/`:
  - `dto/`: Request & Response DTOs với decorator `class-validator` và `@nestjs/swagger`.
  - `entities/`: TypeORM entities độc lập cho từng module.
  - `controllers/`: Routing, HTTP methods, Swagger docs, gọi Service xử lý.
  - `services/`: Nghiệp vụ domain chính, truy vấn database qua TypeORM Repository.
  - `<module-name>.module.ts`: Khai báo TypeOrmModule.forFeature, providers, controllers, exports.
  - `index.ts`: Barrel export của module.
- Khai báo module mới vào `app.module.ts`.

## Bước 4: Kiểm thử Endpoint & Database
- Khởi chạy dev server hoặc kiểm tra endpoint:
  - Kiểm tra kết quả trả về đúng chuẩn envelope `{ status: true, data: ..., error: null, messages: ... }`.
  - Khi lỗi: `{ status: false, data: null, error: ..., messages: ... }`.
  - Kiểm tra DTO validation chặn đúng dữ liệu sai (400 Bad Request kèm chi tiết lỗi trong messages).
  - Kiểm tra Swagger docs hiển thị đầy đủ schema tại `/api/docs`.

## Bước 5: Tự động Định dạng & Kiểm tra Type, Lint
Bắt buộc chạy đầy đủ các lệnh sau để tự động format khoảng cách dòng, dọn import thừa và xác minh 0 lỗi:
```bash
npm run lint:fix
npm run format
npm run typecheck
npm run lint
npm run format:check
```
Đảm bảo **0 lỗi TypeScript, 0 lỗi ESLint**.

## Bước 6: Cập nhật Tài liệu Nghiệp vụ (nếu có thay đổi)
- Nếu tính năng bổ sung trạng thái enum mới, bảng dữ liệu mới hoặc luồng logic mới, cập nhật vào `agent/business-logic.md`.

## Bước 7: Báo cáo cho Người dùng
- Tóm tắt ngắn gọn các việc đã làm, danh sách endpoint mới, đường dẫn file thay đổi (có markdown link trực tiếp) và kết quả kiểm tra type/lint.
## Bước 7: Commit Chuẩn & Báo cáo cho Người dùng
- Kiểm tra `git status` đảm bảo chỉ chứa các file thuộc đúng phạm vi trách nhiệm của nhánh hiện tại.
- Tạo commit với message chuẩn Conventional Commits kèm mã Task ID (ví dụ: `feat(auth): implement token revocation (TSK-SP1-02)`).
- Chờ người dùng cho phép ("Allow") trước khi commit hoặc push.
- Tóm tắt ngắn gọn các việc đã làm, danh sách endpoint mới, đường dẫn file thay đổi (có markdown link trực tiếp) và kết quả kiểm tra build/lint.
