/* Jerry, the CollectCare health bot, for the private beta. Adapted from the demo health bot (healthbot.js).
   Privacy: every note stays in this browser (localStorage) on this device.
   Nothing here sends health notes to any server. */
(function(){
function mk(n){var m={},mem={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},key:function(){return null},get length(){return 0}};try{var s=window[n+'Storage'];var t='__oc';s.setItem(t,'1');s.removeItem(t);return s}catch(e){return mem}}
window.ocLS=window.ocLS||mk('local');window.ocSS=window.ocSS||mk('session');
})();
const HB={};
HB.MEM=[];
HB.FEEL=[null,{w:'Bad',c:'#d64545'},{w:'Not great',c:'#ef8a3c'},{w:'Okay',c:'#e8c33a'},{w:'Good',c:'#5bbf6a'},{w:'Great',c:'#16a34a'}];
HB.SYM=['Headache','Tired','Cough','Sore throat','Fever or chills','Stuffy nose','Nausea','Stomach pain','Diarrhea','Dizzy','Short of breath','Chest pain','Heart racing','Joint pain','Back pain','Rash','Swelling','Anxious','Low mood','Trouble sleeping','Poor appetite','Thoughts of self-harm'];
HB.RED=['Chest pain','Short of breath','Thoughts of self-harm'];
HB.AREA=['Head','Neck','Chest','Stomach','Lower back','Upper back','Shoulder','Arm or hand','Hip','Knee','Leg or foot','All over'];
HB.MOOD=['Calm','Happy','Anxious','Sad','Irritable','Stressed'];
HB.$=id=>document.getElementById(id);
HB.esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
HB.ymd=d=>{d=d||new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
HB.pd=s=>{const a=s.split('-');return new Date(+a[0],a[1]-1,+a[2])};
HB.fmt=(s,o)=>HB.pd(s).toLocaleDateString('en-US',o||{weekday:'short',month:'short',day:'numeric'});
HB.key=mid=>'ccJB:v1:'+mid;
HB.load=mid=>{try{const d=JSON.parse(ocLS.getItem(HB.key(mid))||'null');if(d&&d.entries)return Object.assign({questions:[],visit:{}},d)}catch(e){}return{entries:[],questions:[],visit:{}}};
HB.save=(mid,d)=>{try{ocLS.setItem(HB.key(mid),JSON.stringify(d))}catch(e){alert('This browser could not save your note. Private browsing may block saving.')}};
HB.member=()=>{const q=new URLSearchParams(location.search).get('m');let m=HB.MEM.find(x=>x.mid==q);if(!m){const last=ocLS.getItem('ccJB:last');m=HB.MEM.find(x=>x.mid==last)||HB.MEM[0]}if(!m.guest)ocLS.setItem('ccJB:last',m.mid);return m};
HB.sha=async t=>{if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}let h=0;for(const c of t)h=(h*31+c.charCodeAt(0))|0;return 'x'+h};
HB.flags=e=>{const f=[];(e.symptoms||[]).forEach(s=>{if(HB.RED.includes(s))f.push(s)});if(e.pain>=8)f.push('Pain '+e.pain+' of 10');const t=parseFloat(e.vitals&&e.vitals.temp);if(t>=103)f.push('Temperature '+t+' F');const bp=(e.vitals&&e.vitals.bp||'').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);if(bp&&(+bp[1]>=180||+bp[2]>=120))f.push('Blood pressure '+bp[1]+'/'+bp[2]);(e.pq||[]).concat(e.mh||[]).forEach(x=>{if(!x.al)return;if(x.crisis){if(!f.includes('Thoughts of self-harm'))f.push('Thoughts of self-harm')}else f.push(x.text.replace(/\?$/,'')+': '+x.a)});return f};
HB.alertHTML=f=>`<div class="alert" role="alert"><b>Please don't wait on this.</b> You noted: ${f.map(HB.esc).join(', ')}. Jerry notes are not watched by a doctor or nurse in real time, and Jerry does not contact your doctor. If your doctor asked about this, call their office today.
<div class="row"><a class="btn red sm" href="tel:911">Call 911 for an emergency</a>${f.includes('Thoughts of self-harm')?'<a class="btn red sm" href="tel:988">Call or text 988 (crisis line)</a>':''}<a class="btn ghost sm" href="./?urgent=1">Nearest urgent care</a></div></div>`;
HB.botSVG='<img src="bot.svg" alt="">';
HB.lockSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
/* Gate: the person must be signed in to the private beta. Family members come from their account. */
HB.guard=function(main,onOK){
 const box=HB.$('gatebox');
 HB.boot().then(st=>{
  if(st==='ok'){box.classList.add('hidden');main.classList.remove('hidden');onOK();return}
  const t=st==='empty'?['Add your family first','Jerry keeps daily notes for each person in your CollectCare family. Add yourself on the Family page, then come back.','Go to my family']:['Sign in to talk with Jerry','Jerry\u2019s notes belong to your CollectCare family. Sign in to the private beta first, then come back.','Sign in'];
  box.innerHTML=`<div class="card gate"><div class="bot-ic" style="margin:0 auto 10px">${HB.botSVG}</div><h2>${t[0]}</h2><p class="mut" style="font-size:13.5px">${t[1]}</p><a class="btn" style="width:100%;justify-content:center" href="./">${t[2]}</a></div>`;
  box.classList.remove('hidden');main.classList.add('hidden')});
};
HB.REL={self:'Me',spouse:'Spouse',partner:'Partner',child:'Child',parent:'Parent',sibling:'Sibling',other:'Family'};
HB.boot=async()=>{try{
 const C=window.CC_CONFIG||{};const sb=window.supabase.createClient(C.url,C.anonKey,{auth:{persistSession:true,autoRefreshToken:true}});HB.sb=sb;
 const s=await sb.auth.getSession();const u=s.data&&s.data.session&&s.data.session.user;if(!u)return 'out';
 const a=await sb.auth.mfa.getAuthenticatorAssuranceLevel();if(a.data&&a.data.nextLevel==='aal2'&&a.data.currentLevel!=='aal2')return 'out';
 const [m,i]=await Promise.all([sb.from('members').select('id,full_name,relationship,birth_date').order('created_at'),sb.from('items').select('member_id,data').eq('kind','insurance')]);
 if(m.error)return 'out';
 HB.MEM=(m.data||[]).map(x=>{const age=x.birth_date?Math.floor((Date.now()-new Date(x.birth_date+'T00:00:00'))/31557600000):'';const ins=(i.data||[]).find(y=>y.member_id===x.id);
  return{mid:x.id,name:x.full_name,first:String(x.full_name).split(' ')[0],rel:HB.REL[x.relationship]||'Family',age,ins:ins&&ins.data&&ins.data.member_id||''}});
 return HB.MEM.length?'ok':'empty'}catch(e){console.error(e);return 'out'}};
