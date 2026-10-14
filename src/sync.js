// PT Log cloud sync + klantportaal (Supabase). Alleen de publieke anon key staat hier.
import {D,cur,setD,setCur,setStack,render,defSchema,load,saveLocal} from './core.js';
import {hooks} from './registry.js';
import {createClient} from '@supabase/supabase-js';
export const SB_URL='https://qzxyatfdeijnubftjmdr.supabase.co';
export const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6eHlhdGZkZWlqbnViZnRqbWRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5NjIyOTQsImV4cCI6MjEwNzUzODI5NH0.L3i4Yjm9mmxvwmDkCz8TcMurRw1yYivgmZKZYMNHPIQ';
const MK='ptlog-sync-v1', CK='ptlog-client-cache';
const TBL=['ptl_clients','ptl_schemas','ptl_blocks','ptl_routines','ptl_strippen','ptl_sessions','ptl_trainer_settings','ptl_exercises','ptl_programs'];
const LIST={ptl_exercises:'exercises',ptl_programs:'programs'};
const SUB={ptl_schemas:'schema',ptl_blocks:'blocks',ptl_routines:'routine',ptl_strippen:'pkg'};
let sb=null, user=null, role=null, M=loadM(), busy=false;
export const S=window.PTS={status:'uit',get user(){return user},get role(){return role}};
function loadM(){try{return JSON.parse(localStorage.getItem(MK))||{}}catch(e){return{}}}
function saveM(){localStorage.setItem(MK,JSON.stringify(M))}
function setStatus(s){S.status=s;const e=document.getElementById('sync');if(e){e.textContent={ok:'☁︎✓',wacht:'☁︎…',offline:'☁︎⨯',fout:'☁︎!',uit:''}[s]||'';e.title='Sync: '+s;e.style.display=s==='uit'?'none':''}}
async function lib(){if(sb)return sb;
 sb=createClient(SB_URL,SB_ANON,{auth:{flowType:'implicit',persistSession:true,detectSessionInUrl:true,storageKey:'ptlog-auth'}});S.sb=sb;S.createClient=createClient;return sb}

// ---- model <-> rijen
function explode(D){const o={};
 for(const c of D.clients){const {schema,blocks,routine,pkg,...core}=c;
  o['ptl_clients|'+c.id]={tbl:'ptl_clients',id:c.id,client_id:c.id,data:core};
  for(const t in SUB){const v=c[SUB[t]];if(v!==undefined)o[t+'|'+c.id]={tbl:t,id:c.id,client_id:c.id,data:{v}}}}
 for(const s of D.sessions)o['ptl_sessions|'+s.id]={tbl:'ptl_sessions',id:s.id,client_id:s.clientId,data:s};
 for(const t in LIST)for(const x of (D[LIST[t]]||[]))o[t+'|'+x.id]={tbl:t,id:x.id,client_id:'',data:x};
 if(D.lib&&Object.keys(D.lib).length)o['ptl_trainer_settings|lib']={tbl:'ptl_trainer_settings',id:'lib',client_id:'',data:{lib:D.lib}};
 return o}
const H=x=>JSON.stringify(x);
function applyRow(D,t,r){const del=r.deleted;
 if(t==='ptl_clients'){const i=D.clients.findIndex(c=>c.id===r.id);
  if(del){if(i>=0)D.clients.splice(i,1);D.sessions=D.sessions.filter(s=>s.clientId!==r.id);return}
  const keep=i>=0?D.clients[i]:{};const n={...r.data};for(const k of Object.values(SUB))if(keep[k]!==undefined)n[k]=keep[k];if(!n.schema&&window.defSchema)n.schema=defSchema();
  if(i>=0)D.clients[i]=n;else D.clients.push(n);return}
 if(SUB[t]){const c=D.clients.find(c=>c.id===r.id);if(!c)return false;if(del)delete c[SUB[t]];else c[SUB[t]]=r.data.v;return}
 if(t==='ptl_sessions'){const i=D.sessions.findIndex(s=>s.id===r.id);if(del){if(i>=0)D.sessions.splice(i,1);return}if(i>=0)D.sessions[i]=r.data;else D.sessions.push(r.data);return}
 if(LIST[t]){const L=D[LIST[t]]=D[LIST[t]]||[];const i=L.findIndex(x=>x.id===r.id);if(del){if(i>=0)L.splice(i,1);return}if(i>=0)L[i]=r.data;else L.push(r.data);return}
 if(t==='ptl_trainer_settings'){if(!del)D.lib=r.data.lib||{}}}

