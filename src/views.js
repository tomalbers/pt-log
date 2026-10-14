import {D,cur,setCur,setStack,go,head,esc,toast,today,fmtD,dm,addD,chartBox,curBlock,bWeek,bEnd,trainings,swapName,clientSessions,allLib,LIB,BASE,muscle,uid,render,save,mondayOf,$} from './core.js';
import {extraViews} from './registry.js';
import {S,SB_URL,SB_ANON} from './sync.js';
const P=()=>window.PTS;
const eur=c=>'€ '+(c/100).toFixed(2).replace('.',',');
const dl=(name,txt,type)=>{const b=new Blob([txt],{type});const u=URL.createObjectURL(b);const l=document.createElement('a');l.href=u;l.download=name;document.body.appendChild(l);l.click();l.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)};
const csvq=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const needOnline=a=>{if(!navigator.onLine||!S.sb){a.innerHTML='<div class="card"><p class="sub">Hiervoor heb je internet en een account nodig.</p></div>';return true}return false};

function cloud(a){const P=window.PTS;head('Account',true);
 if(!P){a.innerHTML='<div class="card"><p class="sub">Online functies laden… (internet nodig)</p></div>';return}
 const u=P.user;
 if(u){a.innerHTML=`<div class="card"><h2>${P.role==='trainer'?'Trainer':'Klant'}</h2><p class="sub">Ingelogd als ${esc(u.email)}</p>
 ${P.role==='trainer'?`<p class="sub">Sync: ${esc(P.status)} · ${P.pending()} wijziging(en) in wachtrij</p><button class="btn" id="sn">Nu synchroniseren</button>`:''}
 <label>Nieuw wachtwoord instellen</label><input id="np" type="password" autocomplete="new-password"><button class="btn sec" id="spw">Wachtwoord opslaan</button>
 <button class="btn red" id="so">Uitloggen</button></div>
 ${P.role!=='trainer'?`<details class="card"><summary>Ben je de trainer?</summary><label>Trainerscode</label><input id="tc" autocomplete="off"><button class="btn sec" id="tcb">Trainer worden</button></details>`:''}`;
  const sn=$('#sn');if(sn)sn.onclick=async()=>{await P.syncNow();toast('Sync: '+P.status);render()};
  $('#spw').onclick=async()=>{const v=$('#np').value;if(v.length<8){toast('Minimaal 8 tekens');return}try{await P.setPassword(v);toast('Wachtwoord opgeslagen')}catch(e){alert(e.message)}};
  $('#so').onclick=()=>P.signOut();
  const tcb=$('#tcb');if(tcb)tcb.onclick=async()=>{try{if(await P.claim($('#tc').value.trim())){toast('Je bent nu trainer');setCur({v:'home'});render()}else alert('Code onjuist')}catch(e){alert(e.message)}};return}
 a.innerHTML=`<div class="card"><h2>Inloggen</h2><label>E-mail</label><input id="le" type="email" autocomplete="username"><label>Wachtwoord</label><input id="lp" type="password" autocomplete="current-password">
 <button class="btn" id="li">Inloggen</button><button class="btn sec" id="su">Nieuw account aanmaken</button><button class="btn sec" id="rs">Wachtwoord vergeten</button>
 <p class="sub">Klant? Gebruik de link uit de uitnodigingsmail van je trainer. Je gegevens op dit apparaat blijven gewoon bewaard.</p></div>`;
 const ev=()=>$('#le').value.trim();
 $('#li').onclick=async()=>{try{await P.signIn(ev(),$('#lp').value);toast('Ingelogd');if(!P.ro){setCur({v:'home'});setStack([]);render()}}catch(e){alert('Inloggen mislukt: '+e.message)}};
 $('#su').onclick=async()=>{if($('#lp').value.length<8){toast('Wachtwoord minimaal 8 tekens');return}try{await P.signUp(ev(),$('#lp').value);alert('Check je e-mail om je account te bevestigen, en log daarna in.')}catch(e){alert(e.message)}};
 $('#rs').onclick=async()=>{if(!ev()){toast('Vul je e-mail in');return}try{await P.reset(ev());alert('Je krijgt een e-mail met een link om je wachtwoord in te stellen.')}catch(e){alert(e.message)}};
}

// ---------- Oefeningenbibliotheek (trainer)
function library(a){head('Oefeningen',true);const L=(D.exercises=D.exercises||[]).filter(e=>!e.deleted).sort((x,y)=>x.name.localeCompare(y.name));
 a.innerHTML=`<div class="card"><input id="q" placeholder="Zoeken…"><div class="list" id="ll"></div><button class="btn" id="new">+ Nieuwe oefening</button>${L.length?'':'<button class="btn sec" id="seed">Standaardoefeningen toevoegen</button>'}</div>`;
 const draw=()=>{const q=$('#q').value.toLowerCase();$('#ll').innerHTML=L.filter(e=>e.name.toLowerCase().includes(q)).map(e=>`<button class="item" data-x="${e.id}"><span>${esc(e.name)}<br><span class="sub">${esc(e.muscle||'')} · ${esc(e.reps||'')}${e.video?' · ▶':''}${e.cues?'':' · nog geen uitleg'}</span></span><span>›</span></button>`).join('')||'<p class="sub">Geen oefeningen.</p>';
  a.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>go('exEdit',{id:b.dataset.x}))};
 $('#q').oninput=draw;draw();$('#new').onclick=()=>go('exEdit',{});
 const sd=$('#seed');if(sd)sd.onclick=()=>{const all=allLib();for(const n in all)D.exercises.push({id:uid(),name:n,reps:all[n],muscle:muscle(n)||'',desc:'',cues:'',video:''});save();render()}}
