# UniNest Backend — Hướng dẫn cho AI

API NestJS cho ứng dụng UniNest (Sinh viên thuê trọ, Chủ trọ cho thuê, Quản trị viên). App di động ở repo `../uninest-app`, giao diện quản trị web ở repo `../uninest-web`.

**AI phải đọc file này trước khi làm bất cứ việc gì trong repo.** Sau đó đọc các file trong `agent/` theo bảng dưới.

| Khi nào | Đọc file |
| --- | --- |
| Mọi yêu cầu | [`agent/business-logic.md`](./agent/business-logic.md) — nghiệp vụ, con số, trạng thái, API của cả 5 sprint |
| Trước khi tạo module / service / guard / helper / hằng số | [`agent/reuse-catalog.md`](./agent/reuse-catalog.md) — những gì đã có sẵn |
| Khi viết code | [`agent/rules.md`](./agent/rules.md) — quy chuẩn code, ví dụ đúng/sai |
| Thứ tự làm việc, khi nào phải hỏi | [`agent/ai-workflow.md`](./agent/ai-workflow.md) |
| Nhánh, commit, Pull Request | [`agent/git.md`](./agent/git.md) |

---

## 12 luật không được vi phạm

1. **Đúng nghiệp vụ.** Làm theo `agent/business-logic.md`. Không tự đổi giới hạn, trạng thái, luồng. Không làm thứ ngoài phạm vi. Không chắc → **hỏi**.
2. **Dùng lại trước, tạo mới sau.** Tra `agent/reuse-catalog.md` và `grep` code trước khi tạo bất cứ thứ gì.
3. **Mọi input qua DTO** có class-validator (message tiếng Việt) + Swagger. Không `any`.
4. **Mọi endpoint không công khai có `JwtAuthGuard` + `RolesGuard` + `@Roles`**, và service tự kiểm tra quyền sở hữu.
5. **Controller chỉ `return data`**, lỗi chỉ `throw XxxException('tiếng Việt')` — envelope do hạ tầng lo.
6. **Message cho client tiếng Việt, log nội bộ tiếng Anh.** Không log dữ liệu nhạy cảm.
7. **Đổi entity phải có migration** chạy và revert được. Không SQL ghép chuỗi.
8. **Tác vụ định kỳ dùng `@Cron`. Redis/BullMQ chỉ cho Thông báo.**
9. **Không đổi API app đang dùng** khi chưa được đồng ý. Không cài thư viện mới khi chưa được đồng ý.
10. **Không comment trong code**, không `console.log`, không code chết, không `@ts-ignore`/`eslint-disable`.
11. **Kiểm tra 0 lỗi trước khi báo xong** (lệnh ở dưới).
12. **Không tự commit/push.** Khi được phép: đúng `agent/git.md`, định dạng `<type>(<scope>): <mô tả> (<TASK-ID>)`, không dòng ghi công AI.

---

## Kiểm tra trước khi commit

```bash
npm run lint:fix
npm run format
npm run typecheck
npm run lint
```

## Chạy dự án

```bash
npm install
cp .env.example .env        # điền DB, JWT, R2
npm run start:dev           # http://localhost:<PORT>/api/v1, Swagger ở /api/docs
npm run seed                # danh mục + 200 tin mẫu ba miền, chỉ ghi database (dev)
```

- Migration tự chạy khi khởi động. `DB_SYNCHRONIZE=true` còn đồng bộ entity sau migration (chỉ dev nhanh); chạy migration thủ công bằng `npm run migration:run`.
- Cần PostgreSQL 14+ có PostGIS, unaccent, pg_trgm (pgvector từ Sprint 4).

## Bản đồ thư mục nhanh

`src/common` (guard, decorator, filter, interceptor, pipe, DTO chung) · `src/core` (config, database + migrations + seeders, storage R2) · `src/modules/<module>` (constants, controllers, dtos, entities, services).
