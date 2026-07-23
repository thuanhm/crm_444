# CRM1.0 Transformation 2026 — Bảng thi đua Chi nhánh Bắc Nghệ An

Website nội bộ công khai bảng điểm thi đua CRM1.0 theo Công văn 7087/TGĐ-NHCT-KHDN5,
kèm trang quản trị để Trưởng phòng Kế hoạch Tổng hợp tải số liệu Excel hằng tháng.

## Công nghệ

- **Next.js** (Pages Router) — frontend + API routes
- **Neon Postgres** (qua Vercel Marketplace) — lưu điểm theo từng tháng, dùng chung cho mọi người xem
- **xlsx (SheetJS)** — đọc file Excel ngay trên trình duyệt, không upload file thô lên server
- Đăng nhập admin bằng mật khẩu (biến môi trường) + cookie phiên ký HMAC, không dùng thư viện ngoài

## Chạy thử ở máy local

```bash
npm install
cp .env.local.example .env.local
# Sửa .env.local: đặt ADMIN_PASSWORD và SESSION_SECRET
npm run dev
```

Mở http://localhost:3000. Lưu ý: khi chạy local mà **chưa** cấu hình `DATABASE_URL`, các API
đọc/ghi dữ liệu sẽ báo lỗi kết nối Postgres — đây là điều bình thường, vì cần có database Neon
thật. Cách nhanh nhất để có dữ liệu test: tạo database Neon trước (xem bên dưới), chạy
`db/schema.sql` trong Neon SQL Editor, copy connection string vào `.env.local`, rồi chạy lại
`npm run dev`.

## Triển khai lên GitHub + Vercel

Dưới đây là hướng dẫn triển khai dự án **`crm_444`** được định dạng lại đẹp mắt bằng Markdown, tối ưu cho việc đọc và theo dõi từng bước.

---

# 🚀 Hướng Dẫn Triển Khai Dự Án CRM 444 (Next.js + Neon + Vercel)

Tài liệu này hướng dẫn từng bước đưa dự án **`crm_444`** từ thư mục mã nguồn lên hoạt động thực tế trên Internet.

---

## 🛠️ Quy Trình Thực Hiện

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Bước 1      │ ──> │   Bước 2      │ ──> │   Bước 3      │
│ Khởi tạo Neon │     │ Push GitHub   │     │ Deploy Vercel │
└───────────────┘     └───────────────┘     └───────────────┘

```

---

## 🔹 Bước 1: Khởi Tạo Cơ Sở Dữ Liệu Trên Neon (PostgreSQL)

Dự án này sử dụng cơ sở dữ liệu PostgreSQL với cấu trúc được định nghĩa sẵn trong file `db/schema.sql`.

1. **Tạo Project mới trên Neon:**
* Truy cập [neon.tech](https://neon.tech/) và đăng nhập.
* Nhấn **Create Project**.
* **Project Name:** `crm-444-db` (hoặc tên tùy chọn).
* **Region:** Chọn `Singapore` (để tối ưu tốc độ tại Việt Nam).


2. **Khởi tạo các bảng dữ liệu (Tables):**
* Trong giao diện điều khiển của Neon, chọn mục **SQL Editor** ở menu bên trái.
* Mở file `schema.sql` nằm trong thư mục `crm_444-main/db/` trên máy tính, **sao chép toàn bộ nội dung SQL**.


* Dán vào khung **SQL Editor** trên Neon và nhấn **Run** để khởi tạo cấu trúc cơ sở dữ liệu.


3. **Lấy chuỗi kết nối (Database Connection String):**
* Quay lại trang **Dashboard** của Neon.
* Tại mục **Connection Details**, chọn tab **Pooled connection**.
* Sao chép đoạn mã kết nối có dạng:
```env
postgresql://username:password@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