function exEdit(a,p){const e=p.id?D.exercises.find(x=>x.id===p.id):null;head(e?e.name:'Nieuwe oefening',true);
 a.innerHTML=`<div class="card"><label>Naam</label><input id="n" value="${esc(e?.name)}"><label>Herhalingen (standaard)</label><input id="r" value="${esc(e?.reps)}" placeholder="8-12">
 <label>Spiergroep</label><input id="m" value="${esc(e?.muscle)}"><label>Beschrijving</label><textarea id="d">${esc(e?.desc)}</textarea>
 <label>Aandachtspunten (cues)</label><textarea id="c" placeholder="Borst omhoog, knieën naar buiten…">${esc(e?.cues)}</textarea><label>Video-URL (YouTube, Vimeo…)</label><input id="v" type="url" value="${esc(e?.video)}">
 <button class="btn" id="sv">Opslaan</button>${e?'<button class="btn red" id="del">Verwijderen</button>':''}</div>`;
 $('#sv').onclick=()=>{const n=$('#n').value.trim();if(!n)return toast('Vul een naam in');const v=$('#v').value.trim();if(v&&!/^https?:\/\//.test(v))return toast('Video-URL moet met https:// beginnen');
  const o={name:n,reps:$('#r').value.trim(),muscle:$('#m').value.trim(),desc:$('#d').value,cues:$('#c').value,video:v};if(e)Object.assign(e,o);else D.exercises.push({id:uid(),...o});save();toast('Opgeslagen');history_back()};
 const d=$('#del');if(d)d.onclick=()=>{if(confirm('Oefening verwijderen?')){D.exercises=D.exercises.filter(x=>x!==e);save();history_back()}}}
function history_back(){document.getElementById('back').click()}

// ---------- Programma's (workout builder)
function programs(a,p){const ap=p.apply&&D.clients.find(c=>c.id===p.apply);head(ap?'Programma voor '+ap.name:"Programma's",true);const L=(D.programs=D.programs||[]);
 a.innerHTML=`<div class="card">${ap?'<p class="sub">Kies een programma. Het schema van de klant wordt vervangen (trainingen blijven bewaard).</p>':''}<div class="list">${L.map(x=>`<button class="item" data-p="${x.id}"><span>${esc(x.name)}<br><span class="sub">${x.freq} · ${Object.keys(x.schema).map(t=>t+': '+x.schema[t].length+' oef.').join(' · ')}</span></span><span>›</span></button>`).join('')||'<p class="sub">Nog geen programma\'s.</p>'}</div>
 ${ap?`<button class="btn sec" id="fromc">Huidig schema van ${esc(ap.name)} opslaan als programma</button>`:'<button class="btn" id="new">+ Nieuw programma</button>'}</div>`;
 a.querySelectorAll('[data-p]').forEach(b=>b.onclick=()=>{const x=L.find(y=>y.id===b.dataset.p);if(ap){if(!confirm(`"${x.name}" toepassen op ${ap.name}?`))return;ap.schema=JSON.parse(JSON.stringify(x.schema));ap.plan=x.freq;['A','B','C'].forEach(t=>{if(!ap.schema[t])ap.schema[t]=BASE[t].map(n=>({n,r:LIB[n]}))});save();toast('Programma toegepast');history_back()}else go('progEdit',{id:x.id,t:'A'})});
 const n=$('#new');if(n)n.onclick=()=>{const name=prompt('Naam van het programma','Volledig lichaam 2x');if(!name)return;const x={id:uid(),name,freq:'2x',schema:{A:[],B:[],C:[]}};L.push(x);save();go('progEdit',{id:x.id,t:'A'})};
 const f=$('#fromc');if(f)f.onclick=()=>{const name=prompt('Naam van het programma',ap.name+' schema');if(!name)return;L.push({id:uid(),name,freq:ap.plan,schema:JSON.parse(JSON.stringify(ap.schema))});save();toast('Opgeslagen');render()}}
function progEdit(a,p){const x=D.programs.find(y=>y.id===p.id);const t=p.t||'A';head(x.name,true);const T=x.freq==='3x'?['A','B','C']:['A','B'];const Lx=x.schema[t]=x.schema[t]||[];
 a.innerHTML=`<div class="card"><label>Frequentie</label><div class="tabs" id="fq"><button data-f="2x" class="${x.freq==='2x'?'on':''}">2x per week</button><button data-f="3x" class="${x.freq==='3x'?'on':''}">3x per week</button></div>
 <div class="tabs">${T.map(k=>`<button data-t="${k}" class="${k===t?'on':''}">Training ${k}</button>`).join('')}</div>
 ${Lx.map((e,i)=>`<div class="sch" data-i="${i}"><span>${esc(e.n)} <button class="info" data-info="${esc(e.n)}">i</button><br><span class="sub">${esc(e.r)}</span></span><button data-a="up">↑</button><button data-a="r">✎</button><button data-a="rm">✕</button></div>`).join('')||'<p class="sub">Nog geen oefeningen.</p>'}
 <label>Oefening toevoegen</label><select id="add"><option value="">Kies…</option>${Object.keys(allLib()).sort().map(n=>`<option>${esc(n)}</option>`).join('')}</select>
 <button class="btn sec" id="ren">Naam wijzigen</button><button class="btn red" id="del">Programma verwijderen</button></div>`;
 a.querySelectorAll('#fq button').forEach(b=>b.onclick=()=>{x.freq=b.dataset.f;save();render()});
 a.querySelectorAll('[data-t]').forEach(b=>b.onclick=()=>{cur.p.t=b.dataset.t;render()});
 a.querySelectorAll('.sch').forEach(r=>{const i=+r.dataset.i;r.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const k=b.dataset.a;if(k==='up'&&i>0)[Lx[i-1],Lx[i]]=[Lx[i],Lx[i-1]];if(k==='rm')Lx.splice(i,1);if(k==='r'){const v=prompt('Sets × herhalingen / tijd',Lx[i].r);if(v!=null)Lx[i].r=v}save();render()})});
 $('#add').onchange=e=>{const n=e.target.value;if(n){Lx.push({n,r:allLib()[n]||''});save();render()}};
 $('#ren').onclick=()=>{const v=prompt('Naam',x.name);if(v){x.name=v;save();render()}};
 $('#del').onclick=()=>{if(confirm('Programma verwijderen?')){D.programs=D.programs.filter(y=>y!==x);save();history_back()}}}

