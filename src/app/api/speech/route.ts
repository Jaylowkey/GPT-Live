import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
const voices = new Set(['onyx','echo','alloy','ash','fable','nova','sage','marin','cedar','coral','shimmer','verse']);
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error:'Sessão não autorizada.' }, { status:401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error:'Falta configurar OPENAI_API_KEY no servidor.' }, { status:503 });
  const body = await req.json().catch(() => ({})); const text = String(body.text || '').trim().slice(0,500); const voice = voices.has(body.voice) ? body.voice : (process.env.OPENAI_TTS_VOICE || 'onyx');
  if (!text) return NextResponse.json({ error:'Texto vazio.' }, { status:400 });
  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', { method:'POST', headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model:process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts', voice, input:text, instructions:'Fala em português com voz masculina, divertida, energética e clara. Ritmo natural, com entusiasmo moderado, sem gritar.' }), signal:AbortSignal.timeout(30000) });
    if (!r.ok) { const d = await r.json().catch(()=>({})); return NextResponse.json({ error:d.error?.message || 'Falha ao gerar voz.' }, { status:r.status }); }
    return new NextResponse(await r.arrayBuffer(), { headers:{ 'Content-Type':'audio/mpeg', 'Cache-Control':'no-store' } });
  } catch { return NextResponse.json({ error:'Timeout ao gerar voz.' }, { status:502 }); }
}
