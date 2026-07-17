// ⚠️ FILE DEBUG TẠM THỜI — XÓA SAU KHI KIỂM TRA XONG
// Truy cập: /api/debug-db để xem trạng thái database
import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(200).json({ error: 'DATABASE_URL chưa được set trong Vercel env vars' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Kiểm tra các bảng đang tồn tại
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    // Lấy host từ DATABASE_URL (ẩn password)
    const url = process.env.DATABASE_URL || '';
    const hostMatch = url.match(/@([^/]+)\//);
    const host = hostMatch ? hostMatch[1] : '(ẩn)';

    return res.status(200).json({
      host,
      tables: tables.map((t) => t.table_name),
      hasThiduaData: tables.some((t) => t.table_name === 'thidua_data'),
      hasThiduaPartials: tables.some((t) => t.table_name === 'thidua_partials'),
    });
  } catch (err) {
    return res.status(200).json({ error: err.message });
  }
}