// ---------- Producten & betalingen (trainer)
async function payments(a){head('Producten & betalingen',true);if(needOnline(a))return;
 a.innerHTML='<div class="card"><p class="sub">Laden…</p></div>';
 const {data:prods,error}=await S.sb.from('ptl_products').select('*').order('sort');if(error){a.innerHTML=`<div class="card">${esc(error.message)}</div>`;return}
 await S.syncNow();const pays=(D.payments||[]).slice().reverse();const cn=id=>D.clients.find(c=>c.id===id)?.name||id;
 const paid=pays.filter(p=>p.status==='paid');const m=today().slice(0,7);
 a.innerHTML=`<div class="card"><h2>Producten</h2><p class="sub">Klanten kopen deze in de app. Strippen worden automatisch bij de periode van 4 weken opgeteld waarin betaald is.</p>
 ${prods.map(p=>`<div class="sch"><span>${esc(p.name)}${p.active?'':' <span class="sub">(uit)</span>'}<br><span class="sub">${eur(p.price_cents)} · ${p.strips} strip${p.strips===1?'':'pen'}</span></span><button data-e="${p.id}">✎</button><button data-o="${p.id}">${p.active?'⏸':'▶'}</button></div>`).join('')||'<p class="sub">Nog geen producten.</p>'}
 <button class="btn" id="np">+ Nieuw product</button>${prods.length?'':'<button class="btn sec" id="seed">Standaardproducten toevoegen</button>'}</div>
 <div class="card"><h2>Betalingen</h2><div class="row"><div><div class="sub">Deze maand</div><h2>${eur(paid.filter(p=>(p.paid_at||'').startsWith(m)).reduce((s,p)=>s+p.amount_cents,0))}</h2></div><div><div class="sub">Totaal</div><h2>${eur(paid.reduce((s,p)=>s+p.amount_cents,0))}</h2></div></div>
 <table><tr><th>Datum</th><th>Klant / product</th><th>Bedrag</th><th>Status</th></tr>${pays.map(p=>`<tr><td>${fmtD((p.paid_at||p.created_at).slice(0,10))}${p.invoice_no?'<br><span class="sub">'+esc(p.invoice_no)+'</span>':''}</td><td>${esc(cn(p.client_id))}<br><span class="sub">${esc(p.description.split(' – ')[0])}${p.test_mode?' · test':''}</span></td><td>${eur(p.amount_cents)}</td><td>${{paid:'✅ betaald',open:'open',pending:'bezig',canceled:'geannuleerd',expired:'verlopen',failed:'mislukt'}[p.status]||esc(p.status)}${p.method?'<br><span class="sub">'+esc(p.method)+'</span>':''}</td></tr>`).join('')||'<tr><td colspan="4" class="sub">Nog geen betalingen.</td></tr>'}</table>
 <button class="btn sec" id="csv">Exporteren als CSV</button></div>`;
 const edit=async(p)=>{const name=prompt('Naam',p?.name||'Strippenkaart 4 weken 8x');if(!name)return;const pr=prompt('Prijs in euro',p?((p.price_cents/100)+'').replace('.',','):'');if(!pr)return;const c=Math.round(parseFloat(pr.replace(',','.'))*100);if(!(c>=100))return toast('Ongeldige prijs');
  const st=parseInt(prompt('Aantal strippen dat erbij komt',p?.strips??8));if(!(st>=0))return;const row={name,price_cents:c,strips:st,updated_at:new Date().toISOString()};
  const r=p?await S.sb.from('ptl_products').update(row).eq('id',p.id):await S.sb.from('ptl_products').insert({...row,sort:prods.length});if(r.error)alert(r.error.message);render()};
 $('#np').onclick=()=>edit(null);a.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>edit(prods.find(p=>p.id===b.dataset.e)));
 a.querySelectorAll('[data-o]').forEach(b=>b.onclick=async()=>{const p=prods.find(x=>x.id===b.dataset.o);await S.sb.from('ptl_products').update({active:!p.active}).eq('id',p.id);render()});
 const sd=$('#seed');if(sd)sd.onclick=async()=>{const r=await S.sb.from('ptl_products').insert([{name:'Strippenkaart 4 weken – 8 sessies',price_cents:36000,strips:8,sort:0},{name:'Strippenkaart 4 weken – 12 sessies',price_cents:51000,strips:12,sort:1},{name:'Losse sessie',price_cents:5000,strips:1,sort:2}]);if(r.error)alert(r.error.message);toast('Toegevoegd – pas de prijzen aan');render()};
 $('#csv').onclick=()=>{const L=[['Factuurnummer','Datum betaald','Aangemaakt','Klant','Omschrijving','Bedrag','Methode','Status','Strippen','Mollie-id','Test'].map(csvq).join(';')];
  pays.forEach(p=>L.push([p.invoice_no,(p.paid_at||'').slice(0,10),p.created_at.slice(0,10),cn(p.client_id),p.description,(p.amount_cents/100).toFixed(2).replace('.',','),p.method,p.status,p.strips,p.mollie_id,p.test_mode?'ja':'nee'].map(csvq).join(';')));
  dl('betalingen-'+today()+'.csv','\ufeff'+L.join('\n'),'text/csv')}}

