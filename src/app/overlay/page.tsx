'use client';
import { useEffect, useState } from 'react';
type GiftEvent = { id:string; username:string; giftName?:string; diamonds?:number; duration?:number; message?:string; createdAt:number };
export default function Overlay() {
 const [event,setEvent]=useState<GiftEvent|null>(null); const [text,setText]=useState('O teu nome pode brilhar aqui'); const [visible,setVisible]=useState(false);
 useEffect(()=>{let cursor=0;let alive=true;const poll=async()=>{try{const token=new URLSearchParams(location.search).get('token')||'';const r=await fetch(`/api/state?after=${cursor}&token=${encodeURIComponent(token)}`);if(!r.ok)return;const d=await r.json();if(d.events?.length&&alive){cursor=Math.max(cursor,...d.events.map((x:GiftEvent)=>Number(x.id)));const e=d.events[d.events.length-1];setEvent(e);setText(e.username);setVisible(true);window.setTimeout(()=>{if(alive)setVisible(false)},Math.max(3500,(e.duration||6)*1000));}}catch{}};const id=window.setInterval(poll,1000);return()=>{alive=false;clearInterval(id)}},[]);
 return <main className="overlay-shell"><div className={`paper ${visible?'active':''}`}><div className="paper-top">✧  UMA HOMENAGEM ESPECIAL  ✧</div><div className="ink-name">{text}</div><div className="ink-underline"/><p className="paper-message">{event?`${event.giftName||'Presente'} · obrigado pelo carinho!`:'Obrigado por fazer parte da live'}</p><div className="pen-tip">✒</div><div className="paper-spark spark-a">✦</div><div className="paper-spark spark-b">✧</div></div><div className="overlay-watermark">GPT LIVE · APRESENTADOR IA</div></main>
}
