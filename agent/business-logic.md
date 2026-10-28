# UniNest — Nghiệp vụ toàn hệ thống (Sprint 1 → 5)

> **Nguồn sự thật về nghiệp vụ cho AI và thành viên.** File này **giống hệt nhau** ở `uninest-be/agent/` và `uninest-app/agent/`. Sửa ở repo nào thì copy nguyên file sang repo còn lại trong cùng commit.
>
> Căn cứ: `documents/UniNest System Requirements.docx` (SRS) + `documents/UniNest Project Sprint Plan.docx`, cập nhật ngày 08/10/2026. Khi SRS khác file này ở mục **3. Quyết định đã chốt**, làm theo file này.

---

## 0. Cách dùng file này

- Tìm theo **mã FR** (FR-AUTH, FR-BOOKING…) hoặc **mã task** (TSK-S2-05…).
- Mỗi mục có: **Trạng thái**, **Màn hình**, **Quy tắc bắt buộc**, **API**, **Ghi chú mobile**.
- Con số (giới hạn, thời hạn) trong file này là **bắt buộc**. Không tự đổi, không tự "làm cho hợp lý hơn".
- Tính năng không có trong file này → **không tự làm**, hỏi lại người giao việc.
- Thấy code đang chạy khác file này → **báo lại**, không tự sửa nghiệp vụ.

---

## 1. Tổng quan

### 1.1. Sản phẩm và vai trò

UniNest là ứng dụng di động (Android 8+, iOS 14+) kết nối **Sinh viên** thuê trọ với **Chủ trọ** cho thuê, kèm giao diện **Quản trị viên**. Dữ liệu mẫu phủ Hà Nội, Đà Nẵng và TP.HCM; Đà Nẵng có nhiều tin nhất.

| Vai trò | Mã backend (`UserRoleType`) | Mã app (`USER_ROLES`) | Làm được gì |
| --- | --- | --- | --- |
| Sinh viên | `0` STUDENT | `'student'` | Tìm, lọc, xem chi tiết, lưu, so sánh, đặt lịch xem phòng, chat, forum, đánh giá, chatbot AI |
| Chủ trọ | `1` LANDLORD | `'landlord'` | Đăng tin, quản lý tin, xử lý lịch hẹn, chat, forum, phản hồi đánh giá, mua Premium |
| Quản trị viên | `2` ADMIN | `'admin'` | Duyệt tin, xử lý báo cáo, khoá/mở tài khoản, xem nhật ký quản trị. **Không đăng ký công khai**, được cấp sẵn |

### 1.2. Ràng buộc kỹ thuật toàn dự án (không được vi phạm)

- Giao diện, thông báo lỗi, validation: **100% tiếng Việt**. Không làm đa ngôn ngữ.
- Log nội bộ server: **tiếng Anh**. Mã lỗi máy đọc: tiếng Anh viết hoa (`BOOKING_ALREADY_EXISTS`).
- **Redis + BullMQ chỉ dùng cho pipeline Thông báo (Sprint 3).** Mọi tác vụ định kỳ khác dùng cron nội bộ `@nestjs/schedule` và lưu vào PostgreSQL.
- OTP lưu trong **PostgreSQL** dạng băm SHA-256, không dùng Redis.
- Ảnh/video tải **trực tiếp từ app lên Cloudflare R2** bằng presigned URL. Database chỉ lưu **object key**, backend ghép URL công khai khi trả về.
- Khoá R2, JWT secret, khoá dịch vụ ngoài: chỉ nằm trong biến môi trường backend, không hard-code, không gửi xuống app.
- **Không có giữ chỗ và đặt cọc trong app** (đã gỡ ở Sprint 3 theo quyết định của nhóm: thực tế không ai giữ phòng hay đặt cọc qua app). Sinh viên chỉ đặt lịch xem phòng; cọc và thuê do hai bên tự thoả thuận ngoài app.
- Thanh toán trong app **chỉ dùng cho gói Premium của Chủ trọ (Sprint 4)**. Không lưu số thẻ, CVV, tài khoản ngân hàng.

### 1.3. Lịch sprint

| Sprint | Thời gian | Nội dung | Trạng thái |
| --- | --- | --- | --- |
| 1 | 07/09 – 27/09/2026 | Hạ tầng, xác thực, hồ sơ, khung app, component chung, R2, đăng tin, seed, quản lý tin | **Đã xong** |
| 2 | 28/09 – 09/10/2026 | Tìm kiếm + bản đồ, chi tiết + so sánh, đặt lịch xem phòng (giữ chỗ đã gỡ ở Sprint 3), chat, forum | **Đã xong, đang review** |
| 3 | 12/10 – 23/10/2026 | Đánh giá, quản trị + audit log, thông báo, so sánh giá khu vực (thanh toán đặt cọc đã bỏ) | Đang triển khai |
| 4 | 26/10 – 06/11/2026 | Chatbot AI (RAG), gợi ý cá nhân hoá, Premium, tối ưu hiệu năng, tối ưu media | Chưa làm |
| 5 | 09/11 – 21/11/2026 | Docker + CI/CD, triển khai + backup, EAS build, E2E + quét bảo mật, rà soát RTM | Chưa làm |

Sprint sau chỉ phụ thuộc sprint trước. Trong một sprint, mỗi nhóm tính năng (cả backend lẫn mobile) do **một người** làm trọn.

---

## 2. Ngoài phạm vi — KHÔNG làm

- Hợp đồng thuê điện tử có giá trị pháp lý, chữ ký số.
- Thanh toán tiền thật ngoài sandbox.
- AI phát hiện gian lận, phát hiện tin trùng lặp.
- Kế toán, quản lý thu chi cho Chủ trọ.
- Đa ngôn ngữ / i18n, mục chọn ngôn ngữ trong Cài đặt.
- Màn **SH-06 Chuyển vai trò** và **A-12 Xin quyền thông báo**: tạm không làm (đã chốt 08/10/2026).

---

## 3. Quyết định đã chốt (khác hoặc chi tiết hơn SRS)

| Chủ đề | Đã chốt | SRS ghi |
| --- | --- | --- |
| Dung lượng ảnh | jpg/png, **tối đa 100MB/ảnh** | 5MB |
| Video tin đăng | Mỗi tin **tối đa 1 video** mp4/mov, tối đa 100MB, key `listings/videos/...` | Không có |
| Video bài forum | Mỗi bài **tối đa 1 video** mp4/mov, tối đa 100MB, key `forum/videos/...` (chốt 13/10/2026). Chat **không** hỗ trợ video | Không có |
| Danh sách so sánh | Tối đa 4 tin, **lưu trên máy** (AsyncStorage), không lưu server | Tạm thời trong phiên |
| Phòng xem gần đây | Lưu trên máy, tách theo từng tài khoản, tối đa 20 tin | Không có |
| Trường đại học | Sinh viên chọn **1 trường** khi đăng ký/hồ sơ. Chủ trọ chọn **tối đa 3 trường cho từng tin** (lúc đăng tin). Bộ lọc tìm kiếm chọn **tối đa 5 trường** | Không chi tiết |
| Loại phòng | 6 loại: `phong_tro`, `nha_nguyen_can`, `chung_cu_mini`, `ky_tuc_xa`, `studio`, `can_ho_dich_vu`. **Không có loại "ở ghép"** (ở ghép thuộc Forum) | Có "ở ghép" |
| Trạng thái tin | Thêm `rented` (Đã cho thuê) ngoài 5 trạng thái SRS | 5 trạng thái |
| Sắp xếp tìm kiếm | Thêm `relevance` (mặc định), `area_asc`, `area_desc` | 4 kiểu |
| Chi phí | Tiền điện/nước được phép = 0 (miễn phí). Tiền cọc có công tắc "bằng 1 tháng tiền phòng" | Không chi tiết |
| Nhập ngày | Chỉ chọn qua `DatePickerField` (lịch tự dựng), **không cho gõ tay** kiểu `11/10/2026`, không dùng date picker mặc định của hệ điều hành | Không chi tiết |
| Realtime booking | Trạng thái lịch hẹn và tình trạng phòng cập nhật qua socket (`booking.updated`, `listing.availability_changed`), không chỉ polling | Polling hoặc socket |
| Màn bảo trì | Mọi API trả 502/503/504 → hiện màn SH-09, nút "Thử lại" gọi `/health` | Có SH-09 |
| Schema DB | `DB_SYNCHRONIZE=true` cho dev nhanh; `false` → migration tự chạy khi khởi động. Production luôn dùng migration | Có migration |
| OTP môi trường dev | Nhà cung cấp giả lập, mã OTP in ra log dev; **không bao giờ log mã OTP ở production** | SMS/SMTP |

