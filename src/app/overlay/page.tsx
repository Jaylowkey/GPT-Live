'use client';
import { useEffect, useState } from 'react';
type LiveEvent = { id:string; type?:'gift'|'chat'|'follow'|'like'|'share'; username:string; giftName?:string; diamonds?:number; duration?:number; message?:string; createdAt:number };
type FloatingLike = { id:string; username:string; left:number };
const particles = Array.from({ length: 28 }, (_, i) => i);
const callsToAction = [
 '🎁 Envia um presente e vê o teu nome brilhar na tela!',
 '✨ Cada presente torna esta LIVE ainda mais especial.',
 '💛 Gostaste da live? Demonstra o teu carinho com um presente!',
 '🌟 Oferece uma rosa e recebe uma homenagem especial!',
 '👑 Os maiores presentes desbloqueiam efeitos dourados especiais!'
];
export default function Overlay() {
 const [event,setEvent]=useState<LiveEvent|null>(null);
 const [text,setText]=useState('A tua estrela pode brilhar aqui');
 const [visible,setVisible]=useState(false);
 const [ctaIndex,setCtaIndex]=useState(0);
 const [floatingLikes,setFloatingLikes]=useState<FloatingLike[]>([]);
 useEffect(()=>{
  const ctaTimer=window.setInterval(()=>setCtaIndex(i=>(i+1)%callsToAction.length),6500);
  let cursor=0;
  let alive=true;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;
  const likeTimers: ReturnType<typeof setTimeout>[] = [];
  const poll=async()=>{
   try {
    const token=new URLSearchParams(location.search).get('token')||'';
    const r=await fetch(`/api/state?after=${cursor}&token=${encodeURIComponent(token)}`,{cache:'no-store'});
    if(!r.ok)return;
    const d=await r.json();
    if(d.events?.length&&alive){
     const events:LiveEvent[]=d.events;
     cursor=Math.max(cursor,...events.map((x)=>Number(x.id)));
     // Cada like cria um nome flutuante independente, tal como os likes do TikTok.
     const likes=events.filter((x)=>x.type==='like');
     likes.forEach((like)=>{
      const floater={id:`like-${like.id}`,username:like.username,left:8+((Number(like.id)*37)%82)};
      setFloatingLikes((previous)=>[...previous.slice(-11),floater]);
      const timer=window.setTimeout(()=>{
       if(alive)setFloatingLikes((previous)=>previous.filter((item)=>item.id!==floater.id));
      },3300);
      likeTimers.push(timer);
     });
     // Só os presentes devem abrir a homenagem central; likes não substituem o nome do presenteador.
     const gifts=events.filter((x)=>x.type==='gift'||!x.type);
     if(gifts.length){
      const e=gifts[gifts.length-1];
      setEvent(e);
      setText(e.username);
      setVisible(true);
      if(hideTimer)clearTimeout(hideTimer);
      hideTimer=window.setTimeout(()=>{if(alive)setVisible(false)},Math.max(4500,(e.duration||6)*1000));
     }
    }
   } catch {}
  };
  const id=window.setInterval(poll,1000);
  return()=>{alive=false;clearInterval(id);clearInterval(ctaTimer);if(hideTimer)clearTimeout(hideTimer);likeTimers.forEach(clearTimeout)};
 },[]);
 const bigGift=(event?.diamonds||0)>=100;
 return <main className={`overlay-shell ${visible?'overlay-live':''} ${bigGift&&visible?'big-gift':''}`}>
  <div className="effect-glow glow-one"/>
  <div className="effect-glow glow-two"/>
  <div className="effect-particles" aria-hidden="true">
   {particles.map(i=><span key={i} style={{left:`${(i*37+3)%100}%`,animationDuration:`${2.4+(i%5)*.45}s`,animationDelay:`${(i%8)*.12}s`}}>{i%4===0?'✦':i%4===1?'✧':i%4===2?'·':'✺'}</span>)}
  </div>
  <div className="floating-likes-layer" aria-live="polite" aria-label="Likes recentes">
   {floatingLikes.map((like)=><div className="floating-like" key={like.id} style={{left:`${like.left}%`}}>
    <span className="floating-like-heart">♥</span><strong>{like.username}</strong>
   </div>)}
  </div>
  <section className={`overlay-content ${visible?'event-showing':''}`}>
   <div className={`paper ${visible?'active':'idle'}`}>
    <div className="paper-top">✧  GPT LIVE · HOMENAGENS ESPECIAIS  ✧</div>
    <div className="ink-name" key={event?.id||'welcome'}>{text}</div>
    <div className="ink-underline"/>
    <p className="paper-message">{visible&&event?(`${event.giftName||'Presente'} · obrigado, ${event.username}, pelo carinho!`):'A próxima homenagem pode ser tua!'}</p>
    <div className="pen-tip">✒</div>
    <div className="paper-spark spark-a">✦</div>
    <div className="paper-spark spark-b">✧</div>
    <div className="paper-spark spark-c">✧</div>
   </div>
   <div className="gift-cta" key={ctaIndex}>
    <span className="cta-star">✦</span>
    <div className="cta-copy">
     <strong>{callsToAction[ctaIndex]}</strong>
     <span>Envia um presente para apareceres na homenagem da LIVE</span>
    </div>
    <span className="cta-gift">🎁</span>
   </div>
   <div className="gift-levels">
    <span>🌹 Rosa</span><i>✦</i><span>💎 Diamante</span><i>✦</i><span>👑 Presente especial</span>
   </div>
  </section>
  <div className="overlay-watermark">GPT LIVE · A TUA PRESENÇA FAZ A DIFERENÇA</div>
 </main>;
}
