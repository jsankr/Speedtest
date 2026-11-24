/* CleanSpeed engine: measurement, router check, toolkit, map, collider and help assistant.
   Ported from the single-file app. React renders the markup (same element ids); boot() wires the behaviour.
   ui.go(view) switches the visible screen. */
export function boot(ui){
const $=id=>document.getElementById(id);
// Saved data is checked on every read: anything on this device (another script, a restored backup) could have changed it.
const NETS=["Wi-Fi","Mobile data","Ethernet","Unknown"];
const numOr=v=>typeof v==="number"&&isFinite(v)?v:null, short=v=>typeof v==="string"?v.slice(0,160):"";
const CLEAN={
  history:v=>Array.isArray(v)?v.filter(r=>r&&typeof r==="object"&&typeof r.t==="number"&&isFinite(r.t)).slice(0,300).map(r=>({t:r.t,net:NETS.includes(r.net)?r.net:"Unknown",
    down:numOr(r.down),up:numOr(r.up),ping:numOr(r.ping),jitter:numOr(r.jitter),lping:numOr(r.lping),server:short(r.server)})):undefined,
  geo:v=>v&&typeof v==="object"&&typeof v.lat==="number"&&typeof v.lon==="number"&&Math.abs(v.lat)<=90&&Math.abs(v.lon)<=180?{lat:v.lat,lon:v.lon,src:["ip","device","tz"].includes(v.src)?v.src:"ip"}:undefined,
  customURL:v=>typeof v==="string"&&/^https?:\/\/[^\s"'<>]+$/i.test(v)?v.slice(0,300):undefined,
  server:v=>typeof v==="string"&&/^[\w.:-]{1,80}$/.test(v)?v:undefined,
  unit:v=>["KB","MB","GB","Kb","Mb","Gb"].includes(v)?v:undefined,
  base:v=>v===1000||v===1024?v:undefined,
  cmpCountry:v=>typeof v==="string"&&/^[A-Z]{0,3}$/.test(v)?v:undefined,
  netPick:v=>v==null||NETS.includes(v)?v:undefined,
};
const store={get(k,d){try{const v=localStorage.getItem(k); if(v==null) return d; const p=JSON.parse(v), c=CLEAN[k]?CLEAN[k](p):p; return c===undefined?d:c}catch{return d}},
             set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const onScheme=f=>{ matchMedia("(prefers-color-scheme: dark)").addEventListener("change",f); window.addEventListener("cs:theme",f) };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const median=a=>{const s=a.filter(Number.isFinite).sort((x,y)=>x-y);return s.length?s[s.length>>1]:NaN};
const nonce=()=>Math.random().toString(36).slice(2);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fin=v=>typeof v==="number"&&isFinite(v);

/* =================== Units (internal: bytes per second) =================== */
// unit = prefix letter (K|M|G) + B (bytes) or b (bits)
const UNITS=["KB","MB","GB","Kb","Mb","Gb"];
let unit=store.get("unit","MB"); if(!UNITS.includes(unit)) unit="MB";
let base=store.get("base",1000);
function conv(bps){ if(!fin(bps)) return NaN; const p={K:1,M:2,G:3}[unit[0]]; return bps*(unit[1]==="b"?8:1)/base**p }
function fmtNum(v){ if(!fin(v)) return "—"; return v.toFixed(v>=100?1:v>=10?2:3) }
const fmt=bps=>fmtNum(conv(bps));
function unitLabel(){ const bin=base===1024, p=unit[0];
  return unit[1]==="b" ? `${p}${bin?"i":""}bps` : `${p}${bin?"i":""}B/s` }
const mbpsToBps=m=>m*1e6/8;   // published medians are decimal Mbps
const bpsToMbps=b=>b*8/1e6;

/* =================== Servers =================== */
// LibreSpeed public servers (snapshot of librespeed.org/backend-servers/servers.php, Nov 2026). Refreshed live when reachable.
const LIBRE_SNAPSHOT=[
 [35,"Roma, Italy (GARR)","st-be-rm2.infra.garr.it",1],[49,"London, UK (Clouvider)","lon.speedtest.clouvider.net/backend",0],
 [50,"Frankfurt, Germany (Clouvider)","fra.speedtest.clouvider.net/backend",0],[51,"Amsterdam, Netherlands (Clouvider)","ams.speedtest.clouvider.net/backend",0],
 [52,"New York, USA (Clouvider)","nyc.speedtest.clouvider.net/backend",0],[53,"Atlanta, USA (Clouvider)","atl.speedtest.clouvider.net/backend",0],
 [54,"Los Angeles, USA (Clouvider)","la.speedtest.clouvider.net/backend",0],[74,"Poznan, Poland (INEA)","speedtest.kamilszczepanski.com",0],
 [79,"Prague, Czechia (CESNET)","speedtest.cesnet.cz",1],[82,"Tokyo, Japan (A573)","librespeed.a573.net",1],
 [85,"Prague, Czechia (Turris)","librespeed.turris.cz",1],[90,"Las Vegas, USA (Sharktech)","lasspeed.sharktech.net",1],
 [91,"Los Angeles, USA (Sharktech)","laxspeed.sharktech.net",1],[92,"Denver, USA (Sharktech)","denspeed.sharktech.net",1],
 [93,"Chicago, USA (Sharktech)","chispeed.sharktech.net",1],[94,"Amsterdam, Netherlands (Sharktech)","amsspeed.sharktech.net",1],
 [100,"Grand Rapids, USA (RackGenius)","mispeed.rackgenius.com",1],[101,"Helsinki, Finland (Hetzner)","www.librespeed.fi",1],
 [103,"Novi Sad, Serbia (E-CAPS)","speed1.e-caps.net",1],[104,"Argalasti, Greece (Cosmote)","argalasti.skoultsos.eu",1],
 [105,"Frankfurt, Germany (FS IT-Systeme)","speed.fs-it.systems",1],[106,"Belgrade, Serbia (SOX)","speedtest1.sox.rs/librespeed",1]
].map(([id,name,host,pref])=>librespeed({id,name,server:"//"+host,dlURL:(pref?"backend/":"")+"garbage.php",ulURL:(pref?"backend/":"")+"empty.php",pingURL:(pref?"backend/":"")+"empty.php"}));

function librespeed(s){
  const b="https:"+String(s.server).replace(/^https?:/,"").replace(/\/+$/,"");
  const u=p=>`${b}/${String(p).replace(/^\/+/,"")}`;
  const q=p=>u(p)+(u(p).includes("?")?"&":"?")+"cors=true&r="+nonce();
  return {id:"ls-"+s.id,group:"LibreSpeed volunteer servers",kind:"http",name:s.name,where:b.replace(/^https:\/\//,""),
    down:()=>q(s.dlURL)+"&ckSize=100", up:()=>q(s.ulURL), ping:()=>q(s.pingURL)};
}
const CLOUDFLARE={id:"cf",group:"Global networks",kind:"http",name:"Cloudflare",where:"Nearest of 300+ cities (anycast)",
  down:n=>`https://speed.cloudflare.com/__down?bytes=${n}&r=${nonce()}`, up:()=>`https://speed.cloudflare.com/__up?r=${nonce()}`,
  ping:()=>`https://speed.cloudflare.com/__down?bytes=0&r=${nonce()}`};
const MLAB={id:"mlab",group:"Global networks",kind:"ndt7",name:"Measurement Lab (M-Lab)",where:"Nearest M-Lab site · publishes results with your IP"};
function customServer(url){
  const b=url.trim().replace(/\/+$/,"");
  return {id:"custom",group:"Your own server",kind:"http",name:"Custom server",where:b.replace(/^https?:\/\//,""),
    down:n=>`${b}/down?bytes=${n}&r=${nonce()}`, up:()=>`${b}/up?r=${nonce()}`, ping:()=>`${b}/ping?r=${nonce()}`};
}
let libre=LIBRE_SNAPSHOT;
const pings={};
let selected=store.get("server","auto"), customURL=store.get("customURL","");
function allServers(){ const l=[CLOUDFLARE,MLAB,...libre]; if(customURL) l.push(customServer(customURL)); return l }
function byId(id){ return allServers().find(s=>s.id===id) }
async function refreshLibre(){
  try{ const ctl=new AbortController(); setTimeout(()=>ctl.abort(),5000);
    const r=await fetch("https://librespeed.org/backend-servers/servers.php",{signal:ctl.signal,cache:"no-store"}); const j=await r.json();
    if(Array.isArray(j)&&j.length){ libre=j.filter(s=>s&&s.server&&s.dlURL).map(librespeed); renderServers() } }catch{}
}
/* A test can always end: every request has a time limit, and Stop aborts whatever is in flight. */
let testCtl=null;
const STOPPED="__stopped__";
const linkStop=ctl=>{ if(testCtl) testCtl.signal.addEventListener("abort",()=>ctl.abort(),{once:true}) };
const stopped=()=>!!(testCtl&&testCtl.signal.aborted);
/* Time a single no-cors request: needs no permission headers from the server. */
async function pingURL(url,timeout=4000){
  const ctl=new AbortController(); const tm=setTimeout(()=>ctl.abort(),timeout); if(running) linkStop(ctl);
  try{ const t=performance.now(); const r=await fetch(url,{mode:"no-cors",cache:"no-store",signal:ctl.signal}); await r.arrayBuffer(); return performance.now()-t }
  finally{ clearTimeout(tm) }
}
async function quickPing(s){
  if(s.kind!=="http") return NaN;
  const out=[]; for(let i=0;i<3;i++){ try{out.push(await pingURL(s.ping()))}catch{out.push(NaN)} }
  const v=Math.min(...out.slice(1).filter(Number.isFinite)); return isFinite(v)?v:NaN;
}
async function pingAll(){
  const list=allServers().filter(s=>s.kind==="http"); list.forEach(s=>pings[s.id]=null); renderServers();
  for(let i=0;i<list.length;i+=6) await Promise.all(list.slice(i,i+6).map(async s=>{pings[s.id]=await quickPing(s); renderServers()}));
}
async function pickAuto(){
  $("phase").textContent="Finding the best server";
  const cand=[CLOUDFLARE,...libre];
  await Promise.all(cand.map(async s=>{ if(!fin(pings[s.id])) pings[s.id]=await quickPing(s) }));
  const ok=cand.filter(s=>fin(pings[s.id])).sort((a,b)=>pings[a.id]-pings[b.id]);
  if(!ok.length) throw new Error("No test server answered. Check your connection");
  return ok[0];
}
function renderServers(){
  const groups={};
  const row=(id,name,where,pg)=>`<label class="srv"><input type="radio" name="srv" value="${esc(id)}" ${selected===id?"checked":""}>
    <div class="nm"><div>${esc(name)}</div><div>${esc(where)}</div></div><div class="pg">${pg}</div></label>`;
  let html=`<div class="grp">Recommended</div>`+row("auto","Automatic","Lowest-ping server among Cloudflare and LibreSpeed","");
  for(const s of allServers()) (groups[s.group]=groups[s.group]||[]).push(s);
  for(const [g,ss] of Object.entries(groups)){
    html+=`<div class="grp">${esc(g)}</div>`;
    for(const s of [...ss].sort((a,b)=>(pings[a.id]??1e9)-(pings[b.id]??1e9))){ const p=pings[s.id];
      html+=row(s.id,s.name,s.where,s.kind==="ndt7"?"auto":p===null?"…":fin(p)?p.toFixed(0)+" ms":p===undefined?"":"no reply") }
  }
  html+=`<div class="grp">Your own server</div><div class="customrow"><input type="text" id="custom" placeholder="https://your-server:8080 (runs server.py)" value="${esc(customURL)}" spellcheck="false" aria-label="Custom server URL"><button class="ghost" id="customUse">Use</button></div>`;
  $("srvList").innerHTML=html;
  $("customUse").onclick=()=>{const v=$("custom").value.trim(); if(!/^https?:\/\//.test(v)){$("custom").focus();return}
    customURL=v; store.set("customURL",v); selected="custom"; store.set("server","custom"); renderServers(); syncServerName()};
  $("mlabConsent").hidden=selected!=="mlab";
}
function syncServerName(){ const s=selected==="auto"?null:byId(selected); $("srvName").textContent=s?s.name:"Automatic"; showConn() }

/* =================== Connection =================== */
// Only Chrome on Android exposes the link type. Everywhere else (Safari, iPhone, desktop) the person picks it once;
// the choice is remembered and sits next to GO so it's visible on every test.
function detectedNet(){
  const c=navigator.connection, t=c&&c.type;
  return {wifi:"Wi-Fi",cellular:"Mobile data",ethernet:"Ethernet"}[t]||null;
}
let netPick=detectedNet()||store.get("netPick",null), netAutoOn=!!detectedNet();
function connLabel(){ return netPick||"Unknown" }
function syncNet(){
  document.querySelectorAll("#netSeg button").forEach(b=>{const on=b.dataset.n===netPick; b.setAttribute("aria-pressed",on); });
  $("netAuto").textContent=netAutoOn?"detected":netPick?"":"pick one";
  showConn();
}
function showConn(){
  // effectiveType is a speed class ("4g" even on Wi-Fi), not the network type, so it's deliberately not shown.
  $("conn").textContent=`Network: ${connLabel()}`+(netAutoOn?" (detected by browser)":netPick?" (your choice, remembered)":"");
}

/* =================== Gauge: glass dial with engraved track =================== */
const g=$("gauge"), gx=g.getContext("2d");
let needle=0, needleTarget=0, phaseColor="--accent", running=false;
const gaugeMax=()=>conv(125e6); // ≈1 Gbit/s
function drawGauge(){
  // Aurora ring: a soft 270° track, the value arc in the phase colour blending to its partner hue, a lit knob at the head.
  const W=g.width,H=g.height,cx=W/2,cy=H*0.5,R=H*0.415,LW=34; gx.clearRect(0,0,W,H);
  const a0=Math.PI*0.75,a1=Math.PI*2.25,max=gaugeMax(), pos=v=>Math.log10(1+9*Math.min(Math.max(v,0),max)/max);
  const dark=getComputedStyle(document.documentElement).colorScheme.includes("dark");
  gx.lineCap="round";
  gx.lineWidth=LW; gx.strokeStyle=css("--track"); gx.beginPath(); gx.arc(cx,cy,R,a0,a1); gx.stroke();
  // fine scale inside the ring
  gx.strokeStyle=css("--muted"); gx.lineWidth=2;
  for(let i=0;i<=40;i++){ const a=a0+(a1-a0)*i/40, r1=R-LW/2-14, r2=r1-(i%5?7:15); gx.globalAlpha=i%5?.28:.7;
    gx.beginPath(); gx.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1); gx.lineTo(cx+Math.cos(a)*r2,cy+Math.sin(a)*r2); gx.stroke() }
  gx.globalAlpha=1;
  const p=Math.max(pos(needle),0.0001), aEnd=a0+(a1-a0)*p, col=css(phaseColor), col2=css(phaseColor==="--up"?"--up2":"--violet");
  if(p>0.004){
    let gr; if(gx.createConicGradient){ gr=gx.createConicGradient(a0-0.05,cx,cy); gr.addColorStop(0,col); gr.addColorStop(Math.min(1,(aEnd-a0+0.05)/(Math.PI*2)),col2); gr.addColorStop(1,col2) }
    else { gr=gx.createLinearGradient(cx-R,cy+R,cx+R,cy-R); gr.addColorStop(0,col); gr.addColorStop(1,col2) }
    gx.save(); gx.shadowColor=col+(dark?"aa":"66"); gx.shadowBlur=28; gx.lineWidth=LW; gx.strokeStyle=gr; gx.beginPath(); gx.arc(cx,cy,R,a0,aEnd); gx.stroke(); gx.restore();
    const hx=cx+Math.cos(aEnd)*R, hy=cy+Math.sin(aEnd)*R;
    gx.save(); gx.shadowColor="rgba(0,0,0,.35)"; gx.shadowBlur=14; gx.shadowOffsetY=4; gx.fillStyle="#ffffff"; gx.beginPath(); gx.arc(hx,hy,LW/2-3,0,Math.PI*2); gx.fill(); gx.restore();
    gx.fillStyle=col2; gx.beginPath(); gx.arc(hx,hy,6,0,Math.PI*2); gx.fill();
  }
  gx.fillStyle=css("--muted"); gx.font=`500 20px ${css("--mono")}`; gx.textAlign="center"; gx.textBaseline="middle";
  for(const f of [0,.01,.05,.1,.25,.5,1]){ const t=f*max, a=a0+(a1-a0)*pos(t);
    gx.fillText(t>=10?Math.round(t).toLocaleString():+t.toPrecision(2),cx+Math.cos(a)*(R-LW/2-44),cy+Math.sin(a)*(R-LW/2-44)) }
  if(running){
    gx.fillStyle=css("--ink"); gx.font=`400 168px ${css("--display")}`; gx.fillText(needle>0?fmtNum(needle):"0",cx,cy-6);
    gx.fillStyle=css("--muted"); gx.font=`500 24px ${css("--mono")}`; gx.fillText(unitLabel(),cx,cy+86);
  }
}
let lastDraw=0;
let gaugeRaf=0;
function animate(ts){
  gaugeRaf=0; needle+=(needleTarget-needle)*0.16; if(Math.abs(needleTarget-needle)<1e-6) needle=needleTarget;
  if(ts-lastDraw>14){ drawGauge(); lastDraw=ts }
  if(running||needle!==needleTarget) gaugeRaf=requestAnimationFrame(animate); else drawGauge();
}
function gaugeKick(){ if(!gaugeRaf) gaugeRaf=requestAnimationFrame(animate) }
const setGauge=bps=>{ needleTarget=bps?conv(bps)||0:0; gaugeKick() };
const sp=$("spark"), sx=sp.getContext("2d"); let series={down:[],up:[]};
if("ResizeObserver" in window){ let sparkRaf=0; new ResizeObserver(()=>{ cancelAnimationFrame(sparkRaf); sparkRaf=requestAnimationFrame(drawSpark) }).observe(sp) }
function drawSpark(){
  // match the canvas to its laid-out size (the chart stretches to fill the readout column on wide screens)
  const dpr=Math.min(2,devicePixelRatio||1), cw=Math.round(sp.clientWidth*dpr), ch=Math.round(sp.clientHeight*dpr);
  if(cw&&ch&&(Math.abs(sp.width-cw)>2||Math.abs(sp.height-ch)>2)){ sp.width=cw; sp.height=ch }
  const W=sp.width,H=sp.height; sx.clearRect(0,0,W,H); const m=Math.max(1,...series.down,...series.up);
  const empty=series.down.length<2&&series.up.length<2;
  sx.strokeStyle=css("--track"); sx.lineWidth=1; for(let i=1;i<4;i++){ if(empty&&i===2) continue; sx.beginPath();sx.moveTo(0,H*i/4);sx.lineTo(W,H*i/4);sx.stroke()}
  if(empty){ sx.fillStyle=css("--muted"); sx.font=`500 ${Math.round(12*dpr)}px ${css("--mono")}`; sx.textAlign="center"; sx.textBaseline="middle";
    sx.fillText("Live throughput appears here during a test",W/2,H/2); return }
  for(const [k,c] of [["down","--down"],["up","--up"]]){ const s=series[k]; if(s.length<2) continue; const step=W/(s.length-1), col=css(c);
    sx.beginPath(); s.forEach((v,i)=>{const x=i*step,y=H-4-(H-8)*v/m; i?sx.lineTo(x,y):sx.moveTo(x,y)});
    sx.save(); sx.shadowColor=col+"88"; sx.shadowBlur=10; sx.strokeStyle=col; sx.lineWidth=3; sx.lineJoin="round"; sx.stroke(); sx.restore();
    sx.lineTo(W,H); sx.lineTo(0,H); sx.closePath(); const gr=sx.createLinearGradient(0,0,0,H); gr.addColorStop(0,col+"44"); gr.addColorStop(1,col+"00");
    sx.fillStyle=gr; sx.fill() }
}
function setStep(active){ // active: "ping"|"down"|"up"|"done"|null
  const order=["ping","down","up"], idx=order.indexOf(active);
  [["stPing",0],["stDown",1],["stUp",2]].forEach(([id,i])=>{ const el=$(id); el.classList.toggle("on",i===idx);
    el.classList.toggle("done",active==="done"||(idx>i)) });
}

/* =================== Measurement: shared sampler =================== */
function sampler(onTick,dir){
  let bytes=0; const t0=performance.now(), pts=[];
  const iv=setInterval(()=>{ const t=performance.now()-t0; pts.push([t,bytes]);
    const w=pts.find(p=>p[0]>=t-2000); const rate=t>w[0]?(bytes-w[1])/((t-w[0])/1000):0; onTick(rate) },200);
  return {add:n=>{bytes+=n; if(dir) tel.bytes[dir]+=n},
    stop(){ clearInterval(iv); const end=performance.now()-t0, p0=pts.find(p=>p[0]>=end*0.25)||[0,0];
      return end>p0[0]?(bytes-p0[1])/((end-p0[0])/1000):NaN }};
}
function randomBytes(n){ const b=new Uint8Array(n); for(let i=0;i<n;i+=65536) crypto.getRandomValues(b.subarray(i,Math.min(i+65536,n))); return b }

/* =================== HTTP servers (Cloudflare, LibreSpeed, custom) =================== */
async function httpPing(s,n){
  const out=[]; for(let i=0;i<n;i++){ try{const v=await pingURL(s.ping()); out.push(v); if(i) telPing(v)}catch{throw new Error(`${s.name} isn't answering. Pick another server`)} }
  out.shift(); const jit=out.slice(1).reduce((a,v,i)=>a+Math.abs(v-out[i]),0)/Math.max(out.length-1,1);
  return {ping:median(out),jitter:jit};
}
async function httpDown(s,streams,secs,tick){
  const S=sampler(tick,"down"), ctl=new AbortController(), until=performance.now()+secs*1000;
  linkStop(ctl); const hardEnd=setTimeout(()=>ctl.abort(),secs*1000+500);
  const worker=async()=>{ while(performance.now()<until&&!ctl.signal.aborted){
    let r; try{ r=await fetch(s.down(25e6),{cache:"no-store",signal:ctl.signal}) }
    catch(e){ if(e.name==="AbortError") return; throw new Error(`${s.name} doesn't allow browser downloads. Pick another server`) }
    if(!r.ok) throw new Error(`${s.name} returned HTTP ${r.status}. Pick another server`);
    const rd=r.body.getReader();
    try{ while(true){ const {done,value}=await rd.read(); if(done) break; S.add(value.byteLength); if(performance.now()>=until){ctl.abort();return} } }
    catch(e){ if(e.name==="AbortError") return; throw e }
  }};
  try{ await Promise.all(Array.from({length:streams},worker)) } finally{ clearTimeout(hardEnd) }
  if(stopped()){ S.stop(); throw new Error(STOPPED) }
  const v=S.stop(); if(!fin(v)||v<=0) throw new Error(`${s.name} sent no data. Pick another server`);
  return v;
}
// Upload: plain POSTs that need no permission from the server, timed to completion; size adapts to ~0.6 s each.
async function httpUp(s,streams,secs,tick){
  const S=sampler(tick,"up"), until=performance.now()+secs*1000, pool=new Blob([randomBytes(32e6)]);
  let fails=0;
  const worker=async()=>{ let size=256e3;
    while(performance.now()<until&&!stopped()){
      const off=Math.floor(Math.random()*(pool.size-size)), body=pool.slice(off,off+size,"text/plain"), t=performance.now();
      // each request must finish by the phase end (+3 s grace) or it is abandoned and not counted
      const rc=new AbortController(); linkStop(rc);
      const tmo=setTimeout(()=>rc.abort(),Math.max(3000,until-performance.now()+3000));
      try{ await fetch(s.up(),{method:"POST",body,mode:"no-cors",cache:"no-store",signal:rc.signal}); fails=0 }
      catch(e){ clearTimeout(tmo); if(stopped()||e.name==="AbortError") return;
        if(++fails>=3) throw new Error(`Upload to ${s.name} failed. Pick another server`); await sleep(300); continue }
      clearTimeout(tmo);
      S.add(size);
      const rate=size/Math.max((performance.now()-t)/1000,0.001), left=Math.max(0.2,(until-performance.now())/1000);
      size=Math.floor(Math.max(128e3,Math.min(32e6,rate*0.6,rate*left)));
    }};
  await Promise.all(Array.from({length:streams},worker));
  if(stopped()){ S.stop(); throw new Error(STOPPED) }
  const v=S.stop(); return fin(v)&&v>0?v:NaN; // NaN = no upload request completed in time
}

/* =================== M-Lab ndt7 (WebSocket) =================== */
const NDT_PROTO="net.measurementlab.ndt.v7";
async function mlabLocate(){
  let j; try{ const r=await fetch("https://locate.measurementlab.net/v2/nearest/ndt/ndt7?client_name=cleanspeed-web&client_version=3.0",{cache:"no-store"}); j=await r.json() }
  catch{ throw new Error("Couldn't reach M-Lab's server finder. Pick another server") }
  const r=(j.results||[])[0]; if(!r) throw new Error("M-Lab has no server available right now. Pick another server");
  const add=u=>u+(u.includes("?")?"&":"?")+"client_name=cleanspeed-web&client_version=3.0";
  return {machine:r.machine||"",site:[r.location&&r.location.city,r.location&&r.location.country].filter(Boolean).join(", ")||r.machine,
    down:add(r.urls["wss:///ndt/v7/download"]), up:add(r.urls["wss:///ndt/v7/upload"])};
}
function mlabDown(url,tick){
  return new Promise((res,rej)=>{
    const S=sampler(tick,"down"), rtt=[], rttvar=[], minrtt=[]; let opened=false, settled=false;
    const ws=new WebSocket(url,NDT_PROTO); ws.binaryType="arraybuffer";
    if(testCtl) testCtl.signal.addEventListener("abort",()=>{ if(!settled){ settled=true; clearTimeout(kill); ws.close(); rej(new Error(STOPPED)) } },{once:true});
    const kill=setTimeout(()=>ws.close(),15000);
    ws.onopen=()=>{opened=true};
    ws.onmessage=e=>{
      if(typeof e.data==="string"){ S.add(e.data.length);
        try{ const ti=JSON.parse(e.data).TCPInfo; if(ti){ if(ti.RTT){ rtt.push(ti.RTT/1000); telPing(ti.RTT/1000) } if(ti.RTTVar) rttvar.push(ti.RTTVar/1000); if(ti.MinRTT) minrtt.push(ti.MinRTT/1000) } }catch{}
      } else S.add(e.data.byteLength);
    };
    const done=()=>{ if(settled) return; settled=true; clearTimeout(kill);
      if(!opened) return rej(new Error("M-Lab download connection was refused. Pick another server"));
      res({bps:S.stop(), ping:minrtt.length?Math.min(...minrtt):NaN, jitter:median(rttvar), loaded:median(rtt)}) };
    ws.onclose=done; ws.onerror=()=>{ if(!opened){ settled=true; clearTimeout(kill); rej(new Error("M-Lab download connection failed. Pick another server")) } };
  });
}
function mlabUp(url,tick){
  return new Promise((res,rej)=>{
    const S=sampler(tick,"up"), pool=randomBytes(1<<24); let size=8192, sent=0, acked=0, t0=0, opened=false, settled=false;
    const ws=new WebSocket(url,NDT_PROTO); ws.binaryType="arraybuffer";
    const openT=setTimeout(()=>{ if(!opened&&!settled){ settled=true; ws.close(); rej(new Error("M-Lab upload connection timed out. Pick another server")) } },8000);
    if(testCtl) testCtl.signal.addEventListener("abort",()=>{ if(!settled){ settled=true; clearTimeout(openT); ws.close(); rej(new Error(STOPPED)) } },{once:true});
    const finish=()=>{ if(settled) return; settled=true; S.add(Math.max(0,(sent-ws.bufferedAmount)-acked)); res(S.stop()) };
    const pump=()=>{
      if(settled||ws.readyState!==1) return;
      if(performance.now()-t0>=10000){ finish(); ws.close(); return }
      while(ws.bufferedAmount<7*size){ ws.send(pool.subarray(0,size)); sent+=size; if(size<(1<<24)&&size<=sent/16) size*=2 }
      const a=sent-ws.bufferedAmount; S.add(a-acked); acked=a; setTimeout(pump,10);
    };
    ws.onopen=()=>{opened=true; clearTimeout(openT); t0=performance.now(); pump()};
    ws.onclose=()=>{ if(!opened&&!settled){ settled=true; clearTimeout(openT); return rej(new Error("M-Lab upload connection was refused. Pick another server")) } finish() };
    ws.onerror=()=>{ if(!opened&&!settled){ settled=true; rej(new Error("M-Lab upload connection failed. Pick another server")) } };
  });
}

/* =================== Loaded-latency probe =================== */
const PROBE="https://1.1.1.1/cdn-cgi/trace";
async function probeBaseline(){
  const out=[]; for(let i=0;i<6;i++){ try{out.push(await pingURL(PROBE+"?r="+nonce(),2500))}catch{} }
  out.shift(); return median(out);
}

/* =================== Run =================== */
let last=null;
function setRunning(on){ running=on; document.body.classList.toggle("testing",on); ui.running(on); gaugeKick(); $("go").hidden=on; $("stopTest").hidden=!on; $("rtOpen").hidden=on;
  if(on) $("instrument").style.transform="";
  else { $("go").textContent="Retest"; $("go").classList.add("again"); $("go").setAttribute("aria-label","Run the speed test again") } }
async function run(){
  if(running) return;
  if(selected==="mlab"&&!$("mlabOk").checked){ $("srvPanel").hidden=false; ui.sheet(true); $("mlabConsent").hidden=false;
    $("err").textContent="M-Lab publishes your IP address. Tick the consent box under Test server, or pick another server."; return }
  if(!netPick){ $("netPick").classList.add("need"); $("err").textContent="Choose Wi-Fi, Mobile or Ethernet above, then tap GO. You only do this once.";
    setTimeout(()=>$("netPick").classList.remove("need"),3200); return }
  if(pm.on){ pmStop(); $("phase").textContent="Ping monitor paused for the speed test" }
  testCtl=new AbortController();
  setRunning(true); $("err").textContent=""; $("copyRes").disabled=true; $("copied").textContent="";
  ["dl","ul","ping","jit","lping"].forEach(i=>$(i).textContent="—"); series={down:[],up:[]}; drawSpark(); setStep(null);
  const streams=Math.min(16,Math.max(1,+$("streams").value||6)), secs=Math.min(30,Math.max(4,+$("dur").value||10));
  const res={t:Date.now(),net:connLabel()};
  const downTick=r=>{setGauge(r);series.down.push(r);drawSpark();$("dl").textContent=fmt(r);telRate("down",r)};
  const upTick=r=>{setGauge(r);series.up.push(r);drawSpark();$("ul").textContent=fmt(r);telRate("up",r)};
  telStart();
  try{
    let s=selected==="auto"?await pickAuto():byId(selected);
    if(!s){ selected="auto"; s=await pickAuto() }
    res.server=s.name; telServer(s);
    if(s.kind==="ndt7"){
      setStep("ping"); $("phase").textContent="Locating nearest M-Lab server";
      const loc=await mlabLocate(); res.server=`M-Lab ${loc.site}`; $("srvName").textContent=res.server; telServer(s,loc);
      setStep("down"); telPhase("down"); $("phase").textContent="Testing download"; phaseColor="--down";
      const d=await mlabDown(loc.down,downTick); Object.assign(res,{down:d.bps,ping:d.ping,jitter:d.jitter,lping:d.loaded});
      setGauge(0); await sleep(400);
      setStep("up"); telPhase("up"); $("phase").textContent="Testing upload"; phaseColor="--up";
      res.up=await mlabUp(loc.up,upTick);
    } else {
      $("srvName").textContent=s.name+(selected==="auto"?" (auto)":"");
      setStep("ping"); telPhase("ping"); $("phase").textContent="Measuring latency";
      const p=await httpPing(s,12); res.ping=p.ping; res.jitter=p.jitter;
      $("ping").textContent=p.ping.toFixed(1); $("jit").textContent=p.jitter.toFixed(1);
      // Loaded latency is probed on a different host, so the probe never queues behind this test's own
      // download on the same browser connection. Rise over that host's idle baseline = queueing on your line.
      const base=await probeBaseline(), probe=fin(base)?()=>PROBE+"?r="+nonce():s.ping;
      const lp=[]; let probing=true;
      setStep("down"); telPhase("down"); $("phase").textContent="Testing download"; phaseColor="--down";
      // live ping during load = idle ping + queueing rise measured on the separate probe connection
      const shift=fin(base)?res.ping-base:0;
      (async()=>{ while(probing){ try{const v=await pingURL(probe(),3000); lp.push(v); telPing(Math.max(res.ping,v+shift))}catch{} await sleep(350) } })();
      res.down=await httpDown(s,streams,secs,downTick); probing=false;
      const rise=median(lp)-(fin(base)?base:res.ping);
      res.lping=fin(rise)?res.ping+Math.max(0,rise):NaN;
      setGauge(0); await sleep(400);
      setStep("up"); telPhase("up"); $("phase").textContent="Testing upload"; phaseColor="--up";
      let probingUp=true;
      (async()=>{ while(probingUp){ try{const v=await pingURL(probe(),3000); telPing(Math.max(res.ping,v+shift))}catch{} await sleep(350) } })();
      try{ res.up=await httpUp(s,streams,secs,upTick) } finally{ probingUp=false }
      if(!fin(res.up)) $("err").textContent=`Upload couldn't be measured: ${s.name} didn't confirm any upload in time. Download and ping were saved. Try another server under Change server.`;
    }
    setGauge(0); setStep("done"); telEnd(true,res);
    showResult(res);
    $("phase").textContent="Done. Tap Retest to test again.";
    const h=store.get("history",[]); h.unshift(res); store.set("history",h.slice(0,300));
    last=res; $("copyRes").disabled=false;
    if(res.net==="Mobile data") $("cmpType").value="mobile"; else if(res.net==="Wi-Fi"||res.net==="Ethernet") $("cmpType").value="fixed";
    renderHist(); fillWhich(); $("cmpWhich").value="0"; renderAll();
  }catch(e){
    setGauge(0); setStep(null); telEnd(false);
    if(e&&e.message===STOPPED||stopped()){ $("phase").textContent="Stopped. Tap Retest to run again."; $("err").textContent="" }
    else { $("phase").textContent="Stopped. Tap Retest to try again."; $("err").textContent=e.message||String(e) }
  }finally{ testCtl=null; setRunning(false); phaseColor="--accent"; syncServerName() }
}
function showResult(r){
  $("dl").textContent=fmt(r.down); $("ul").textContent=fmt(r.up);
  $("ping").textContent=fin(r.ping)?r.ping.toFixed(1):"—"; $("jit").textContent=fin(r.jitter)?r.jitter.toFixed(1):"—";
  $("lping").textContent=fin(r.lping)?r.lping.toFixed(1):"—";
}

/* =================== Global comparison data =================== */
// Ookla Speedtest Global Index country medians, March 2026 (download, Mbps), via bizolaunch.com compilation.
// Global medians: November 2025 (ISPreview via bizolaunch.com). Replace this block to update.
const DATA_SOURCE="Ookla Speedtest Global Index · country medians March 2026 · global medians November 2025 (compiled by bizolaunch.com). Medians of Speedtest results, not guaranteed speeds.";
const GLOBAL={mobile:{down:93.47,up:13.23},fixed:{down:106.84,up:56.95}};
const COUNTRIES=`SG Singapore 197.89 425.46|AE United Arab Emirates 644.66 384.51|HK Hong Kong 89.43 352.40|FR France 152.50 352.35|CL Chile 82.21 334.99|US United States 213.29 309.80|CH Switzerland 124.08 292.56|DK Denmark 192.16 291.60|RO Romania 87.32 283.06|VN Vietnam 200.54 281.72|IL Israel 65.96 281.29|TH Thailand 137.98 279.65|ES Spain 92.32 277.98|CA Canada 110.92 277.70|TW Taiwan 117.38 270.85|PE Peru 40.02 258.37|KR South Korea 265.20 257.76|JP Japan 70.28 255.27|HU Hungary 93.03 251.72|PT Portugal 137.64 243.84|NL Netherlands 178.00 237.66|KW Kuwait 372.76 230.24|PL Poland 122.33 223.25|BR Brazil 265.79 221.53|LU Luxembourg 173.19 221.23|IE Ireland 79.12 220.71|PA Panama 33.26 219.49|LT Lithuania 134.23 218.67|CO Colombia 45.09 214.30|SE Sweden 161.70 213.29|QA Qatar 576.06 211.97|CN China 156.98 206.91|NZ New Zealand 122.18 201.91|SI Slovenia 145.54 200.99|JO Jordan 45.86 194.10|FI Finland 164.00 180.47|NO Norway 167.28 177.11|GB United Kingdom 75.91 172.24|EC Ecuador 62.93 169.66|CR Costa Rica 69.43 169.03|MY Malaysia 153.20 168.07|SA Saudi Arabia 226.53 167.93|CY Cyprus 104.48 165.55|AU Australia 116.84 154.09|MD Moldova 61.14 153.46|LV Latvia 157.04 146.87|BH Bahrain 274.94 145.88|ME Montenegro 104.59 144.78|BE Belgium 134.77 140.97|HR Croatia 138.90 136.75|PY Paraguay 26.22 118.56|IT Italy 92.81 117.11|SK Slovakia 122.09 114.33|AT Austria 114.61 114.00|AR Argentina 62.64 111.54|PH Philippines 58.24 109.86|SV El Salvador 40.97 108.77|MX Mexico 44.08 104.25|DE Germany 74.58 103.72|RS Serbia 164.60 102.35|VE Venezuela 29.39 100.11|OM Oman 169.87 96.05|EE Estonia 188.58 95.32|BG Bulgaria 221.03 94.44|GR Greece 144.40 94.29|UZ Uzbekistan 55.19 93.35|GT Guatemala 58.38 92.98|CZ Czechia 101.52 92.71|EG Egypt 49.42 92.50|UA Ukraine 51.61 92.24|HN Honduras 42.77 92.00|AZ Azerbaijan 95.43 91.37|BY Belarus 29.89 90.61|BN Brunei 253.69 90.29|XK Kosovo 151.95 89.32|KZ Kazakhstan 93.68 88.10|KG Kyrgyzstan 52.64 87.14|AM Armenia 77.50 84.16|TR Turkey 110.40 80.02|SR Suriname 57.83 74.20|BO Bolivia 15.24 67.01|BD Bangladesh 42.45 66.02|IN India 126.73 60.85|DZ Algeria 64.05 59.95|MK North Macedonia 166.15 56.88|LA Laos 44.63 56.30|MA Morocco 77.54 56.22|KH Cambodia 181.12 53.08|ZA South Africa 68.09 48.90|ID Indonesia 62.09 45.91|GE Georgia 161.23 44.73|IQ Iraq 64.74 44.19|LK Sri Lanka 57.14 38.61|NG Nigeria 50.53 36.81|BA Bosnia and Herzegovina 28.41 36.80|IR Iran 57.23 26.00|TZ Tanzania 32.34 23.84|TN Tunisia 52.84 20.24|LB Lebanon 40.62 19.90|PK Pakistan 26.46 17.90|KE Kenya 48.78 16.48|LY Libya 22.89 11.65|AF Afghanistan 15.91 4.93|SY Syria 28.27 4.24`
 .split("|").map(r=>{const p=r.split(" "); return {code:p[0],name:p.slice(1,-2).join(" "),mobile:+p[p.length-2],fixed:+p[p.length-1]}});

function initCompare(){
  const sel=$("cmpCountry");
  sel.innerHTML=`<option value="">World only</option>`+[...COUNTRIES].sort((a,b)=>a.name.localeCompare(b.name)).map(c=>`<option value="${c.code}">${esc(c.name)}</option>`).join("");
  const region=(navigator.languages||[navigator.language]).map(l=>(l.split("-")[1]||"").toUpperCase()).find(r=>COUNTRIES.some(c=>c.code===r));
  sel.value=store.get("cmpCountry",region||"");
  $("cmpSrc").textContent="Source: "+DATA_SOURCE+" Your result is measured to one server; national medians pool millions of tests, so treat this as a guide.";
}
function fillWhich(){
  const h=store.get("history",[]); const sel=$("cmpWhich"), keep=sel.value;
  sel.innerHTML=h.slice(0,30).map((r,i)=>`<option value="${i}">${i===0?"Latest · ":""}${new Date(r.t).toLocaleString([],{dateStyle:"short",timeStyle:"short"})} · ${esc(r.net)}</option>`).join("")||`<option value="">No tests yet</option>`;
  if(keep&&+keep<h.length) sel.value=keep;
}
const currentResult=()=>store.get("history",[])[+$("cmpWhich").value||0];

function renderCompare(){
  const r=currentResult(), type=$("cmpType").value, code=$("cmpCountry").value, ctry=COUNTRIES.find(c=>c.code===code);
  const glob=GLOBAL[type], label=type==="mobile"?"mobile":"broadband";
  const ranked=[...COUNTRIES].sort((a,b)=>b[type]-a[type]);
  const scale=conv(mbpsToBps(ranked[0][type])), youD=r?conv(r.down):NaN;
  let rows=ranked.map((c,i)=>({pos:i+1,name:c.name,v:conv(mbpsToBps(c[type])),code:c.code}));
  if(fin(youD)){ const pos=rows.filter(x=>x.v>youD).length; rows.splice(pos,0,{pos:"",name:"You",v:youD,you:1}) }
  const box=$("cmpRank");
  box.innerHTML=rows.map(x=>`<div class="hbar${x.you?" you":""}${x.code&&x.code===code?" mine":""}"><span class="pos">${x.pos}</span><span class="who" title="${esc(x.name)}">${esc(x.name)}</span><span class="track"><span class="fill" style="width:${Math.min(100,Math.max(.5,100*x.v/scale)).toFixed(1)}%"></span></span><span class="num">${fmtNum(x.v)} ${unitLabel()}</span></div>`).join("");
  const you=box.querySelector(".you"); if(you) box.scrollTop=Math.max(0,you.offsetTop-box.offsetTop-box.clientHeight/2);
  if(!r){ $("cmpBars").innerHTML=""; $("verdict").textContent="Run a test to see how your connection compares with your country and the world."; return }
  const ctryB=ctry?mbpsToBps(ctry[type]):null;
  const dmax=Math.max(...[r.down,ctryB||0,mbpsToBps(glob.down)].filter(Number.isFinite)), umax=Math.max(...[r.up,mbpsToBps(glob.up)].filter(Number.isFinite));
  const bar=(who,bps,max,isYou)=>`<div class="hbar${isYou?" you":""}"><span class="who" title="${esc(who)}">${esc(who)}</span><span class="track"><span class="fill" style="width:${fin(bps)?Math.max(.5,100*bps/max).toFixed(1):0}%"></span></span><span class="num">${fmt(bps)}</span></div>`;
  $("cmpBars").innerHTML=`<div class="lbl">Download · ${unitLabel()}</div>`+bar("You",r.down,dmax,1)+(ctry?bar(ctry.name,ctryB,dmax):"")+bar("World",mbpsToBps(glob.down),dmax)
    +`<div class="lbl" style="margin-top:8px">Upload · ${unitLabel()}</div>`+bar("You",r.up,umax,1)+bar("World",mbpsToBps(glob.up),umax);
  const beat=COUNTRIES.filter(c=>mbpsToBps(c[type])<r.down).length, xG=r.down/mbpsToBps(glob.down);
  const times=x=>x>=1?x.toFixed(1)+"×":Math.round(x*100)+"% of";
  let v=`Your download is <strong>${times(xG)} the world ${label} median</strong>`;
  if(ctry) v+=` and ${times(r.down/ctryB)} ${esc(ctry.name)}'s`;
  v+=`. That beats the national ${label} median of ${beat} of ${COUNTRIES.length} countries.`;
  if(fin(r.up)) v+=` Upload is ${times(r.up/mbpsToBps(glob.up))} the world median.`;
  if((type==="mobile"&&r.net==="Wi-Fi")||(type==="fixed"&&r.net==="Mobile data")) v+=` <span style="color:var(--ok)">This test was tagged ${esc(r.net)}; switch "Compare as" for a like-for-like view.</span>`;
  $("verdict").innerHTML=v;
}

/* =================== Infographics =================== */
const ICONS={
  web:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
  hd:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M10 9l5 2-5 2z"/><path d="M8 21h8"/>',
  k4:'<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M7 13V8l-2 3h4M12 8v5M15 8l-3 2.5 3 2.5"/><path d="M8 21h8"/>',
  call:'<rect x="2" y="6" width="13" height="12" rx="2"/><path d="M15 10l6-3v10l-6-3z"/>',
  game:'<path d="M6 8h12a4 4 0 0 1 3.6 5.7l-1.2 2.6a2 2 0 0 1-3.3.4L15.5 15h-7l-1.6 1.7a2 2 0 0 1-3.3-.4l-1.2-2.6A4 4 0 0 1 6 8z"/><path d="M8 10.5v3M6.5 12h3M16 11h.01M18 13h.01"/>',
  cloud:'<path d="M7 18a4 4 0 0 1-.6-8 6 6 0 0 1 11.6 1.5A3.5 3.5 0 0 1 17.5 18z"/><path d="M12 15V10m0 0l-2.5 2.5M12 10l2.5 2.5"/>'
};
function readiness(r){
  const d=r?bpsToMbps(r.down):NaN, u=r?bpsToMbps(r.up):NaN, p=r?r.ping:NaN, j=r?r.jitter:NaN;
  const lvl=(good,ok)=>good?"good":ok?"ok":"bad";
  const has=fin(d);
  return [
    ["web","Browsing & email",!has?"na":lvl(d>=5,d>=1)],
    ["hd","HD streaming",!has?"na":lvl(d>=8,d>=5)],
    ["k4","4K streaming",!has?"na":lvl(d>=25,d>=15)],
    ["call","HD video calls",!has||!fin(u)?"na":lvl(d>=3.8&&u>=3&&(!fin(p)||p<100)&&(!fin(j)||j<30), d>=1.5&&u>=1.5)],
    ["game","Online gaming",!fin(p)?"na":lvl(p<50&&(!fin(j)||j<15)&&d>=3, p<100&&(!fin(j)||j<30))],
    ["cloud","Cloud backup & uploads",!fin(u)?"na":lvl(u>=20,u>=5)]
  ];
}
function renderInsights(){
  const r=currentResult();
  const label={good:"Great",ok:"Workable",bad:"Struggles",na:"Not measured"};
  $("acts").innerHTML=readiness(r).map(([ic,t,s])=>`<div class="act ${s}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[ic]}</svg><div><div class="t">${t}</div><div class="s">${r?label[s]:"Run a test"}</div></div></div>`).join("");
  // bufferbloat grade: rise from idle to loaded ping
  const arc=$("gradeArc"), C=2*Math.PI*54;
  if(r&&fin(r.ping)&&fin(r.lping)){
    const rise=Math.max(0,r.lping-r.ping);
    const [L,frac,col,txt]=rise<5?["A+",1,"--good","Excellent"]:rise<30?["A",.85,"--good","Very good"]:rise<60?["B",.68,"--good","Good"]:rise<200?["C",.5,"--ok","Fair"]:rise<400?["D",.32,"--bad","Poor"]:["F",.15,"--bad","Very poor"];
    arc.setAttribute("stroke-dasharray",`${(C*frac).toFixed(1)} ${C.toFixed(1)}`); arc.setAttribute("stroke",css(col));
    $("gradeLetter").textContent=L;
    $("gradeNote").textContent=`${txt}: ping rose ${rise.toFixed(0)} ms under load (${r.ping.toFixed(0)} → ${r.lping.toFixed(0)} ms). Lower is better for calls and games.`;
  } else { arc.setAttribute("stroke-dasharray",`0 ${C}`); $("gradeLetter").textContent="–";
    $("gradeNote").textContent="Shows how much your ping rises while the line is busy (bufferbloat)." }
  // world ruler (log scale across national medians)
  const type=$("cmpType").value, code=$("cmpCountry").value, vals=COUNTRIES.map(c=>c[type]);
  const yourM=r?bpsToMbps(r.down):NaN, lo=Math.min(...vals), hi=Math.max(...vals, fin(yourM)?yourM:0);
  const x=m=>(100*(Math.log(Math.max(m,lo))-Math.log(lo))/(Math.log(hi)-Math.log(lo)));
  let html='<div class="bar"></div>'+vals.map(m=>`<span class="tick" style="left:${x(m).toFixed(2)}%"></span>`).join("");
  html+=`<span class="mk" style="left:${x(GLOBAL[type].down).toFixed(2)}%">World</span>`;
  const ctry=COUNTRIES.find(c=>c.code===code);
  if(ctry&&Math.abs(x(ctry[type])-x(GLOBAL[type].down))>9) html+=`<span class="mk" style="left:${x(ctry[type]).toFixed(2)}%">${esc(ctry.name.length>12?ctry.code:ctry.name)}</span>`;
  if(fin(yourM)) html+=`<span class="mk you" style="left:${Math.min(98,Math.max(2,x(yourM))).toFixed(2)}%">You</span>`;
  $("ruler").innerHTML=html;
  $("rulerMin").textContent=fmt(mbpsToBps(lo))+" "+unitLabel(); $("rulerMax").textContent=fmt(mbpsToBps(Math.max(...vals)))+" "+unitLabel();
  if(fin(yourM)){ const beat=vals.filter(v=>v<yourM).length, pct=Math.round(100*beat/vals.length);
    $("pctNum").textContent=`Top ${Math.max(1,100-pct)}%`;
    $("pctNote").textContent=`Faster than the ${type==="mobile"?"mobile":"broadband"} median of ${beat} of ${vals.length} countries.` }
  else { $("pctNum").textContent="—"; $("pctNote").textContent="Run a test to place your download among 104 national medians." }
}

/* =================== History =================== */
function renderHist(){
  const f=$("histFilter").value, h=store.get("history",[]).filter(r=>!f||r.net===f);
  $("rows").innerHTML=h.length?h.map(r=>`<tr><td>${new Date(r.t).toLocaleString()}</td><td><select class="netfix" data-t="${esc(String(r.t))}" aria-label="Network for this test">${["Wi-Fi","Mobile data","Ethernet","Unknown"].map(o=>`<option${o===r.net?" selected":""}>${o}</option>`).join("")}</select></td><td>${fmt(r.down)} ${unitLabel()}</td><td>${fmt(r.up)} ${unitLabel()}</td>
    <td>${fin(r.ping)?r.ping.toFixed(1)+" ms":"—"}</td><td>${fin(r.jitter)?r.jitter.toFixed(1)+" ms":"—"}</td><td>${fin(r.lping)?r.lping.toFixed(1)+" ms":"—"}</td><td>${esc(r.server||"")}</td></tr>`).join("")
    :`<tr><td colspan="8" style="color:var(--muted)">No tests yet. Results are kept only in this browser.</td></tr>`;
  drawTrend(h.slice(0,20).reverse());
}
function drawTrend(h){
  const c=$("trend"), x=c.getContext("2d"), W=c.width, H=c.height, L=90, B=40, T=16, Rp=16; x.clearRect(0,0,W,H);
  x.font=`500 20px ${css("--mono")}`; x.fillStyle=css("--muted"); x.textBaseline="middle";
  if(h.length<2){ x.textAlign="center"; x.fillText(h.length?"Run one more test to see a trend":"Your speed trend appears here after two tests",W/2,H/2); return }
  const vals=h.flatMap(r=>[conv(r.down),conv(r.up)]).filter(Number.isFinite), m=Math.max(...vals)*1.1||1;
  const px=i=>L+(W-L-Rp)*i/(h.length-1), py=v=>T+(H-T-B)*(1-v/m);
  x.strokeStyle=css("--track"); x.lineWidth=1; x.textAlign="right";
  for(let i=0;i<=4;i++){ const v=m*i/4, y=py(v); x.beginPath(); x.moveTo(L,y); x.lineTo(W-Rp,y); x.stroke(); x.fillText(fmtNum(v),L-10,y) }
  x.textAlign="center"; x.fillText(new Date(h[0].t).toLocaleDateString(),px(0)+40,H-14); x.fillText(new Date(h[h.length-1].t).toLocaleDateString(),px(h.length-1)-40,H-14);
  for(const [k,col] of [["down","--down"],["up","--up"]]){ const cc=css(col);
    x.beginPath(); let started=false; h.forEach((r,i)=>{const v=conv(r[k]); if(!fin(v)) return; started?x.lineTo(px(i),py(v)):x.moveTo(px(i),py(v)); started=true});
    x.strokeStyle=cc; x.lineWidth=3; x.lineJoin="round"; x.stroke();
    h.forEach((r,i)=>{const v=conv(r[k]); if(!fin(v)) return; x.fillStyle=cc; x.beginPath(); x.arc(px(i),py(v),i===h.length-1?8:5,0,Math.PI*2); x.fill()});
  }
}
function csvText(){
  const n=v=>fin(v)?v.toFixed(2):"", q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const rows=store.get("history",[]);
  return ["timestamp,network,download_Bps,upload_Bps,download_Mbps,upload_Mbps,ping_ms,jitter_ms,loaded_ping_ms,server",
    ...rows.map(r=>[new Date(r.t).toISOString(),q(r.net),n(r.down),n(r.up),n(bpsToMbps(r.down)),n(bpsToMbps(r.up)),n(r.ping),n(r.jitter),n(r.lping),q(r.server)].join(","))].join("\r\n");
}
// Export: share sheet on phones (Save to Files, Mail, WhatsApp...), file download elsewhere, copy as last resort.
async function exportCSV(){
  const msg=$("expMsg"), rows=store.get("history",[]);
  if(!rows.length){ msg.textContent="No tests to export yet."; return }
  const text=csvText(), name=`cleanspeed-history-${new Date().toISOString().slice(0,10)}.csv`;
  const blob=new Blob(["\ufeff"+text],{type:"text/csv"}); // BOM so Excel reads UTF-8 correctly
  const touch=matchMedia("(pointer:coarse)").matches;
  try{
    const file=new File([blob],name,{type:"text/csv"});
    if(touch&&navigator.canShare&&navigator.canShare({files:[file]})){
      await navigator.share({files:[file],title:"CleanSpeed history"});
      msg.textContent=`Shared ${rows.length} test${rows.length>1?"s":""}.`; return;
    }
  }catch(e){ if(e&&e.name==="AbortError"){ msg.textContent="Export cancelled."; return } }
  try{
    const url=URL.createObjectURL(blob), a=document.createElement("a");
    a.href=url; a.download=name; a.rel="noopener"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    msg.textContent=`Saved ${name} (${rows.length} test${rows.length>1?"s":""}). Check your Downloads.`; return;
  }catch{}
  const ta=$("csv"); ta.value=text; ta.hidden=false; ta.focus(); ta.select();
  try{ await navigator.clipboard.writeText(text); msg.textContent="Your browser blocked the file, so the CSV was copied. Paste it into Notes or a spreadsheet." }
  catch{ msg.textContent="Your browser blocked the file. Select the text below and copy it." }
}
function copyResult(){
  if(!last) return;
  const t=`CleanSpeed · ${new Date(last.t).toLocaleString()} · ${last.net}\nDownload ${fmt(last.down)} ${unitLabel()} · Upload ${fmt(last.up)} ${unitLabel()}\nPing ${fin(last.ping)?last.ping.toFixed(1):"—"} ms · Jitter ${fin(last.jitter)?last.jitter.toFixed(1):"—"} ms · Server ${last.server}`;
  const fallback=()=>{$("csv").value=t;$("csv").hidden=false;$("csv").select()};
  if(navigator.clipboard) navigator.clipboard.writeText(t).then(()=>$("copied").textContent="Copied",fallback); else fallback();
}

/* =================== Router security check =================== */
const RT_Q=[
 {id:"pw",q:"Admin password changed from the default",sev:"critical",fix:"Log in to the router's admin page and set a long, unique admin password, not the one printed on the label."},
 {id:"remote",q:"Remote management (admin from the internet) is off",sev:"critical",fix:"Turn off Remote Management, WAN access or cloud admin unless you truly need it."},
 {id:"wps",q:"WPS (push-button or PIN pairing) is off",sev:"high",fix:"Turn off WPS. Its PIN can be guessed in hours."},
 {id:"fw",q:"Firmware updated in the last 6 months, or auto-update is on",sev:"high",fix:"Install the latest firmware from the router's Firmware Upgrade menu or the maker's support page, and turn on auto-update if offered."},
 {id:"eol",q:"The maker still releases updates for this model",sev:"high",fix:"If the model no longer gets updates, plan to replace it. Unpatched routers are a top target for botnets."},
 {id:"upnp",q:"UPnP is off (or needed for a specific console)",sev:"medium",fix:"Turn off UPnP so devices and malware can't open ports on their own."},
 {id:"pf",q:"Every port-forwarding rule is one you recognise",sev:"medium",fix:"Delete port-forwarding, virtual-server and DMZ entries you don't recognise."},
 {id:"guest",q:"Visitors and smart-home devices use a guest network",sev:"medium",fix:"Create a guest network and move cameras, TVs and smart plugs onto it."},
 {id:"devices",q:"You know every device in the connected-devices list",sev:"low",fix:"Open the connected-devices (DHCP) list, block anything unknown, then change the Wi-Fi password."},
 {id:"ssid",q:"Wi-Fi name doesn't reveal the router brand or your name",sev:"low",fix:"Rename the Wi-Fi network. Default names tell attackers which model to target."}
];
const RT_W={critical:[25,12],high:[15,7],medium:[8,4],low:[4,2]};
// Steps are generic; a menu path is added only for the person's own brand (see BRAND_PATH), never another maker's.
const BRAND_PATH={
 "tp-link":{pw:"Advanced → System → Administration",remote:"Advanced → System → Administration → Remote Management",wps:"Advanced → Wireless → WPS",fw:"Advanced → System → Firmware Update",upnp:"Advanced → NAT Forwarding → UPnP",pf:"Advanced → NAT Forwarding → Virtual Servers",guest:"Advanced → Guest Network",enc:"Advanced → Wireless → Wireless Settings"},
 "asus":{pw:"Administration → System",remote:"Administration → System → Enable Web Access from WAN",wps:"Wireless → WPS",fw:"Administration → Firmware Upgrade",upnp:"WAN → Internet Connection → Enable UPnP",pf:"WAN → Virtual Server / Port Forwarding",guest:"Guest Network",enc:"Wireless → General"},
 "netgear":{pw:"Advanced → Administration → Set Password",remote:"Advanced → Advanced Setup → Remote Management",wps:"Advanced → Advanced Setup → Wireless Settings",fw:"Advanced → Administration → Firmware Update",upnp:"Advanced → Advanced Setup → UPnP",pf:"Advanced → Advanced Setup → Port Forwarding / Port Triggering",guest:"Guest Network",enc:"Wireless"}
};
const LOGIN="Open the router's admin page (address and default login are on the label, often 192.168.0.1 or 192.168.1.1) and sign in.";
const RT_STEPS={
 pw:{steps:[LOGIN,"Go to the administration or system section of the admin page, then the password setting.","Set a new password of at least 16 characters that you don't use anywhere else, and save it in a password manager.","If the admin username can be changed, change it from \"admin\" too.","Save, sign out, and sign back in with the new password."],
     verify:"The default password on the label no longer works."},
 remote:{steps:[LOGIN,"Find the remote management setting (it may be called Remote Access, Web Access from WAN or Cloud Management).","Turn it off. If Telnet or SSH access from WAN is listed, turn those off as well.","Save and reboot the router."],
     verify:"From mobile data (Wi-Fi off), your router's admin page should not load using your public IP address."},
 wps:{steps:[LOGIN,"Open Wireless (or Wi-Fi) settings, then WPS.","Turn WPS off for every band (2.4 GHz and 5 GHz). On some models it's called \"Wi-Fi Protected Setup\" or \"PIN\".","Save. Re-check after any reset or firmware update, as some routers switch it back on."],
     verify:"The WPS light on the router stays off, and the WPS menu shows Disabled."},
 fw:{steps:["Note your current firmware version (Status or System page).","Open the router's Firmware Upgrade page and tap Check for updates, or download the file for your exact model and hardware version from the maker's official support site.","Install only stable releases from the maker. Skip anything marked beta, preview or test, and never use third-party firmware.","Do the update over a cable if you can, and don't switch the router off until it restarts by itself.","Turn on automatic updates if the router offers it.","Run this security check again with the new version."],
     verify:"The Status page shows the new firmware version."},
 eol:{steps:["Find your exact model and hardware version on the maker's support site and look at the date of the newest firmware.","If the model is listed as end-of-life, or no update has appeared for about two years, plan to replace it with a model that supports WPA3 and automatic updates.","Until then: keep remote management, UPnP and WPS off, and use a strong admin password."],
     verify:"The maker's site shows a firmware release within the last year, or you have a replacement planned."},
 upnp:{steps:[LOGIN,"Find the UPnP setting (usually in the advanced, NAT or WAN section).","Turn UPnP off and save.","If a games console then reports strict NAT, add a single port-forwarding rule for that console instead of turning UPnP back on."],
     verify:"The UPnP page shows Disabled and its list of open ports is empty."},
 pf:{steps:[LOGIN,"Open Port Forwarding, Virtual Servers, NAT Forwarding or Port Triggering.","Delete every rule you don't recognise or no longer need.","Check the DMZ setting: turn it off unless one device truly needs it.","Save."],
     verify:"Only rules you can name a purpose for remain."},
 guest:{steps:[LOGIN,"Open Guest Network (often under Wireless).","Turn it on, give it its own WPA2 or WPA3 password, and turn on the option that blocks access to your local network (isolation).","Reconnect smart TVs, cameras, smart plugs and visitors' devices to the guest network."],
     verify:"A device on the guest network can reach the internet but can't see your laptop or phone."},
 devices:{steps:[LOGIN,"Open the connected-devices list (Attached Devices, DHCP Clients or Client List).","Match each entry to a device you own; names can be odd, so compare the MAC address in each device's settings.","Copy the MAC addresses of anything you don't recognise into this app's Device lookup tool (Network toolkit) to see who made it.","Block anything unknown under Access Control or Block List.","Change the Wi-Fi password, then reconnect your own devices."],
     verify:"Every device in the list is one you can identify."},
 ssid:{steps:[LOGIN,"Open Wireless Settings and change the Network Name (SSID) on each band.","Choose a neutral name with no brand, model, house number or family name.","Save and reconnect your devices with the new name."],
     verify:"Nearby Wi-Fi lists no longer show the router's brand or model."}
};
const ENC_STEPS={steps:[LOGIN,"Open Wireless → Wireless Security (or Wi-Fi Security).","Choose WPA3-Personal, or WPA2/WPA3 mixed if older devices can't connect. Set encryption to AES (never TKIP).","Use a Wi-Fi password of at least 12 characters, save, and reconnect your devices."],
  verify:"Your phone's Wi-Fi details for this network show WPA3 or WPA2."};

// Stop-gap measures by flaw type (CWE), used alongside the permanent fix.
// Stop-gap measures by flaw type (CWE). Rule: only settings found in the router's own admin page, from the
// maker's official firmware. No beta builds, third-party firmware, scripts or workarounds outside the router.
const CWE_FIX=[
 {ids:["CWE-78","CWE-77","CWE-94","CWE-120","CWE-121","CWE-122","CWE-787","CWE-119","CWE-125","CWE-134","CWE-190"],what:"memory or command-injection flaw, usually reached through the admin page",
  steps:["Router admin page → Remote Management (or Web Access from WAN): turn it off.","Router admin page → Local Management or Access Control: allow admin access only from your own devices, if this option exists.","Router admin page → UPnP: turn it off."]},
 {ids:["CWE-79","CWE-352","CWE-601"],what:"admin-page flaw that tricks a signed-in administrator",
  steps:["Router admin page → Remote Management: turn it off.","Router admin page → Administration: set the shortest login timeout (session timeout) offered, if available."]},
 {ids:["CWE-287","CWE-306","CWE-288","CWE-290","CWE-862","CWE-863","CWE-284","CWE-639"],what:"authentication bypass: someone can get in without the password",
  steps:["Router admin page → Remote Management: turn it off, along with Cloud or app remote access if listed.","Router admin page → Local Management or Access Control: allow admin access only from your own devices, if this option exists."]},
 {ids:["CWE-798","CWE-259","CWE-521","CWE-1392","CWE-1393"],what:"built-in or weak password in the firmware",
  steps:["Router admin page → Administration or Services: turn off Telnet and SSH, if the router offers these switches.","Router admin page → Remote Management: turn it off. Changing your own password may not remove a built-in one, so the stable firmware update (or replacement) is the real fix."]},
 {ids:["CWE-22","CWE-23","CWE-200","CWE-532","CWE-215"],what:"information leak or file-access flaw",
  steps:["Router admin page → Remote Management: turn it off.","Router admin page → USB Settings: turn off file sharing, FTP and media server if you don't use them."]},
 {ids:["CWE-319","CWE-311","CWE-327"],what:"data sent without proper encryption",
  steps:["Router admin page → Administration: turn on HTTPS for local management, if offered.","Router admin page → Remote Management: turn it off."]},
 {ids:["CWE-400","CWE-770","CWE-404","CWE-835"],what:"denial-of-service flaw that can freeze or restart the router",
  steps:["Router admin page → Remote Management: turn it off.","Router admin page → Security or Firewall: turn off \"Respond to ping from WAN\" and turn on DoS protection, if offered."]}
];
// Official sites per brand: support downloads (shown as a link) and the domains whose advisories count as official.
const VENDORS={
 "tp-link":{dl:"https://www.tp-link.com/support/download/",dom:["tp-link.com"]},
 "netgear":{dl:"https://www.netgear.com/support/",dom:["netgear.com"]},
 "asus":{dl:"https://www.asus.com/support/",dom:["asus.com"]},
 "d-link":{dl:"https://support.dlink.com/",dom:["dlink.com","d-link.com","dlink.com.tw"]},
 "linksys":{dl:"https://support.linksys.com/",dom:["linksys.com"]},
 "ubiquiti":{dl:"https://www.ui.com/download",dom:["ui.com","ubnt.com"]},
 "mikrotik":{dl:"https://mikrotik.com/download",dom:["mikrotik.com"]},
 "zyxel":{dl:"https://www.zyxel.com/global/en/support",dom:["zyxel.com"]},
 "tenda":{dom:["tendacn.com","tenda.com.cn"]},"mercusys":{dom:["mercusys.com"]},"huawei":{dom:["huawei.com"]},"zte":{dom:["zte.com.cn","zte.com"]},
 "xiaomi":{dom:["mi.com","xiaomi.com"]},"draytek":{dom:["draytek.com"]},"totolink":{dom:["totolink.net"]},"netis":{dom:["netis-systems.com"]},
 "cisco":{dom:["cisco.com"]},"sagemcom":{dom:["sagemcom.com"]},"technicolor":{dom:["technicolor.com","vantiva.com"]},"arris":{dom:["arris.com","commscope.com"]},
 "synology":{dom:["synology.com"]},"eero":{dom:["eero.com"]},"google":{dom:["google.com"]},"nokia":{dom:["nokia.com"]},"digisol":{dom:["digisol.com"]}
};
const vendorKey=b=>(b||"").trim().toLowerCase().replace(/\s+/g,"-");
const vendorLink=b=>(VENDORS[vendorKey(b)]||{}).dl||null;
const BETA=/(?<![a-z])(beta|alpha|rc\d*|preview|pre-?release|test|dev)(?![a-z])|(?:\d|[._-])b\d+$/i;
function isOfficial(url,brand){
  let h; try{ const u=new URL(url); if(u.protocol!=="https:") return false; h=u.hostname.toLowerCase() }catch{ return false }
  if(BETA.test(url)) return false;
  const v=VENDORS[vendorKey(brand)];
  if(v) return v.dom.some(d=>h===d||h.endsWith("."+d));
  const slug=vendorKey(brand).replace(/[^a-z0-9]/g,""); return slug.length>2&&h.replace(/[^a-z0-9.]/g,"").includes(slug);
}
// Show build-date versions (e.g. 230216) as a date people can match against the router's Build number.
function fmtVer(v){ const m=String(v).match(/^(?:20)?(\d{2})(\d{2})(\d{2})$/);
  if(!m) return v; const d=new Date(Date.UTC(2000+ +m[1],+m[2]-1,+m[3]));
  return isNaN(d)?v:`a build dated ${d.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric",timeZone:"UTC"})} (Build 20${m[1]}${m[2]}${m[3]})` }
function oemSupport(brand){ const v=VENDORS[vendorKey(brand)]; if(!v) return null;
  return {url:v.dl||`https://www.${v.dom[0]}/`,label:`${brand} official ${v.dl?"support & downloads":"website"}`} }
function cveFix(c,r){
  const maker=r.brand||"your router's maker", dev=[r.model,r.hw].filter(Boolean).join(" "), steps=[], links=[];
  if(c.refs.length) steps.push(`${maker} has published an official advisory for this issue (linked below). Install the stable firmware release that advisory names for your exact model and hardware version${r.hw?` (${r.hw})`:""}.`);
  else steps.push(`No official ${maker} advisory is linked to this issue. Open ${maker}'s official support page for ${dev||"your model"}: if a newer stable firmware is listed, install it; if none is listed, ask ${maker} support whether a fix is planned.`);
  steps.push(`Get firmware only from ${maker}'s official website or the router's own Firmware Upgrade page, and skip anything marked beta, preview or test.`);
  if(c.st==="aff") steps.push(`If ${maker} no longer releases updates for this model, replacing the router is the only complete fix.`);
  for(const ref of c.refs) links.push({url:ref.url,label:"Official advisory · "+ref.label.split(" · ").pop()});
  const o=oemSupport(r.brand); if(o) links.push(o);
  const notes=[];
  if(c.kev) notes.push(`Listed by CISA (U.S. government) as exploited in real attacks: install ${maker}'s fix first.`);
  if((c.fixedIn||c.fixedAfter)&&BETA.test(c.fixedIn||c.fixedAfter)) notes.push(`The only fixed build on record is a pre-release. Don't install it; wait for ${maker}'s stable release.`);
  const what=(CWE_FIX.find(g=>c.cwes.some(w=>g.ids.includes(w)))||{}).what||null; // flaw type shown as information only
  return {what,steps,links:links.slice(0,4),notes};
}
const ENC={"":{w:7,fix:"Check the Wi-Fi security type in the router's Wireless Security settings; choose WPA3, or WPA2 (AES) if older devices need it."},
  wpa3:{w:0},mixed:{w:0},wpa2:{w:3,fix:"Switch Wi-Fi security to WPA3 (or WPA2/WPA3 mixed) if all your devices support it."},
  tkip:{w:15,fix:"Change Wi-Fi security from WPA/TKIP to WPA2 (AES) or WPA3. TKIP is broken."},
  open:{w:30,fix:"Your Wi-Fi is open or uses WEP, which anyone nearby can break in minutes. Switch to WPA2 (AES) or WPA3 now and set a strong password."}};
let rtAnswers={};
function rtLoad(){
  const r=store.get("router",{}); ["Brand","Model","Hw","Fw"].forEach(k=>$("rt"+k).value=r[k]||""); $("rtEnc").value=r.enc||""; rtAnswers=r.answers||{};
  $("rtQs").innerHTML=RT_Q.map(q=>`<div class="q"><span>${esc(q.q)}</span><div class="seg" data-q="${q.id}" role="group" aria-label="${esc(q.q)}">${["yes","no","unsure"].map(v=>`<button data-v="${v}" aria-pressed="${rtAnswers[q.id]===v}">${{yes:"Yes",no:"No",unsure:"Not sure"}[v]}</button>`).join("")}</div></div>`).join("");
}
function rtSave(){ store.set("router",{Brand:$("rtBrand").value.trim(),Model:$("rtModel").value.trim(),Hw:$("rtHw").value.trim(),Fw:$("rtFw").value.trim(),enc:$("rtEnc").value,answers:rtAnswers}) }

// --- version handling ---
const numTokens=v=>(String(v).match(/\d+/g)||[]).map(Number);
function buildNo(v){ const m=String(v).match(/(?:^|\D)(20\d{6}|\d{6})(?=\D|$)/); return m?+(m[1].length===8?m[1].slice(2):m[1]):null }
function cmpV(user,bound){ // <0 user older, 0 same, >0 user newer, null = can't compare
  if(/^\d{6,8}$/.test(bound)){ const u=buildNo(user); if(u==null) return null; const b=+(bound.length===8?bound.slice(2):bound); return u-b }
  const b=numTokens(bound), u=numTokens(String(user).replace(/build.*$/i,"")); if(!b.length||!u.length) return null;
  for(let i=0;i<b.length;i++){ const d=(u[i]??0)-b[i]; if(d) return d } return 0;
}
function modelRegex(model){
  const t=model.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"));
  return t.length?new RegExp("(?<![a-z0-9])"+t.join("[\\s_\\-]*")+"(?![a-z0-9])","i"):null;
}
// Makers often run parallel firmware lines (e.g. 2.x and 9.x for one model). A version range only
// applies to the line it was written for, so ranges from another line are skipped, never compared.
function sameLine(user,bound){
  if(/^\d{6,8}$/.test(bound)) return true;            // build-date bounds have no line number
  const u=numTokens(String(user).replace(/build.*$/i,"")), b=numTokens(bound);
  return u.length>0&&b.length>0&&u[0]===b[0];
}
function matchStatus(m,fw){
  if(!fw) return "unk";
  const ver=(m.criteria.split(":")[5]||"*").replace(/\\/g,"");
  const lo=m.versionStartIncluding||m.versionStartExcluding, hi=m.versionEndIncluding||m.versionEndExcluding;
  const ref=hi||lo||(ver!=="*"&&ver!=="-"?ver:null);
  if(ref&&!sameLine(fw,ref)) return "skip";
  if(lo||hi){
    let ok=true;
    if(lo){ const c=cmpV(fw,lo); if(c==null) return "unk"; ok=ok&&(m.versionStartIncluding?c>=0:c>0) }
    if(hi){ const c=cmpV(fw,hi); if(c==null) return "unk"; ok=ok&&(m.versionEndIncluding?c<=0:c<0) }
    return ok?"aff":"not";
  }
  if(ver!=="*"&&ver!=="-"){ const c=cmpV(fw,ver); return c==null?"unk":c===0?"aff":"not" }
  return "unk"; // listed as "all versions": can't rule it in or out from the version alone
}
function assessCve(c,re,fw,hw,brand){
  const prods=[], statuses=[]; let fixedIn=null, fixedAfter=null, hwExcluded=false;
  for(const cfg of c.configurations||[]){
    const nodes=cfg.nodes||[], all=nodes.flatMap(n=>n.cpeMatch||[]);
    const hwm=all.filter(m=>!m.vulnerable&&m.criteria.split(":")[2]==="h"&&re.test(m.criteria.split(":")[4].replace(/_/g," ")));
    if(hw&&hwm.length){ const hv=numTokens(hw)[0]; const vers=hwm.map(m=>m.criteria.split(":")[5]);
      if(hv!=null&&!vers.includes("*")&&!vers.some(v=>numTokens(v)[0]===hv)){ hwExcluded=true; continue } }
    for(const m of all){ if(!m.vulnerable) continue; const prod=(m.criteria.split(":")[4]||"").replace(/_/g," ");
      if(!re.test(prod)) continue; prods.push(prod); statuses.push(matchStatus(m,fw));
      if(m.versionEndExcluding) fixedIn=m.versionEndExcluding; else if(m.versionEndIncluding) fixedAfter=m.versionEndIncluding }
  }
  const desc=((c.descriptions||[]).find(d=>d.lang==="en")||{}).value||"";
  if(!prods.length&&(hwExcluded||!re.test(desc))) return null; // other hardware version, or not this model (e.g. C60 vs C6)
  // "skip" = range written for another firmware line. If every range is on another line, the record doesn't cover your line.
  const real=statuses.filter(x=>x!=="skip"), st=real.includes("aff")?"aff":(real.includes("not")&&!real.includes("unk"))||(statuses.length&&!real.length)?"not":"unk";
  const mt=c.metrics||{}, pick=(mt.cvssMetricV40||mt.cvssMetricV31||mt.cvssMetricV30||[])[0], v2=(mt.cvssMetricV2||[])[0];
  const score0=pick?pick.cvssData.baseScore:v2?v2.cvssData.baseScore:null, score=typeof score0==="number"&&score0>=0&&score0<=10?score0:null;
  const sevRaw=(pick?pick.cvssData.baseSeverity:v2?v2.baseSeverity:"")||"";
  const sevIn=String(sevRaw).toLowerCase(), sev=["critical","high","medium","low","none"].includes(sevIn)?sevIn:(score>=9?"critical":score>=7?"high":score>=4?"medium":score?"low":"medium");
  const cwes=(c.weaknesses||[]).flatMap(w=>(w.description||[]).map(d=>d.value)).filter(v=>/^CWE-\d+$/.test(v));
  const av=pick?pick.cvssData.attackVector:v2?v2.cvssData.accessVector:null;
  const good=["Vendor Advisory","Patch","Release Notes","Mitigation"];
  // Only the router maker's own advisories/patch notes, never third-party write-ups or beta downloads.
  const refs=(c.references||[]).filter(x=>(x.tags||[]).some(t=>good.includes(t))&&isOfficial(x.url,brand)).slice(0,3)
    .map(x=>({url:x.url,label:(x.tags||[]).find(t=>good.includes(t))+" · "+(()=>{try{return new URL(x.url).hostname.replace(/^www\./,"")}catch{return "link"}})()}));
  return {id:c.id,desc,score,sev:sev==="none"?"low":sev,kev:!!c.cisaExploitAdd,kevAction:c.cisaRequiredAction,st,fixedIn,fixedAfter,cwes,av,refs,published:(c.published||"").slice(0,10)};
}
async function nvdSearch(brand,model){
  const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),25000);
  try{ const r=await fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(model)}&resultsPerPage=500`,{signal:ctl.signal,cache:"no-store"});
    if(r.status===403||r.status===429) throw new Error("rate");
    if(!r.ok) throw new Error("http "+r.status); return await r.json() }
  finally{ clearTimeout(tm) }
}
let rtLast=null;
async function runRouterCheck(){
  rtSave();
  const brand=$("rtBrand").value.trim(), model=$("rtModel").value.trim(), fw=$("rtFw").value.trim(), hw=$("rtHw").value.trim(), msg=$("rtMsg");
  if(!model){ msg.textContent="Enter your router's model (it's on the label underneath)."; $("rtModel").focus(); return }
  $("rtRun").disabled=true; msg.textContent="Checking the National Vulnerability Database…";
  let cves=[], lookupFailed=false, total=0;
  try{
    const j=await nvdSearch(brand,model), re=modelRegex(model); total=j.totalResults||0;
    cves=(j.vulnerabilities||[]).map(v=>assessCve(v.cve,re,fw,hw,brand)).filter(Boolean);
  }catch(e){ lookupFailed=true }
  // --- score ---
  let score=100; const fixes=[];
  const enc=ENC[$("rtEnc").value]; if(enc.w){ score-=enc.w; fixes.push({w:enc.w,sev:enc.w>=30?"critical":enc.w>=15?"high":"low",text:enc.fix,how:{...ENC_STEPS,id:"enc"}}) }
  for(const q of RT_Q){ const a=rtAnswers[q.id]||"unsure"; if(a==="yes") continue; const w=RT_W[q.sev][a==="no"?0:1]; score-=w;
    fixes.push({w,sev:q.sev,text:(a==="unsure"?"Check: ":"")+q.fix,how:{...RT_STEPS[q.id],id:q.id}}) }
  const aff=cves.filter(c=>c.st==="aff"), unk=cves.filter(c=>c.st==="unk"), fixed=cves.filter(c=>c.st==="not");
  const cw=c=>c.kev?25:{critical:15,high:10,medium:4,low:1}[c.sev]||4;
  const dA=Math.min(50,aff.reduce((a,c)=>a+cw(c),0)), dU=Math.min(20,unk.reduce((a,c)=>a+cw(c)/2,0));
  score-=dA+dU;
  if(aff.length){ const mk=brand||"the maker";
    fixes.push({w:100+dA,sev:aff.some(c=>c.kev)?"kev":"critical",how:{...RT_STEPS.fw,id:"fw"},text:`Install the latest stable firmware from ${mk}'s official support page: NVD records ${aff.length} known vulnerabilit${aff.length>1?"ies":"y"} for version ${fw}. Each issue below links ${mk}'s official advisory where one exists. If ${mk} offers no stable update, replace the router.`}) }
  if(!fw&&cves.length) fixes.push({w:60,sev:"high",text:"Add your firmware version so each vulnerability can be checked against it."});
  if(unk.length&&fw) fixes.push({w:20+dU,sev:"medium",how:{steps:[
      "Open your router maker's security advisories page (search for the brand name plus \"security advisory\").",
      "Search for your model and hardware version, and read each advisory's list of affected and fixed firmware.",
      "Compare those versions with your firmware on the router's Status page.",
      "If any advisory covers your version, or you can't tell, install the newest firmware for your hardware version."],
      verify:"Each issue marked \"Can't confirm\" below is either covered by an update you've installed or listed as not affecting your version."},text:`${unk.length} issue${unk.length>1?"s":""} can't be confirmed from the version alone. Check the maker's security advisories for your model.`});
  score=Math.max(0,Math.round(score));
  const grade=score>=90?"A":score>=75?"B":score>=60?"C":score>=40?"D":"F";
  rtLast={brand,model,hw,fw,score,grade,aff,unk,fixed,fixes,lookupFailed,total,when:new Date()};
  renderRouterReport(); $("rtRun").disabled=false;
  msg.textContent=lookupFailed?"Settings graded. The vulnerability lookup couldn't be reached; use the NVD link below.":"Done.";
}
const SEV_RANK={kev:5,critical:4,high:3,medium:2,low:1};
const fixOrder=(a,b)=>(SEV_RANK[b.sev]-SEV_RANK[a.sev])||(b.w-a.w);
function renderRouterReport(){
  const r=rtLast; if(!r) return; $("rtReport").hidden=false;
  const C=2*Math.PI*54, col=r.score>=75?"--good":r.score>=50?"--ok":"--bad";
  $("rtArc").setAttribute("stroke-dasharray",`${(C*r.score/100).toFixed(1)} ${C.toFixed(1)}`); $("rtArc").setAttribute("stroke",css(col));
  $("rtGrade").textContent=r.grade; $("rtScore").textContent=`${r.score}/100`;
  const kev=r.aff.filter(c=>c.kev).length, name=[r.brand,r.model,r.hw].filter(Boolean).join(" ");
  $("rtVerdict").innerHTML=r.lookupFailed
    ?`Settings graded for <b>${esc(name)}</b>. The vulnerability database didn't respond from this browser, so known flaws are not included in the score.`
    :`<b>${esc(name)}</b>${r.fw?` on firmware <b>${esc(r.fw)}</b>`:""}: ${r.aff.length?`<strong style="color:var(--bad)">${r.aff.length} known vulnerabilit${r.aff.length>1?"ies affect":"y affects"} your version</strong>${kev?`, ${kev} actively exploited`:""}.`:r.fw?"no known vulnerability matches your exact firmware version.":"add the firmware version to see which issues apply to you."}`;
  $("rtCounts").innerHTML=r.lookupFailed?"":`<span class="sev aff">${r.aff.length} affect you</span><span class="sev unk">${r.unk.length} can't confirm</span><span class="sev not">${r.fixed.length} fixed in your version</span>`;
  const top=[...r.fixes].sort(fixOrder);
  const bp=BRAND_PATH[vendorKey(r.brand)]||{};
  const withPath=h=>{ const path=h&&h.id&&bp[h.id]; if(!path) return h.steps;
    return [...h.steps.slice(0,2),`On ${r.brand} routers this is usually ${path}. Menu names vary by model and firmware; your model's user guide on ${r.brand}'s website has the exact location.`,...h.steps.slice(2)] };
  const howHtml=h=>h?`<details class="fixbox"><summary>How to fix</summary><ol class="fixsteps">${withPath(h).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>${h.verify?`<p class="verify"><b>Check it worked:</b> ${esc(h.verify)}</p>`:""}</details>`:"";
  $("rtFixes").innerHTML=top.length?top.map(f=>`<li><span class="sev ${f.sev}">${f.sev==="kev"?"exploited":f.sev}</span><div><div>${esc(f.text)}</div>${howHtml(f.how)}</div></li>`).join(""):`<li><span class="sev not">ok</span><span>Nothing urgent. Keep firmware updated and re-run this check after each update.</span></li>`;
  const nvdLink=`https://nvd.nist.gov/vuln/search/results?form_type=Basic&results_type=overview&search_type=all&query=${encodeURIComponent(r.model)}`;
  const rank=c=>(c.kev?1000:0)+({aff:300,unk:200,not:0}[c.st])+(c.score||0);
  const list=[...r.aff,...r.unk].sort((a,b)=>rank(b)-rank(a));
  const card=c=>`<div class="cve"><div class="top"><a href="https://nvd.nist.gov/vuln/detail/${esc(c.id)}" target="_blank" rel="noopener">${esc(c.id)}</a>${c.kev?'<span class="sev kev">Actively exploited</span>':""}<span class="sev ${esc(c.sev)}">${esc(c.sev)}${fin(c.score)?" "+c.score:""}</span><span class="sev ${c.st}" title="Based on NVD's version analysis, not ${esc(r.brand||"the manufacturer")}'s">${{aff:"Affects your version",unk:"Can't confirm",not:"Fixed in your version"}[c.st]} · NVD</span><span class="note">${esc(c.published)}</span></div><p>${esc(c.desc.length>260?c.desc.slice(0,257)+"…":c.desc)}</p>${c.st==="not"?"":(()=>{const f=cveFix(c,r);
    return `<details class="fixbox"${c.st==="aff"?" open":""}><summary>How to fix${f.what?` · ${esc(f.what)}`:""}</summary><ol class="fixsteps">${f.steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol>${f.notes.map(n=>`<p class="verify">${esc(n)}</p>`).join("")}${f.links.length?`<div class="fixlinks">${f.links.map(l=>`<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join("")}</div>`:""}</details>`})()}</div>`;
  $("rtCves").innerHTML=r.lookupFailed?`<p class="note">Open <a href="${nvdLink}" target="_blank" rel="noopener">NVD search for “${esc(r.model)}”</a> to review known issues manually.</p>`
    :(list.length?list.slice(0,40).map(card).join(""):`<p class="note">No open issues found for “${esc(r.model)}”.</p>`)
     +(r.fixed.length?`<details class="how"><summary>${r.fixed.length} older issue${r.fixed.length>1?"s":""} already fixed in your firmware</summary><div class="cves" style="margin-top:8px">${r.fixed.slice(0,40).map(card).join("")}</div></details>`:"")
     +(list.length>40?`<p class="note">Showing 40 of ${list.length}. <a href="${nvdLink}" target="_blank" rel="noopener">See all on NVD</a>.</p>`:"");
  $("rtSrc").textContent=`Sources: vulnerabilities and the "affects / fixed in your version" status come from the NIST National Vulnerability Database (${r.total} records matched; filtered to your exact model), not from ${r.brand||"the manufacturer"}. Fixes point only to ${r.brand||"the manufacturer"}'s official advisories and support pages, so confirm fixed versions there. "Exploited" comes from CISA's Known Exploited Vulnerabilities list. Checked ${r.when.toLocaleString()}. A clean result means no publicly recorded flaw matches; it is not a guarantee.`;
}
function copyRouterReport(){
  const r=rtLast; if(!r) return;
  const t=[`CleanSpeed router check · ${r.when.toLocaleString()}`,`${[r.brand,r.model,r.hw].filter(Boolean).join(" ")} · firmware ${r.fw||"not given"}`,`Score ${r.score}/100 (grade ${r.grade})`,
    r.lookupFailed?"Vulnerability lookup unavailable.":`${r.aff.length} affect this version · ${r.unk.length} can't confirm · ${r.fixed.length} fixed`,"","Fix first:",
    ...[...r.fixes].sort(fixOrder).flatMap((f,i)=>{ const bp=BRAND_PATH[vendorKey(r.brand)]||{}, path=f.how&&f.how.id&&bp[f.how.id];
      const st=f.how?(path?[...f.how.steps.slice(0,2),`On ${r.brand} routers: ${path} (varies by model)`,...f.how.steps.slice(2)]:f.how.steps):[];
      return [`${i+1}. ${f.text}`,...st.map((x,j)=>`   ${String.fromCharCode(97+j)}) ${x}`)] }),
    "","Vulnerabilities and how to fix them:",
    ...[...r.aff,...r.unk].flatMap(c=>{const f=cveFix(c,r); return [`${c.id}${c.kev?" [ACTIVELY EXPLOITED]":""} · ${c.sev} ${c.score??""} · ${c.st==="aff"?"affects your version":"can't confirm"}`,
      ...f.steps.map((x,j)=>`   ${String.fromCharCode(97+j)}) ${x}`),...f.notes.map(n=>`   Note: ${n}`),...f.links.map(l=>`   ${l.url}`)]})].join("\n");
  const fb=()=>{$("csv").value=t;$("csv").hidden=false;$("csv").select();$("rtMsg").textContent="Copy blocked; the report is in the text box under History."};
  navigator.clipboard?navigator.clipboard.writeText(t).then(()=>$("rtMsg").textContent="Report copied.",fb):fb();
}

