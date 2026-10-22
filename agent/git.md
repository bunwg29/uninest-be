# Quy tắc Git, nhánh và commit — UniNest

> File này **giống hệt nhau** ở `uninest-be/agent/` và `uninest-app/agent/`.
> AI **không được tự commit hoặc push** khi chưa được người dùng cho phép rõ ràng trong lượt hội thoại đó.

---

## 1. Mô hình nhánh

```
main                      ← bản ổn định, chỉ nhận merge từ nhánh sprint sau buổi review
└── sprint-0N             ← nhánh tích hợp của sprint (Sprint 1–2 hiện dùng chung: sprint-01-02)
    └── feat/spN-<task>   ← nhánh của từng task, tên lấy đúng theo Sprint Plan
```

Tên nhánh task theo Sprint Plan, ví dụ:

| Task | Nhánh backend | Nhánh mobile |
| --- | --- | --- |
| Đánh giá | `feat/sp3-review-api` | `feat/sp3-review-ui` |
| Quản trị | `feat/sp3-admin-api` | `feat/sp3-admin-ui` |
| Thông báo | `feat/sp3-notification-pipeline` | `feat/sp3-notification-ui` |
| So sánh giá | `feat/sp3-price-aggregation` | `feat/sp3-price-chart-ui` |
| Thanh toán (đã bỏ khỏi Sprint 3) | `feat/sp3-payment-sandbox` | `feat/sp3-payment-ui` |
| Chatbot AI | `feat/sp4-ai-chatbot-backend` | `feat/sp4-ai-chatbot-ui` |
| Gợi ý | `feat/sp4-recommendation-backend` | `feat/sp4-recommendation-ui` |
| Premium | `feat/sp4-premium-backend` | `feat/sp4-premium-ui` |

Sửa lỗi nhỏ không thuộc task mới: nhánh `fix/spN-<mô-tả-ngắn>` tách từ nhánh sprint.

### Bắt đầu một task
```bash
git fetch origin
git checkout sprint-0N && git pull
git checkout -b feat/spN-<task>
```

### Kết thúc một task
1. Chạy đủ lệnh kiểm tra ở `AGENTS.md` mục "Kiểm tra trước khi commit" — 0 lỗi.
2. Commit theo mục 2.
3. `git pull --rebase origin sprint-0N` để cập nhật, chạy lại kiểm tra.
4. Push nhánh task, mở Pull Request vào `sprint-0N`, có ít nhất 1 người review.

---

## 2. Định dạng commit (bắt buộc)

```
<type>(<scope>): <mô tả ngắn> (<TASK-ID>)

- <chi tiết 1 nếu cần>
- <chi tiết 2 nếu cần>
```

- **Dòng đầu ≤ 72 ký tự**, viết **tiếng Anh**, chữ thường ở đầu, động từ nguyên thể (`add`, `fix`, `show`…), không có dấu chấm cuối.
- **TASK-ID luôn có**, đặt cuối dòng đầu trong ngoặc tròn.
- Thân commit (tuỳ chọn): gạch đầu dòng nói **làm gì và vì sao**, không kể lại từng file.

### `type`
| type | Khi nào |
| --- | --- |
| `feat` | Thêm chức năng mới cho người dùng |
| `fix` | Sửa lỗi |
| `refactor` | Đổi cấu trúc code, **không** đổi hành vi |
| `perf` | Tối ưu hiệu năng |
| `docs` | Tài liệu, README, thư mục `agent/` |
| `style` | Chỉ format, không đổi logic |
| `chore` | Cấu hình, script, phụ thuộc |
| `build` / `ci` | Docker, EAS, GitHub Actions |

### `scope` — tên module/feature viết thường
- App: `auth`, `listings`, `search`, `comparison`, `booking`, `chat`, `forum`, `support`, `reviews`, `notifications`, `payment`, `ai-chat`, `recommendations`, `ui`, `core`, `navigation`, `theme`, `hooks`, `app`.
- Backend: `auth`, `users`, `listings`, `search`, `booking`, `chat`, `forum`, `reviews`, `notifications`, `payment`, `ai-chat`, `recommendations`, `admin`, `storage`, `database`, `common`, `config`, `universities`, `locations`, `health`, `seed`.

