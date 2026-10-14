'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

type LivePlayer = { username: string; lane: number; progress: number; points: number; color: number; avatar: THREE.Group; label: THREE.Sprite; lastBoost: number };
type TikFinityMessage = { event?: string; data?: Record<string, unknown> };

const BLUE = 0x36a3ff;
const RED = 0xff416b;
const cleanName = (v: unknown) => String(v ?? 'Espectador').replace(/[<>\r\n]/g, '').slice(0, 24);
const textValue = (d: Record<string, unknown>, ...keys: string[]) => {
  for (const k of keys) if (d[k] !== undefined && d[k] !== null) return d[k];
  return '';
};

export default function ObbyPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; players: Map<string, LivePlayer>; socket?: WebSocket; frame: number; cleanup: () => void } | null>(null);
  const [connection, setConnection] = useState('A ligar ao TikFinity…');
  const [connected, setConnected] = useState(false);
  const [count, setCount] = useState(0);
  const [ranking, setRanking] = useState<{ name: string; points: number; lane: number }[]>([]);
  const [voiceOn, setVoiceOn] = useState(true);
  const [soundNotice, setSoundNotice] = useState('Comenta JOIN para entrar! Usa AZUL ou VERMELHO para escolher a equipa.');
  const [roundOn, setRoundOn] = useState(false);
  const [seconds, setSeconds] = useState(180);
  const [eventLog, setEventLog] = useState<string[]>([]);
  const voiceRef = useRef(true);
  const lastSpeakRef = useRef(0);

  const announce = (message: string) => {
    setSoundNotice(message);
    if (!voiceRef.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    if (Date.now() - lastSpeakRef.current < 2600) return;
    lastSpeakRef.current = Date.now();
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(message);
    u.lang = 'pt-PT'; u.pitch = 0.78; u.rate = 1.03;
    const voices = window.speechSynthesis.getVoices();
    const pt = voices.filter(v => /^pt(-|_)/i.test(v.lang));
    u.voice = pt.find(v => /male|mascul|daniel|jorge|ant[oó]nio|ricardo/i.test(v.name)) || pt[0] || null;
    window.speechSynthesis.speak(u);
  };

  useEffect(() => { voiceRef.current = voiceOn; }, [voiceOn]);

  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;
    let alive = true;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87d5f7);
    scene.fog = new THREE.Fog(0x87d5f7, 55, 150);
    const camera = new THREE.PerspectiveCamera(56, host.clientWidth / Math.max(1, host.clientHeight), 0.1, 240);
    camera.position.set(0, 13, 25);
    camera.lookAt(0, 0, -12);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(renderer.domElement);
    const hemi = new THREE.HemisphereLight(0xd9f5ff, 0x52634c, 2.0); scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d1, 2.5); sun.position.set(-8, 20, 10); sun.castShadow = true; scene.add(sun);

    const mat = (color: number, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), mat(0x58ae67));
    grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.35, -55); grass.receiveShadow = true; scene.add(grass);
    const road = new THREE.Mesh(new THREE.BoxGeometry(13, 0.5, 125), mat(0x676b78));
    road.position.set(0, -0.1, -53); road.receiveShadow = true; road.castShadow = true; scene.add(road);
    for (let z = 5; z > -115; z -= 8) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 3.1), mat(0xf8f4d8));
      dash.position.set(0, 0.17, z); scene.add(dash);
    }
    for (const x of [-6.35, 6.35]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.6, 125), mat(0xe6e8ef));
      rail.position.set(x, 0.35, -53); scene.add(rail);
    }
    // Start and finish gantries
    for (const z of [5, -112]) {
      const color = z === 5 ? 0x24354c : 0xffd33d;
      for (const x of [-5.4, 5.4]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 5, 0.35), mat(color));
        post.position.set(x, 2.35, z); scene.add(post);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(11.1, 0.55, 0.45), mat(color));
      top.position.set(0, 4.8, z); scene.add(top);
    }
    // Bright race lanes, glowing boost pads and checkpoint arches improve track readability.
    for (let lane = -4; lane <= 4; lane++) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.025, 120), mat(lane % 2 === 0 ? 0x8bdcff : 0xffd1e1));
      stripe.position.set(lane * 1.35, 0.17, -53); scene.add(stripe);
    }
    for (let i = 0; i < 6; i++) {
      const z = -10 - i * 18;
      const pad = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 2.2), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x36a3ff : 0xff5cc8, emissive: i % 2 ? 0x0755aa : 0x8a1455, emissiveIntensity: 0.75, roughness: 0.35 }));
      pad.position.set(i % 2 ? 2.2 : -2.2, 0.22, z); pad.userData.pulse = true; scene.add(pad);
      for (let side = -1; side <= 1; side += 2) {
        const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.42), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x7dd3fc : 0xf9a8d4, emissive: i % 2 ? 0x0369a1 : 0x9d174d, emissiveIntensity: 0.5 }));
        crystal.position.set((i % 2 ? 2.2 : -2.2) + side * 1.9, 0.8, z); scene.add(crystal);
      }
    }
    for (const z of [-25, -58, -91]) {
      const archMat = mat(0xf8fafc);
      for (const x of [-5.6, 5.6]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.22), archMat); post.position.set(x, 1.6, z); scene.add(post); }
      const arch = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.22, 0.25), mat(0xffd166)); arch.position.set(0, 3.3, z); scene.add(arch);
    }
    // Floating islands, ramps, rotating bars and block obstacles
    for (let i = 0; i < 16; i++) {
      const z = -5 - i * 6.5;
      const x = [-3.7, 0, 3.6, -1.8, 2.4][i % 5];
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.5 + (i % 3) * 0.35, 0.45, 1.1), mat([0xffb54a,0xf05a79,0x8c70ff,0x42c6b5][i % 4]));
      box.position.set(x, 0.5 + (i % 4) * 0.24, z); box.rotation.y = (i % 3) * 0.23; box.castShadow = true; scene.add(box);
      if (i % 2 === 0) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.28, 0.28), mat(0xf8f3ff));
        bar.position.set(-x * 0.3, 1.0 + (i % 3) * 0.22, z - 2.4); bar.userData.spin = (i % 2 ? 1 : -1) * 0.45; bar.castShadow = true; scene.add(bar);
      }
    }
    // Stylized low-poly trees in the landscape
    for (let i = 0; i < 45; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (9 + (i * 7 % 18));
      const z = 12 - (i * 11 % 135);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.8, 5), mat(0x77513b));
      trunk.position.set(x, 0.55, z); scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9 + (i % 3) * 0.18, 0), mat([0x2b8655,0x3d9b60,0x5aaa69][i % 3]));
      crown.position.set(x, 1.8, z); crown.castShadow = true; scene.add(crown);
    }

    const players = new Map<string, LivePlayer>();
    const addLabel = (name: string, color: number) => {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#111827dd'; ctx.beginPath(); ctx.roundRect(10, 10, 492, 108, 26); ctx.fill();
      ctx.strokeStyle = '#' + color.toString(16).padStart(6, '0'); ctx.lineWidth = 8; ctx.stroke();
      ctx.font = 'bold 38px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff';
      ctx.fillText(name.slice(0, 22), 256, 64, 450);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
      sprite.scale.set(4.2, 1.05, 1); sprite.position.y = 2.6;
      return sprite;
    };
    const hashName = (value: string) => Array.from(value.toLowerCase()).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    const createPlayer = (name: string, team: 'blue' | 'red') => {
      const key = name.toLowerCase();
      if (players.has(key)) return players.get(key)!;
      const seed = hashName(name);
      const lane = (players.size % 9) - 4;
      const teamColor = team === 'blue' ? BLUE : team === 'red' ? RED : (seed % 2 ? BLUE : RED);
      const outfitColors = [0x7c5cff,0xff8a3d,0x22c7a9,0xf04f91,0xf2c94c,0x4d7cff,0x8bd450,0xff6b6b];
      const skinColors = [0xffd0a6,0xc68655,0x8d5524,0xf1c27d,0xe0ac69,0xffdfbf];
      const hairColors = [0x241c15,0x593d2b,0xb97935,0x2b3445,0xeee2c8,0x8c3c66];
      const outfit = outfitColors[seed % outfitColors.length];
      const skin = skinColors[(seed >>> 3) % skinColors.length];
      const hairColor = hairColors[(seed >>> 6) % hairColors.length];
      const avatar = new THREE.Group();
      // More expressive username-seeded block avatar: layered clothes, face details,
      // shoes, cuffs and distinct hair/accessory silhouettes. Team colour stays visible.
      const dark = mat(0x20283b);
      const pantsColor = [0x26334a, 0x393044, 0x263b3b, 0x31364d][(seed >>> 9) % 4];
      const shoeColor = [0xf8fafc, 0x171923, 0xffd166, 0x78dce8][(seed >>> 12) % 4];
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.82, 0.44), mat(outfit));
      torso.position.y = 1.12; torso.castShadow = true; avatar.add(torso);
      const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.58, 0.035), mat(outfitColors[(seed + 2) % outfitColors.length]));
      shirtPanel.position.set(0, 1.13, 0.235); avatar.add(shirtPanel);
      const teamBadge = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.14, 0.49), new THREE.MeshStandardMaterial({ color: teamColor, emissive: teamColor, emissiveIntensity: 0.12 }));
      teamBadge.position.y = 1.48; avatar.add(teamBadge);
      const neck = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.22), mat(skin)); neck.position.y = 1.61; avatar.add(neck);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.66, 0.62), mat(skin)); head.position.y = 1.98; head.castShadow = true; avatar.add(head);
      const hairStyle = seed % 5;
      const hair = new THREE.Mesh(
        hairStyle === 0 ? new THREE.SphereGeometry(0.39, 8, 6)
          : hairStyle === 1 ? new THREE.BoxGeometry(0.72, 0.24, 0.68)
          : hairStyle === 2 ? new THREE.BoxGeometry(0.72, 0.34, 0.7)
          : hairStyle === 3 ? new THREE.ConeGeometry(0.36, 0.48, 6)
          : new THREE.BoxGeometry(0.7, 0.18, 0.72),
        mat(hairColor));
      hair.position.y = hairStyle === 3 ? 2.42 : 2.31; hair.castShadow = true; avatar.add(hair);
      if (hairStyle === 2) {
        const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.16), mat(hairColor));
        fringe.position.set(0, 2.17, 0.3); avatar.add(fringe);
      }
      // Eyes and smile face forward (positive Z), so each runner reads clearly on stream.
      for (const side of [-1, 1]) {
        const eyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.12, 0.035), mat(0xffffff));
        eyeWhite.position.set(side * 0.16, 2.01, 0.326); avatar.add(eyeWhite);
        const pupil = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.075, 0.02), dark);
        pupil.position.set(side * 0.16, 2.0, 0.35); avatar.add(pupil);
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.62, 0.3), mat(pantsColor));
        leg.position.set(side * 0.22, 0.43, 0); leg.castShadow = true; leg.userData.limb = side < 0 ? 'leftLeg' : 'rightLeg'; avatar.add(leg);
        const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.43), mat(shoeColor));
        shoe.position.set(side * 0.22, 0.13, 0.075); shoe.castShadow = true; avatar.add(shoe);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.62, 0.28), mat(skin));
        arm.position.set(side * 0.55, 1.13, 0); arm.castShadow = true; arm.userData.limb = side < 0 ? 'leftArm' : 'rightArm'; avatar.add(arm);
        const cuff = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.14, 0.29), mat(teamColor));
        cuff.position.set(side * 0.55, 0.88, 0); avatar.add(cuff);
      }
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.025), mat(0x743d45));
      mouth.position.set(0, 1.83, 0.326); avatar.add(mouth);
      // Username-seeded extras create recognisable silhouettes without external image assets.
      if (seed % 4 === 0) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.13, 0.74), mat(outfitColors[(seed + 3) % outfitColors.length]));
        cap.position.y = 2.48; avatar.add(cap);
        const brim = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.06, 0.34), mat(outfitColors[(seed + 3) % outfitColors.length]));
        brim.position.set(0, 2.4, 0.25); avatar.add(brim);
      } else if (seed % 4 === 1) {
        const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.48, 0.2), mat(outfitColors[(seed + 5) % outfitColors.length]));
        backpack.position.set(0, 1.13, -0.31); avatar.add(backpack);
        const packTop = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, 0.22), mat(teamColor));
        packTop.position.set(0, 1.42, -0.31); avatar.add(packTop);
      } else if (seed % 4 === 2) {
        const glasses = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.045), new THREE.MeshStandardMaterial({ color: 0x101827, metalness: 0.4, roughness: 0.25 }));
        glasses.position.set(0, 2.01, 0.37); avatar.add(glasses);
      } else {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.16, 0.5), mat(teamColor));
        shoulder.position.y = 1.49; avatar.add(shoulder);
      }
      const label = addLabel(name, teamColor); avatar.add(label); avatar.position.set(lane * 1.05, 0, 3 + (players.size % 4) * 1.2); scene.add(avatar);
      const p: LivePlayer = { username: name, lane, progress: 0, points: 0, color: teamColor, avatar, label, lastBoost: 0 };
      players.set(key, p); setCount(players.size); return p;
    };
    const updateRank = () => {
      const rows = [...players.values()].sort((a,b) => b.progress - a.progress || b.points - a.points).slice(0, 10).map(p => ({ name: p.username, points: Math.round(p.progress * 10) + p.points, lane: p.lane }));
      setRanking(rows);
    };
    const processMessage = (raw: TikFinityMessage) => {
      if (!raw || typeof raw.event !== 'string') return;
      const d = raw.data || {};
      const name = cleanName(textValue(d, 'nickname', 'uniqueId', 'username', 'userName', 'displayName') || 'Espectador');
      const key = name.toLowerCase();
      const ev = raw.event.toLowerCase();
      const comment = String(textValue(d, 'comment', 'text', 'message')).trim().toLowerCase();
      const existing = players.get(key);
      if (ev === 'chat') {
        if (comment === 'join' || comment === '!join' || comment === 'entrar' || comment === 'corrida') {
          const team = /vermelho|red/.test(String(textValue(d,'comment','text','message')).toLowerCase()) ? 'red' : /azul|blue/.test(String(textValue(d,'comment','text','message')).toLowerCase()) ? 'blue' : (players.size % 2 ? 'red' : 'blue');
          const p = createPlayer(name, team);
          p.lastBoost = performance.now(); p.progress += 1;
          setEventLog(old => [name + ' entrou na corrida', ...old].slice(0, 5));
          announce(name + ', bem-vindo à corrida! Prepara-te para ultrapassar os obstáculos!');
        } else if (existing && /azul|blue|vermelho|red/.test(comment)) {
          const team = /vermelho|red/.test(comment) ? 'red' : 'blue';
          existing.color = team === 'blue' ? BLUE : RED;
          (existing.avatar.children[0] as THREE.Mesh).material = mat(existing.color);
        }
      } else if (ev === 'like') {
        if (existing) {
          const likes = Math.max(1, Number(textValue(d,'likeCount','count','totalLikeCount')) || 1);
          existing.points += likes; existing.progress += Math.min(2.5, likes * 0.04); existing.lastBoost = performance.now();
        }
      } else if (ev === 'gift') {
        if (existing) {
          const gift = cleanName(textValue(d,'giftName','gift_name','name') || 'presente');
          const diamonds = Math.max(1, Number(textValue(d,'diamondCount','diamonds','diamond_count')) || 1);
          existing.points += Math.min(1000, diamonds * 2); existing.progress += Math.min(8, 1 + diamonds * 0.08); existing.lastBoost = performance.now();
          setEventLog(old => [name + ' ativou turbo com ' + gift, ...old].slice(0, 5));
          announce(name + ' ativou o turbo com ' + gift + '! Que velocidade!');
        }
      } else if (ev === 'follow') {
        if (!existing) { createPlayer(name, players.size % 2 ? 'red' : 'blue'); setEventLog(old => [name + ' seguiu e entrou na corrida', ...old].slice(0,5)); }
      }
      updateRank();
    };

    const clock = new THREE.Clock();
    const cameraLook = new THREE.Vector3();
    const cameraDesired = new THREE.Vector3();
    const animate = () => {
      if (!alive) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      scene.traverse(obj => { if (obj.userData.spin) obj.rotation.y += obj.userData.spin * dt; if (obj.userData.pulse) obj.scale.y = 1 + Math.sin(clock.elapsedTime * 4) * 0.15; });
      for (const p of players.values()) {
        if (scene.userData.roundOn) p.progress += dt * 0.45;
        p.avatar.position.z = 3 - p.progress * 4;
        const stride = scene.userData.roundOn ? 1 : 0.28;
        p.avatar.position.y = Math.max(0, Math.abs(Math.sin(clock.elapsedTime * 10 + p.lane)) * (scene.userData.roundOn ? 0.13 : 0.035));
        p.avatar.children.forEach((child) => {
          const phase = clock.elapsedTime * (scene.userData.roundOn ? 11 : 2.2) + (p.lane < 0 ? 0 : Math.PI);
          if (child.userData.limb === 'leftLeg') child.rotation.x = Math.sin(phase) * 0.62 * stride;
          if (child.userData.limb === 'rightLeg') child.rotation.x = Math.sin(phase + Math.PI) * 0.62 * stride;
          if (child.userData.limb === 'leftArm') child.rotation.x = Math.sin(phase + Math.PI) * 0.48 * stride;
          if (child.userData.limb === 'rightArm') child.rotation.x = Math.sin(phase) * 0.48 * stride;
        });
        if (p.avatar.position.z < -108) p.avatar.position.z = 3;
      }
      // Dynamic chase camera: follow the leading runner smoothly while looking ahead on the track.
      const leader = [...players.values()].sort((a, b) => b.progress - a.progress)[0];
      // Cinematic camera cuts: rear chase, side tracking and elevated wide shot.
      // Every angle continues to track the leading runner instead of staring at a fixed point.
      const angle = Math.floor(clock.elapsedTime / 8) % 3;
      if (leader) {
        const lx = leader.avatar.position.x;
        const lz = leader.avatar.position.z;
        if (angle === 0) {
          cameraDesired.set(lx * 0.42, 7.2, lz + 12.5);
          cameraLook.set(lx * 0.3, 1.25, lz - 7.5);
        } else if (angle === 1) {
          cameraDesired.set(lx + 10.5, 4.8, lz + 2.5);
          cameraLook.set(lx, 1.1, lz - 3.5);
        } else {
          cameraDesired.set(lx * 0.25, 15.5, lz + 8.5);
          cameraLook.set(lx * 0.25, 0.8, lz - 10);
        }
      } else {
        cameraDesired.set(0, 13, 25);
        cameraLook.set(0, 0, -12);
      }
      const cameraSmooth = 1 - Math.exp(-2.4 * dt);
      camera.position.lerp(cameraDesired, cameraSmooth);
      const smoothLookTarget = camera.userData.lookTarget as THREE.Vector3 | undefined;
      if (!smoothLookTarget) camera.userData.lookTarget = cameraLook.clone();
      (camera.userData.lookTarget as THREE.Vector3).lerp(cameraLook, cameraSmooth);
      camera.lookAt(camera.userData.lookTarget as THREE.Vector3);
      renderer.render(scene, camera);
      gameRef.current && (gameRef.current.frame = requestAnimationFrame(animate));
    };
    const resize = () => { if (!host) return; camera.aspect = host.clientWidth / Math.max(1,host.clientHeight); camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth,host.clientHeight); };
    window.addEventListener('resize', resize);
    gameRef.current = { renderer, scene, camera, players, frame: 0, cleanup: () => { window.removeEventListener('resize', resize); renderer.dispose(); renderer.domElement.remove(); } };
    animate();

    let socket: WebSocket | undefined;
    let retry: number | undefined;
    const connect = () => {
      if (!alive) return;
      try {
        socket = new WebSocket('ws://localhost:21213/');
        if (gameRef.current) gameRef.current.socket = socket;
        socket.onopen = () => { if (alive) { setConnected(true); setConnection('TikFinity conectado'); announce('TikFinity ligado! Comenta JOIN para entrar na corrida!'); } };
        socket.onmessage = e => { try { processMessage(JSON.parse(String(e.data)) as TikFinityMessage); } catch {} };
        socket.onerror = () => { if (alive) { setConnected(false); setConnection('Sem ligação — abre TikFinity Desktop neste computador'); } };
        socket.onclose = () => { if (alive) { setConnected(false); setConnection('A tentar reconectar ao TikFinity…'); retry = window.setTimeout(connect, 2500); } };
      } catch { setConnection('Não foi possível iniciar WebSocket local'); }
    };
    connect();
    return () => { alive = false; if (retry) window.clearTimeout(retry); socket?.close(); cancelAnimationFrame(gameRef.current?.frame || 0); gameRef.current?.cleanup(); gameRef.current = null; };
  // The scene is intentionally created once. Game controls update through refs/state below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(s => {
      if (!roundOn) return s;
      if (s <= 1) { setRoundOn(false); announce('Fim da corrida! Confere o ranking dos melhores corredores!'); return 0; }
      return s - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [roundOn]);

  useEffect(() => {
    const g = gameRef.current;
    if (!g) return;
    // A tiny movement update loop is controlled by the game render state via the current global.
    (g.scene as THREE.Scene).userData.roundOn = roundOn;
  }, [roundOn]);

  const demoJoin = (team: 'blue'|'red') => {
    const g = gameRef.current; if (!g) return;
    const name = 'Demo' + (team === 'blue' ? 'Azul' : 'Vermelho');
    if (g.players.has(name.toLowerCase())) return;
    // Simulate a TikFinity chat event through the same game logic by posting a local event.
    const lane = (g.players.size % 7) - 3; const color = team === 'blue' ? BLUE : RED;
    // Rich demo avatar matching the live-player proportions, with layered outfit and articulated limbs.
    const avatar = new THREE.Group();
    const seed = Array.from(name).reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,11);
    const skin = [0xffd0a6,0xc68655,0x8d5524,0xf1c27d][seed%4];
    const outfit = [0x7c5cff,0xff8a3d,0x22c7a9,0xf04f91][seed%4];
    const skinMat = new THREE.MeshStandardMaterial({color:skin});
    const outfitMat = new THREE.MeshStandardMaterial({color:outfit});
    const teamMat = new THREE.MeshStandardMaterial({color});
    const addBox=(w:number,h:number,d:number,material:THREE.Material,x:number,y:number,z:number)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);m.castShadow=true;avatar.add(m);return m;};
    addBox(.76,.78,.42,outfitMat,0,1.2,0); addBox(.3,.5,.035,teamMat,0,1.18,.23);
    addBox(.22,.18,.2,skinMat,0,1.68,0); addBox(.64,.64,.58,skinMat,0,2.05,0);
    addBox(.7,.22,.65,new THREE.MeshStandardMaterial({color:[0x241c15,0x593d2b,0xb97935][seed%3]}),0,2.39,0);
    for(const side of [-1,1]){
      addBox(.12,.12,.035,new THREE.MeshStandardMaterial({color:0xffffff}),side*.15,2.08,.3);
      addBox(.05,.07,.02,new THREE.MeshStandardMaterial({color:0x20283b}),side*.15,2.08,.323);
      const leg=addBox(.27,.58,.28,new THREE.MeshStandardMaterial({color:0x26334a}),side*.2,.48,0);leg.userData.limb=side<0?'leftLeg':'rightLeg';
      addBox(.31,.17,.4,new THREE.MeshStandardMaterial({color:0xf8fafc}),side*.2,.15,.07);
      const arm=addBox(.22,.58,.25,skinMat,side*.51,1.18,0);arm.userData.limb=side<0?'leftArm':'rightArm';
      addBox(.24,.13,.27,teamMat,side*.51,.91,0);
    }
    addBox(.18,.045,.025,new THREE.MeshStandardMaterial({color:0x743d45}),0,1.88,.3);
    if(seed%2===0)addBox(.38,.42,.18,new THREE.MeshStandardMaterial({color:0xf2c94c}),0,1.2,-.28);
    const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;const ctx=labelCanvas.getContext('2d')!;
    ctx.fillStyle='#111827ee';ctx.beginPath();ctx.roundRect(8,8,496,112,24);ctx.fill();ctx.strokeStyle='#'+color.toString(16).padStart(6,'0');ctx.lineWidth=7;ctx.stroke();
    ctx.font='bold 40px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(name,256,64,450);
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(labelCanvas),transparent:true,depthTest:false}));label.scale.set(4.2,1.05,1);label.position.y=2.8;avatar.add(label);
    avatar.position.set(lane*1.2,0,3);g.scene.add(avatar);
    g.players.set(name.toLowerCase(),{username:name,lane,progress:Math.random()*2,points:0,color,avatar,label,lastBoost:performance.now()});
    setCount(g.players.size); setRanking([...g.players.values()].sort((a,b)=>b.progress-a.progress).slice(0,10).map(p=>({name:p.username,points:Math.round(p.progress*10)+p.points,lane:p.lane})));
    announce(name+' entrou na pista! Vamos correr!');
  };

  const timeText = String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  return <main style={{ minHeight:'100vh', background:'#08101d', color:'#f8fafc', padding:16, fontFamily:'Arial, sans-serif' }}>
    <header style={{ display:'flex', flexWrap:'wrap', alignItems:'center', justifyContent:'space-between', gap:12, maxWidth:1400, margin:'0 auto 14px' }}>
      <div><div style={{fontSize:11,letterSpacing:3,color:'#9fb6d7',fontWeight:800}}>GPT LIVE · 3D OBSTACLE RACE</div><h1 style={{fontSize:'clamp(24px,3vw,38px)',margin:'6px 0'}}>🏁 GPT Live Obby</h1><p style={{margin:0,color:'#9aa9bf',fontSize:13}}>Comenta JOIN para correr · likes dão impulso · presentes ativam turbo</p></div>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}><span style={{border:'1px solid #2b405c',padding:'9px 12px',borderRadius:20,fontSize:12,color:connected?'#86efac':'#fbbf24'}}>● {connection}</span><button onClick={()=>{setRoundOn(v=>!v);if(seconds===0)setSeconds(180);}} style={buttonStyle}>{roundOn?'Pausar corrida':'Iniciar corrida'}</button><button onClick={()=>{setSeconds(180);setRoundOn(false);}} style={buttonStyle}>Reiniciar relógio</button></div>
    </header>
    <div style={{maxWidth:1400,margin:'0 auto',display:'grid',gridTemplateColumns:'minmax(0,1fr) 280px',gap:14}}>
      <section style={{minWidth:0}}>
        <div ref={mountRef} style={{height:'min(68vh,680px)',minHeight:400,border:'1px solid #263650',borderRadius:18,overflow:'hidden',background:'#87d5f7'}}/>
        <div style={{display:'flex',justifyContent:'space-between',gap:10,flexWrap:'wrap',marginTop:10,color:'#aab8cd',fontSize:12}}><span>👥 Corredores: <b style={{color:'#fff'}}>{count}</b></span><span>⏱️ {timeText}</span><span>🏁 Meta: 3 voltas (protótipo de pista)</span></div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}><button style={{...buttonStyle,borderColor:'#36a3ff'}} onClick={()=>demoJoin('blue')}>+ Testar corredor azul</button><button style={{...buttonStyle,borderColor:'#ff416b'}} onClick={()=>demoJoin('red')}>+ Testar corredor vermelho</button><label style={{display:'flex',alignItems:'center',gap:7,fontSize:12,color:'#cbd5e1',padding:'0 8px'}}><input type="checkbox" checked={voiceOn} onChange={e=>setVoiceOn(e.target.checked)}/> Voz em português</label></div>
        <div style={{marginTop:12,padding:14,borderRadius:12,background:'#101b2b',border:'1px solid #22324a',fontSize:13}}><span style={{color:'#9fb6d7'}}>🎙️ GPT Live anuncia: </span>{soundNotice}</div>
      </section>
      <aside style={{display:'flex',flexDirection:'column',gap:12}}>
        <div style={{...cardStyle,background:'linear-gradient(155deg,#172b46,#101827 68%)',borderColor:'#3b5274',boxShadow:'0 12px 30px #0004'}}><h2 style={{...headingStyle,fontSize:16,letterSpacing:1}}>🏆 HALL DA FAMA <span style={{float:'right',fontSize:10,color:'#8da9ce'}}>TOP 10</span></h2>{ranking.length?ranking.map((p,i)=><div key={p.name} style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,padding:'10px 8px',marginBottom:5,borderRadius:9,background:i===0?'linear-gradient(90deg,#705b2a55,#d4af3730)':i===1?'#94a3b822':i===2?'#b8733322':'#07111f88',border:'1px solid '+(i===0?'#d4af3766':'#ffffff0b'),fontSize:12}}><span style={{display:'flex',alignItems:'center',gap:7,minWidth:0}}><b style={{fontSize:15}}>{['🥇','🥈','🥉'][i]||String(i+1).padStart(2,'0')}</b><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span></span><b style={{color:p.lane%2?'#ff8197':'#69baff',whiteSpace:'nowrap'}}>{p.points} <small>PTS</small></b></div>):<p style={{fontSize:12,color:'#91a0b7'}}>À espera dos espectadores. Comenta JOIN na LIVE.</p>}</div>
        <div style={cardStyle}><h2 style={headingStyle}>💬 Como jogar</h2><p style={helpStyle}><b>JOIN</b> — entra na pista</p><p style={helpStyle}><b>AZUL / VERMELHO</b> — escolhe a equipa</p><p style={helpStyle}><b>Likes</b> — impulsionam o corredor</p><p style={helpStyle}><b>Presentes</b> — turbo extra</p><p style={{fontSize:10,color:'#7f91aa',lineHeight:1.5}}>Os espectadores precisam entrar com JOIN antes de os likes/presentes afetarem o seu corredor.</p></div>
        <div style={cardStyle}><h2 style={headingStyle}>⚡ Eventos recentes</h2>{eventLog.length?eventLog.map((e,i)=><p key={e+i} style={{fontSize:11,color:'#cbd5e1',borderBottom:'1px solid #223047',paddingBottom:8}}>{e}</p>):<p style={{fontSize:12,color:'#91a0b7'}}>Ainda sem eventos.</p>}</div>
      </aside>
    </div>
    <footer style={{maxWidth:1400,margin:'18px auto 0',fontSize:10,color:'#71819a',lineHeight:1.6}}>Protótipo 3D em Three.js. A ligação direta a ws://localhost:21213 funciona quando esta página é aberta no computador com TikFinity Desktop ativo. O site HTTPS da Vercel pode bloquear WebSocket inseguro para localhost; para teste fiável, executar a app localmente no PC. A voz do navegador ainda não é misturada automaticamente na LIVE do Android.</footer>
  </main>;
}

const buttonStyle: React.CSSProperties = { background:'#142237',border:'1px solid #344b69',borderRadius:10,padding:'10px 12px',color:'#edf5ff',fontSize:12,fontWeight:700,cursor:'pointer' };
const cardStyle: React.CSSProperties = { background:'#101b2b',border:'1px solid #22324a',borderRadius:14,padding:14 };
const headingStyle: React.CSSProperties = { margin:'0 0 12px',fontSize:15 };
const helpStyle: React.CSSProperties = { margin:'9px 0',fontSize:12,color:'#c5d2e4' };