/* =================== Live network map & telemetry =================== */
// Stylised continents (lon,lat), hand-simplified. Used only as a dotted backdrop; positions on it are exact.
const LAND=[
 [[-168,66],[-162,70],[-140,70],[-125,72],[-95,74],[-80,73],[-62,60],[-56,52],[-66,45],[-70,42],[-76,35],[-81,31],[-80,25],[-84,30],[-90,29],[-97,26],[-97,21],[-87,21],[-87,15],[-83,9],[-78,8],[-80,8],[-85,11],[-92,14],[-105,20],[-110,23],[-112,31],[-117,32],[-124,40],[-124,48],[-130,55],[-140,60],[-150,60],[-158,57],[-165,60]],
 [[-73,78],[-60,82],[-30,83],[-20,76],[-22,70],[-40,64],[-50,61],[-55,68]],
 [[-78,8],[-72,12],[-62,11],[-52,5],[-35,-6],[-39,-15],[-41,-22],[-48,-26],[-53,-34],[-58,-38],[-65,-41],[-66,-48],[-69,-52],[-74,-53],[-75,-47],[-73,-38],[-71,-30],[-70,-18],[-76,-14],[-81,-5],[-80,1]],
 [[-9,37],[-9,43],[-1,46],[-5,48],[2,51],[9,54],[9,57],[5,61],[14,68],[26,71],[40,67],[60,70],[80,73],[105,78],[140,73],[160,70],[180,68],[180,65],[170,60],[160,58],[156,51],[142,53],[140,46],[132,43],[129,35],[122,31],[120,24],[110,20],[108,16],[109,11],[105,9],[103,1],[100,6],[98,9],[98,16],[94,17],[91,22],[87,21],[80,15],[77,8],[73,16],[72,21],[67,25],[62,25],[57,25],[59,23],[55,17],[52,16],[45,13],[43,13],[39,21],[35,28],[34,31],[36,35],[30,36],[27,37],[26,40],[23,37],[20,40],[15,45],[16,38],[12,42],[9,44],[3,43],[0,39],[-2,37],[-6,36]],
 [[-17,21],[-13,27],[-10,30],[-6,36],[10,37],[11,33],[20,31],[32,31],[34,28],[38,18],[43,12],[51,12],[51,10],[42,-1],[40,-10],[40,-15],[35,-24],[32,-29],[27,-34],[20,-35],[18,-32],[15,-27],[12,-17],[13,-6],[9,-1],[9,4],[5,6],[-4,5],[-8,4],[-13,8],[-17,14]],
 [[44,-25],[47,-25],[50,-15],[49,-12],[44,-17]],
 [[114,-22],[114,-34],[118,-35],[124,-34],[132,-32],[138,-35],[141,-38],[150,-37],[153,-29],[153,-25],[146,-19],[142,-11],[141,-17],[136,-12],[130,-12],[126,-14],[122,-18]],
 [[-5,50],[1,51],[2,53],[-2,56],[-2,58],[-5,58],[-6,56],[-5,54],[-3,53],[-5,51]],[[-10,52],[-6,52],[-6,55],[-9,55]],
 [[130,31],[132,34],[136,35],[140,36],[142,40],[141,42],[145,44],[141,45],[140,42],[139,38],[136,37],[133,36],[130,34]],
 [[95,5],[98,4],[104,-2],[106,-6],[102,-4],[97,1]],[[105,-6],[114,-8],[106,-7]],[[109,1],[110,-3],[116,-4],[119,1],[117,7],[113,4]],
 [[131,-1],[141,-3],[150,-10],[141,-9],[137,-5]],[[120,18],[122,18],[126,7],[125,6],[122,8],[120,13]],[[80,10],[82,7],[81,6],[80,6]],
 [[172,-35],[178,-38],[174,-42],[167,-46],[170,-45],[173,-41]],[[-24,65],[-14,66],[-14,64],[-22,63]]
];
const LAT_TOP=80, LAT_BOT=-58;
let VIEW=null; // fitted window: {lon0,lat1,ppd}; set per frame size and route
const proj=(lon,lat)=>[(lon-VIEW.lon0)*VIEW.ppd,(VIEW.lat1-lat)*VIEW.ppd];
function fitView(W,H,pts){
  let lo0=-180,lo1=180,la0=LAT_BOT,la1=LAT_TOP;
  if(pts.length){ // zoom so the route fills the frame: a short route (London–Frankfurt) gets a regional view, not a world view
    const mnLo=Math.min(...pts.map(p=>p.lon)), mxLo=Math.max(...pts.map(p=>p.lon)), mnLa=Math.min(...pts.map(p=>p.lat)), mxLa=Math.max(...pts.map(p=>p.lat));
    const pLo=Math.max(8,(mxLo-mnLo)*0.45), pLa=Math.max(6,(mxLa-mnLa)*0.45);
    lo0=mnLo-pLo; lo1=mxLo+pLo; la0=mnLa-pLa; la1=mxLa+pLa+4;
    if(lo1-lo0<32){ const c=(lo0+lo1)/2; lo0=c-16; lo1=c+16 } }
  let ppd=Math.min(W/(lo1-lo0),H/(la1-la0)); // same scale both ways, then grow the short side to fill the frame
  const cl=(lo0+lo1)/2, ca=(la0+la1)/2, spanLo=W/ppd, spanLa=H/ppd;
  let lon0=Math.max(-180,Math.min(180-spanLo,cl-spanLo/2)); if(spanLo>=360) lon0=-180-(spanLo-360)/2;
  let lat1=Math.min(LAT_TOP+10,Math.max(LAT_BOT-10+spanLa,ca+spanLa/2));
  return {lon0,lat1,ppd};
}
function inPoly(x,y,poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const [xi,yi]=poly[i],[xj,yj]=poly[j];
  if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi)) c=!c } return c }