---

## 4. Nghiệp vụ theo nhóm chức năng

### 4.1. FR-AUTH — Đăng ký, đăng nhập, hồ sơ (Sprint 1 · Đã làm)

**Task:** TSK-SP1-02 (API), TSK-SP1-03 (màn xác thực), TSK-SP1-04 (khung app), TSK-SP1-06 (hồ sơ & cài đặt).
**Màn hình:** A-01 Splash, A-02 Onboarding, A-03 Chọn vai trò, A-04 Đăng nhập, A-05 Đăng ký, A-06/A-07 OTP, A-08/A-09 Quên/đặt lại mật khẩu, A-10 Hoàn thiện hồ sơ, A-11 Xin quyền vị trí, A-13/SH-07 Điều khoản & Quyền riêng tư, SH-01 Hồ sơ, SH-02 Sửa hồ sơ, SH-03 Cài đặt, SH-04 Đổi mật khẩu, SH-08 Trung tâm trợ giúp, SH-09 Bảo trì, SH-10 Đăng xuất.

**Quy tắc bắt buộc**
- Một email hoặc một số điện thoại chỉ thuộc **một tài khoản**. Đăng ký trùng → từ chối kèm thông báo rõ.
- Mật khẩu: **tối thiểu 8 ký tự, có cả chữ và số**, băm bcrypt. Kiểm tra cả ở app lẫn server.
- Chỉ đăng ký được khi đã tick đồng ý Điều khoản & Quyền riêng tư.
- OTP: 6 chữ số, hiệu lực **5 phút**, gửi lại sau **60 giây**, sai **quá 5 lần** → khoá xác thực 60 giây (HTTP 429 kèm số giây còn lại).
- Access token **1 giờ**. Refresh token tối đa **30 ngày không hoạt động**, xoay vòng mỗi lần làm mới, **bị thu hồi khi đăng xuất hoặc đổi mật khẩu**.
- App: lưu token bằng `expo-secure-store`. Gặp 401 → làm mới token **đúng 1 lần** (có hàng đợi, không gọi refresh trùng) rồi gửi lại request. Refresh hỏng → xoá phiên, về màn Đăng nhập.
- Đăng nhập xong điều hướng theo vai trò: Sinh viên → tab Sinh viên, Chủ trọ → tab Chủ trọ.
- Chủ trọ mới ở trạng thái **"Chờ xác minh"** (`landlord_verified_at` rỗng) → **không được tạo tin** (`LANDLORD_NOT_VERIFIED`) cho tới khi gửi xác minh: số CCCD/CMND 9 hoặc 12 chữ số, địa chỉ liên hệ tuỳ chọn.
- Xác minh Chủ trọ là **tự động**: gửi số CCCD/CMND hợp lệ → `landlord_verified_at` được ghi ngay, đăng tin được luôn. **Không có** luồng nộp ảnh giấy tờ hay Admin duyệt/từ chối/yêu cầu bổ sung hồ sơ (đã chốt; các màn L-21→L-23 và ADW-12 đã gỡ khỏi Figma).
- Đổi mật khẩu: phải nhập đúng mật khẩu hiện tại, mật khẩu mới khác mật khẩu cũ.
- Đổi email/số điện thoại: xác thực OTP gửi tới **giá trị mới**, không trùng tài khoản khác.
- Chỉ chính chủ xem/sửa hồ sơ của mình. Admin không sửa hồ sơ thay người dùng.
- Đăng xuất phải có hộp thoại xác nhận, xoá token trên máy, reset toàn bộ store (`resetAllStores`).
- Tài khoản bị khoá không đăng nhập được.

