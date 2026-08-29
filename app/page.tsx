'use client';
import {useEffect,useRef,useState} from 'react';

type Msg={role:'user'|'assistant';text:string};
type Tab='chat'|'tasks'|'files'|'routines'|'system';
type PendingShare={recipient:string;url:string;text:string}|null;

function b64ToUint8(s:string){const p='='.repeat((4-s.length%4)%4),b=(s+p).replace(/-/g,'+').replace(/_/g,'/'),r=atob(b);return Uint8Array.from([...r].map(c=>c.charCodeAt(0)));}
function locationIntent(text:string){
  const t=text.trim();
  if(!/konum/i.test(t)||!/(gönder|yolla|paylaş)/i.test(t))return null;
  const clean=(v:string)=>v.replace(/^jarvis[,:]?\s*/i,'').replace(/['’](?:e|a)$/i,'').trim();
  const before=t.match(/^(.*?)\s+(?:şu\s*anki|şuanki|şimdiki)\s+konum(?:umu|um|u)?\s+(?:gönder|yolla|paylaş)/i);
  if(before?.[1]){
    let v=clean(before[1]);
    if(!/[ '\-]/.test(v)&&/(?:ye|ya|e|a)$/i.test(v)&&v.length>3)v=v.replace(/(?:ye|ya|e|a)$/i,'');
    return v||'seçtiğin kişi';
  }
  const p1=t.match(/konum(?:umu|um|u)?\s+([^,.!?]+?)\s+(?:gönder|yolla|paylaş)/i);
  if(p1?.[1])return clean(p1[1]);
  const p2=t.match(/(?:jarvis[,:]?\s*)?([^,.!?]+?)(?:['’](?:e|a)|\s+(?:e|a))\s+(?:şu\s*anki\s+|şuanki\s+|şimdiki\s+)?konum(?:umu|um|u)?\s+(?:gönder|yolla|paylaş)/i);
  if(p2?.[1])return clean(p2[1]);
  return 'seçtiğin kişi';
}

export default function Home(){
 const [key,setKey]=useState(''),[ready,setReady]=useState(false),[tab,setTab]=useState<Tab>('chat');
 const [messages,setMessages]=useState<Msg[]>([{role:'assistant',text:'JARVIS çevrimiçi. Nasıl yardımcı olabilirim?'}]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[wake,setWake]=useState(false),[listening,setListening]=useState(false);
 const [dash,setDash]=useState<any>({}),[tasks,setTasks]=useState<any[]>([]),[files,setFiles]=useState<any[]>([]),[fileQ,setFileQ]=useState(''),[approvals,setApprovals]=useState<any[]>([]),[pendingShare,setPendingShare]=useState<PendingShare>(null);
 const recognition=useRef<any>(null),wakeRef=useRef(false),imageInput=useRef<HTMLInputElement>(null);wakeRef.current=wake;
 const api=async(url:string,opts:any={})=>{const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),'x-jarvis-key':key}});const d=await r.json().catch(()=>({}));if(r.status===401){sessionStorage.removeItem('jarvis_access_key');setReady(false)}if(!r.ok)throw new Error(d.error||`API ${r.status}`);return d};
 useEffect(()=>{const saved=sessionStorage.getItem('jarvis_access_key')||'';if(saved){setKey(saved);setReady(true)}},[]);
 useEffect(()=>{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
 useEffect(()=>{const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;if(!SR)return;const r=new SR();r.lang='tr-TR';r.interimResults=false;r.continuous=false;r.onresult=(e:any)=>{const t=e.results?.[0]?.[0]?.transcript||'';setListening(false);if(wakeRef.current){if(/hey jarvis|jarvis/i.test(t)){const cleaned=t.replace(/hey jarvis|jarvis/ig,'').trim();if(cleaned){setInput(cleaned);setTimeout(()=>sendText(cleaned),50)}}}else setInput(t)};r.onend=()=>{setListening(false);if(wakeRef.current)setTimeout(()=>{try{r.start();setListening(true)}catch{}},600)};recognition.current=r},[key]);
 useEffect(()=>{if(!ready)return;refresh();const t=setInterval(refresh,7000);return()=>clearInterval(t)},[ready,key]);
 async function refresh(){try{const [d,a,t]=await Promise.all([api('/api/dashboard'),api('/api/approvals'),api('/api/tasks')]);setDash(d);setApprovals(a.approvals||[]);setTasks(t.tasks||[])}catch{}}
 function login(){if(!key.trim())return;sessionStorage.setItem('jarvis_access_key',key.trim());setReady(true)}
 async function speak(text:string){
   const premium=process.env.NEXT_PUBLIC_PREMIUM_TTS==='true';
   if(!premium&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='tr-TR';speechSynthesis.speak(u);return}
   try{const r=await fetch('/api/voice/tts',{method:'POST',headers:{'content-type':'application/json','x-jarvis-key':key},body:JSON.stringify({text})});if(r.ok){const url=URL.createObjectURL(await r.blob());const a=new Audio(url);a.onended=()=>URL.revokeObjectURL(url);await a.play();return}}catch{}
   if('speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='tr-TR';speechSynthesis.speak(u)}
 }
 async function prepareLocationShare(recipient='seçtiğin kişi',original='Konumumu paylaş'){
   if(!navigator.geolocation){setMessages(m=>[...m,{role:'user',text:original},{role:'assistant',text:'Bu cihaz konum paylaşımını desteklemiyor.'}]);return}
   setMessages(m=>[...m,{role:'user',text:original}]);setBusy(true);
   navigator.geolocation.getCurrentPosition(async p=>{
     try{
       const lat=p.coords.latitude,lon=p.coords.longitude;
       await api('/api/location',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({latitude:lat,longitude:lon,accuracy:p.coords.accuracy,label:'current'})});
       const url=`https://maps.google.com/?q=${lat},${lon}`;
       const text=`Şu anki konumum: ${url}`;
       setPendingShare({recipient,url,text});
       setMessages(m=>[...m,{role:'assistant',text:`Konumunu hazırladım. ${recipient} ile paylaşmadan önce aşağıdaki ONAYLA VE PAYLAŞ düğmesine dokun.`}]);
     }catch(e:any){setMessages(m=>[...m,{role:'assistant',text:'Konum hazırlanamadı: '+e.message}])}finally{setBusy(false)}
   },e=>{setBusy(false);setMessages(m=>[...m,{role:'assistant',text:'Konum izni alınamadı: '+e.message}])},{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
 }
 async function approveLocationShare(){
   if(!pendingShare)return;
   const s=pendingShare;
   try{
     if(navigator.share){await navigator.share({title:`Konum - ${s.recipient}`,text:s.text,url:s.url});setMessages(m=>[...m,{role:'assistant',text:`Konum paylaşım ekranını açtım. ${s.recipient} kişisini seçip Gönder'e dokunabilirsin.`}]);}
     else{await navigator.clipboard.writeText(s.text);window.location.href='https://wa.me/?text='+encodeURIComponent(s.text);setMessages(m=>[...m,{role:'assistant',text:'Konum linkini kopyaladım ve WhatsApp paylaşımını açtım.'}]);}
   }catch(e:any){if(e?.name!=='AbortError')setMessages(m=>[...m,{role:'assistant',text:'Paylaşım açılamadı: '+e.message}])}
   finally{setPendingShare(null)}
 }
 async function sendText(text:string){
   if(!text.trim()||busy)return;
   const rec=locationIntent(text);setInput('');if(rec){await prepareLocationShare(rec,text);return}
   setMessages(m=>[...m,{role:'user',text}]);setBusy(true);
   try{const d=await api('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text})});setMessages(m=>[...m,{role:'assistant',text:d.reply}]);speak(d.reply);refresh()}catch(e:any){setMessages(m=>[...m,{role:'assistant',text:'Hata: '+e.message}])}finally{setBusy(false)}
 }
 function mic(){if(!recognition.current)return alert('Bu tarayıcı sürekli ses tanımayı desteklemiyor. iPhone klavye diktesini kullanabilir veya metin yazabilirsin.');try{setListening(true);recognition.current.start()}catch{}}
 function toggleWake(){const n=!wake;setWake(n);if(n){try{recognition.current?.start();setListening(true)}catch{alert('iOS/PWA arka planda sürekli mikrofon dinlemeye izin vermeyebilir. JARVIS açıkken kullanılabilir.')}}else{try{recognition.current?.stop()}catch{}}}
 async function enablePush(){try{if(!('Notification'in window)||!('serviceWorker'in navigator))throw new Error('Push desteklenmiyor');const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('Bildirim izni verilmedi');const reg=await navigator.serviceWorker.ready;const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY||'';if(!pub)throw new Error('VAPID public key env eksik');const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8(pub)});await api('/api/push/subscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(sub)});alert('JARVIS bildirimleri aktif.')}catch(e:any){alert(e.message)}}
 async function connectGoogle(){try{const d=await api('/api/integrations/google/start');location.href=d.url}catch(e:any){alert(e.message)}}
 async function searchFiles(){try{const d=await api('/api/files/search?q='+encodeURIComponent(fileQ));setFiles(d.files||[])}catch(e:any){alert(e.message)}}
 async function approve(id:string,approve:boolean){await api('/api/approvals',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id,approve})});refresh()}
 async function runRoutine(kind:'morning'|'evening'){try{const d=await api('/api/routines/run',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({kind})});alert(d.skipped==='already'?'Bugünkü rutin zaten oluşturuldu.':'Rutin oluşturuldu ve push gönderildi.');refresh()}catch(e:any){alert(e.message)}}
 async function analyzeImage(file:File){try{if(file.size>8_000_000)throw new Error('Görsel 8 MB altında olmalı');const reader=new FileReader();reader.onload=async()=>{try{const d=await api('/api/vision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image:String(reader.result),prompt:'Bu görseli benim için analiz et. Önemli detayları Türkçe anlat.'})});setMessages(m=>[...m,{role:'user',text:'[Görsel gönderdim]'},{role:'assistant',text:d.reply}]);setTab('chat');speak(d.reply)}catch(e:any){alert(e.message)}};reader.readAsDataURL(file)}catch(e:any){alert(e.message)}}
 async function addTask(){const title=prompt('Görev nedir?');if(!title)return;const due=prompt('Tarih/saat ISO veya boş bırak (örn. 2026-08-30T10:00:00+03:00)')||null;await api('/api/tasks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title,due_at:due,notify:true})});refresh()}
 if(!ready)return <main className="login"><div className="orb"><span/></div><h1>JARVIS</h1><p>PRIVATE INTELLIGENCE SYSTEM</p><input type="password" value={key} onChange={e=>setKey(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} placeholder="JARVIS_ACCESS_KEY"/><button onClick={login}>SİSTEME GİR</button></main>;
 const online=dash.devices?.[0]?.online,b=dash.budget||{};
 return <main className="app"><header><div className="brand"><div className={`orb small ${busy?'busy':''}`}><span/></div><div><h1>JARVIS</h1><small>ULTIMATE v4</small></div></div><div className={online?'online':'offline'}>● {online?'PC ONLINE':'PC OFFLINE'}</div></header>
 <nav>{(['chat','tasks','files','routines','system'] as Tab[]).map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x==='chat'?'JARVIS':x==='tasks'?'GÖREVLER':x==='files'?'DOSYALAR':x==='routines'?'RUTİNLER':'SİSTEM'}</button>)}</nav>
 {tab==='chat'&&<section className="panel chatPanel"><div className="quick"><button onClick={toggleWake}>{wake?'◉ HEY JARVIS AÇIK':'○ HEY JARVIS'}</button><button onClick={()=>prepareLocationShare('seçtiğin kişi','Konumumu paylaş')}>⌖ KONUMU PAYLAŞ</button><button onClick={()=>imageInput.current?.click()}>▣ GÖRSEL / KAMERA</button><input ref={imageInput} style={{display:'none'}} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)analyzeImage(f);e.currentTarget.value=''}}/></div>
 {pendingShare&&<div className="shareApproval"><div><b>KONUM PAYLAŞIM ONAYI</b><span>{pendingShare.recipient} • {pendingShare.url}</span></div><button onClick={approveLocationShare}>ONAYLA VE PAYLAŞ</button><button className="danger" onClick={()=>setPendingShare(null)}>İPTAL</button></div>}
 <div className="chat">{messages.map((m,i)=><div className={`msg ${m.role}`} key={i}><b>{m.role==='assistant'?'JARVIS':'SEN'}</b><span>{m.text}</span></div>)}{busy&&<div className="msg assistant"><b>JARVIS</b><span>Düşünüyor / işlem yapıyor…</span></div>}</div><div className="composer"><button className={listening?'mic hot':'mic'} onClick={mic}>◉</button><input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendText(input)} placeholder="JARVIS'e yaz veya konuş…"/><button onClick={()=>sendText(input)}>GÖNDER</button></div></section>}
 {tab==='tasks'&&<section className="panel"><div className="sectionHead"><div><h2>Görevler & Hatırlatmalar</h2><p>JARVIS'in planladığı ve senin eklediğin işler.</p></div><button onClick={addTask}>+ GÖREV</button></div><div className="cards">{tasks.map(t=><div className="card" key={t.id}><b>{t.title}</b><span>{t.due_at?new Date(t.due_at).toLocaleString('tr-TR'):'Tarih yok'}</span><em>{t.status}</em></div>)}{!tasks.length&&<p>Aktif görev yok.</p>}</div></section>}
 {tab==='files'&&<section className="panel"><h2>Bilgisayar Dosya Hafızası</h2><p>Agent yalnızca izin verilen klasörlerdeki adları ve sınırlı metin özetlerini indeksler.</p><div className="search"><input value={fileQ} onChange={e=>setFileQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&searchFiles()} placeholder="Dosya adı veya içerik ara…"/><button onClick={searchFiles}>ARA</button></div><div className="cards">{files.map((f,i)=><div className="card file" key={i}><b>{f.name}</b><span>{f.path}</span><small>{f.excerpt?.slice(0,240)}</small></div>)}</div></section>}
 {tab==='routines'&&<section className="panel"><div className="sectionHead"><div><h2>Sabah / Akşam Rutinleri</h2><p>Sabah 09:30, akşam 19:00 — Türkiye saati. Google bağlı değilse görev ve JARVIS verileriyle devam eder.</p></div></div><div className="actions"><button onClick={()=>runRoutine('morning')}>Sabah Brifingini Şimdi Test Et</button><button onClick={()=>runRoutine('evening')}>Akşam Özetini Şimdi Test Et</button><button onClick={enablePush}>iPhone Bildirimlerini Aç</button></div><div className="cards">{(dash.reports||[]).map((r:any)=><div className="report" key={r.id}><div><b>{r.title}</b><small>{new Date(r.created_at).toLocaleString('tr-TR')}</small></div><p>{r.body}</p></div>)}{!(dash.reports||[]).length&&<p>Henüz rutin raporu oluşmadı.</p>}</div></section>}
 {tab==='system'&&<section className="panel"><div className="grid"><div className="metric"><small>30 GÜN TOKEN</small><b>{Number(dash.usage30d?.tokens||0).toLocaleString('tr-TR')}</b></div><div className="metric"><small>30 GÜN API</small><b>${Number(dash.usage30d?.cost||0).toFixed(3)}</b></div><div className="metric"><small>BUGÜN / LİMİT</small><b>${Number(b.daily||0).toFixed(2)} / ${Number(b.dailyLimit||0).toFixed(2)}</b></div><div className="metric"><small>AY / LİMİT</small><b>${Number(b.monthly||0).toFixed(2)} / ${Number(b.monthlyLimit||0).toFixed(2)}</b></div></div><div className="actions"><button onClick={connectGoogle}>Google / Gmail / Takvim Bağla</button><button onClick={enablePush}>Telefon Bildirimlerini Aç</button></div><h3>Onay Bekleyen İşlemler</h3>{approvals.map(a=><div className="approval" key={a.id}><div><b>{a.action}</b><span>{JSON.stringify(a.details)}</span></div><button onClick={()=>approve(a.id,true)}>ONAYLA</button><button className="danger" onClick={()=>approve(a.id,false)}>REDDET</button></div>)}{!approvals.length&&<p>Onay bekleyen kritik işlem yok.</p>}<h3>Son Hafızalar</h3>{dash.memories?.slice(0,8).map((m:any)=><div className="memory" key={m.id}><b>{m.kind}</b><span>{m.content}</span></div>)}</section>}
 </main>
}