function landDots(W,H,u){ // dot spacing ≈ 8 css px at any zoom
  const step=Math.max(0.6,8*u/VIEW.ppd), d=[], lonEnd=VIEW.lon0+W/VIEW.ppd, latEnd=VIEW.lat1-H/VIEW.ppd;
  for(let lat=VIEW.lat1;lat>latEnd;lat-=step) for(let lon=VIEW.lon0;lon<lonEnd;lon+=step) if(LAND.some(p=>inPoly(lon,lat,p))) d.push([lon,lat]);
  return d;
}

// Where things are. Time-zone guesses use a country-level point when the zone spans a big country.
const TZ_LOC={"Asia/Kolkata":[20.6,78.9,"India"],"Asia/Calcutta":[20.6,78.9,"India"],"Asia/Dubai":[25.2,55.3,"Dubai"],"Asia/Singapore":[1.35,103.8,"Singapore"],"Asia/Tokyo":[35.7,139.7,"Tokyo"],
 "Asia/Shanghai":[31.2,121.5,"China"],"Asia/Hong_Kong":[22.3,114.2,"Hong Kong"],"Asia/Seoul":[37.6,127,"Seoul"],"Asia/Jakarta":[-6.2,106.8,"Jakarta"],"Asia/Karachi":[24.9,67,"Pakistan"],
 "Asia/Dhaka":[23.8,90.4,"Dhaka"],"Asia/Colombo":[6.9,79.9,"Sri Lanka"],"Asia/Kathmandu":[27.7,85.3,"Kathmandu"],"Asia/Bangkok":[13.75,100.5,"Bangkok"],"Asia/Manila":[14.6,121,"Manila"],
 "Asia/Riyadh":[24.7,46.7,"Riyadh"],"Asia/Tehran":[35.7,51.4,"Tehran"],"Asia/Kuala_Lumpur":[3.14,101.7,"Kuala Lumpur"],"Asia/Qatar":[25.3,51.5,"Doha"],
 "Europe/London":[51.5,-0.1,"London"],"Europe/Paris":[48.86,2.35,"Paris"],"Europe/Berlin":[52.5,13.4,"Berlin"],"Europe/Madrid":[40.4,-3.7,"Madrid"],"Europe/Rome":[41.9,12.5,"Rome"],
 "Europe/Amsterdam":[52.37,4.9,"Amsterdam"],"Europe/Moscow":[55.75,37.6,"Moscow"],"Europe/Istanbul":[41,29,"Istanbul"],"Africa/Cairo":[30,31.2,"Cairo"],"Africa/Lagos":[6.5,3.4,"Lagos"],
 "Africa/Nairobi":[-1.3,36.8,"Nairobi"],"Africa/Johannesburg":[-26.2,28,"Johannesburg"],"America/New_York":[40.7,-74,"New York"],"America/Chicago":[41.9,-87.6,"Chicago"],
 "America/Denver":[39.7,-105,"Denver"],"America/Los_Angeles":[34,-118.2,"Los Angeles"],"America/Toronto":[43.65,-79.4,"Toronto"],"America/Mexico_City":[19.4,-99.1,"Mexico City"],
 "America/Sao_Paulo":[-23.5,-46.6,"São Paulo"],"America/Argentina/Buenos_Aires":[-34.6,-58.4,"Buenos Aires"],"Australia/Sydney":[-33.9,151.2,"Sydney"],
 "Australia/Melbourne":[-37.8,145,"Melbourne"],"Australia/Perth":[-31.95,115.9,"Perth"],"Pacific/Auckland":[-36.85,174.8,"Auckland"]};