**API (prefix `/api/v1`)**
- `POST /auth/register`, `/auth/login`, `/auth/otp/send`, `/auth/otp/verify`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`, `GET /auth/me`, `PATCH /auth/change-password`.
- Hồ sơ: `GET|PATCH /profile`, `POST /profile/change-password`, `POST /profile/landlord-verification`, `POST /profile/avatar/presign` + `/avatar/confirm`, `POST /profile/phone/request-otp|verify-otp`, `POST /profile/email/request-otp|verify-otp`.
- `GET /profile` trả `verificationStatus` (`pending_verification` | `verified`) và số liệu thật (`savedRooms`, `appointments`).
- Danh mục: `GET /universities?keyword=&limit=`, `GET /locations/provinces`, `GET /locations/provinces/:code/wards`.
- Đăng nhập gửi kèm `deviceId`, `deviceName` để lưu phiên theo thiết bị.

**Màn chung đã có:** Điều khoản (2 tab Quyền riêng tư/Điều khoản), Trung tâm trợ giúp (FAQ, tìm không dấu, báo lừa đảo qua email), Bảo trì (xem 3. Quyết định đã chốt).

### 4.2. FR-LISTING — Đăng tin cho thuê (Sprint 1 · Đã làm)

**Task:** TSK-SP1-07 (R2), TSK-SP1-08 (API tạo tin), TSK-SP1-09 (form đăng tin).
**Màn hình:** Form nhiều bước của Chủ trọ: Thông tin cơ bản → Ảnh/Video → Vị trí → Tiện ích → Lịch xem phòng → Xem lại → Thành công.

**Quy tắc bắt buộc**
- Chỉ Chủ trọ **đã xác minh** mới tạo tin. Chưa xác minh → app hiện hướng dẫn xác minh thay cho form.
- Bắt buộc: tiêu đề (≤150 ký tự), mô tả (≤3000), loại phòng (6 loại ở mục 3), giá thuê > 0, diện tích > 0, số người ở tối đa 1–20, địa chỉ, toạ độ.
- Ảnh: **1–10 ảnh**, jpg/png, ≤100MB/ảnh, đúng **1 ảnh bìa**. Video: tối đa 1, mp4/mov, ≤100MB.
- Tiền điện, tiền nước, tiền cọc ≥ 0.
- Chọn tối đa **3 trường đại học** gần phòng.
- Vị trí: chọn điểm trên bản đồ hoặc nhập địa chỉ (tỉnh/thành → phường/xã → số nhà, tên đường). Lưu `geography Point SRID 4326` + địa chỉ, mã tỉnh, mã phường.
- Lịch xem phòng: chọn **buổi sáng / chiều / tối** cho từng ngày trong tuần. Lịch được giữ khi mở lại để sửa.
- Tin mới luôn ở trạng thái **`pending` (Chờ kiểm duyệt)**, chưa hiện trong tìm kiếm.
- App **lưu nháp cục bộ** toàn bộ form (kể cả ảnh/video đã chọn); thoát app hoặc mất mạng mở lại vẫn còn.
- Mỗi ảnh có tiến độ tải lên riêng, tải **song song**, ảnh lỗi thử lại riêng lẻ. Ảnh sai định dạng/quá dung lượng bị chặn ngay trên app.
- Kiểm tra hợp lệ ở **cả app (zod) lẫn server (class-validator)**, cùng con số.

**Lưu trữ R2**
- `POST /storage/presign-upload` (ảnh) và `POST /storage/presign-video-upload` (video): yêu cầu đăng nhập, presigned URL hiệu lực **5 phút**, nhận mục đích (`listings`, `avatars`, `chat`, `forum`…), loại tệp, dung lượng; trả `uploadUrl`, `objectKey`, URL công khai. Video chỉ nhận `folder` là `listings` (mặc định) hoặc `forum`.
- Backend kiểm tra lại định dạng và dung lượng sau khi tải lên. Object key đặt theo mục đích + UUID.
- Sửa tin xong → backend xoá khỏi R2 các ảnh bị bỏ. Tin xoá mềm thì giữ ảnh.

**API:** `POST /listings`, `GET /listings/amenities` (công khai).

### 4.3. FR-MANAGE — Quản lý tin đăng (Sprint 1–2 · Đã làm)

**Task:** TSK-SP1-11 (API), TSK-SP1-12 (màn Tin đăng của tôi).

**Trạng thái tin (`ListingStatus`)**

| Mã | Tên hiển thị | Ai chuyển | Ghi chú |
| --- | --- | --- | --- |
| `pending` | Chờ kiểm duyệt | Hệ thống khi tạo / khi sửa giá hoặc diện tích | Không hiện trong tìm kiếm |
| `active` | Đang hiển thị | Admin duyệt | Chỉ trạng thái này hiện với Sinh viên |
| `rejected` | Bị từ chối | Admin | Hiện lý do, Chủ trọ sửa rồi gửi lại |
| `hidden` | Đã ẩn | Chủ trọ (công tắc) / hệ thống khi Chủ trọ bị khoá | Chỉ tin đã duyệt mới ẩn/hiện được |
| `paused` | Ngừng nhận yêu cầu | Hệ thống khi Chủ trọ xoá tin đang có lịch hẹn | Thay cho xoá |
| `rented` | Đã cho thuê | Chủ trọ | Bật/tắt qua `rental-status` |

**Quy tắc bắt buộc**
- Chủ trọ chỉ xem/sửa/ẩn/xoá tin **của chính mình** (kiểm tra ở service, trả 403/404).
- Sửa **giá hoặc diện tích** của tin đã duyệt → về `pending`. Sửa trường khác giữ nguyên trạng thái.
- Xoá = **xoá mềm** (`deleted_at`), giữ tối thiểu **90 ngày**.
- Tin đang có lịch hẹn còn hiệu lực (chờ xác nhận, hoặc đã xác nhận mà chưa qua giờ xem) **không được xoá** → chuyển `paused`.
- Thống kê lượt xem / liên hệ / lưu **chỉ chủ tin và Admin thấy**, không công khai.
- Chủ trọ bị khoá → toàn bộ tin `active` chuyển `hidden` (làm ở Sprint 3 cùng FR-ADMIN).
- App: tab theo trạng thái, xoá phải qua hộp thoại xác nhận, có trạng thái rỗng, kéo để làm mới; nút sửa mở lại form đăng tin ở chế độ sửa. Chủ trọ có thể "Xem như sinh viên" (màn xem trước, ẩn nút hành động của sinh viên).

**API:** `GET /landlord/listings`, `GET /landlord/listings/stats?period=7d|30d|90d|all`, `GET|PUT|DELETE /landlord/listings/:id`, `PATCH /landlord/listings/:id/visibility`, `PATCH /landlord/listings/:id/rental-status`, `GET /listings/mine`.

### 4.4. FR-SEARCH — Tìm kiếm và lọc (Sprint 2 · Đã làm)

**Task:** TSK-S2-01 (API), TSK-S2-02 (màn tìm kiếm, bộ lọc, bản đồ).
**Màn hình:** H-01→H-03 Trang chủ, S-01 Ô tìm kiếm + lịch sử, S-02 Danh sách, S-03 Lưới 2 cột, S-04 Bản đồ + carousel, S-05 Bản đồ gom cụm + bottom sheet, S-06 Bộ lọc, S-07 Chọn trường, S-08 Sắp xếp, S-09 Rỗng, S-10 Skeleton, S-11 Lỗi + thử lại.

**Quy tắc bắt buộc**
- Chỉ trả tin **`active`**, không xoá mềm.
- Nhiều bộ lọc kết hợp bằng **AND**.
- Bộ lọc: từ khoá (khu vực, tên đường; tìm không dấu), khoảng giá, khoảng diện tích, loại phòng, tiện ích, trường (≤5), bán kính quanh trường/vị trí hiện tại (mặc định 5km, tối đa 50km).
- Khoảng cách dùng PostGIS `ST_DWithin` / `ST_Distance` trên `geography` 4326, có index GIST.
- Sắp xếp: `relevance` (mặc định: khớp tiêu đề → khoảng cách → mới nhất), `newest`, `price_asc`, `price_desc`, `area_asc`, `area_desc`, `nearest`.
- Không có kết quả → `hasResults=false` + `suggestion` (mở rộng bán kính, nới bộ lọc), **không trả lỗi**.
- Phân trang mặc định 10, tối đa 50; app cuộn vô hạn.
- Mỗi tin trả `availability` (`available` | `rented` | `paused`).
- App: bộ lọc **giữ nguyên khi quay lại từ trang chi tiết**; debounce ô tìm kiếm 400ms; lịch sử tìm kiếm lưu trên máy (8 mục); bản đồ chạm marker mở bottom sheet tóm tắt; nút "gần trường nhất"/vị trí hiện tại phải xin quyền vị trí trước.
- **Sprint 4 (FR-PREMIUM):** tin Premium được đẩy lên **chỉ trong tập đã khớp bộ lọc**.
- **Sprint 3 (FR-NOTIFY):** cho phép lưu bộ lọc để nhận thông báo tin mới phù hợp.

**API:** `GET /listings/search` (công khai). `SearchModule` phải đăng ký **trước** `ListingsModule` để `/listings/search` không bị `/listings/:id` chặn.

**Hiệu năng:** P95 ≤ 1,5 giây với ≥ 5.000 tin (NFR-PERF-01).

### 4.5. FR-COMPARE — Chi tiết, lưu, so sánh (Sprint 2 · Đã làm)

**Task:** TSK-S2-03 (API), TSK-S2-04 (màn chi tiết + so sánh).
**Màn hình:** D-01 Chi tiết, D-02 Gallery, D-03 Bản đồ mở rộng, D-04 Tiện ích, D-05 Đánh giá, D-06 Hồ sơ Chủ trọ, D-08 Skeleton, D-09 Báo cáo tin, C-01→C-05 So sánh, S-12 Phòng đã lưu.

**Quy tắc bắt buộc**
- Người dùng thường chỉ xem tin `active`; chủ tin và Admin xem mọi trạng thái.
- Lượt xem chỉ cộng **1 lần / người / tin / 30 phút**.
- Lưu phòng (favorite): quan hệ user–listing, **không giới hạn**, bật/tắt idempotent. Là dữ liệu đầu vào cho gợi ý Sprint 4.
- So sánh: **tối đa 4 tin**, thêm tin thứ 5 → chặn và báo đã đạt giới hạn (C-05). Tiêu chí: giá, diện tích, số người, khoảng cách tới trường đã chọn, tiện ích, điểm đánh giá.
- Báo cáo tin: mỗi người **1 lần / tin**, không tự báo cáo tin của mình.
- `viewCount` chỉ trả cho chủ tin/Admin.
- Trang chi tiết: thanh hành động Nhắn tin / Đặt lịch xem, lưu, chia sẻ, báo cáo, xem toàn bộ tiện ích, ảnh toàn màn hình.

**API:** `GET /listings/:id`, `PATCH /listings/:id/view`, `POST|DELETE /listings/:id/favorite`, `GET /listings/favorites`, `GET /listings/favorites/ids`, `GET /listings/batch?ids=`, `POST /listings/:id/reports`, `GET /landlords/:id` (hồ sơ công khai Chủ trọ).

**Hiệu năng:** trang chi tiết tải ≤ 2 giây trên 4G (NFR-PERF-02).

### 4.6. FR-BOOKING — Đặt lịch xem phòng (Sprint 2 · Đã làm; giữ chỗ đã gỡ ở Sprint 3)

**Task:** TSK-S2-05 (API + cron), TSK-S2-06 (luồng mobile).
**Màn hình:** B-01 Chọn ngày, B-02 Chọn giờ, B-03 Xác nhận + ghi chú, B-04 Gửi thành công, B-05 Lịch hẹn của tôi (4 tab), B-06 Chi tiết lịch hẹn, B-07 Hết hạn. Chủ trọ: tab Lịch hẹn.

**Trạng thái (`BookingStatus`) và chuyển trạng thái hợp lệ**

```
pending   → confirmed | rejected | expired | cancelled
confirmed → cancelled
confirmed, expired, cancelled, rejected → (kết thúc khi đã qua giờ xem)
```

**Quy tắc bắt buộc**
- Chỉ Sinh viên tạo yêu cầu. Mỗi sinh viên chỉ có **1 lịch còn hiệu lực cho 1 phòng** (đang chờ, hoặc đã xác nhận mà chưa qua giờ xem); khung giờ của một sinh viên không được chồng nhau.
- Khung giờ: `08:00, 09:00, 10:00` (sáng), `13:00, 14:00, 15:00, 16:00` (chiều), `18:00, 19:00, 20:00` (tối), mỗi slot 60 phút, múi giờ `Asia/Ho_Chi_Minh`. Chỉ nhận slot thuộc buổi Chủ trọ đã mở trong lịch xem phòng.
- Chủ trọ **không phản hồi trong 24 giờ** → `expired`. Yêu cầu quá giờ hẹn mà chưa xác nhận cũng `expired`.
- Chủ trọ: Xác nhận, **Từ chối (bắt buộc lý do)**.
- Sinh viên huỷ khi còn **dưới 24 giờ** trước giờ xem → **bắt buộc lý do**.
- Lịch `confirmed` đã qua giờ xem được coi là **đã xem phòng**: giữ nguyên `confirmed`, không tự hết hạn, không còn tính là lịch còn hiệu lực (sinh viên đặt lại được phòng đó). Đây là bằng chứng cho Đánh giá.
- **Không có giữ chỗ / đặt cọc** (đã gỡ ở Sprint 3): bỏ `holding`, `PATCH /bookings/:id/hold`, `PATCH /bookings/:id/release`, `HOLDING_DAYS`, `deposit_amount` trên booking. Migration `1700000000011-RemoveBookingHold` chuyển lịch `holding` cũ về `confirmed`, xoá index một-người-giữ-chỗ và cột `deposit_amount`.
- Mọi lần đổi trạng thái ghi vào `booking_events` (ai, lúc nào, lý do) — làm bằng chứng cho Đánh giá Sprint 3.
- Cron nội bộ `@nestjs/schedule` chạy **mỗi 5 phút**, cập nhật có điều kiện. **Không dùng Redis/BullMQ.**
- Phát sự kiện `booking.created`, `booking.status_changed` (cho Thông báo Sprint 3) và đẩy socket `booking.updated`, `listing.availability_changed` để app cập nhật ngay.
- App: thẻ lịch hẹn có đếm ngược, nút Nhắn tin / Huỷ; trạng thái phòng (còn trống / đã cho thuê / ngừng nhận) đồng bộ trên mọi màn đang mở trong ≤ 5 giây.

**API:** `GET /bookings/slots` (công khai), `POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `DELETE /bookings/:id` (sinh viên huỷ), `GET /bookings/landlord`, `PATCH /bookings/:id/confirm|reject`.