// ---- wachtrij
function track(force){if(role!=='trainer'||!M.uid)return;M.last=M.last||{};M.queue=M.queue||{};const now=new Date().toISOString();
 const cur=explode(D);
 for(const k in cur){const h=H(cur[k].data);if(force||!M.last[k]||M.last[k].h!==h){const r=cur[k];M.last[k]={h,u:now,c:r.client_id};M.queue[k]={tbl:r.tbl,row:{id:r.id,client_id:r.client_id,data:r.data,updated_at:now,deleted:false}}}}
 for(const k in M.last)if(!cur[k]){const [tbl,id]=k.split('|');M.queue[k]={tbl,row:{id,client_id:M.last[k].c||'',data:{},updated_at:now,deleted:true}};delete M.last[k]}
 saveM()}
hooks.afterSave.push(()=>{if(S.ro)return;track(false);flush()});
let again=false;
async function flush(){if(role!=='trainer'||!sb)return;if(busy){again=true;return}again=false;const Q=M.queue||{};const keys=Object.keys(Q);if(!keys.length){setStatus(navigator.onLine?'ok':'offline');return}
 if(!navigator.onLine){setStatus('offline');return}busy=true;setStatus('wacht');
 try{for(const t of TBL){const ks=keys.filter(k=>Q[k]&&Q[k].tbl===t);if(!ks.length)continue;
   const rows=ks.map(k=>{const r={...Q[k].row,trainer_id:user.id};if(t==='ptl_clients')delete r.client_id;return r});const snap=ks.map(k=>H(Q[k]));
   const {error}=await sb.from(t).upsert(rows,{onConflict:'id'});if(error)throw error;
   ks.forEach((k,i)=>{if(M.queue[k]&&H(M.queue[k])===snap[i])delete M.queue[k]})}
  saveM();setStatus(Object.keys(M.queue).length?'wacht':'ok')}catch(e){console.warn('sync',e);setStatus(navigator.onLine?'fout':'offline')}finally{busy=false;if(again)setTimeout(flush,0)}}
async function pull(){if(role!=='trainer'||!navigator.onLine)return;M.cur=M.cur||{};let changed=false;
 for(const t of TBL){let since=M.cur[t]||'1970-01-01T00:00:00Z';
  const {data,error}=await sb.from(t).select('id,client_id,data,updated_at,deleted,synced_at').gt('synced_at',new Date(new Date(since)-2000).toISOString()).order('synced_at').limit(5000);
  if(error)throw error;
  for(const r of data){const k=t+'|'+r.id;const loc=M.last&&M.last[k];if((M.queue||{})[k]&&M.queue[k].row.updated_at>=r.updated_at)continue;
   if(loc&&loc.u>r.updated_at)continue;if(applyRow(D,t,r)===false)continue;changed=true;
   if(r.deleted)delete M.last[k];else{M.last=M.last||{};const ex=explode(D)[k];M.last[k]={h:ex?H(ex.data):'',u:r.updated_at}}
   if(r.synced_at>since)since=r.synced_at}
  M.cur[t]=since}
 saveM();
 const {data:pays}=await sb.from('ptl_payments').select('*').order('created_at');if(pays){if(JSON.stringify(pays)!==JSON.stringify(D.payments||[])){D.payments=pays;changed=true}}
 if(changed){saveLocal();if(cur&&['home','client','admin','clientAdmin','planning','progress','history','exStats','library','programs'].includes(cur.v))render()}}
S.syncNow=async()=>{try{await flush();await pull();await flush();setStatus(Object.keys(M.queue||{}).length?'wacht':'ok')}catch(e){console.warn(e);setStatus('fout')}};

// ---- sessie / rol
async function onUser(u){user=u;if(!u){role=null;S.ro=false;setStatus('uit');return}
 const {data}=await sb.from('ptl_profiles').select('role').eq('id',u.id).maybeSingle();role=data?.role||'client';
 if(role==='trainer'){S.ro=false;
  if(M.uid&&M.uid!==u.id){M={}}
  if(!M.uid){M={uid:u.id};const n=D.clients.length+D.sessions.length;
   if(n&&confirm(`Bestaande gegevens op dit apparaat (${D.clients.length} klanten, ${D.sessions.length} trainingen) eenmalig naar je account uploaden?`))track(true);
   else{M.last={};for(const [k,r] of Object.entries(explode(D)))M.last[k]={h:H(r.data),u:'1970-01-01T00:00:00Z'};}saveM()}
  await S.syncNow()}
 else await loadClient()}
