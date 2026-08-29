import webpush from 'web-push';
import { adminDb, ownerId } from './db';

export async function sendPush(title:string, body:string){
  const pub=process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim(), priv=process.env.VAPID_PRIVATE_KEY?.trim(), subject=process.env.VAPID_SUBJECT?.trim();
  if(!pub||!priv||!subject) return {sent:0,skipped:true};
  webpush.setVapidDetails(subject,pub,priv);
  const db=adminDb(), uid=ownerId();
  const {data}=await db.from('push_subscriptions').select('*').eq('user_id',uid);
  let sent=0;
  for(const s of data||[]){
    try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body}));sent++;}
    catch(e:any){if([404,410].includes(e.statusCode)) await db.from('push_subscriptions').delete().eq('id',s.id);}
  }
  return {sent};
}
