# Quy trình làm việc của AI — uninest-be

> Làm **đúng thứ tự** các bước. Không bỏ bước. Gặp điều kiện "DỪNG" thì hỏi người dùng, không tự đoán.

---

## Bước 1 — Hiểu yêu cầu và xác định nghiệp vụ

1. Xác định yêu cầu thuộc **mã FR / TASK-ID** nào (tra `business-logic.md`).
2. Đọc mục nghiệp vụ tương ứng: quy tắc bắt buộc, con số, trạng thái, API.
3. Tra mục **2. Ngoài phạm vi** và **3. Quyết định đã chốt**.

**DỪNG và hỏi khi:**
- Yêu cầu nằm ngoài phạm vi, mâu thuẫn với `business-logic.md`, hoặc không có trong file.
- Phải đổi API đang được app dùng (đường dẫn, tên trường, kiểu dữ liệu).
- Cần cài thư viện mới, dịch vụ ngoài mới, hoặc dùng Redis cho việc không phải Thông báo.
- Cần xoá dữ liệu, xoá cột, đổi kiểu cột có dữ liệu.

## Bước 2 — Khảo sát code hiện có (bắt buộc trước khi viết)

1. Đọc `reuse-catalog.md`.
2. `grep` entity, service, endpoint, hằng số liên quan. Đọc module tương tự đã làm (xem mục 5 của `reuse-catalog.md`).
3. Kiểm tra app (`../uninest-app/src/features/<feature>/services`) đang gọi API này thế nào nếu sửa API có sẵn.
4. Liệt kê: dùng lại gì, mở rộng gì, tạo mới gì (và vì sao).

## Bước 3 — Viết code

Thứ tự gợi ý: entity → migration → DTO → service (nghiệp vụ + kiểm tra quyền) → controller (guard, role, Swagger) → sự kiện/cron/socket nếu cần → test.

- Tuân thủ toàn bộ `rules.md` (R1–R12).
- Làm **đúng phạm vi được giao**. Thấy lỗi khác → ghi lại để báo, không tự sửa lan man.
- Thêm thứ dùng chung → cập nhật `reuse-catalog.md`.
- Thêm/đổi endpoint, trạng thái, con số đã được duyệt → cập nhật `business-logic.md` và **copy nguyên file sang `../uninest-app/agent/`**.
- Thêm biến môi trường → `env.schema.ts` + `.env.example`.

## Bước 4 — Tự kiểm tra

```bash
npm run lint:fix
npm run format
npm run typecheck
npm run lint
npm test
```
Đổi entity → thêm:
```bash
npm run migration:generate -- src/core/database/migrations/<TenMigration>
npm run migration:run
npm run migration:revert
npm run migration:run
```
Tất cả phải **0 lỗi**. Lỗi có sẵn từ trước, không liên quan → báo lại, không tự sửa.

Gọi thử endpoint (Swagger `/api/docs` hoặc curl): đúng envelope, đúng mã lỗi, DTO chặn dữ liệu sai, **sai vai trò bị từ chối**.

## Bước 5 — Rà lại trước khi báo cáo

- [ ] Đúng nghiệp vụ, đúng con số trong `business-logic.md`
- [ ] Mọi endpoint mới có guard + role (hoặc `@Public` có lý do), có kiểm tra sở hữu
- [ ] DTO đủ validation tiếng Việt + Swagger
- [ ] Đổi entity đã có migration chạy/revert được
- [ ] Không SQL ghép chuỗi, không N+1, danh sách có phân trang
- [ ] Không trả dữ liệu nhạy cảm
- [ ] Log tiếng Anh, message client tiếng Việt
- [ ] Không comment, không `any`, không `console.log`, không code chết
- [ ] Có test cho nghiệp vụ cốt lõi

## Bước 6 — Commit (chỉ khi người dùng cho phép)

Theo `git.md`: đúng nhánh task, định dạng `<type>(<scope>): <mô tả> (<TASK-ID>)`, mỗi commit một việc, không dòng ghi công AI. **Không push** khi chưa được yêu cầu.

## Bước 7 — Báo cáo cho người dùng (tiếng Việt)

1. Đã làm gì (theo nghiệp vụ), endpoint mới/đổi.
2. Dùng lại gì; tạo mới gì và vì sao.
3. Migration (nếu có) và kết quả lệnh kiểm tra.
4. Ảnh hưởng tới app (API đổi gì, app cần làm gì).
5. Điểm cần người dùng quyết hoặc lỗi phát hiện ngoài phạm vi.