// Airport codes in M-Lab machine names (e.g. mlab1-maa02 → Chennai) and city names in LibreSpeed server names.
const IATA=Object.fromEntries(`maa 13.08 80.27 Chennai|bom 19.08 72.88 Mumbai|del 28.61 77.21 Delhi|blr 12.97 77.59 Bengaluru|hyd 17.39 78.49 Hyderabad|ccu 22.57 88.36 Kolkata|sin 1.35 103.82 Singapore|hkg 22.32 114.17 Hong Kong|tpe 25.03 121.56 Taipei|nrt 35.68 139.69 Tokyo|hnd 35.68 139.69 Tokyo|tyo 35.68 139.69 Tokyo|kix 34.69 135.5 Osaka|icn 37.57 126.98 Seoul|syd -33.87 151.21 Sydney|mel -37.81 144.96 Melbourne|akl -36.85 174.76 Auckland|bkk 13.75 100.5 Bangkok|kul 3.14 101.69 Kuala Lumpur|cgk -6.2 106.85 Jakarta|mnl 14.6 120.98 Manila|dxb 25.2 55.27 Dubai|doh 25.29 51.53 Doha|bah 26.23 50.58 Bahrain|tlv 32.08 34.78 Tel Aviv|ist 41.01 28.98 Istanbul|jnb -26.2 28.05 Johannesburg|cpt -33.92 18.42 Cape Town|nbo -1.29 36.82 Nairobi|los 6.52 3.38 Lagos|cai 30.04 31.24 Cairo|tun 36.8 10.18 Tunis|lhr 51.51 -0.13 London|lon 51.51 -0.13 London|ams 52.37 4.9 Amsterdam|fra 50.11 8.68 Frankfurt|cdg 48.86 2.35 Paris|par 48.86 2.35 Paris|mad 40.42 -3.7 Madrid|lis 38.72 -9.14 Lisbon|mil 45.46 9.19 Milan|mxp 45.46 9.19 Milan|fco 41.9 12.5 Rome|vie 48.21 16.37 Vienna|prg 50.08 14.44 Prague|waw 52.23 21.01 Warsaw|arn 59.33 18.07 Stockholm|cph 55.68 12.57 Copenhagen|osl 59.91 10.75 Oslo|hel 60.17 24.94 Helsinki|dub 53.35 -6.26 Dublin|ath 37.98 23.73 Athens|svo 55.76 37.62 Moscow|lga 40.71 -74.01 New York|jfk 40.71 -74.01 New York|ewr 40.71 -74.01 New York|nyc 40.71 -74.01 New York|iad 38.9 -77.04 Washington|was 38.9 -77.04 Washington|atl 33.75 -84.39 Atlanta|mia 25.76 -80.19 Miami|ord 41.88 -87.63 Chicago|chi 41.88 -87.63 Chicago|dfw 32.78 -96.8 Dallas|iah 29.76 -95.37 Houston|den 39.74 -104.99 Denver|lax 34.05 -118.24 Los Angeles|sjc 37.34 -121.89 San Jose|sfo 37.77 -122.42 San Francisco|sea 47.61 -122.33 Seattle|pdx 45.52 -122.68 Portland|phx 33.45 -112.07 Phoenix|slc 40.76 -111.89 Salt Lake City|msp 44.98 -93.27 Minneapolis|bos 42.36 -71.06 Boston|yyz 43.65 -79.38 Toronto|yul 45.5 -73.57 Montreal|yvr 49.28 -123.12 Vancouver|gru -23.55 -46.63 São Paulo|scl -33.45 -70.67 Santiago|bog 4.71 -74.07 Bogotá|eze -34.6 -58.38 Buenos Aires|mex 19.43 -99.13 Mexico City|lim -12.05 -77.04 Lima|amd 23.02 72.57 Ahmedabad|bbi 20.3 85.82 Bhubaneswar|cok 9.93 76.27 Kochi|nag 21.15 79.09 Nagpur|pat 25.59 85.14 Patna|ixc 30.73 76.78 Chandigarh|cmb 6.93 79.85 Colombo|dac 23.81 90.41 Dhaka|ktm 27.72 85.32 Kathmandu|khi 24.86 67 Karachi|isb 33.68 73.05 Islamabad|ruh 24.71 46.68 Riyadh|jed 21.49 39.19 Jeddah|mct 23.59 58.41 Muscat|kwi 29.38 47.99 Kuwait City|zrh 47.38 8.54 Zurich|gva 46.2 6.14 Geneva|bru 50.85 4.35 Brussels|man 53.48 -2.24 Manchester|edi 55.95 -3.19 Edinburgh|mrs 43.3 5.37 Marseille|bcn 41.39 2.17 Barcelona|muc 48.14 11.58 Munich|ham 53.55 9.99 Hamburg|dus 51.23 6.78 Düsseldorf|txl 52.52 13.4 Berlin|ber 52.52 13.4 Berlin|bud 47.5 19.04 Budapest|otp 44.43 26.1 Bucharest|sof 42.7 23.32 Sofia|kbp 50.45 30.52 Kyiv|bne -27.47 153.03 Brisbane|per -31.95 115.86 Perth|adl -34.93 138.6 Adelaide|han 21.03 105.85 Hanoi|sgn 10.82 106.63 Ho Chi Minh City|pnh 11.56 104.92 Phnom Penh|rgn 16.87 96.2 Yangon|cmn 33.57 -7.59 Casablanca|acc 5.6 -0.19 Accra|dar -6.79 39.21 Dar es Salaam|kgl -1.94 30.06 Kigali|gig -22.91 -43.17 Rio de Janeiro|for -3.72 -38.54 Fortaleza|uio -0.18 -78.47 Quito|pty 8.98 -79.52 Panama City|qro 20.59 -100.39 Querétaro|yyc 51.05 -114.07 Calgary|las 36.17 -115.14 Las Vegas|mci 39.1 -94.58 Kansas City|clt 35.23 -80.84 Charlotte|tpa 27.95 -82.46 Tampa|bna 36.16 -86.78 Nashville|ind 39.77 -86.16 Indianapolis|cmh 39.96 -83 Columbus|phl 39.95 -75.17 Philadelphia|pit 40.44 -80 Pittsburgh|stl 38.63 -90.2 St. Louis|sat 29.42 -98.49 San Antonio|aus 30.27 -97.74 Austin|hnl 21.31 -157.86 Honolulu|anc 61.22 -149.9 Anchorage|fuk 33.59 130.4 Fukuoka|ngo 35.18 136.91 Nagoya|cts 43.06 141.35 Sapporo`
 .split("|").map(r=>{const p=r.split(" "); return [p[0],[+p[1],+p[2],p.slice(3).join(" ")]]}));
const CITY=Object.fromEntries(`Roma 41.9 12.5|Rome 41.9 12.5|London 51.51 -0.13|Frankfurt 50.11 8.68|Amsterdam 52.37 4.9|New York 40.71 -74.01|Atlanta 33.75 -84.39|Los Angeles 34.05 -118.24|Poznan 52.41 16.93|Prague 50.08 14.44|Tokyo 35.68 139.69|Las Vegas 36.17 -115.14|Denver 39.74 -104.99|Chicago 41.88 -87.63|Grand Rapids 42.96 -85.67|Helsinki 60.17 24.94|Novi Sad 45.27 19.83|Argalasti 39.23 23.22|Belgrade 44.8 20.46|Paris 48.86 2.35|Madrid 40.42 -3.7|Milan 45.46 9.19|Vienna 48.21 16.37|Warsaw 52.23 21.01|Stockholm 59.33 18.07|Oslo 59.91 10.75|Zurich 47.38 8.54|Singapore 1.35 103.82|Mumbai 19.08 72.88|Chennai 13.08 80.27|Delhi 28.61 77.21|Dallas 32.78 -96.8|Miami 25.76 -80.19|Seattle 47.61 -122.33|Toronto 43.65 -79.38|Sydney -33.87 151.21|Hong Kong 22.32 114.17`
 .split("|").map(r=>{const p=r.split(" "); return [p.slice(0,-2).join(" "),[+p[p.length-2],+p[p.length-1]]]}));
function youLoc(){
  const g=store.get("geo",null); if(g&&g.src) return {lat:g.lat,lon:g.lon,label:g.src==="device"?"You (device location)":"You (from IP lookup)",exact:g.src==="device"};
  if(cfYou) return cfYou;
  const tz=(Intl.DateTimeFormat().resolvedOptions().timeZone)||"", z=TZ_LOC[tz];
  return z?{lat:z[0],lon:z[1],label:`You (approx., ${z[2]} time zone)`,exact:false}:null;
}
function serverLoc(s,loc){
  if(!s) return null;
  if(s.kind==="ndt7"&&loc){ const m=(loc.machine||"").match(/mlab\d-([a-z]{3})\d/i), c=m&&IATA[m[1].toLowerCase()]; if(c) return {lat:c[0],lon:c[1],label:`M-Lab · ${c[2]}`} ; return null }
  if(s.id==="cf") return {near:true,label:"Cloudflare · nearest city"};
  const k=Object.keys(CITY).find(n=>s.name.includes(n)); if(k) return {lat:CITY[k][0],lon:CITY[k][1],label:s.name.replace(/\s*\(.*\)/,"")};
  return null;
}
const hav=(a,b)=>{ const R=6371, r=Math.PI/180, dLa=(b.lat-a.lat)*r, dLo=(b.lon-a.lon)*r;
  return 2*R*Math.asin(Math.sqrt(Math.sin(dLa/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLo/2)**2)) };

let tel={on:false,t0:0,phase:"idle",rates:[],pings:[],bytes:{down:0,up:0},cur:{down:0,up:0,ping:NaN},you:null,srv:null,phases:[]};
function telStart(){ if(typeof col!=='undefined') col.start(); clearTimeout(idleT); idleOn=false; pk=[]; hits=[]; pkSeen.dir=""; const last=tel.lastSrv; tel={lastSrv:last,on:true,t0:performance.now(),phase:"ping",rates:[],pings:[],bytes:{down:0,up:0},cur:{down:0,up:0,ping:NaN},you:youLoc(),srv:null,phases:[{p:"ping",t:0}]};
  $("lvBadge").classList.add("live"); $("lvState").textContent="Live · ping"; mapKick(); telDraw() }
