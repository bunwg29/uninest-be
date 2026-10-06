# UniNest Backend - Business Logic & Domain Architecture

## 1. Mục tiêu & Các vai trò trong Hệ thống (Actors & RBAC)

- **Hệ thống**: Backend phục vụ ứng dụng tìm kiếm, quản lý và đặt lịch thuê trọ sinh viên UniNest.
- **3 Vai trò chính**:
  - `student`: Tìm kiếm phòng trọ quanh trường học (bán kính GPS), so sánh phòng, đặt lịch xem/giữ chỗ, nhắn tin trao đổi 1-1 với chủ trọ, đánh giá phòng đã thuê, nạp tiền đặt cọc sandbox.
  - `landlord`: Đăng tin phòng trọ kèm tọa độ bản đồ và ảnh (lưu Cloudflare R2), quản lý duyệt/từ chối yêu cầu đặt lịch, chat với sinh viên, mua gói nâng cấp tin nổi bật.
  - `admin`: Kiểm duyệt danh sách tin đăng mới (mặc định trạng thái `pending`), xử lý báo cáo vi phạm, quản lý khóa tài khoản người dùng, xem thống kê hệ thống.

---

## 2. Đặc tả Chức năng & Luồng Nghiệp vụ theo Module (Feature Specifications & Lifecycle Flows)

### A. Xác thực & Tài khoản người dùng (`auth`, `users`)

- **Đăng ký & Đăng nhập**: Xác thực bằng email hoặc số điện thoại kèm mật khẩu/mã OTP.
- **Phân quyền (RBAC)**: Hỗ trợ 3 vai trò `student`, `landlord`, `admin`. Kiểm soát truy cập API qua Guard và Role Decorator.
- **Đăng ký & Đăng nhập**:
  - Hỗ trợ đăng nhập linh hoạt bằng Số điện thoại hoặc Email kèm Mật khẩu.
  - Client tự động phát hiện và gửi kèm thông tin thiết bị (`deviceId`, `deviceName`) khi đăng nhập.
  - Backend lưu vết `deviceId` và `deviceName` vào bảng `refresh_tokens` phục vụ kiểm soát phiên truy cập và bảo mật thiết bị.
- **Xác thực OTP (One-Time Password)**:
  - Mã OTP gồm 6 chữ số phục vụ kích hoạt tài khoản đăng ký mới, đăng nhập nhanh và xác thực quên mật khẩu.
  - Thời hạn mã OTP: 5 phút. Cooldown gửi lại mã: 60 giây.
  - Giới hạn thử sai mã OTP tối đa 5 lần; khi vượt quá giới hạn, mã bị vô hiệu và khoá thao tác xác thực/gửi lại 60 giây (HTTP 429 kèm số giây còn lại).
  - Mã OTP được lưu trong PostgreSQL dạng băm SHA-256 (`otp_codes.code_hash`, kèm `expires_at`, `attempts`, `locked_until`), không lưu plaintext và không dùng Redis.
- **Quản lý Phiên & Thu hồi Token (Token Revocation)**:
  - Cơ chế JWT gồm Access Token hiệu lực 1 giờ và Refresh Token tối đa 30 ngày không hoạt động (xoay vòng mỗi lần làm mới); endpoint làm mới là `POST /auth/refresh` (giữ alias `/auth/refresh-token`).
  - Khi người dùng đăng xuất (`POST /api/v1/auth/logout`), backend lập tức đánh dấu thu hồi `is_revoked = true` cho refresh token tương ứng, ngăn chặn tuyệt đối việc tái sử dụng token bị đánh cắp.
- **Quên mật khẩu & Đặt lại mật khẩu**:
  - Luồng chuẩn 3 bước: Yêu cầu mã OTP qua số điện thoại -> Xác minh OTP -> Đặt mật khẩu mới (tối thiểu 8 ký tự, có ít nhất một chữ số và một chữ in hoa).