HB.ageTxt=m=>m.age===''||m.age==null?'':', '+m.age;

HB.lock=()=>{location.href='./'};
HB.memBar=(el,cur,href)=>{el.innerHTML=HB.MEM.filter(m=>!m.guest||m.mid==cur.mid).map(m=>{const n=HB.load(m.mid).entries.length;return `<button class="${m.mid==cur.mid?'on':''}" data-m="${m.mid}" aria-pressed="${m.mid==cur.mid}"><b>${HB.esc(m.first)}</b><small>${HB.esc(m.rel)}${HB.ageTxt(m)} · ${n} note${n==1?'':'s'}</small></button>`}).join('');
 el.onclick=e=>{const b=e.target.closest('button[data-m]');if(b)location.href=href+'?m='+encodeURIComponent(b.dataset.m)}};
/* Sample check-ins so the summary can be shown in a demo. Clearly marked sample:true. */
HB.sample=mid=>{const d=HB.load(mid);let seed=7;const r=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646};const out=[];
 for(let i=20;i>=0;i--){if(i%6==4)continue;const day=new Date();day.setDate(day.getDate()-i);const late=i<8;
  const feel=Math.max(1,Math.min(5,Math.round((late?3.6:2.6)+r()*1.2-.5)));const pain=Math.max(0,Math.round((late?2:4.5)+r()*3-1.5));
  const sy=[];if(r()<(late?.25:.6))sy.push('Headache');if(r()<(late?.3:.55))sy.push('Tired');if(r()<.25)sy.push('Trouble sleeping');if(!late&&r()<.3)sy.push('Back pain');if(r()<.12)sy.push('Anxious');
  const sl=Math.round(((late?7:5.8)+r()*1.6-.8)*2)/2;
  const notes=['','','Headache started mid-afternoon, better after water and rest.','Long day at work. Back stiff after sitting.','Slept badly, woke up at 3am.','Felt better today, walked 30 minutes.','Took ibuprofen twice for the headache.','Headaches seem worse after screens late at night.','Good energy most of the day.'];
  out.push({id:'s'+i,date:HB.ymd(day),t:'8:30 PM',feel,pain,areas:pain?(sy.includes('Back pain')?['Lower back']:['Head']):[],sleep:sl,sq:sl<6?'Poorly':sl<7?'Restless':'Well',energy:Math.max(1,Math.min(5,feel+(r()<.5?0:-1))),mood:[feel>=4?'Calm':r()<.5?'Stressed':'Irritable'],symptoms:sy,meds:r()<.12?'missed':'yes',vitals:i%5==0?{bp:(122+Math.round(r()*14))+'/'+(78+Math.round(r()*8)),temp:'',weight:String(184-Math.round((20-i)/7)),glucose:''}:{},note:notes[Math.floor(r()*notes.length)],star:i==11||i==3,sample:true})}
 d.entries=d.entries.filter(e=>!e.sample).concat(out).sort((a,b)=>a.date<b.date?-1:1);
 if(!d.questions.length)d.questions=[{id:'q1',text:'Could my headaches be linked to sleep or screen time?',sample:true},{id:'q2',text:'Is it safe to keep taking ibuprofen a few times a week?',sample:true}];
 if(!d.visit.date){const v=new Date();v.setDate(v.getDate()+3);d.visit={date:HB.ymd(v),with:'Primary care visit',reason:'Headaches and back stiffness',sample:true}}
 HB.save(mid,d)};
