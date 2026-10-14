'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type LiveEvent = {
  id: string;
  type: 'gift' | 'chat' | 'follow' | 'like' | 'share';
  username: string;
  giftName?: string;
  diamonds?: number;
  comment?: string;
  message?: string;
  createdAt: number;
};
type Team = 'blue' | 'red';
type Player = { username: string; team: Team; points: number };
const TEAM_KEYWORDS: Record<Team, string[]> = { blue: ['azul', 'blue'], red: ['vermelho', 'vermelha', 'red'] };

export default function ArenaPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [blueScore, setBlueScore] = useState(0);
  const [redScore, setRedScore] = useState(0);
  const [enabled, setEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [connection, setConnection] = useState<'checking' | 'connected' | 'error'>('checking');
  const [roundSeconds, setRoundSeconds] = useState(180);
  const [running, setRunning] = useState(false);
  const [lastAnnouncement, setLastAnnouncement] = useState('Bem-vindos à Arena! Comenta AZUL ou VERMELHO para escolher uma equipa.');
  const cursor = useRef(0);
  const seen = useRef(new Set<string>());
  const lastVoiceAt = useRef(0);
  const teamRef = useRef<Record<string, Player>>({});

  const announce = useCallback((text: string) => {
    setLastAnnouncement(text);
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const now = Date.now();
    if (now - lastVoiceAt.current < 3500) return;
    lastVoiceAt.current = now;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-PT';
    utterance.rate = 1.02;
    utterance.pitch = 0.82;
    const voices = window.speechSynthesis.getVoices();
    const portuguese = voices.filter(v => /^pt(-|_)/i.test(v.lang));
    const preferred = portuguese.find(v => /male|mascul|ant[oó]nio|daniel|jorge|ricardo|david/i.test(v.name));
    if (preferred || portuguese[0]) utterance.voice = preferred || portuguese[0];
    window.speechSynthesis.speak(utterance);
  }, [voiceEnabled]);

  const processEvent = useCallback((event: LiveEvent) => {
    const username = (event.username || 'Espectador').slice(0, 32);
    const key = username.toLowerCase();
    let assigned = teamRef.current[key]?.team;
    const comment = (event.comment || event.message || '').trim().toLowerCase();
    if (event.type === 'chat') {
      const picked: Team | undefined = TEAM_KEYWORDS.blue.some(k => comment === k || comment.startsWith(k + ' ')) ? 'blue'
        : TEAM_KEYWORDS.red.some(k => comment === k || comment.startsWith(k + ' ')) ? 'red' : undefined;
      if (picked) {
        assigned = picked;
        setPlayers(prev => {
          const next = { ...prev, [key]: { username, team: picked, points: prev[key]?.points || 0 } };
          teamRef.current = next;
          return next;
        });
        setEvents(prev => [{ ...event, comment: event.comment || event.message || (picked === 'blue' ? 'AZUL' : 'VERMELHO') }, ...prev].slice(0, 12));
        announce(picked === 'blue' ? username + ' entrou na equipa Azul! Equipa Azul, vamos lá!' : username + ' entrou na equipa Vermelha! Mostrem a vossa força!');
      }
      return;
    }
    if (!assigned) return;
    let points = 0;
    if (event.type === 'like') points = 1;
    if (event.type === 'gift') points = Math.max(5, Math.min(100, Math.ceil((event.diamonds || 1) / 5)));
    if (points > 0) {
      if (assigned === 'blue') setBlueScore(v => v + points);
      else setRedScore(v => v + points);
      setPlayers(prev => {
        const next = { ...prev, [key]: { ...prev[key], username, team: assigned!, points: (prev[key]?.points || 0) + points } };
        teamRef.current = next;
        return next;
      });
      if (event.type === 'gift') announce('Obrigado ' + username + ' pelo presente ' + (event.giftName || 'especial') + '! Mais pontos para a equipa ' + (assigned === 'blue' ? 'Azul' : 'Vermelha') + '!');
    }
    setEvents(prev => [event, ...prev].slice(0, 12));
  }, [announce]);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const poll = async () => {
      try {
        const r = await fetch('/api/state?after=' + cursor.current, { cache: 'no-store' });
        if (!r.ok) { if (alive) setConnection('error'); return; }
        const data = await r.json();
        if (!alive) return;
        setConnection('connected');
        const fresh: LiveEvent[] = data.events || [];
        for (const event of fresh) {
          const n = Number(event.id);
          if (Number.isFinite(n)) cursor.current = Math.max(cursor.current, n);
          if (!seen.current.has(event.id)) {
            seen.current.add(event.id);
            processEvent(event);
          }
        }
      } catch { if (alive) setConnection('error'); }
    };
    void poll();
    const timer = window.setInterval(poll, 1200);
    return () => { alive = false; window.clearInterval(timer); };
  }, [enabled, processEvent]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setRoundSeconds(s => {
      if (s <= 1) {
        setRunning(false);
        announce(blueScore === redScore ? 'Empate! As duas equipas foram incríveis!' : blueScore > redScore ? 'Vitória da equipa Azul! Parabéns, jogadores!' : 'Vitória da equipa Vermelha! Parabéns, jogadores!');
        return 0;
      }
      return s - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running, blueScore, redScore, announce]);

  const ranked = useMemo(() => Object.values(players).sort((a, b) => b.points - a.points).slice(0, 8), [players]);
  const formatTime = (seconds: number) => Math.floor(seconds / 60).toString().padStart(2, '0') + ':' + (seconds % 60).toString().padStart(2, '0');

  function demo(team: Team, type: LiveEvent['type']) {
    const name = team === 'blue' ? 'JogadorAzul' : 'JogadorVermelho';
    const id = 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    if (type === 'chat') {
      processEvent({ id, type, username: name, comment: team === 'blue' ? 'AZUL' : 'VERMELHO', createdAt: Date.now() });
      return;
    }
    if (!teamRef.current[name.toLowerCase()]) {
      const current = { ...teamRef.current, [name.toLowerCase()]: { username: name, team, points: 0 } };
      teamRef.current = current;
      setPlayers(prev => {
        const next = { ...prev, [name.toLowerCase()]: { username: name, team, points: 0 } };
        teamRef.current = next;
        return next;
      });
    }
    processEvent({ id, type, username: name, giftName: type === 'gift' ? 'Rosa' : undefined, diamonds: type === 'gift' ? 25 : undefined, createdAt: Date.now() });
  }

  function resetRound() {
    setBlueScore(0); setRedScore(0); setPlayers({}); teamRef.current = {}; setEvents([]); cursor.current = 0; seen.current.clear();
    setRoundSeconds(180); setRunning(false); announce('Placar reiniciado. Comenta AZUL ou VERMELHO para entrar no jogo!');
  }

  return <main style={{ minHeight: '100vh', padding: '28px 20px 48px', maxWidth: 1180, margin: '0 auto', color: '#f7f8ff' }}>
    <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap', marginBottom: 26 }}>
      <div><div style={{ color: '#a78bfa', fontSize: 11, letterSpacing: 3, fontWeight: 800 }}>GPT LIVE · MODO INTERATIVO</div><h1 style={{ fontSize: 'clamp(28px,5vw,46px)', margin: '8px 0 4px', letterSpacing: -1.5 }}>⚔️ Arena Azul vs. Vermelho</h1><p style={{ color: '#a9abc3', margin: 0, fontSize: 14 }}>Os comentários escolhem a equipa. Likes e presentes aumentam a pontuação.</p></div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ border: '1px solid #34364d', borderRadius: 20, padding: '9px 12px', fontSize: 12, color: connection === 'connected' ? '#6ee7b7' : '#fbbf24' }}>● {connection === 'connected' ? 'Painel ligado' : connection === 'error' ? 'Sem ligação ao estado' : 'A ligar…'}</span>
        <button onClick={() => setEnabled(v => !v)} style={btnStyle}>{enabled ? 'Pausar eventos' : 'Retomar eventos'}</button>
      </div>
    </header>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16 }}>
      <div style={{ ...teamStyle, borderColor: '#248cff66', background: 'linear-gradient(145deg,#122e55,#101726)' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#77bdff' }}>🔵 EQUIPA AZUL</div><div style={{ fontSize: 'clamp(44px,8vw,70px)', fontWeight: 900, margin: '8px 0' }}>{blueScore.toLocaleString('pt-PT')}</div><div style={{ color: '#b4c8e8', fontSize: 13 }}>{Object.values(players).filter(p => p.team === 'blue').length} jogadores</div>
      </div>
      <div style={{ ...teamStyle, borderColor: '#ff416b66', background: 'linear-gradient(145deg,#51182d,#20121e)' }}>
        <div style={{ fontSize: 12, letterSpacing: 2, color: '#ff91a9' }}>🔴 EQUIPA VERMELHA</div><div style={{ fontSize: 'clamp(44px,8vw,70px)', fontWeight: 900, margin: '8px 0' }}>{redScore.toLocaleString('pt-PT')}</div><div style={{ color: '#edb9c5', fontSize: 13 }}>{Object.values(players).filter(p => p.team === 'red').length} jogadores</div>
      </div>
      <div style={{ ...teamStyle, background: 'linear-gradient(145deg,#25213e,#151522)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ color: '#c4b5fd', fontSize: 12, letterSpacing: 2 }}>⏱️ TEMPO DE RONDA</div><div style={{ fontSize: 48, fontWeight: 900, margin: '8px 0' }}>{formatTime(roundSeconds)}</div><div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button style={btnStyle} onClick={() => { if (roundSeconds === 0) setRoundSeconds(180); setRunning(v => !v); }}>{running ? 'Pausar ronda' : 'Iniciar ronda'}</button><button style={btnStyle} onClick={resetRound}>Reiniciar</button></div>
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginTop: 16 }}>
      <div style={panelStyle}>
        <h2 style={h2Style}>📣 Como participar</h2>
        <div style={instructionStyle}><b>1.</b><span>Comenta <strong style={{ color: '#79baff' }}>AZUL</strong> ou <strong style={{ color: '#ff91a9' }}>VERMELHO</strong> para escolher uma equipa.</span></div>
        <div style={instructionStyle}><b>2.</b><span>Cada like recebido de um jogador inscrito vale <strong>+1 ponto</strong>.</span></div>
        <div style={instructionStyle}><b>3.</b><span>Presentes valem pontos extra (conforme os diamantes, até 100 pontos por presente).</span></div>
        <div style={{ marginTop: 14, color: '#9fa1bb', fontSize: 12, lineHeight: 1.6 }}>Nota: os likes e presentes contam para a equipa do espectador que já escolheu uma equipa no chat.</div>
      </div>
      <div style={panelStyle}>
        <h2 style={h2Style}>🧪 Testar sem LIVE</h2><p style={{ color: '#9fa1bb', fontSize: 12, marginTop: -5 }}>Estes botões simulam eventos no painel. Não enviam comentários reais ao TikTok.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button style={{ ...btnStyle, borderColor: '#248cff66', color: '#9ccfff' }} onClick={() => demo('blue','chat')}>Entrar Azul</button>
          <button style={{ ...btnStyle, borderColor: '#ff416b66', color: '#ff9bad' }} onClick={() => demo('red','chat')}>Entrar Vermelho</button>
          <button style={btnStyle} onClick={() => demo('blue','like')}>👍 Like Azul +1</button>
          <button style={btnStyle} onClick={() => demo('red','like')}>👍 Like Vermelho +1</button>
          <button style={btnStyle} onClick={() => demo('blue','gift')}>🎁 Presente Azul</button>
          <button style={btnStyle} onClick={() => demo('red','gift')}>🎁 Presente Vermelho</button>
        </div>
        <label style={{ display: 'flex', gap: 9, alignItems: 'center', marginTop: 16, color: '#c5c6d8', fontSize: 13 }}><input type="checkbox" checked={voiceEnabled} onChange={e => setVoiceEnabled(e.target.checked)} /> Anúncios de voz automáticos</label>
        <button style={{ ...btnStyle, width: '100%', marginTop: 10 }} onClick={() => announce('Atenção, espectadores! Comenta AZUL ou VERMELHO para entrar na batalha. Vamos começar!')}>🔊 Testar voz</button>
      </div>
    </section>

    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginTop: 16 }}>
      <div style={panelStyle}><h2 style={h2Style}>🏆 Melhores jogadores</h2>{ranked.length ? ranked.map((p, i) => <div key={p.username.toLowerCase()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #292b40', padding: '11px 0', gap: 10 }}><span>{['🥇','🥈','🥉'][i] || '⭐'} {p.username}</span><span style={{ color: p.team === 'blue' ? '#79baff' : '#ff91a9', fontWeight: 800 }}>{p.points} pts · {p.team === 'blue' ? 'Azul' : 'Vermelho'}</span></div>) : <p style={{ color: '#9fa1bb', fontSize: 13 }}>Ainda não há jogadores. Usa os botões de teste ou aguarda comentários na LIVE.</p>}</div>
      <div style={panelStyle}><h2 style={h2Style}>🎙️ Anúncio atual</h2><p style={{ lineHeight: 1.7, color: '#e2e4f5', minHeight: 54 }}>{lastAnnouncement}</p><h3 style={{ ...h2Style, marginTop: 22 }}>⚡ Eventos recentes</h3>{events.length ? events.slice(0, 7).map((e, i) => <div key={e.id + '-' + i} style={{ padding: '8px 0', borderBottom: '1px solid #292b40', fontSize: 12, color: '#bfc2d9' }}><strong style={{ color: '#f2f2ff' }}>{e.username}</strong> · {e.type === 'chat' ? 'comentário: ' + (e.comment || e.message || '') : e.type === 'like' ? 'enviou likes' : e.type === 'gift' ? 'enviou ' + (e.giftName || 'um presente') : e.type}</div>) : <p style={{ color: '#9fa1bb', fontSize: 13 }}>Os eventos aparecerão aqui.</p>}</div>
    </section>
    <footer style={{ color: '#747791', fontSize: 11, marginTop: 24, lineHeight: 1.6 }}>GPT Live Arena · O painel usa eventos do GPT Live. Para receber eventos reais no Vercel, é necessário configurar a ponte TikFinity e armazenamento persistente (o armazenamento atual em memória é apenas para testes). A voz é sintetizada no navegador deste computador; para ficar audível na LIVE, o áudio do computador tem de entrar na mistura da transmissão.</footer>
  </main>;
}

const btnStyle: React.CSSProperties = { background: '#ffffff08', border: '1px solid #393b54', borderRadius: 10, padding: '10px 12px', color: '#eef0ff', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
const teamStyle: React.CSSProperties = { border: '1px solid', borderRadius: 20, padding: 22, minHeight: 160, boxShadow: '0 12px 35px #00000018' };
const panelStyle: React.CSSProperties = { background: '#121321', border: '1px solid #292b40', borderRadius: 18, padding: 20 };
const h2Style: React.CSSProperties = { margin: '0 0 16px', fontSize: 17, letterSpacing: -.3 };
const instructionStyle: React.CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', margin: '14px 0', color: '#d6d8e8', fontSize: 13, lineHeight: 1.6 };