### 4.7. FR-CHAT — Chat trực tiếp (Sprint 2 · Đã làm)

**Task:** TSK-S2-07 (gateway + API), TSK-S2-08 (giao diện).
**Màn hình:** M-01 Danh sách hội thoại, M-02 Rỗng, M-03 Khung chat (ghim tin đăng), M-04 Xem trước ảnh, M-05 Mất mạng/hàng đợi, M-06 Thu hồi.

**Quy tắc bắt buộc**
- Hội thoại gắn **1 tin đăng + 1 sinh viên** (duy nhất theo cặp). Sinh viên mở từ trang chi tiết. Chủ trọ chỉ mở được với sinh viên **đã đặt lịch xem phòng đó**.
- Chỉ 2 người tham gia xem được hội thoại.
- Tin nhắn **không được sửa**. Người gửi chỉ **thu hồi** (ẩn) tin của mình; ảnh trên R2 vẫn giữ.
- Nội dung ≤ 2000 ký tự, tối đa **10 ảnh/tin** (jpg/png, thư mục `chat/`). Chưa hỗ trợ video trong chat.
- Lưu tối thiểu **12 tháng** (xoá mềm).
- Xoá đoạn chat là **xoá phía mình** (`student_deleted_at` / `landlord_deleted_at`); người kia giữ nguyên. Có tin mới thì đoạn chat hiện lại, chỉ chứa tin từ lúc đó.
- Danh sách hội thoại 20 mục/trang, lọc Tất cả/Chưa đọc, tìm kiếm phía server (`keyword`, debounce 400ms). Mở đoạn chat tải 30 tin, kéo lên tải tiếp (cursor).
- Mất mạng: nháp và tin chờ gửi lưu trên máy (`chatStore`), tự gửi lại khi có mạng, chống trùng bằng `clientMessageId`. Tin lỗi có nút "Thử lại". Hiển thị optimistic.
- Nhiều ảnh hiển thị dạng lưới, từ ảnh thứ 6 gộp ô "+N".
- Mỗi tin mới phát sự kiện nội bộ `message.created` cho Thông báo Sprint 3.

**Realtime:** Socket.IO namespace `/chat`, xác thực JWT ở handshake (`auth.token`), phòng `user:<id>`. Client gửi `message.send`, `conversation.read` (ack theo envelope). Server phát `message.new`, `message.recalled`, `conversation.read`, `conversation.deleted`, `booking.updated`, `listing.availability_changed`.

**API:** `POST /conversations`, `GET /conversations`, `GET /conversations/summary`, `GET /conversations/:id`, `DELETE /conversations/:id`, `GET|POST /conversations/:id/messages`, `DELETE /conversations/:id/messages/:messageId`, `PATCH /conversations/:id/read`.

