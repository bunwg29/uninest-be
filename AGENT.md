# UniNest Backend - AI Developer Assistant Guide

> **DÀNH CHO AI & THÀNH VIÊN DỰ ÁN**: Khi được tag `@AGENT.md` trong câu hỏi hoặc yêu cầu, AI **BẮT BUỘC** đọc và tuân thủ tuyệt đối các quy chuẩn dưới đây trước khi phân tích, trả lời hoặc viết code.

---

## 1. 8 NGUYÊN TẮC VÀNG BẮT BUỘC (CRITICAL MANDATES)

1. **100% TIẾNG VIỆT THỐNG NHẤT**:
   - Toàn bộ exception message (`HttpException`), message validation (`class-validator`), interceptor response message và log cảnh báo **PHẢI DÙNG TIẾNG VIỆT 100%**.
   - Cấm viết thông báo lỗi bằng tiếng Anh lẫn lộn.
2. **KIỂM TRA NHÁNH GIT TRƯỚC KHI CODE (BRANCH RESPONSIBILITY)**:
   - Dự án chia nhánh theo tính năng (`feat/sp1-base-backend-local`, `feat/sp1-api-auth-rbac`, ...).
   - Xác định file cần sửa thuộc nhánh nào -> Checkout đúng nhánh đó -> Code & Test -> Commit chuẩn Conventional Commits kèm Task ID -> Push lên `origin`.
   - Không sửa gộp file của nhánh hạ tầng/base vào commit của nhánh tính năng downstream.
3. **ƯU TIÊN TUYỆT ĐỐI MODULE CÓ SẴN (SCREAMING ARCHITECTURE)**:
   - Chỉ code trong các module đã định nghĩa:
     - `@core`: `database`, `config`, `storage` (Cloudflare R2).
     - `@common`: `filters`, `interceptors`, `pipes`, `decorators`, `constants`, `dtos`.
     - `@modules`: `auth`, `users`, `listings`, `search`, `comparison`, `booking`, `chat`, `forum`, `reviews`, `notifications`, `payment`, `ai-chat`, `recommendations`, `health`.
   - Trừ khi là tính năng hoàn toàn mới chưa có trong danh sách trên, cấm tự ý tạo module mới.
4. **100% VALIDATION QUA DTO & CLASS-VALIDATOR**:
   - Cấm nhận body/params dạng `any` hoặc raw object.
   - Bắt buộc khai báo DTO class với decorator validation (`@IsString()`, `@IsNumber()`, `@IsUUID()`,...) và Swagger (`@ApiProperty()`).
5. **HẰNG SỐ IN HOA TOÀN BỘ (UPPER_SNAKE_CASE)**:
   - Ví dụ: `SYSTEM_CONSTANTS`, `HTTP_STATUS_CODES`, `USER_ROLES`, `LISTING_STATUS`.
6. **KHOẢNG CÁCH DÒNG GIỮA CÁC BLOCK (PADDED BLOCKS)**:
   - Luôn có 1 dòng trống phân cách giữa các nhóm biến, câu lệnh điều kiện (`if`, `switch`, `try-catch`), và trước `return` hoặc `throw`.
7. **CẤM COMMENT BỪA BÃI (NO TRIVIAL COMMENTS)**:
   - Không viết comment giải thích các dòng code hiển nhiên (`// inject service`, `// handle request`, `// return data`).
   - Code phải tự tường minh (Self-documenting code).
8. **TÁI SỬ DỤNG HẠ TẦNG NỀN TẢNG**:
   - Dùng `TransformInterceptor` tự động bọc response envelope:
     `{ "status": true, "data": ..., "error": null, "messages": "Thao tác thành công" }`.
   - Dùng `R2StorageService` để sinh presigned URL. Không lưu binary file trực tiếp vào server.
   - Bảng cần lưu vết phải dùng Soft-delete (`@DeleteDateColumn()`).
   - Truy vấn không gian PostGIS dùng `ST_DWithin` với SRID 4326 (WGS 84).

---

## 2. THAM CHIẾU TÀI LIỆU CHI TIẾT (DEEP-DIVE DOCS)

Khi cần thông tin chi tiết về từng mảng, AI hãy tự động đọc các file tương ứng:
- 📖 **Quy tắc & Chuẩn code chi tiết**: [`agent/rules.md`](./agent/rules.md)
- 🏢 **Nghiệp vụ chi tiết các Module & Vòng đời thực thể**: [`agent/business-logic.md`](./agent/business-logic.md)
- 🔄 **Quy trình làm việc 7 bước**: [`agent/ai-workflow.md`](./agent/ai-workflow.md)

---

## 3. LỆNH KIỂM TRA CHẤT LƯỢNG BẮT BUỘC (VERIFICATION)

Sau khi hoàn tất code, bắt buộc chạy các lệnh sau để đảm bảo **0 lỗi**:
```bash
npm run lint:fix    # Tự động dọn import thừa & format khoảng cách
npm run format      # Format Prettier
npm run build       # Biên dịch NestJS (TypeScript check)
npm run lint        # Kiểm tra ESLint
```

