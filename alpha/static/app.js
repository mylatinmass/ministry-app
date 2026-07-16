const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let role='public', state={}, substituteAssignment=null, calendarView='month';
const calendarAnchor=new Date('2026-07-19T12:00:00');
const api=async(path,options={})=>{const response=await fetch(path,{...options,headers:{'Content-Type':'application/json','X-Demo-Role':role,...options.headers}});const body=await response.json();if(!response.ok)throw new Error(body.error||'Request failed');return body};
const toast=message=>{const el=$('#toast');el.textContent=message;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)};
const assignmentFor=id=>state.assignments.find(a=>a.service_id===id);
const fmt=date=>new Date(date+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const timeValue=value=>{const match=value.match(/(\d+):(\d+)\s*(am|pm)/i);if(!match)return 9999;let hour=+match[1]%12;if(match[3].toLowerCase()==='pm')hour+=12;return hour*60+(+match[2])};
const dateKey=value=>{const y=value.getFullYear(),m=String(value.getMonth()+1).padStart(2,'0'),d=String(value.getDate()).padStart(2,'0');return `${y}-${m}-${d}`};
const serviceMarkup=s=>{const a=assignmentFor(s.id);return `<div class="calendar-event"><time>${s.service_time}</time><strong>${s.title}</strong>${role!=='public'&&a?`<span class="event-staff ${a.status.replaceAll(' ','-')}">${a.person_name||'Open'}</span>`:''}</div>`};
function renderCalendar(grouped){
 const target=$('#calendar-list');
 if(calendarView==='month'){
   $('#calendar-title').textContent='July 2026';
   const first=new Date(2026,6,1,12), last=new Date(2026,7,0,12), cells=[];
   for(let i=0;i<first.getDay();i++)cells.push('<div class="month-cell muted"></div>');
   for(let day=1;day<=last.getDate();day++){const key=`2026-07-${String(day).padStart(2,'0')}`,items=grouped[key]||[];cells.push(`<article class="month-cell ${key===dateKey(calendarAnchor)?'selected-day':''}"><b>${day}</b><div>${items.map(serviceMarkup).join('')}</div></article>`)}
   target.className='month-grid';target.innerHTML='<div class="weekday">Sun</div><div class="weekday">Mon</div><div class="weekday">Tue</div><div class="weekday">Wed</div><div class="weekday">Thu</div><div class="weekday">Fri</div><div class="weekday">Sat</div>'+cells.join('');
 } else if(calendarView==='week'){
   const start=new Date(calendarAnchor);start.setDate(start.getDate()-start.getDay());const days=[];
   for(let i=0;i<7;i++){const date=new Date(start);date.setDate(start.getDate()+i);const key=dateKey(date),items=grouped[key]||[];days.push(`<article class="week-day ${key===dateKey(calendarAnchor)?'selected-day':''}"><header><b>${date.toLocaleDateString('en-US',{weekday:'short'})}</b><span>${date.getDate()}</span></header><div>${items.length?items.map(serviceMarkup).join(''):'<small class="no-events">No public services</small>'}</div></article>`)}
   const end=new Date(start);end.setDate(start.getDate()+6);$('#calendar-title').textContent=`${start.toLocaleDateString('en-US',{month:'short',day:'numeric'})}–${end.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}`;target.className='week-grid';target.innerHTML=days.join('');
 } else {
   const key=dateKey(calendarAnchor),items=grouped[key]||[];$('#calendar-title').textContent=calendarAnchor.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});target.className='day-agenda';target.innerHTML=`<article class="day-focus"><div class="day-focus-date"><b>${calendarAnchor.getDate()}</b><span>${calendarAnchor.toLocaleDateString('en-US',{weekday:'long',month:'long'})}</span></div><div>${items.length?items.map(s=>`<div class="agenda-event">${serviceMarkup(s)}<small>${s.liturgical_day||''}</small></div>`).join(''):'<div class="empty">No public services</div>'}</div></article>`;
 }
}
async function load(){state=await api('/api/state?role='+role);render()}
function render(){
 document.body.dataset.role=role;
 $('#view-copy').textContent=role==='public'?'Anyone may view services. Volunteer names, openings, messages, and restricted records are absent from the server response.':role==='volunteer'?'The same calendar now adds only Michael’s approved ministry information.':role==='leader'?'The leader sees sacristan openings, assignments, and actionable staffing health.':'The administrator sees sources, operations, and an auditable change history.';
 $('#refresh').hidden=role!=='admin';
 $$('.member').forEach(x=>x.hidden===undefined?null:x.hidden=role==='public'); $$('.leader').forEach(x=>x.hidden=!['leader','admin'].includes(role)); $$('.admin').forEach(x=>x.hidden=role!=='admin');
 const grouped={}; state.services.filter(s=>!s.cancelled).forEach(s=>(grouped[s.service_date]??=[]).push(s)); Object.values(grouped).forEach(items=>items.sort((a,b)=>timeValue(a.service_time)-timeValue(b.service_time)));
 renderCalendar(grouped);
 const mine=state.assignments.filter(a=>a.person_id===1);
 const pendingMine=mine.filter(a=>a.status==='pending');
 const review=pendingMine.length?`<article class="card"><div><span class="pill pending">WEEKLY REVIEW</span><h3>${pendingMine.length} new assignment${pendingMine.length===1?'':'s'} to review</h3><p>Confirm them together, or handle exceptions below.</p></div><button onclick="confirmAll()">✓ Confirm all</button></article>`:'';
 $('#my-list').innerHTML=mine.length?review+mine.map(a=>`<article class="card"><div><span class="pill ${a.status.replaceAll(' ','-')}">${a.status==='pending'?'Needs review':a.status}</span><h3>${fmt(a.service_date)} · ${a.service_time}</h3><p>${a.title} · Sacristan</p></div><div>${a.status==='pending'?`<button onclick="confirmAssignment(${a.id})">✓ Confirm</button>`:''}<button class="secondary" onclick="openSub(${a.id})">I can't serve</button></div></article>`).join(''):'<div class="empty">No assignments for this demonstration role.</div>';
 const staffed=state.assignments.filter(a=>a.person_id&&a.status!=='substitute requested').length, pending=state.assignments.filter(a=>a.status==='pending'||a.status==='substitute requested').length, open=state.assignments.filter(a=>a.status==='open').length;
 if($('#stats')) $('#stats').innerHTML=`<article class="green"><b>${staffed}</b><span>Ready</span></article><article class="yellow"><b>${pending}</b><span>Needs attention</span></article><article class="red"><b>${open}</b><span>Open positions</span></article>`;
 if($('#staffing-list')) $('#staffing-list').innerHTML=state.assignments.map(a=>`<article class="card compact"><div><span class="signal ${a.status==='open'?'red':a.status==='confirmed'?'green':'yellow'}"></span><div><h3>${fmt(a.service_date)} · ${a.service_time}</h3><p>${a.title}</p></div></div><span class="pill ${a.status.replaceAll(' ','-')}">${a.person_name||'Sacristan needed'} · ${a.status}</span></article>`).join('');
 $('#outbox').innerHTML=state.outbox.length?state.outbox.map(m=>`<article class="card"><div><span class="pill">${m.channel}</span><h3>${m.recipient}</h3><p>${m.subject}</p></div><small>${m.status}</small></article>`).join(''):'<div class="empty">No messages queued. Request a substitute to create one.</div>';
 $('#audit-list').innerHTML=state.audit.length?state.audit.map(a=>`<article class="card"><div><h3>${a.action}</h3><p>${a.actor} · ${a.detail}</p></div><small>${a.created_at.replace('T',' ')}</small></article>`).join(''):'<div class="empty">Actions will appear here.</div>';
 if(role==='admin'){const t=state.telegram||{};$('#telegram-state').innerHTML=t.configured?`<div class="telegram-connected"><b>Connected${t.bot_username?' as @'+t.bot_username:''}</b><span>${t.status} · ${t.linked_testers} linked tester${t.linked_testers===1?'':'s'}</span></div>`:`<div class="telegram-waiting"><b>Not connected</b><span>Your token has not been stored on this Mac.</span></div>`;$('#telegram-form').hidden=!!t.configured;$('#disconnect-telegram').hidden=!t.configured}
 if(state.imports.length){const latest=state.imports[0];$('#source-status').textContent=`${latest.source}: ${latest.status} · ${latest.detail}`}
}
window.openSub=id=>{substituteAssignment=id;const qualified=state.people.filter(p=>p.qualified&&p.id!==1);$('#candidates').innerHTML=qualified.map((p,i)=>`<label class="candidate"><input type="radio" name="candidate" value="${p.id}" ${i===0?'checked':''}><span><b>${p.name}</b><small>Qualified sacristan · available</small></span></label>`).join('');$('#sub-dialog').showModal()};
window.confirmAssignment=async id=>{try{await api(`/api/assignments/${id}/confirm`,{method:'POST',body:'{}'});toast('Assignment confirmed.');await load()}catch(e){toast(e.message)}};
window.confirmAll=async()=>{try{await api('/api/assignments/confirm-all',{method:'POST',body:'{}'});toast('All new assignments confirmed together.');await load()}catch(e){toast(e.message)}};
$('#send-sub').onclick=async()=>{const selected=$('input[name=candidate]:checked');if(!selected)return;try{await api(`/api/assignments/${substituteAssignment}/substitute`,{method:'POST',body:JSON.stringify({candidate_id:+selected.value})});$('#sub-dialog').close();toast('Private request queued. Michael remains assigned.');await load()}catch(e){toast(e.message)}};
$('#role').onchange=async e=>{role=e.target.value;const firstVisible=$('nav button:not([hidden])');if($('.tab:not([hidden])').id!=='calendar'&&firstVisible)showTab('calendar');await load()};
function showTab(id){$$('.tab').forEach(x=>x.hidden=x.id!==id);$$('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===id))}
$$('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$$('[data-calendar-view]').forEach(button=>button.onclick=()=>{calendarView=button.dataset.calendarView;$$('[data-calendar-view]').forEach(item=>item.classList.toggle('active',item===button));render()});
$('#refresh').onclick=async()=>{try{$('#source-status').textContent='Refreshing…';await api('/api/imports/refresh',{method:'POST',body:'{}'});toast('Public sources refreshed; changes remain reviewable.');await load()}catch(e){toast(e.message)}};
$('#add-service').onclick=()=>$('#service-dialog').showModal();
$$('#service-dialog .close, #service-dialog .close-action').forEach(b=>b.onclick=()=>$('#service-dialog').close());
$('#service-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/api/services',{method:'POST',body:JSON.stringify({date:f.get('date'),time:f.get('time'),title:f.get('title'),needs_sacristan:!!f.get('needs_sacristan')})});$('#service-dialog').close();toast('Service and sacristan opening created.');await load()}catch(err){toast(err.message)}};
$('#reset').onclick=async()=>{if(!confirm('Restore the fictional alpha data?'))return;await api('/api/reset',{method:'POST',body:'{}'});toast('Alpha restored.');await load()};
$('#telegram-form').onsubmit=async e=>{e.preventDefault();const token=$('#telegram-token').value.trim();try{await api('/api/telegram/config',{method:'POST',body:JSON.stringify({token})});$('#telegram-token').value='';toast('Telegram bot connected. Return to its chat on your phone or Mac.');await load()}catch(err){toast(err.message)}};
$('#disconnect-telegram').onclick=async()=>{try{await api('/api/telegram/disconnect',{method:'POST',body:'{}'});toast('Telegram token deleted from this Mac.');await load()}catch(err){toast(err.message)}};
load();