/* Cloudflare is anycast: ask it which data centre (and roughly which client position) answered.
   Tried in order; each is optional and silent if the browser or network refuses it. */
let cfColo=null, cfYou=null;
async function cfLocate(){
  if(cfColo) return cfColo;
  const get=async(u,json)=>{ const ctl=new AbortController(), tm=setTimeout(()=>ctl.abort(),3000);
    try{ const r=await fetch(u,{cache:"no-store",credentials:"omit",signal:ctl.signal}); if(!r.ok) throw new Error(r.status); return json?await r.json():await r.text() } finally{ clearTimeout(tm) } };
  try{ const m=await get("https://speed.cloudflare.com/meta?r="+nonce(),true), c=m&&m.colo;
    if(fin(+m.latitude)&&fin(+m.longitude)) cfYou={lat:+(+m.latitude).toFixed(1),lon:+(+m.longitude).toFixed(1),label:"You (approx., from Cloudflare)",exact:false};
    if(c&&fin(+c.lat)&&fin(+c.lon)) return cfColo={lat:+c.lat,lon:+c.lon,label:`Cloudflare · ${c.city||c.iata}`,iata:c.iata} }catch{}
  for(const u of ["https://speed.cloudflare.com/cdn-cgi/trace","https://1.1.1.1/cdn-cgi/trace"]){
    try{ const t=await get(u+"?r="+nonce()), code=(t.match(/^colo=([A-Z]{3})\s*$/m)||[])[1];
      if(code){ const c=IATA[code.toLowerCase()]; return cfColo=c?{lat:c[0],lon:c[1],label:`Cloudflare · ${c[2]}`,iata:code}:{near:true,label:`Cloudflare · ${code}`,iata:code} } }catch{}
  }
  return null;
}
function telServer(s,loc){ tel.srv=s.id==="cf"&&cfColo?cfColo:serverLoc(s,loc); tel.srvName=s.name; tel.lastSrv=s; mapBase=null; routeText(null);
  if(s.id==="cf"&&!cfColo) cfLocate().then(c=>{ if(c&&tel.srvName===s.name){ tel.srv=c; if(!store.get("geo",null)&&cfYou) tel.you=cfYou; mapBase=null; routeText(null); mapKick() } });
}
function telPhase(p){ if(!tel.on) return; tel.phase=p; tel.phases.push({p,t:(performance.now()-tel.t0)/1000}); $("lvState").textContent="Live · "+({ping:"ping",down:"download",up:"upload"}[p]||p); if(p!=="down") tel.cur.down=0 }
function telRate(dir,r){ if(!tel.on) return; tel.cur[dir]=r; tel.rates.push({t:(performance.now()-tel.t0)/1000,dir,r}); telDraw() }
function telPing(ms){ if(!tel.on||!fin(ms)) return; tel.cur.ping=ms; tel.pings.push({t:(performance.now()-tel.t0)/1000,ms}); if(tel.phase==="ping"){ pkPing(ms); if(typeof col!=='undefined') col.ping(ms) } }
function telEnd(ok,res){
  tel.on=false; tel.phase="done"; tel.cur.down=tel.cur.up=0; if(res&&fin(res.ping)) tel.cur.ping=res.ping; $("lvBadge").classList.remove("live");
  tel.endText=ok?`Last test · ${new Date().toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`:"Stopped"; $("lvState").textContent=tel.endText;
  telDraw(); routeText(res); setTimeout(idleTick,1500); if(typeof col!=='undefined') col.end(ok?res:null);
}
function mb(b){ return b>=1e9?(b/1e9).toFixed(2)+" GB":(b/1e6).toFixed(b>=1e8?0:1)+" MB" }
function telDraw(){
  $("lvDown").textContent=tel.cur.down?fmt(tel.cur.down)+" "+unitLabel():"—"; $("lvUp").textContent=tel.cur.up?fmt(tel.cur.up)+" "+unitLabel():"—";
  $("lvPing").textContent=fin(tel.cur.ping)?tel.cur.ping.toFixed(0)+" ms":"—";
  document.querySelector("#lvPing").previousElementSibling.textContent=tel.on||idleOn?"Ping now":"Ping (idle)";
  $("lvBD").textContent=mb(tel.bytes.down); $("lvBU").textContent=mb(tel.bytes.up);
  $("lvTime").textContent=tel.t0?((tel.on?(performance.now()-tel.t0):(tel.rates.length?tel.rates[tel.rates.length-1].t*1000:0))/1000).toFixed(0)+" s":"0 s";
  const c=$("tele"), x=c.getContext("2d"), W=c.width, H=c.height, L=80, R=70, T=26, B=36; x.clearRect(0,0,W,H);
  x.font=`500 19px ${css("--mono")}`; x.fillStyle=css("--muted"); x.textBaseline="middle";
  const tmax=Math.max(10,...tel.rates.map(p=>p.t),...tel.pings.map(p=>p.t));
  if(!tel.rates.length&&!tel.pings.length){ x.textAlign="center"; x.fillText("Live data appears here during a test",W/2,H/2); return }
  const vmax=Math.max(1e-9,...tel.rates.map(p=>conv(p.r)))*1.12, pmax=Math.max(20,...tel.pings.map(p=>p.ms))*1.2;
  const px=t=>L+(W-L-R)*t/tmax, py=v=>T+(H-T-B)*(1-v/vmax), pp=v=>T+(H-T-B)*(1-v/pmax);
  // phase bands
  tel.phases.forEach((ph,i)=>{ const x0=px(ph.t), x1=px(i+1<tel.phases.length?tel.phases[i+1].t:tmax);
    x.fillStyle=i%2?"rgba(127,127,127,.06)":"rgba(127,127,127,.0)"; x.fillRect(x0,T,x1-x0,H-T-B);
    x.fillStyle=css("--muted"); x.textAlign="left"; x.fillText({ping:"Ping",down:"Download",up:"Upload"}[ph.p]||"",x0+6,T-12) });
  x.strokeStyle=css("--track"); x.lineWidth=1;
  for(let i=0;i<=3;i++){ const y=T+(H-T-B)*i/3; x.beginPath(); x.moveTo(L,y); x.lineTo(W-R,y); x.stroke();
    x.textAlign="right"; x.fillText(fmtNum(vmax*(1-i/3)),L-10,y); x.textAlign="left"; x.fillStyle=css("--ok"); x.fillText((pmax*(1-i/3)).toFixed(0),W-R+8,y); x.fillStyle=css("--muted") }
  x.textAlign="center"; for(let s=0;s<=tmax;s+=tmax>40?10:5) x.fillText(s+"s",px(s),H-14);
  for(const [dir,col] of [["down","--down"],["up","--up"]]){ const pts=tel.rates.filter(p=>p.dir===dir); if(pts.length<2) continue; const cc=css(col);
    x.beginPath(); pts.forEach((p,i)=>i?x.lineTo(px(p.t),py(conv(p.r))):x.moveTo(px(p.t),py(conv(p.r))));
    x.strokeStyle=cc; x.lineWidth=3.5; x.stroke();
    x.lineTo(px(pts[pts.length-1].t),py(0)); x.lineTo(px(pts[0].t),py(0)); x.closePath(); x.fillStyle=cc+"30"; x.fill() }
  if(tel.pings.length){ x.fillStyle=css("--ok"); for(const p of tel.pings){ x.beginPath(); x.arc(px(p.t),pp(p.ms),4,0,Math.PI*2); x.fill() } }
}
function routeText(res){
  const y=tel.you, s=tel.srv, el=$("lvRoute");
  if(!y){ el.textContent="Your time zone isn't in the built-in list. Tap \"Use precise location\" to place yourself on the map."; return }
  if(!s){ el.textContent=`Server: ${tel.srvName||"unknown"}. Its location isn't published, so no route is drawn.`; return }
  if(s.near){ el.textContent="Cloudflare answers from its data centre closest to you, so the route is short. It doesn't tell web pages which city that is."; return }
  const d=hav(y,s), light=2*d/200; // light in optical fibre ≈ 200 km per millisecond
  const ping=res&&fin(res.ping)?res.ping:NaN;
  el.innerHTML=`Route ≈ <b>${Math.round(d).toLocaleString()} km</b> to ${esc(s.label)}${y.exact?"":" (from your approximate position)"}. Light in optical fibre needs ${light<1?"<b>under 1 ms</b>":`at least <b>${light.toFixed(0)} ms</b>`} for that round trip`+
    (fin(ping)?`; you measured <b>${ping.toFixed(0)} ms</b>`+(ping>=light?`, so about ${(ping-light).toFixed(0)} ms is routing detours, Wi-Fi and processing.`
      :`. That's faster than light could cover this distance, so your real position${y.exact?"":" (estimated from your time zone)"} or the server's is closer than shown${y.exact?"":". Tap \"Use precise location\" for an exact route"}.`):".")+
    (d>3000?" A closer server would give higher speeds and lower ping.":"");
}

/* ---- map rendering: static dots cached; arc and particles drawn at ≤30 fps ---- */
let mapBase=null, mapBaseTheme="", mapRaf=0, mapLast=0;
/* Packet view. A dot is spawned only when that much data has really arrived (download) or been sent (upload),
   counted from the same byte counters as the result. A dot's trip lasts the measured one-way delay (ping ÷ 2)
   slowed down SLOW times, so the eye can follow it; pings go out and back over their measured round-trip time. */
const SLOW=20, DOT_STEPS=[16e3,64e3,256e3,1e6,4e6,16e6,64e6,256e6];
let pk=[], hits=[], pkSeen={down:0,up:0,acc:0,dir:"",tLast:0}, pkPer=0;
const pkDur=ms=>Math.min(2400,Math.max(380,(fin(ms)?ms:60)/2*SLOW));
function pkPing(ms){ if(!$("lvAnim").checked||!fin(ms)) return; pk.push({t0:performance.now(),dur:Math.min(4000,Math.max(700,ms*SLOW)),dir:"ping"}); mapKick() }
function pkFeed(now){
  const dir=tel.phase; if(dir!=="down"&&dir!=="up"){ pkSeen.dir=""; return }
  const b=tel.bytes[dir]||0; if(pkSeen.dir!==dir){ pkSeen.dir=dir; pkSeen[dir]=b; pkSeen.acc=0; pkSeen.tLast=now; return }
  const got=Math.max(0,b-pkSeen[dir]); pkSeen[dir]=b; pkSeen.acc+=got;
  const rate=tel.cur[dir]||0; pkPer=DOT_STEPS.find(v=>rate/v<=50)||DOT_STEPS[DOT_STEPS.length-1];
  let n=Math.floor(pkSeen.acc/pkPer); pkSeen.acc-=n*pkPer; n=Math.min(n,14);
  const dur=pkDur(tel.cur.ping), gap=n>1?Math.min(120,(now-pkSeen.tLast)/n):0;
  for(let i=0;i<n;i++) pk.push({t0:now+i*gap,dur,dir,j:(Math.random()-.5)});
  pkSeen.tLast=now;
}
const sizeTxt=b=>b>=1e6?(b/1e6)+" MB":(b/1e3)+" KB";
let keyTxt="";
function mapKey(){
  const s=tel.lastSrv, ping=tel.cur.ping;
  const t=tel.on&&(tel.phase==="down"||tel.phase==="up")&&pkPer
    ? `● 1 dot = ${sizeTxt(pkPer)} of data actually ${tel.phase==="down"?"received":"sent"}. Each trip lasts the measured one-way delay (≈${fin(ping)?(ping/2).toFixed(0):"?"} ms) shown ${SLOW}× slower.`
    : tel.on&&tel.phase==="ping" ? `● Ping: each dot goes out and back over its measured round-trip time, shown ${SLOW}× slower.`
    : idleOn&&s ? `● Live ping to ${s.name} every 2 s, shown ${SLOW}× slower. Untick "Live ping" to stop.`
    : "";
  if(t!==keyTxt){ keyTxt=t; $("lvKey").textContent=t }
}
function drawMapBase(W,H,u){
  const off=document.createElement("canvas"); off.width=W; off.height=H; const x=off.getContext("2d");
  x.fillStyle=css("--muted"); x.globalAlpha=.34;
  for(const [lon,lat] of landDots(W,H,u)){ const [X,Y]=proj(lon,lat); x.beginPath(); x.arc(X,Y,1.6*u,0,Math.PI*2); x.fill() }
  x.globalAlpha=.12; x.strokeStyle=css("--muted"); x.lineWidth=u;
  for(let lat=60;lat>=-40;lat-=20){ const y=proj(0,lat)[1]; if(y>0&&y<H){ x.beginPath(); x.moveTo(0,y); x.lineTo(W,y); x.stroke() } }
  return off;
}
function glow(x,X,Y,r,col){ r*=.85; const g=x.createRadialGradient(X,Y,0,X,Y,r); g.addColorStop(0,col+"bb"); g.addColorStop(1,col+"00"); x.fillStyle=g; x.beginPath(); x.arc(X,Y,r,0,Math.PI*2); x.fill() }
function arcPt(a,b,c,t){ const u=1-t; return [u*u*a[0]+2*u*t*c[0]+t*t*b[0], u*u*a[1]+2*u*t*c[1]+t*t*b[1]] }
function drawMap(ts){
  const c=$("map"), u=Math.min(2,window.devicePixelRatio||1), W=Math.max(1,Math.round(c.clientWidth*u)), H=Math.max(1,Math.round(c.clientHeight*u));
  if(c.width!==W||c.height!==H){ c.width=W; c.height=H; mapBase=null }
  const x=c.getContext("2d"), y=tel.you||youLoc(), s=tel.srv;
  const pts=[y,s&&!s.near?s:null].filter(Boolean), key=[W,H,document.documentElement.dataset.theme,matchMedia("(prefers-color-scheme: dark)").matches,JSON.stringify(pts.map(p=>[p.lat,p.lon]))].join("|");
  if(!mapBase||mapBaseTheme!==key){ VIEW=fitView(W,H,pts); mapBase=drawMapBase(W,H,u); mapBaseTheme=key }
  x.clearRect(0,0,W,H); x.drawImage(mapBase,0,0);
  const cYou=css("--you"), cSrv=css("--accent"), anim=$("lvAnim").checked, t=ts/1000;
  // Labels: try a few positions so "You" and the server never sit on top of each other when the two are close (e.g. London–Frankfurt).
  const placed=[], hit=(a,b)=>a[0]<b[0]+b[2]&&b[0]<a[0]+a[2]&&a[1]<b[1]+b[3]&&b[1]<a[1]+a[3];
  const label=(txt,X,Yp,dy)=>{ x.font=`600 ${12*u}px ${css("--body")}`; const w=x.measureText(txt).width;
    // Candidates: beside the marker (preferred side, then the other), then centred above / below it, then further out.
    const cl=v=>Math.max(6*u,Math.min(W-w-6*u,v)), fy=v=>Math.min(H-8*u,Math.max(14*u,v)), flip=X+14*u+w>W-6*u;
    const side=(sd,d)=>[cl((flip!==!!sd)?X-14*u-w:X+14*u),fy(Yp+d)];
    let lx,ly; for(const [cx,cy] of [side(0,dy),side(1,dy),[cl(X-w/2),fy(Yp-16*u)],[cl(X-w/2),fy(Yp+24*u)],side(0,-dy+4*u),side(1,-dy+4*u),side(0,dy+(dy<0?-18:18)*u),side(1,dy+(dy<0?-18:18)*u)]){
      lx=cx; ly=cy; if(!placed.some(r=>hit(r,[lx-4*u,ly-10*u,w+8*u,16*u]))) break }
    placed.push([lx-4*u,ly-10*u,w+8*u,16*u]);
    x.fillStyle=css("--glass-strong"); x.globalAlpha=.85; x.fillRect(lx-4*u,ly-10*u,w+8*u,16*u); x.globalAlpha=1;
    x.fillStyle=css("--ink"); x.textAlign="left"; x.textBaseline="middle"; x.fillText(txt,lx,ly-2*u) };
  if(!y){ x.fillStyle=css("--muted"); x.font=`500 ${12*u}px ${css("--mono")}`; x.textAlign="center"; x.fillText("Tap \"Use precise location\" to place yourself",W/2,H/2); return }
  const Y=proj(y.lon,y.lat); let S=null; if(s&&!s.near) S=proj(s.lon,s.lat);
  const rate=tel.phase==="up"?tel.cur.up:tel.cur.down, lvl=rate>0?Math.min(1,Math.log10(1+bpsToMbps(rate))/3):0; // 0..1 across 1 Mbps–1 Gbps
  const now=performance.now(); if(tel.on&&anim) pkFeed(now); if(!anim){ pk=[]; hits=[] }
  let near=false;
  // Same area (e.g. Cloudflare in your own city): draw the server a short way off, labelled "near you", so the trips stay visible.
  if(S&&Math.hypot(S[0]-Y[0],S[1]-Y[1])<36*u){ const sep=Math.max(60*u,W*0.26), dx=Y[0]+sep<W-20*u?sep:-sep; S=[Y[0]+dx,Math.max(24*u,Y[1]-sep*0.45)]; near=true }
  for(const m of [Y,S]) if(m) placed.push([m[0]-10*u,m[1]-10*u,20*u,20*u]); // labels never cover either marker
  if(S){
    const mid=[(S[0]+Y[0])/2,(S[1]+Y[1])/2], dist=Math.hypot(S[0]-Y[0],S[1]-Y[1]), C=[mid[0],Math.max(10*u,mid[1]-dist*0.3)];
    for(const k of [.2,.35,.5,.65,.8]){ const q=arcPt(S,Y,C,k); placed.push([q[0]-6*u,q[1]-6*u,12*u,12*u]) } // keep labels off the route
    x.strokeStyle=css("--muted"); x.globalAlpha=.6; x.lineWidth=1.5*u; x.setLineDash([4*u,5*u]); x.beginPath(); x.moveTo(S[0],S[1]); x.quadraticCurveTo(C[0],C[1],Y[0],Y[1]); x.stroke(); x.setLineDash([]); x.globalAlpha=1;
    const cD=css("--down"), cU=css("--up"), cP=css("--ok"), nx=-(S[1]-Y[1])/dist, ny=(S[0]-Y[0])/dist;
    pk=pk.filter(p=>{
      const k=(now-p.t0)/p.dur; if(k<0) return true;
      if(k>=1){ const end=p.dir==="up"?S:Y; hits.push({x:end[0],y:end[1],t0:now,col:p.dir==="down"?cD:p.dir==="up"?cU:cP}); return false }
      let q,col;
      if(p.dir==="ping"){ q=k<.5?arcPt(Y,S,C,k*2):arcPt(S,Y,C,(k-.5)*2); col=cP }
      else { q=p.dir==="down"?arcPt(S,Y,C,k):arcPt(Y,S,C,k); col=p.dir==="down"?cD:cU; const off=p.j*6*u*Math.sin(Math.PI*k); q=[q[0]+nx*off,q[1]+ny*off] }
      glow(x,q[0],q[1],(p.dir==="ping"?8:6)*u,col); x.fillStyle="#fff"; x.beginPath(); x.arc(q[0],q[1],(p.dir==="ping"?2.2:1.6)*u,0,Math.PI*2); x.fill(); return true });
    hits=hits.filter(h=>{ const k=(now-h.t0)/350; if(k>=1) return false; x.strokeStyle=h.col; x.globalAlpha=1-k; x.lineWidth=1.5*u; x.beginPath(); x.arc(h.x,h.y,5*u+k*12*u,0,Math.PI*2); x.stroke(); x.globalAlpha=1; return true });
    glow(x,S[0],S[1],16*u,cSrv); x.fillStyle=cSrv; x.beginPath(); x.arc(S[0],S[1],4.5*u,0,Math.PI*2); x.fill();
    label(s.label+(near?" (near you)":""),S[0],S[1],-12*u);
  } else if(tel.on&&anim){ // server position unknown: pulses around you
    const col=tel.phase==="up"?css("--up"):tel.phase==="down"?css("--down"):css("--ok");
    for(let i=0;i<3;i++){ const k=((t*(0.6+lvl))+i/3)%1; x.strokeStyle=col; x.globalAlpha=1-k; x.lineWidth=2*u; x.beginPath(); x.arc(Y[0],Y[1],6*u+k*45*u,0,Math.PI*2); x.stroke() } x.globalAlpha=1;
  }
  glow(x,Y[0],Y[1],18*u,cYou); x.fillStyle=cYou; x.beginPath(); x.arc(Y[0],Y[1],5*u,0,Math.PI*2); x.fill(); x.strokeStyle="#fff"; x.lineWidth=1.5*u; x.stroke();
  label(y.label,Y[0],Y[1],S&&S[1]<Y[1]?16*u:-12*u);
  if(s&&s.near) label(s.label,Y[0],Y[1],32*u);
  mapKey();
}
function mapLoop(ts){
  mapRaf=0; if(ts-mapLast>=33){ drawMap(ts); mapLast=ts }
  if(tel.on||pk.length||hits.length) mapRaf=requestAnimationFrame(mapLoop);
}
function mapKick(){ if(!mapRaf) mapRaf=requestAnimationFrame(mapLoop) }
var idleT=0, idleOn=false, mapVis=false; // var: read by telDraw, which can run before this line
function idleTick(){
  clearTimeout(idleT); const s=tel.lastSrv;
  const ok=!running&&!tel.on&&mapVis&&!document.hidden&&$("lvLive").checked&&s&&s.kind==="http";
  if(!ok){ if(idleOn){ idleOn=false; if(!tel.on){ $("lvBadge").classList.remove("live"); if(tel.endText) $("lvState").textContent=tel.endText } telDraw(); mapKey() } return }
  idleOn=true; $("lvBadge").classList.add("live");
  pingURL(s.ping(),3000).then(ms=>{ if(tel.on||!idleOn) return; tel.cur.ping=ms; pkPing(ms); telDraw(); $("lvState").textContent=`Live ping · ${ms.toFixed(0)} ms`; mapKey() })
    .catch(()=>{ if(idleOn&&!tel.on) $("lvState").textContent="Live ping · no reply" })
    .finally(()=>{ if(idleOn) idleT=setTimeout(idleTick,2000) });
}
if("IntersectionObserver" in window) new IntersectionObserver(e=>{ mapVis=e[0].isIntersecting; idleTick() }).observe($("map"));
document.addEventListener("visibilitychange",idleTick);
function locate(){
  if(!navigator.geolocation){ $("lvRoute").textContent="This browser can't share location."; return }
  $("lvLocate").disabled=true; $("lvRoute").textContent="Waiting for location permission…";
  navigator.geolocation.getCurrentPosition(p=>{ const g={lat:+p.coords.latitude.toFixed(2),lon:+p.coords.longitude.toFixed(2),src:"device"}; store.set("geo",g);
      $("lvLocate").disabled=false; $("lvLocate").textContent="Location set"; tel.you=youLoc(); mapBase=null; drawMap(performance.now()); $("lvRoute").textContent="Location saved on this device only (rounded to about 1 km)." },
    e=>{ $("lvLocate").disabled=false; $("lvRoute").textContent=e.code===1?"Location permission was declined; the map uses your time zone instead.":"Couldn't get your location; the map uses your time zone instead." },
    {enableHighAccuracy:false,timeout:10000,maximumAge:600000});
}

/* =================== Toolkit =================== */
const TICON={
 speed:'<path d="M5 18a8 8 0 1 1 14 0"/><path d="M12 14l4-5"/>',
 router:'<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
 ping:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
 dns:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/>',
 ip:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
 calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M12 12h2M16 12v5M8 16h2M12 16h2"/>',
 pw:'<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l2 2M15 8l2 2"/>',
 mac:'<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>',
 subnet:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 compare:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'
};
const TOOLS=[["speed","Speed test","Download · upload · ping"],["router","Router security","Flaws & settings"],["ping","Ping monitor","Latency, loss, outages"],
 ["dns","DNS benchmark","Fastest DNS for you"],["ip","My IP & ISP","IPv6, VPN, relay check"],["calc","Data calculator","Download time, data use"],
 ["pw","Wi-Fi password","Generate & test strength"],["mac","Device lookup","Who made that device?"],["subnet","Subnet calculator","Ranges, masks, CGNAT"],["compare","Global compare","You vs the world"]];
function renderToolGrid(){ $("toolGrid").innerHTML=TOOLS.map(([id,n,d])=>`<button class="tile2" data-tool="${id}" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true">${TICON[id]}</svg><span><b>${n}</b><small>${d}</small></span></button>`).join("") }
function openTool(id){
  if(id==="speed"){ ui.go("test"); setTimeout(()=>$("go").focus({preventScroll:true}),60); return }
  if(id==="router"){ $("rtOpen").click(); return }
  if(id==="compare"){ ui.go("insights"); return }
  $("toolBody").hidden=false;
  document.querySelectorAll(".tool").forEach(t=>t.hidden=t.dataset.tool!==id);
  document.querySelectorAll(".tile2").forEach(t=>t.setAttribute("aria-pressed",t.dataset.tool===id));
  if(id==="calc") calcInit(); if(id==="subnet") snRender(); if(id==="pw"&&!$("pwOut").textContent) pwGenerate(); if(id==="ping") pmRender();
  $("toolBody").scrollIntoView({behavior:"smooth",block:"start"});
}
async function fetchJSON(url,ms=6000){ const c=new AbortController(), t=setTimeout(()=>c.abort(),ms);
  try{ const r=await fetch(url,{signal:c.signal,cache:"no-store"}); return r.ok?await r.json():null }catch{ return null }finally{ clearTimeout(t) } }

/* ---- Ping & outage monitor ---- */
const PM_T={cf:()=>"https://1.1.1.1/cdn-cgi/trace?r="+nonce(), google:()=>"https://www.google.com/generate_204?r="+nonce(),
  server:()=>{ const s=selected==="auto"?CLOUDFLARE:byId(selected); return (s&&s.kind==="http"?s:CLOUDFLARE).ping() }};
