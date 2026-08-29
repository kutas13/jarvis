import {NextRequest,NextResponse} from 'next/server';
import {requireBrowserKey} from '@/lib/security';
import {runMorningRoutine,runEveningRoutine} from '@/lib/routine-reports';
export const runtime='nodejs';
export async function POST(req:NextRequest){
  if(!requireBrowserKey(req))return NextResponse.json({error:'Yetkisiz'},{status:401});
  const b=await req.json().catch(()=>({}));
  try{
    if(b.kind==='morning')return NextResponse.json(await runMorningRoutine());
    if(b.kind==='evening')return NextResponse.json(await runEveningRoutine());
    return NextResponse.json({error:'kind morning/evening olmalı'},{status:400});
  }catch(e:any){return NextResponse.json({error:e.message||'Rutin çalıştırılamadı'},{status:500})}
}
