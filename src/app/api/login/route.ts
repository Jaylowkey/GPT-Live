import { NextRequest, NextResponse } from 'next/server';
import { createSessionToken, sessionCookieName } from '@/lib/session';
export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));
  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected) return NextResponse.json({ error: 'Configura DASHBOARD_PASSWORD no ambiente do servidor.' }, { status: 503 });
  if (typeof password !== 'string' || password.length > 200 || password !== expected) return NextResponse.json({ error: 'Palavra-passe incorreta.' }, { status: 401 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookieName, createSessionToken(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 60*60*24*7 });
  return res;
}
export async function DELETE() { const res = NextResponse.json({ ok: true }); res.cookies.set(sessionCookieName, '', { httpOnly:true, secure:process.env.NODE_ENV==='production', sameSite:'strict', path:'/', maxAge:0 }); return res; }
