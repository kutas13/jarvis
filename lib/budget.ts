import {adminDb,ownerId} from './db';

export async function budgetStatus(){
  const db=adminDb(),uid=ownerId();
  const trNow=new Date(Date.now()+3*3600_000);
  const y=trNow.getUTCFullYear(),m=trNow.getUTCMonth(),d=trNow.getUTCDate();
  const dayStart=new Date(Date.UTC(y,m,d,0,0,0)-3*3600_000);
  const monthStart=new Date(Date.UTC(y,m,1,0,0,0)-3*3600_000);
  const {data}=await db.from('usage_logs').select('estimated_cost_usd,created_at').eq('user_id',uid).gte('created_at',monthStart.toISOString());
  let daily=0,monthly=0;
  for(const x of data||[]){const c=Number(x.estimated_cost_usd||0);monthly+=c;if(new Date(x.created_at)>=dayStart)daily+=c;}
  const dailyLimit=Math.max(0,Number(process.env.JARVIS_DAILY_BUDGET_USD||0.5));
  const monthlyLimit=Math.max(0,Number(process.env.JARVIS_MONTHLY_BUDGET_USD||10));
  const dailyRatio=dailyLimit?daily/dailyLimit:0, monthlyRatio=monthlyLimit?monthly/monthlyLimit:0;
  return {daily,monthly,dailyLimit,monthlyLimit,ratio:Math.max(dailyRatio,monthlyRatio),hardBlocked:(dailyLimit>0&&daily>=dailyLimit)||(monthlyLimit>0&&monthly>=monthlyLimit)};
}
