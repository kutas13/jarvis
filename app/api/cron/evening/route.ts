import {NextRequest,NextResponse} from 'next/server';
import {runEveningRoutine} from '@/lib/routine-reports';
export const runtime='nodejs';
export async function GET(req:NextRequest){const auth=req.headers.get('authorization')||'';if(auth!==`Bearer ${process.env.CRON_SECRET||''}`)return NextResponse.json({error:'Yetkisiz'},{status:401});try{return NextResponse.json(await runEveningRoutine())}catch(e:any){return NextResponse.json({error:e.message},{status:500})}}
