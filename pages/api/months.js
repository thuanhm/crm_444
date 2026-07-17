import { getMonths } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const months = await getMonths();
    return res.status(200).json({ months });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Không đọc được danh sách kỳ. Kiểm tra kết nối Postgres (DATABASE_URL) và bảng thidua_data.' });
  }
}