- **Phân quyền (RBAC)**: Hỗ trợ 3 vai trò `student`, `landlord`, `admin`. Kiểm soát truy cập API qua Guard (`JwtAuthGuard`, `RolesGuard`) và Decorator (`@Roles`, `@CurrentUser`).
- **Chuẩn hoá Ngôn ngữ**: 100% thông báo thành công, ngoại lệ (`HttpException`), lỗi validation và thông điệp lỗi trong API envelope đều sử dụng Tiếng Việt thống nhất, rõ nghĩa và đồng bộ với Mobile App.
- **Chủ trọ "Chờ xác minh"**: Chủ trọ mới đăng ký chưa có `users.landlord_verified_at` nên bị từ chối tạo tin (`LANDLORD_NOT_VERIFIED`) cho tới khi gửi `POST /profile/landlord-verification` (số CCCD/CMND 9 hoặc 12 chữ số, địa chỉ liên hệ tuỳ chọn). `GET /profile` trả `verificationStatus` (`pending_verification` | `verified`) và số liệu thật (`savedRooms`, `appointments`).
- **Hồ sơ cá nhân**: Cập nhật thông tin người dùng, ảnh đại diện (avatar upload lên Cloudflare R2), xác thực số điện thoại, đổi mật khẩu.
- **Bảo mật**: Mật khẩu mã hóa bằng bcrypt/argon2; cơ chế JWT gồm Access Token ngắn hạn và Refresh Token lưu trữ an toàn.
- **Bảo mật**: Mật khẩu mã hóa bằng bcrypt/argon2 an toàn.

### B. Quản lý Tin đăng Phòng trọ (`listings`)

- **Tin công khai**: sinh viên xem qua `GET /listings/search` và `GET /listings/:id` (đã có kiểm tra quyền theo trạng thái); API `/rooms` cũ đã gỡ vì lộ cả tin chưa duyệt.
- **Đăng tin & Cập nhật**: Chủ trọ (`landlord`) tạo tin mới gồm tiêu đề, mô tả, giá thuê, tiền cọc, diện tích, loại phòng, địa chỉ chi tiết, tiện nghi đi kèm, ảnh phòng (upload R2).
- **Lịch xem phòng**: Chủ trọ thiết lập các buổi sáng, chiều, tối có thể xem phòng cho từng ngày trong tuần; lịch được lưu cùng tin đăng và trả về khi chỉnh sửa.
- **Vòng đời tin đăng (Lifecycle)**:
  - Mới tạo mặc định ở trạng thái chờ duyệt (`pending`).
  - Quản trị viên (`admin`) xét duyệt chuyển sang `active` hoặc từ chối (`rejected`).
  - Chủ trọ có thể chủ động ẩn tin (`hidden`) hoặc đánh dấu phòng đã được thuê (`rented`).
  - Sửa giá hoặc diện tích của tin đã duyệt đưa tin về `pending`; các chỉnh sửa khác giữ nguyên trạng thái. Tin đã có lịch hẹn/giữ chỗ không bị xoá mà chuyển sang `paused` ("Ngừng nhận yêu cầu").
- **Lưu vết & Xóa mềm**: Hỗ trợ soft delete để lưu vết lịch sử tin đăng phục vụ đối soát và báo cáo.

### C. Tìm kiếm Không gian & So sánh Phòng trọ (`search`, `comparison`)

- **Tìm kiếm theo bán kính vị trí**: Tích hợp truy vấn không gian (PostGIS) để tìm các phòng trọ nằm trong bán kính xác định quanh trường đại học hoặc tọa độ người dùng.
- **Bộ lọc đa tiêu chí**: Lọc theo khoảng giá, loại phòng, khoảng cách, tiện ích; sắp xếp theo giá tăng/giảm, tin mới nhất, khoảng cách gần nhất.
- **Endpoint**: `GET /listings/search` (công khai; `SearchModule` phải được đăng ký trước `ListingsModule` để không bị `GET /listings/:id` chặn). Chỉ trả tin `active`, điều kiện lọc kết hợp AND, sắp xếp mặc định `relevance` (khớp tiêu đề → khoảng cách → mới nhất), ngoài ra `newest`, `price_asc/desc`, `area_asc/desc`, `distance`. Mỗi tin có `availability` (`available` | `holding` | `rented` | `paused`) và `holdExpiresAt`. Không có kết quả: `hasResults=false` kèm `suggestion` (mở rộng bán kính hoặc nới lỏng bộ lọc). Số liệu lượt xem/lưu không công khai.
- **Phòng đã lưu**: `GET /listings/favorites` (phân trang), `GET /listings/favorites/ids`, `POST|DELETE /listings/:id/favorite`.
- **Chi tiết tin**: `GET /listings/:id` trả `availability`, `hold {expiresAt, daysLeft}`; `viewCount` chỉ cho chủ tin/Admin; `POST /listings/:id/reports` báo cáo tin (mỗi người một lần).
- **So sánh phòng trọ**: Hỗ trợ người dùng chọn tối đa 4 phòng trọ để so sánh trực quan về giá, diện tích, chi phí dịch vụ và tiện nghi.

