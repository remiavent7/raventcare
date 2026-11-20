/* Ravent Care desktop shell: sidebar navigation, quick actions, install button */
(function(){
  var MQ=window.matchMedia('(min-width:1180px)');
  var sections=[
    ['Overview','toprow'],['Benefits','bens'],['Records & connections','dataconn'],
    ['Care journey','cjcard'],['Lab results','labres'],['Medicare drugs','mdrug'],
    ['Pharmacy tracker','rxcard'],['Find a specialist','h2:Find a specialist'],
    ['Appointments','appts'],['Use it before you lose it','expire']
  ];
  function card(ref){
    var el;
    if(ref.indexOf('h2:')===0){var t=ref.slice(3);
      var hs=document.querySelectorAll('#s2 h2');for(var i=0;i<hs.length;i++){if(hs[i].textContent.trim().indexOf(t)===0){el=hs[i];break}}
    } else el=document.getElementById(ref);
    if(!el)return null;
    if(ref==='toprow')return document.querySelector('#s2 .top')||el;
    return el.closest('.card')||el;
  }
  var mark=document.querySelector('.brand svg');
  var nav=document.createElement('aside');nav.id='dsk';nav.setAttribute('aria-label','Ravent Care navigation');
  nav.innerHTML='<div class="db">'+(mark?mark.outerHTML:'')+'<span>Ravent <span style="color:var(--ac)">Care</span></span></div>'+
    '<div class="dsub" id="dskwho">Desktop · sample data</div>'+
    '<div class="dlab">Quick actions</div><div class="dqa">'+
    '<button type="button" data-c="qrbtn">Check-in QR code</button>'+
    '<button type="button" class="urg" data-c="urgbtn">+ Nearest urgent care</button>'+
    '<button type="button" data-c="back">Change card</button></div>'+
    '<div class="dlab">Your dashboard</div><nav id="dsknav"></nav>'+
    '<div class="dlab">More</div>'+
    '<a href="find.html" style="color:var(--ac);font-weight:700"><span class="dot"></span>Live doctor search</a>'+
    '<a href="benefits.html" style="color:var(--ac);font-weight:700"><span class="dot"></span>Check my benefits</a>'+
    '<a href="connect.html"><span class="dot"></span>Connect accounts</a>'+
    '<a href="partners.html"><span class="dot"></span>For practices</a>'+
    '<a href="practice.html"><span class="dot"></span>Practice view</a>'+
    '<a href="privacy.html"><span class="dot"></span>Privacy</a>'+
    '<div class="dfoot"><button type="button" class="dinst" id="dskinst" hidden>Install on this computer</button>'+
    '<div class="dnote" id="dskinote">Ravent Care demo. Benefits and records shown are sample data.</div></div>';
  document.body.insertBefore(nav,document.body.firstChild);
  nav.querySelectorAll('[data-c]').forEach(function(b){b.onclick=function(){var t=document.getElementById(b.dataset.c);if(t)t.click()}});
  var links=[];
  function buildNav(){
    var n=document.getElementById('dsknav');n.innerHTML='';links=[];
    sections.forEach(function(s){var c=card(s[1]);if(!c||c.hidden||c.offsetParent===null)return;
      c.setAttribute('data-dsk','');
      var a=document.createElement('a');a.href='#';a.innerHTML='<span class="dot"></span>'+s[0];
      a.onclick=function(e){e.preventDefault();c.scrollIntoView({behavior:'smooth',block:'start'})};
      n.appendChild(a);links.push([a,c]);});
    spy();
  }
  function spy(){var y=window.innerHeight*0.3,cur=null;
    links.forEach(function(l){if(l[1].getBoundingClientRect().top<=y)cur=l});
    if(!cur&&links.length)cur=links[0];
    links.forEach(function(l){l[0].classList.toggle('on',l===cur)});}
  window.addEventListener('scroll',spy,{passive:true});
  function update(){
    var s2=document.getElementById('s2');
    var on=MQ.matches&&s2&&!s2.classList.contains('hidden');
    document.body.classList.toggle('dsk-on',!!on);
    if(on){buildNav();var h=document.getElementById('hello');var w=document.getElementById('dskwho');
      if(h&&w&&h.textContent){var m=h.textContent.split('·');w.textContent=(m[0]||'').trim()+' · sample data'}}
  }
  var s2=document.getElementById('s2');
  if(s2){new MutationObserver(function(){setTimeout(update,50)}).observe(s2,{attributes:true,attributeFilter:['class'],subtree:true,childList:true})}
  if(MQ.addEventListener)MQ.addEventListener('change',update);else MQ.addListener(update);
  update();
  // Install as a desktop app (Chrome / Edge)
  var deferred=null,ib=document.getElementById('dskinst');
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;ib.hidden=false});
  ib.onclick=function(){if(!deferred)return;deferred.prompt();deferred.userChoice.then(function(){deferred=null;ib.hidden=true})};
  window.addEventListener('appinstalled',function(){ib.hidden=true;document.getElementById('dskinote').textContent='Installed. Open Ravent Care from your apps or dock.'});
  if('serviceWorker' in navigator && location.protocol==='https:'){navigator.serviceWorker.register('sw.js').catch(function(){})}
})();
