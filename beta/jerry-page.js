/* Jerry page script (moved out of the HTML for the strict content security policy). */

const $=HB.$,esc=HB.esc;let M,D,A,STEP=0,EDIT=null,HF='all',PLAN=null;
$('boticon').innerHTML=HB.botSVG;
const blank=()=>({feel:0,symptoms:[],other:'',pain:0,areas:[],sleep:7,sq:'',energy:0,mood:[],meds:'',vitals:{bp:'',temp:'',weight:'',glucose:''},note:'',star:false,pqv:{}});
const chipH=(arr,sel,attr)=>`<div class="chips">${arr.map(s=>`<button type="button" class="chip${sel.includes(s)?' on':''}" data-${attr}="${esc(s)}" aria-pressed="${sel.includes(s)}">${esc(s)}</button>`).join('')}</div>`;
const togg=(list,v)=>{const i=list.indexOf(v);i<0?list.push(v):list.splice(i,1)};
const BASE=[
 {q:()=>`Hi ${esc(M.first)}. How are you feeling today, overall?`,
  ui:()=>`<div class="opts">${[5,4,3,2,1].map(v=>`<button type="button" class="opt${A.feel==v?' on':''}" data-feel="${v}"><i style="background:${HB.FEEL[v].c}"></i>${HB.FEEL[v].w}</button>`).join('')}</div>`,
  ok:()=>A.feel>0,ans:()=>HB.FEEL[A.feel].w,auto:1},
 {q:()=>`Any symptoms today? Tap all that fit.`,
  ui:()=>chipH(HB.SYM,A.symptoms,'sym')+`<input type="text" id="oth" placeholder="Something else (optional)" value="${esc(A.other)}" aria-label="Other symptom">`,
  ok:()=>1,ans:()=>{const s=A.symptoms.concat(A.other?[A.other]:[]);return s.length?s.join(', '):'No symptoms'},skip:'No symptoms'},
 {q:()=>`Any pain? 0 means none, 10 is the worst you can imagine.`,
  ui:()=>`<div class="rng"><input type="range" min="0" max="10" step="1" id="pain" value="${A.pain}" aria-label="Pain level 0 to 10"><b id="painv">${A.pain}/10</b></div><div id="areas" class="${A.pain?'':'hidden'}"><label class="f" style="margin-top:8px">Where?</label>${chipH(HB.AREA,A.areas,'area')}</div>`,
  ok:()=>1,ans:()=>A.pain?`Pain ${A.pain}/10${A.areas.length?' · '+A.areas.join(', '):''}`:'No pain'},
 {q:()=>`How did you sleep last night?`,
  ui:()=>`<div class="rng"><input type="range" min="0" max="12" step=".5" id="sleep" value="${A.sleep}" aria-label="Hours of sleep"><b id="sleepv">${A.sleep} h</b></div>${chipH(['Well','Restless','Poorly'],[A.sq],'sq')}`,
  ok:()=>1,ans:()=>`${A.sleep} hours${A.sq?', '+A.sq.toLowerCase():''}`},
 {q:()=>`How is your energy, and how is your mood?`,
  ui:()=>`<label class="f">Energy</label><div class="chips">${[['1','Very low'],['2','Low'],['3','Okay'],['4','Good'],['5','High']].map(([v,w])=>`<button type="button" class="chip${A.energy==v?' on':''}" data-en="${v}">${w}</button>`).join('')}</div><label class="f">Mood</label>${chipH(HB.MOOD,A.mood,'mood')}`,
  ok:()=>1,ans:()=>{const w=['','Very low','Low','Okay','Good','High'][A.energy];return [w?'Energy '+w.toLowerCase():'',A.mood.join(', ')].filter(Boolean).join(' · ')||'Skipped'}},
 {q:()=>`Did you take your medicines as prescribed today?`,
  ui:()=>`<div class="chips">${[['yes','Yes, all of them'],['missed','Missed a dose'],['none','I don\'t take any']].map(([v,w])=>`<button type="button" class="chip${A.meds==v?' on':''}" data-meds="${v}">${w}</button>`).join('')}</div>`,
  ok:()=>1,ans:()=>({yes:'Took my medicines',missed:'Missed a dose',none:'No medicines'}[A.meds]||'Skipped'),auto:1},
 {q:()=>`Want to add any readings? Only if you checked them today.`,
  ui:()=>`<div class="grid g4" style="gap:8px">${[['bp','Blood pressure','120/80','text'],['temp','Temperature (F)','98.6','number'],['weight','Weight (lb)','','number'],['glucose','Blood sugar (mg/dL)','','number']].map(([k,l,p,t])=>`<div><label class="f" for="v_${k}">${l}</label><input type="${t}" ${t=='number'?'step="any" inputmode="decimal"':''} id="v_${k}" placeholder="${p}" value="${esc(A.vitals[k])}"></div>`).join('')}</div>`,
  ok:()=>1,ans:()=>{const v=A.vitals,o=[];if(v.bp)o.push('BP '+v.bp);if(v.temp)o.push(v.temp+' F');if(v.weight)o.push(v.weight+' lb');if(v.glucose)o.push('Sugar '+v.glucose);return o.join(' · ')||'No readings'},skip:'No readings'},
 {q:()=>`Anything else you want to remember or tell your doctor? Write it the way you'd say it.`,
  ui:()=>`<textarea id="note" placeholder="For example: headache came back after lunch, better after resting">${esc(A.note)}</textarea><label class="row" style="margin-top:8px;font-size:14px;cursor:pointer"><input type="checkbox" id="star" ${A.star?'checked':''} style="width:20px;height:20px"> Flag this note for my doctor</label>`,
  ok:()=>1,ans:()=>A.note?(A.star?'[For my doctor] ':'')+A.note:'Nothing else',last:1}
];
['feel','sym','pain','sleep','en','meds','vit','note'].forEach((k,i)=>BASE[i].k=k);
let S=BASE;
let MHS=false;
function buildSteps(){PLAN=HB.plan(M.mid);MHS=HB.mhOn(M.mid)&&!(PLAN&&PLAN.tpl=='mh');
 const ms=MHS?HB.MH.map(qq=>({k:'pq',qq,q:()=>`<span class="tag" style="margin-bottom:4px;background:#efe9ff;color:#5b3fc4">Mental health</span><br>${esc(qq.text)}`,ui:()=>HB.pqUI(qq,A.pqv[qq.id]),ok:()=>1,ans:()=>HB.ansTxt(qq,A.pqv[qq.id]),skip:'Skip'})):[];
 if(!PLAN){S=[BASE[0]].concat(ms,BASE.slice(1));return}
 const ps=PLAN.q.map(qq=>({k:'pq',qq,q:()=>`<span class="tag ac" style="margin-bottom:4px">${esc(PLAN.by)} asked</span><br>${esc(qq.text)}`,ui:()=>HB.pqUI(qq,A.pqv[qq.id]),ok:()=>1,ans:()=>HB.ansTxt(qq,A.pqv[qq.id]),skip:'Skip'}));
 S=[BASE[0]].concat(ps,ms,BASE.slice(1))}
