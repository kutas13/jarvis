import {NextRequest,NextResponse} from 'next/server';import {adminDb,ownerId} from '@/lib/db';import {requireBrowserKey} from '@/lib/security';import {budgetStatus} from '@/lib/budget';
export async function GET(req:NextRequest){if(!requireBrowserKey(req))return NextResponse.json({error:'Yetkisiz'},{status:401});const db=adminDb(),uid=ownerId();const [tasks,devices,memories,usage,logs,integrations,reports,budget]=await Promise.all([
 db.from('tasks').select('*').eq('user_id',uid).eq('status','open').order('due_at',{ascending:true,nullsFirst:false}).limit(20),
 db.from('devices').select('id,name,last_seen_at,enabled,capabilities').eq('user_id',uid).order('last_seen_at',{ascending:false}),
 db.from('memories').select('id,kind,content,confidence,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(20),
 db.from('usage_logs').select('model,input_tokens,output_tokens,total_tokens,estimated_cost_usd,created_at').eq('user_id',uid).gte('created_at',new Date(Date.now()-30*864e5).toISOString()),
 db.from('action_logs').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(30),
 db.from('integrations').select('provider,enabled,updated_at').eq('user_id',uid),
 db.from('routine_reports').select('*').eq('user_id',uid).order('created_at',{ascending:false}).limit(10),
 budgetStatus()
]);
 const u=(usage.data||[]).reduce((a:any,x:any)=>({tokens:a.tokens+Number(x.total_tokens||0),cost:a.cost+Number(x.estimated_cost_usd||0)}),{tokens:0,cost:0});
 return NextResponse.json({tasks:tasks.data||[],devices:(devices.data||[]).map((d:any)=>({...d,online:d.last_seen_at&&Date.now()-new Date(d.last_seen_at).getTime()<15000})),memories:memories.data||[],usage30d:u,budget,logs:logs.data||[],integrations:integrations.data||[],reports:reports.data||[]});}
