import { verifySessionToken } from '../../lib/auth';

export default async function handler(req, res) {
  const token = req.cookies?.session;
  return res.status(200).json({ authed: verifySessionToken(token) });
}
