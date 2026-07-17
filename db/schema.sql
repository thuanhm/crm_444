-- Chạy file này trong Neon SQL Editor (hoặc bất kỳ công cụ Postgres nào) trước khi dùng
-- website. An toàn khi chạy lại nhiều lần (dùng IF NOT EXISTS).

-- Bảng lưu kết quả CUỐI CÙNG đã tính điểm của mỗi kỳ (dùng để hiển thị công khai).
CREATE TABLE IF NOT EXISTS thidua_data (
  month_key   TEXT PRIMARY KEY,        -- dạng 'YYYY-MM', vd '2026-08'
  label       TEXT NOT NULL,           -- nhãn hiển thị, vd 'Tháng 8/2026'
  phong       JSONB NOT NULL,          -- mảng điểm theo Phòng/PGD đã tính sẵn
  rm          JSONB NOT NULL,          -- mảng điểm theo cán bộ RM đã tính sẵn
  summary     JSONB NOT NULL,          -- số liệu tổng hợp toàn chi nhánh của kỳ
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thidua_data_uploaded_at ON thidua_data (uploaded_at DESC);

-- Bảng lưu "partial" của TỪNG file trong 5 file, để admin có thể sửa/tải lại một file riêng lẻ
-- mà không cần tải lại cả 5 file. Partial chỉ chứa số liệu đã tổng hợp theo Phòng/RM — KHÔNG
-- chứa tên khách hàng, CIF, hay mã số thuế.
CREATE TABLE IF NOT EXISTS thidua_partials (
  month_key   TEXT NOT NULL,
  file_type   TEXT NOT NULL CHECK (file_type IN ('lead_status', 'opp_status', 'lead_int', 'opp_int', 'roster')),
  partial     JSONB NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month_key, file_type)
);

-- Ghi lại các lần đăng nhập sai để chặn brute-force mật khẩu quản trị.
CREATE TABLE IF NOT EXISTS login_attempts (
  id SERIAL PRIMARY KEY,
  ip TEXT NOT NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON login_attempts (ip, attempted_at DESC);