let pm={on:false,timer:null,samples:[],sent:0,lost:0,streak:0,outages:[],outStart:null};
function pmStop(){ pm.on=false; clearTimeout(pm.timer); $("pmStart").textContent="Start monitoring" }
async function pmTick(){
  if(!pm.on) return; const t0=performance.now(); pm.sent++; let ms=null;
  try{ ms=await pingURL(PM_T[$("pmTarget").value](),2000) }catch{}
  if(!pm.on) return; const now=Date.now();
  if(ms==null){ pm.lost++; pm.streak++; if(pm.streak===3) pm.outStart=now-2000 }
  else { if(pm.outStart){ pm.outages.unshift({start:pm.outStart,end:now}) } pm.outStart=null; pm.streak=0 }
  pm.samples.push({t:now,ms}); if(pm.samples.length>300) pm.samples.shift();
  pmRender(); pm.timer=setTimeout(pmTick,Math.max(0,1000-(performance.now()-t0)));
}
function pmRender(){
  const ok=pm.samples.map(x=>x.ms).filter(v=>v!=null), f=v=>fin(v)?v.toFixed(0)+" ms":"—";
  const last=pm.samples[pm.samples.length-1];
  $("pmNow").textContent=last?(last.ms==null?"lost":f(last.ms)):"—";
  $("pmAvg").textContent=ok.length?f(ok.reduce((a,b)=>a+b,0)/ok.length):"—";
  $("pmMinMax").textContent=ok.length?`${Math.min(...ok).toFixed(0)} / ${Math.max(...ok).toFixed(0)}`:"—";
  $("pmJit").textContent=ok.length>1?f(ok.slice(1).reduce((a,v,i)=>a+Math.abs(v-ok[i]),0)/(ok.length-1)):"—";
  $("pmLoss").textContent=pm.sent?(100*pm.lost/pm.sent).toFixed(1)+"%":"—";
  $("pmOut").textContent=pm.outages.length+(pm.outStart?" + now":"");
  $("pmLog").innerHTML=(pm.outStart?`<div style="color:var(--bad)">Connection down since ${new Date(pm.outStart).toLocaleTimeString()}</div>`:"")+
    pm.outages.slice(0,10).map(o=>`<div>Dropped at ${new Date(o.start).toLocaleTimeString()} for ${Math.round((o.end-o.start)/1000)} s</div>`).join("")||(pm.sent?"No dropouts so far.":"");
  const c=$("pmChart"), x=c.getContext("2d"), W=c.width, H=c.height, L=70, B=20; x.clearRect(0,0,W,H);
  x.font=`500 20px ${css("--mono")}`; x.fillStyle=css("--muted"); x.textBaseline="middle";
  if(!pm.samples.length){ x.textAlign="center"; x.fillText("Press Start to begin",W/2,H/2); return }
  const slots=Math.min(300,Math.max(60,pm.samples.length)), m=Math.max(50,...ok)*1.15, py=v=>10+(H-10-B)*(1-v/m), step=(W-L-10)/(slots-1);
  x.strokeStyle=css("--track"); x.lineWidth=1; x.textAlign="right";
  for(let i=0;i<=3;i++){ const v=m*i/3, y=py(v); x.beginPath(); x.moveTo(L,y); x.lineTo(W-10,y); x.stroke(); x.fillText(v.toFixed(0),L-10,y) }
  const off=slots-pm.samples.length;
  pm.samples.forEach((sm,i)=>{ const X=L+(off+i)*step; if(sm.ms==null){ x.fillStyle=css("--bad"); x.fillRect(X-1,10,3,H-10-B) } });
  x.beginPath(); let started=false;
  pm.samples.forEach((sm,i)=>{ if(sm.ms==null){ started=false; return } const X=L+(off+i)*step, Y=py(sm.ms); started?x.lineTo(X,Y):x.moveTo(X,Y); started=true });
  x.strokeStyle=css("--down"); x.lineWidth=3; x.lineJoin="round"; x.stroke();
}

