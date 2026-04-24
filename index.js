
/* ── OPEN LETTERBOX ── */
setTimeout(()=>document.body.classList.add('lb-open'), 60);

/* ══ MUSIC ══ */
const bgm = document.getElementById('bgm');
bgm.volume = 0.55;

let musicStarted = false;

function startMusic(){
  if(musicStarted) return;
  bgm.play().then(()=>{ musicStarted = true; }).catch(()=>{});
}

startMusic();

['click','keydown','pointerdown','touchstart'].forEach(evt=>{
  document.addEventListener(evt, function handler(){
    startMusic();
    document.removeEventListener(evt, handler);
  }, {once:true});
});

/* Mute toggle (footer button — hidden by default, kept for compatibility) */
const muteBtn = document.getElementById('mute-btn');
muteBtn.addEventListener('click', ()=>{
  startMusic();
  bgm.muted = !bgm.muted;
  muteBtn.textContent = bgm.muted ? '♪ Unmute' : '♪ Music';
  muteBtn.style.color = bgm.muted ? 'rgba(201,168,76,.22)' : 'rgba(201,168,76,.35)';
  // keep Options panel toggle in sync
  syncMuteToggle();
});

/* ── OPTIONS PANEL ── */
const optOverlay      = document.getElementById('opt-overlay');
const optClose        = document.getElementById('opt-close');
const optApply        = document.getElementById('opt-apply');
const musicVolSlider  = document.getElementById('music-vol');
const musicVolVal     = document.getElementById('music-vol-val');
const sfxVolSlider    = document.getElementById('sfx-vol');
const sfxVolVal       = document.getElementById('sfx-vol-val');
const musicMuteToggle = document.getElementById('music-mute-toggle');
const muteLbl         = document.getElementById('mute-lbl');

// Pending values (applied only on Confirm)
let pendingMusicVol = Math.round(bgm.volume * 100);
let pendingMuted    = bgm.muted;

function syncMuteToggle(){
  if(bgm.muted){
    musicMuteToggle.classList.add('on');
    muteLbl.textContent = 'ON';
  } else {
    musicMuteToggle.classList.remove('on');
    muteLbl.textContent = 'OFF';
  }
}

function openOptions(){
  startMusic();
  // Load current live values into the panel
  musicVolSlider.value = Math.round(bgm.volume * 100);
  musicVolVal.textContent = musicVolSlider.value;
  sfxVolSlider.value = sfxVolVal.textContent; // SFX is cosmetic for now
  pendingMusicVol = parseInt(musicVolSlider.value, 10);
  pendingMuted    = bgm.muted;
  syncMuteToggle();
  optOverlay.classList.add('active');
}

function closeOptions(){
  optOverlay.classList.remove('active');
}

/* Live preview: slider moves immediately update the audio */
musicVolSlider.addEventListener('input', ()=>{
  const v = parseInt(musicVolSlider.value, 10);
  musicVolVal.textContent = v;
  pendingMusicVol = v;
  // Live preview
  if(!bgm.muted) bgm.volume = v / 100;
});

sfxVolSlider.addEventListener('input', ()=>{
  sfxVolVal.textContent = sfxVolSlider.value;
});

/* Mute toggle inside options */
musicMuteToggle.addEventListener('click', ()=>{
  pendingMuted = !pendingMuted;
  // Live preview
  bgm.muted = pendingMuted;
  syncMuteToggle();
});

/* Close without further changes */
optClose.addEventListener('click', closeOptions);
optOverlay.addEventListener('click', e=>{
  if(e.target === optOverlay) closeOptions();
});

/* Confirm / Apply */
optApply.addEventListener('click', ()=>{
  bgm.volume = pendingMusicVol / 100;
  bgm.muted  = pendingMuted;
  muteBtn.textContent = bgm.muted ? '♪ Unmute' : '♪ Music';
  closeOptions();
});

/* ESC to close */
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeOptions(); });

/* Wire Options button */
document.getElementById('ob').addEventListener('click', openOptions);


/* ── FX CANVAS ── */
const cv=document.getElementById('fx'), cx=cv.getContext('2d');
let W,H;
function rsz(){W=cv.width=innerWidth;H=cv.height=innerHeight;}
rsz(); window.addEventListener('resize',rsz);

const embers=[];
function spawnE(){
  embers.push({
    x:Math.random()*W, y:H+8,
    vx:(Math.random()-.5)*.9,
    vy:-(0.35+Math.random()*1.3),
    life:1, dec:.0025+Math.random()*.0045,
    sz:.7+Math.random()*2.4,
    h:18+Math.random()*28,
    s:65+Math.random()*35,
    b:58+Math.random()*38,
    wb:Math.random()*Math.PI*2,
    ws:.018+Math.random()*.04
  });
}

const wisps=[];
function spawnW(){
  wisps.push({
    x:Math.random()*W, y:H*.55+Math.random()*H*.45,
    vx:(Math.random()-.5)*.13, vy:-(0.04+Math.random()*.1),
    life:1, dec:.0006+Math.random()*.0008,
    sz:25+Math.random()*90, op:.03+Math.random()*.055
  });
}

const bolts=[];
let nxt=4000+Math.random()*7000;
function mkBolt(){
  let bx=W*.2+Math.random()*W*.6, by=0, segs=[];
  while(by<H*.65){
    const ny=by+18+Math.random()*38, nx=bx+(Math.random()-.5)*90;
    segs.push({x1:bx,y1:by,x2:nx,y2:ny}); bx=nx; by=ny;
  }
  bolts.push({segs,life:1,dec:.05+Math.random()*.09,w:.4+Math.random()});
}