**Hiệu năng:** độ trễ ≤ 1 giây giữa 2 người online (NFR-PERF-04).

### 4.8. FR-FORUM — Cộng đồng (Sprint 2 · Đã làm)

**Task:** TSK-S2-09 (API + lọc từ cấm), TSK-S2-10 (giao diện).
**Màn hình:** F-01 Bảng tin, F-02 Theo chuyên mục, F-03 Chi tiết + bình luận, F-04 Đăng bài, F-05 Cảnh báo từ cấm, F-06 Báo cáo, F-07.1 Rỗng, F-07.2 Skeleton.

**Quy tắc bắt buộc**
- 4 chuyên mục: `roommate` Tìm bạn ở ghép, `experience` Kinh nghiệm thuê trọ, `question` Hỏi đáp, `area_review` Review khu vực.
- Bài `roommate` bắt buộc tiêu chí: giới tính (Nữ/Nam/Không quan trọng), chi phí/người, ngày dọn vào, tiêu chí sinh hoạt, khu vực (nhập như địa chỉ); trạng thái `open` Còn chỗ / `full` Đã đủ.
- Tiêu đề ≤ 150, nội dung ≤ 5000, bình luận ≤ 1000 ký tự, tối đa **10 ảnh/bài** (thư mục `forum/`), tối đa **1 video/bài** (mp4/mov, ≤100MB, thư mục `forum/videos/`).
- Bài viết gửi `videoKey` khi tạo/sửa (gửi `null` để gỡ), trả về `videoKey` + `videoUrl`. Một video chỉ gắn với một bài; đổi hoặc gỡ video thì backend xoá tệp cũ khỏi R2.
- Vòng đời bài: `draft` (không kiểm duyệt) → `published` → `hidden` (chờ Admin) → Admin `restore` hoặc `remove` (xoá mềm). Bình luận `published`/`hidden`, **trả lời tối đa 1 cấp**.
- Chỉ tác giả hoặc Admin sửa/xoá. Không sửa nội dung đang bị ẩn.
- Lọc nội dung trước khi lưu (tiêu đề, nội dung, các trường ở ghép): từ khoá cấm trong bảng `forum_banned_keywords` (Admin quản lý). `block` → chặn (422). `warn` (vd số điện thoại) → chặn tới khi client gửi `acknowledgeWarnings: true`. **Số tài khoản ngân hàng luôn bị chặn.**
- App gọi `POST /forum/moderation/check` trước khi đăng, hiện popup: quay lại sửa / tự xoá phần vi phạm / vẫn đăng (chỉ khi là cảnh báo).
- Báo cáo: mỗi người **1 lần / nội dung**, không tự báo cáo. Đạt **5 báo cáo** chưa xử lý (`FORUM_REPORT_HIDE_THRESHOLD`) → tự chuyển `hidden`. App gửi `entityType` (`forum_post` | `forum_comment`) + `entityId`.
- Lượt xem bài cộng 1 lần / người / 30 phút.
- Bảng tin 10 bài/trang, bình luận 10/trang, trả lời 5/trang (xem trước 2), cuộn vô hạn, mỗi trang ≤ 1 giây.
- **Sprint 3:** bảng báo cáo forum được nâng cấp thành Report Engine dùng chung (xem FR-ADMIN).

**API:** `GET /forum/metadata`, `POST /forum/moderation/check`, `GET|POST /forum/posts`, `GET /forum/posts/me`, `GET|PATCH|DELETE /forum/posts/:id`, `POST|DELETE /forum/posts/:id/like`, `POST /forum/posts/:id/reports`, `GET|POST /forum/posts/:id/comments`, `GET /forum/comments/:id/replies`, `PATCH|DELETE /forum/comments/:id`, `POST /forum/comments/:id/reports`. Admin: `/admin/forum/*`.

### 4.9. FR-REVIEW — Đánh giá & xếp hạng (Sprint 3 · Chưa làm)

**Task:** TSK-S3-01 (API, P1), TSK-S3-02 (giao diện, P1). **Màn hình:** B-15 Form đánh giá, D-05 Danh sách đánh giá, D-06 Hồ sơ Chủ trọ.

**Quy tắc bắt buộc**
- Chỉ Sinh viên có **lịch xem phòng đã xác nhận và đã qua giờ xem với đúng tin đó** mới được đánh giá. App ẩn nút đánh giá nếu không đủ điều kiện; server vẫn phải chặn.
- Mỗi sinh viên đánh giá **1 tin 1 lần**, được sửa trong **7 ngày** sau khi gửi.
- 4 tiêu chí 1–5 sao: **vị trí, giá trị so với giá tiền, thái độ Chủ trọ, tiện ích** + nhận xét.
- Điểm trung bình tính lại **ngay** khi có đánh giá mới hoặc bị gỡ, hiển thị trong ≤ 5 giây trên tin và hồ sơ Chủ trọ.
- Chủ trọ phản hồi công khai **1 lần** dưới đánh giá về tin của mình; có thể báo cáo đánh giá sai sự thật lên Admin.
- Lời mời đánh giá gửi sau một thời gian kể từ giờ xem phòng đã xác nhận hoặc khi sinh viên tự xác nhận đã ở.
- D-05 lọc theo số sao, phân trang.

**Gợi ý kỹ thuật:** bảng `reviews` (booking_id FK, điểm từng tiêu chí, comment, edited_until), service tính lại `avg_rating` trên listing; dùng module `reviews` đã có khung.

### 4.10. FR-ADMIN — Kiểm duyệt & quản trị (Sprint 3 · Đã triển khai trên nhánh task, chờ review)

**Task:** TSK-S3-03 (API, P0), TSK-S3-04 (giao diện quản trị, P0 — khuyến nghị web-admin riêng).

**Quy tắc bắt buộc**
- Chỉ role Admin truy cập; truy cập trái phép bị từ chối **và ghi log cảnh báo**. Không có lối vào công khai trong app thường.
- Duyệt tin `pending` → `active` hoặc `rejected` **kèm lý do**, thông báo cho Chủ trọ. Xử lý 1 tin trong ≤ 3 thao tác.
- **Report Engine dùng chung**: bảng `reports` (`entity_type`: `listing` | `forum_post` | `forum_comment` | `user`, `entity_id`, `reason`, `status`) — nâng cấp từ `forum_reports` và `listing_reports`. Bài forum bị tự ẩn cũng phải xuất hiện ở danh sách này.
- Xử lý báo cáo: gỡ nội dung, cảnh báo hoặc khoá tài khoản.
- Khoá Chủ trọ → mọi tin `active` của họ chuyển `hidden`. Chỉ Admin được khoá tài khoản người khác.
- **Mọi** hành động duyệt/từ chối/khoá/gỡ ghi `audit_logs`: người làm, thời điểm, hành động, đối tượng, lý do. Tra cứu lại được.
- Dữ liệu nhạy cảm (mật khẩu, token) không bao giờ trả về, kể cả API admin.
- **Không có** quy định thời hạn/SLA duyệt tin: hàng đợi chỉ hiện thời gian chờ, không đánh dấu "quá hạn". Tin **có cảnh báo** = chủ trọ chưa xác minh hoặc đang có báo cáo chờ xử lý.
- Admin ẩn được tin `active` → `hidden` kèm lý do (ghi `listing.hide`), hoặc gỡ tin qua xử lý báo cáo. Tin bị **quản trị viên ẩn** được gắn `moderation_hidden_at` + `moderation_reason`: Chủ trọ **không tự hiện lại** được (`PATCH /landlord/listings/:id/visibility` trả 400); Chủ trọ sửa tin → tin về `pending` để duyệt lại; Admin duyệt hoặc `PATCH /admin/listings/:id/restore` (ghi `listing.restore`) mới gỡ cờ. Chủ trọ nhận thông báo khi tin bị ẩn và khi được hiện lại. Tin bị ẩn do **khoá tài khoản** không gắn cờ này.
- Không duyệt được tin của Chủ trọ đang bị khoá. Duyệt hàng loạt = gọi duyệt từng tin.
- Danh sách người dùng/báo cáo trả kèm `counts` cho từng tab; nhật ký lọc được theo hành động, người thực hiện, khoảng thời gian, từ khoá.
- Chưa có dữ liệu thật (tác vụ định kỳ, Premium, IP): web-admin hiển thị dữ liệu mẫu, tích hợp sau. Không còn mục giao dịch vì đã bỏ đặt cọc.