async function loadClient(){S.ro=true;let cache=null;try{cache=JSON.parse(localStorage.getItem(CK))}catch(e){}
 try{const q=t=>sb.from(t).select('id,client_id,data,deleted').eq('deleted',false);
  const [c,sc,bl,rt,se]=await Promise.all(['ptl_clients','ptl_schemas','ptl_blocks','ptl_routines','ptl_sessions'].map(q));
  if(c.error)throw c.error;const X={clients:[],sessions:[],lib:{},draft:null,ro:true};
  for(const r of c.data){X.clients.push({...r.data,shared:{plan:!!r.data.share?.plan,sessions:!!r.data.share?.sessions}})}
  for(const [res,t] of [[sc,'ptl_schemas'],[bl,'ptl_blocks'],[rt,'ptl_routines']])for(const r of res.data||[])applyRow(X,t,r);
  for(const r of se.data||[])X.sessions.push(r.data);
  const [ex,hw,pr,pa]=await Promise.all([sb.from('ptl_exercises').select('data').eq('deleted',false),sb.from('ptl_home_workouts').select('*').eq('deleted',false),sb.from('ptl_products').select('*').eq('active',true).order('sort'),sb.from('ptl_payments').select('*').order('created_at',{ascending:false})]);
  X.exercises=(ex.data||[]).map(r=>r.data);X.home=(hw.data||[]).map(r=>({...r.data,id:r.id,date:r.date,home:true}));X.products=pr.data||[];X.payments=pa.data||[];
  for(const cl of X.clients)if(!cl.schema)cl.schema=defSchema();
  cache=X;localStorage.setItem(CK,JSON.stringify(X))}catch(e){console.warn(e)}
 if(cache){setD(cache)}else setD({clients:[],sessions:[],lib:{},draft:null,ro:true});
 if(!cur||!['cview','chome','cpay','history','progress','chat'].includes(cur.v))setCur({v:'cview',p:{tab:'vandaag'}});setStack([]);render()}
S.reloadClient=loadClient;
S.signIn=async(email,pw)=>{await lib();const {data,error}=await sb.auth.signInWithPassword({email,password:pw});if(error)throw error;await onUser(data.user)};
S.signUp=async(email,pw)=>{await lib();const {data,error}=await sb.auth.signUp({email,password:pw,options:{emailRedirectTo:location.origin+location.pathname}});if(error)throw error;return data};
S.reset=async email=>{await lib();const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw error};
S.setPassword=async pw=>{const {error}=await sb.auth.updateUser({password:pw});if(error)throw error};
S.claim=async code=>{const {data,error}=await sb.rpc('ptl_claim_trainer',{code});if(error)throw error;if(data){M={};saveM();await onUser(user)}return data};
S.signOut=async()=>{await flush();await sb.auth.signOut();const wasRo=S.ro;user=null;role=null;S.ro=false;localStorage.removeItem(CK);if(wasRo){setD(load())}setStatus('uit');setCur({v:'home'});render()};
S.invite=async email=>{await lib();const tmp=S.createClient(SB_URL,SB_ANON,{auth:{persistSession:false,autoRefreshToken:false,flowType:'implicit',storageKey:'ptlog-invite'}});
 const {error}=await tmp.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname,shouldCreateUser:true}});if(error)throw error};
S.pending=()=>Object.keys(M.queue||{}).length;
window.addEventListener('online',()=>S.syncNow());window.addEventListener('offline',()=>setStatus('offline'));
setInterval(()=>{if(role==='trainer'&&navigator.onLine)S.syncNow()},60000);
S.init=()=>{
(async()=>{const hasAuth=localStorage.getItem('ptlog-auth')||/access_token|error_description/.test(location.hash);S._payReturn=(location.hash.match(/#betaling\/([0-9a-f-]{36})/)||[])[1];if(!hasAuth)return;
 try{await lib();const {data}=await sb.auth.getSession();if(location.hash.includes('access_token')||S._payReturn)history.replaceState(null,'',location.pathname);
  const recovery=/type=recovery/.test(S._hash||'');
  if(data.session){await onUser(data.session.user);if(S._recovery){setCur({v:'cloud'});render()}}
  sb.auth.onAuthStateChange((ev,s)=>{if(ev==='PASSWORD_RECOVERY'){S._recovery=true;setCur({v:'cloud'});render()}});
 }catch(e){console.warn('auth init',e);if(S.ro===false&&localStorage.getItem(CK)){}}})();
S._hash=location.hash;if(/type=recovery/.test(location.hash))S._recovery=true;
// offline klant: toon cache
if(!navigator.onLine&&localStorage.getItem(CK)&&localStorage.getItem('ptlog-auth')){try{setD(JSON.parse(localStorage.getItem(CK)));S.ro=true;role='client';setCur({v:'cview',p:{tab:'vandaag'}});render()}catch(e){}}
};
S.ensure=lib;
