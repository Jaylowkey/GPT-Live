import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/session';
export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: 'Sessão não autorizada.' }, { status: 401 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'Falta configurar OPENAI_API_KEY no servidor.' }, { status: 503 });
  const body = await req.json().catch(() => ({}));
  const username = String(body.username || 'amigo').replace(/[<>\n\r]/g, '').slice(0, 32);
  const giftName = String(body.giftName || 'presente').slice(0, 40);
  const diamonds = Math.max(0, Math.min(1000000, Number(body.diamonds) || 0));
  const personality = String(body.personality || 'Divertida e energética').slice(0, 80);
  const prompt = `És um apresentador de TikTok LIVE divertido, energético e simpático. Fala português natural usado em Moçambique, sem exagerar no sotaque. Personalidade: ${personality}. Cria UMA única frase curta (máximo 18 palavras) para agradecer a ${username} pelo presente ${giftName}. Valor indicado: ${diamonds} diamantes. Não inventes factos, não peças mais presentes, não faças promessas. Só a frase, sem aspas.`;
  try {
    const r = await fetch('https://api.openai.com/v1/responses', { method:'POST', headers:{ Authorization:`Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type':'application/json' }, body:JSON.stringify({ model:process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini', input:prompt, max_output_tokens:90 }), signal:AbortSignal.timeout(20000) });
    const data = await r.json(); if (!r.ok) return NextResponse.json({ error: data.error?.message || 'Falha na OpenAI API.' }, { status:r.status });
    const text = String(data.output_text || data.output?.flatMap((x:any)=>x.content||[]).map((x:any)=>x.text||'').join(' ') || '').trim().slice(0,240);
    return NextResponse.json({ text: text || `Obrigado, ${username}, pelo presente ${giftName}! És incrível!` });
  } catch { return NextResponse.json({ error:'Não foi possível contactar a OpenAI. Tenta novamente.' }, { status:502 }); }
}