/* ---- DNS benchmark ---- */
function dnsWire(name){ // RFC 8484 GET: a minimal A query, base64url without padding
  const b=[0,0,1,0,0,1,0,0,0,0,0,0]; for(const l of name.split(".")){ b.push(l.length); for(const ch of l) b.push(ch.charCodeAt(0)) } b.push(0,0,1,0,1);
  return btoa(String.fromCharCode(...b)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
const DNS_PROV=[
 {name:"Cloudflare",ips:"1.1.1.1 and 1.0.0.1",alt:"Malware-blocking version: 1.1.1.2 and 1.0.0.2",url:n=>`https://cloudflare-dns.com/dns-query?dns=${dnsWire(n)}`},
 {name:"Google Public DNS",ips:"8.8.8.8 and 8.8.4.4",url:n=>`https://dns.google/dns-query?dns=${dnsWire(n)}`},
 {name:"Quad9",ips:"9.9.9.9 and 149.112.112.112",alt:"Blocks known malicious domains",url:n=>`https://dns.quad9.net/dns-query?dns=${dnsWire(n)}`},
 {name:"AdGuard DNS",ips:"94.140.14.14 and 94.140.15.15",alt:"Blocks ads and trackers",url:n=>`https://dns.adguard-dns.com/dns-query?dns=${dnsWire(n)}`},
 {name:"OpenDNS (Cisco)",ips:"208.67.222.222 and 208.67.220.220",url:n=>`https://doh.opendns.com/dns-query?dns=${dnsWire(n)}`}
];
async function dnsRun(){
  if(running) return; $("dnsRun").disabled=true; const rows=[];
  for(const [i,p] of DNS_PROV.entries()){
    $("dnsMsg").textContent=`Testing ${p.name} (${i+1} of ${DNS_PROV.length})…`;
    const t=async n=>{ try{ return await pingURL(p.url(n),3000) }catch{ return null } };
    await t("www.google.com"); // opens the connection
    const cached=[], fresh=[];
    for(let k=0;k<4;k++) cached.push(await t("www.google.com"));
    for(let k=0;k<3;k++) fresh.push(await t(`cs${nonce().slice(0,8)}.example.com`));
    const c=median(cached.filter(v=>v!=null)), f=median(fresh.filter(v=>v!=null));
    rows.push({...p,c,f,score:fin(c)&&fin(f)?(c+f)/2:Infinity});
  }
  rows.sort((a,b)=>a.score-b.score); const best=rows[0];
  const ms=v=>fin(v)?v.toFixed(0)+" ms":"no reply";
  $("dnsRows").innerHTML=rows.map((r,i)=>`<tr><td>${esc(r.name)}${i===0&&fin(r.score)?' <span class="sev not">Fastest</span>':""}${r.alt?`<div class="note">${esc(r.alt)}</div>`:""}</td><td>${ms(r.c)}</td><td>${ms(r.f)}</td><td>${esc(r.ips)}</td></tr>`).join("");
  $("dnsRec").innerHTML=fin(best.score)?`<div class="callout good"><b>Fastest for you: ${esc(best.name)}.</b> To use it everywhere at home: router admin page → Internet (WAN) settings, or LAN/DHCP Server settings → DNS → choose Manual and enter <b>${esc(best.ips)}</b>. Save; devices switch over when they reconnect.<details class="fixbox" style="margin-top:6px"><summary>Only on one device instead?</summary><ol class="fixsteps"><li>iPhone: Settings → Wi-Fi → ⓘ next to your network → Configure DNS → Manual → add ${esc(best.ips)}.</li><li>Android: Settings → Network → Private DNS → enter the provider's DNS hostname.</li><li>Windows/Mac: network adapter settings → DNS servers → add ${esc(best.ips)}.</li></ol></details></div>`
    :`<div class="callout bad">No DNS service answered from this browser. Your network may block encrypted DNS.</div>`;
  $("dnsMsg").textContent="Done."; $("dnsRun").disabled=false;
}

/* ---- My IP & ISP ---- */
const inCidr=(ip,net,bits)=>{ const a=ipToInt(ip), n=ipToInt(net); return a!=null&&n!=null&&((a>>>(32-bits))===(n>>>(32-bits))) };
async function ipRun(){
  $("ipRun").disabled=true; $("ipMsg").textContent="Looking up…"; $("ipOut").innerHTML=""; $("ipNotes").innerHTML="";
  const [info,v4,v6]=await Promise.all([fetchJSON("https://ipinfo.io/json"),fetchJSON("https://api.ipify.org?format=json",5000),fetchJSON("https://api6.ipify.org?format=json",5000)]);
  $("ipRun").disabled=false;
  if(!info&&!v4){ $("ipMsg").textContent="Couldn't reach the lookup services. Check your connection or content blocker."; return }
  if(info&&info.loc&&!(store.get("geo",{})||{}).src) { const [la,lo]=info.loc.split(",").map(Number); if(fin(la)&&fin(lo)) { store.set("geo",{lat:la,lon:lo,src:"ip"}); mapBase=null; drawMap(performance.now()) } }
  const ip=(info&&info.ip)||(v4&&v4.ip), org=(info&&info.org)||"", asn=(org.match(/^AS\d+/)||[""])[0], isp=org.replace(/^AS\d+\s*/,"");
  const loc=info?[info.city,info.region,info.country].filter(Boolean).join(", "):"";
  const kv=[["Public IPv4",(v4&&v4.ip)||(ip&&ip.includes(".")?ip:"—")],["IPv6",v6&&v6.ip?`Working · ${v6.ip}`:"Not available on this connection"],
    ["Provider",isp||"—"],["Network (ASN)",asn||"—"],["Approx. location",loc||"—"],["Time zone",(info&&info.timezone)||"—"]];
  $("ipOut").innerHTML=kv.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("");
  const notes=[];
  if(/cloudflare|akamai|apple|fastly/i.test(org)) notes.push(["warn",`Your traffic appears to go through ${esc(isp)}. That usually means iCloud Private Relay or a VPN is on, so speed tests measure the relay, not just your line. For a true reading, turn it off briefly: iPhone Settings → your name → iCloud → Private Relay.`]);
  if(!(v6&&v6.ip)) notes.push(["warn","IPv6 isn't working here. Most large providers support it: router admin page → IPv6 or Internet settings → turn IPv6 on (often \"Auto\" or \"SLAAC/DHCPv6\"). It can improve speeds to big services."]);
  const v4ip=(v4&&v4.ip)||ip;
  if(v4ip&&inCidr(v4ip,"100.64.0.0",10)) notes.push(["bad","Your public address is in the carrier-grade NAT range, so port forwarding and remote access to home devices won't work."]);
  notes.push(["",`<b>Behind carrier-grade NAT?</b> Compare this public IPv4 with the WAN or Internet IP on your router's Status page. If they differ, or the router shows 100.64–100.127.x.x, your provider shares one address among many customers. Ask them for a public IP if you need port forwarding.`]);
  $("ipNotes").innerHTML=notes.map(([c,t])=>`<div class="callout ${c}">${t}</div>`).join("");
  $("ipMsg").textContent="";
}

/* ---- Data calculator ---- */
const ACTS=[["Music streaming",0.32],["Online gaming (data only)",0.15],["SD video",1.5],["HD video call",3.8],["HD streaming",5],["4K streaming",15]];
function calcInit(){ if(!$("clSpeed").value){ const r=store.get("history",[])[0]; $("clSpeed").value=r&&fin(r.down)?(+conv(r.down).toPrecision(4)):(+conv(mbpsToBps(50)).toPrecision(4)) } calcRender() }
function fmtDur(sec){ if(!fin(sec)||sec<0) return "—"; if(sec<1) return "under a second";
  const h=Math.floor(sec/3600), m=Math.floor(sec%3600/60), s=Math.round(sec%60);
  return [h&&`${h} h`,m&&`${m} min`,!h&&s&&`${s} s`].filter(Boolean).join(" ") }
function calcRender(){
  const v=+$("clSpeed").value, p={K:1,M:2,G:3}[unit[0]], bps=v*base**p/(unit[1]==="b"?8:1);
  const bytes=(+$("clSize").value)*(+$("clSizeU").value);
  $("clOut").innerHTML=bps>0&&bytes>0?`At ${fmtNum(v)} ${unitLabel()}, ${fmtNum(bytes/1e9)} GB takes about <b>${fmtDur(bytes/bps)}</b>. In practice add 10–20% for overhead and busy servers.`:"Enter a speed and a file size.";
  const plan=+$("clPlan").value;
  $("clRows").innerHTML=ACTS.map(([n,mb])=>{ const gbh=mb*0.45; return `<tr><td>${n}</td><td>${mb} Mbps</td><td>${gbh<1?(gbh*1000).toFixed(0)+" MB":gbh.toFixed(2)+" GB"}</td><td>${plan>0?fmtDur(plan/gbh*3600):"—"}</td></tr>` }).join("");
}

/* ---- Wi-Fi password ---- */
const COMMON=new Set("password 12345678 123456789 1234567890 qwerty123 qwertyuiop asdfghjkl iloveyou admin123 11111111 00000000 password1 password123 welcome1 abcd1234 letmein1 sunshine princess football baseball dragon12 master12 monkey12 india123 9876543210 87654321 wifi1234 internet airtel123 jio12345 bsnl1234 home1234 family123 changeme".split(" "));
function pwGenerate(){
  const len=Math.min(63,Math.max(12,+$("pwLen").value||20)), sym=$("pwSym").checked;
  const cs="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"+(sym?"!#%+-=?@_~":""); // no look-alikes (0/O, 1/l/I)
  const out=[], rnd=new Uint32Array(len*2); crypto.getRandomValues(rnd);
  for(let i=0;out.length<len;i++){ const r=rnd[i%rnd.length]; const lim=Math.floor(2**32/cs.length)*cs.length; if(r<lim) out.push(cs[r%cs.length]); else crypto.getRandomValues(rnd) }
  $("pwOut").textContent=out.join(""); $("pwTest").value=out.join(""); pwCheck();
}
function pwCheck(){
  const p=$("pwTest").value, bar=$("pwBar"), out=$("pwVerdict");
  if(!p){ bar.style.width="0"; out.textContent="Type a password to see how long it would take to crack."; return }
  let pool=0; if(/[a-z]/.test(p)) pool+=26; if(/[A-Z]/.test(p)) pool+=26; if(/\d/.test(p)) pool+=10; if(/[^a-zA-Z0-9]/.test(p)) pool+=33;
  let bits=p.length*Math.log2(Math.max(pool,1)); const issues=[];
  const low=p.toLowerCase();
  if(COMMON.has(low)||COMMON.has(low.replace(/[!@#.]+$/,""))){ bits=Math.min(bits,10); issues.push("it's on common-password lists") }
  if(/(.)\1{2,}/.test(p)){ bits-=10; issues.push("it repeats characters") }
  if(/(0123|1234|2345|3456|4567|5678|6789|abcd|bcde|qwer|wert|asdf|zxcv)/i.test(p)){ bits-=12; issues.push("it contains a keyboard or number sequence") }
  if(/^\d+$/.test(p)){ bits=Math.min(bits,p.length*3.32); issues.push("it's only digits (phone numbers and dates are guessed first)") }
  if(/(19|20)\d{2}/.test(p)) { bits-=6; issues.push("it contains a year") }
  bits=Math.max(0,bits); const guesses=2**bits/2;
  const pl=(n,w)=>`${n.toLocaleString()} ${w}${n===1?"":"s"}`;
  const t=g=>{ const s=guesses/g; return s<60?"seconds":s<3600?pl(Math.round(s/60),"minute"):s<86400?pl(Math.round(s/3600),"hour"):s<3.15e7?pl(Math.round(s/86400),"day"):s<3.15e9?pl(Math.round(s/3.15e7),"year"):"millions of years+" };
  const lvl=bits<40?["Weak","--bad",25]:bits<60?["Fair","--ok",50]:bits<80?["Strong","--good",78]:["Excellent","--good",100];
  bar.style.width=lvl[2]+"%"; bar.style.background=css(lvl[1]);
  const lenWarn=p.length<8?" Wi-Fi (WPA2/WPA3) requires at least 8 characters.":p.length>63?" Wi-Fi passwords can't be longer than 63 characters.":"";
  out.innerHTML=`<b style="color:var(${lvl[1]})">${lvl[0]}</b> · ${bits<10?"under 10":"about "+Math.round(bits)} bits. One graphics card: <b>${t(1e6)}</b>. Large cracking rig: <b>${t(1e9)}</b>.${issues.length?` Weaker because ${issues.join(", ")}.`:""}${lenWarn}`;
}

/* ---- Device maker lookup ---- */
// The IEEE registry ships beside the page as oui.txt (loaded only when this tool runs) so lookups work offline
// and MAC addresses never leave the device. Longest block wins: 36-bit (MA-S), 28-bit (MA-M), then 24-bit (MA-L).
let ouiMap=null, ouiTried=false;
async function loadOUI(){
  if(ouiMap||ouiTried) return ouiMap; ouiTried=true;
  try{ const r=await fetch("oui.txt",{cache:"force-cache"}); if(!r.ok) return null;
    const m=new Map(); for(const line of (await r.text()).split("\n")){ const i=line.indexOf("\t"); if(i>0&&line[0]!=="#") m.set(line.slice(0,i),line.slice(i+1)) }
    ouiMap=m.size?m:null }catch{}
  return ouiMap;
}
// What a chip or platform maker usually means in a home network (shown as a hint, not a verdict).
const MAKER_HINT=[
 [/espressif/i,"ESP32/ESP8266 Wi-Fi chip: smart plugs, bulbs, switches, sensors. Likely a smart-home device; keep it on the guest network."],
 [/tuya/i,"Tuya smart-home platform: plugs, bulbs, cameras, sensors. Likely a smart-home device; keep it on the guest network."],
 [/fn-link/i,"Wi-Fi module maker: often inside smart TVs, set-top boxes and IoT gadgets."],
 [/azurewave|bilian|lb-link|realtek|mediatek|murata|silicon lab|universal global scientific|hon hai|foxconn|liteon|quectel/i,"Component maker: the chip is inside another brand's product (TV, camera, laptop, appliance)."],
 [/apple/i,"Apple device (iPhone, iPad, Mac, Apple TV, HomePod)."],[/samsung/i,"Samsung device (phone, TV, appliance)."],
 [/google/i,"Google device (Pixel, Nest, Chromecast)."],[/amazon/i,"Amazon device (Echo, Fire TV, Ring, Kindle)."],
 [/xiaomi|redmi/i,"Xiaomi device (phone, TV box, smart-home)."],[/hikvision|dahua|ezviz|imou/i,"Security camera or recorder. Keep firmware updated and off the main network."]
];
const hintFor=v=>(MAKER_HINT.find(([re])=>re.test(v))||[0,""])[1];
async function macRun(){
  const lines=$("macIn").value.split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean); if(!lines.length){ $("macMsg").textContent="Paste at least one MAC address."; return }
  $("macRun").disabled=true; $("macMsg").textContent="Loading the maker registry…";
  const db=await loadOUI(); const rows=[], online={};
  for(const raw of lines.slice(0,60)){
    const hex=raw.replace(/[^0-9a-f]/gi,"").toUpperCase();
    if(hex.length!==12){ rows.push([raw,"Not a valid MAC address","A MAC has 12 hex digits, e.g. 3C:84:6A:12:34:56."]); continue }
    const mac=hex.match(/../g).join(":"), b0=parseInt(hex.slice(0,2),16);
    if(b0&1){ rows.push([mac,"Group (multicast) address","Not a single device."]); continue }
    if(b0&2){ rows.push([mac,"Private (randomised) address","Set by the device itself for privacy (iPhone, Android, Windows). Usually a phone or laptop; check its Wi-Fi settings to match."]); continue }
    let v=db?(db.get(hex.slice(0,9))||db.get(hex.slice(0,7))||db.get(hex.slice(0,6))):undefined;
    if(!db){ // registry file not available (e.g. page saved on its own): browser-friendly online fallback
      const oui=hex.slice(0,6);
      if(!(oui in online)){ $("macMsg").textContent=`Looking up ${mac.slice(0,8)} online…`;
        const j=await fetchJSON(`https://api.maclookup.app/v2/macs/${oui}`,6000); online[oui]=j&&j.success?(j.found?j.company:""):null; await sleep(600) }
      v=online[oui]===null?null:online[oui]||"";
    }
    if(v===null) rows.push([mac,"Lookup unavailable","The maker registry couldn't be loaded. Check your connection and try again."]);
    else if(!v) rows.push([mac,"Not in the IEEE registry","Unregistered maker code. If you don't recognise this device, block it in your router and change the Wi-Fi password."]);
    else rows.push([mac,v,hintFor(v)]);
  }
  $("macRows").innerHTML=rows.map(([m,v,n])=>`<div class="macrow"><div class="m">${esc(m)}</div><div class="v">${esc(v)}</div>${n?`<div class="n">${esc(n)}</div>`:""}</div>`).join("");
  $("macMsg").textContent=(lines.length>60?"Showing the first 60. ":"")+(db?"Done (on this device).":"Done.");
  $("macSrc").textContent=db?"Looked up on this device from the IEEE maker registry; addresses are never sent anywhere. Registry data: oui-data by silverwind (BSD-2-Clause), from IEEE."
    :"The built-in registry wasn't available, so only the 6-character maker code was sent to maclookup.app.";
  $("macRun").disabled=false;
}

/* ---- Subnet calculator ---- */
function ipToInt(ip){ const p=String(ip).trim().split("."); if(p.length!==4||p.some(x=>!/^\d{1,3}$/.test(x)||+x>255)) return null; return ((+p[0]<<24)>>>0)+(+p[1]<<16)+(+p[2]<<8)+(+p[3]) }
const intToIp=n=>[n>>>24,(n>>>16)&255,(n>>>8)&255,n&255].join(".");
function snRender(){
  const v=$("snIn").value.trim(); let [ipS,rest]=v.split(/[\/\s]+/), prefix;
  const ip=ipToInt(ipS);
  if(rest==null) prefix=32; else if(/^\d{1,2}$/.test(rest)) prefix=+rest; else { const m=ipToInt(rest); if(m!=null){ const b=m.toString(2).padStart(32,"0"); prefix=/^1*0*$/.test(b)?b.indexOf("0")<0?32:b.indexOf("0"):NaN } }
  if(ip==null||!(prefix>=0&&prefix<=32)){ $("snOut").innerHTML=""; $("snNote").innerHTML=`<div class="callout warn">Enter an address like 192.168.1.1/24 or 10.0.0.5 255.255.255.0.</div>`; return }
  const mask=prefix?(0xFFFFFFFF<<(32-prefix))>>>0:0, net=(ip&mask)>>>0, bc=(net|(~mask>>>0))>>>0, size=2**(32-prefix);
  const first=prefix>=31?net:net+1, lastH=prefix>=31?bc:bc-1, hosts=prefix===32?1:prefix===31?2:size-2;
  const types=[["10.0.0.0",8,"Private (home/office network)"],["172.16.0.0",12,"Private (home/office network)"],["192.168.0.0",16,"Private (home/office network)"],
    ["100.64.0.0",10,"Carrier-grade NAT (shared by your provider)"],["127.0.0.0",8,"Loopback (this device)"],["169.254.0.0",16,"Link-local (no DHCP address was given)"],["224.0.0.0",4,"Multicast"]];
  const ty=(types.find(([n,b])=>inCidr(intToIp(ip),n,b))||[0,0,"Public internet address"])[2];
  const kv=[["Address",`${intToIp(ip)}/${prefix}`],["Type",ty],["Network",intToIp(net)],["Broadcast",prefix>=31?"—":intToIp(bc)],["Usable range",`${intToIp(first)} – ${intToIp(lastH)}`],
    ["Usable hosts",hosts.toLocaleString()],["Subnet mask",intToIp(mask)],["Wildcard",intToIp(~mask>>>0)]];
  $("snOut").innerHTML=kv.map(([k,x])=>`<dt>${k}</dt><dd>${esc(x)}</dd>`).join("");
  $("snNote").innerHTML=ty.startsWith("Carrier")?`<div class="callout bad">If this is your router's WAN address, you're behind carrier-grade NAT: port forwarding and remote access won't work. Ask your provider for a public (static or dynamic) IPv4 address.</div>`
    :ty.startsWith("Link-local")?`<div class="callout warn">A 169.254 address means the device didn't get an address from the router. Restart the router and reconnect.</div>`:"";
}

/* =================== Wire up =================== */
function renderAll(){ renderCompare(); renderInsights() }
function syncUnits(){
  document.querySelectorAll("#unitB button,#unitb button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.u===unit));
  document.querySelectorAll("#baseSeg button").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.b===base));
  document.querySelectorAll("[data-unit]").forEach(e=>e.textContent=unitLabel()); if(typeof gaugeKick==='function') gaugeKick();
  if(last) showResult(last);
  renderHist(); renderAll(); if(!$("toolBody").hidden&&!document.querySelector('.tool[data-tool="calc"]').hidden){ $("clSpeed").value=""; calcInit() }
}
const pickUnit=e=>{const u=e.target.dataset.u; if(u){unit=u;store.set("unit",u);syncUnits()}};
$("unitB").onclick=pickUnit; $("unitb").onclick=pickUnit;
$("baseSeg").onclick=e=>{const b=+e.target.dataset.b; if(b){base=b;store.set("base",b);syncUnits()}};
$("srvOpen").onclick=()=>{$("srvPanel").hidden=false; renderServers(); ui.sheet(true)};
$("srvClose").onclick=()=>{$("srvPanel").hidden=true; ui.sheet(false)};
$("srvPing").onclick=pingAll;
$("rtOpen").onclick=()=>{ if(running) return; ui.go("router") };
ui.onView(v=>{ if(v==="router"){ rtLoad(); if(rtLast) renderRouterReport() } });
$("rtClose").onclick=()=>ui.go("test");
$("rtQs").onclick=e=>{ const b=e.target.closest("button"), g=e.target.closest(".seg"); if(!b||!g) return;
  rtAnswers[g.dataset.q]=b.dataset.v; g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",x===b)); rtSave() };
["rtBrand","rtModel","rtHw","rtFw","rtEnc"].forEach(id=>$(id).addEventListener("change",rtSave));
$("rtRun").onclick=runRouterCheck;
$("lvLocate").onclick=locate; $("lvAnim").onchange=()=>{ if(!$("lvAnim").checked){ pk=[]; hits=[] } drawMap(performance.now()) };
if(matchMedia("(prefers-reduced-motion: reduce)").matches) $("lvAnim").checked=false;
$("lvLive").checked=store.get("livePing",true);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ gaugeKick(); drawSpark(); mapBase=null; try{ drawMap(performance.now()); telDraw() }catch{} }); $("lvLive").onchange=()=>{ store.set("livePing",$("lvLive").checked); idleTick() };
if((store.get("geo",{})||{}).src==="device") $("lvLocate").textContent="Location set";
onScheme(()=>{ mapBase=null; drawMap(performance.now()); telDraw() });
drawMap(performance.now()); telDraw();
let rzT=0; window.addEventListener("resize",()=>{ clearTimeout(rzT); rzT=setTimeout(()=>{ mapBase=null; drawMap(performance.now()) },150) });
renderToolGrid(); $("toolGrid").onclick=e=>{ const b=e.target.closest(".tile2"); if(b) openTool(b.dataset.tool) };
$("pmStart").onclick=()=>{ if(pm.on){ pmStop(); return } if(running) return; pm.on=true; $("pmStart").textContent="Stop"; pmTick() };
$("pmReset").onclick=()=>{ const on=pm.on; pmStop(); pm={on:false,timer:null,samples:[],sent:0,lost:0,streak:0,outages:[],outStart:null}; pmRender(); if(on) $("pmStart").click() };
$("dnsRun").onclick=dnsRun; $("ipRun").onclick=ipRun; $("macRun").onclick=macRun;
["clSpeed","clSize","clSizeU","clPlan"].forEach(id=>$(id).addEventListener("input",calcRender));
$("clPresets").onclick=e=>{ const sz=+e.target.dataset.sz; if(!sz) return; if(sz>=1e9){$("clSize").value=sz/1e9;$("clSizeU").value="1e9"} else {$("clSize").value=sz/1e6;$("clSizeU").value="1e6"} calcRender() };
$("pwGen").onclick=pwGenerate; $("pwTest").addEventListener("input",pwCheck);
$("pwCopy").onclick=()=>{ const t=$("pwOut").textContent; if(!t) return; navigator.clipboard?navigator.clipboard.writeText(t).then(()=>$("pwVerdict").insertAdjacentHTML("afterbegin","Copied. "),()=>{}):0 };
$("snIn").addEventListener("input",snRender); $("rtCopy").onclick=copyRouterReport;
$("srvList").onchange=e=>{ if(e.target.name==="srv"){ selected=e.target.value; store.set("server",selected); $("mlabConsent").hidden=selected!=="mlab"; syncServerName() } };
$("mlabOk").checked=store.get("mlabOk",false); $("mlabOk").onchange=()=>store.set("mlabOk",$("mlabOk").checked);
$("netSeg").onclick=e=>{const n=e.target.dataset.n; if(!n) return; netPick=n; netAutoOn=false; store.set("netPick",n); $("err").textContent=""; syncNet()};
navigator.connection&&navigator.connection.addEventListener&&navigator.connection.addEventListener("change",()=>{const d=detectedNet(); if(d){netPick=d;netAutoOn=true} syncNet()});
$("rows").onchange=e=>{ const el=e.target; if(!el.classList.contains("netfix")) return;
  const h=store.get("history",[]), r=h.find(x=>String(x.t)===el.dataset.t); if(!r) return;
  r.net=el.value; store.set("history",h); if(last&&last.t===r.t) last.net=r.net; fillWhich(); renderHist(); renderAll() };
$("cmpType").onchange=renderAll; $("cmpWhich").onchange=renderAll;
$("cmpCountry").onchange=()=>{store.set("cmpCountry",$("cmpCountry").value);renderAll()};
$("histFilter").onchange=renderHist;
$("go").onclick=run;
$("stopTest").onclick=()=>{ if(testCtl&&!testCtl.signal.aborted){ testCtl.abort(); $("phase").textContent="Stopping…" } }; $("exp").onclick=exportCSV; $("copyRes").onclick=copyResult;
$("clr").onclick=()=>{$("clrConfirm").hidden=false};
$("clrNo").onclick=()=>{$("clrConfirm").hidden=true};
$("clrYes").onclick=()=>{store.set("history",[]);last=null;$("clrConfirm").hidden=true;$("csv").hidden=true;fillWhich();renderHist();renderAll()};
onScheme(()=>{renderHist();renderAll();drawSpark();gaugeKick()});
$("cmpType").value=connLabel()==="Mobile data"?"mobile":"fixed"; syncNet();
if(!byId(selected)&&selected!=="auto") selected="auto";
initCompare(); fillWhich(); renderServers(); syncServerName();
{ const h=store.get("history",[]); if(h[0]){ last=h[0]; showResult(last); $("copyRes").disabled=false } }
/* =================== Packet collider: a CMS-style detector on an LHC-style ring, driven by the real byte counters ===================
   Modelled on the real thing: a 12-sided barrel detector around the beam pipe — silicon tracker, crystal electromagnetic
   calorimeter, brass hadron calorimeter, superconducting solenoid and a red iron return yoke with muon chambers — sitting on
   a ring of blue dipole magnets.
   Download: two cyan bunches race in along the beam pipe from both sides and collide in the centre; the collision showers
   tracks that curl in the magnetic field and light up the calorimeters. One collision is launched only when that much data
   has really arrived. Upload: amber bunches leave the centre in both directions for each chunk really sent.
   Ping: green probes run out along the pipe and back over each measured round trip (slowed 20×).
   Teardown: when the test ends the detector opens like CMS does for maintenance — endcaps slide out, barrel wheels part —
   and each part carries a result (ping, download, upload). */
const col=(()=>{
  const cv=$("collider"); let cx=cv.getContext("2d"); const  SLOWC=20, MAXP=120, MAXT=320, RING=4.2;
  const reduce=matchMedia("(prefers-reduced-motion: reduce)");
  let W=0,H=0,dpr=1, yaw=0.98, sway=0, stat=document.createElement("canvas"), statKey="", parts=[], tracks=[], hits=[], flashes=[], seen={dir:"",b:0,acc:0}, per=0, raf=0, last=0, lastDraw=0, vis=false;
  let explode=0, explodeT0=0, result=null, frameCost=0;
  /* Blender plates (assets/3d, rendered by blender/render_plates.py). When present, the detector is a Cycles render
     and the live overlay uses the render camera's exact projection; otherwise the model is drawn here. */
  let plate=null;
  function loadPlates(){
    fetch("assets/3d/scene.json",{cache:"no-cache"}).then(r=>r.ok?r.json():null).then(m=>{
      if(!m||!m.view||!m.frames) return; const imgs=new Array(m.frames).fill(null);
      const need=i=>{ if(imgs[i]) return imgs[i]; const im=new Image(); im.decoding="async"; im.src=`assets/3d/collider-${String(i).padStart(2,"0")}.webp`; im.onload=()=>{ statKey=""; kick() }; return imgs[i]=im };
      plate={m,imgs,need}; need(0); need(m.frames-1); cv.closest(".colwrap").classList.add("plate"); statKey=""; kick();
    }).catch(()=>{});
  }
  function plateAll(){ if(plate) for(let i=0;i<plate.m.frames;i++) plate.need(i) }
  const tok=n=>css(n), dark=()=>getComputedStyle(document.documentElement).colorScheme.includes("dark");
  const ease=k=>1-Math.pow(1-k,3), lerp=(a,b,k)=>a+(b-a)*k;
  // real-detector materials (physical colours, the same in both themes)
  const MAT={tracker:[196,178,128], ecal:[86,170,170], hcal:[184,128,62], sol:[178,188,196], yoke:[176,48,40], muon:[150,156,160], pipe:[200,206,210], dipole:[38,98,178]};
  const BARREL=[["tracker",0.07,0.27],["ecal",0.27,0.37],["hcal",0.37,0.53],["sol",0.53,0.6],["yoke",0.6,0.68],["muon",0.68,0.72],["yoke",0.72,0.83],["muon",0.83,0.87],["yoke",0.87,1.0]];
  const WHEELS=[-0.75,-0.45,-0.15,0.15,0.45,0.75], ENDCAP=[0.75,0.98];
  function size(){ dpr=Math.min(2,devicePixelRatio||1); const r=cv.getBoundingClientRect(); W=Math.max(1,Math.round(r.width*dpr)); H=Math.max(1,Math.round(r.height*dpr)); if(cv.width!==W||cv.height!==H){ cv.width=W; cv.height=H } }
  // camera
  const PITCH=0.36, DIST=5.6;
  function P(x,y,z){ if(plate) return PP(x,y,z); const yy=yaw+sway, cy=Math.cos(yy), sy=Math.sin(yy), X=x*cy+z*sy, Z=-x*sy+z*cy;
    const cp=Math.cos(PITCH), sp=Math.sin(PITCH), Y2=y*cp-Z*sp, Z2=y*sp+Z*cp;  // Z2: + is away from the camera
    const e=ease(explode), nar=W/dpr<640, s=Math.min(W,H*1.7)*(nar?0.21:0.19)*(1-0.18*e)/(1+Z2/DIST);
    return [W*0.5+X*s, H*(0.5+0.04*e)-Y2*s, Z2] }
  function PP(x,y,z){ // app (x across, y up, z beam) -> Blender (x, z, y) -> camera -> plate pixels -> canvas (contain)
    const v=plate.m.view, bx=x, by=z, bz=y;
    const cx_=v[0][0]*bx+v[0][1]*by+v[0][2]*bz+v[0][3], cy_=v[1][0]*bx+v[1][1]*by+v[1][2]*bz+v[1][3], cz_=v[2][0]*bx+v[2][1]*by+v[2][2]*bz+v[2][3];
    const d=Math.max(0.01,-cz_), u=plate.m.width/2+plate.m.f_px*cx_/d, w=plate.m.height/2-plate.m.f_px*cy_/d;
    const k=Math.min(W/plate.m.width,H/plate.m.height), ox=(W-plate.m.width*k)/2, oy=(H-plate.m.height*k)/2;
    return [ox+u*k, oy+w*k, d-6] }
  const camDir=()=>{ const yy=yaw+sway; return [Math.sin(yy)*Math.cos(PITCH)*-1, Math.sin(PITCH), Math.cos(yy)*Math.cos(PITCH)] };
  // teardown offsets along the beam axis
  function zShift(z){ const e=ease(explode); if(!e) return 0; const s=Math.sign(z)||0;
    if(Math.abs(z)>=ENDCAP[0]-1e-6) return s*1.05*e;        // endcaps slide out
    return z*0.55*e }                                        // barrel wheels part
  const ring=t=>[-RING+RING*Math.cos(t),0,RING*Math.sin(t)]; // tangent to the beam axis at the detector (t=0)
  function shade(rgb,n,a=1){ const L=[-0.45,0.75,0.5], d=Math.max(0,(n[0]*L[0]+n[1]*L[1]+n[2]*L[2])/Math.hypot(...L)); const k=0.38+0.72*d;
    return `rgba(${Math.min(255,rgb[0]*k)|0},${Math.min(255,rgb[1]*k)|0},${Math.min(255,rgb[2]*k)|0},${a})` }
  // ---- geometry: quads with a world normal, painted far to near
  function cutSectors(){ // the four sectors nearest the camera are cut away, so the collision point is visible
    const N=12, rot=Math.PI/12, d=[]; for(let i=0;i<N;i++){ const m=rot+(i+.5)/N*Math.PI*2; d.push([P(Math.cos(m),Math.sin(m),0)[2],i]) }
    d.sort((a,b)=>a[0]-b[0]); return new Set(d.slice(0,4).map(x=>x[1])) }
  function prism(quads,mat,r0,r1,z0,z1,caps=[true,true],cut=null){
    const N=12, rot=Math.PI/12;
    const p=(r,t,z)=>[Math.cos(t)*r,Math.sin(t)*r,z];
    if(cut) for(let i=0;i<N;i++){ const a=rot+i/N*Math.PI*2, b=rot+(i+1)/N*Math.PI*2;
      if(cut.has(i)&&!cut.has((i+N-1)%N)) quads.push({pts:[p(r0,a,z0),p(r1,a,z0),p(r1,a,z1),p(r0,a,z1)],n:[Math.sin(a),-Math.cos(a),0],mat,cap:true,two:true});
      if(cut.has(i)&&!cut.has((i+1)%N)) quads.push({pts:[p(r0,b,z1),p(r1,b,z1),p(r1,b,z0),p(r0,b,z0)],n:[-Math.sin(b),Math.cos(b),0],mat,cap:true,two:true}) }
    for(let i=0;i<N;i++){ if(cut&&cut.has(i)) continue; const a=rot+i/N*Math.PI*2, b=rot+(i+1)/N*Math.PI*2, m=(a+b)/2;
      quads.push({pts:[p(r1,a,z0),p(r1,b,z0),p(r1,b,z1),p(r1,a,z1)],n:[Math.cos(m),Math.sin(m),0],mat});              // outer face
      if(caps[1]) quads.push({pts:[p(r0,a,z1),p(r1,a,z1),p(r1,b,z1),p(r0,b,z1)],n:[0,0,1],mat,cap:true});           // front cap
      if(caps[0]) quads.push({pts:[p(r0,b,z0),p(r1,b,z0),p(r1,a,z0),p(r0,a,z0)],n:[0,0,-1],mat,cap:true});          // back cap
    }
  }
  function detector(){
    const q=[], cut=cutSectors();
    for(let w=0;w<WHEELS.length-1;w++){ const z0=WHEELS[w], z1=WHEELS[w+1], dz=zShift((z0+z1)/2)+0;
      for(const [m,r0,r1] of BARREL) prism(q,m,r0,r1,z0+dz,z1+dz,[true,true],cut) }
    for(const s of [-1,1]){ const z0=s>0?ENDCAP[0]:-ENDCAP[1], z1=s>0?ENDCAP[1]:-ENDCAP[0], dz=zShift(s*0.9);
      for(const [m,r0,r1] of [["hcal",0.1,0.53],["yoke",0.53,0.7],["muon",0.7,0.74],["yoke",0.74,1.0]]) prism(q,m,r0,r1,z0+dz,z1+dz) }
    return q;
  }
  function paint(q){
    const cam=camDir(), list=[];
    for(const f of q){ const pr=f.pts.map(p=>P(...p)); let area=0; for(let i=0;i<4;i++){ const a=pr[i], b=pr[(i+1)%4]; area+=a[0]*b[1]-b[0]*a[1] }
      if(area>=0&&!f.two) continue;                           // back face: hidden (cut walls are drawn from both sides)
      list.push({pr,z:(pr[0][2]+pr[1][2]+pr[2][2]+pr[3][2])/4,f}) }
    list.sort((a,b)=>b.z-a.z);
    for(const {pr,f} of list){ const rgb=MAT[f.mat]; cx.fillStyle=shade(rgb,f.n); cx.beginPath(); pr.forEach((p,i)=>i?cx.lineTo(p[0],p[1]):cx.moveTo(p[0],p[1])); cx.closePath(); cx.fill();
      cx.strokeStyle=`rgba(0,0,0,${f.cap?.28:.18})`; cx.lineWidth=0.7*dpr; cx.stroke();
      if(f.mat==="ecal"&&f.cap){ cx.strokeStyle="rgba(255,255,255,.18)"; cx.lineWidth=0.5*dpr; for(let k=1;k<4;k++){ const a=[lerp(pr[0][0],pr[1][0],k/4),lerp(pr[0][1],pr[1][1],k/4)], b=[lerp(pr[3][0],pr[2][0],k/4),lerp(pr[3][1],pr[2][1],k/4)]; cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke() } } }
  }
  function cylinder(a,b,r,rgb,alpha=1){ // a short tube between two points (dipole magnets, beam pipe), drawn as a thick line with a highlight
    const A=P(...a), B=P(...b), s=r*Math.min(W,H*1.7)*0.27/(1+(A[2]+B[2])/2/DIST);
    cx.lineCap="round"; cx.strokeStyle=`rgba(${rgb[0]*.55|0},${rgb[1]*.55|0},${rgb[2]*.55|0},${alpha})`; cx.lineWidth=s*2; cx.beginPath(); cx.moveTo(A[0],A[1]); cx.lineTo(B[0],B[1]); cx.stroke();
    cx.strokeStyle=`rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`; cx.lineWidth=s*1.3; cx.beginPath(); cx.moveTo(A[0],A[1]-s*.25); cx.lineTo(B[0],B[1]-s*.25); cx.stroke();
    cx.strokeStyle=`rgba(255,255,255,${.35*alpha})`; cx.lineWidth=s*.35; cx.beginPath(); cx.moveTo(A[0],A[1]-s*.6); cx.lineTo(B[0],B[1]-s*.6); cx.stroke() }
  function drawRing(){ // the accelerator: blue dipole magnets along a ring that passes through the detector
    const segs=[]; for(let i=-14;i<=14;i++){ if(Math.abs(i)<1) continue; const t0=i*0.06, t1=t0+0.045*Math.sign(i); segs.push([t0,t1]) }
    segs.sort((a,b)=>P(...ring(b[0]))[2]-P(...ring(a[0]))[2]);
    for(const [t0,t1] of segs){ const d=P(...ring(t0))[2]; if(d<-1.2&&Math.abs(t0)<0.1) continue;
      const fade=Math.max(.25,Math.min(1,1-(d-1)/6)); cylinder(ring(t0),ring(t1),0.07,MAT.dipole,fade) }
  }
  function beamPipe(near){ // the beam pipe follows the ring; far end behind the detector, near end in front
    const e=ease(explode), z0=0.98+1.05*e, t0=Math.asin(Math.min(1,z0/RING)), a=P(...ring(t0)), b=P(...ring(-t0)), farPos=a[2]>b[2];
    const seg=sgn=>{ for(let i=0;i<10;i++){ const u0=t0+i*0.08, u1=u0+0.085; cylinder(ring(sgn*u0),ring(sgn*u1),0.03,MAT.pipe,.9) } };
    if(near) seg(farPos?-1:1); else seg(farPos?1:-1);
    if(!near&&e>0.05){ cx.globalAlpha=e; cylinder([0,0,-z0],[0,0,z0],0.025,MAT.pipe,.55); cx.globalAlpha=1 } }
  function drawStatic(){
    const key=[W,H,dark(),explode.toFixed(3)].join(); if(key===statKey) return; statKey=key;
    stat.width=W; stat.height=H; const real=cx; cx=stat.getContext("2d"); cx.clearRect(0,0,W,H);
    if(plate){ const n=plate.m.frames-1, f=explode*n, i=Math.floor(f), j=Math.min(n,i+1), a=plate.need(i), b=plate.need(j), k=Math.min(W/plate.m.width,H/plate.m.height);
      const dw=plate.m.width*k, dh=plate.m.height*k, ox=(W-dw)/2, oy=(H-dh)/2, ready=im=>im&&im.complete&&im.naturalWidth;
      if(ready(a)){ cx.globalAlpha=1; cx.drawImage(a,ox,oy,dw,dh) } if(j!==i&&ready(b)){ cx.globalAlpha=f-i; cx.drawImage(b,ox,oy,dw,dh); cx.globalAlpha=1 }
      if(!ready(a)) statKey="";   // try again once the frame has loaded
    } else { drawRing(); beamPipe(false); paint(detector()); beamPipe(true) }
    cx=real }
  // ---- packets and collisions
  function rateSpeed(){ const r=tel.cur[tel.phase]||0; return 0.5+1.2*Math.min(1,Math.log10(1+bpsToMbps(r))/3) }
  function where(p,now){ // returns a world point, or null
    const tm=now-p.t0; if(tm<0) return null;
    if(p.dir==="ping"){ const k=tm/p.dur; if(k>=1) return null; const u=k<.5?k*2:(1-k)*2; return ring(p.side*0.9*u) }
    const d=p.dur; if(tm>=d) return null; const k=tm/d;
    return p.dir==="down"? ring(p.side*0.9*(1-k)) : ring(p.side*0.9*k) }
  function spawn(dir,n){ const now=performance.now();
    for(let i=0;i<n&&parts.length<MAXP;i++){ const dur=1100/rateSpeed();
      if(dir==="down"){ parts.push({dir,side:1,t0:now+i*140,dur,pair:true}); parts.push({dir,side:-1,t0:now+i*140,dur}) }
      else parts.push({dir,side:(i%2?1:-1),t0:now+i*140,dur}) } }
  function ping(ms){ if(!fin(ms)||parts.length>=MAXP) return; parts.push({dir:"ping",side:Math.random()<.5?1:-1,t0:performance.now(),dur:Math.min(3500,Math.max(700,ms*SLOWC)),ms}) }
  function feed(){
    const d=tel.phase; if(!tel.on||(d!=="down"&&d!=="up")){ seen.dir=""; return }
    const b=tel.bytes[d]||0; if(seen.dir!==d){ seen={dir:d,b,acc:0}; return }
    seen.acc+=Math.max(0,b-seen.b); seen.b=b; const rate=tel.cur[d]||0;
    per=[64e3,256e3,1e6,4e6,16e6,64e6,256e6].find(v=>rate/v<=8)||256e6;
    const n=Math.min(4,Math.floor(seen.acc/per)); seen.acc-=n*per; if(n) spawn(d,n) }
  function collide(now){ // tracks curl in the solenoid field (perpendicular to the beam), stop in the calorimeters
    const c=tok("--down"); for(let i=0;i<14&&tracks.length<MAXT;i++){ const a=Math.random()*Math.PI*2, charge=Math.random()<.5?-1:1;
      const pt=0.6+Math.random()*2.4, reach=Math.random()<.7?0.36:0.52;  // electrons stop in ECAL, hadrons in HCAL
      const th=0.45+Math.random()*(Math.PI-0.9); /* polar angle: real jets spray along the beam too, not only across it */
      tracks.push({a,k:charge/pt*1.6,reach,cot:Math.cos(th)/Math.sin(th),c:Math.random()<.25?"#ffffff":c,t0:now,life:650+Math.random()*450,z:0}) }
    flashes.push({p:[0,0,0],t0:now,c:"#ffffff",r:10}) }
  function drawTracks(now){
    tracks=tracks.filter(t=>{ const k=(now-t.t0)/t.life; if(k>=1) return false; const grow=Math.min(1,k*2.2), steps=14;
      cx.strokeStyle=t.c; cx.globalAlpha=(1-k)*.95; cx.lineWidth=1.4*dpr; cx.beginPath();
      let x=0,y=0,z=0,a=t.a, first=true; const ds=t.reach*grow/steps;
      for(let i=0;i<=steps;i++){ const q=P(x,y,z); first?cx.moveTo(q[0],q[1]):cx.lineTo(q[0],q[1]); first=false; a+=t.k*ds*3; x+=Math.cos(a)*ds; y+=Math.sin(a)*ds; z=Math.max(-0.9,Math.min(0.9,z+ds*t.cot)) }
      cx.stroke(); cx.globalAlpha=1;
      if(grow>=1&&!t.hit){ t.hit=true; hits.push({p:[x,y,z],t0:now,c:t.reach<0.4?"#7fe9f2":"#ffb560"}) }
      return true });
    hits=hits.filter(h=>{ const k=(now-h.t0)/500; if(k>=1) return false; const q=P(...h.p); glow(q[0],q[1],(5+k*6)*dpr,h.c,(1-k)*(dark()?.9:.6)); return true });
  }
  function glow(x,y,r,c,a){ const g=cx.createRadialGradient(x,y,0,x,y,r); const hex=c.length===7?c:"#ffffff"; g.addColorStop(0,hex); g.addColorStop(1,hex+"00"); cx.globalAlpha=a; cx.fillStyle=g; cx.beginPath(); cx.arc(x,y,r,0,Math.PI*2); cx.fill(); cx.globalAlpha=1 }
  function drawParts(now){
    parts=parts.filter(p=>{
      const done=(now-p.t0)>=p.dur;
      if(done){ if(p.dir==="ping"){ flashes.push({p:[0,0,0],t0:now,c:tok("--good"),txt:p.ms.toFixed(0)+" ms",r:14}) }
        else if(p.dir==="down"&&p.pair) collide(now); else if(p.dir==="up") flashes.push({p:ring(p.side*0.9),t0:now,c:tok("--up"),r:12}); return false }
      const w=where(p,now); if(!w) return true;
      const c=tok(p.dir==="ping"?"--good":p.dir==="down"?"--down":"--up"), q=P(...w);
      let prev=q; for(let i=1;i<=8;i++){ const tw=where(p,now-i*18); if(!tw) break; const r=P(...tw);
        cx.strokeStyle=c; cx.globalAlpha=(1-i/9)*.85; cx.lineWidth=(3.4-i*.35)*dpr; cx.lineCap="round"; cx.beginPath(); cx.moveTo(prev[0],prev[1]); cx.lineTo(r[0],r[1]); cx.stroke(); prev=r }
      cx.globalAlpha=1; glow(q[0],q[1],(dark()?13:9)*dpr,c,dark()?.95:.6); cx.fillStyle="#fff"; cx.beginPath(); cx.arc(q[0],q[1],2.2*dpr,0,Math.PI*2); cx.fill();
      return true });
    flashes=flashes.filter(f=>{ const k=(now-f.t0)/650; if(k>=1) return false; const q=P(...f.p); glow(q[0],q[1],(f.r+k*12)*dpr,f.c,(1-k)*(dark()?1:.6));
      if(f.txt){ cx.fillStyle=f.c; cx.globalAlpha=1-k; cx.font=`600 ${12*dpr}px ${tok("--mono")}`; cx.textAlign="center"; cx.fillText(f.txt,q[0],q[1]-(22+k*16)*dpr); cx.globalAlpha=1 } return true });
  }
  function labels(){
    if(explode<=0.02||!result) return; const e=ease(explode);
    const rows=[[-0.87,`Ping ${fin(result.ping)?result.ping.toFixed(1):"—"} ms${fin(result.jitter)?` · jitter ${result.jitter.toFixed(1)} ms`:""}`,"--good"],
                [0,`Download ${fmt(result.down)} ${unitLabel()}`,"--down"],[0.87,`Upload ${fin(result.up)?fmt(result.up):"—"} ${unitLabel()}`,"--up"]];
    cx.font=`600 ${(W/dpr<640?12:14)*dpr}px ${tok("--body")}`; cx.textBaseline="middle"; cx.textAlign="center";
    if(W/dpr<640) rows[0][1]=rows[0][1].replace(/ · jitter.*$/,"");
    /* place left to right; a label that would touch the one before drops to the next row */
    const boxes=rows.map(([z,txt,c])=>{ const top=P(0,1.02,z+zShift(z)), tw=cx.measureText(txt).width;
      return {top,txt,c,tw,x:Math.min(W-tw/2-10*dpr,Math.max(tw/2+10*dpr,top[0])),y:Math.max(18*dpr,top[1]-26*dpr)} }).sort((a,b)=>a.x-b.x);
    const placed=[];
    for(const b of boxes){ while(placed.some(o=>Math.abs(o.y-b.y)<30*dpr&&Math.abs(o.x-b.x)<(o.tw+b.tw)/2+22*dpr)) b.y+=30*dpr; placed.push(b) }
    for(const {top,txt,c,tw,x,y} of placed){
      cx.globalAlpha=e; cx.fillStyle=dark()?"rgba(10,14,16,.72)":"rgba(255,255,255,.82)"; cx.beginPath(); cx.roundRect?cx.roundRect(x-tw/2-8*dpr,y-13*dpr,tw+16*dpr,26*dpr,8*dpr):cx.rect(x-tw/2-8*dpr,y-13*dpr,tw+16*dpr,26*dpr); cx.fill();
      cx.strokeStyle=tok(c); cx.lineWidth=1.4*dpr; cx.stroke(); cx.beginPath(); cx.moveTo(x,top[1]<y?y-13*dpr:y+13*dpr); cx.lineTo(top[0],top[1]); cx.stroke();
      cx.fillStyle=tok("--ink"); cx.fillText(txt,x,y); cx.globalAlpha=1 }
  }
  function hint(){ if(tel.on||result) return; cx.fillStyle=tok("--muted"); cx.font=`500 ${13*dpr}px ${tok("--body")}`; cx.textAlign="center"; cx.fillText("Run a test to collide real packets in the detector",W/2,H*0.95) }
  function frame(now){
    raf=0; if(tel.on&&now-lastDraw<32){ raf=requestAnimationFrame(frame); return } lastDraw=now;
    const t0=performance.now(); size(); cx.clearRect(0,0,W,H);
    const animating=$("colAnim").checked&&!reduce.matches;
    if(tel.on&&animating) feed(); last=now;
    if(explodeT0){ explode=Math.min(1,(now-explodeT0)/1600); if(explode>=1) explodeT0=0 }
    drawStatic(); cx.drawImage(stat,0,0); if(animating){ drawParts(now); drawTracks(now) } labels(); hint();
    frameCost=frameCost*.9+(performance.now()-t0)*.1;
    if(vis&&animating&&(tel.on||parts.length||tracks.length||flashes.length||hits.length||explodeT0)) raf=requestAnimationFrame(frame);
    $("colKey").textContent=tel.on&&per&&(tel.phase==="down"||tel.phase==="up")
      ?(tel.phase==="down"?`Each collision is ${per>=1e6?per/1e6+" MB":per/1e3+" KB"} of data actually received. Bunches travel faster as the speed rises.`:`Each amber bunch is ${per>=1e6?per/1e6+" MB":per/1e3+" KB"} of data actually sent.`)
      :tel.on&&tel.phase==="ping"?"Green probes run along the beam pipe and back over each measured round trip, shown 20× slower."
      :result?"Teardown of the last test: the detector opened up, one part per result.":"";
  }
  function kick(){ if(!raf) raf=requestAnimationFrame(frame) }
  function start(){ parts=[]; tracks=[]; hits=[]; flashes=[]; seen.dir=""; explode=0; explodeT0=0; result=null; plateAll(); kick() }
  function end(res){ if(res&&fin(res.down)){ result=res; explodeT0=($("colAnim").checked&&!reduce.matches)?performance.now():0; if(!explodeT0) explode=1 } kick();
    $("collider").setAttribute("aria-label",res&&fin(res.down)?`Packet collider teardown: ping ${fin(res.ping)?res.ping.toFixed(1):"unknown"} ms, download ${fmt(res.down)} ${unitLabel()}, upload ${fin(res.up)?fmt(res.up):"not measured"} ${unitLabel()}`:"Packet collider") }
  try{ const h=store.get("history",[]); if(h&&h[0]&&fin(h[0].down)){ result=h[0]; explode=1 } }catch{}
  loadPlates();
  if("IntersectionObserver" in window) new IntersectionObserver(e=>{ vis=e[0].isIntersecting; if(vis) kick() }).observe(cv); else vis=true;
  if("ResizeObserver" in window) new ResizeObserver(()=>kick()).observe(cv);
  $("colAnim").checked=!reduce.matches; $("colAnim").onchange=()=>{ if(!$("colAnim").checked){ parts=[]; tracks=[]; hits=[]; flashes=[] } kick() };
  onScheme(kick);
  return {start,end,ping,kick,get cost(){return frameCost}};
})();


/* ---- Help assistant: knowledge stack + on-device retrieval (no network, nothing stored) ---- */
const HELP=(()=>{
  /* Each entry: id, title, keywords (synonyms people actually type), answer paragraphs / steps, source in the docs, actions */
  const KB=[
  {id:"start",t:"Run a speed test",k:"start run begin test go button first how use measure check speed",
   a:["Tap Go. CleanSpeed measures idle ping and jitter, then download, then upload, with loaded ping (latency while the line is busy) running alongside. The result is saved on this device. Tap Stop at any time, or Retest after a run."],src:"What it does",go:[["Go to the test","tool:speed"]]},
  {id:"units",t:"MB/s or Mbps? Which unit is right",k:"unit units mbps mb/s megabit megabyte bits bytes kbps gbps convert difference plan advertised",
   a:["Plans are sold in bits (Mbps, Gbps); file downloads show bytes (MB/s). 1 byte = 8 bits, so 1 MB/s = 8 Mbps and 1 GB/s = 8 Gbps. A 450 Mbps plan peaks near 56 MB/s.","Pick the unit under Settings. Decimal (1000) matches what ISPs advertise; binary (1024) shows MiB/s."],src:"Settings and units",go:[["Open Settings","sec:Settings"]]},
  {id:"slowup",t:"Upload is slow",k:"upload slow low up speed slower uploading backup video call send cloud asymmetric",
   a:["Many cable, DSL and mobile plans give far less upload than download, so a low upload alone can be normal. Compare it with the upload figure on your plan.","If it is well below that, test on a cable, then try another server. Run Diagnose my last test below for a check against your last result."],src:"Troubleshooting",go:[["Open Settings","sec:Settings"]]},
  {id:"slowdown",t:"My internet feels slow",k:"internet slow speed low bad poor sluggish buffering buffer streaming not working fast result what to do improve fix",
   a:["Work from the cheapest check outward: 1) test next to the router, 2) test on a cable, 3) try another server, 4) turn off any VPN or Private Relay, 5) restart the router and the ISP box. If a cable is fast and Wi-Fi is slow, the wireless link is the problem. If both are slow, contact your ISP with the History export as evidence.","Diagnose my last test below checks your result for the common causes."],src:"Troubleshooting",go:[["Open History","sec:History"]]},
  {id:"stuck100",t:"Speed stuck near 11-12 MB/s (about 93 Mbps)",k:"stuck capped 100 mbps 12 mb/s 11 93 slow fast ethernet cable port gigabit limit stuck plan faster",
   a:["That ceiling is the signature of a link that negotiated 100 Mbps instead of 1 Gbps. Usual causes are a loose or damaged cable, a 4-wire cable, or an old switch or port.","Reseat or replace the cable between the ISP box and the router (Cat5e or better), then check the router's WAN link speed."],src:"Troubleshooting",go:[]},
  {id:"wifislow",t:"Results far below my plan on Wi-Fi",k:"wifi wi-fi wireless slow below plan weak signal 2.4 5ghz distance interference router far",
   a:["Distance, the 2.4 GHz band and interference cost the most. Test next to the router on 5 GHz, then compare with a cable. If the cable is fast and Wi-Fi is slow, the problem is the wireless link, not your ISP."],src:"Troubleshooting",go:[]},
  {id:"pinghigh",t:"Ping is higher than usual, or lower than physically possible",k:"ping high latency vpn private relay icloud lag proxy lower impossible map minimum",
   a:["iCloud Private Relay or a VPN can route traffic elsewhere, which raises ping or makes it look too good for the map's physical minimum.","Turn Private Relay off for this network (Settings, Wi-Fi, the i next to the network) or disconnect the VPN, then retest."],src:"Troubleshooting",go:[["Check VPN / relay in My IP","tool:ip"]]},
  {id:"loaded",t:"Loaded ping and the A+ to F grade",k:"loaded ping bufferbloat grade responsiveness latency under load video call lag gaming grade a f",
   a:["Loaded ping is your latency while the line is busy. A big jump (bufferbloat) is what makes calls and games stutter while someone downloads, even when speed is fine. The grade comes from it.","The usual fix is Smart Queue Management (SQM, fq_codel or CAKE) or a bandwidth limit set to about 90% of your plan in the router's QoS settings."],src:"How the measurement works",go:[]},
  {id:"jitter",t:"What is jitter",k:"jitter variation ping stable consistency",a:["Jitter is how much your ping varies from one request to the next. Low and steady is better for calls and games; above about 30 ms is noticeable."],src:"How the measurement works",go:[]},
  {id:"method",t:"How the speed is measured",k:"how measured method accurate accuracy streams parallel ramp tcp average algorithm calculate precise trust",
   a:["Download uses several parallel HTTP streams (6 by default) and counts bytes as they arrive. Upload sends parallel POSTs sized to take about 0.6 s each. The final figure is the average after discarding the first 25% of the phase, while TCP is still ramping up.","Loaded ping is probed on a separate host (1.1.1.1) so the probe is not queued behind the test's own traffic."],src:"How the measurement works",go:[]},
  {id:"uploadfail",t:"Upload could not be measured",k:"upload failed error not measured missing couldn't confirm timeout no upload",
   a:["The server did not confirm uploads in time. Download and ping are still saved. Change server and retest."],src:"Troubleshooting",go:[["Open Settings","sec:Settings"]]},
  {id:"servers",t:"Choosing a test server",k:"server servers choose change select automatic cloudflare librespeed m-lab mlab ndt7 nearest closest region country",
   a:["Automatic picks the lowest ping. You can also choose Cloudflare (anycast), Measurement Lab (ndt7), any of 22 LibreSpeed volunteer servers, or your own server. Use Change server under Go; Measure ping to all compares them."],src:"What it does",go:[["Go to the test","tool:speed"]]},
  {id:"mlab",t:"Measurement Lab and my IP address",k:"m-lab mlab measurement lab publish public ip data open consent privacy ndt7",
   a:["M-Lab publishes every test as open data, including your IP address, date and time. CleanSpeed asks you to confirm that before running an M-Lab test."],src:"Privacy",go:[]},
  {id:"ownserver",t:"Run my own test server",k:"own server self host selfhost python lan local test home network https caddy nginx",
   a:["Run `python3 server/server.py --port 8080` (Python 3.9+, no logging) and open http://<server-ip>:8080/ to test your LAN or Wi-Fi without the internet in the way.","To use it from the hosted copy, via Change server, Your own server, it must be served over https, for example behind Caddy or nginx, because browsers block http requests from https pages."],src:"Self-host a test server",go:[]},
  {id:"privacy",t:"What leaves my device",k:"privacy data tracking track analytics cookies ads secure safe private collect send log store account sign up",
   a:["No accounts, ads, analytics, cookies or third-party scripts. Results, history, settings and location stay in this browser. The app contacts a service only when you use the feature that needs it, for example the test server you picked, 1.1.1.1 for loaded ping, NVD for the router check (brand and model only), or ipinfo and ipify for My IP & ISP.","Device lookup, the Wi-Fi password tool, the calculators and this help assistant send nothing."],src:"Privacy",go:[]},
  {id:"router",t:"Router security check",k:"router security check score vulnerabilities cve nvd firmware model brand scan safe settings admin wps upnp",
   a:["It scores your router settings from your answers, looks up known vulnerabilities for your model and firmware in the U.S. National Vulnerability Database, and gives step-by-step fixes, manufacturer-approved fixes only (no beta or third-party firmware).","Only the brand and model are sent to NVD, never your answers or firmware version. A browser cannot log in to your router, so the check relies on what you tell it."],src:"Router security",go:[["Open the router check","tool:router"]]},
  {id:"cantconfirm",t:"Router check says 'can't confirm'",k:"cant confirm can't confirm unknown affected unsure cve record version missing not sure router",
   a:["The public record for that issue lacks version data, so it cannot be matched to your firmware. Check the maker's own security advisory for your model."],src:"Limitations",go:[["Open the router check","tool:router"]]},
  {id:"lookupfail",t:"Router lookup failed",k:"lookup failed nvd rate limit unreachable error router vulnerabilities not loading",
   a:["NVD was unreachable or rate-limited. Wait a minute and retry. The settings score still works without it."],src:"Troubleshooting",go:[["Open the router check","tool:router"]]},
  {id:"collider",t:"The packet collider view",k:"collider 3d animation hadron lhc cms detector packets photon teardown blender particles bunches",
   a:["It draws the test as a particle collider modelled on CERN's CMS detector. A collision happens for each chunk of data really received, amber bunches leave for each chunk sent, and green probes run out and back for each ping. When the test ends the detector opens up with ping, download and upload on its parts.","The detector is rendered in Blender, with live data drawn on top through the same camera."],src:"Packet collider",go:[["Show the collider","sec:Packet collider"]]},
  {id:"animoff",t:"Turn animations off",k:"animation animate off stop disable motion reduce reduced battery performance cpu slow laggy stutter collider map",
   a:["Untick Animate on the collider and the map. If your system has Reduce motion turned on, animations start switched off and every state is still shown."],src:"Design system",go:[["Show the collider","sec:Packet collider"]]},
  {id:"map",t:"The live map",k:"map live route dots stylised position location where server cloudflare colo data centre telemetry timeline",
   a:["The map is stylised, not geographic. Each moving dot is real data counted as it arrives or leaves, slowed so the eye can follow. Your position comes from your time zone unless you allow precise location or run My IP & ISP, and it stays on this device. If a content blocker stops Cloudflare's reply, the map falls back to pulses around you."],src:"Live map",go:[["Show the map","sec:Live network map"]]},
  {id:"history",t:"History and CSV export",k:"history export csv save past results trend delete clear spreadsheet excel download label",
   a:["Every test is saved on this device with a trend chart. You can filter by network, edit a test's network label and export CSV. If Excel shows odd characters, import the file as UTF-8."],src:"History",go:[["Open History","sec:History"]]},
  {id:"nettype",t:"Network type is wrong",k:"network type wifi mobile ethernet wrong label cellular detect",
   a:["iPhone browsers do not expose the connection type. Pick Wi-Fi, Mobile or Ethernet under Go, and change past tests in History."],src:"Troubleshooting",go:[["Open History","sec:History"]]},
  {id:"install",t:"Install it like an app",k:"install app home screen add pwa iphone android desktop offline icon shortcut",
   a:["iPhone or iPad (Safari): Share, then Add to Home Screen. Android (Chrome): the menu, then Add to Home screen or Install app. Desktop Chrome or Edge: the install icon in the address bar."],src:"Install, use and self-host",go:[]},
  {id:"dns",t:"DNS benchmark",k:"dns benchmark fastest resolver cloudflare google quad9 adguard opendns change dns faster browsing",
   a:["It times Cloudflare, Google, Quad9, AdGuard and OpenDNS from your connection and recommends the fastest. To apply it everywhere, set it on the router (Internet or DHCP settings, DNS, Manual). Devices switch when they reconnect."],src:"Toolkit",go:[["Open DNS benchmark","tool:dns"]]},
  {id:"myip",t:"My IP & ISP, IPv6, VPN and relay check",k:"ip address isp ipv6 vpn relay private whats my ip provider asn location",
   a:["It shows your public IP, ISP and whether IPv6, a VPN or iCloud Private Relay is in play. ipinfo.io and ipify.org see your IP, like any website you visit."],src:"Toolkit",go:[["Open My IP & ISP","tool:ip"]]},
  {id:"mac",t:"Device lookup says 'Unknown maker'",k:"mac address device lookup unknown maker vendor oui private randomised randomized who made",
   a:["The address is probably private (randomised), or not in the IEEE registry. Check the device's Wi-Fi settings for Private address. Lookup uses the bundled oui.txt, so nothing is sent."],src:"Toolkit",go:[["Open Device lookup","tool:mac"]]},
  {id:"password",t:"Wi-Fi password tool",k:"wifi password generate strong strength test passphrase random secure",
   a:["It generates a strong random password and tests the strength of one you type. Everything is computed on this device and nothing is sent."],src:"Toolkit",go:[["Open Wi-Fi password","tool:pw"]]},
  {id:"subnet",t:"Subnet calculator and CGNAT",k:"subnet calculator cidr mask range cgnat ip ranges network prefix",
   a:["It shows the range, mask, usable hosts and flags CGNAT (100.64.0.0/10) ranges, which mean your ISP shares one public address between customers."],src:"Toolkit",go:[["Open Subnet calculator","tool:subnet"]]},
  {id:"calc",t:"Data and time calculator",k:"calculator data download time how long gb file size usage estimate monthly cap",
   a:["Enter a speed and a file size to get the download time, or the reverse. A test moves about your speed multiplied by the seconds in each phase, in each direction, so at 35 MB/s with 10-second phases expect roughly 350 MB down plus the upload."],src:"Toolkit",go:[["Open Data calculator","tool:calc"]]},
  {id:"pingmon",t:"Ping and outage monitor",k:"ping monitor outage drops packet loss uptime intermittent disconnect cuts latency over time",
   a:["It sends tiny requests to 1.1.1.1, google.com or your test server and records latency, loss and outages with start and end times. Useful evidence for an ISP when the connection drops."],src:"Toolkit",go:[["Open Ping monitor","tool:ping"]]},
  {id:"compare",t:"Global comparison",k:"compare global country world median ookla rank average where do i stand percentile",
   a:["Your result is compared with national and global medians from the Ookla Speedtest Global Index, for broadband or mobile. The data is a third-party compilation with a publication lag."],src:"Global comparison",go:[["Open comparison","tool:compare"]]},
  {id:"mobiledata",t:"Using less mobile data",k:"mobile data cellular usage lots gb cap save reduce limit seconds streams",
   a:["Lower Seconds per phase and the number of Parallel streams in Settings. A test moves roughly your speed times the phase length in each direction."],src:"Troubleshooting",go:[["Open Settings","sec:Settings"]]},
  {id:"fast",t:"Very high speeds (several Gbps)",k:"gbps multi gigabit fast 2.5g 10g cpu browser limit cannot reach high speed 5 gbps",
   a:["Above a few Gbps, the browser and device CPU can be the limit rather than the line. Wire the test device with a 2.5G or 10G port, close other tabs and try more parallel streams."],src:"Limitations",go:[["Open Settings","sec:Settings"]]},
  {id:"limits",t:"What a browser can't do",k:"limitation traceroute port scan wifi channel signal strength router login native not possible cant can't missing feature",
   a:["No traceroute, port scan, Wi-Fi channel scan or signal strength, and no router login. The router check relies on your answers plus public vulnerability data, and the map is stylised."],src:"Limitations",go:[]},
  {id:"theme",t:"Dark and light theme, accessibility",k:"theme dark light mode accessibility accessible keyboard screen reader contrast wcag font size reduce motion",
   a:["The app follows your system theme. It targets WCAG 2.2 AA: 4.5:1 text contrast, visible focus, 44 px touch targets, a skip link, and no sideways scroll at 320 px. Reduce motion is respected."],src:"Accessibility",go:[]},
  {id:"free",t:"Is it free, ad-free and open source",k:"free cost price ads advertising open source license github who made sign up account",
   a:["Yes: free, no ads, no tracking, no sign-up, open source. The whole app is a single HTML file."],src:"What it does",go:[]},
  {id:"selfhost",t:"Host my own copy",k:"host fork github pages deploy copy clone publish netlify cloudflare pages nginx static",
   a:["Fork the repository, then Settings, Pages, Deploy from a branch, main / root. Replace index.html to update. Any static host works. Keep oui.txt beside index.html for offline device lookup, and assets/3d for the rendered 3D plates (optional: without them the app draws its own)."],src:"Host your own copy",go:[]}
  ];

  /* ---- retrieval: stemmed tokens, synonym expansion, IDF-weighted scoring over title / keywords / answer ---- */
  const STOP=new Set("a an the is are was were be to of in on at for and or my me i it its this that do does how what why when can you your with from as by not no about if".split(" "));
  const SYN={slow:["slower","laggy","low","poor","bad"],wifi:["wi-fi","wireless"],"wi-fi":["wifi","wireless"],lag:["ping","latency"],laggy:["ping","latency"],
    safe:["privacy","secure"],secure:["privacy","security"],spy:["privacy","tracking"],logging:["privacy","log"],crash:["error","failed"],broken:["error","failed"],
    hang:["error","failed"],update:["install","host"],pc:["desktop"],phone:["mobile","iphone","android"],isp:["provider"],"100mbps":["100","mbps"],cap:["capped","limit"],
    "download":["down"],"upload":["up"],bufferbloat:["loaded"],streaming:["grade","responsiveness"],gaming:["grade","ping","latency"],calls:["grade","jitter","ping"],zoom:["grade","jitter"],
    cost:["free","price"],delete:["clear","history"],export:["csv"],password:["wifi","password"]};
  const stem=w=>w.replace(/(ing|ed|es|s)$/,m=>w.length>4?"":m);
  const tok=t=>t.toLowerCase().replace(/[^a-z0-9/.\- ]+/g," ").split(/\s+/).filter(w=>w&&!STOP.has(w)).map(w=>w.replace(/^[.\-]+|[.\-]+$/g,"")).filter(Boolean);
  const expand=ws=>{ const out=[]; for(const w of ws){ out.push(stem(w)); for(const x of SYN[w]||[]) out.push(stem(x)) } return out };
  const docs=KB.map(e=>({e,t:new Set(expand(tok(e.t))),k:new Set(expand(tok(e.k))),a:new Set(expand(tok(e.a.join(" "))))}));
  const df=new Map(); for(const d of docs){ const u=new Set([...d.t,...d.k,...d.a]); for(const w of u) df.set(w,(df.get(w)||0)+1) }
  const idf=w=>Math.log(1+docs.length/(1+(df.get(w)||0)));
  function search(q){ const ws=[...new Set(expand(tok(q)))]; if(!ws.length) return [];
    return docs.map(d=>{ let sc=0,hit=0; for(const w of ws){ const wt=idf(w); let h=0; if(d.t.has(w)) h=Math.max(h,3); if(d.k.has(w)) h=Math.max(h,2.4); if(d.a.has(w)) h=Math.max(h,1); if(h){ sc+=wt*h; hit++ } }
      return {e:d.e,score:sc*(0.6+0.4*hit/ws.length),hit} }).filter(x=>x.hit).sort((a,b)=>b.score-a.score) }

  /* ---- diagnosis of the last saved test ---- */
  function diagnose(){
    let h=null; try{ h=store.get("history",[])[0] }catch{}
    if(!h||!fin(h.down)) return {title:"No test to diagnose yet",paras:["Run a test first, then ask again. I read your last saved result on this device."],steps:[],go:[["Go to the test","tool:speed"]]};
    const mb=v=>fin(v)?(v/1e6):null, down=mb(h.down), up=mb(h.up), P=fin(h.ping)?h.ping:null, J=fin(h.jitter)?h.jitter:null, L=fin(h.lping)?h.lping:null;
    const found=[]; const add=(t,why,fix)=>found.push({t,why,fix});
    if(down>=88&&down<=97) add("Download looks capped at about 100 Mbps","That is the signature of a link that negotiated Fast Ethernet instead of gigabit.","Reseat or replace the cable from the ISP box to the router (Cat5e or better) and check the router's WAN link speed.");
    if(L!=null&&P!=null&&L-P>100) add(`Latency jumps by ${Math.round(L-P)} ms under load`,"Your line fills up and queues (bufferbloat), which makes calls and games stutter while anything downloads.","Turn on SQM (fq_codel or CAKE) in the router, or limit bandwidth to about 90% of your plan in QoS.");
    else if(L!=null&&P!=null&&L-P>40) add(`Latency rises by ${Math.round(L-P)} ms under load`,"Mild queueing. Fine for browsing, noticeable on busy video calls.","SQM or a QoS bandwidth limit at about 90% of the plan would help.");
    if(P!=null&&P>100) add(`Ping is high (${P.toFixed(0)} ms)`,"A far test server, a VPN or iCloud Private Relay, or a congested Wi-Fi link.","Pick a nearer server, turn off the VPN or Private Relay, and retest next to the router.");
    if(J!=null&&J>30) add(`Jitter is high (${J.toFixed(0)} ms)`,"Unstable latency usually comes from Wi-Fi interference or a congested line.","Test on a cable; if jitter drops, the cause is Wi-Fi (try 5 GHz, move closer).");
    if(down!=null&&up!=null&&up>0&&up/down<0.04) add("Upload is very low compared with download","Normal on some cable and mobile plans, but it slows video calls, cloud backups and uploads.","Compare with your plan's upload figure; if it is far below, change server and retest, then contact your ISP.");
    if(up===0||(h.up!=null&&!fin(h.up))) add("Upload was not measured","The server did not confirm uploads in time.","Change server and retest.");
    const sum=`Last test: ${down.toFixed(0)} Mbps down${up!=null?`, ${up.toFixed(0)} Mbps up`:""}${P!=null?`, ${P.toFixed(0)} ms ping`:""}${L!=null?`, ${L.toFixed(0)} ms loaded`:""}.`;
    if(!found.length) return {title:"Nothing wrong stands out",paras:[sum,"No cap, queueing, high latency or lopsided upload showed up. If it is still below your plan, compare Wi-Fi with a cable and try another server."],steps:[],go:[["Open History","sec:History"]]};
    return {title:`${found.length} thing${found.length>1?"s":""} worth checking`,paras:[sum],steps:found.map(f=>`${f.t}. ${f.why} ${f.fix}`),go:[["Open History","sec:History"]]};
  }

  const SUGGEST=["Why is my speed stuck at about 12 MB/s?","What is loaded ping?","Does this app collect my data?","How does the router check work?","MB/s or Mbps?","How do I install it on my phone?"];
  return {KB,search,diagnose,SUGGEST};
})();
(function helpUI(){
  const log=$("hLog"), q=$("hQ"), sections={"Settings":"settings","History":"history","Packet collider":"collider","Live network map":"live","Global comparison":"insights"};
  function act(a){ const [kind,arg]=a.split(":"); if(kind==="tool") openTool(arg); else { ui.go(sections[arg]||"test") } }
  function btnRow(go,extra){ const row=document.createElement("div"); row.className="hrow";
    for(const [label,a] of go){ const b=document.createElement("button"); b.type="button"; b.className="ghost"; b.textContent=label; b.addEventListener("click",()=>act(a)); row.append(b) }
    for(const [label,fn] of extra||[]){ const b=document.createElement("button"); b.type="button"; b.className="ghost"; b.textContent=label; b.addEventListener("click",fn); row.append(b) }
    return row.children.length?row:null }
  function say(role,build){ const m=document.createElement("div"); m.className="hm "+role; build(m); log.append(m); log.scrollTop=role==='bot'?log.scrollTop+m.getBoundingClientRect().top-log.getBoundingClientRect().top-8:log.scrollHeight; return m }
  function para(m,t){ const p=document.createElement("p"); p.textContent=t; m.append(p) }
  function entry(e,related){ say("bot",m=>{ const h=document.createElement("h3"); h.textContent=e.t; m.append(h); e.a.forEach(t=>para(m,t));
      const s=document.createElement("p"); s.className="hsrc"; s.textContent="From the docs: "+e.src; m.append(s);
      const row=btnRow(e.go||[], related.map(r=>["Also: "+r.t,()=>ask(r.t,true)])); if(row) m.append(row) }) }
  function ask(text,silent){ text=text.trim(); if(!text) return; say("me",m=>{ m.textContent=text });
    const r=HELP.search(text);
    if(!r.length||r[0].score<2.2){ say("bot",m=>{ para(m,"That is not in my knowledge base, and I would rather say so than guess. Try different words, pick a topic below, or open an issue on the project's GitHub page."); const row=btnRow([],HELP.KB.filter(e=>["start","stuck100","privacy","router"].includes(e.id)).map(e=>[e.t,()=>ask(e.t,true)])); if(row) m.append(row) }); return }
    const rel=r.slice(1,3).filter(x=>x.score>r[0].score*0.55).map(x=>x.e); entry(r[0].e,rel) }
  function showDiag(){ say("me",m=>{ m.textContent="Diagnose my last test" }); const d=HELP.diagnose();
    say("bot",m=>{ const h=document.createElement("h3"); h.textContent=d.title; m.append(h); d.paras.forEach(t=>para(m,t));
      if(d.steps.length){ const ol=document.createElement("ol"); d.steps.forEach(t=>{ const li=document.createElement("li"); li.textContent=t; ol.append(li) }); m.append(ol) }
      const s=document.createElement("p"); s.className="hsrc"; s.textContent="Based on your last saved test, read on this device."; m.append(s); const row=btnRow(d.go); if(row) m.append(row) }) }
  function reset(){ log.textContent=""; say("bot",m=>{ para(m,"Hi. Ask me anything about CleanSpeed: how a test works, why a result looks off, what leaves your device, or how to use a tool. I answer from the app's own documentation."); }) }
  const chips=$("hChips"); HELP.SUGGEST.forEach(t=>{ const b=document.createElement("button"); b.type="button"; b.className="ghost"; b.textContent=t; b.style.cssText="font-size:13px;padding:6px 12px"; b.addEventListener("click",()=>ask(t,true)); chips.append(b) });
  $("hForm").addEventListener("submit",e=>{ e.preventDefault(); const v=q.value; q.value=""; ask(v) });
  $("hDiag").addEventListener("click",showDiag); $("hClear").addEventListener("click",()=>{ reset(); q.focus() });
  reset();
})();

syncUnits(); requestAnimationFrame(animate); refreshLibre();
}