const mkA=L=>L.map(q=>{const v=A.pqv[q.id];return{id:q.id,text:q.text,type:q.type,unit:q.unit||'',v:v==null?'':v,a:HB.ansTxt(q,v),al:HB.qAlert(q,v),crisis:!!q.crisis}});
const mkPQ=()=>PLAN?mkA(PLAN.q):[],mkMH=()=>MHS?mkA(HB.MH):[];
function drawPlan(){const el=$('planban');const pm=PLAN&&PLAN.tpl=='mh';
 const mh=`<div class="mhbox"><label class="mhtog"><input type="checkbox" id="mhon"${MHS||pm?' checked':''}${pm?' disabled':''}><span><b>Mental health check-in</b><small>${pm?esc(PLAN.by)+' added this to your daily check-in.':'Add 7 quick questions about mood, worry and coping to each daily check-in.'}</small></span></label>${MHS||pm?`<div class="crisis">In crisis or thinking about hurting yourself? <a href="tel:988">Call or text 988</a>, any time, day or night. In an emergency, <a href="tel:911">call 911</a>.</div>`:''}</div>`;
 if(!PLAN){el.innerHTML=mh;bindMH();return}
 el.innerHTML=`<div class="planban"><img src="bot.svg" alt=""><div><b>${esc(PLAN.by)} added ${PLAN.q.length} question${PLAN.q.length==1?'':'s'} to your daily check-in</b><div class="mut" style="font-size:13px">${esc(PLAN.practice||'')}${PLAN.practice?' · ':''}through ${HB.fmt(PLAN.end,{month:'short',day:'numeric'})}${PLAN.time?' · reminder at '+esc(PLAN.time):''}</div>${PLAN.msg?`<p>"${esc(PLAN.msg)}"</p>`:''}</div></div>`+mh;bindMH()}