**API:** `GET /admin/overview`, `GET /admin/listings` (lọc `status`, `flag=warning`, `provinceCode`, `sort=newest|oldest`, `keyword`; trả kèm `counts`), `GET /admin/listings/provinces`, `GET /admin/listings/:id`, `PATCH /admin/listings/:id/approve`, `PATCH /admin/listings/:id/reject`, `PATCH /admin/listings/:id/hide`, `PATCH /admin/listings/:id/restore`, `GET /admin/reports`, `GET /admin/reports/:id`, `PATCH /admin/reports/:id/resolve`, `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/lock`, `PATCH /admin/users/:id/unlock`, `GET /admin/audit-logs`, `POST /users/:id/reports`.

**API:** `GET /admin/overview`, `GET /admin/listings`, `GET /admin/listings/:id`, `PATCH /admin/listings/:id/approve`, `PATCH /admin/listings/:id/reject`, `GET /admin/reports`, `GET /admin/reports/:id`, `PATCH /admin/reports/:id/resolve`, `GET /admin/users`, `GET /admin/users/:id`, `PATCH /admin/users/:id/lock`, `PATCH /admin/users/:id/unlock`, `GET /admin/audit-logs`, `POST /users/:id/reports`.

### 4.11. FR-NOTIFY — Thông báo (Sprint 3 · Đã triển khai trên nhánh task, chờ review)

**Task:** TSK-S3-05 (pipeline, P0), TSK-S3-06 (trung tâm thông báo + cài đặt, P0). **Màn hình:** N-01 Danh sách (4 tab), N-02 Rỗng, N-03 Cài đặt thông báo.

**Quy tắc bắt buộc**
- **Nơi duy nhất dùng Redis + BullMQ**: queue `notifications`. Listener `@OnEvent` nhận sự kiện có sẵn (`message.created`, `booking.created`, `booking.status_changed`, `listing.activated`…) → lưu bản ghi `notifications` và enqueue gửi push qua Expo Push Service đến FCM/APNs. Khi Redis không hoạt động, bản ghi vẫn được lưu và gửi trực tiếp theo cơ chế dự phòng.
- Module khác chỉ cần **phát thêm sự kiện**, không sửa kiến trúc Thông báo.
- Loại thông báo bật/tắt riêng: **tin mới, tin nhắn, nhắc lịch, hệ thống**. Thông báo **đặt lịch không tắt hoàn toàn được** (không còn loại giao dịch vì đã bỏ đặt cọc; enum `payment` được gỡ bằng migration `1700000000015-RemovePaymentNotifications`).
- Thiết bị offline → vẫn lưu, hiện lại trong danh sách.
- Push đến thiết bị ≤ **10 giây**. Danh sách đúng thứ tự thời gian, đúng đã đọc/chưa đọc; nhấn vào mở đúng màn liên quan.
- **Bộ lọc đã lưu** (`saved_searches`: user_id, tiêu chí, bật/tắt): lưu từ màn bộ lọc S-06; khi tin chuyển `active` (`listing.activated`) đối chiếu và tạo thông báo tin mới phù hợp.
- App đăng ký push token khi mở app lần đầu và khi được cấp quyền; badge số chưa đọc.
- Nhắc lịch hẹn cho cả hai bên trước giờ xem.
- **Kết quả duyệt tin** (duyệt / từ chối / bị quản trị viên ẩn) và **cảnh báo từ quản trị viên** luôn được gửi, không bị chặn bởi công tắc "Hệ thống".
- App: Sinh viên có 4 tab Tất cả / Lịch hẹn (`booking` + `reminder`) / Tin mới / Cộng đồng; Chủ trọ có chip Tất cả / Chưa đọc (`unread=true`) / Lịch hẹn / Hệ thống. Cài đặt hiện rõ mục "luôn bật" (đặt lịch, kết quả duyệt tin và cảnh báo).

**API:** `GET /notifications` (lọc `type`, `unread`), `GET /notifications/unread-count`, `GET|PATCH /notifications/preferences`, `PATCH /notifications/:id/read`, `PATCH /notifications/:id/unread`, `PATCH /notifications/read-all`, `POST|DELETE /notifications/devices`; `GET|POST /saved-searches`, `PATCH|DELETE /saved-searches/:id`.

### 4.12. FR-PRICECOMPARE — So sánh giá theo khu vực (Sprint 3 · TSK-S3-07 đã triển khai trên nhánh task, chờ review; TSK-S3-08 chưa làm)

**Task:** TSK-S3-07 (job tổng hợp, P2), TSK-S3-08 (biểu đồ, P2). **Màn hình:** S-13.

**Quy tắc bắt buộc**
- Cron nội bộ chạy **tối thiểu mỗi ngày 1 lần**, tính giá trung bình + khoảng giá phổ biến theo **tỉnh/phường và loại phòng**, **chỉ từ tin `active`** (đã chốt: hệ thống không có trạng thái "hết hạn" cho tin đăng nên bỏ phần "tin đã hết hạn gần đây" trong SRS). Lưu bảng `price_aggregates` (area, room_type, avg_price, sample_count, computed_at). **Không dùng Redis.**
- Khu vực **< 5 tin hợp lệ** → trả cảnh báo "Dữ liệu chưa đủ để tham chiếu", không trả con số.
- Đơn vị **VNĐ/tháng**, có chú thích số tin dùng để tính và thời điểm cập nhật; đánh dấu các tin sinh viên đang quan tâm trên biểu đồ.
- `GET /price-comparison` (lọc `areaLevel=province|ward`, `provinceCode`, `wardCode`, `roomType`) đọc thẳng bảng tổng hợp, tải ≤ 2 giây. Mỗi dòng có `avgPrice`, `popularPriceMin/Max` (tứ phân vị 25–75%), `sampleCount`, `unit`, `computedAt`, `warning`.
- Cron `0 2 * * *` giờ Việt Nam (tắt bằng `PRICE_AGGREGATION_ENABLED=false`), khoá advisory chống chạy trùng; chạy tay: `npm run price-aggregation:run`.

### 4.13. FR-PAYMENT — Đặt cọc & thanh toán (Đã bỏ khỏi Sprint 3)