const drops=[];
function spawnDrop(){
  drops.push({
    x:Math.random()*W, y:-10,
    vy:2+Math.random()*4,
    len:8+Math.random()*20,
    op:.04+Math.random()*.08,
    life:1
  });
}

let last=0;
function loop(ts){
  const dt=Math.min(ts-last,50); last=ts;
  cx.clearRect(0,0,W,H);

  if(Math.random()<.035) spawnW();
  for(let i=wisps.length-1;i>=0;i--){
    const w=wisps[i];
    w.x+=w.vx; w.y+=w.vy; w.life-=w.dec; w.sz+=.12;
    if(w.life<=0){wisps.splice(i,1);continue;}
    cx.save();
    cx.globalAlpha=w.op*w.life;
    const g=cx.createRadialGradient(w.x,w.y,0,w.x,w.y,w.sz);
    g.addColorStop(0,'rgba(70,15,8,.7)'); g.addColorStop(1,'transparent');
    cx.fillStyle=g;
    cx.beginPath();cx.arc(w.x,w.y,w.sz,0,Math.PI*2);cx.fill();
    cx.restore();
  }

  if(Math.random()<.06) spawnDrop();
  for(let i=drops.length-1;i>=0;i--){
    const d=drops[i];
    d.y+=d.vy;
    if(d.y>H+30){drops.splice(i,1);continue;}
    cx.save();
    cx.globalAlpha=d.op;
    cx.strokeStyle='rgba(160,0,0,.8)';
    cx.lineWidth=.7;
    cx.beginPath();cx.moveTo(d.x,d.y);cx.lineTo(d.x,d.y+d.len);cx.stroke();
    cx.restore();
  }

  if(Math.random()<.2) spawnE();
  for(let i=embers.length-1;i>=0;i--){
    const e=embers[i];
    e.wb+=e.ws; e.x+=e.vx+Math.sin(e.wb)*.35; e.y+=e.vy; e.life-=e.dec;
    if(e.life<=0||e.y<-20){embers.splice(i,1);continue;}
    cx.save();
    cx.globalAlpha=e.life*.9;
    cx.shadowBlur=8; cx.shadowColor=`hsl(${e.h},${e.s}%,${e.b}%)`;
    cx.fillStyle=`hsl(${e.h},${e.s}%,${e.b}%)`;
    cx.beginPath();cx.arc(e.x,e.y,e.sz*e.life,0,Math.PI*2);cx.fill();
    cx.restore();
  }

  nxt-=dt;
  if(nxt<=0){mkBolt();nxt=5000+Math.random()*9000;}
  for(let i=bolts.length-1;i>=0;i--){
    const b=bolts[i]; b.life-=b.dec;
    if(b.life<=0){bolts.splice(i,1);continue;}
    cx.save();
    for(const pass of[{w:b.w*b.life,a:.7*b.life,c:`rgba(255,200,100,${b.life})`},{w:(b.w+2.5)*b.life,a:.18*b.life,c:'rgba(255,220,160,1)'}]){
      cx.globalAlpha=pass.a;
      cx.strokeStyle=pass.c;
      cx.shadowBlur=pass.w===b.w*b.life?14*b.life:0;
      cx.shadowColor='rgba(255,160,60,.7)';
      cx.lineWidth=pass.w;
      for(const s of b.segs){cx.beginPath();cx.moveTo(s.x1,s.y1);cx.lineTo(s.x2,s.y2);cx.stroke();}
    }
    cx.restore();
  }

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

/* ── MOUSE PARALLAX ── */
const bg=document.getElementById('bg-img');
let mx=0,my=0,cx2=0,cy2=0;
document.addEventListener('mousemove',e=>{mx=e.clientX/W-.5;my=e.clientY/H-.5;});
setInterval(()=>{
  cx2+=(mx-cx2)*.04; cy2+=(my-cy2)*.04;
  bg.style.transform=`scale(1.1) translate(${cx2*8}px,${cy2*5}px)`;
},16);

/* ── VIDEO ── */
const vo=document.getElementById('vo');
const iv=document.getElementById('iv');
const sk=document.getElementById('sk');
const vpf=document.getElementById('vpf');
const vph=document.getElementById('vph');
const cdEl=document.getElementById('cd');
let skipOk=false,cdT;

function endIntro(){
  clearInterval(cdT);
  vo.style.opacity='0';
  setTimeout(()=>{ window.location.href='game.html'; },900);
}

iv.addEventListener('timeupdate',()=>{
  if(iv.duration) vpf.style.width=(iv.currentTime/iv.duration*100)+'%';
});
iv.addEventListener('ended',endIntro);
iv.addEventListener('canplay',()=>{iv.style.display='block';vph.style.display='none';});
iv.addEventListener('error',showPh);

function showPh(){
  iv.style.display='none'; vph.style.display='flex';
  let c=5; cdEl.textContent=c;
  vpf.style.width='0%';
  cdT=setInterval(()=>{
    c--; cdEl.textContent=c;
    vpf.style.width=((5-c)/5*100)+'%';
    if(c<=0){clearInterval(cdT);endIntro();}
  },1000);
}

function playIntro(){
  let vol = bgm.volume;
  const fadeOut = setInterval(()=>{
    vol = Math.max(0, vol - 0.05);
    bgm.volume = vol;
    if(vol <= 0){ clearInterval(fadeOut); bgm.pause(); }
  }, 80);

  vo.classList.add('active');
  requestAnimationFrame(()=>requestAnimationFrame(()=>vo.classList.add('vis')));
  skipOk=false;
  const p=iv.play();
  if(p) p.catch(showPh); else showPh();
  setTimeout(()=>skipOk=true,2000);
}

sk.addEventListener('click',()=>{if(!skipOk)return;iv.pause();endIntro();});
document.getElementById('sb').addEventListener('click',playIntro);
