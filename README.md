# GPT Live — starter privado

Mobile-first dashboard + calligraphy overlay + protected OpenAI text/TTS endpoints.

## O que já está preparado
- Painel privado com password e cookie HttpOnly.
- Voz por OpenAI API no servidor (a chave não vai para o navegador).
- Personalidade divertida em português e teste de voz.
- Simulação de presentes com duração por categoria.
- Overlay `/overlay` para testar a homenagem.
- Endpoint de entrada de eventos `POST /api/events` com `x-events-token`.
- Endpoint de estado para overlay protegido por `OVERLAY_TOKEN`.

## Limitação importante antes de produção
O store de eventos está em memória e serve apenas para testes locais. Em Vercel/serverless, instâncias diferentes não partilham memória; antes de usar em lives reais, substitua `src/lib/events.ts` por Supabase Realtime/Redis ou outro canal persistente. Não é seguro assumir que o TikFinity Mobile envia eventos para este endpoint: a API WebSocket pública documentada pelo TikFinity é `ws://localhost:21213/` e exige a aplicação desktop no mesmo computador. Para funcionamento automático só com telemóvel, é necessário confirmar um conector que disponibilize eventos externos/webhooks suportados.

## Requisitos
- Node.js 20.9+ recomendado
- npm

## Configuração local
1. Copie `.env.example` para `.env.local`.
2. Defina `DASHBOARD_PASSWORD`, `SESSION_SECRET` (32+ caracteres), `EVENTS_TOKEN`, `OVERLAY_TOKEN` e `OPENAI_API_KEY`.
3. `npm install`
4. `npm run dev`
5. Abra `http://localhost:3000`.

Para testar o overlay, abra `/overlay?token=VALOR_DO_OVERLAY_TOKEN`.

## Testar endpoint de evento (apenas servidor local)
```bash
curl -X POST http://localhost:3000/api/events \
  -H 'Content-Type: application/json' \
  -H 'x-events-token: VALOR_DE_EVENTS_TOKEN' \
  -d '{"type":"gift","username":"Maria","giftName":"Rosa","diamonds":1,"duration":4}'
```

## Segurança antes de publicar
- Nunca commitar `.env.local` nem colocar a OpenAI key no frontend.
- Use segredos aleatórios diferentes para sessão, eventos e overlay.
- Adicione rate limiting e persistência/Realtime para produção.
- Configure autenticação e CORS/origem conforme o conector escolhido.
- Mostre/disclose que a voz é gerada por IA quando aplicável.
- O áudio de teste é reproduzido no dispositivo que abriu o painel. Para sair na live, é preciso encaminhar o áudio ao mixer/stream do TikTok; o navegador do telemóvel não consegue misturar automaticamente o áudio do painel com a transmissão TikTok nativa.