- **Đã bỏ** theo quyết định của nhóm: không có giữ chỗ, đặt cọc hay thanh toán tiền phòng trong app. Hai task thanh toán sandbox ban đầu (API và giao diện) bị xoá khỏi Jira; mã TSK-S3-09 nay là task gỡ giữ chỗ và đặt cọc (UNINEST-13). Màn B-08 → B-14, D-07, L-26, L-27 không còn dùng.
- Thanh toán chỉ quay lại ở **Sprint 4** cho việc Chủ trọ mua gói Premium (FR-PREMIUM). Cổng thanh toán chọn khi làm Sprint 4 (ưu tiên cổng có môi trường test miễn phí và tài khoản cá nhân dùng được, ví dụ SePay hoặc payOS).
- Khi làm lại: chỉ coi là thành công khi cổng xác nhận (webhook đã xác thực chữ ký hoặc API tra cứu), mỗi giao dịch có mã tham chiếu duy nhất, đối soát bằng cron nội bộ, không lưu thông tin thẻ.

### 4.14. FR-AICHAT — Chatbot tư vấn (RAG) (Sprint 4 · TSK-S4-01 đã triển khai trên nhánh task, chờ review)

**Task:** TSK-S4-01 (embedding + RAG + LLM, P1), TSK-S4-02 (giao diện, P1). **Màn hình:** AI-01 Chào, AI-02 Trả lời dần, AI-03 Thẻ phòng, AI-04 Không có kết quả, AI-05 Lỗi dịch vụ, AI-06 Lịch sử, AI-07 Bảng tiêu chí trích xuất.

**Quy tắc bắt buộc**
- Chỉ gợi ý tin **`active`**. **Không bịa** phòng không tồn tại; mọi phòng gợi ý phải có link tới trang chi tiết thật.
- Trích xuất tiêu chí từ câu hỏi (giá, khu vực, tiện ích…) và cho sinh viên xem/sửa (AI-07).
- Truy xuất = tìm vector pgvector **kết hợp** lọc cấu trúc (giá, khu vực).
- Không có kết quả → trả lời trung thực + gợi ý nới tiêu chí. Dịch vụ AI lỗi → thông báo thân thiện kèm mã lỗi, gợi ý dùng tìm kiếm thường.
- Giữ ngữ cảnh nhiều lượt; lưu lịch sử hội thoại theo tài khoản.
- Embedding tin mới/vừa sửa sinh bằng **cron nội bộ**, không Redis. Index ivfflat/hnsw.
- Phản hồi ≤ 5 giây; ≥ 80% câu trả lời trong bộ test chuẩn có ít nhất 1 tin phù hợp thật; 100% link hợp lệ.
- Giới hạn chi phí: dùng mô hình nhỏ, giới hạn số request, cache kết quả tái sử dụng được.

**Đã chốt khi triển khai TSK-S4-01**
- Nhà cung cấp AI: API tương thích OpenAI (`AI_BASE_URL`, mặc định OpenAI), gọi bằng `fetch` có sẵn của Node, không thêm thư viện. Mô hình mặc định `gpt-4o-mini` (trả lời) và `text-embedding-3-small` (embedding, **768 chiều**, cột `vector(768)`). Thiếu `AI_API_KEY` → cron bỏ qua, chat trả `service_error`.
- Bảng `listing_embeddings` (listing_id PK, embedding, content_hash, model, embedded_at), index **HNSW `vector_cosine_ops`**. Cron `*/10 * * * *` (tắt bằng `AI_EMBEDDING_ENABLED=false`), khoá advisory chống chạy trùng, mỗi lượt tối đa 10 lô × 64 tin `active` chưa có embedding hoặc `updated_at > embedded_at`; nội dung không đổi (so `content_hash`) thì không gọi API. Chạy tay: `npm run ai-embedding:run`.
- Trích xuất tiêu chí bằng **luật tiếng Việt phía server** (nhanh, không tốn request): giá (`dưới 2 triệu 5`, `1tr5`, `800k`, `từ 3 đến 5 triệu`, `khoảng 1,2 triệu` → ±20%), diện tích tối thiểu, loại phòng, tiện ích (theo tên + từ đồng nghĩa), trường (tên trường, `BKĐN`, `gần trường` = trường của sinh viên), tỉnh/thành, phường. Tiêu chí lượt mới **gộp** với tiêu chí của cuộc trò chuyện (tiện ích cộng dồn, `rẻ hơn` = giảm 15% giá tối đa). Gửi `criteria` (AI-07) thì dùng nguyên tiêu chí đó.
- Câu hỏi không có tiêu chí và không có từ khoá tìm phòng → trả lời chung (`general`), không gợi ý phòng.
- Truy xuất: lọc cấu trúc (giá, diện tích, loại phòng, tiện ích bắt buộc đủ, trường liên kết, phường hoặc tỉnh) **AND** sắp xếp theo khoảng cách cosine; tin chưa có embedding xếp sau. Tối đa **5 tin**, chi tiết tin lấy qua `ListingsService.getListingsByIds` nên chỉ có tin `active` thật.
- Không có kết quả → câu trả lời cố định trung thực + tối đa **2 gợi ý nới tiêu chí** có đếm số phòng thật (nới ngân sách +25%, bỏ tiện ích, mở rộng ra toàn tỉnh, mọi loại phòng, bỏ giới hạn trường, bỏ diện tích).
- Dịch vụ AI lỗi/hết giờ (`AI_REQUEST_TIMEOUT_MS`, mặc định 4000ms) → HTTP 200 `type: service_error`, `errorCode: AI-503`, vẫn trả `criteriaDisplay` để app điền sẵn bộ lọc tìm kiếm thường; lượt lỗi **không lưu**.
- Giới hạn: **30 câu hỏi/giờ/sinh viên** (429 `AI_RATE_LIMITED`), nội dung ≤ 1000 ký tự, ngữ cảnh gửi LLM 6 tin gần nhất, cache embedding câu hỏi trong bộ nhớ (500 mục).
- Lịch sử lưu ở `ai_conversations` (tiêu chí hiện tại, số tin nhắn, số phòng đã gợi ý, xoá mềm) và `ai_messages`.

**API (chỉ Sinh viên):**
- `POST /ai/chat` body `{ message, conversationId?, criteria? }` → `{ conversationId, type: results|no_results|general|service_error, errorCode, answer, criteria, criteriaDisplay { labels, university, province, ward, amenities, roomTypes }, matchedCount, totalActiveCount, listingIds, listings, suggestions[{ title, description, criteria, matchedCount }], userMessage, assistantMessage }`.
- `GET /ai/conversations?page=&limit=`, `GET /ai/conversations/:id` (kèm `messages`, `listings` còn hiển thị), `DELETE /ai/conversations/:id`, `DELETE /ai/conversations` (xoá hết).

### 4.15. FR-AIRECOMM — Gợi ý cá nhân hoá (Sprint 4 · Chưa làm)

**Task:** TSK-S4-03 (theo dõi hành vi + engine, P2), TSK-S4-04 (khu vực "Gợi ý dành cho bạn", P2). **Màn hình:** H-01, H-03, SH-05.

**Quy tắc bắt buộc**
- Ghi hành vi: tin đã xem, tin đã lưu, từ khoá/bộ lọc đã tìm (`user_behaviors`).
- **Chỉ dùng hành vi của chính sinh viên đó**, không gợi ý chéo từ dữ liệu người khác.
- Sinh viên mới/ít hành vi → fallback **tin mới nhất hoặc phổ biến nhất** trong khu vực, không để trống.
- Làm mới gợi ý tối thiểu mỗi **24 giờ**; vector hành vi tính bằng **cron nội bộ**.
- Sinh viên xoá được lịch sử hành vi (SH-05, `DELETE /users/me/behaviors`).
- Với tài khoản ≥ 10 lượt xem/lưu: ≥ 50% tin gợi ý thuộc đúng khu vực/khoảng giá quan tâm nhiều nhất.
- Hiện tại trang chủ đã có "Đã xem gần đây" lưu trên máy — giữ nguyên, khu vực gợi ý là phần riêng.

