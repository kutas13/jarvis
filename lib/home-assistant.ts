function allowedEntity(entityId:string){
  const rules=(process.env.HOME_ASSISTANT_ALLOWLIST||'').split(',').map((x:string)=>x.trim()).filter(Boolean);
  return rules.some((r:string)=>r.endsWith('.')?entityId.startsWith(r):entityId===r);
}
export async function homeAssistantCall(domain:string, service:string, entityId:string){
  const base=process.env.HOME_ASSISTANT_URL?.replace(/\/$/,'')||'', token=process.env.HOME_ASSISTANT_TOKEN||'';
  if(!base||!token) throw new Error('Home Assistant yapılandırılmamış.');
  if(!allowedEntity(entityId)) throw new Error('Bu Home Assistant entity izin listesinde değil.');
  if(!/^[a-z0-9_]+$/.test(domain)||!/^[a-z0-9_]+$/.test(service)) throw new Error('Geçersiz Home Assistant servisi.');
  const r=await fetch(`${base}/api/services/${domain}/${service}`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({entity_id:entityId})});
  const d=await r.json().catch(()=>({})); if(!r.ok) throw new Error(`Home Assistant ${r.status}`); return d;
}
