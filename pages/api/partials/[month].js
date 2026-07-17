import { getPartials, setPartial } from '../../../lib/db';
import { requireAdmin } from '../../../lib/auth';

const VALID_TYPES = ['lead_status', 'opp_status', 'lead_int', 'opp_int', 'roster'];

export default async function handler(req, res) {
  const { month } = req.query;
  if (!month || typeof month !== 'string') {
    return res.status(400).json({ error: 'Thiếu tham số tháng.' });
  }

  // Toàn bộ thao tác với partials chỉ dành cho admin — đây là dữ liệu vận hành nội bộ,
  // không phải nội dung công khai (khác với /api/data/[month] dùng cho bảng xếp hạng).
  if (!requireAdmin(req, res)) return;

  if (req.method === 'GET') {
    try {
      const partials = await getPartials(month);
      return res.status(200).json({ partials });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Không đọc được dữ liệu đã tải trước đó. Kiểm tra kết nối Postgres.' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { fileType, partial } = req.body || {};
      if (!VALID_TYPES.includes(fileType) || !partial) {
        return res.status(400).json({ error: 'Dữ liệu gửi lên không hợp lệ.' });
      }
      await setPartial(month, fileType, partial);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Không lưu được dữ liệu. Kiểm tra kết nối Postgres.' });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({ error: 'Method not allowed' });
}
