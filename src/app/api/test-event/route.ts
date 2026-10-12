import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
import { addEvent } from '@/lib/events';
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error:'Sessão não autorizada.' }, { status:401 });
  const b = await req.json().catch(() => ({}));
  return NextResponse.json({ ok:true, event:addEvent({ type:'gift', username:String(b.username||'Espectador').replace(/[<>\n\r]/g,'').slice(0,32), giftName:String(b.giftName||'Rosa').slice(0,40), diamonds:Math.max(0,Math.min(1000000,Number(b.diamonds)||0)), duration:Math.max(3,Math.min(45,Number(b.duration)||5)), message:String(b.personality||'').slice(0,80) }) });
}