```


* 📌 *Lưu lại chuỗi này ra Notepad để dùng ở Bước 3.*



---

## 🔹 Bước 2: Tải Mã Nguồn Lên GitHub

1. **Chuẩn bị file code:**
* Giải nén file chứa thư mục `crm_444-main` trên máy tính.




2. **Tạo Repository mới trên GitHub:**
* Đăng nhập vào [github.com](https://github.com/).
* Nhấn dấu **`+`** (góc trên bên phải) $\rightarrow$ Chọn **New repository**.
* **Repository name:** `crm_444`
* **Option:** Chọn *Public* hoặc *Private* tùy nhu cầu.
* Nhấn **Create repository** *(không tích chọn khởi tạo README hay .gitignore vì code đã có sẵn)*.




3. **Đẩy code lên bằng GitHub Desktop:**
* Mở ứng dụng **GitHub Desktop**.
* Chọn **File** $\rightarrow$ **Add Local Repository...** $\rightarrow$ Chọn thư mục `crm_444-main`.


* Nếu phần mềm yêu cầu khởi tạo Git, nhấn **Create a repository**.
* Ở góc dưới bên trái, điền mô tả commit (ví dụ: `Initial commit`) $\rightarrow$ Nhấn **Commit to main**.
* Nhấn **Publish repository** ở thanh công cụ phía trên để đẩy toàn bộ code lên GitHub.



---

## 🔹 Bước 3: Triển Khai Ứng Dụng Lên Vercel

Dự án được xây dựng bằng **Next.js**, Vercel sẽ tự động tối ưu quá trình Build và Hosting.

1. **Import dự án từ GitHub:**
* Truy cập [vercel.com](https://vercel.com/) và đăng nhập bằng tài khoản **GitHub**.
* Nhấn **Add New...** $\rightarrow$ Chọn **Project**.
* Tìm repository `crm_444` vừa đẩy lên và nhấn **Import**.


2. **Thêm biến môi trường (Environment Variables) ⚠️ *Cực kỳ quan trọng*:**
* Trước khi bấm Deploy, mở rộng mục **Environment Variables**.
* Dựa theo mẫu từ file `.env.local.example`, thêm các biến cấu hình sau:





| Key (Tên biến) | Value (Giá trị) | Ghi chú |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://...` | Chuỗi kết nối lấy từ **Neon** ở Bước 1 |
| `SESSION_SECRET` | `chuoi_bao_mat_tu_chon_123` | Chuỗi ký tự ngẫu nhiên dùng mã hóa session |
| `ADMIN_PASSWORD` | `mat_khau_trang_admin` | Mật khẩu dùng để đăng nhập trang Quản trị |

3. **Thực thi Deploy:**
* Nhấn nút **Deploy**.
* Chờ khoảng 1–2 phút để Vercel tự động cài đặt các phụ thuộc từ `package.json` và biên dịch dự án.


* Khi hoàn tất, Vercel sẽ cấp cho bạn đường link truy cập dạng:
`[https://crm-444-xxx.vercel.app](https://crm-444-xxx.vercel.app)`



---

## 📝 Kiểm Tra Sau Khi Hoàn Tất

* [x] Truy cập đường link trang web do Vercel cung cấp.
* [x] Thử đăng nhập vào trang Quản trị (`/admin` hoặc theo đường dẫn ứng dụng) bằng `ADMIN_PASSWORD` đã thiết lập.
* [x] Thực hiện thêm/sửa/xóa dữ liệu để đảm bảo ứng dụng kết nối mượt mà tới **Neon PostgreSQL Database**.

## Sử dụng

- **Trang chủ (`/`)**: công khai, không cần đăng nhập. Chọn kỳ tháng để xem bảng xếp hạng theo
  Phòng/PGD và theo cán bộ RM, có ô tìm kiếm và tùy chọn xem lũy kế tất cả các kỳ.