function bindMH(){const c=$('mhon');if(!c||c.disabled)return;c.onchange=()=>{readStep();HB.setMH(M.mid,c.checked);buildSteps();drawPlan();if(STEP>0)STEP=0;drawChat()}}
function readStep(){const k=S[STEP]&&S[STEP].k;if(k=='sym'&&$('oth'))A.other=$('oth').value.trim();if(k=='vit')['bp','temp','weight','glucose'].forEach(x=>A.vitals[x]=$('v_'+x).value.trim());if(k=='note'){A.note=$('note').value.trim();A.star=$('star').checked}
 if(k=='pq'){const id=S[STEP].qq.id;if($('pq_r'))A.pqv[id]=+$('pq_r').value;if($('pq_n'))A.pqv[id]=$('pq_n').value.trim();if($('pq_t'))A.pqv[id]=$('pq_t').value.trim()}}
function drawChat(){
 const today=HB.ymd(),done=D.entries.filter(e=>e.date==today);
 $('ctitle').textContent=EDIT?'Edit check-in':"Today's check-in";
 $('cstat').textContent=done.length?(done.length==1?'Checked in today':done.length+' check-ins today'):'Not yet today';$('cstat').className='tag'+(done.length?' ok':'');
 if(STEP<0){const e=D.entries.find(x=>x.id==LAST)||done[done.length-1];const f=e?HB.flags(e):[];
  $('chat').innerHTML=`<div class="bub b">${LAST?'Saved. ':'You already checked in today. '}${streakTxt()} I'll keep this for your next visit summary.</div>${f.length?HB.alertHTML(f):''}<div class="row" style="margin-top:4px"><button class="btn ghost sm" id="again">Add another note today</button><a class="btn sm" href="jerry-summary.html?m=${encodeURIComponent(M.mid)}">See my visit summary</a></div>`;
  $('again').onclick=()=>{A=blank();STEP=0;EDIT=null;drawChat()};return}
 let h='';for(let i=0;i<STEP;i++)h+=`<div class="bub b">${S[i].q()}</div><div class="bub u">${esc(S[i].ans())}</div>`;
 const s=S[STEP];
 h+=`<div class="bub b">${s.q()}</div><div class="ask">${s.ui()}<div id="live"></div><div class="row" style="margin-top:12px">${STEP?'<button type="button" class="btn ghost sm" id="bk">Back</button>':''}<span class="sp"></span>${s.skip?`<button type="button" class="btn ghost sm" id="sk">${s.skip}</button>`:''}<button type="button" class="btn sm" id="nx" ${s.ok()?'':'disabled style="opacity:.5"'}>${s.last?'Save check-in':'Next'}</button></div></div>`;
 h+=`<p class="mut" style="font-size:12px;margin:2px 0 0">Step ${STEP+1} of ${S.length}. Stays on this device.</p>`;
 $('chat').innerHTML=h;liveFlags();
 const ask=$('chat').querySelector('.ask');
 ask.onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.feel){A.feel=+d.feel;drawChat();if(S[STEP].auto)setTimeout(next,220);return}
  if(d.sym){readStep();togg(A.symptoms,d.sym);drawChat();return}
  if(d.area){togg(A.areas,d.area);b.classList.toggle('on');return}
  if(d.sq){A.sq=A.sq==d.sq?'':d.sq;drawChat();return}
  if(d.en){A.energy=+d.en;drawChat();return}
  if(d.mood){togg(A.mood,d.mood);b.classList.toggle('on');return}
  if(d.meds){A.meds=d.meds;drawChat();setTimeout(next,220);return}
  if(d.pqv!=null){const id=S[STEP].qq.id;A.pqv[id]=A.pqv[id]==d.pqv?'':d.pqv;drawChat();return}};
 if($('pq_r')){const id=S[STEP].qq.id;if(A.pqv[id]==null||A.pqv[id]==='')A.pqv[id]=+$('pq_r').value;$('pq_r').oninput=e=>{A.pqv[id]=+e.target.value;$('pq_rv').textContent=A.pqv[id]+'/10';liveFlags()}}
 if($('pq_n'))$('pq_n').oninput=()=>{readStep();liveFlags()};
 if($('pain'))$('pain').oninput=e=>{A.pain=+e.target.value;$('painv').textContent=A.pain+'/10';$('areas').classList.toggle('hidden',!A.pain);liveFlags()};
 if($('sleep'))$('sleep').oninput=e=>{A.sleep=+e.target.value;$('sleepv').textContent=A.sleep+' h'};
 ['v_bp','v_temp'].forEach(i=>{if($(i))$(i).oninput=()=>{readStep();liveFlags()}});
 if($('bk'))$('bk').onclick=()=>{readStep();STEP--;drawChat()};
 if($('sk'))$('sk').onclick=()=>{const k=S[STEP].k;if(k=='sym'){A.symptoms=[];A.other=''}if(k=='vit')A.vitals={bp:'',temp:'',weight:'',glucose:''};if(k=='pq')A.pqv[S[STEP].qq.id]='';STEP++;drawChat()};
 $('nx').onclick=next;
}
function liveFlags(){const f=HB.flags(Object.assign({},A,{pq:mkPQ(),mh:mkMH()}));$('live').innerHTML=f.length?HB.alertHTML(f):''}
let LAST=null;
function next(){readStep();if(!S[STEP].ok())return;if(S[STEP].last){saveEntry();return}STEP++;drawChat();const c=$('chat').querySelector('.ask');if(c)c.scrollIntoView({block:'nearest',behavior:'smooth'})}
function saveEntry(){const now=new Date();const sy=A.symptoms.concat(A.other?[A.other]:[]);
 const e={id:EDIT||('e'+now.getTime()),date:EDIT?(D.entries.find(x=>x.id==EDIT)||{}).date||HB.ymd():HB.ymd(),t:EDIT?(D.entries.find(x=>x.id==EDIT)||{}).t:now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}),feel:A.feel,pain:A.pain,areas:A.pain?A.areas:[],sleep:A.sleep,sq:A.sq,energy:A.energy,mood:A.mood,symptoms:sy,meds:A.meds,vitals:A.vitals,note:A.note,star:A.star};if(PLAN){e.pq=mkPQ();e.planBy=PLAN.by;e.planId=PLAN.id}if(MHS)e.mh=mkMH();
 if(EDIT)D.entries=D.entries.map(x=>x.id==EDIT?e:x);else D.entries.push(e);D.entries.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);HB.save(M.mid,D);LAST=e.id;EDIT=null;STEP=-1;A=blank();drawAll();$('ccard').scrollIntoView({block:'start',behavior:'smooth'})}
