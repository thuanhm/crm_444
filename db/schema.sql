-- Chạy file này MỘT LẦN trong Neon SQL Editor (hoặc bất kỳ công cụ Postgres nào bạn dùng
-- để kết nối tới Neon) trước khi dùng website. Tạo bảng lưu điểm thi đua CRM1.0 theo từng kỳ.

CREATE TABLE IF NOT EXISTS thidua_data (
  month_key   TEXT PRIMARY KEY,        -- dạng 'YYYY-MM', vd '2026-08'
  label       TEXT NOT NULL,           -- nhãn hiển thị, vd 'Tháng 8/2026'
  phong       JSONB NOT NULL,          -- mảng điểm theo Phòng/PGD đã tính sẵn
  rm          JSONB NOT NULL,          -- mảng điểm theo cán bộ RM đã tính sẵn
  summary     JSONB NOT NULL,          -- số liệu tổng hợp toàn chi nhánh của kỳ
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chỉ mục phụ trợ để tra cứu nhanh theo thời gian tải lên (không bắt buộc nhưng hữu ích).
CREATE INDEX IF NOT EXISTS idx_thidua_data_uploaded_at ON thidua_data (uploaded_at DESC);
