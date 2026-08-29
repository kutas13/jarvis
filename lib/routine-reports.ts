import {adminDb,ownerId} from './db';
import {sendPush} from './push';
import {googleFetch} from './google';

function trDayBounds(offsetDays=0){
  // Türkiye UTC+3 year-round. Build local-day bounds and convert to UTC.
  const now=new Date(Date.now()+3*3600_000);
  const y=now.getUTCFullYear(),m=now.getUTCMonth(),d=now.getUTCDate()+offsetDays;
  const startLocal=new Date(Date.UTC(y,m,d,0,0,0));
  const endLocal=new Date(Date.UTC(y,m,d+1,0,0,0));
  return {start:new Date(startLocal.getTime()-3*3600_000),end:new Date(endLocal.getTime()-3*3600_000)};
}
function fmtTime(v:any){const s=v?.dateTime||v?.date;if(!s)return '';try{return new Date(s).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Istanbul'})}catch{return ''}}
async function optionalGoogleEvents(start:Date,end:Date){
  try{const p=new URLSearchParams({timeMin:start.toISOString(),timeMax:end.toISOString(),maxResults:'10',singleEvents:'true',orderBy:'startTime'});const d=await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`);return (d.items||[]).map((e:any)=>({summary:e.summary||'Etkinlik',start:e.start}));}catch{return []}
}
async function optionalUnreadMail(){
  try{const list=await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is%3Aunread%20newer_than%3A2d&maxResults=5');return (list.messages||[]).length}catch{return 0}
}
async function saveReport(kind:'morning'|'evening',title:string,body:string,details:any={}){
  const db=adminDb(),uid=ownerId();
  const localDate=new Date(Date.now()+3*3600_000).toISOString().slice(0,10);
  const {data:exists}=await db.from('routine_reports').select('id').eq('user_id',uid).eq('kind',kind).eq('local_date',localDate).maybeSingle();
  if(exists)return {ok:true,skipped:'already',body};
  await db.from('routine_reports').insert({user_id:uid,kind,local_date:localDate,title,body,details});
  await db.from('action_logs').insert({user_id:uid,source:'routine',action:`${kind}_routine`,details:{local_date:localDate,...details},success:true,result:body});
  await sendPush(title,body.slice(0,220));
  return {ok:true,body};
}

export async function runMorningRoutine(){
  const db=adminDb(),uid=ownerId();
  const today=trDayBounds(0);
  const [{data:tasks},events,unread]=await Promise.all([
    db.from('tasks').select('title,due_at').eq('user_id',uid).eq('status','open').order('due_at',{ascending:true,nullsFirst:false}).limit(12),
    optionalGoogleEvents(today.start,today.end),optionalUnreadMail()
  ]);
  const overdue=(tasks||[]).filter((t:any)=>t.due_at&&new Date(t.due_at)<new Date());
  const todayTasks=(tasks||[]).filter((t:any)=>t.due_at&&new Date(t.due_at)>=today.start&&new Date(t.due_at)<today.end);
  const lines:string[]=['Günaydın.'];
  if(overdue.length)lines.push(`${overdue.length} gecikmiş görevin var.`);
  if(todayTasks.length)lines.push(`Bugün ${todayTasks.length} zamanlı görevin var: ${todayTasks.slice(0,3).map((t:any)=>t.title).join(', ')}.`);
  else lines.push(`Bugün zamanlı açık görev görünmüyor.`);
  if(events.length)lines.push(`Takvimde ${events.length} etkinlik var: ${events.slice(0,3).map((e:any)=>`${fmtTime(e.start)} ${e.summary}`).join(', ')}.`);
  if(unread)lines.push(`Son 2 günden ${unread} okunmamış Gmail iletisi görünüyor.`);
  return saveReport('morning','JARVIS Sabah Brifingi',lines.join(' '),{tasks:(tasks||[]).length,events:events.length,unread});
}

export async function runEveningRoutine(){
  const db=adminDb(),uid=ownerId();
  const today=trDayBounds(0),tomorrow=trDayBounds(1);
  const [{data:done},{data:open},events,unread,{data:logs}]=await Promise.all([
    db.from('tasks').select('title,updated_at').eq('user_id',uid).eq('status','done').gte('updated_at',today.start.toISOString()).lt('updated_at',today.end.toISOString()).limit(20),
    db.from('tasks').select('title,due_at').eq('user_id',uid).eq('status','open').order('due_at',{ascending:true,nullsFirst:false}).limit(12),
    optionalGoogleEvents(tomorrow.start,tomorrow.end),optionalUnreadMail(),
    db.from('action_logs').select('id').eq('user_id',uid).gte('created_at',today.start.toISOString()).lt('created_at',today.end.toISOString())
  ]);
  const lines:string[]=['Günün özeti.'];
  lines.push(`Bugün ${done?.length||0} görev tamamlandı; ${open?.length||0} açık görev kaldı.`);
  if(open?.length)lines.push(`Öncelikli kalanlar: ${open.slice(0,3).map((t:any)=>t.title).join(', ')}.`);
  if(events.length)lines.push(`Yarın takvimde ${events.length} etkinlik var: ${events.slice(0,3).map((e:any)=>`${fmtTime(e.start)} ${e.summary}`).join(', ')}.`);
  if(unread)lines.push(`${unread} okunmamış Gmail iletisi bekliyor.`);
  lines.push(`JARVIS bugün ${logs?.length||0} kayıtlı işlem yaptı.`);
  return saveReport('evening','JARVIS Akşam Özeti',lines.join(' '),{done:done?.length||0,open:open?.length||0,events:events.length,unread,actions:logs?.length||0});
}
