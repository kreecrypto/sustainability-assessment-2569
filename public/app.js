'use strict';
const TOPICS=[
'การบริหารห่วงโซ่อุปทานอย่างยั่งยืน',
'คุณภาพสินค้า บริการ และความรับผิดชอบต่อลูกค้า',
'ธรรมาภิบาล จริยธรรม และความโปร่งใส',
'นวัตกรรมและการเปลี่ยนผ่านสู่ธุรกิจที่ยั่งยืน',
'การพัฒนาและดูแลพนักงาน',
'สิทธิมนุษยชน ความปลอดภัยและอาชีวอนามัย',
'การพัฒนาชุมชนและสังคม',
'การบริหารจัดการสิ่งแวดล้อมและการเปลี่ยนแปลงสภาพภูมิอากาศ',
'ความมั่นคงปลอดภัยทางไซเบอร์ ข้อมูล และความเป็นส่วนตัว',
'การบริหารความเสี่ยงและความต่อเนื่องทางธุรกิจ'
];
const state={view:new URLSearchParams(location.search).get('view')==='dashboard'?'dashboard':'vote',demo:new URLSearchParams(location.search).get('demo')==='1',votes:{},stats:null,ready:false,error:'',saving:new Set(),last:null,isOpen:true,resetGeneration:null,adminOpen:false,resetConfirmOpen:false,resetLoading:false};
const app=document.getElementById('app');
const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const pad=(x)=>String(x).padStart(2,'0');
const fmt=(v)=>v==null?'–':Number(v).toFixed(2);
let toastTimeout=null;
function toast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),3000);}
function demoStats(){const fake=TOPICS.map((_,i)=>({topic_id:i+1,necessity_avg:[3.1,4.0,4.8,4.1,3.8,4.2,3.4,4.7,4.8,4.5][i],complexity_avg:[3.3,2.7,2.9,4.1,3.0,3.5,2.3,4.5,4.4,3.7][i],vote_count:12}));return {stats:fake,overview:{total_participants:12,completed_participants:12,total_votes:120},is_open:true,reset_generation:0};}
async function api(path,options){
  const response=await fetch('/api/'+path,{credentials:'same-origin',cache:'no-store',...options});
  let result;try{result=await response.json();}catch{throw new Error('ไม่สามารถอ่านข้อมูลจากเซิร์ฟเวอร์ได้');}
  if(!response.ok)throw new Error(result.error||'เกิดข้อผิดพลาดในการเชื่อมต่อ');
  return result;
}
function heading(){return '<section class="hero"><div class="eyebrow">EXECUTIVE SUSTAINABILITY WORKSHOP / FY 2569</div><h1>ประเมินประเด็นความสำคัญด้านความยั่งยืน</h1><p class="muted">ประจำปี 2569 · ประเมิน 10 ประเด็น ด้วยเกณฑ์ Necessity และ Complexity อย่างละ 1–5 คะแนน</p></section>';}
function notice(){return state.error?'<div class="notice error">'+esc(state.error)+'</div>':state.demo?'<div class="notice">ข้อมูลสาธิตเท่านั้น — คะแนนทั้งหมดเป็นข้อมูลจำลอง และไม่ได้บันทึกลงฐานข้อมูลจริง</div>':'';}
function updateTabs(){
  $('tab-vote').classList.toggle('active',state.view==='vote');
  $('tab-dashboard').classList.toggle('active',state.view==='dashboard');
  $('demo-badge').hidden=!state.demo;
}
function switchView(view){
  state.view=view;const params=new URLSearchParams(location.search);params.set('view',view);
  history.replaceState({},'',location.pathname+'?'+params.toString());
  updateTabs();render();window.scrollTo({top:0,behavior:'smooth'});
}
$('tab-vote').addEventListener('click',()=>switchView('vote'));
$('tab-dashboard').addEventListener('click',()=>switchView('dashboard'));
function countComplete(){return TOPICS.filter((_,i)=>{const v=state.votes[i+1];return v&&v.saved&&v.necessity&&v.complexity;}).length;}
function voteCard(topic,i){
 const id=i+1,v=state.votes[id]||{},saved=v.saved||false,working=state.saving.has(id),partial=!!(v.necessity||v.complexity);
 function scale(name,label){
  return '<div><div class="criteria-label">'+label+' <small>(1–5)</small></div><div class="scale '+(name==='complexity'?'complex':'')+'">'+
  [1,2,3,4,5].map(n=>'<button type="button" aria-label="ประเด็น '+id+' '+label+' ระดับ '+n+' จาก 5" aria-pressed="'+(v[name]===n)+'" data-topic="'+id+'" data-criterion="'+name+'" data-score="'+n+'" class="'+(v[name]===n?'selected':'')+'" '+(!state.isOpen||state.saving.has(id)?'disabled':'')+'>'+n+'</button>').join('')+
  '</div><div class="helptext"><span>ต่ำมาก</span><span>สูงมาก</span></div></div>';
 }
 return '<article class="card panel topic-card '+(saved?'saved':'')+'" id="topic-'+id+'"><div class="topic-head"><span class="topic-no">'+pad(id)+'</span><h2 id="topic-title-'+id+'">'+esc(topic)+'</h2><span class="saved-icon '+(working?'saving-indicator':saved?'saved-indicator':'pending-indicator')+'" role="status">'+(working?'กำลังบันทึก…':saved?'✓ บันทึกแล้ว':partial?'ยังไม่บันทึก':'รอประเมิน')+'</span></div><div class="criteria">'+scale('necessity','Necessity · ความจำเป็น')+scale('complexity','Complexity · ความซับซ้อน')+'</div></article>';
}
function renderVote(focus){
 const completed=countComplete();
 const html=heading()+notice()+(state.isOpen?'':'<div class="notice">ปิดรับคะแนนแล้ว ท่านสามารถดูคะแนนที่เคยส่งได้</div>')+
 '<div class="vote-guide"><div class="guide-pill"><span class="guide-dot"></span><strong>Necessity</strong> ความจำเป็นต่อความยั่งยืน</div><div class="guide-pill"><span class="guide-dot warm"></span><strong>Complexity</strong> ความซับซ้อนในการดำเนินการ</div><div class="guide-pill">1 = ต่ำมาก · 5 = สูงมาก</div></div>'+
 '<div class="vote-layout"><div class="vote-list">'+TOPICS.map(voteCard).join('')+
 '<div class="notice success">คะแนนจะบันทึกอัตโนมัติเมื่อเลือกครบทั้ง Necessity และ Complexity ในแต่ละประเด็น สามารถกลับมาเปลี่ยนคะแนนได้ระหว่างเปิดรับคะแนน</div></div>'+
 '<aside class="card panel progress-card"><div class="eyebrow">YOUR PROGRESS</div><div class="progress-number">'+completed+' <small style="font-size:16px">/ 10 ประเด็น</small></div><div class="progress-track"><div class="progress-fill" style="width:'+(completed*10)+'%"></div></div><p class="footnote">'+(completed===10?'ให้คะแนนครบทั้ง 10 ประเด็นแล้ว ขอบคุณสำหรับการประเมิน':'เลือกคะแนนสองด้านให้ครบในแต่ละประเด็น เพื่อบันทึก')+'</p><button class="btn primary" data-view="dashboard">ดูผลประเมินสด</button><p class="footnote">1 เบราว์เซอร์ = 1 เซสชัน ไม่ใช่การยืนยันตัวตนของผู้บริหาร</p></aside></div>';
 app.innerHTML=html;
 if(focus&&typeof app.querySelector==='function'){
  const selector='[data-topic="'+focus.id+'"][data-criterion="'+focus.criterion+'"][data-score="'+focus.score+'"]';
  app.querySelector(selector)?.focus({preventScroll:true});
 }
}
async function castVote(button){
 const id=Number(button.dataset.topic),criterion=button.dataset.criterion,score=Number(button.dataset.score);
 if(!state.isOpen)return toast('ปิดรับคะแนนแล้ว');
 const previous=state.votes[id]||{},next={...previous,[criterion]:score,saved:false};
 state.votes[id]=next;renderVote({id,criterion,score});
 if(!(next.necessity&&next.complexity))return;
 if(state.demo){state.votes[id].saved=true;renderVote();return toast('บันทึกคะแนนจำลองแล้ว');}
 if(state.saving.has(id))return;
 state.saving.add(id);renderVote();
 try {
  await api('vote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({topic_id:id,necessity:next.necessity,complexity:next.complexity,reset_generation:state.resetGeneration})});
  state.votes[id].saved=true;toast('บันทึกคะแนนประเด็นที่ '+id+' แล้ว');
 }catch(error){state.votes[id].saved=false;toast(error.message);if(/ปิดรับ/.test(error.message))state.isOpen=false;if(/รีเซ็ต/.test(error.message))refresh();}
 finally{state.saving.delete(id);renderVote();}
}
function tableBar(value,complexity){const n=Math.max(0,Math.min(100,(Number(value||0)/5)*100));return '<span class="bar-track"><span class="bar-fill '+(complexity?'complex':'')+'" style="display:block;width:'+n+'%"></span></span>';}
function prepareRows(){
 const records=state.stats?.stats||[];
 return records.map((item,i)=>({id:Number(item.topic_id||i+1),topic:TOPICS[Number(item.topic_id||i+1)-1],necessity:Number(item.necessity_avg||0),complexity:Number(item.complexity_avg||0),count:Number(item.vote_count||0)}));
}
function makeMatrix(rows){
 const W=740,H=500,left=76,right=690,top=43,bottom=421;
 let svg='<svg class="matrix" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="กราฟ Necessity แกนนอน และ Complexity แกนตั้ง ช่วงคะแนน 1 ถึง 5">';
 const x=n=>left+(n-1)*(right-left)/4,y=n=>bottom-(n-1)*(bottom-top)/4;
 svg+='<rect x="'+left+'" y="'+top+'" width="'+(x(3)-left)+'" height="'+(y(3)-top)+'" fill="#f3f5f4"/><rect x="'+x(3)+'" y="'+top+'" width="'+(right-x(3))+'" height="'+(y(3)-top)+'" fill="#f8f2e6"/><rect x="'+left+'" y="'+y(3)+'" width="'+(x(3)-left)+'" height="'+(bottom-y(3))+'" fill="#f1f5f3"/><rect x="'+x(3)+'" y="'+y(3)+'" width="'+(right-x(3))+'" height="'+(bottom-y(3))+'" fill="#e9f6f1"/>';
 for(let i=1;i<=5;i++){
  svg+='<line x1="'+x(i)+'" y1="'+top+'" x2="'+x(i)+'" y2="'+bottom+'" stroke="#dbe7e2" stroke-width="1"/>';
  svg+='<line x1="'+left+'" y1="'+y(i)+'" x2="'+right+'" y2="'+y(i)+'" stroke="#dbe7e2" stroke-width="1"/>';
  svg+='<text x="'+x(i)+'" y="'+(bottom+22)+'" text-anchor="middle" fill="#7b9790" font-size="12">'+i+'</text>';
  svg+='<text x="'+(left-16)+'" y="'+(y(i)+4)+'" text-anchor="end" fill="#7b9790" font-size="12">'+i+'</text>';
 }
 svg+='<line x1="'+x(3)+'" y1="'+top+'" x2="'+x(3)+'" y2="'+bottom+'" stroke="#9bb5ac" stroke-dasharray="5 5"/>';
 svg+='<line x1="'+left+'" y1="'+y(3)+'" x2="'+right+'" y2="'+y(3)+'" stroke="#9bb5ac" stroke-dasharray="5 5"/>';
 svg+='<text x="'+(left+10)+'" y="'+(top+20)+'" fill="#869c95" font-size="12" font-weight="700">ซับซ้อนสูง / จำเป็นต่ำ</text>';
 svg+='<text x="'+(x(3)+10)+'" y="'+(top+20)+'" fill="#a5834e" font-size="12" font-weight="700">ซับซ้อนสูง / จำเป็นสูง</text>';
 svg+='<text x="'+(left+10)+'" y="'+(y(3)+20)+'" fill="#899e96" font-size="12" font-weight="700">ซับซ้อนต่ำ / จำเป็นต่ำ</text>';
 svg+='<text x="'+(x(3)+10)+'" y="'+(y(3)+20)+'" fill="#488871" font-size="12" font-weight="700">ซับซ้อนต่ำ / จำเป็นสูง</text>';
 const shown=rows.filter(r=>r.count>0);
 shown.forEach((r,idx)=>{
  const xx=x(r.necessity),yy=y(r.complexity),near=shown.filter(z=>Math.abs(x(z.necessity)-xx)<28&&Math.abs(y(z.complexity)-yy)<28);
  const offset=near.findIndex(z=>z.id===r.id),shift=near.length>1?(offset-(near.length-1)/2)*20:0;
  svg+='<g><title>'+esc(pad(r.id)+' '+r.topic+' · '+fmt(r.necessity)+' / '+fmt(r.complexity))+'</title><circle cx="'+(xx+shift)+'" cy="'+yy+'" r="16" fill="#0d7161" stroke="white" stroke-width="3"/><text x="'+(xx+shift)+'" y="'+(yy+4)+'" text-anchor="middle" fill="white" font-size="11" font-weight="800">'+pad(r.id)+'</text></g>';
 });
 svg+='<text x="'+((left+right)/2)+'" y="'+(H-27)+'" fill="#286b60" text-anchor="middle" font-size="13" font-weight="700">Necessity (ความจำเป็น) →</text>';
 svg+='<text transform="translate(17 '+((top+bottom)/2)+') rotate(-90)" text-anchor="middle" fill="#286b60" font-size="13" font-weight="700">Complexity (ความซับซ้อน) →</text></svg>';
 return svg;
}
function renderDashboard(){
 const adminDraft=$('admin-code')?.value||'';
 const resetDraft=$('reset-phrase')?.value||'';
 const payload=state.stats||{stats:[],overview:{total_participants:0,completed_participants:0,total_votes:0},is_open:true};
 const rows=prepareRows(),person=payload.overview||{},n=rows.filter(x=>x.count).length;
 const averageNec=n?rows.reduce((s,x)=>s+(x.count?x.necessity:0),0)/n:0;
 const averageCom=n?rows.reduce((s,x)=>s+(x.count?x.complexity:0),0)/n:0;
 const statCards=[['ผู้เข้าร่วมให้คะแนน',person.total_participants||0,'ผู้ที่บันทึกอย่างน้อย 1 ประเด็น'],['ประเมินครบ 10 ประเด็น',person.completed_participants||0,'จาก '+(person.total_participants||0)+' ผู้เข้าร่วม'],['Necessity เฉลี่ย',n?fmt(averageNec):'–','เฉลี่ยเท่ากันทั้ง 10 ประเด็น'],['Complexity เฉลี่ย',n?fmt(averageCom):'–','เฉลี่ยเท่ากันทั้ง 10 ประเด็น']];
 const top=[...rows].filter(r=>r.count).sort((a,b)=>b.necessity-a.necessity||a.id-b.id).slice(0,5);
 app.innerHTML=heading()+notice()+
 '<div class="toolbar" style="margin-bottom:16px"><span class="muted" style="font-size:12px"><span class="pulse"></span>อัปเดตล่าสุด '+(state.last?state.last.toLocaleTimeString('th-TH'):'กำลังรอข้อมูล')+' · '+(payload.is_open?'กำลังเปิดรับคะแนน':'ปิดรับคะแนน')+'</span><div class="actions"><button class="btn" data-copy="vote">คัดลอกลิงก์ประเมิน</button><button class="btn" data-copy="dashboard">คัดลอกลิงก์ Dashboard</button><button class="btn" data-refresh="1">⟳ รีเฟรช</button><button class="btn primary" data-export="1">↓ Export CSV</button><button class="btn dashboard-reset-btn" type="button" data-reset-open>↻ Reset Dashboard</button></div></div>'+
 '<section class="stat-grid">'+statCards.map((s,i)=>'<article class="card panel stat-card"><div class="stat-label">'+s[0]+'</div><div class="stat-value '+(i>1?'em':'')+'">'+s[1]+'</div><div class="stat-note">'+s[2]+'</div></article>').join('')+'</section>'+
 '<div class="main-grid"><section class="card panel panel-inner"><div class="section-head"><h2>Necessity × Complexity Matrix</h2><p>ค่าเฉลี่ย 1–5 ของแต่ละประเด็น · หนึ่งจุดต่อหนึ่งประเด็น (01–10)</p></div>'+makeMatrix(rows)+'<div class="legend"><span>หมายเลขแสดงรหัสประเด็น 10 ประเด็น</span></div></section>'+
 '<aside class="card panel panel-inner"><div class="section-head"><h2>ประเด็น Necessity สูงสุด</h2><p>เรียงจากค่าเฉลี่ยความจำเป็น ไม่ใช่คะแนนรวมของสองด้าน</p></div><div class="ranking">'+(top.length?top.map(r=>'<div class="rank-item"><span class="rank-no">'+pad(r.id)+'</span><span class="rank-title">'+esc(r.topic)+'</span><span class="rank-score">'+fmt(r.necessity)+' / 5</span></div>').join(''):'<div class="empty">ยังไม่มีคะแนนประเมินจริง</div>')+'</div>'+
 '<div class="admin-box" id="admin-tools"><button type="button" class="admin-toggle" data-admin-toggle aria-expanded="'+state.adminOpen+'" aria-controls="admin-actions"><span>⚙ &nbsp; จัดการรอบการประเมิน</span><span aria-hidden="true">'+(state.adminOpen?'▴':'▾')+'</span></button><div class="admin-actions" id="admin-actions" '+(state.adminOpen?'':'hidden')+'><p class="footnote">เฉพาะผู้ดำเนินการประชุม · ทุกคำสั่งต้องใช้รหัสผู้ดูแล</p><label class="admin-label" for="admin-code">รหัสผู้ดูแล</label><input type="password" id="admin-code" autocomplete="off" placeholder="กรอกรหัสผู้ดูแล"><button class="btn admin-control-btn" type="button" data-control="'+(payload.is_open?'close':'open')+'">'+(payload.is_open?'ปิดรับคะแนน':'เปิดรับคะแนน')+'</button><div class="admin-divider"></div><button class="btn reset-start" type="button" data-reset-open '+(state.demo?'disabled':'')+'>↻ Reset Dashboard</button><p class="reset-hint">ล้างผลประเมินทั้งหมดเพื่อเริ่มรอบใหม่ ไม่ใช่การรีเฟรชข้อมูล</p><div id="reset-confirm" class="reset-confirm" '+(state.resetConfirmOpen?'':'hidden')+' role="group" aria-label="ยืนยันการรีเซ็ตคะแนน"><strong class="reset-title">ล้างคะแนนทั้งหมด?</strong><p>การดำเนินการนี้จะลบคะแนนที่บันทึกไว้ทั้งหมดและปิดรับคะแนนทันที ไม่สามารถย้อนกลับได้</p><p>แนะนำให้ <button type="button" class="text-action" data-export="1">Export CSV</button> เก็บผลก่อนดำเนินการ</p><label for="reset-phrase" class="admin-label">พิมพ์ <strong>RESET 2569</strong> เพื่อยืนยัน</label><input type="text" id="reset-phrase" spellcheck="false" autocomplete="off" placeholder="RESET 2569"><div class="reset-actions"><button class="btn" type="button" data-reset-cancel>ยกเลิก</button><button class="btn reset-danger" type="button" id="reset-action" data-reset-apply disabled>'+(state.resetLoading?'กำลังล้างคะแนน…':'ยืนยันล้างคะแนนทั้งหมด')+'</button></div></div></div></div></aside></div>'+
 '<section class="card panel panel-inner table-panel"><div class="section-head"><h2>คะแนนประเมินรายประเด็น (10 ประเด็น)</h2><p>คะแนนเฉลี่ยของแต่ละด้านจากผู้เข้าร่วมที่ให้คะแนนประเด็นนั้น ๆ · ไม่บวกหรือถ่วงน้ำหนัก</p></div><div class="table-wrap"><table class="table"><thead><tr><th>ประเด็นความยั่งยืน</th><th>Necessity</th><th>สเกล 1–5</th><th>Complexity</th><th>สเกล 1–5</th><th>ผู้ให้คะแนน</th></tr></thead><tbody>'+
 [...rows].sort((a,b)=>b.necessity-a.necessity||a.id-b.id).map(r=>'<tr><td>'+pad(r.id)+' &nbsp;'+esc(r.topic)+'</td><td><strong>'+(r.count?fmt(r.necessity):'–')+'</strong></td><td>'+tableBar(r.necessity,false)+'</td><td><strong>'+(r.count?fmt(r.complexity):'–')+'</strong></td><td>'+tableBar(r.complexity,true)+'</td><td>'+r.count+'</td></tr>').join('')+
 '</tbody></table></div></section>';
 if($('admin-code'))$('admin-code').value=adminDraft;
 if($('reset-phrase')){$('reset-phrase').value=resetDraft;if($('reset-action'))$('reset-action').disabled=state.resetLoading||resetDraft!=='RESET 2569';}
}
function render(){updateTabs();state.view==='dashboard'?renderDashboard():renderVote();}
async function refresh(){
 if(state.demo){state.stats=demoStats();state.isOpen=true;state.last=new Date();if(state.view==='dashboard')render();return;}
 try{const data=await api('stats');state.stats=data;state.isOpen=data.is_open;state.error='';state.last=new Date();if(state.view==='dashboard'&&document.activeElement?.id!=='admin-code')render();}
 catch(error){state.error=error.message;if(state.view==='dashboard'&&document.activeElement?.id!=='admin-code')render();}
}
function exportCSV(){
 const rows=prepareRows();
 const header=['Topic ID','ประเด็นความยั่งยืน','Necessity Average','Complexity Average','Respondents'];
 const data=rows.map(r=>[r.id,r.topic,r.count?fmt(r.necessity):'',r.count?fmt(r.complexity):'',r.count]);
 const csv=[header,...data].map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='sustainability-assessment-2569.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
async function copyLink(view){
 const u=new URL(location.href);u.search='';u.searchParams.set('view',view);
 try{await navigator.clipboard.writeText(u.href);toast('คัดลอกลิงก์แล้ว');}catch{toast('ไม่สามารถคัดลอกอัตโนมัติได้: '+u.href);}
}
async function changeControl(action){
 const code=$('admin-code')?.value;
 if(!code)return toast('กรุณาระบุรหัสผู้ดูแล');
 if(state.demo)return toast('โหมด Demo ไม่สามารถเปลี่ยนสถานะจริงได้');
 try{const r=await api('control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,action})});state.isOpen=r.is_open;await refresh();toast(r.is_open?'เปิดรับคะแนนแล้ว':'ปิดรับคะแนนแล้ว');}
 catch(error){toast(error.message);}
}
document.addEventListener('click',event=>{
 const score=event.target.closest('[data-topic][data-score]');
 if(score){castVote(score);return;}
 const view=event.target.closest('[data-view]');if(view){switchView(view.dataset.view);return;}
 if(event.target.closest('[data-export]'))return exportCSV();
 const copy=event.target.closest('[data-copy]');if(copy)return copyLink(copy.dataset.copy);
 if(event.target.closest('[data-refresh]'))return refresh();
 const ctrl=event.target.closest('[data-control]');if(ctrl)return changeControl(ctrl.dataset.control);
});
async function boot(){
 if(!state.demo){
  try{
   const session=await api('session');
   for(const v of session.votes||[])state.votes[Number(v.topic_id)]={necessity:Number(v.necessity),complexity:Number(v.complexity),saved:true};
  }catch(error){state.error=error.message;}
 }
 state.ready=true;render();await refresh();
 setInterval(()=>{if(state.view==='dashboard')refresh();},3000);
}
boot();