### D. Đặt lịch Xem phòng & Giữ chỗ (`booking`)

- **Trạng thái**: `pending` → `confirmed` | `rejected` | `expired` | `cancelled`; `confirmed` → `holding` | `cancelled`; `holding` → `expired` | `cancelled`.
- **Yêu cầu xem phòng**: chỉ Sinh viên tạo; mỗi sinh viên chỉ có một lịch đang xử lý cho một phòng; khung giờ không được chồng lấn. Chủ trọ không phản hồi sau 24 giờ (`BOOKING_RESPONSE_HOURS`) thì tự động `expired`; yêu cầu quá giờ hẹn mà chưa xác nhận cũng hết hạn.
- **Chủ trọ**: `GET /bookings/landlord`, `PATCH /bookings/:id/confirm`, `PATCH /bookings/:id/reject` (bắt buộc lý do), `PATCH /bookings/:id/release` (huỷ giữ chỗ, bắt buộc lý do).
- **Giữ chỗ**: chỉ từ lịch `confirmed` và sau giờ đã hẹn xem; mỗi phòng tối đa một sinh viên giữ chỗ (khoá dòng tin + ràng buộc duy nhất `uq_bookings_one_holding_per_listing`, trả 409 `LISTING_HELD`). Thời hạn `HOLDING_DAYS` (mặc định 7), hết hạn thì cron trả phòng về còn trống. Trang chi tiết hiển thị ngày hết hạn và số ngày còn lại.
- **Tin có lịch hẹn/giữ chỗ**: `DELETE` chuyển tin sang `paused` ("Ngừng nhận yêu cầu") thay vì xoá.
- **Cron nội bộ** (`@nestjs/schedule`, 5 phút, không dùng Redis/BullMQ): cập nhật có điều kiện, ghi `booking_events`, phát `booking.status_changed` (và `booking.created`) để Sprint 3 gắn Notification.
- Hủy trước giờ xem dưới 24 giờ bắt buộc nhập lý do.

### E. Nhắn tin Trao đổi 1-1 (`chat`)

