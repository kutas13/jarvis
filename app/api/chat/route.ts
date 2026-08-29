import {NextRequest,NextResponse} from 'next/server';
import {adminDb,ownerId} from '@/lib/db';
import {openaiResponse,responseText} from '@/lib/openai';
import {requireBrowserKey,randomToken} from '@/lib/security';
import {chooseModel,estimateCost,modelConfig} from '@/lib/model-router';
import {budgetStatus} from '@/lib/budget';
import {googleFetch} from '@/lib/google';
import {homeAssistantCall} from '@/lib/home-assistant';

export const runtime='nodejs';

const tools:any[]=[
 {type:'web_search'},
 {type:'function',name:'remember',description:'Store a durable non-sensitive preference, habit, workflow, person/project fact explicitly learned from the owner.',strict:true,parameters:{type:'object',properties:{kind:{type:'string',enum:['preference','habit','workflow','fact','person','project']},content:{type:'string'},confidence:{type:'number',minimum:0,maximum:1}},required:['kind','content','confidence'],additionalProperties:false}},
 {type:'function',name:'queue_device_command',description:'Send a safe command to the owner Windows PC. Supported: open_app, open_url, open_folder, open_file, system_info, screenshot, index_files, clipboard_read.',strict:true,parameters:{type:'object',properties:{action:{type:'string',enum:['open_app','open_url','open_folder','open_file','system_info','screenshot','index_files','clipboard_read']},target:{type:'string'}},required:['action','target'],additionalProperties:false}},
 {type:'function',name:'analyze_screen',description:'Capture the Windows screen and analyze what is visible. Use when the owner asks what is on screen or where to click.',strict:true,parameters:{type:'object',properties:{question:{type:'string'}},required:['question'],additionalProperties:false}},
 {type:'function',name:'request_sensitive_device_command',description:'Request a user-approved desktop interaction such as clicking coordinates or typing text. It will NOT run until approved in the JARVIS dashboard.',strict:true,parameters:{type:'object',properties:{action:{type:'string',enum:['desktop_click','desktop_type']},target:{type:'string'},reason:{type:'string'}},required:['action','target','reason'],additionalProperties:false}},
 {type:'function',name:'search_files',description:'Search indexed files on the owner PC by filename or extracted text.',strict:true,parameters:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
 {type:'function',name:'create_task',description:'Create a reminder/task. due_at must be ISO timestamp when known.',strict:true,parameters:{type:'object',properties:{title:{type:'string'},notes:{type:'string'},due_at:{type:['string','null']},recurrence:{type:['string','null']},notify:{type:'boolean'}},required:['title','notes','due_at','recurrence','notify'],additionalProperties:false}},
 {type:'function',name:'list_tasks',description:'List current open tasks and reminders.',strict:true,parameters:{type:'object',properties:{},additionalProperties:false}},
 {type:'function',name:'gmail_recent',description:'Read recent Gmail message metadata/snippets. Google must be connected.',strict:true,parameters:{type:'object',properties:{query:{type:'string'},max_results:{type:'integer',minimum:1,maximum:20}},required:['query','max_results'],additionalProperties:false}},
 {type:'function',name:'gmail_create_draft',description:'Create, but DO NOT send, a Gmail draft. This is safe and reversible.',strict:true,parameters:{type:'object',properties:{to:{type:'string'},subject:{type:'string'},body:{type:'string'}},required:['to','subject','body'],additionalProperties:false}},
 {type:'function',name:'calendar_events',description:'List Google Calendar events in a time range.',strict:true,parameters:{type:'object',properties:{time_min:{type:'string'},time_max:{type:'string'},max_results:{type:'integer',minimum:1,maximum:50}},required:['time_min','time_max','max_results'],additionalProperties:false}},
 {type:'function',name:'calendar_create_event',description:'Create a Google Calendar event. Only use when user clearly asks to add/schedule it.',strict:true,parameters:{type:'object',properties:{summary:{type:'string'},start:{type:'string'},end:{type:'string'},description:{type:'string'}},required:['summary','start','end','description'],additionalProperties:false}},
 {type:'function',name:'home_assistant_action',description:'Control an allowlisted Home Assistant entity. Requires explicit user instruction in the current message.',strict:true,parameters:{type:'object',properties:{domain:{type:'string'},service:{type:'string'},entity_id:{type:'string'}},required:['domain','service','entity_id'],additionalProperties:false}},
 {
  type: 'function',
  name: 'create_routine',
  description: 'Save a routine/workflow for later use. Do not execute it automatically without an explicit trigger configuration.',
  strict: true,
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      trigger_type: {
        type: 'string',
        enum: ['manual', 'time', 'location', 'event']
      },
      trigger_config: {
        type: 'object',
        properties: {
          time: { type: ['string', 'null'] },
          days: {
            type: 'array',
            items: { type: 'string' }
          },
          latitude: { type: ['number', 'null'] },
          longitude: { type: ['number', 'null'] },
          radius_meters: { type: ['number', 'null'] },
          event_name: { type: ['string', 'null'] }
        },
        required: [
          'time',
          'days',
          'latitude',
          'longitude',
          'radius_meters',
          'event_name'
        ],
        additionalProperties: false
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            target: { type: ['string', 'null'] },
            description: { type: ['string', 'null'] }
          },
          required: ['action', 'target', 'description'],
          additionalProperties: false
        }
      },
      confidence: {
        type: 'number',
        minimum: 0,
        maximum: 1
      }
    },
    required: [
      'name',
      'trigger_type',
      'trigger_config',
      'steps',
      'confidence'
    ],
    additionalProperties: false
  }
}
];