// ---------- Klantdata (trainer bekijkt input van klant)
async function clientData(a,p){const c=D.clients.find(x=>x.id===p.id);head('Klantdata '+c.name,true);if(needOnline(a))return;
 const q=t=>S.sb.from(t).select('*').eq('client_id',c.id).eq('deleted',false).order('date');
 const [hw,bo,ci]=await Promise.all([q('ptl_home_workouts'),q('ptl_body'),q('ptl_checkins')]);
 a.innerHTML=bodyCards(bo.data||[],false)+checkinCards(ci.data||[])+homeCards(hw.data||[]);bindBody(bo.data||[])}
function bodyCards(B){return `<div class="card"><h2>Lichaamsgewicht</h2><div id="bw"></div></div><div class="card"><h2>Metingen</h2>${B.length?`<table><tr><th>Datum</th><th>kg</th><th>Taille</th><th>Heup</th><th>Borst</th><th>Vet%</th></tr>${B.slice().reverse().map(r=>`<tr><td>${fmtD(r.date)}</td><td>${r.data.kg??'-'}</td><td>${r.data.taille??'-'}</td><td>${r.data.heup??'-'}</td><td>${r.data.borst??'-'}</td><td>${r.data.vet??'-'}</td></tr>`).join('')}</table>`:'<p class="sub">Nog geen metingen.</p>'}</div>`}
function bindBody(B){const w=B.filter(r=>r.data.kg!=null);const el=$('#bw');if(el)chartBox(el,{type:'line',labels:w.map(r=>dm(r.date)),series:[{name:'Gewicht',color:'#1F4E78',vals:w.map(r=>r.data.kg)},{name:'Taille',color:'#ea580c',vals:w.map(r=>r.data.taille??null),dash:1}].filter(s=>s.vals.some(v=>v!=null)),yLabel:'kg / cm',xLabel:'datum (dd-mm)',empty:'Nog geen gewicht ingevuld.'})}
function checkinCards(C){const last=C.slice(-14).reverse();return `<div class="card"><h2>Check-ins (laatste 14)</h2>${last.length?`<table><tr><th>Datum</th><th>Slaap</th><th>Stress</th><th>Energie</th><th>Gewoontes</th></tr>${last.map(r=>`<tr><td>${fmtD(r.date)}</td><td>${r.data.slaap??'-'}</td><td>${r.data.stress??'-'}</td><td>${r.data.energie??'-'}</td><td>${HAB.filter(h=>r.data[h[0]]).map(h=>h[2]).join(' ')}${r.data.note?'<br><span class="sub">'+esc(r.data.note)+'</span>':''}</td></tr>`).join('')}</table>`:'<p class="sub">Nog geen check-ins.</p>'}</div>`}
function homeCards(H){return `<div class="card"><h2>Thuistrainingen (${H.length})</h2>${H.slice().reverse().map(r=>`<div class="prev"><b>${fmtD(r.date)}</b> · ${esc(r.data.training||'Eigen training')}<br>${(r.data.ex||[]).map(e=>esc(e.n)+': '+e.sets.map(s=>(s.kg!=null?s.kg+'kg×':'')+(s.reps??'-')).join('/')).join('<br>')}${r.data.note?'<br><i>'+esc(r.data.note)+'</i>':''}</div>`).join('')||'<p class="sub">Nog geen thuistrainingen.</p>'}</div>`}
const HAB=[['water','2 liter water','💧'],['stappen','8.000 stappen','🚶'],['eiwit','Eiwitdoel gehaald','🥚'],['mobiliteit','10 min mobiliteit','🧘']];

