import { NextRequest, NextResponse } from 'next/server';
import { addEvent } from '@/lib/events';
export async function POST(req: NextRequest) {
  const expected = process.env.EVENTS_TOKEN;
  if (!expected || req.headers.get('x-events-token') !== expected) return NextResponse.json({ error:'Evento não autorizado.' }, { status:401 });
  const body = await req.json().catch(() => ({}));
  const type = ['gift','chat','follow','like','share'].includes(body.type) ? body.type : null;
  if (!type) return NextResponse.json({ error:'Tipo de evento inválido.' }, { status:400 });
  const username = String(body.username || 'Espectador').replace(/[<>\n\r]/g,'').slice(0,32);
  const giftName = body.giftName ? String(body.giftName).slice(0,40) : undefined;
  const diamonds = Math.max(0, Math.min(1000000, Number(body.diamonds)||0));
  const duration = Math.max(3, Math.min(45, Number(body.duration)|| (diamonds >= 1000 ? 16 : diamonds >= 100 ? 9 : 4)));
  return NextResponse.json({ ok:true, event:addEvent({ type, username, giftName, diamonds, duration, comment:body.comment ? String(body.comment).slice(0,180) : undefined }) });
}