async function waitForCommand(db:any,id:string,ms=12000){const started=Date.now();while(Date.now()-started<ms){const {data}=await db.from('device_commands').select('status,result').eq('id',id).maybeSingle();if(data&&['completed','failed','cancelled'].includes(data.status))return data;await new Promise(r=>setTimeout(r,500));}return {status:'queued',result:'Komut sırada; Windows Agent çevrimiçi olduğunda uygulanacak.'};}
function b64url(s:string){return Buffer.from(s,'utf8').toString('base64url');}

async function executeTool(name:string,args:any,currentMessage:string):Promise<any>{
 const db=adminDb(),uid=ownerId();
 if(name==='remember'){const content=String(args.content||'').trim().slice(0,1500);if(!content)return {ok:false,error:'Boş hafıza'};const {error}=await db.from('memories').insert({user_id:uid,kind:args.kind,content,confidence:Number(args.confidence||.8)});return error?{ok:false,error:error.message}:{ok:true,saved:true};}
 if(name==='queue_device_command'){
   const {data:device}=await db.from('devices').select('id,name,last_seen_at').eq('user_id',uid).eq('enabled',true).order('last_seen_at',{ascending:false}).limit(1).maybeSingle();if(!device)return {ok:false,error:'Bağlı Windows cihazı yok.'};
   const {data,error}=await db.from('device_commands').insert({user_id:uid,device_id:device.id,action:args.action,target:String(args.target||''),status:'queued'}).select('id').single();if(error)return {ok:false,error:error.message};
   const final=await waitForCommand(db,data.id);await db.from('action_logs').insert({user_id:uid,source:'jarvis',action:`device:${args.action}`,details:{target:args.target,device:device.name},success:final.status==='completed',result:final.result});
   return {ok:final.status==='completed',status:final.status,result:final.result,command_id:data.id,device:device.name};
 }
 if(name==='analyze_screen'){
   const shot:any=await executeTool('queue_device_command',{action:'screenshot',target:''},currentMessage);
   if(!shot.ok||!String(shot.result||'').startsWith('data:image/')) return shot;
   const vision=await openaiResponse({model:modelConfig().vision,input:[{role:'user',content:[{type:'input_text',text:`Analyze this Windows screenshot for the owner. Question: ${String(args.question||currentMessage)}. Be precise. If a click is relevant, estimate pixel coordinates from the image and mention them clearly, but do not claim any click happened.`},{type:'input_image',image_url:String(shot.result)}]}]});
   return {ok:true,analysis:responseText(vision)};
 }
 if(name==='request_sensitive_device_command'){
   const {data:device}=await db.from('devices').select('id,name').eq('user_id',uid).eq('enabled',true).order('last_seen_at',{ascending:false}).limit(1).maybeSingle();if(!device)return {ok:false,error:'Bağlı Windows cihazı yok.'};
   const token=randomToken(20),expires=new Date(Date.now()+5*60_000).toISOString();
   const {data:ap,error:aerr}=await db.from('approvals').insert({user_id:uid,action:`device:${args.action}`,details:{target:String(args.target||''),reason:String(args.reason||''),device:device.name},token,status:'pending',expires_at:expires}).select('*').single();if(aerr)return {ok:false,error:aerr.message};
   const {error:cerr}=await db.from('device_commands').insert({user_id:uid,device_id:device.id,action:args.action,target:String(args.target||''),requires_confirmation:true,confirmation_token:token,status:'waiting_confirmation'});if(cerr)return {ok:false,error:cerr.message};
   return {ok:false,pending_approval:true,approval_id:ap.id,message:'Bu masaüstü etkileşimi kullanıcı onayı bekliyor.'};
 }
 if(name==='search_files'){const q=String(args.query||'').trim().replace(/[%_,]/g,' ');const {data,error}=await db.from('file_index').select('path,name,extension,modified_at,excerpt').eq('user_id',uid).or(`name.ilike.%${q}%,searchable_text.ilike.%${q}%`).limit(25);return error?{ok:false,error:error.message}:{ok:true,files:data||[]};}
 if(name==='create_task'){const {data,error}=await db.from('tasks').insert({user_id:uid,title:String(args.title).slice(0,300),notes:String(args.notes||'').slice(0,2000),due_at:args.due_at||null,recurrence:args.recurrence||null,notify:args.notify!==false}).select('*').single();return error?{ok:false,error:error.message}:{ok:true,task:data};}
 if(name==='list_tasks'){const {data,error}=await db.from('tasks').select('*').eq('user_id',uid).eq('status','open').order('due_at',{ascending:true,nullsFirst:false}).limit(50);return error?{ok:false,error:error.message}:{ok:true,tasks:data||[]};}
 if(name==='gmail_recent'){
   const q=encodeURIComponent(String(args.query||'')),max=Math.min(20,Math.max(1,Number(args.max_results||10)));const list=await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${max}`);const out=[];for(const m of (list.messages||[]).slice(0,max)){const d=await googleFetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`);const h:any={};for(const x of d.payload?.headers||[])h[x.name]=x.value;out.push({id:d.id,threadId:d.threadId,subject:h.Subject||'',from:h.From||'',date:h.Date||'',snippet:d.snippet||''});}return {ok:true,messages:out};
 }
 if(name==='gmail_create_draft'){
   const raw=`To: ${args.to}\r\nSubject: ${args.subject}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${args.body}`;const d=await googleFetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts',{method:'POST',body:JSON.stringify({message:{raw:b64url(raw)}})});return {ok:true,draft_id:d.id};
 }
 if(name==='calendar_events'){
   const p=new URLSearchParams({timeMin:args.time_min,timeMax:args.time_max,maxResults:String(args.max_results||20),singleEvents:'true',orderBy:'startTime'});const d=await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${p}`);return {ok:true,events:(d.items||[]).map((e:any)=>({id:e.id,summary:e.summary,start:e.start,end:e.end,location:e.location||'',status:e.status}))};
 }
 if(name==='calendar_create_event'){
   const token=randomToken(20),expires=new Date(Date.now()+10*60_000).toISOString();
   const details={summary:String(args.summary||''),description:String(args.description||''),start:String(args.start||''),end:String(args.end||'')};
   const {data,error}=await db.from('approvals').insert({user_id:uid,action:'calendar:create_event',details,token,status:'pending',expires_at:expires}).select('*').single();
   return error?{ok:false,error:error.message}:{ok:false,pending_approval:true,approval_id:data.id,message:'Takvim etkinliği oluşturulmadan önce onay bekliyor.'};
 }
 if(name==='home_assistant_action'){
   if(!currentMessage.toLowerCase().includes(String(args.entity_id||'').split('.').pop()?.replace(/_/g,' ')||'')) return {ok:false,error:'Home Assistant işlemi için bu mesajda açık kullanıcı talimatı gerekli.'};
   const d=await homeAssistantCall(args.domain,args.service,args.entity_id);return {ok:true,result:d};
 }
 if(name==='create_routine'){const {data,error}=await db.from('routines').insert({user_id:uid,name:String(args.name).slice(0,200),trigger_type:args.trigger_type,trigger_config:args.trigger_config||{},steps:args.steps||[],learned:true,confidence:Number(args.confidence||.8)}).select('*').single();return error?{ok:false,error:error.message}:{ok:true,routine:data};}
 return {ok:false,error:'Unknown tool'};
}

export async function POST(req:NextRequest){
 try{
  if(!requireBrowserKey(req))return NextResponse.json({error:'Erişim anahtarı geçersiz.'},{status:401});
  const body=await req.json().catch(()=>({}));const message=String(body.message||'').trim();if(!message)return NextResponse.json({error:'Mesaj gerekli.'},{status:400});
  const db=adminDb(),uid=ownerId();
  await db.from('behavior_events').insert({user_id:uid,event_type:'message',metadata:{length:message.length,hour:new Date().getHours()}});
  const [memQ,histQ,taskQ,locQ]=await Promise.all([
   db.from('memories').select('kind,content,confidence').eq('user_id',uid).order('created_at',{ascending:false}).limit(60),
   db.from('messages').select('role,content').eq('user_id',uid).order('created_at',{ascending:false}).limit(18),
   db.from('tasks').select('title,due_at,status').eq('user_id',uid).eq('status','open').order('due_at',{ascending:true,nullsFirst:false}).limit(10),
   db.from('location_events').select('latitude,longitude,label,created_at').eq('user_id',uid).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle()
  ]);
  const memoryText=(memQ.data||[]).map((m:any)=>`- [${m.kind}] ${m.content}`).join('\n');
  const recent=(histQ.data||[]).reverse().map((m:any)=>`${m.role.toUpperCase()}: ${m.content}`).join('\n');
  const tasks=(taskQ.data||[]).map((t:any)=>`- ${t.title}${t.due_at?' @ '+t.due_at:''}`).join('\n');
  const location=locQ.data?`${locQ.data.latitude},${locQ.data.longitude}${locQ.data.label?' ('+locQ.data.label+')':''}`:'(unknown/not shared)';
  const now=new Date().toISOString();
  const instructions=`You are JARVIS, the private personal AI operating layer for one owner. Default language Turkish. Be concise, competent and action-oriented. Current UTC time: ${now}.\n\nLONG-TERM MEMORY:\n${memoryText||'(none)'}\n\nOPEN TASKS:\n${tasks||'(none)'}\n\nLATEST SHARED LOCATION:\n${location}\n\nRECENT CHAT:\n${recent||'(none)'}\n\nRules:\n- Learn stable preferences/habits/workflows with remember, but never store passwords, API keys, card data, authentication tokens, exact secret codes, medical/sexual/political/religious sensitive details or other highly sensitive personal data.\n- Never claim a device action succeeded unless the tool says completed.\n- Do not send email: only read Gmail and create drafts.\n- Calendar creation is allowed only when the user clearly asks to add/schedule an event.\n- Home Assistant control requires a clear explicit instruction in the current user message and is restricted by server allowlist.\n- Do not rewrite/deploy your own code automatically. Learning happens via memory/routines and suggestions.\n- Destructive filesystem actions, payments, password/account changes and arbitrary shell commands are intentionally unavailable.\n- If a capability is not configured, explain the required integration instead of pretending.\n- If asked about screen contents, first request/trigger a screenshot if supported.\n- Use indexed-file search before claiming a local file cannot be found.`;
  const budget=await budgetStatus();
  const model=chooseModel(message,budget.ratio);
  if(budget.hardBlocked){
    const reply=`API bütçe sınırına ulaştım. Bugün $${budget.daily.toFixed(2)} / $${budget.dailyLimit.toFixed(2)}, bu ay $${budget.monthly.toFixed(2)} / $${budget.monthlyLimit.toFixed(2)} kullanıldı. Limit yenilenene veya ayarlardan artırılana kadar ücretli AI yanıtlarını durdurdum.`;
    await db.from('messages').insert([{user_id:uid,role:'user',content:message},{user_id:uid,role:'assistant',content:reply}]);
    return NextResponse.json({reply,model:'budget-guard',budget});
  }
  let totalUsage={input_tokens:0,output_tokens:0,total_tokens:0};
  const addUsage=(u:any)=>{totalUsage.input_tokens+=Number(u?.input_tokens||0);totalUsage.output_tokens+=Number(u?.output_tokens||0);totalUsage.total_tokens+=Number(u?.total_tokens||0)};
  let response=await openaiResponse({model,instructions,input:message,tools,tool_choice:'auto',max_output_tokens:1200});
  addUsage(response.usage);
  for(let round=0;round<4;round++){
   const calls=(response.output||[]).filter((x:any)=>x.type==='function_call');if(!calls.length)break;const outputs:any[]=[];
   for(const call of calls){let args:any={};try{args=JSON.parse(call.arguments||'{}')}catch{};let result:any;try{result=await executeTool(call.name,args,message)}catch(e:any){result={ok:false,error:e.message}}outputs.push({type:'function_call_output',call_id:call.call_id,output:JSON.stringify(result)});}
   response=await openaiResponse({model,instructions,previous_response_id:response.id,input:outputs,tools,tool_choice:'auto',max_output_tokens:1200});addUsage(response.usage);
  }
  const reply=responseText(response)||'Şu anda metin yanıtı oluşturamadım.';
  await db.from('messages').insert([{user_id:uid,role:'user',content:message},{user_id:uid,role:'assistant',content:reply}]);
  const u=estimateCost(model,totalUsage);await db.from('usage_logs').insert({user_id:uid,model,input_tokens:u.input,output_tokens:u.output,total_tokens:u.total,estimated_cost_usd:u.cost});
  return NextResponse.json({reply,model,budget});
 }catch(e:any){return NextResponse.json({error:e.message||'Beklenmeyen hata'},{status:500});}
}