function days(){return [...new Set(D.entries.map(e=>e.date))]}
function streakTxt(){const s=new Set(days());let n=0;const d=new Date();while(s.has(HB.ymd(d))){n++;d.setDate(d.getDate()-1)}const w=[...s].filter(x=>(Date.now()-HB.pd(x))/864e5<7).length;return n>1?`That's ${n} days in a row.`:`You've checked in ${w} day${w==1?'':'s'} this week.`}
function drawStrip(){let h='';const by={};D.entries.forEach(e=>{(by[e.date]=by[e.date]||[]).push(e.feel)});
 for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=HB.ymd(d),v=by[k];const a=v?Math.round(v.reduce((x,y)=>x+y,0)/v.length):0;
  h+=`<div title="${HB.fmt(k)}${a?': '+HB.FEEL[a].w:': no note'}" style="${a?`background:${HB.FEEL[a].c};border-color:${HB.FEEL[a].c}`:''}"><span>${i%2?'':d.getDate()}</span></div>`}
 $('strip').innerHTML=h;$('legend').innerHTML=[5,4,3,2,1].map(v=>`<span class="row" style="gap:4px"><i class="dot" style="margin:0;background:${HB.FEEL[v].c}"></i>${HB.FEEL[v].w}</span>`).join('');
 const s=new Set(days());let n=0;const d=new Date();while(s.has(HB.ymd(d))){n++;d.setDate(d.getDate()-1)}$('streak').textContent=n?n+' day streak':''}