HB.clearSample=mid=>{const d=HB.load(mid);d.entries=d.entries.filter(e=>!e.sample);d.questions=d.questions.filter(q=>!q.sample);if(d.visit.sample)d.visit={};HB.save(mid,d)};
HB.download=(name,text,type)=>{const b=new Blob([text],{type:type||'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(u);a.remove()},500)};
/* ---------- Doctor-programmed daily questions ("care plan") ----------
   A physician picks the questions; the patient's Jerry asks them in every
   daily check-in until the end date. Demo: saved in this browser only. */
HB.planKey=mid=>'ccJB:plan:'+mid;
HB.getPlan=mid=>{try{return JSON.parse(ocLS.getItem(HB.planKey(mid))||'null')}catch(e){return null}};
HB.setPlan=(mid,p)=>{p?ocLS.setItem(HB.planKey(mid),JSON.stringify(p)):ocLS.removeItem(HB.planKey(mid))};
HB.plan=mid=>{const p=HB.getPlan(mid),t=HB.ymd();return p&&!p.stopped&&p.start<=t&&p.end>=t&&p.q&&p.q.length?p:null};
HB.QTYPES={scale:'0 to 10 scale',yesno:'Yes or no',choice:'Pick one',number:'Number',text:'Short answer'};
HB.TPL={
 knee:{name:'Knee replacement recovery',days:42,msg:'Please answer these each evening until your 6-week visit. They help us see how your new knee is healing between visits.',q:[
  {text:'How much does your knee hurt when you walk?',type:'scale',alert:{op:'>=',v:8}},
  {text:'How far can you bend your knee today?',type:'choice',opts:['Less than 90°','About 90°','About 100°','110° or more']},
  {text:'Is your incision red, warm, or draining?',type:'yesno',alert:{v:'Yes'}},
  {text:'Any new pain, tightness, or swelling in your calf?',type:'yesno',alert:{v:'Yes'}},
  {text:'Did you do your home exercises today?',type:'yesno'},
  {text:'What are you walking with?',type:'choice',opts:['Walker','Cane','Nothing']},
  {text:'Highest temperature today',type:'number',unit:'F',alert:{op:'>=',v:101}}]},
 postop:{name:'After surgery (general)',days:14,msg:'Please check in each evening for the next two weeks while you heal.',q:[
  {text:'How bad is your pain right now?',type:'scale',alert:{op:'>=',v:8}},
  {text:'Is your incision red, warm, or draining?',type:'yesno',alert:{v:'Yes'}},
  {text:'Highest temperature today',type:'number',unit:'F',alert:{op:'>=',v:101}},
  {text:'Are you eating and drinking normally?',type:'yesno',alert:{v:'No'}},
  {text:'How many pain pills did you take today?',type:'number',unit:'pills'}]},
 bp:{name:'High blood pressure',days:30,msg:'Please take your blood pressure each morning, sitting quietly for 5 minutes first.',q:[
  {text:'Morning blood pressure, top number',type:'number',unit:'mmHg',alert:{op:'>=',v:160}},
  {text:'Morning blood pressure, bottom number',type:'number',unit:'mmHg',alert:{op:'>=',v:100}},
  {text:'Did you take your blood pressure medicine today?',type:'yesno',alert:{v:'No'}},
  {text:'Any headache, blurry vision, or dizziness?',type:'yesno',alert:{v:'Yes'}}]},
 dm:{name:'Diabetes',days:30,msg:'Please check your sugar before breakfast and answer these each day.',q:[
  {text:'Blood sugar before breakfast',type:'number',unit:'mg/dL',alert:{op:'>=',v:250}},
  {text:'Any low sugar today (shaky, sweaty, confused)?',type:'yesno',alert:{v:'Yes'}},
  {text:'Did you take your diabetes medicine today?',type:'yesno',alert:{v:'No'}},
  {text:'Did you check your feet for sores?',type:'yesno'}]},
 hf:{name:'Heart failure',days:30,msg:'Please weigh yourself each morning after using the bathroom, before eating.',q:[
  {text:'Morning weight',type:'number',unit:'lb'},
  {text:'Is your weight up 3 lb or more since yesterday?',type:'yesno',alert:{v:'Yes'}},
  {text:'Short of breath lying flat or waking up breathless?',type:'yesno',alert:{v:'Yes'}},
  {text:'Ankle or leg swelling',type:'choice',opts:['None','Same as usual','Worse than usual'],alert:{v:'Worse than usual'}}]},
 mh:{name:'Mental health check-in',days:28,msg:'A short daily check-in on how you are doing emotionally. If you are ever in crisis, call or text 988 any time.',q:'MH'}
};
HB.MHC=['Not at all','A little','Quite a bit','Nearly all day'];
HB.MH=[
 {id:'mh1',text:'Today, how much have you felt down, sad, or hopeless?',type:'choice',opts:HB.MHC,alert:{v:'Nearly all day'}},
 {id:'mh2',text:'Today, how much have you had little interest or pleasure in doing things?',type:'choice',opts:HB.MHC,alert:{v:'Nearly all day'}},
 {id:'mh3',text:'Today, how much have you felt nervous, anxious, or on edge?',type:'choice',opts:HB.MHC,alert:{v:'Nearly all day'}},
 {id:'mh4',text:'Have you been able to stop or control your worrying?',type:'choice',opts:['Yes','Mostly','Not really']},
 {id:'mh5',text:'How well are you coping today? (0 is not at all, 10 is very well)',type:'scale',alert:{op:'<=',v:2}},
 {id:'mh6',text:'Did you connect with someone you trust today?',type:'yesno'},
 {id:'mh7',text:'Any thoughts that you would be better off dead, or of hurting yourself?',type:'yesno',alert:{v:'Yes'},crisis:true}];
HB.TPL.mh.q=HB.MH;
HB.mhOn=mid=>ocLS.getItem('ccJB:mh:'+mid)=='1';
HB.setMH=(mid,on)=>on?ocLS.setItem('ccJB:mh:'+mid,'1'):ocLS.removeItem('ccJB:mh:'+mid);
HB.qid=()=>'pq'+Math.random().toString(36).slice(2,8);
HB.qAlert=(q,v)=>{const a=q.alert;if(!a||v===''||v==null)return false;if(q.type=='scale'||q.type=='number'){const n=parseFloat(v);if(isNaN(n)||a.v===''||a.v==null)return false;return a.op=='<='?n<=+a.v:n>=+a.v}return String(v)==String(a.v)};
HB.ansTxt=(q,v)=>{if(v===''||v==null)return 'Skipped';if(q.type=='scale')return v+'/10';if(q.type=='number')return v+(q.unit?' '+q.unit:'');return String(v)};
HB.alertRule=q=>{const a=q.alert;if(!a||a.v===''||a.v==null)return '';if(q.type=='scale')return (a.op=='<='?a.v+' or lower':a.v+' or higher');if(q.type=='number')return (a.op=='<='?'at or below ':'at or above ')+a.v+(q.unit?' '+q.unit:'');return 'answer is '+a.v};
/* Patient-side input for one doctor question. v = current value. */
HB.pqUI=(q,v)=>{const e=HB.esc;v=v==null?'':v;
 if(q.type=='scale'){const d=q.alert&&q.alert.op=='<='?5:0;return `<div class="rng"><input type="range" min="0" max="10" step="1" id="pq_r" value="${v===''?d:v}" aria-label="${e(q.text)}, 0 to 10"><b id="pq_rv">${v===''?d:v}/10</b></div>`}
 if(q.type=='yesno'||q.type=='choice'){const o=q.type=='yesno'?['Yes','No']:(q.opts||[]);return `<div class="chips">${o.map(x=>`<button type="button" class="chip${String(v)==x?' on':''}" data-pqv="${e(x)}" aria-pressed="${String(v)==x}">${e(x)}</button>`).join('')}</div>`}
 if(q.type=='number')return `<div class="row" style="flex-wrap:nowrap"><input type="number" step="any" inputmode="decimal" id="pq_n" value="${e(v)}" aria-label="${e(q.text)}" style="max-width:180px">${q.unit?`<b class="mut">${e(q.unit)}</b>`:''}</div>`;
 return `<input type="text" id="pq_t" value="${e(v)}" aria-label="${e(q.text)}" placeholder="Type a short answer">`};

/* ---------- Care-team requests and home assignments ----------
   A physician sends a request (reading, home assignment, file, question, reading
   material, lab). It shows in the patient's Jerry; the patient's responses
   show back on the provider page. Demo: saved in this browser only. */
HB.reqKey=mid=>'ccJB:req:'+mid;
HB.getReqs=mid=>{try{return JSON.parse(ocLS.getItem(HB.reqKey(mid))||'[]')}catch(e){return[]}};
HB.setReqs=(mid,a)=>{try{ocLS.setItem(HB.reqKey(mid),JSON.stringify(a))}catch(e){alert('This browser could not save. Private browsing may block saving.')}};
HB.RT={reading:{n:'Home reading',verb:'Send reading'},task:{n:'Home assignment',verb:'Mark done for today'},upload:{n:'Photo or file',verb:'Send file'},question:{n:'Question',verb:'Send answer'},read:{n:'Please read',verb:"I've read this"},lab:{n:'Lab or test',verb:'Done'}};
HB.PRIO={routine:'Routine',soon:'This week',urgent:'As soon as possible'};
HB.reqProg=r=>({n:(r.log||[]).filter(l=>l.kind=='do').length,t:r.target||1});
HB.reqState=r=>{if(r.status=='canceled')return{k:'canceled',t:'Canceled',c:'p-n'};const p=HB.reqProg(r);
 if((r.log||[]).some(l=>l.kind=='help'&&!l.rev))return{k:'help',t:'Patient needs help',c:'p-r'};
 if(r.status=='done')return r.rev?{k:'rev',t:'Done · reviewed',c:'p-ok'}:{k:'done',t:'Done · new',c:'p-ok'};
 if(r.due&&r.due<HB.ymd())return{k:'late',t:'Overdue',c:'p-r'};
 if(p.n||(r.log||[]).some(l=>l.kind=='sched'))return{k:'prog',t:r.type=='lab'&&!p.n?'Scheduled':'In progress '+p.n+'/'+p.t,c:'p-w'};
 if(r.seen)return{k:'seen',t:'Seen by patient',c:'p-w'};return{k:'new',t:'Sent',c:'p-n'}};
HB.logTxt=(r,l)=>{const e=HB.esc,o=[];
 if(l.kind=='sched')o.push('Scheduled for '+HB.fmt(l.when,{month:'short',day:'numeric'}));
 
 if(l.kind=='do'&&r.type=='read')o.push('Read and understood');
 if(l.kind=='do'&&r.type=='task')o.push('Done');
 if(l.kind=='do'&&r.type=='lab')o.push('Done');
 (l.vals||[]).forEach((v,i)=>{if(v)o.push(e((r.fields||[])[i]||'Reading')+': <b>'+e(v)+'</b>')});
 if(l.file)o.push('File: <b>'+e(l.file.name)+'</b> ('+Math.max(1,Math.round(l.file.size/1024))+' KB)');
 if(l.text)o.push('"'+e(l.text)+'"');return (l.kind=='help'?'<b class="dn">Needs help:</b> ':'')+o.join(' · ')};
HB.reqPatient=(el,mid,onChange)=>{const e=HB.esc;
 const draw=()=>{const all=HB.getReqs(mid);let ch=false;all.forEach(r=>{if(r.status!='canceled'&&!r.seen){r.seen=new Date().toISOString();ch=true}});if(ch)HB.setReqs(mid,all);
  const open=all.filter(r=>r.status=='open'),done=all.filter(r=>r.status=='done');
  if(!open.length&&!done.length){el.innerHTML='';el.classList.add('hidden');return}el.classList.remove('hidden');
  const by=(all[0]||{}).by||'Your care team';
  const item=r=>{const p=HB.reqProg(r),today=(r.log||[]).some(l=>l.kind=='do'&&l.date==HB.ymd());let f='';
   if(r.type=='reading')f=`<div class="grid g2" style="gap:8px">${(r.fields||['Reading']).map((x,i)=>`<div><label class="f" for="rv_${r.id}_${i}">${e(x)}</label><input type="text" id="rv_${r.id}_${i}" data-v="${i}" placeholder="${/bp|blood|lying|standing|sitting/i.test(x)?'For example 128/76':''}"></div>`).join('')}</div>`;
   if(r.type=='upload')f=`<input type="file" data-file accept="image/*,.pdf" aria-label="Choose a photo or file" style="margin:4px 0">`;
   if(r.type=='question')f=`<textarea data-t placeholder="Type your answer" aria-label="Your answer"></textarea>`;
   if(r.type=='lab')f=`<div class="row"><label class="f" for="ld_${r.id}" style="margin:0">Date</label><input type="date" id="ld_${r.id}" data-when value="${HB.ymd()}" style="max-width:180px"><button type="button" class="btn ghost sm" data-sched>I scheduled it</button></div>`;
   if(r.type=='task'||r.type=='reading'||r.type=='upload'||r.type=='lab')f+=`<input type="text" data-t placeholder="Add a note (optional)" aria-label="Note" style="margin-top:8px">`;
   const prog=p.t>1?`<div class="rqbar" aria-label="${p.n} of ${p.t} done"><i style="width:${Math.min(100,p.n/p.t*100)}%"></i></div><span class="mut" style="font-size:12.5px">${p.n} of ${p.t} done</span>`:'';
   const log=(r.log||[]).length?`<div class="rqlog">${r.log.map(l=>`<div><span class="mut">${HB.fmt(l.date,{month:'short',day:'numeric'})}</span> ${HB.logTxt(r,l)}</div>`).join('')}</div>`:'';
   return `<div class="rq${r.prio=='urgent'?' urg':''}" data-id="${r.id}"><div class="row" style="gap:6px"><span class="tag ac">${HB.RT[r.type].n}</span>${r.prio!='routine'?`<span class="tag" style="background:${r.prio=='urgent'?'#fff1f0;color:#b42318':'#fff4e5;color:#b45309'}">${HB.PRIO[r.prio]}</span>`:''}<span class="sp"></span>${r.due?`<span class="mut" style="font-size:12.5px">Due ${HB.fmt(r.due,{weekday:'short',month:'short',day:'numeric'})}</span>`:''}</div>
    <h3 style="margin:8px 0 2px">${e(r.title)}</h3><p class="rqd">${e(r.detail)}</p>${r.remind?`<p class="rqrem">Reminder from ${e(r.by)} on ${HB.fmt(r.remind.slice(0,10),{month:'short',day:'numeric'})}</p>`:''}${prog}${log}
    ${r.type=='read'&&r.ack?'':`<form class="rqf">${today&&r.type=='task'?'<p class="okmsg" style="margin:0 0 8px">Done for today. Come back tomorrow.</p>':f}<div class="row" style="margin-top:10px">${today&&r.type=='task'?'':`<button class="btn sm">${HB.RT[r.type].verb}</button>`}<span class="sp"></span><button type="button" class="x" data-help>I can't do this or need help</button></div><div class="hidden" data-hbox><textarea data-ht placeholder="Tell ${e(r.by)} what's getting in the way" aria-label="Message to your care team"></textarea><button type="button" class="btn ghost sm" data-hsend style="margin-top:6px">Send message</button></div><p class="mut" data-err role="alert" style="font-size:13px;margin:6px 0 0"></p></form>`}</div>`};
  el.innerHTML=`<div class="row"><h2 style="margin:0">From your care team</h2><span class="sp"></span><span class="tag ${open.length?'ac':'ok'}">${open.length?open.length+' to do':'All done'}</span></div><p class="mut" style="font-size:13.5px;margin:4px 0 0">${e(by)} asked you to do ${all.filter(r=>r.status!='canceled').length==1?'this':'these'}. Your answers go back to the care team.</p>${open.map(item).join('')}${done.length?`<details class="rqdone"><summary>Done (${done.length})</summary>${done.map(r=>`<div class="rq done"><b>${e(r.title)}</b><div class="rqlog">${(r.log||[]).map(l=>`<div><span class="mut">${HB.fmt(l.date,{month:'short',day:'numeric'})}</span> ${HB.logTxt(r,l)}</div>`).join('')}</div></div>`).join('')}</details>`:''}`;
 };
 const push=(id,entry)=>{const all=HB.getReqs(mid),r=all.find(x=>x.id==id);if(!r)return;r.log=r.log||[];r.log.push(Object.assign({at:new Date().toISOString(),date:HB.ymd()},entry));
  if(entry.kind=='do'&&HB.reqProg(r).n>=(r.target||1)){r.status='done';r.doneAt=new Date().toISOString()}if(entry.kind=='do'&&r.type=='read')r.ack=new Date().toISOString();
  HB.setReqs(mid,all);draw();onChange&&onChange()};
 el.onclick=ev=>{const b=ev.target.closest('button');if(!b)return;const card=b.closest('.rq');if(!card)return;const id=card.dataset.id;
  if(b.dataset.help!=null){card.querySelector('[data-hbox]').classList.toggle('hidden');const t=card.querySelector('[data-ht]');t&&t.focus();return}
  if(b.dataset.hsend!=null){const t=card.querySelector('[data-ht]').value.trim();if(!t){card.querySelector('[data-err]').textContent='Type a short message first.';return}push(id,{kind:'help',text:t});return}
  if(b.dataset.sched!=null){const w=card.querySelector('[data-when]').value;if(!w)return;push(id,{kind:'sched',when:w});return}};
 el.onsubmit=ev=>{ev.preventDefault();const f=ev.target,card=f.closest('.rq'),id=card.dataset.id,r=HB.getReqs(mid).find(x=>x.id==id),err=f.querySelector('[data-err]');
  const t=(f.querySelector('[data-t]')||{}).value;const entry={kind:'do',text:(t||'').trim()};
  if(r.type=='reading'){entry.vals=[...f.querySelectorAll('[data-v]')].map(i=>i.value.trim());if(!entry.vals.some(Boolean)){err.textContent='Enter at least one reading.';return}}
  if(r.type=='upload'){const fi=f.querySelector('[data-file]').files[0];if(!fi){err.textContent='Choose a photo or file first.';return}entry.file={name:fi.name,size:fi.size,type:fi.type}}
  if(r.type=='question'&&!entry.text){err.textContent='Type your answer first.';return}
  if(r.type=='lab'){const w=f.querySelector('[data-when]').value;if(w)entry.when=w}
  push(id,entry)};
 draw();return draw};