// ---------- Chat
let chan=null;
async function chat(a,p){const cid=p.cid||D.clients[0]?.id;const tr=P().role==='trainer';const c=D.clients.find(x=>x.id===cid);head(tr?'Chat '+(c?.name||''):'Chat met je trainer',true);
 if(!cid)return;if(needOnline(a))return;
 a.innerHTML=`<div class="chat" id="ml"></div><div class="chatin ${tr?'tr':''}"><input id="mi" placeholder="Bericht…" maxlength="4000"><button id="ms">Stuur</button></div>`;
 const me=P().user.id;const ml=$('#ml');const seen=new Set();
 const add=m=>{if(seen.has(m.id))return;seen.add(m.id);const d=document.createElement('div');d.className='msg'+(m.sender===me?' me':'');d.innerHTML=`${esc(m.body)}<small>${new Date(m.created_at).toLocaleString('nl-NL',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</small>`;ml.appendChild(d);window.scrollTo(0,document.body.scrollHeight)};
 const send=async()=>{const v=$('#mi').value.trim();if(!v)return;$('#mi').value='';const {data,error}=await S.sb.from('ptl_messages').insert({client_id:cid,body:v,from_trainer:tr}).select().single();if(error){alert('Versturen mislukt: '+error.message);$('#mi').value=v}else add(data)};
 $('#ms').onclick=send;$('#mi').onkeydown=e=>{if(e.key==='Enter')send()}
 const {data}=await S.sb.from('ptl_messages').select('*').eq('client_id',cid).order('created_at').limit(500);(data||[]).forEach(add);
 S.sb.from('ptl_messages').update({read_at:new Date().toISOString()}).eq('client_id',cid).neq('sender',me).is('read_at',null).then(()=>{});
 if(chan)S.sb.removeChannel(chan);
 chan=S.sb.channel('chat-'+cid).on('postgres_changes',{event:'INSERT',schema:'public',table:'ptl_messages',filter:'client_id=eq.'+cid},pl=>{if(document.getElementById('ml')===ml)add(pl.new)}).subscribe();
}

// ---------- Klant-app
const OB='ptlog-outbox';
function outbox(){try{return JSON.parse(localStorage.getItem(OB))||[]}catch(e){return[]}}
async function flushOut(){const Q=outbox();if(!Q.length||!navigator.onLine||!S.sb)return;const rest=[];
 for(const it of Q){const {error}=await S.sb.from(it.t).upsert(it.row,{onConflict:'id'});if(error){console.warn(error);rest.push(it)}}localStorage.setItem(OB,JSON.stringify(rest))}
async function cwrite(t,row){row.updated_at=new Date().toISOString();const Q=outbox().filter(x=>!(x.t===t&&x.row.id===row.id));Q.push({t,row});localStorage.setItem(OB,JSON.stringify(Q));await flushOut();return outbox().length===0}
window.addEventListener('online',flushOut);S.flushOut=flushOut;S.outbox=()=>outbox().length;
const CD='ptlog-cdata';const cdata=()=>{try{return JSON.parse(localStorage.getItem(CD))||{}}catch(e){return{}}};
async function loadCdata(cid){const o=cdata();if(navigator.onLine&&S.sb){const q=t=>S.sb.from(t).select('*').eq('client_id',cid).eq('deleted',false).order('date');const [b,c,h]=await Promise.all([q('ptl_body'),q('ptl_checkins'),q('ptl_home_workouts')]);
 if(!b.error){o.body=b.data;o.checkins=c.data;o.home=h.data;localStorage.setItem(CD,JSON.stringify(o))}}
 for(const it of outbox()){const k={ptl_body:'body',ptl_checkins:'checkins',ptl_home_workouts:'home'}[it.t];o[k]=(o[k]||[]).filter(r=>r.id!==it.row.id).concat([it.row])}return o}
function tabbar(tab){const T=[['vandaag','🏋️','Vandaag'],['voortgang','📈','Voortgang'],['checkin','✅','Check-in'],['chat','💬','Chat'],['winkel','💶','Winkel']];
 const e=document.createElement('nav');e.className='tabbar';e.innerHTML=T.map(([k,i,l])=>`<button data-tab="${k}" class="${k===tab?'on':''}"><b>${i}</b>${l}</button>`).join('');
 e.querySelectorAll('button').forEach(b=>b.onclick=()=>{setStack([]);setCur({v:'cview',p:{tab:b.dataset.tab}});render();window.scrollTo(0,0)});return e}
