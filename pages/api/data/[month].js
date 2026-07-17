import { getMonthData, getAllMonthsData, setMonthData, deleteMonthData } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';
import { monthLabel, combineData } from '../../../lib/aggregate';

export default async function handler(req, res) {
  const { month } = req.query;

  if (!month || typeof month !== 'string') {
    return res.status(400).json({ error: 'Thiếu tham số tháng.' });
  }

  if (req.method === 'GET') {
    try {
      if (month === '__all__') {
        const all = await getAllMonthsData();
        const combined = combineData(all);
        return res.status(200).json({ data: combined });
      }
      const data = await getMonthData(month);
      return res.status(200).json({ data });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Không đọc được dữ liệu. Kiểm tra kết nối Postgres (DATABASE_URL) và bảng thidua_data.' });
    }
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return; // requireAdmin đã tự trả response 401 nếu thất bại
    try {
      const payload = req.body;
      if (!payload || !Array.isArray(payload.phong) || !Array.isArray(payload.rm)) {
        return res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' });
      }
      await setMonthData(month, monthLabel(month), payload);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Không lưu được dữ liệu. Kiểm tra kết nối Postgres (DATABASE_URL) và bảng thidua_data.' });
    }
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return;
    try {
      await deleteMonthData(month);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Không xóa được dữ liệu. Kiểm tra kết nối Postgres (DATABASE_URL) và bảng thidua_data.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
  return res.status(405).json({ error: 'Method not allowed' });
}
