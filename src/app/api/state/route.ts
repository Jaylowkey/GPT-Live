import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
import { listEvents } from '@/lib/events';
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || '';
  const overlayOk = Boolean(process.env.OVERLAY_TOKEN && token === process.env.OVERLAY_TOKEN);
  if (!overlayOk && !(await isAuthenticated())) return NextResponse.json({ error:'Acesso negado.' }, { status:401 });
  const after = Math.max(0, Number(req.nextUrl.searchParams.get('after'))||0);
  return NextResponse.json({ events:listEvents(after) }, { headers:{ 'Cache-Control':'no-store' } });
}
