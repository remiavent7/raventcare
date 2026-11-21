/* CollectCare Health Bot - shared code.
   Privacy: every note stays in this browser (localStorage) on this device.
   Nothing here sends health notes to any server. */
(function(){
function mk(n){var m={},mem={getItem:function(k){return k in m?m[k]:null},setItem:function(k,v){m[k]=String(v)},removeItem:function(k){delete m[k]},key:function(){return null},get length(){return 0}};try{var s=window[n+'Storage'];var t='__oc';s.setItem(t,'1');s.removeItem(t);return s}catch(e){return mem}}
window.ocLS=window.ocLS||mk('local');window.ocSS=window.ocSS||mk('session');
})();
const HB={};
HB.GH="1b7dc74c7a440efc3582ecda14e933706a0f4a6e6ba4f1be055b12603c1949b0";
HB.MEM=[
 {mid:'XEB71845203-01',name:'Chris Yates',first:'Chris',rel:'Subscriber',age:44},
 {mid:'XEB71845203-02',name:'Colin Yates',first:'Colin',rel:'Spouse',age:46},
 {mid:'XEB71845203-03',name:'Chayanne Yates',first:'Chayanne',rel:'Daughter',age:19},
 {mid:'XEB71845203-04',name:'Christian Yates',first:'Christian',rel:'Son',age:15},
 {mid:'4TQ7-RM2-KX58',name:'Margaret Yates',first:'Margaret',rel:'Mother',age:79}
];
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
HB.key=mid=>'ccHB:v1:'+mid;
HB.load=mid=>{try{const d=JSON.parse(ocLS.getItem(HB.key(mid))||'null');if(d&&d.entries)return Object.assign({questions:[],visit:{}},d)}catch(e){}return{entries:[],questions:[],visit:{}}};
HB.save=(mid,d)=>{try{ocLS.setItem(HB.key(mid),JSON.stringify(d))}catch(e){alert('This browser could not save your note. Private browsing may block saving.')}};
HB.member=()=>{const q=new URLSearchParams(location.search).get('m');let m=HB.MEM.find(x=>x.mid==q);if(!m){const last=ocLS.getItem('ccHB:last');m=HB.MEM.find(x=>x.mid==last)||HB.MEM[0]}ocLS.setItem('ccHB:last',m.mid);return m};
HB.sha=async t=>{if(window.crypto&&crypto.subtle){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}let h=0;for(const c of t)h=(h*31+c.charCodeAt(0))|0;return 'x'+h};
HB.flags=e=>{const f=[];(e.symptoms||[]).forEach(s=>{if(HB.RED.includes(s))f.push(s)});if(e.pain>=8)f.push('Pain '+e.pain+' of 10');const t=parseFloat(e.vitals&&e.vitals.temp);if(t>=103)f.push('Temperature '+t+' F');const bp=(e.vitals&&e.vitals.bp||'').match(/(\d{2,3})\s*\/\s*(\d{2,3})/);if(bp&&(+bp[1]>=180||+bp[2]>=120))f.push('Blood pressure '+bp[1]+'/'+bp[2]);return f};
HB.alertHTML=f=>`<div class="alert" role="alert"><b>Please don't wait on this.</b> You noted: ${f.map(HB.esc).join(', ')}. Health Bot notes are not watched by a doctor or nurse.
<div class="row"><a class="btn red sm" href="tel:911">Call 911 for an emergency</a>${f.includes('Thoughts of self-harm')?'<a class="btn red sm" href="tel:988">Call or text 988 (crisis line)</a>':''}<a class="btn ghost sm" href="app.html?urgent=1">Nearest urgent care</a></div></div>`;
HB.botSVG='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 7V4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="3.2" r="1.8" fill="#fff"/><rect x="2.5" y="13" width="3" height="6" rx="1.4" fill="#fff"/><rect x="26.5" y="13" width="3" height="6" rx="1.4" fill="#fff"/><rect x="5.5" y="7" width="21" height="18" rx="6" fill="#fff"/><circle cx="11.5" cy="13.5" r="2" fill="#1f6fd1"/><circle cx="20.5" cy="13.5" r="2" fill="#1f6fd1"/><path d="M14.6 17h2.8v2h2v2.8h-2v2h-2.8v-2h-2V19h2z" fill="#0ea5c6"/></svg>';
HB.lockSVG='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
/* Gate: family code (same as the app), then the separate Health Bot password. */
HB.PW="86bbd60e63d7f0aaaff28ce24e66ff28c6ed97d1abe4c87657159b99f8e2e0a9";
HB.guard=function(main,onOK){
 const ok=()=>ocSS.getItem('ocOK')=='1';
 const unlocked=()=>ocSS.getItem('ccHB:open')=='1';
 const box=HB.$('gatebox');
 const go=()=>{box.classList.add('hidden');main.classList.remove('hidden');onOK()};
 const step=()=>{
  if(!ok()){box.innerHTML=`<div class="card gate"><h2>Enter your family code</h2><p class="mut" style="font-size:13.5px">Use the same code you use for the family app.</p><form id="gf"><input id="gc" type="password" placeholder="Family code" autocomplete="off" aria-label="Family code"><button class="btn" style="width:100%;justify-content:center">Continue</button><p id="ge" class="mut" style="font-size:13px" role="alert"></p></form></div>`;
   box.classList.remove('hidden');main.classList.add('hidden');
   HB.$('gf').onsubmit=async e=>{e.preventDefault();if(await HB.sha(HB.$('gc').value.trim().toUpperCase())===HB.GH){ocSS.setItem('ocOK','1');step()}else HB.$('ge').textContent='That code is not valid.'};HB.$('gc').focus();return}
  if(!unlocked()){box.innerHTML=`<div class="card gate"><div class="bot-ic" style="margin:0 auto 10px">${HB.botSVG}</div><h2>Health Bot password</h2><p class="mut" style="font-size:13.5px">Health Bot notes are private. Enter the Health Bot password to open them. This is separate from the family code.</p><form id="pf"><input id="pc" type="password" placeholder="Health Bot password" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Health Bot password"><button class="btn" style="width:100%;justify-content:center">Open Health Bot</button><p id="pe" class="mut" style="font-size:13px" role="alert"></p></form><p class="mut" style="font-size:12px;margin:6px 0 0"><a href="app.html">Back to my benefits</a></p></div>`;
   box.classList.remove('hidden');main.classList.add('hidden');
   HB.$('pf').onsubmit=async e=>{e.preventDefault();if(await HB.sha(HB.$('pc').value.trim().toLowerCase())===HB.PW){ocSS.setItem('ccHB:open','1');go()}else{HB.$('pe').textContent='That password is not right.';HB.$('pc').select()}};HB.$('pc').focus();return}
  go()};
 step();
};

HB.lock=()=>{ocSS.removeItem('ccHB:open');location.reload()};
HB.memBar=(el,cur,href)=>{el.innerHTML=HB.MEM.map(m=>{const n=HB.load(m.mid).entries.length;return `<button class="${m.mid==cur.mid?'on':''}" data-m="${m.mid}" aria-pressed="${m.mid==cur.mid}"><b>${HB.esc(m.first)}</b><small>${HB.esc(m.rel)}, ${m.age} · ${n} note${n==1?'':'s'}</small></button>`}).join('');
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