- **Trang quản trị (`/admin`)**: đăng nhập bằng `ADMIN_PASSWORD`, chọn tháng áp dụng.

  **Tạo kỳ mới:** cần tải đủ **5** file Excel theo đúng thứ tự:
  1. Báo cáo trạng thái Lead
  2. Báo cáo trạng thái OPP
  3. Tiếp cận tương tác Lead
  4. Tiếp cận tương tác OPP
  5. **Danh sách RM biên chế theo phòng** (trích từ PeopleSoft) — cần có cột `Tên phòng` và một
     cột định danh RM (chấp nhận các tên: `RM quản lý`, `RM`, `Mã CB`, `Mã cán bộ`, `Mã nhân viên`,
     `User RM`, `Username`, `User name`, `Email/AD`, `Email`, `AD`, `Mã đăng nhập` — hệ thống tự
     nhận diện cột đầu tiên khớp). Đối chiếu với 4 file CRM dùng **mã phòng**, không dùng tên
     phòng — xem chi tiết ở mục bên dưới.

  **Sửa kỳ đã có (KHÔNG cần tải lại đủ 5 file):** chọn tháng đã có dữ liệu (hoặc bấm "Sửa" ở danh
  sách bên phải), mỗi ô file sẽ hiện "Đã có (ngày giờ tải)" nếu từng tải trước đó. Chỉ cần chọn
  lại file nào cần cập nhật — các file không chọn sẽ tự dùng dữ liệu đã lưu lần trước. Bấm "Xử lý
  số liệu" để xem trước, "Lưu vào bảng xếp hạng" để công bố. Có thể xóa hẳn một kỳ nếu cần làm
  lại từ đầu.

## Di chuyển (migrate) dữ liệu khi hệ thống đổi cách tính điểm

Mỗi khi logic tính điểm cốt lõi thay đổi (ví dụ: đổi cách đối chiếu phòng, đổi phạm vi RM được
tính...), các kỳ đã tải **trước đó** vẫn đang lưu dữ liệu theo cách tính cũ, không tương thích
với kết quả mới. Hệ thống tự phát hiện việc này qua `schemaVersion` gắn trên mỗi file đã xử lý
(xem `PARTIAL_SCHEMA_VERSION` trong `lib/aggregate.js`) và sẽ **không** cho dùng lại file ở phiên
bản cũ — ô tương ứng hiện "Dữ liệu cũ — cần tải lại" (màu cam) thay vì "Đã có" (màu xanh).

**Cách xử lý:** với mỗi kỳ đã tải trước đó, vào Quản trị, chọn lại đúng tháng đó, rồi tải lại
**đủ cả 5 file gốc** của kỳ đó (không thể chỉ tải 1 file rồi dùng lại 4 file cũ, vì 4 file cũ
không dùng được nữa). Sau khi lưu, kỳ đó sẽ ở phiên bản mới và từ lần sau có thể sửa từng file
riêng lẻ bình thường. Các kỳ tạo mới từ bây giờ trở đi không bị ảnh hưởng.

## Tab Cảnh báo — cán bộ có điểm thấp hơn 30% bình quân chi nhánh

Trang `/canh-bao` (công khai, cùng cấp với Bảng xếp hạng) hiển thị danh sách RM có điểm thi đua
thấp hơn 30% **điểm bình quân/RM toàn chi nhánh** trong kỳ đang chọn.

Điểm bình quân/RM toàn chi nhánh dùng đúng công thức Mục 6.1 công văn nhưng gộp số liệu toàn chi
nhánh (không tách theo phòng) rồi chia cho tổng số RM biên chế toàn chi nhánh — cùng đơn vị
"điểm/1 RM" nên so sánh trực tiếp được với điểm tuyệt đối của từng RM (Mục 6.2):

```
Điểm bình quân/RM = 30% × (Tổng Lead/Opp có tương tác toàn CN ÷ Tổng RM)
                   + 30% × (Tổng Lead chuyển đổi sang Opp toàn CN ÷ Tổng RM)
                   + 40% × (Tổng Opp thành công toàn CN ÷ Tổng RM)

Ngưỡng cảnh báo = 30% × Điểm bình quân/RM
```

Trang hiển thị: điểm bình quân, ngưỡng cảnh báo, số/tỷ lệ RM bị cảnh báo, số RM cảnh báo theo
từng phòng, và bảng chi tiết từng RM (sắp xếp điểm thấp nhất lên đầu) kèm mức độ nghiêm trọng
(badge màu theo % so với bình quân: ≤10% đỏ, ≤20% cam, còn lại vàng).

## Đối chiếu Phòng bằng MÃ PHÒNG (không dùng tên phòng)

