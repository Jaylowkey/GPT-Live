import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'gpt_live_session';
function secret() { return process.env.SESSION_SECRET || 'development-only-secret-change-me'; }
export function createSessionToken() {
  const payload = `${Date.now() + 1000 * 60 * 60 * 24 * 7}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${payload}.${sig}`;
}
export function verifySessionToken(token?: string) {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || Number(payload) < Date.now()) return false;
  const expected = createHmac('sha256', secret()).update(payload).digest('hex');
  try { return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)); } catch { return false; }
}
export async function isAuthenticated() {
  const jar = await cookies();
  return verifySessionToken(jar.get(COOKIE)?.value);
}
export const sessionCookieName = COOKIE;
