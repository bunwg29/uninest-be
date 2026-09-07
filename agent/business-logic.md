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
- **Hồ sơ cá nhân**: Cập nhật thông tin người dùng, ảnh đại diện (avatar upload lên Cloudflare R2), xác thực số điện thoại, đổi mật khẩu.
- **Bảo mật**: Mật khẩu mã hóa bằng bcrypt/argon2; cơ chế JWT gồm Access Token ngắn hạn và Refresh Token lưu trữ an toàn.

### B. Quản lý Tin đăng Phòng trọ (`listings`)

- **Đăng tin & Cập nhật**: Chủ trọ (`landlord`) tạo tin mới gồm tiêu đề, mô tả, giá thuê, tiền cọc, diện tích, loại phòng, địa chỉ chi tiết, tiện nghi đi kèm, ảnh phòng (upload R2).
- **Vòng đời tin đăng (Lifecycle)**:
  - Mới tạo mặc định ở trạng thái chờ duyệt (`pending`).
  - Quản trị viên (`admin`) xét duyệt chuyển sang `active` hoặc từ chối (`rejected`).
  - Chủ trọ có thể chủ động ẩn tin (`hidden`) hoặc đánh dấu phòng đã được thuê (`rented`).
- **Lưu vết & Xóa mềm**: Hỗ trợ soft delete để lưu vết lịch sử tin đăng phục vụ đối soát và báo cáo.

### C. Tìm kiếm Không gian & So sánh Phòng trọ (`search`, `comparison`)

- **Tìm kiếm theo bán kính vị trí**: Tích hợp truy vấn không gian (PostGIS) để tìm các phòng trọ nằm trong bán kính xác định quanh trường đại học hoặc tọa độ người dùng.
- **Bộ lọc đa tiêu chí**: Lọc theo khoảng giá, loại phòng, khoảng cách, tiện ích; sắp xếp theo giá tăng/giảm, tin mới nhất, khoảng cách gần nhất.
- **So sánh phòng trọ**: Hỗ trợ người dùng chọn tối đa 4 phòng trọ để so sánh trực quan về giá, diện tích, chi phí dịch vụ và tiện nghi.

### D. Đặt lịch Xem phòng & Giữ chỗ (`booking`)

- **Hai hình thức đặt lịch**: Sinh viên tạo yêu cầu hẹn xem phòng trực tiếp (`viewing`) hoặc yêu cầu giữ chỗ (`holding`).
- **Quy trình xử lý**:
  - Trạng thái ban đầu: `pending`.
  - Chủ trọ có quyền chấp nhận (`confirmed`) kèm lời nhắn, hoặc từ chối (`rejected`) có nêu lý do.
  - Sinh viên có thể chủ động hủy yêu cầu (`cancelled`) khi chưa được xác nhận.
  - Tự động hết hạn/hủy bỏ (`expired`) sau khoảng thời gian quy định nếu chủ trọ không phản hồi.

### E. Nhắn tin Trao đổi 1-1 (`chat`)

- **Hội thoại gắn liền tin đăng**: Tạo luồng trao đổi trực tiếp giữa sinh viên và chủ trọ của một phòng cụ thể.
- **Nội dung tin nhắn**: Hỗ trợ gửi tin nhắn văn bản và tệp hình ảnh đính kèm (qua Cloudflare R2). Đánh dấu trạng thái đã đọc/chưa đọc.

### F. Diễn đàn Cộng đồng Sinh viên (`forum`)

- **Chia sẻ & Tìm người ở ghép**: Sinh viên đăng bài tìm bạn cùng phòng, chia sẻ kinh nghiệm thuê trọ theo khu vực trường đại học.
- **Tương tác & Kiểm duyệt**: Bình luận, tích hợp bộ lọc từ ngữ thô tục (profanity filter) tự động trước khi lưu trữ, cơ chế báo cáo bài viết vi phạm cho admin xử lý.

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
2. **Server tạo Presigned URL**: Server sử dụng `R2StorageService` (`@aws-sdk/s3-request-presigner`) tạo URL ký trước có thời hạn (ví dụ 15 phút).
3. **Client upload trực tiếp**: Client gửi HTTP `PUT` chứa binary file trực tiếp lên Cloudflare R2 endpoint. Server hoàn toàn không bị nghẽn băng thông do truyền file trung gian.
4. **Lưu trữ URL**: Client gửi URL ảnh đã upload lên R2 vào body các API tạo/sửa tin đăng hoặc avatar.

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