### TASK-ID khi việc không thuộc task mới
| Phạm vi sửa | TASK-ID |
| --- | --- |
| Hạ tầng backend, database, migration, config | `TSK-SP1-01` |
| Xác thực (API / màn hình) | `TSK-SP1-02` / `TSK-SP1-03` |
| Khung app, điều hướng, `@core` | `TSK-SP1-04` |
| Component dùng chung `@ui`, `@theme`, `@hooks` | `TSK-SP1-05` |
| Hồ sơ, cài đặt, màn chung (`support`) | `TSK-SP1-06` |
| Lưu trữ R2 | `TSK-SP1-07` |
| Tin đăng (API / form) | `TSK-SP1-08` / `TSK-SP1-09` |
| Seed | `TSK-SP1-10` |
| Quản lý tin (API / màn) | `TSK-SP1-11` / `TSK-SP1-12` |
| Sprint 2 trở đi | Mã task tương ứng trong `business-logic.md` |
| Thư mục `agent/`, README | Mã task của phần tài liệu đang mô tả; tài liệu chung dùng `TSK-SP1-01` (backend) / `TSK-SP1-04` (app) |

### Ví dụ đúng
```
feat(booking): require a reason when landlords reject a request (TSK-S2-05)
fix(search): keep filters when returning from listing detail (TSK-S2-02)
refactor(ui): share BottomSheet across all sheets (TSK-SP1-05)
feat(reviews): add multi-criteria review form for viewed bookings (TSK-S3-02)
docs(agent): update business rules for sprint 3 notifications (TSK-S3-05)
```

### Ví dụ sai
```
update code                              ← không type, không scope, không TASK-ID
feat: add review                         ← thiếu scope, thiếu TASK-ID
fix(booking): Fixed bug.                 ← viết hoa, quá khứ, có dấu chấm, thiếu TASK-ID
feat(booking): thêm lý do từ chối (TSK-S2-05)  ← dòng đầu phải tiếng Anh
```

---

## 3. Mỗi commit một việc

- **Một commit = một thay đổi logic** build được và chạy được độc lập.
- Không gộp `refactor` với `feat` trong cùng commit. Refactor trước, commit riêng, rồi mới làm tính năng.
- Thay đổi nhiều feature không liên quan → tách nhiều commit.
- Backend và app là 2 repo → commit riêng ở mỗi repo, cùng TASK-ID.

---

## 4. Tuyệt đối không

- Không commit `.env`, khoá bí mật, token, file build (`dist/`, `.expo/`), `node_modules`, file tạm, ảnh chụp màn hình.
- Không thêm dòng ghi công AI vào commit hoặc PR (`Co-Authored-By: <AI>`, `Generated with ...`, `🤖`).
- Không commit thẳng vào `main` hoặc `sprint-0N` — luôn qua nhánh task + Pull Request.
- Không `git push --force` lên nhánh dùng chung. Không `--amend`/rebase commit đã push.
- Không `--no-verify` để bỏ qua hook.
- Không commit khi lint/typecheck còn lỗi.
- Không xoá hoặc đổi tên nhánh của người khác.

---

## 5. Pull Request

- Tiêu đề cùng định dạng commit.
- Mô tả gồm: **Làm gì** (gạch đầu dòng), **Màn hình/API liên quan**, **Cách kiểm tra**, ảnh chụp màn hình nếu đổi giao diện, kết quả lệnh kiểm tra.
- Checklist trước khi xin review:
  - [ ] Đúng nghiệp vụ trong `agent/business-logic.md`
  - [ ] Không tạo trùng thứ đã có trong `agent/reuse-catalog.md`
  - [ ] Lint, format, typecheck: 0 lỗi
  - [ ] Không còn `console.log`, comment, code chết, file thừa