4 file CRM và file danh sách biên chế được đối chiếu theo **mã phòng**, không theo tên phòng —
tránh sai lệch do viết hoa/thường, thừa/thiếu dấu cách, hay cách viết tắt khác nhau giữa các
nguồn dữ liệu. Tên phòng chỉ dùng để hiển thị trên giao diện.

Hai định dạng mã phòng được tự động quy đổi về cùng một chuẩn:
- **4 file CRM** dùng mã 5 ký tự dạng `444xx` (cột "Mã phòng").
- **File biên chế PeopleSoft** thường dùng mã 9 ký tự dạng `0444xx000` (cột có tên chứa "Mã
  phòng", ví dụ "Mã phòng ban") — hệ thống tự cắt số 0 đầu và 3 số 0 cuối để quy về `444xx`.

Cột nhận diện RM trong file biên chế cũng được mở rộng, chấp nhận thêm `Email/AD`, `Email`, `AD`,
`Mã đăng nhập` bên cạnh các tên cột đã hỗ trợ trước đó.

**Chỉ tính trên RM có trong file biên chế — nhất quán ở CẢ 3 CẤP:** vì mục tiêu chương trình
thi đua là tính trên RM biên chế, hệ thống lọc bỏ hoàn toàn hoạt động của các RM không có tên
trong file biên chế **trước khi** cộng dồn — áp dụng cho cả điểm RM, điểm Phòng, và số liệu Chi
nhánh (kể cả mốc điểm bình quân ở tab Cảnh báo). Không phải chỉ ẩn RM lạ khỏi bảng xếp hạng cá
nhân mà vẫn cộng ngầm vào điểm Phòng — đóng góp của RM ngoài biên chế bị loại khỏi mọi con số.

## Tiêu chí công văn dùng SỐ LƯỢNG, không dùng tỷ lệ %

Cả công thức tính điểm và giao diện hiển thị đều dùng **số lượng tuyệt đối** Lead/Opp có tương
tác — đúng nguyên văn Mục 6.1 và 6.2 Công văn 7087 ("Số lượng Lead/Opp có thông tin tương tác,
tiếp cận"). Không có chỉ số tỷ lệ % nào được dùng trong công thức hay hiển thị trên bảng xếp
hạng, để tránh gây hiểu nhầm đây là một tiêu chí xét thưởng.



Mỗi file trong 5 file được xử lý **ngay trên trình duyệt** của admin thành một "partial" — số
liệu đã tổng hợp theo Phòng/RM (số lượng Lead, Opp, tỷ lệ...) — **trước khi** gửi lên server.
Partial này **không chứa** tên khách hàng, CIF, hay mã số thuế. Server chỉ lưu các partial đã ẩn
danh này, nên khi cần lấy lại dữ liệu của 4 file không đổi để gộp cùng 1 file mới, hệ thống lấy
lại đúng các partial đó — dữ liệu khách hàng gốc chưa từng và sẽ không bao giờ được lưu trên
server.

## Công thức tính điểm (đúng theo Công văn 7087)

**Điểm RM (cá nhân, Mục 6.2 công văn)** — dùng số tuyệt đối, không chia:
```
Điểm RM = 30% × (Lead/Opp có tương tác) + 30% × (Lead chuyển đổi sang Opp) + 40% × (Opp thành công)
```

**Điểm Phòng (Mục 6.1 công văn)** — công thức gốc có "…/RM", tức chia bình quân theo số RM biên
chế để so sánh công bằng giữa phòng đông người và phòng ít người:
```
Điểm Phòng = 30% × (Tổng Lead/Opp có tương tác ÷ Số RM) + 30% × (Tổng Lead chuyển đổi sang Opp ÷ Số RM)
           + 40% × (Tổng Opp thành công ÷ Số RM)
```
Số RM lấy từ file thứ 5 (danh sách biên chế PeopleSoft), **không** suy ra từ số RM có phát sinh
Lead/Opp trong kỳ — một phòng có RM không hoạt động vẫn phải chia đúng quy mô biên chế thật.

Nếu một phòng phát sinh Lead/Opp nhưng không có tên trong file biên chế (lệch dữ liệu, sai chính
tả tên phòng...), điểm của phòng đó hiển thị "—" thay vì một con số sai, và hệ thống cảnh báo rõ
trong màn hình xử lý để admin kiểm tra lại trước khi lưu.

**Xem lũy kế nhiều kỳ**: số liệu thô được cộng dồn qua các tháng đã chọn; Số RM dùng để chia lấy
bình quân các kỳ có dữ liệu biên chế (giả định biên chế ít biến động giữa các tháng liền kề).

## Bảo mật và hiệu năng đã áp dụng

> **Cần chạy lại `db/schema.sql` trong Neon SQL Editor một lần** (an toàn, dùng `IF NOT EXISTS`)
> để tạo thêm bảng `login_attempts` phục vụ chống dò mật khẩu bên dưới — nếu bỏ qua, trang quản
> trị vẫn hoạt động bình thường (tự bỏ qua bước kiểm tra khoá nếu bảng chưa tồn tại) nhưng sẽ
> chưa có lớp bảo vệ này.

- **Chống dò mật khẩu (brute-force):** đăng nhập sai quá 5 lần trong 15 phút từ cùng một IP sẽ bị
  khoá tạm 15 phút (bảng `login_attempts`, tự dọn dần qua thời gian). So sánh mật khẩu dùng
  `crypto.timingSafeEqual` (constant-time), tránh lộ thông tin qua độ trễ phản hồi.
- **HTTP security headers:** `X-Frame-Options: DENY` (chống nhúng iframe/clickjacking),
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (tắt camera/mic/vị
  trí không dùng đến) áp dụng cho toàn bộ site qua `next.config.js`.
- **Cache API công khai:** `/api/months` và `/api/data/*` cache 60 giây ở CDN của Vercel (kèm
  stale-while-revalidate 300 giây) — giảm số lần gọi thẳng vào Neon khi nhiều người cùng xem bảng
  xếp hạng. Nghĩa là sau khi admin lưu dữ liệu mới, có thể mất tới ~1 phút để trang công khai cập
  nhật (chấp nhận được vì dữ liệu chỉ đổi theo kỳ tháng, không cần tức thời).
- **Tải chậm (lazy-load) thư viện xlsx:** thư viện đọc Excel (~500KB) chỉ được tải khi admin thực
  sự bắt đầu xử lý file, không tải sẵn lúc vào trang — giảm dung lượng JS ban đầu của trang quản
  trị từ 115KB xuống còn ~4KB.

**Đã cân nhắc nhưng KHÔNG áp dụng:** chuyển font sang tự host bằng `next/font` (giảm 1 vòng kết
nối mạng ra Google Fonts) — vì môi trường build thử của tôi không có quyền truy cập
`fonts.googleapis.com` nên không tự kiểm chứng được thay đổi này có build thành công thật sự hay
không. Giữ nguyên cách tải qua thẻ `<link>` đã được kiểm chứng hoạt động ổn định, tránh rủi ro làm
hỏng bản deploy thật. Nếu muốn tối ưu thêm bước này, có thể thử `next/font/google` sau và tự build
thử trên máy có mạng đầy đủ trước khi deploy.

## Giới hạn cần lưu ý

- Đăng nhập admin dùng một mật khẩu dùng chung (không phải tài khoản cá nhân từng người) — phù
  hợp với quy mô một chi nhánh, không phù hợp nếu cần phân quyền nhiều admin có nhật ký riêng.
- File Excel được đọc và tính điểm ngay trên trình duyệt của admin; chỉ số liệu đã tổng hợp theo
  Phòng/RM (không có tên khách hàng/CIF/MST) mới được lưu vào Neon Postgres — kể cả khi dùng tính
  năng sửa từng file riêng lẻ.
- Điểm Phòng phụ thuộc vào chất lượng file danh sách biên chế RM (file #5) — nếu file này thiếu
  hoặc sai tên phòng so với 4 file CRM còn lại, điểm Phòng tương ứng sẽ hiển thị "—" thay vì một
  số liệu không chính xác.
