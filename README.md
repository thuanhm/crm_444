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

### 1) Đẩy code lên GitHub

```bash
cd crm-thi-dua
git init
git add .
git commit -m "Khoi tao website thi dua CRM1.0"
git branch -M main
git remote add origin https://github.com/<ten-tai-khoan>/<ten-repo>.git
git push -u origin main
```

### 2) Tạo project trên Vercel

1. Đăng nhập [vercel.com](https://vercel.com) bằng tài khoản GitHub.
2. **Add New → Project**, chọn repo vừa đẩy lên.
3. Vercel tự nhận diện Next.js, để nguyên cấu hình mặc định, bấm **Deploy** lần đầu
   (sẽ báo lỗi thiếu biến môi trường/DATABASE_URL — không sao, xử lý ở bước 3–4 rồi deploy lại).

### 3) Gắn Neon Postgres Database

1. Trong project trên Vercel → tab **Storage** → **Browse Storage** (hoặc **Create Database**).
2. Trong mục **Marketplace Database Providers**, chọn **Neon** (dòng "Serverless Postgres").
3. Nếu đã có tài khoản Neon, Vercel sẽ cho đăng nhập/liên kết tài khoản đó; nếu chưa, hệ thống
   tự tạo giúp.
4. Chọn **project Neon có sẵn** (nếu đã có) hoặc tạo project/database mới, chọn khu vực gần Việt
   Nam nhất (Singapore — `ap-southeast-1`), bấm **Create/Connect**.
5. Ở bước **Connect Project**, chọn đúng project Vercel (`crm_444` hoặc tên repo anh đã đặt) —
   Vercel tự thêm biến môi trường `DATABASE_URL` vào project, không cần tự nhập.
6. **Tạo bảng dữ liệu (chỉ làm một lần):** vào Neon Dashboard → chọn database vừa tạo →
   **SQL Editor**, dán toàn bộ nội dung file `db/schema.sql` trong project này vào, bấm **Run**.
   Việc này tạo bảng `thidua_data` để lưu điểm — nếu bỏ qua bước này, website sẽ báo lỗi "Không
   đọc được dữ liệu" khi mở trang.

### 4) Thêm biến môi trường còn lại

Vào **Settings → Environment Variables**, thêm cho cả 3 môi trường (Production/Preview/Development):

| Tên biến | Giá trị |
|---|---|
| `ADMIN_PASSWORD` | Mật khẩu quản trị bạn tự chọn, càng khó đoán càng tốt |
| `SESSION_SECRET` | Một chuỗi ngẫu nhiên dài (vd. chạy `openssl rand -hex 32`) |

### 5) Deploy lại

Vào tab **Deployments**, bấm **Redeploy** cho lần deploy mới nhất (hoặc chỉ cần `git push` một
commit mới, Vercel tự build lại). Từ giờ mỗi lần `git push` lên nhánh `main`, Vercel tự động
build và deploy phiên bản mới, có sẵn URL dạng `https://<ten-project>.vercel.app`.

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