function nextTraining(c,all){const T=trainings(c);const l=all.filter(s=>T.includes(s.training)).sort((x,y)=>(x.date).localeCompare(y.date)).pop();if(!l)return T[0];return T[(T.indexOf(l.training)+1)%T.length]}
async function cview(a,p){document.querySelectorAll('.tabbar').forEach(x=>x.remove());const tab=p.tab||'vandaag';const c=D.clients[0];
 if(S._payReturn){const id=S._payReturn;S._payReturn=null;return go('cpay',{id})}
 if(!c){head('PT Log',false);a.innerHTML=`<div class="card"><h2>Welkom</h2><p class="sub">Je trainer heeft nog geen klantprofiel aan je e-mailadres gekoppeld. Kom later terug.</p><button class="btn sec" id="acc">Account</button></div>`;$('#acc').onclick=()=>go('cloud');return}
 document.body.appendChild(tabbar(tab));a.style.paddingBottom='90px';
 if(tab==='chat')return chat(a,{cid:c.id}).then(()=>head('Chat met je trainer',false));
 if(tab==='vandaag')return cToday(a,c);if(tab==='voortgang')return cProgress(a,c);if(tab==='checkin')return cCheckin(a,c);if(tab==='winkel')return cShop(a,c)}
async function cToday(a,c){head('Hoi '+c.name,false);const cd=await loadCdata(c.id);const home=(cd.home||[]).map(r=>({training:r.data.training,date:r.date}));const t=today();
 const b=curBlock(c);const cw=b&&bWeek(b,t);const W=cw&&b.weeks[cw-1];let h='';
 if(c.shared.plan){const nt=nextTraining(c,D.sessions.concat(home));
  h+=`<div class="card"><h2>Training ${nt}</h2>${W?`<div class="sub">Week ${cw}/${b.weeks.length} · ${esc(W.ph)} · ${esc(W.sets)}×${esc(W.reps)} · RIR ${esc(W.rir)}${W.hiit?' · HIIT '+esc(W.hiit):''}</div>`:''}
  ${(c.schema[nt]||[]).map(e=>{const n=swapName(b,cw||0,e.n);return `<div class="sch"><span>${esc(n)}<br><span class="sub">${esc(W?W.sets+'×'+W.reps:e.r)}</span></span><button class="info" data-info="${esc(n)}">i</button></div>`}).join('')}
  <button class="btn grn" id="lg">🏠 Thuistraining loggen</button></div>`;
  if(b)h+=`<div class="card"><h2>Planning</h2><div class="sub">${fmtD(b.start)} – ${fmtD(bEnd(b))}</div><table class="plan"><tr><th>Wk</th><th>Fase</th><th>Sets×reps</th><th>RIR</th></tr>${b.weeks.map((w,i)=>`<tr class="${cw===i+1?'now':''}${w.dl?' dl':''}"><td><b>${i+1}</b> <span class="sub">${dm(addD(b.start,i*7))}</span></td><td>${esc(w.ph)}</td><td>${esc(w.sets)}×${esc(w.reps)}</td><td>${esc(w.rir)}</td></tr>`).join('')}</table></div>`}
 else h+=`<div class="card"><h2>Vandaag</h2><p class="sub">Je trainer heeft je schema nog niet gedeeld.</p><button class="btn grn" id="lg">🏠 Eigen training loggen</button></div>`;
 const hist=[...(c.shared.sessions?D.sessions.map(s=>({...s,k:'pt'})):[]),...(cd.home||[]).map(r=>({id:r.id,date:r.date,training:r.data.training||'Eigen',k:'home'}))].sort((x,y)=>y.date.localeCompare(x.date));
 h+=`<div class="card"><h2>Mijn trainingen (${hist.length})</h2><div class="list">${hist.slice(0,30).map(s=>`<button class="item" ${s.k==='pt'?`data-s="${s.id}"`:''}><span>${s.k==='pt'?'🏋️':'🏠'} ${fmtD(s.date)} · ${esc(s.training)}<br><span class="sub">${s.k==='pt'?'met trainer':'thuis'}</span></span><span>${s.k==='pt'?'›':''}</span></button>`).join('')||'<p class="sub">Nog geen trainingen.</p>'}</div></div>`;
 a.innerHTML=h;$('#lg').onclick=()=>go('chome',{t:c.shared.plan?nextTraining(c,D.sessions.concat(home)):null});a.querySelectorAll('[data-s]').forEach(x=>x.onclick=()=>go('history',{id:x.dataset.s}))}