**API dự kiến:** `GET /recommendations`, `DELETE /users/me/behaviors`.

### 4.16. FR-PREMIUM — Gói Chủ trọ Premium (Sprint 4 · Chưa làm)

**Task:** TSK-S4-05 (logic, P2), TSK-S4-06 (trang nâng cấp + thống kê nâng cao, P2).

**Quy tắc bắt buộc**
- Kích hoạt sau khi thanh toán gói thành công (module thanh toán làm mới ở Sprint 4), lưu ngày hết hạn (`is_premium`, `premium_expires_at`).
- Tin Premium được ưu tiên **chỉ trong tập kết quả đã khớp bộ lọc**; tin không khớp **không bao giờ** được đẩy lên.
- Gắn nhãn **"Nổi bật"** trên thẻ tin phía sinh viên.
- Hết hạn → tự hạ về miễn phí, gỡ ưu tiên; nhắc gia hạn trước khi hết hạn. Kiểm tra bằng **cron nội bộ hằng ngày**.
- Thống kê nâng cao (lượt xem theo thời gian, nguồn truy cập, tỉ lệ chuyển đổi thành liên hệ) **chỉ hiện với Premium còn hiệu lực**. Biểu đồ dùng chung thư viện với S-13.

### 4.17. Sprint 4 — Hiệu năng & media (Chưa làm)

- **TSK-S4-07** (NFR-PERF-01/03): rà index (GIST, cột lọc), load test k6/Artillery cho Search và Booking, `EXPLAIN ANALYZE`, tinh chỉnh pool. **Không đổi hành vi nghiệp vụ.** Có báo cáo số liệu.
- **TSK-S4-08** (NFR-PERF-02, NFR-COMPAT): resize/nén ảnh, tạo thumbnail (Sharp) — xử lý đồng bộ hoặc worker thread, **không Redis**; test giao diện 5,5"–6,9".

### 4.18. Sprint 5 — Đóng gói, triển khai, bàn giao (Chưa làm)

- **TSK-S5-01:** Dockerfile multi-stage, docker-compose (backend, PostgreSQL + PostGIS + pgvector, Redis chỉ cho Thông báo), GitHub Actions lint + test khi mở PR, build image khi merge.
- **TSK-S5-02:** triển khai VPS/Render/Railway, biến môi trường tách khỏi code, backup PostgreSQL **mỗi 24 giờ** lưu tách máy chủ, khôi phục thử thành công.
- **TSK-S5-03:** EAS Build Android + iOS bản nội bộ.
- **TSK-S5-04:** E2E cho luồng cốt lõi (đăng ký/đăng nhập, đăng tin, tìm kiếm, đặt lịch xem phòng, chat, thanh toán Premium, đánh giá), quét bảo mật (OWASP ZAP), 100% endpoint nhạy cảm từ chối trái quyền.
- **TSK-S5-05:** đối chiếu RTM với test case, tài liệu bàn giao, kịch bản demo.

---

## 5. Sự kiện nội bộ (điểm móc cho sprint sau)

| Sự kiện | Phát từ | Dùng ở |
| --- | --- | --- |
| `message.created` | chat | Thông báo (S3) |
| `booking.created`, `booking.status_changed` | booking | Thông báo (S3), Đánh giá (S3) |
| `listing.availability_changed` | listings/booking | Socket cập nhật app |
| `listing.activated` *(thêm ở S3)* | listings/admin | Đối chiếu bộ lọc đã lưu (S3), embedding (S4) |

Thêm sự kiện mới: khai báo hằng số trong `constants/` của module phát, payload có interface.

---

## 6. Yêu cầu phi chức năng (đo được)

| Mã | Chỉ tiêu | Ngưỡng |
| --- | --- | --- |
| NFR-PERF-01 | Tìm kiếm + lọc | ≤ 1,5s P95, ≥ 5.000 tin |
| NFR-PERF-02 | Trang chi tiết (kể cả ảnh) | ≤ 2s trên 4G ~10 Mbps |
| NFR-PERF-03 | API đọc thông thường | ≤ 500ms P95, 100 người đồng thời |
| NFR-PERF-04 | Chat / push | ≤ 1s / ≤ 10s |
| NFR-SEC-01 | Đường truyền | HTTPS, TLS ≥ 1.2 |
| NFR-SEC-02 | Mật khẩu | bcrypt/argon2 |
| NFR-SEC-03 | RBAC | 100% endpoint nhạy cảm từ chối trái quyền |
| NFR-SEC-04 | Xoá/xuất dữ liệu cá nhân | ≤ 30 ngày |
| NFR-SEC-05 | Thẻ/tài khoản ngân hàng | Không lưu |
| NFR-AVA-01 | Uptime | ≥ 99% từ 6:00–24:00 |
| NFR-AVA-02 | Giao dịch | Không mất khi lỗi mạng tạm thời |
| NFR-AVA-03 | Phục hồi | Giữ phiên bằng refresh token |
| NFR-BACKUP | Sao lưu | ≥ mỗi 24 giờ, lưu tách máy chủ |
| NFR-USE | Khả dụng | Tìm + liên hệ 1 phòng ≤ 5 phút; đăng tin/đặt lịch/đánh giá ≤ 5 bước |
| NFR-COMPAT | Tương thích | Android 8+, iOS 14+, màn 5,5"–6,9" |
| NFR-MAINT | Bảo trì | Module theo domain, lint, unit test cho xác thực, đặt lịch, thanh toán |

Mọi màn có tải dữ liệu phải có đủ **3 trạng thái: đang tải (skeleton), rỗng, lỗi + nút thử lại**. Vùng chạm tối thiểu **44×44**.

---

## 7. Dữ liệu mẫu

- `npm run seed:assets -- --upload` do một người phụ trách chạy một lần để tải 400 ảnh mẫu (lấy từ Pixabay, cần `PIXABAY_API_KEY` miễn phí trong `.env`) lên bucket R2 chung. Chạy `npm run seed:assets` không có cờ thì không upload; chạy lại với cờ cũng không ghi đè ảnh đã có. Key ảnh mẫu cố định dưới `listings/seed-assets/v1/` và không bị xoá khi sửa tin.
- `npm run seed` (backend) chỉ ghi database cục bộ, không gọi R2: danh mục (vai trò, tiện ích, tỉnh/phường, trường đại học, từ khoá cấm forum) và dữ liệu mẫu gồm 20 tài khoản, 200 tin (110 Đà Nẵng, 50 Hà Nội, 40 TP.HCM), nhiều trạng thái, lịch xem phòng, trường liên kết, 1 hội thoại chat mẫu. User và tin dùng UUID do PostgreSQL sinh; chạy lại không tạo trùng nếu chưa đổi tiêu đề tin mẫu.
- `npm run seed -- catalog`: chỉ danh mục. `npm run seed -- --bulk[=N]`: thêm N tin (mặc định 5.000) cho kiểm thử hiệu năng.
- Mật khẩu mặc định của mọi tài khoản seed: `UniNest@123`.
  - Sinh viên: `0900000001`, `0900000211`→`0900000213`.
  - Chủ trọ đã xác minh: `0900000201`→`0900000204`, `0900000206`→`0900000210`, `0900000220`→`0900000224`. Chủ trọ **chờ xác minh**: `0900000205`.
  - Admin: `0900000299`.
- **Chỉ chạy seed ở môi trường dev** (bị chặn khi `NODE_ENV=production`).