- **Hội thoại gắn liền tin đăng**: Tạo luồng trao đổi trực tiếp giữa sinh viên và chủ trọ của một phòng cụ thể.
- **Nội dung tin nhắn**: Hỗ trợ gửi tin nhắn văn bản và tệp hình ảnh đính kèm (qua Cloudflare R2). Đánh dấu trạng thái đã đọc/chưa đọc.
- **Dữ liệu**: bảng `conversations` (duy nhất theo cặp `listing_id` + `student_id`, chỉ sinh viên được khởi tạo) và `messages` (`client_message_id` chống gửi trùng khi gửi lại lúc mất mạng, `image_keys` lưu object key thư mục `chat/`, tối đa 10 ảnh/tin, `read_at`, `recalled_at`). Cả hai bảng dùng soft delete; dữ liệu được lưu tối thiểu 12 tháng.
- **Realtime**: Socket.IO namespace `/chat`, xác thực bằng JWT access token ở handshake (`auth.token`), từ chối kết nối ngay khi token sai. Sự kiện client gửi: `message.send`, `conversation.read` (có ack theo envelope `{ status, data, error, messages }`). Sự kiện server phát tới cả hai bên: `message.new`, `message.recalled`, `conversation.read`.
- **REST bổ trợ**: `POST /conversations`, `GET /conversations` (phân trang `page`/`limit` mặc định 20, lọc `all`/`unread`, tìm kiếm phía server theo `keyword`), `GET /conversations/summary`, `GET /conversations/:id`, `DELETE /conversations/:id`, `GET /conversations/:id/messages` (cursor, 30 tin/trang, mới nhất trước), `POST /conversations/:id/messages`, `DELETE /conversations/:id/messages/:messageId` (thu hồi), `PATCH /conversations/:id/read`.
- **Tải từng phần**: danh sách hội thoại chỉ trả metadata (người đối thoại, tin đăng, tin cuối, số chưa đọc); tin nhắn chỉ được tải khi mở một đoạn chat. Từ khoá tìm kiếm khớp `ILIKE` theo tên người đối thoại hoặc tiêu đề tin đăng (có phân biệt dấu tiếng Việt).
- **Quy tắc**: chỉ hai người tham gia được xem hội thoại. Tin nhắn **không được chỉnh sửa** sau khi gửi (SRS FR-CHAT); người gửi chỉ **thu hồi** (ẩn) tin của chính mình. Nội dung chat được lưu tối thiểu 12 tháng nên khi thu hồi chỉ ẩn nội dung, ảnh trên R2 vẫn được giữ.
- **Xoá đoạn chat**: xoá theo từng phía (`conversations.student_deleted_at` / `landlord_deleted_at`). Người xoá không còn thấy lịch sử cũ và badge không đếm tin cũ; người kia giữ nguyên dữ liệu (đáp ứng yêu cầu lưu trữ 12 tháng). Có tin nhắn mới thì đoạn chat hiện lại và chỉ chứa tin từ thời điểm đó. Sự kiện `conversation.deleted` chỉ gửi tới các thiết bị của người xoá.
- **Sự kiện realtime**: ngoài `message.new`, `message.recalled`, `conversation.read` (gửi cho cả hai bên khi sửa tin).
- **Phương tiện**: chỉ hỗ trợ ảnh jpg/png tối đa 5MB, lưu trên Cloudflare R2 thư mục `chat/`; backend kiểm tra lại định dạng và dung lượng đối tượng sau khi tải lên. Cơ sở dữ liệu chỉ giữ object key. Chưa hỗ trợ video.
- **Điểm móc thông báo**: mỗi tin nhắn mới phát sự kiện nội bộ `message.created` (`EventEmitter2`) để Notification Pipeline (Sprint 3) đăng ký lắng nghe.

### F. Diễn đàn Cộng đồng Sinh viên (`forum`)

- **Chia sẻ & Tìm người ở ghép**: Sinh viên đăng bài tìm bạn cùng phòng, chia sẻ kinh nghiệm thuê trọ theo khu vực trường đại học.
- **Tương tác & Kiểm duyệt**: Bình luận, tích hợp bộ lọc từ ngữ thô tục (profanity filter) tự động trước khi lưu trữ, cơ chế báo cáo bài viết vi phạm cho admin xử lý.
- **Chuyên mục**: `roommate` (Tìm bạn ở ghép), `experience` (Kinh nghiệm thuê trọ), `question` (Hỏi đáp), `area_review` (Review khu vực). Bài `roommate` bắt buộc có tiêu chí ở ghép (giới tính, chi phí/người, ngày dọn vào, tiêu chí, khu vực) và trạng thái `open` (Còn chỗ) / `full` (Đã đủ).
- **Vòng đời bài viết**: `draft` (lưu nháp, không kiểm duyệt) -> `published` -> `hidden` (Đã ẩn – chờ Admin xử lý). Admin `restore` về `published` hoặc `remove` (xoá mềm). Bình luận: `published` / `hidden`, trả lời tối đa 1 cấp.
- **Quyền sửa/xoá**: Chỉ tác giả hoặc Admin được sửa/xoá bài viết, bình luận. Tác giả không sửa được nội dung đang bị ẩn.
- **Bộ lọc nội dung**: `ForumContentModerationInterceptor` kiểm tra tiêu đề, nội dung, ghi chú ở ghép trước khi lưu. Từ khoá cấm lưu ở bảng `forum_banned_keywords` (nạp mặc định từ `modules/forum/data/banned-keywords.json`, Admin quản lý qua API). Hành động `block` luôn bị chặn (422); `warn` (vd: số điện thoại) bị chặn cho tới khi client gửi `acknowledgeWarnings: true`. Số tài khoản ngân hàng luôn bị chặn. `POST /forum/moderation/check` trả về vi phạm + bản đã lược bỏ để client hiển thị cảnh báo trước khi đăng.
- **Báo cáo & tự động ẩn**: Bảng `forum_reports` tối giản (1 người chỉ báo cáo 1 lần mỗi nội dung, không tự báo cáo). Khi số báo cáo chưa xử lý đạt ngưỡng `FORUM_REPORT_HIDE_THRESHOLD` (mặc định 5) nội dung tự chuyển `hidden`. Sprint 3 sẽ chuẩn hoá thành Report Engine dùng chung.

