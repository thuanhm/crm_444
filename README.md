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
- **Trang quản trị (`/admin`)**: đăng nhập bằng `ADMIN_PASSWORD`, chọn tháng áp dụng, tải đủ **5**
  file Excel theo đúng thứ tự:
  1. Báo cáo trạng thái Lead
  2. Báo cáo trạng thái OPP
  3. Tiếp cận tương tác Lead
  4. Tiếp cận tương tác OPP
  5. **Danh sách RM biên chế theo phòng** (trích từ PeopleSoft) — cần có cột `Tên phòng` và một
     cột định danh RM (chấp nhận các tên: `RM quản lý`, `RM`, `Mã CB`, `Mã cán bộ`, `Mã nhân viên`,
     `User RM`, `Username`, `User name` — hệ thống tự nhận diện cột đầu tiên khớp).

  Sau khi bấm "Xử lý số liệu" để xem trước, bấm "Lưu vào bảng xếp hạng" để công bố. Có thể xóa dữ
  liệu một kỳ bất kỳ nếu cần sửa lại.

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

## Giới hạn cần lưu ý

- Đăng nhập admin dùng một mật khẩu dùng chung (không phải tài khoản cá nhân từng người) — phù
  hợp với quy mô một chi nhánh, không phù hợp nếu cần phân quyền nhiều admin có nhật ký riêng.
- File Excel được đọc và tính điểm ngay trên trình duyệt của admin (không gửi file thô lên
  server), chỉ kết quả đã tính (JSON, lưu vào cột JSONB) được ghi vào Neon Postgres.
- Điểm Phòng phụ thuộc vào chất lượng file danh sách biên chế RM (file #5) — nếu file này thiếu
  hoặc sai tên phòng so với 4 file CRM còn lại, điểm Phòng tương ứng sẽ hiển thị "—" thay vì một
  số liệu không chính xác.
