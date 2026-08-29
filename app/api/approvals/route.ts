import {NextRequest,NextResponse} from 'next/server';import {adminDb,ownerId} from '@/lib/db';import {requireBrowserKey} from '@/lib/security';import {googleFetch} from '@/lib/google';
export async function GET(req:NextRequest){if(!requireBrowserKey(req))return NextResponse.json({error:'Yetkisiz'},{status:401});const {data}=await adminDb().from('approvals').select('*').eq('user_id',ownerId()).eq('status','pending').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false});return NextResponse.json({approvals:data||[]});}
export async function POST(req:NextRequest){
 if(!requireBrowserKey(req))return NextResponse.json({error:'Yetkisiz'},{status:401});
 const b=await req.json();const db=adminDb(),uid=ownerId();
 const {data:pending,error:findErr}=await db.from('approvals').select('*').eq('id',b.id).eq('user_id',uid).eq('status','pending').maybeSingle();
 if(findErr||!pending)return NextResponse.json({error:findErr?.message||'Onay bulunamadı veya süresi doldu.'},{status:404});
 if(new Date(pending.expires_at).getTime()<Date.now()){await db.from('approvals').update({status:'expired',resolved_at:new Date().toISOString()}).eq('id',pending.id);return NextResponse.json({error:'Onayın süresi doldu.'},{status:410});}
 if(!b.approve){await db.from('approvals').update({status:'denied',resolved_at:new Date().toISOString()}).eq('id',pending.id);if(pending.token)await db.from('device_commands').update({status:'cancelled'}).eq('confirmation_token',pending.token).eq('status','waiting_confirmation');return NextResponse.json({approval:{...pending,status:'denied'}});}
 try{
   if(pending.action==='calendar:create_event'){
     const x:any=pending.details||{};
     const d=await googleFetch('https://www.googleapis.com/calendar/v3/calendars/primary/events',{method:'POST',body:JSON.stringify({summary:x.summary,description:x.description,start:{dateTime:x.start},end:{dateTime:x.end}})});
     await db.from('action_logs').insert({user_id:uid,source:'approval',action:'calendar:create_event',details:x,success:true,result:d?.htmlLink||d?.id||'created'});
   }else if(String(pending.action||'').startsWith('device:')&&pending.token){
     await db.from('device_commands').update({status:'queued'}).eq('confirmation_token',pending.token).eq('status','waiting_confirmation');
   }
   const {data,error}=await db.from('approvals').update({status:'approved',resolved_at:new Date().toISOString()}).eq('id',pending.id).select('*').single();
   return NextResponse.json(error?{error:error.message}:{approval:data},{status:error?500:200});
 }catch(e:any){await db.from('action_logs').insert({user_id:uid,source:'approval',action:pending.action,details:pending.details||{},success:false,result:e.message});return NextResponse.json({error:e.message||'Onaylı işlem çalıştırılamadı.'},{status:500})}
}
