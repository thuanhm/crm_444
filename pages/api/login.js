import { createSessionToken, setSessionCookie } from '../../lib/auth';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body || {};
  const realPassword = process.env.ADMIN_PASSWORD;

  if (!realPassword) {
    return res.status(500).json({ error: 'Server chưa cấu hình ADMIN_PASSWORD.' });
  }

  if (!password || password !== realPassword) {
    return res.status(401).json({ error: 'Mật khẩu không đúng.' });
  }

  const token = createSessionToken();
  setSessionCookie(res, token);
  return res.status(200).json({ ok: true });
}