function drawHist(){const L=D.entries.slice().reverse().filter(e=>HF=='all'||e.star);
 $('hist').innerHTML=L.length?L.slice(0,60).map(e=>{const f=HB.flags(e);const v=e.vitals||{};const vit=[v.bp&&'BP '+v.bp,v.temp&&v.temp+' F',v.weight&&v.weight+' lb',v.glucose&&'Sugar '+v.glucose].filter(Boolean).join(' · ');
  return `<div class="ent"><i class="dot" style="background:${HB.FEEL[e.feel]?HB.FEEL[e.feel].c:'#ccc'}"></i><div class="bd"><div class="row" style="gap:6px"><b>${HB.fmt(e.date)}</b><span class="mut" style="font-size:13px">${esc(e.t||'')}</span>${e.star?'<span class="tag ac">For my doctor</span>':''}${e.sample?'<span class="tag">Sample</span>':''}${f.length?'<span class="tag" style="background:#fff1f0;color:#b42318">Needs attention</span>':''}</div>
  <div class="mut" style="font-size:13.5px">${HB.FEEL[e.feel]?HB.FEEL[e.feel].w:''} · ${e.pain?'Pain '+e.pain+'/10'+(e.areas&&e.areas.length?' ('+esc(e.areas.join(', '))+')':''):'No pain'} · Slept ${e.sleep} h${e.symptoms.length?' · '+esc(e.symptoms.join(', ')):''}${e.meds=='missed'?' · Missed a dose':''}${vit?' · '+esc(vit):''}</div>${e.pq&&e.pq.length?`<div class="mut" style="font-size:13px;margin-top:2px">${esc(e.planBy||'Doctor')}'s questions: ${e.pq.map(x=>`${esc(x.text.replace(/\?$/,''))}: <b style="color:${x.al?'#b42318':'var(--tx)'}">${esc(x.a)}</b>`).join(' · ')}</div>`:''}${e.mh&&e.mh.length?`<div class="mut" style="font-size:13px;margin-top:2px">Mental health: ${e.mh.filter(x=>x.v!=='').map(x=>`${esc(x.text.replace(/^Today, how much have you /,'').replace(/\?$/,''))}: <b style="color:${x.al?'#b42318':'var(--tx)'}">${esc(x.a)}</b>`).join(' · ')||'skipped'}</div>`:''}${e.note?`<p>${esc(e.note)}</p>`:''}
  <div class="row" style="gap:2px"><button class="x" data-ed="${e.id}">Edit</button><button class="x" data-st="${e.id}">${e.star?'Unflag':'Flag for doctor'}</button><button class="x" data-dl="${e.id}">Delete</button></div></div></div>`}).join(''):`<p class="mut" style="margin:6px 0 0">${HF=='star'?'No notes flagged for your doctor yet.':'No notes yet. Your first check-in takes about a minute.'}</p>`}
$('hist').onclick=e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
 if(d.dl){if(confirm('Delete this note?')){D.entries=D.entries.filter(x=>x.id!=d.dl);HB.save(M.mid,D);drawAll()}}
 if(d.st){const x=D.entries.find(x=>x.id==d.st);x.star=!x.star;HB.save(M.mid,D);drawHist()}
 if(d.ed){const x=D.entries.find(x=>x.id==d.ed);A=Object.assign(blank(),JSON.parse(JSON.stringify(x)));A.other='';A.symptoms=x.symptoms.filter(s=>HB.SYM.includes(s));A.other=x.symptoms.filter(s=>!HB.SYM.includes(s)).join(', ');A.vitals=Object.assign({bp:'',temp:'',weight:'',glucose:''},x.vitals||{});A.pqv={};(x.pq||[]).concat(x.mh||[]).forEach(p=>A.pqv[p.id]=p.v);EDIT=x.id;STEP=0;drawChat();$('ccard').scrollIntoView({behavior:'smooth'})}};
$('hf').onclick=e=>{const b=e.target.closest('button');if(!b)return;HF=b.dataset.f;[...$('hf').children].forEach(c=>c.classList.toggle('on',c==b));drawHist()};
$('lk').onclick=HB.lock;
$('exp').onclick=()=>HB.download('health-bot-'+M.first.toLowerCase()+'-'+HB.ymd()+'.json',JSON.stringify({member:M.name,exported:new Date().toISOString(),...D},null,2));
$('del').onclick=()=>{if(confirm('Delete every Jerry note for '+M.first+' on this device? This cannot be undone.')){ocLS.removeItem(HB.key(M.mid));D=HB.load(M.mid);STEP=0;A=blank();drawAll()}};
$('smp').onclick=()=>{HB.sample(M.mid);D=HB.load(M.mid);drawAll()};
$('smpx').onclick=()=>{HB.clearSample(M.mid);D=HB.load(M.mid);drawAll()};
function drawAll(){HB.memBar($('mem'),M,'jerry.html');HB.reqPatient($('reqs'),M.mid);buildSteps();drawPlan();drawChat();drawStrip();drawHist();document.querySelectorAll('.who').forEach(x=>x.textContent=M.first)}
HB.guard($('hb'),()=>{M=HB.member();D=HB.load(M.mid);A=blank();
 const q='?m='+encodeURIComponent(M.mid);$('nsum').href='jerry-summary.html'+q;$('tosum').href='jerry-summary.html'+q;
 if(D.entries.some(e=>e.date==HB.ymd()))STEP=-1;drawAll()});