function chome(a,p){const c=D.clients[0];head('Thuistraining',true);const b=curBlock(c),cw=b&&bWeek(b,today()),W=cw&&b.weeks[cw-1];
 const ex=(p.t&&c.schema[p.t]||[]).map(e=>({n:swapName(b,cw||0,e.n),sets:Array.from({length:parseInt(W?.sets)||3},()=>({kg:null,reps:null}))}));const st={ex};
 const draw=()=>{a.innerHTML=`<div class="card"><label>Datum</label><input type="date" id="dt" value="${today()}"></div>${st.ex.map((e,i)=>`<div class="card"><h2>${esc(e.n)} <button class="info" data-info="${esc(e.n)}">i</button></h2>${e.sets.map((s,j)=>`<div class="row" style="margin-bottom:6px"><span class="sub" style="flex:0 0 22px">${j+1}</span><input inputmode="decimal" placeholder="kg" data-i="${i}" data-j="${j}" data-k="kg" value="${s.kg??''}"><input inputmode="numeric" placeholder="reps" data-i="${i}" data-j="${j}" data-k="reps" value="${s.reps??''}"></div>`).join('')}<div class="mini"><button data-add="${i}">+ set</button><button data-rm="${i}">− set</button></div></div>`).join('')}
 <div class="card"><button class="btn sec" id="ax">+ Oefening</button><label>Notitie</label><textarea id="nt"></textarea><button class="btn grn" id="sv">Opslaan</button></div>`;
  a.querySelectorAll('input[data-k]').forEach(x=>x.oninput=()=>{const v=x.value.replace(',','.');st.ex[x.dataset.i].sets[x.dataset.j][x.dataset.k]=v===''?null:+v});
  a.querySelectorAll('[data-add]').forEach(x=>x.onclick=()=>{st.ex[x.dataset.add].sets.push({kg:null,reps:null});draw()});a.querySelectorAll('[data-rm]').forEach(x=>x.onclick=()=>{st.ex[x.dataset.rm].sets.pop();draw()});
  $('#ax').onclick=()=>{const n=prompt('Naam oefening');if(n){st.ex.push({n,sets:[{kg:null,reps:null}]});draw()}};
  $('#sv').onclick=async()=>{const exs=st.ex.map(e=>({n:e.n,sets:e.sets.filter(s=>s.kg!=null||s.reps!=null)})).filter(e=>e.sets.length);if(!exs.length&&!$('#nt').value)return toast('Nog niets ingevuld');
   const ok=await cwrite('ptl_home_workouts',{id:uid(),client_id:c.id,date:$('#dt').value||today(),data:{training:p.t||'Eigen training',ex:exs,note:$('#nt').value}});toast(ok?'Opgeslagen':'Opgeslagen – wordt verstuurd zodra je online bent');history_back()}};draw()}
async function cProgress(a,c){head('Voortgang',false);const cd=await loadCdata(c.id);const B=cd.body||[];
 a.innerHTML=`<div class="card"><h2>Meting toevoegen</h2><div class="row"><div><label>Datum</label><input type="date" id="bd" value="${today()}"></div><div><label>Gewicht (kg)</label><input id="bk" inputmode="decimal"></div></div>
 <div class="row"><div><label>Taille (cm)</label><input id="bt" inputmode="decimal"></div><div><label>Heup (cm)</label><input id="bh" inputmode="decimal"></div></div><div class="row"><div><label>Borst (cm)</label><input id="bb" inputmode="decimal"></div><div><label>Vet %</label><input id="bv" inputmode="decimal"></div></div><button class="btn" id="bs">Opslaan</button></div>
 ${bodyCards(B)}${c.shared.sessions?'<div class="card"><button class="btn" id="pg">📈 Grafieken trainingen met trainer</button></div>':''}<div class="card"><h2>Thuistrainingen per week</h2><div id="hw"></div></div>`;bindBody(B);
 const wk={};(cd.home||[]).forEach(r=>{const m=mondayOf(r.date);wk[m]=(wk[m]||0)+1});const K=Object.keys(wk).sort();chartBox($('#hw'),{type:'bar',labels:K.map(dm),series:[{name:'Thuis',color:'#15803d',vals:K.map(k=>wk[k])}],yLabel:'aantal',xLabel:'week',intY:true,empty:'Nog geen thuistrainingen.'});
 const pg=$('#pg');if(pg)pg.onclick=()=>go('progress',{id:c.id});
 $('#bs').onclick=async()=>{const n=id=>{const v=$(id).value.replace(',','.');return v===''?null:+v};const d={kg:n('#bk'),taille:n('#bt'),heup:n('#bh'),borst:n('#bb'),vet:n('#bv')};if(Object.values(d).every(v=>v==null))return toast('Vul iets in');
  const date=$('#bd').value||today();await cwrite('ptl_body',{id:c.id+'_'+date,client_id:c.id,date,data:d});toast('Opgeslagen');render()}}
