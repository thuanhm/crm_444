import crypto from 'crypto';

const SECRET = process.env.SESSION_SECRET || 'dev-only-insecure-secret-change-me';
const MAX_AGE_SECONDS = 12 * 60 * 60; // 12 giờ

function sign(value) {
  return crypto.createHmac('sha256', SECRET).update(value).digest('base64url');
}

// So sánh mật khẩu theo thời gian hằng định (constant-time) để tránh lộ thông tin qua độ trễ
// phản hồi (timing attack). Băm cả 2 chuỗi về cùng độ dài cố định trước khi so sánh, vì
// crypto.timingSafeEqual yêu cầu 2 buffer bằng độ dài.
export function passwordsMatch(input, real) {
  if (!input || !real) return false;
  const a = crypto.createHash('sha256').update(input).digest();
  const b = crypto.createHash('sha256').update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

export function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

export function createSessionToken() {
  const payload = Buffer.from(JSON.stringify({ role: 'admin', iat: Date.now() })).toString('base64url');
  const sig = sign(payload);
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = sign(payload);
  if (expected.length !== sig.length) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() - data.iat > MAX_AGE_SECONDS * 1000) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

export function requireAdmin(req, res) {
  const token = req.cookies?.session;
  if (!verifySessionToken(token)) {
    res.status(401).json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn.' });
    return false;
  }
  return true;
}
