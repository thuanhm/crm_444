import { createSessionToken, setSessionCookie, passwordsMatch, getClientIp } from '../../lib/auth';
import { isLoginLocked, recordFailedLogin, clearFailedLogins } from '../../lib/db';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);

  try {
    if (await isLoginLocked(ip)) {
      return res.status(429).json({ error: 'Sai mật khẩu quá nhiều lần. Vui lòng thử lại sau 15 phút.' });
    }
  } catch (err) {
    console.error('isLoginLocked error:', err);
    // Không chặn đăng nhập nếu bảng chống brute-force gặp sự cố kết nối — tránh khoá cứng
    // toàn bộ tính năng quản trị chỉ vì một lỗi phụ trợ không liên quan đến mật khẩu.
  }

  const { password } = req.body || {};
  const realPassword = process.env.ADMIN_PASSWORD;

  if (!realPassword) {
    return res.status(500).json({ error: 'Server chưa cấu hình ADMIN_PASSWORD.' });
  }

  if (!passwordsMatch(password, realPassword)) {
    try {
      await recordFailedLogin(ip);
    } catch (err) {
      console.error('recordFailedLogin error:', err);
    }
    return res.status(401).json({ error: 'Mật khẩu không đúng.' });
  }

  try {
    await clearFailedLogins(ip);
  } catch (err) {
    console.error('clearFailedLogins error:', err);
  }

  const token = createSessionToken();
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true });
}