async function cCheckin(a,c){head('Check-in',false);const cd=await loadCdata(c.id);const t=today();const C=cd.checkins||[];const cur0=(C.find(r=>r.date===t)||{data:{}}).data;
 let streak=0;for(let d=t;C.some(r=>r.date===d);d=addD(d,-1))streak++;
 const sc=(k,l)=>`<label>${l}</label><div class="score" data-k="${k}">${[...Array(10)].map((_,i)=>`<button class="${cur0[k]===i+1?'on':''}">${i+1}</button>`).join('')}</div>`;
 a.innerHTML=`<div class="card"><h2>Vandaag, ${fmtD(t)}</h2><p class="sub">${streak?'🔥 '+streak+' dag(en) op rij ingecheckt':'Nog niet ingecheckt vandaag'}</p>
 ${HAB.map(([k,l,i])=>`<label style="display:flex;gap:10px;align-items:center;font-size:17px;color:var(--t)"><input type="checkbox" data-h="${k}" style="width:24px;height:24px" ${cur0[k]?'checked':''}>${i} ${l}</label>`).join('')}
 <label>Slaap (uren)</label><input id="sl" inputmode="decimal" value="${cur0.slaap??''}">${sc('energie','Energie (1-10)')}${sc('stress','Stress (1-10)')}<label>Hoe gaat het?</label><textarea id="no">${esc(cur0.note||'')}</textarea><button class="btn grn" id="sv">Check-in opslaan</button></div>${checkinCards(C)}`;
 const d={...cur0};a.querySelectorAll('.score').forEach(s=>s.querySelectorAll('button').forEach((b,i)=>b.onclick=()=>{d[s.dataset.k]=i+1;s.querySelectorAll('button').forEach((x,j)=>x.classList.toggle('on',j===i))}));
 $('#sv').onclick=async()=>{a.querySelectorAll('[data-h]').forEach(x=>d[x.dataset.h]=x.checked);const v=$('#sl').value.replace(',','.');d.slaap=v===''?null:+v;d.note=$('#no').value;
  await cwrite('ptl_checkins',{id:c.id+'_'+t,client_id:c.id,date:t,data:d});toast('Check-in opgeslagen');render()}}
async function cShop(a,c){head('Winkel',false);if(navigator.onLine&&S.reloadClient&&!cShop._r){cShop._r=1;await S.reloadClient();cShop._r=0;return}
 const pays=D.payments||[];const t=today();
 a.innerHTML=`<div class="card"><h2>Sessies kopen</h2><p class="sub">Betaal veilig met iDEAL, Bancontact of creditcard. Je strippen worden direct na betaling bijgeschreven.</p>
 ${(D.products||[]).map(p=>`<div class="sch"><span>${esc(p.name)}<br><span class="sub">${p.strips} sessie${p.strips===1?'':'s'}${p.description?' · '+esc(p.description):''}</span></span><button class="btn" style="width:auto;margin:0;padding:10px 14px;background:var(--b);color:#fff;height:auto" data-buy="${p.id}">${eur(p.price_cents)}</button></div>`).join('')||'<p class="sub">Er zijn nog geen producten.</p>'}</div>
 <div class="card"><h2>Mijn betalingen</h2>${pays.map(p=>`<div class="sch"><span>${esc(p.description.split(' – ')[0])}<br><span class="sub">${fmtD((p.paid_at||p.created_at).slice(0,10))}${p.invoice_no?' · '+esc(p.invoice_no):''}</span></span><span style="flex:0 0 auto">${eur(p.amount_cents)}<br><span class="sub">${p.status==='paid'?'✅ betaald':esc(p.status)}</span></span></div>`).join('')||'<p class="sub">Nog geen betalingen.</p>'}</div>
 <div class="card"><button class="btn sec" id="acc">Account</button></div>`;
 $('#acc').onclick=()=>go('cloud');
 a.querySelectorAll('[data-buy]').forEach(b=>b.onclick=async()=>{if(!navigator.onLine)return toast('Je bent offline');b.disabled=true;
  let data;try{const {data:ss}=await S.sb.auth.getSession();const r=await fetch(SB_URL+'/functions/v1/pay-create',{method:'POST',headers:{'Content-Type':'application/json',apikey:SB_ANON,Authorization:'Bearer '+ss.session.access_token,...(S.simHeader?{'x-ptl-sim':S.simHeader}:{})},body:JSON.stringify({product_id:b.dataset.buy})});
   data=await r.json();if(!r.ok)throw new Error(data.error||('Fout '+r.status))}catch(e){b.disabled=false;alert('Betalen lukt nu niet: '+e.message);return}b.disabled=false;
  if(data.mollie_id&&data.mollie_id.startsWith('tr_sim_')){setCur({v:'cpay',p:{id:data.payment_id}});render()}else location.href=data.checkoutUrl})}
async function cpay(a,p){head('Betaling',true);a.innerHTML='<div class="card"><h2>Betaling controleren…</h2><p class="sub">Even geduld.</p></div>';
 for(let i=0;i<10;i++){const {data}=await S.sb.from('ptl_payments').select('*').eq('id',p.id).maybeSingle();if(data&&data.status!=='open'&&data.status!=='pending'||i===9){
  a.innerHTML=`<div class="card"><h2>${data?.status==='paid'?'✅ Betaald, bedankt!':data?'Betaling '+esc(data.status):'Betaling niet gevonden'}</h2>${data?`<p>${esc(data.description)}<br>${eur(data.amount_cents)}${data.status==='paid'&&data.strips?'<br><b>'+data.strips+' strippen bijgeschreven</b>':''}</p>`:''}${data&&data.status!=='paid'?'<p class="sub">Is de betaling nog bezig? Kijk straks opnieuw bij Winkel.</p>':''}<button class="btn" id="ok">Naar winkel</button></div>`;
  $('#ok').onclick=()=>{setStack([]);setCur({v:'cview',p:{tab:'winkel'}});render()};return}await new Promise(r=>setTimeout(r,1500))}}

Object.assign(extraViews,{cloud,cview,library,exEdit,programs,progEdit,payments,clientData,chat,chome,cpay});
