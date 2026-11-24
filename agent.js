/* CollectCare Agent: rule-based in-browser assistant for the family dashboard.
   Prototype on sample data. It reads what is already on the page and runs dashboard actions.
   No data leaves the browser and no AI model is called. */
(function(){
  'use strict';
  var BOT='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(v){return '$'+Math.round(v).toLocaleString()}
  function card(id){var e=$(id);return e?(e.closest('.card')||e):null}
  function txt(id){var c=card(id);return c?c.innerText:''}
  function onDash(){var s2=$('s2');return !$('gate')&&s2&&!s2.classList.contains('hidden')}

  /* ---------- who is being viewed ---------- */
  function people(){try{return (typeof P!=='undefined'&&P)||[]}catch(e){return[]}}
  function viewing(){
    var h=($('hello')||{}).textContent||'',m=h.match(/viewing\s+([A-Za-z]+)/),ps=people();
    if(m){for(var i=0;i<ps.length;i++){if(ps[i].name.split(' ')[0].toLowerCase()===m[1].toLowerCase())return ps[i]}}
    return ps[0]||null;
  }
  function first(p){return p?p.name.split(' ')[0]:'you'}

  /* ---------- UI ---------- */
  var fab=document.createElement('button');
  fab.id='ccaFab';fab.type='button';fab.hidden=true;
  fab.setAttribute('aria-haspopup','dialog');fab.setAttribute('aria-controls','ccaP');
  fab.innerHTML='<span class="ic" style="color:var(--ac,#1f6fd1)">'+BOT+'</span>Ask CollectCare Agent';
  var pn=document.createElement('section');
  pn.id='ccaP';pn.hidden=true;pn.setAttribute('role','dialog');pn.setAttribute('aria-modal','false');pn.setAttribute('aria-labelledby','ccaT');
  pn.innerHTML='<div class="hd"><span class="av" style="color:#fff">'+BOT+'</span><div><b id="ccaT">CollectCare Agent</b><small id="ccaWho">Prototype · sample data</small></div><button type="button" class="x" id="ccaX" aria-label="Close agent">&times;</button></div>'+
    '<p class="note">Prototype on sample data. Not medical advice. In an emergency call 911. In a mental health crisis call or text 988.</p>'+
    '<div id="ccaLog" role="log" aria-live="polite" aria-relevant="additions"></div>'+
    '<div id="ccaChips" aria-label="Suggested questions"></div>'+
    '<form id="ccaF" autocomplete="off"><label for="ccaIn" class="sr-only">Ask the agent</label><input id="ccaIn" type="text" placeholder="Ask about benefits, refills, labs, care..." maxlength="300"><button type="submit">Send</button></form>';
  document.body.appendChild(fab);document.body.appendChild(pn);
  var log=$('ccaLog'),inp=$('ccaIn'),started=false;

  function add(role,html,cls){
    var d=document.createElement('div');d.className='m '+role+(cls?' '+cls:'');d.innerHTML=html;log.appendChild(d);
    log.scrollTop=log.scrollHeight;return d;
  }
  function acts(list){
    return '<div class="acts">'+list.map(function(a){
      if(a.href)return '<a href="'+esc(a.href)+'"'+(a.cls?' class="'+a.cls+'"':'')+'>'+esc(a.t)+'</a>';
      return '<button type="button" data-act="'+esc(a.act)+'"'+(a.arg?' data-arg="'+esc(a.arg)+'"':'')+(a.cls?' class="'+a.cls+'"':'')+'>'+esc(a.t)+'</button>';
    }).join('')+'</div>';
  }
  var CHIPS=['Book an appointment','What is left on my deductible?','Which refills are waiting?','Explain my lab results','Benefits expiring Dec 31','Next appointment','Find a cardiologist','Draft a message to my doctor','Get my records'];
  function chips(){$('ccaChips').innerHTML=CHIPS.map(function(c){return '<button type="button">'+esc(c)+'</button>'}).join('');}
  $('ccaChips').addEventListener('click',function(e){var b=e.target.closest('button');if(b)ask(b.textContent)});

  function open(){
    pn.hidden=false;fab.hidden=true;fab.setAttribute('aria-expanded','true');
    var p=viewing();$('ccaWho').textContent='Viewing '+(p?p.name:'the family')+' · sample data';
    if(!started){started=true;chips();greet()}
    setTimeout(function(){inp.focus()},30);
  }
  function close(){pn.hidden=true;fab.hidden=!onDash();fab.setAttribute('aria-expanded','false');fab.focus()}
  fab.onclick=open;$('ccaX').onclick=close;
  pn.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
  $('ccaF').addEventListener('submit',function(e){e.preventDefault();var v=inp.value.trim();if(!v)return;inp.value='';ask(v)});

  function greet(){
    var p=viewing();
    add('a','Hi, I\'m the CollectCare Agent. I can read '+esc(first(p))+'\'s benefits, refills, labs and appointments on this page and take you to the right step.'+
      '<ul><li>Book an appointment in a few taps</li><li>Explain costs and what\'s left this year</li><li>Track refills and upcoming visits</li><li>Find in-network care or urgent care</li><li>Draft a note to the care team or request records</li></ul>'+
      'Try a suggestion below or type a question.');
  }

  /* ---------- actions ---------- */
  function scrollTo(id){var c=id==='toprow'?document.querySelector('#s2 .top'):card(id);if(!c)return false;
    if(window.matchMedia('(max-width:560px)').matches)close();
    c.scrollIntoView({behavior:'smooth',block:'start'});c.style.transition='box-shadow .4s';c.style.boxShadow='0 0 0 3px #9cc3f5';setTimeout(function(){c.style.boxShadow=''},1800);return true}
  function clickId(id){var b=$(id);if(b){b.click();return true}return false}
  function switchTo(name){
    var fam=$('fam');if(!fam)return false;var bs=fam.querySelectorAll('button');
    for(var i=0;i<bs.length;i++){var b=bs[i].querySelector('b');
      if(b&&b.textContent.trim().toLowerCase()===name.toLowerCase()){bs[i].click();return true}}
    return false;
  }
  log.addEventListener('click',function(e){
    var b=e.target.closest('button[data-act]');if(!b)return;var a=b.dataset.act,g=b.dataset.arg;
    if(a==='scroll')scrollTo(g);
    else if(a==='click'){if(window.matchMedia('(max-width:560px)').matches)close();clickId(g)}
    else if(a==='copy'){var ta=b.closest('.m').querySelector('textarea');ta.select();
      (navigator.clipboard?navigator.clipboard.writeText(ta.value):Promise.reject()).then(function(){b.textContent='Copied'},function(){try{document.execCommand('copy');b.textContent='Copied'}catch(x){}})}
    else if(a==='ask')ask(g);
    else if(a==='bk1'){var pr=g.split('|');if(pr[1]==='more'){var v=VISITS[pr[0]];v.times=v.times.slice(1).concat(v.times[0]);}
      reply(VISITS[pr[0]].n+(pr[1]?' · more times':''),function(){if(pr[1]==='more'){var last=BK&&BK.slots[2]?BK.slots[2].d:null;var r=bookTimes(pr[0]);if(last){BK.slots=nextDays(3,last).map(function(d,i){return {d:d,t:BK.v.times[i]}});r=r.replace(/Soonest openings:[\s\S]*$/,'Next openings:'+acts(BK.slots.map(function(s,i){return {t:dstr(s.d)+' · '+s.t,act:'bk2',arg:String(i)}}).concat([{t:'More times',act:'bk1',arg:pr[0]+'|more'}])))}return r}return bookTimes(pr[0])})}
    else if(a==='bk2'){var sl=BK.slots[+g];reply(dstr(sl.d)+' · '+sl.t,function(){return bookConfirm(g)})}
    else if(a==='bk3'){var w=b.closest('.m').querySelector('.ccaWhy');var why=w?w.value.trim():'';b.disabled=true;reply('Confirm booking',function(){return bookDone(why)})}
  });

  /* ---------- answers ---------- */
  var SOS=/(chest pain|can'?t breathe|cannot breathe|trouble breathing|not breathing|stroke|face droop|slurred|unconscious|passed out|overdose|severe bleeding|bleeding a lot|suicid|kill myself|end my life|self[- ]harm|seizure|anaphyla|heart attack)/i;
  var SPECS=[['cardio','cardio','cardiologists'],['derm','derm','dermatologists'],['ortho|knee|hip|bone|joint','ortho','orthopedic doctors'],['neuro','neuro','neurologists'],['endo|diabet','endo','endocrinologists'],['gastro|\\bgi\\b','gi','gastroenterologists'],['pulmo|lung','pulm','pulmonologists'],['rheum','rheum','rheumatologists'],['urolog','uro','urologists'],['onco|cancer','onc','oncologists'],['psychiatr','psych','psychiatrists'],['physical therap','pt','physical therapists'],['therap|counsel','therapy','therapists'],['pediatr|kid|child','peds','pediatricians'],['ob.?gyn|gyneco','obgyn','OB-GYNs'],['ophthalm','ophth','ophthalmologists'],['eye|optom|glasses','opt','eye doctors'],['dent','dent','dentists'],['sleep','sleep','sleep doctors'],['allerg','allergy','allergists'],['\\bent\\b|\\bears?\\b|throat','ent','ENT doctors'],['primary|family doctor|pcp','primary','primary care doctors']];

  function costs(p){
    if(!p||!p.ded)return 'I couldn\'t find deductible details for this member.';
    var d=p.ded,o=p.oop,left=Math.max(0,d[1]-d[0]),ol=Math.max(0,o[1]-o[0]);
    var fam=($('famoop')||{}).textContent||'';
    if(/medicare/i.test(p.planName||'')){
      return '<b>'+esc(first(p))+' · '+esc(p.planName)+'</b><ul><li>Part B deductible: '+money(d[0])+' met of '+money(d[1])+' · <b>'+money(left)+' to go</b></li></ul>'+
        'With Medigap Plan G, most Medicare-approved care is covered once the Part B deductible is met. Original Medicare has no yearly out-of-pocket max, which is what the Medigap plan helps with. Part D drug costs are separate.'+
        acts([{t:'Show year at a glance',act:'scroll',arg:'glance'},{t:'Medicare drug changes',act:'scroll',arg:'mdrug'}]);
    }
    return '<b>'+esc(first(p))+' · '+esc(p.planName||p.plan||'')+'</b><ul>'+
      '<li>Deductible: '+money(d[0])+' met of '+money(d[1])+' · <b>'+money(left)+' to go</b></li>'+
      '<li>Out-of-pocket max: '+money(o[0])+' of '+money(o[1])+' · '+money(ol)+' until covered care is $0</li>'+
      (fam?'<li>'+esc(fam)+'</li>':'')+'</ul>'+
      'Until the deductible is met you pay the plan\'s negotiated rate for most care. Preventive care like a physical or flu shot is $0 now. Totals reset Jan 1.'+
      acts([{t:'Show year at a glance',act:'scroll',arg:'glance'},{t:'Check my benefits',href:'benefits.html'}]);
  }
  function refills(){
    var t=txt('rxcard');if(!t)return 'The pharmacy tracker isn\'t on this view.';
    var head=(t.match(/\d+ refills? waiting[^\n]*/)||[''])[0];
    var per=(t.match(/^[A-Z][a-z]+ · \d+ waiting$/gm)||[]);
    var lines=t.split('\n'),items=[];
    for(var i=0;i<lines.length-1;i++){if(/\b\d+\s?(mg|mcg|units?|ml)\b/i.test(lines[i])&&/(overdue|ready|due|waiting|request|sent|filled|transit|review)/i.test(lines[i+1]))items.push('<li>'+esc(lines[i])+' · <b>'+esc(lines[i+1])+'</b></li>')}
    return (head?'<b>'+esc(head)+'</b>':'Here\'s the refill picture.')+(per.length?'<ul>'+per.map(function(x){return '<li>'+esc(x)+'</li>'}).join('')+'</ul>':'')+
      (items.length?'Showing now:<ul>'+items.slice(0,4).join('')+'</ul>':'')+
      'Overdue prescriptions should be requested first. Your pharmacy and prescriber still confirm each refill.'+
      acts([{t:'Open pharmacy tracker',act:'scroll',arg:'rxcard'},{t:'Pharmacy connection',href:'pharmacy.html'}]);
  }
  function labs(){
    var t=txt('labres');if(!t)return 'No lab results are on this view.';
    var m=t.match(/What this means\n([^\n]+)/),when=t.match(/Most recent results:\s*([^\n.]+)/),next=t.match(/Next draw ([^\n]+)/);
    var c=t.match(/(\d+) tests\n(\d+) normal\n(\d+) high/);
    return '<b>Lab results'+(when?' · '+esc(when[1].split('·')[0].trim()):'')+'</b>'+(c?'<ul><li>'+c[1]+' tests: '+c[2]+' normal, '+c[3]+' high</li>'+(next?'<li>Next draw '+esc(next[1])+'</li>':'')+'</ul>':'')+
      (m?esc(m[1]):'')+' Bring questions about any high result to your doctor; they know your full history.'+
      acts([{t:'See all results',act:'scroll',arg:'labres'},{t:'Draft a question for my doctor',act:'ask',arg:'draft a message about my lab results'}]);
  }
  function appts(){
    var t=txt('appts');if(!t)return 'No appointments are on this view.';
    var L=t.split('\n').map(function(s){return s.trim()}).filter(Boolean);
    var i=L.findIndex(function(s){return /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/.test(s)});
    if(i<1)return 'You have appointments listed.'+acts([{t:'Show appointments',act:'scroll',arg:'appts'}]);
    return 'Next up: <b>'+esc(L[i-1].replace(/\s*(Returning|New)$/,''))+'</b><ul><li>'+esc(L[i])+'</li>'+(L[i+1]?'<li>'+esc(L[i+1])+'</li>':'')+'</ul>'+
      'A quick Health Bot check-in before the visit gives the doctor a summary of how you\'ve been feeling.'+
      acts([{t:'Show appointments',act:'scroll',arg:'appts'},{t:'Health Bot check-in',href:'healthbot.html'}]);
  }
  function expiring(){
    var t=txt('expire');if(!t)return 'Nothing is flagged as expiring.';
    var L=t.split('\n').map(function(s){return s.trim()}).filter(Boolean),out=[];
    for(var i=0;i<L.length-1;i++){if(/(left)$/i.test(L[i+1])&&L[i].length>3&&!/^[A-Z]$/.test(L[i]))out.push('<li>'+esc(L[i])+': <b>'+esc(L[i+1].replace(/ done left$/,' left'))+'</b></li>')}
    var days=(txt('glance').match(/(\d+) days left/)||[])[1];
    return '<b>Use it before Dec 31'+(days?' · '+days+' days left':'')+'</b><ul>'+out.slice(0,6).join('')+'</ul>'+
      (/FSA/.test(t)?'FSA dollars are lost after Dec 31, so dental or vision visits are a good place to start. HSA money rolls over.':'Visit counts reset Jan 1, so book any you need before year end.')+
      acts([{t:'Show these benefits',act:'scroll',arg:'expire'},{t:'Find in-network care',href:'find.html'}]);
  }
  function find(q){
    var s=null;for(var i=0;i<SPECS.length;i++){if(new RegExp(SPECS[i][0]).test(q)){s=SPECS[i];break}}
    var p=viewing(),city=p&&p.city?p.city:'';
    return 'I can search '+(s?'<b>'+esc(s[2])+'</b>':'doctors')+(city?' near '+esc(city):'')+' in the live provider directory. Confirm they take '+esc(first(p))+'\'s plan before booking.'+
      acts([{t:'Live doctor search',href:'find.html'+(s?'?s='+s[1]:'')},{t:'Find a specialist on this page',act:'scroll',arg:'h2find'}]);
  }
  function draft(q){
    var p=viewing(),topic='my care';
    if(/lab|result|cholesterol|a1c/.test(q))topic='my recent lab results';
    else if(/refill|prescri|medic|rx/.test(q))topic='a prescription refill';
    else if(/appoint|visit|schedul/.test(q))topic='my upcoming appointment';
    var body='Hello,\n\nThis is '+(p?p.name:'')+(p&&p.dob?' (DOB '+p.dob+')':'')+'. I have a question about '+topic+'.\n\n[Write your question here]\n\nThe best way to reach me is [phone or portal]. Thank you.';
    return 'Here\'s a starting draft. Edit it, then copy it into your doctor\'s patient portal. CollectCare doesn\'t send it in this prototype.'+
      '<label class="sr-only" for="ccaD'+log.children.length+'">Message draft</label><textarea id="ccaD'+log.children.length+'">'+esc(body)+'</textarea>'+
      acts([{t:'Copy message',act:'copy'},{t:'Bring a Health Bot summary',href:'healthbot-summary.html'}]);
  }
  function records(){
    return 'You have a federal right to your records, including visit notes, usually within 30 days. Connect your accounts to pull them in, or use the rights guide to send a request.'+
      acts([{t:'Connect accounts',href:'connect.html'},{t:'Your records rights',href:'law.html'},{t:'Show records',act:'scroll',arg:'dataconn'}]);
  }
  function notes(){
    return 'After a visit, your doctor\'s notes and home plan show up as a visit summary. Daily Health Bot check-ins add how you\'re doing between visits.'+
      acts([{t:'Open visit summary',href:'healthbot-summary.html'},{t:'Daily check-in',href:'healthbot.html'}]);
  }
  function urgent(){
    return 'For something that can\'t wait but isn\'t an emergency, urgent care is usually faster and cheaper than the ER. I can find the nearest one on this plan.'+
      acts([{t:'Nearest urgent care',act:'click',arg:'urgbtn',cls:'red'},{t:'Check-in QR code',act:'click',arg:'qrbtn'}]);
  }
  function medicare(){
    return 'The Medicare drug changes on this page apply to members with Medicare Part D, like Margaret, not the family\'s HDHP plan.'+
      acts([{t:'Show Medicare drugs',act:'scroll',arg:'mdrug'},{t:'View Margaret',act:'ask',arg:'show Margaret'}]);
  }
  function hsa(p){
    var b=p&&p.b||{},h=b.hsa,f=b.fsa;
    return '<ul>'+(h?'<li>HSA: '+esc(h[2])+'</li>':'')+(f?'<li>FSA: '+money(f[1]-f[0])+' left · '+esc(f[2])+'</li>':'')+'</ul>'+
      'HSA money rolls over every year. Limited-purpose FSA money must be used for dental or vision by Dec 31.'+
      acts([{t:'Show benefits',act:'scroll',arg:'bens'}]);
  }


  /* ---------- booking (demo: sample offices and times, nothing is sent) ---------- */
  var VISITS={
    primary:{n:'Primary care visit',prov:'Primary care office, Downtown Long Beach',dur:'20 min',times:['9:20 AM','1:40 PM','4:00 PM']},
    physical:{n:'Yearly physical',prov:'Primary care office, Downtown Long Beach',dur:'40 min',times:['8:30 AM','10:50 AM','2:15 PM'],prev:1},
    video:{n:'Video visit',prov:'Primary care, video visit',dur:'15 min',times:['12:10 PM','5:30 PM','7:15 PM']},
    cardio:{n:'Cardiology visit',prov:'Heart and vascular clinic, Long Beach',dur:'30 min',times:['10:00 AM','1:30 PM','3:45 PM']},
    derm:{n:'Dermatology visit',prov:'Dermatology office, Long Beach',dur:'20 min',times:['9:00 AM','11:30 AM','2:40 PM']},
    ortho:{n:'Orthopedics visit',prov:'Orthopedic office, Long Beach',dur:'30 min',times:['8:45 AM','12:30 PM','3:15 PM']},
    therapy:{n:'Therapy session',prov:'Counseling practice, Long Beach (in person or video)',dur:'50 min',times:['11:00 AM','4:00 PM','6:00 PM'],ben:'therapy'},
    pt:{n:'Physical therapy',prov:'Physical therapy clinic, Long Beach Blvd',dur:'45 min',times:['7:30 AM','12:00 PM','5:15 PM'],ben:'pt'},
    eye:{n:'Eye exam',prov:'Optometry office, Long Beach',dur:'30 min',times:['10:20 AM','1:00 PM','4:30 PM'],ben:'eye'},
    lab:{n:'Lab work',prov:'Lab patient service center',dur:'15 min',times:['7:00 AM','7:30 AM','8:15 AM']}
  };
  var BK=null;
  function nextDays(n,start){var out=[],d=start?new Date(start):new Date();d.setHours(12,0,0,0);
    var HOL={'2026-11-26':1,'2026-12-25':1,'2027-01-01':1,'2027-01-18':1};
    while(out.length<n){d.setDate(d.getDate()+1);var w=d.getDay(),k=d.getFullYear()+'-'+('0'+(d.getMonth()+1)).slice(-2)+'-'+('0'+d.getDate()).slice(-2);if(w&&w<6&&!HOL[k])out.push(new Date(d))}return out}
  function dstr(d){return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
  function visitKey(s){
    if(/physical|annual|yearly check|wellness/.test(s))return 'physical';
    if(/video|virtual|telehealth/.test(s))return 'video';
    if(/lab|blood work|blood draw/.test(s))return 'lab';
    if(/physical therap|\bpt\b/.test(s))return 'pt';
    if(/therap|counsel/.test(s))return 'therapy';
    if(/cardio|heart/.test(s))return 'cardio';
    if(/derm|skin|rash/.test(s))return 'derm';
    if(/ortho|knee|hip|joint|bone/.test(s))return 'ortho';
    if(/eye|vision|optom/.test(s))return 'eye';
    if(/primary|sick|pcp|family doctor|checkup/.test(s))return 'primary';
    return '';
  }
  function costLine(p,v){
    var b=(p&&p.b)||{},med=/medicare/i.test((p&&p.planName)||'');
    if(v.prev)return '$0 · preventive care';
    if(v.ben==='eye'&&b.eye&&!med)return '$10 copay · vision plan';
    if(med)return (p.ded&&p.ded[0]>=p.ded[1])?'Likely $0 · Part B deductible met, Medigap Plan G':'Part B deductible applies, then Medigap Plan G';
    if(p&&p.ded){var left=p.ded[1]-p.ded[0];return left>0?'Plan rate until '+money(left)+' deductible is met · pay with HSA':'$0 · deductible met'}
    return 'Cost shown after the office confirms';
  }
  function bookStart(p){
    var opts=[['Primary care visit','primary'],['Video visit','video'],['Yearly physical','physical'],['Lab work','lab'],['Cardiology','cardio'],['Physical therapy','pt'],['Therapy','therapy'],['Eye exam','eye']];
    return 'Happy to book for <b>'+esc(first(p))+'</b>. What kind of visit?'+acts(opts.map(function(o){return {t:o[0],act:'bk1',arg:o[1]}}))+
      '<span style="font-size:12px;color:var(--mut,#4d6180)">Or tell me who it\'s for, like "book Margaret a cardiology visit."</span>';
  }
  function bookTimes(key){
    var p=viewing(),v=VISITS[key],b=(p&&p.b)||{},note='',start=null;
    if(v.prev&&b.physical&&b.physical[0]>=b.physical[1]){note=esc(first(p))+'\'s 2026 physical is already used. The next one is $0 starting Jan 1, so here are early January times.';start=new Date(2026,11,31)}
    if(v.ben&&b[v.ben]&&v.ben!=='eye'){var u=b[v.ben];if(u[1]-u[0]>0&&u[1]<99)note=esc(u[1]-u[0])+' '+(v.ben==='pt'?'visits':'sessions')+' left this year on '+esc(first(p))+'\'s plan.'}
    var days=nextDays(3,start),slots=days.map(function(d,i){return {d:d,t:v.times[i]}});
    BK={key:key,v:v,p:p,slots:slots,why:''};
    return '<b>'+esc(v.n)+'</b> · '+esc(v.prov)+'<ul><li>In network for '+esc(p?p.planName:'this plan')+' (sample)</li><li>'+esc(costLine(p,v))+'</li></ul>'+(note?note+'<br>':'')+
      'Soonest openings:'+acts(slots.map(function(s,i){return {t:dstr(s.d)+' · '+s.t,act:'bk2',arg:String(i)}}).concat([{t:'More times',act:'bk1',arg:key+'|more'}]));
  }
  function bookConfirm(i){
    var s=BK.slots[+i];BK.sel=s;
    return 'Ready to book?<ul><li><b>'+esc(BK.v.n)+'</b> for '+esc(BK.p?BK.p.name:'')+'</li><li>'+esc(dstr(s.d))+' at '+esc(s.t)+' · '+esc(BK.v.dur)+'</li><li>'+esc(BK.v.prov)+'</li><li>Insurance card and photo ID already on file</li></ul>'+
      '<label for="ccaWhy'+log.children.length+'" style="font-size:13px;font-weight:700">Reason for the visit (optional)</label><input id="ccaWhy'+log.children.length+'" class="ccaWhy" type="text" maxlength="120" placeholder="e.g. follow up on blood pressure" style="width:100%;box-sizing:border-box;margin-top:4px;padding:8px;border:1px solid var(--line,#d6e2f0);border-radius:10px;font:14px Satoshi,system-ui,sans-serif">'+
      acts([{t:'Confirm booking',act:'bk3'},{t:'Pick another time',act:'bk1',arg:BK.key}]);
  }
  function ics(){
    var s=BK.sel,t=s.t.match(/(\d+):(\d+) (AM|PM)/),h=(+t[1]%12)+(t[3]=='PM'?12:0),d=new Date(s.d);d.setHours(h,+t[2],0,0);
    var e=new Date(d.getTime()+parseInt(BK.v.dur)*60000),z=function(n){return ('0'+n).slice(-2)},f=function(x){return x.getFullYear()+z(x.getMonth()+1)+z(x.getDate())+'T'+z(x.getHours())+z(x.getMinutes())+'00'};
    var body=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CollectCare//Agent demo//EN','BEGIN:VEVENT','UID:cca-'+Date.now()+'@collectmycare.com','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d+/,''),'DTSTART:'+f(d),'DTEND:'+f(e),
      'SUMMARY:'+BK.v.n+' (CollectCare demo)','LOCATION:'+BK.v.prov,'DESCRIPTION:Sample booking from the CollectCare Agent prototype.','BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY','DESCRIPTION:Reminder','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,'+encodeURIComponent(body);
  }
  function bookDone(why){
    var s=BK.sel;BK.why=why;
    var h='<b>Booked · '+esc(BK.v.n)+'</b><ul><li>'+esc(dstr(s.d))+' at '+esc(s.t)+' · '+esc(BK.v.prov)+'</li><li>For '+esc(BK.p?BK.p.name:'')+(why?' · '+esc(why):'')+'</li><li>Reminder the day before, plus a Health Bot check-in so the doctor sees how '+esc(first(BK.p))+' has been feeling</li><li>Show the check-in QR at the front desk; the card is already shared</li></ul>'+
      '<span style="font-size:12px;color:var(--mut,#4d6180)">Demo booking: sample office and times. Nothing was sent to a real office.</span>'+
      '<div class="acts"><a href="'+ics()+'" download="collectcare-appointment.ics">Add to calendar</a><button type="button" data-act="click" data-arg="qrbtn">Check-in QR</button><a href="healthbot.html">Health Bot check-in</a></div>';
    return h;
  }
  function respond(q){
    var s=q.toLowerCase(),p=viewing(),ps=people();
    if(SOS.test(s))return {h:'<b>This could be an emergency. Call 911 now</b> or go to the nearest emergency room. For thoughts of suicide or self-harm, call or text <b>988</b>. Don\'t wait for an app.'+
      acts([{t:'Call 911',href:'tel:911',cls:'red'},{t:'Call or text 988',href:'tel:988',cls:'red'}]),c:'sos'};
    for(var i=0;i<ps.length;i++){var f=ps[i].name.split(' ')[0].toLowerCase();
      if(new RegExp('\\b(show|view|switch|open|see)\\b.*\\b'+f+'\\b').test(s)){
        var ok=switchTo(ps[i].name.split(' ')[0]);
        if(ok){setTimeout(function(){$('ccaWho').textContent='Viewing '+(viewing()||{}).name+' · sample data'},150);
          return {h:'Now viewing <b>'+esc(ps[i].name)+'</b> ('+esc(ps[i].rel)+'). Ask me about '+esc(first(ps[i]))+'\'s costs, refills or appointments.'}}
      }}
    if(/\bbook\b|make an appointment|schedule (a|an|my)|set up (a|an) (visit|appointment)|see a doctor|need an appointment/.test(s)){
      for(var j=0;j<ps.length;j++){var fn=ps[j].name.split(' ')[0];if(new RegExp('\\b'+fn.toLowerCase()+'\\b').test(s)&&fn!==first(p)){switchTo(fn);p=ps[j];setTimeout(function(){$('ccaWho').textContent='Viewing '+(viewing()||{}).name+' · sample data'},150)}}
      var k=visitKey(s);return {h:k?bookTimes(k):bookStart(p)};
    }
    if(/^(hi|hello|hey|help|what can you do|menu)\b/.test(s))return {h:'I can help with costs, refills, labs, appointments, finding care, records and messages to your care team. Pick a suggestion below.'};
    if(/urgent|walk.?in|after hours|nearest|clinic near/.test(s))return {h:urgent()};
    if(/911|emergenc|\ber\b/.test(s))return {h:'If you think it\'s an emergency, call 911 or go to the nearest ER. For something that can wait a few hours, urgent care is an option.'+acts([{t:'Call 911',href:'tel:911',cls:'red'},{t:'Nearest urgent care',act:'click',arg:'urgbtn'}]),c:'sos'};
    if(/draft|message|write|email|ask my doctor|note to/.test(s))return {h:draft(s)};
    if(/deductible|out.of.pocket|oop|how much|cost|owe|pay|spent|max/.test(s))return {h:costs(p)};
    if(/hsa|fsa|flex|health savings/.test(s))return {h:hsa(p)};
    if(/refill|pharmac|prescri|\brx\b|medicat|pickup|pick up/.test(s))return {h:refills()};
    if(/lab|result|blood|cholesterol|ldl|a1c|test/.test(s))return {h:labs()};
    if(/expir|lose it|use it|left|dec(ember)? 31|unused|remaining/.test(s))return {h:expiring()};
    if(/appoint|next visit|schedul|upcoming|calendar/.test(s))return {h:appts()};
    if(/visit note|visit summary|summary|notes|after.?visit|home plan|check.?in|health ?bot/.test(s))return {h:notes()};
    if(/record|chart|mychart|epic|portal|hipaa|right/.test(s))return {h:records()};
    if(/medicare|part d|wegovy|zepbound|ozempic|weight/.test(s))return {h:medicare()};
    if(/qr|check.?in code|insurance card|member id/.test(s))return {h:'Your check-in QR code holds the insurance card details for the front desk.'+acts([{t:'Show check-in QR',act:'click',arg:'qrbtn'}])};
    if(/find|doctor|specialist|provider|in.network|dentist|therap|cardio|derm|ortho|eye/.test(s))return {h:find(s)};
    if(/benefit|cover|plan/.test(s))return {h:'Here\'s what '+esc(first(p))+'\'s plan covers this year, with what\'s been used and what\'s left.'+acts([{t:'Show benefits',act:'scroll',arg:'bens'},{t:'Check my benefits',href:'benefits.html'}])};
    if(/symptom|pain|sick|fever|cough|hurt|rash|dizzy/.test(s))return {h:'I can\'t diagnose symptoms. If it\'s severe or sudden, call 911. Otherwise, log it in a Health Bot check-in so your doctor sees it, or visit urgent care.'+
      acts([{t:'Health Bot check-in',href:'healthbot.html'},{t:'Nearest urgent care',act:'click',arg:'urgbtn'},{t:'Draft a message',act:'ask',arg:'draft a message about a symptom'}])};
    return {h:'I\'m not sure about that one yet. In this prototype I can help with:'+acts(['Book an appointment','What is left on my deductible?','Which refills are waiting?','Explain my lab results','Next appointment','Find a doctor','Get my records'].map(function(t){return {t:t,act:'ask',arg:t}}))};
  }
  function reply(label,fn){
    add('u',esc(label));var t=add('a','<span class="typing">Checking openings…</span>');
    setTimeout(function(){try{t.innerHTML=fn()}catch(e){t.innerHTML='Something went wrong. Try again.'}log.scrollTop=log.scrollHeight},400);
  }
  function ask(q){
    add('u',esc(q));
    var t=add('a','<span class="typing">Checking the dashboard…</span>');
    setTimeout(function(){
      var r;try{r=respond(q)}catch(e){r={h:'Something went wrong reading the page. Try again.'}}
      t.innerHTML=r.h;if(r.c)t.classList.add(r.c);log.scrollTop=log.scrollHeight;
    },350);
  }
  // "Find a specialist" card has no id; give it one for scrolling
  function tagFind(){var hs=document.querySelectorAll('#s2 h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.trim().indexOf('Find a specialist')===0&&!hs[i].id)hs[i].id='h2find'}}

  /* show the launcher only on the dashboard */
  function sync(){tagFind();if(pn.hidden)fab.hidden=!onDash();else if(!onDash()){pn.hidden=true;fab.hidden=true}}
  var s2=$('s2');if(s2)new MutationObserver(function(){setTimeout(sync,60)}).observe(s2,{attributes:true,attributeFilter:['class']});
  new MutationObserver(function(){if(!$('gate'))setTimeout(sync,60)}).observe(document.body,{childList:true});
  sync();
  window.CCAgent={open:open,close:close,ask:ask};
})();
