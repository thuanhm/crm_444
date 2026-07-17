// ⚠️ FILE MIGRATION TẠM THỜI — XÓA SAU KHI CHẠY XONG
// Truy cập: /api/run-migration để tạo bảng thidua_partials trong database đang dùng
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  // Chỉ cho phép POST để tránh chạy nhầm
  if (req.method !== 'POST') {
    return res.status(200).json({
      info: 'Gửi POST request tới endpoint này để chạy migration.',
      example: 'curl -X POST https://your-app.vercel.app/api/run-migration',
    });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ error: 'DATABASE_URL chưa được set.' });
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`
      CREATE TABLE IF NOT EXISTS thidua_partials (
        month_key   TEXT NOT NULL,
        file_type   TEXT NOT NULL CHECK (file_type IN ('lead_status', 'opp_status', 'lead_int', 'opp_int', 'roster')),
        partial     JSONB NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (month_key, file_type)
      )
    `;

    // Xác nhận bảng đã tạo thành công
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' ORDER BY table_name
    `;

    return res.status(200).json({
      ok: true,
      message: 'Migration thành công! Bảng thidua_partials đã được tạo.',
      tables: tables.map((t) => t.table_name),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
