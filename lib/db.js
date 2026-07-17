// Lưu trữ dữ liệu thi đua CRM1.0 bằng Neon Postgres.
// Dùng @neondatabase/serverless — driver HTTP nhẹ, phù hợp với Vercel Serverless Functions
// (không cần quản lý connection pool như driver `pg` truyền thống).
import { neon } from '@neondatabase/serverless';

// Khởi tạo trì hoãn (lazy) để lỗi thiếu DATABASE_URL được bắt gọn gàng bên trong try/catch
// của từng API route (trả JSON rõ ràng) thay vì làm sập cả module ngay lúc import.
let _sql = null;
function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        'Thiếu biến môi trường DATABASE_URL. Kiểm tra lại Settings > Environment Variables trên Vercel, hoặc xem mục "Gắn Neon Postgres Database" trong README.'
      );
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// Danh sách kỳ đã có dữ liệu, sắp theo thứ tự tháng tăng dần.
export async function getMonths() {
  const sql = getSql();
  const rows = await sql`
    SELECT month_key AS key, label
    FROM thidua_data
    ORDER BY month_key ASC
  `;
  return rows;
}

// Dữ liệu chi tiết một kỳ (hoặc null nếu chưa có).
export async function getMonthData(key) {
  const sql = getSql();
  const rows = await sql`
    SELECT phong, rm, summary, uploaded_at AS "uploadedAt"
    FROM thidua_data
    WHERE month_key = ${key}
  `;
  return rows[0] || null;
}

// Toàn bộ dữ liệu các kỳ, dùng cho chế độ xem "Lũy kế tất cả các kỳ".
export async function getAllMonthsData() {
  const sql = getSql();
  const rows = await sql`
    SELECT phong, rm, summary
    FROM thidua_data
    ORDER BY month_key ASC
  `;
  return rows;
}

// Lưu (thêm mới hoặc ghi đè) dữ liệu một kỳ.
export async function setMonthData(key, label, data) {
  const sql = getSql();
  await sql`
    INSERT INTO thidua_data (month_key, label, phong, rm, summary, uploaded_at)
    VALUES (${key}, ${label}, ${JSON.stringify(data.phong)}, ${JSON.stringify(data.rm)}, ${JSON.stringify(data.summary)}, now())
    ON CONFLICT (month_key) DO UPDATE
    SET label = EXCLUDED.label,
        phong = EXCLUDED.phong,
        rm = EXCLUDED.rm,
        summary = EXCLUDED.summary,
        uploaded_at = now()
  `;
}

export async function deleteMonthData(key) {
  const sql = getSql();
  await sql`DELETE FROM thidua_data WHERE month_key = ${key}`;
  await sql`DELETE FROM thidua_partials WHERE month_key = ${key}`;
}

// ===== Chống brute-force mật khẩu đăng nhập =====
const LOGIN_WINDOW_MINUTES = 15;
const LOGIN_MAX_ATTEMPTS = 5;

// Trả về true nếu IP này đang bị khoá (quá nhiều lần đăng nhập sai gần đây).
export async function isLoginLocked(ip) {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS cnt
    FROM login_attempts
    WHERE ip = ${ip} AND attempted_at > now() - (${LOGIN_WINDOW_MINUTES} || ' minutes')::interval
  `;
  return (rows[0]?.cnt || 0) >= LOGIN_MAX_ATTEMPTS;
}

export async function recordFailedLogin(ip) {
  const sql = getSql();
  await sql`INSERT INTO login_attempts (ip) VALUES (${ip})`;
}

export async function clearFailedLogins(ip) {
  const sql = getSql();
  await sql`DELETE FROM login_attempts WHERE ip = ${ip}`;
}

// ===== Partials (số liệu đã tổng hợp theo từng file, không chứa tên KH/CIF/MST) =====

// Lấy toàn bộ partial đã có của một kỳ, dạng { lead_status: {...}|undefined, opp_status: ..., ... }
// kèm thời điểm tải lên của từng partial.
export async function getPartials(key) {
  const sql = getSql();
  const rows = await sql`
    SELECT file_type, partial, uploaded_at AS "uploadedAt"
    FROM thidua_partials
    WHERE month_key = ${key}
  `;
  const result = {};
  rows.forEach((r) => {
    result[r.file_type] = { data: r.partial, uploadedAt: r.uploadedAt };
  });
  return result;
}

export async function setPartial(key, fileType, partial) {
  const sql = getSql();
  await sql`
    INSERT INTO thidua_partials (month_key, file_type, partial, uploaded_at)
    VALUES (${key}, ${fileType}, ${JSON.stringify(partial)}, now())
    ON CONFLICT (month_key, file_type) DO UPDATE
    SET partial = EXCLUDED.partial, uploaded_at = now()
  `;
}
