/* CollectCare carrier picker: choose a state first, then search every carrier that operates there.
   Needs carriers-data.js (window.CC_STATES, window.CC_CARRIERS). */
(function(){
var css='.ccw{position:relative}.ccl{position:absolute;left:0;right:0;top:calc(100% + 4px);z-index:60;max-height:320px;overflow:auto;background:var(--s1,#fff);border:1px solid var(--line,#d6e0ec);border-radius:12px;box-shadow:0 18px 40px -18px #10233f55;padding:6px;display:none;text-align:left}'+
'.ccl.on{display:block}.ccg{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--mut,#5b6b80);padding:8px 10px 4px}'+
'.cco{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:9px 10px;border-radius:8px;cursor:pointer;font-size:14.5px;color:var(--tx,#10233f);line-height:1.3}.cco small{color:var(--mut,#5b6b80);font-size:12px;white-space:nowrap;flex:none}'+
'.cco:hover,.cco.hl{background:var(--s2,#eef4fb)}.cco b{font-weight:600}.ccn{font-size:12.5px;color:var(--mut,#5b6b80);padding:8px 10px}'+
'.cchint{font-size:12px;color:var(--mut,#5b6b80);margin-top:5px;font-weight:500}input.ccin:disabled{opacity:.55;cursor:not-allowed}';
var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function tag(f){var t=[];if(f.indexOf('M')>-1)t.push('Medicare');if(f.indexOf('D')>-1)t.push('Medicaid');if(f.indexOf('T')>-1)t.push('TRICARE');if(f.indexOf('d')>-1)t.push('Dental');if(f.indexOf('v')>-1)t.push('Vision');return t.join(' · ')}
var C=window.CC_CARRIERS||[],S=window.CC_STATES||{};
C.forEach(function(r){r.s=r[2]?r[2].split('|'):[];r.l=r[0].toLowerCase()});
var POP=/^(medicare \(original|medicaid |aetna$|cigna$|unitedhealthcare$|humana$|kaiser|anthem|blue cross|bluecross|blue shield|bcbs|highmark|carefirst|premera|regence|wellmark|excellus|independence blue|horizon blue|florida blue|capital blue|elevance|molina|ambetter|centene|health net|oscar|wellcare|caresource|medica$|priority health|healthpartners|emblemhealth|fidelis|healthfirst|tufts|harvard pilgrim|l\.a\. care|scan health|tricare (east|west)|meridian|amerigroup|sunshine health|superior health|peach state|buckeye|aetna better health|unitedhealthcare community plan|geisinger|upmc|selecthealth|providence|moda|pacificsource|quartz|dean health|security health|avera|sanford|baylor scott|bcbs|banner|presbyterian|blue care network)/i;
var NATP=/^(medicare \(original|aetna$|cigna$|unitedhealthcare$|humana$|oscar health$|wellcare$)/i;
function otherState(n,st){for(var k in S){if(k!=st&&new RegExp('\\b'+S[k]+'\\b').test(n)&&!new RegExp('\\b'+S[st]+'\\b').test(n))return true}return false}
function popular(a,b,st){var p=a.filter(function(r){return POP.test(r[0])&&!/dental|vision|behavioral|federal|^centene/i.test(r[0])&&!otherState(r[0],st)}).concat(b.filter(function(r){return NATP.test(r[0])}));p.sort(function(x,y){return (x[1]=='CMS'?0:/^medicaid /i.test(x[0])?1:2)-(y[1]=='CMS'?0:/^medicaid /i.test(y[0])?1:2)||x.l.localeCompare(y.l)});return p.slice(0,30)}
function groups(state){var a=[],b=[],c=[];C.forEach(function(r){if(r.s.indexOf(state)>-1)a.push(r);else if(r.s.indexOf('US')>-1)b.push(r);else if(!r.s.length)c.push(r)});
 // pin the state Medicaid program and Original Medicare to the top
 a.sort(function(x,y){var px=/^medicaid /i.test(x[0])?0:1,py=/^medicaid /i.test(y[0])?0:1;return px-py||x.l.localeCompare(y.l)});
 b.sort(function(x,y){return (x[1]=='CMS'?0:1)-(y[1]=='CMS'?0:1)||x.l.localeCompare(y.l)});return[a,b,c,popular(a,b,state)]}
window.CC={states:S,carriers:C,tag:tag,
 find:function(name){var l=String(name||'').toLowerCase();for(var i=0;i<C.length;i++)if(C[i].l==l)return C[i];return null},
 mount:function(o){var sel=o.state,inp=o.input,w=document.createElement('div');w.className='ccw';inp.parentNode.insertBefore(w,inp);w.appendChild(inp);inp.classList.add('ccin');
  inp.setAttribute('role','combobox');inp.setAttribute('aria-autocomplete','list');inp.setAttribute('aria-expanded','false');inp.autocomplete='off';
  var L=document.createElement('div');L.className='ccl';L.id=inp.id+'-list';L.setAttribute('role','listbox');w.appendChild(L);inp.setAttribute('aria-controls',L.id);
  var hint=document.createElement('div');hint.className='cchint';w.appendChild(hint);
  if(sel.options.length<5){sel.innerHTML='<option value="">Choose your state first</option>'+Object.keys(S).sort(function(x,y){return S[x].localeCompare(S[y])}).map(function(k){return '<option value="'+k+'">'+esc(S[k])+'</option>'}).join('')}
  var G=null,hl=-1,shown=[],picked=null;
  function count(){if(!sel.value){hint.textContent='Pick your state to see every carrier that sells plans there.';return}
   hint.textContent=G[0].length+' plans in '+S[sel.value]+', '+G[1].length+' nationwide, plus '+G[2].length+' more plan administrators and employer plans. Type to search.'}
  function sync(){G=sel.value?groups(sel.value):null;inp.disabled=!sel.value;inp.placeholder=sel.value?'Search carriers in '+S[sel.value]:'Choose your state first';
   if(picked&&sel.value&&!(picked.s.indexOf(sel.value)>-1||picked.s.indexOf('US')>-1||!picked.s.length)){inp.value='';picked=null;o.onPick&&o.onPick(null)}count()}
  function render(){if(!G){L.classList.remove('on');return}var q=inp.value.trim().toLowerCase(),ws=q.split(/\s+/).filter(Boolean),h='',n=0;shown=[];
   var m=function(r){for(var i=0;i<ws.length;i++)if(r.l.indexOf(ws[i])<0)return false;return true};
   if(!q&&G[3].length){h+='<div class="ccg">Most common in '+esc(S[sel.value])+'</div>';G[3].forEach(function(r){var t=tag(r[3]);h+='<div class="cco" role="option" id="'+inp.id+'-o'+n+'" data-k="'+n+'"><b>'+esc(r[0])+'</b>'+(t?'<small>'+t+'</small>':'')+'</div>';shown.push(r);n++})}
   var names=['All plans in '+S[sel.value],'Nationwide','Other carriers, plan administrators and employer plans'];
   for(var g=0;g<3;g++){var lim=q?(g==2?40:80):(g==2?0:400),list=G[g].filter(m),part=list.slice(0,lim);
    if(!list.length)continue;h+='<div class="ccg">'+esc(names[g])+(list.length>part.length?' · showing '+part.length+' of '+list.length:'')+'</div>';
    if(!part.length)h+='<div class="ccn">Type a name to search '+list.length+' more.</div>';
    part.forEach(function(r){var t=tag(r[3]);h+='<div class="cco" role="option" id="'+inp.id+'-o'+n+'" data-k="'+n+'"><b>'+esc(r[0])+'</b>'+(t?'<small>'+t+'</small>':'')+'</div>';shown.push(r);n++})}
   if(!n)h='<div class="ccn">No match in '+esc(S[sel.value])+'. Type the carrier name exactly as it appears on your card, and we\'ll use that.</div>';
   L.innerHTML=h;hl=-1;L.classList.add('on');inp.setAttribute('aria-expanded','true')}
  function close(){L.classList.remove('on');inp.setAttribute('aria-expanded','false');inp.removeAttribute('aria-activedescendant')}
  function pick(r){picked=r;inp.value=r[0];close();o.onPick&&o.onPick(r);inp.dispatchEvent(new Event('change',{bubbles:true}))}
  function move(d){var els=L.querySelectorAll('.cco');if(!els.length)return;if(hl>-1)els[hl].classList.remove('hl');hl=(hl+d+els.length)%els.length;els[hl].classList.add('hl');els[hl].scrollIntoView({block:'nearest'});inp.setAttribute('aria-activedescendant',els[hl].id)}
  sel.addEventListener('change',function(){sync();o.onState&&o.onState(sel.value);if(sel.value){inp.focus();render()}});
  inp.addEventListener('focus',render);inp.addEventListener('input',function(){picked=null;render();o.onPick&&o.onPick(window.CC.find(inp.value))});
  inp.addEventListener('keydown',function(e){if(e.key=='ArrowDown'){e.preventDefault();if(!L.classList.contains('on'))render();move(1)}else if(e.key=='ArrowUp'){e.preventDefault();move(-1)}else if(e.key=='Enter'&&hl>-1&&L.classList.contains('on')){e.preventDefault();pick(shown[hl])}else if(e.key=='Escape')close()});
  L.addEventListener('mousedown',function(e){var x=e.target.closest('.cco');if(x){e.preventDefault();pick(shown[+x.dataset.k])}});
  document.addEventListener('click',function(e){if(!w.contains(e.target))close()});
  sync();
  return{set:function(state,name){sel.value=state||'';sync();var r=window.CC.find(name);inp.value=r?r[0]:(name||'');picked=r;o.onPick&&o.onPick(r)},get:function(){return{state:sel.value,name:inp.value.trim(),row:picked||window.CC.find(inp.value)}}}}};
})();