### G. Đánh giá Xác thực (`reviews`)

- **Đánh giá phòng**: Sinh viên đã hoàn thành thuê phòng được gửi đánh giá kèm điểm số (1-5 sao theo các tiêu chí: an ninh, vệ sinh, giá trị tương xứng, thái độ chủ trọ).
- **Phản hồi từ chủ trọ**: Chủ trọ có quyền phản hồi công khai 1 lần duy nhất cho mỗi đánh giá.

### H. Thông báo Hệ thống (`notifications`)

- Thông báo in-app và push notification khi phát sinh các sự kiện: có lịch hẹn mới, trạng thái đặt phòng thay đổi, có tin nhắn mới, bài viết diễn đàn có phản hồi, tin đăng được duyệt.

### I. Thanh toán Sandbox (`payment`)

- Tích hợp cổng thanh toán thử nghiệm (VNPay/MoMo Sandbox) phục vụ nạp tiền đặt cọc giữ chỗ và mua gói nâng cấp tin nổi bật cho chủ trọ. Tuyệt đối không lưu trữ thông tin thẻ thanh toán của người dùng.

### J. Trợ lý AI & Gợi ý Cá nhân hóa (`ai-chat`, `recommendations`)

- **AI Chatbot**: Trợ lý giải đáp, gợi ý phòng trọ dựa trên dữ liệu tin đăng thực tế trong hệ thống (sử dụng vector embedding và truy vấn tương đồng ngữ nghĩa), trích dẫn đường dẫn phòng cụ thể.
- **Gợi ý thông minh**: Đề xuất danh sách phòng trọ phù hợp dựa trên lịch sử tìm kiếm và phòng đã lưu của sinh viên.

---

## 3. Quy trình Lưu trữ Cloudflare R2 (Storage Flow)

1. **Client yêu cầu upload**: Client gọi API `POST /api/v1/storage/presigned-upload-url` kèm `fileName` và `contentType`.
2. **Server tạo Presigned URL**: Server sử dụng `R2StorageService` (`@aws-sdk/s3-request-presigner`) tạo URL ký trước có thời hạn 5 phút (`POST /storage/presign-upload`, yêu cầu đăng nhập; chỉ nhận jpg/png ≤5MB).
3. **Client upload trực tiếp**: Client gửi HTTP `PUT` chứa binary file trực tiếp lên Cloudflare R2 endpoint. Server hoàn toàn không bị nghẽn băng thông do truyền file trung gian.
4. **Lưu trữ object key**: Database chỉ lưu object key của ảnh (ví dụ `listings/...jpg` hoặc `avatars/...jpg`). Backend ghép public base URL khi trả response cho client để có thể đổi nhà cung cấp storage mà không phải sửa dữ liệu.
5. **Dọn ảnh khi cập nhật**: Sau khi cập nhật tin thành công, backend xóa khỏi R2 các ảnh đã bị chủ trọ loại khỏi tin; ảnh của tin bị xóa mềm vẫn được giữ lại theo chính sách lưu vết.

---

## 4. Các tính năng Nằm ngoài Phạm vi (Out of Scope - KHÔNG XÂY DỰNG)

- Hợp đồng điện tử có chữ ký số pháp lý phức tạp.
- Cổng thanh toán thật với tiền thật (chỉ dùng sandbox thử nghiệm).
- Thuật toán AI quét trùng lặp ảnh / chống lừa đảo phức tạp.
- Phần mềm kế toán/thu chi chuyên sâu cho chủ nhà trọ.

---

## 5. Chỉ số Cam kết Chất lượng Dịch vụ (SLOs)

- API tìm kiếm không gian PostGIS (ST_DWithin): P95 <= 1.5s với cơ sở dữ liệu >= 5,000 phòng.
- API chi tiết tin đăng: Response time <= 200ms.
- Bảo mật: 100% mật khẩu được băm an toàn; JWT phân quyền chặt chẽ; không bao giờ lưu số thẻ tín dụng hay mã CVV.
