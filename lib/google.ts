import { adminDb, ownerId } from './db';

const TOKEN_URL='https://oauth2.googleapis.com/token';
export const GOOGLE_SCOPES=[
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events'
].join(' ');

export function googleAuthUrl(state:string){
  const p=new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',redirect_uri:process.env.GOOGLE_REDIRECT_URI||'',response_type:'code',scope:GOOGLE_SCOPES,access_type:'offline',prompt:'consent',state});
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeGoogleCode(code:string){
  const r=await fetch(TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',redirect_uri:process.env.GOOGLE_REDIRECT_URI||'',grant_type:'authorization_code'})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error_description||d.error||'Google OAuth başarısız.');
  return d;
}

export async function getGoogleAccessToken(){
  const db=adminDb(), uid=ownerId();
  const {data}=await db.from('integrations').select('*').eq('user_id',uid).eq('provider','google').maybeSingle();
  if(!data?.enabled) throw new Error('Google entegrasyonu bağlı değil.');
  if(data.access_token && data.expires_at && new Date(data.expires_at).getTime()>Date.now()+60_000) return data.access_token;
  if(!data.refresh_token) throw new Error('Google refresh token yok; entegrasyonu yeniden bağla.');
  const r=await fetch(TOKEN_URL,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.GOOGLE_CLIENT_ID||'',client_secret:process.env.GOOGLE_CLIENT_SECRET||'',refresh_token:data.refresh_token,grant_type:'refresh_token'})});
  const d=await r.json(); if(!r.ok) throw new Error(d.error_description||d.error||'Google token yenilenemedi.');
  const expiresAt=new Date(Date.now()+Number(d.expires_in||3600)*1000).toISOString();
  await db.from('integrations').update({access_token:d.access_token,expires_at:expiresAt,updated_at:new Date().toISOString()}).eq('id',data.id);
  return d.access_token;
}

export async function googleFetch(url:string, init:RequestInit={}){
  const token=await getGoogleAccessToken();
  const r=await fetch(url,{...init,headers:{...(init.headers||{}),authorization:`Bearer ${token}`,'content-type':'application/json'}});
  const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(d?.error?.message||`Google API ${r.status}`); return d;
}
