/* CollectCare Agent for the private beta: a rule-based helper that answers from the signed-in family's own data
   (read through window.CCB from beta.js) and runs dashboard actions. No AI model is called and nothing leaves the browser,
   except the same Supabase and NPI registry requests the dashboard already makes. */
(function () {
  'use strict';
  if (!window.CCB) return;
  const B = window.CCB, H = B.helpers;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = id => document.getElementById(id);
  const SPARK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';

  const fab = document.createElement('button');
  fab.id = 'ccaFab'; fab.type = 'button'; fab.hidden = true;
  fab.setAttribute('aria-haspopup', 'dialog'); fab.setAttribute('aria-controls', 'ccaP');
  fab.innerHTML = '<span class="ic">' + SPARK + '</span>Ask CollectCare Agent';
  const pn = document.createElement('section');
  pn.id = 'ccaP'; pn.hidden = true; pn.setAttribute('role', 'dialog'); pn.setAttribute('aria-modal', 'false'); pn.setAttribute('aria-labelledby', 'ccaT');
  pn.innerHTML = '<div class="hd"><span class="av">' + SPARK + '</span><div><b id="ccaT">CollectCare Agent</b><small id="ccaWho">Private beta</small></div><button type="button" class="x" id="ccaX" aria-label="Close agent">&times;</button></div>' +
    '<p class="note">Answers come only from what your family added to CollectCare. Not medical advice. In an emergency call 911. In a mental health crisis call or text 988.</p>' +
    '<div id="ccaLog" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<div id="ccaChips" aria-label="Suggested questions"></div>' +
    '<form id="ccaF" autocomplete="off"><label for="ccaIn" class="sr-only">Ask the agent</label><input id="ccaIn" type="text" placeholder="Ask about benefits, urgent care, meds, Jerry..." maxlength="300"><button type="submit">Send</button></form>';
  document.body.appendChild(fab); document.body.appendChild(pn);
  const log = $('ccaLog'), inp = $('ccaIn');
  let started = false;

  function add(role, html, cls) { const d = document.createElement('div'); d.className = 'm ' + role + (cls ? ' ' + cls : ''); d.innerHTML = html; log.appendChild(d); log.scrollTop = log.scrollHeight; return d; }
  function acts(list) { return '<div class="acts">' + list.map(a => a.href ? `<a href="${esc(a.href)}"${a.ext ? ' target="_blank" rel="noopener"' : ''}${a.red ? ' class="red"' : ''}>${esc(a.t)}</a>` : `<button type="button" data-a="${esc(a.a)}"${a.ds ? ` data-ds="${esc(JSON.stringify(a.ds))}"` : ''}${a.red ? ' class="red"' : ''}>${esc(a.t)}</button>`).join('') + '</div>'; }
  function chips(list) { $('ccaChips').innerHTML = list.map(c => `<button type="button" data-q="${esc(c)}">${esc(c)}</button>`).join(''); }
  const CHIPS = ['How much have I spent this year?', 'Nearest urgent care', 'What do visits cost?', 'My medications', 'Upcoming appointments', 'Check in with Jerry', 'Show my check-in QR'];

  function ctx() {
    const s = B.state(), m = s.members.find(x => x.id === s.cur) || null;
    const mi = m ? s.items.filter(x => x.member_id === m.id) : [];
    const p = m ? H.primaryIns(mi) : null;
    return { s, m, mi, p, d: p ? p.data : {}, f: m ? H.first(m.full_name) : 'you', you: m && m.relationship === 'self' };
  }
  const poss = c => c.you ? 'your' : esc(c.f) + '\u2019s';

  function open() {
    pn.hidden = false; fab.hidden = true; const c = ctx();
    $('ccaWho').textContent = c.m ? 'Viewing ' + c.f + ' \u00b7 private beta' : 'Private beta';
    if (!started) { started = true; add('a', `Hi${c.s.user && c.s.user.user_metadata && c.s.user.user_metadata.display_name ? ' ' + esc(H.first(c.s.user.user_metadata.display_name)) : ''}. I can answer questions from what\u2019s saved for ${c.m ? esc(c.f) : 'your family'}: costs, deductible, urgent care near home, medications, appointments and Jerry check-ins. I can also open things for you.`); chips(CHIPS); }
    setTimeout(() => inp.focus(), 30);
  }
  function close() { pn.hidden = true; fab.hidden = false; fab.focus(); }
  fab.addEventListener('click', open);
  $('ccaX').addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pn.hidden) close(); });
  $('ccaChips').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) ask(b.dataset.q); });
  $('ccaF').addEventListener('submit', e => { e.preventDefault(); const q = inp.value.trim(); if (q) { inp.value = ''; ask(q); } });
  log.addEventListener('click', e => {
    const b = e.target.closest('button[data-a]'); if (!b) return;
    const ds = b.dataset.ds ? JSON.parse(b.dataset.ds) : {};
    if (b.dataset.a === 'select') { B.select(ds.id); $('ccaWho').textContent = 'Viewing ' + ds.n + ' \u00b7 private beta'; add('a', 'Now viewing ' + esc(ds.n) + '.'); return; }
    if (b.dataset.a === 'jump') { const el = document.getElementById(ds.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    B.run(b.dataset.a, ds);
  });

  // Show the button only on the signed-in family dashboard.
  function sync() { const on = document.body.classList.contains('dsk-on') || !!(document.getElementById('vFamily') && !document.getElementById('vFamily').hidden && B.state().user); if (!on) { fab.hidden = true; pn.hidden = true; } else if (pn.hidden) fab.hidden = false; }
  new MutationObserver(sync).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden', 'class'] });
  sync();

  function money(c, k) { return c.d[k] ? esc(c.d[k]) : null; }
  function ask(q) {
    add('u', esc(q));
    const t = q.toLowerCase(), c = ctx();
    const r = answer(t, c);
    r.h = r.h.replace(/^([a-z])/, x => x.toUpperCase());
    setTimeout(() => { add('a', r.h, r.cls); if (r.chips) chips(r.chips); }, 120);
  }

  function answer(t, c) {
    // Safety first
    if (/suicid|kill myself|self.?harm|hurt myself|end my life/.test(t)) return { cls: 'sos', h: 'You don\u2019t have to go through this alone. Call or text <b>988</b> now to reach the Suicide and Crisis Lifeline, any time. If you\u2019re in immediate danger, call <b>911</b>.' + acts([{ t: 'Call or text 988', href: 'tel:988', red: 1 }, { t: 'Call 911', href: 'tel:911', red: 1 }]) };
    if (/911|emergenc|chest pain|can.?t breathe|short of breath|stroke|unconscious|severe bleeding/.test(t)) return { cls: 'sos', h: 'If this could be an emergency, call <b>911</b> or go to the nearest emergency room now. Under the federal No Surprises Act, emergency care is billed at in-network cost sharing even at an out-of-network hospital.' + (c.d.c_er ? ` ${poss(c)} plan lists the ER at <b>${esc(c.d.c_er)}</b>.` : '') + acts([{ t: 'Call 911', href: 'tel:911', red: 1 }]) };
    if (!c.m) return { h: 'Add yourself to CollectCare first, then I can answer from your information.' + acts([{ t: 'Add yourself', a: 'addMember' }]) };

    // Switch person
    const who = c.s.members.find(x => new RegExp('\\b' + H.first(x.full_name).toLowerCase().replace(/[^a-z]/g, '') + '\\b').test(t) && x.id !== c.m.id);
    if (who && /show|switch|view|open|look at|go to/.test(t)) return { h: 'Switch to ' + esc(H.first(who.full_name)) + '?' + acts([{ t: 'View ' + H.first(who.full_name), a: 'select', ds: { id: who.id, n: H.first(who.full_name) } }]) };

    if (/^(hi|hello|hey|help|what can you do|menu)\b/.test(t)) return { h: 'Ask me about ' + poss(c) + ' deductible and costs, urgent care near home, doctors, medications, allergies, appointments, the check-in QR code or Jerry. I only use what\u2019s saved in CollectCare.', chips: CHIPS };

    if (/urgent|walk.?in|after hours|nearest|clinic near|close to (me|home)/.test(t)) {
      const s = c.s, n = B.near();
      let h = s.home ? `Closest urgent care to home (${esc(H.homeCity(s.home))})` : 'Add your home address and I\u2019ll list the closest urgent care to home.';
      if (s.home && n && n.length) h += ':<ul>' + n.slice(0, 3).map(p => `<li><b>${esc(p.name)}</b>, ${p.d < 0.1 ? 'under 0.1' : p.d.toFixed(1)} mi \u00b7 ${esc(p.addr)}${p.tel ? ` \u00b7 <a href="tel:+1${p.tel}">call</a>` : ''}</li>`).join('') + '</ul>';
      else if (s.home) h += ' are still loading. Open the search to see the full list.';
      if (c.d.c_urgent) h += ` ${poss(c)} plan lists urgent care at <b>${esc(c.d.c_urgent)}</b> in network. Call ahead to confirm the clinic is in network.`;
      return { h: h + acts([{ t: 'Open urgent care search', a: 'qUrgent' }].concat(s.home ? [] : [{ t: 'Add home address', a: 'editHome' }])) };
    }
    if (/home|address|where (do|does) (i|we) live|zip/.test(t)) {
      const hm = c.s.home;
      return { h: hm ? `Home is saved as <b>${esc(H.homeFull(hm))}</b>. Care searches and distances start from there.` + acts([{ t: 'Change home address', a: 'editHome' }]) : 'No home address yet. Add one and care searches, nearest urgent care and distances will start from home.' + acts([{ t: 'Add home address', a: 'editHome' }]) };
    }
    if (/jerry|health ?bot|check.?in with|feeling|how (do|am) i feel|symptom|daily note|visit summary/.test(t)) {
      const D = H.jerryData(c.m.id), n = (D.entries || []).length, last = n ? D.entries[D.entries.length - 1] : null;
      const W = [null, 'bad', 'not great', 'okay', 'good', 'great'];
      let h = n ? `${esc(c.f)} has ${n} Jerry note${n === 1 ? '' : 's'} on this device. Last check-in ${esc(last.date)}: feeling ${W[last.feel] || 'not recorded'}${last.pain ? ', pain ' + last.pain + '/10' : ''}.` : `${esc(c.f)} hasn\u2019t checked in with Jerry on this device yet. It takes about a minute.`;
      h += ' Before a visit, Jerry turns the notes into a one-page summary. Notes stay on this device.';
      return { h: h + acts([{ t: 'Check in with Jerry', href: 'jerry.html?m=' + encodeURIComponent(c.m.id) }, { t: 'Visit summary', href: 'jerry-summary.html?m=' + encodeURIComponent(c.m.id) }]) };
    }
    if (/qr|check.?in code|front desk|insurance card|member id|group number|my card/.test(t)) {
      if (!c.p) return { h: `No insurance card saved for ${esc(c.f)} yet.` + acts([{ t: 'Add insurance', a: 'addItem', ds: { kind: 'insurance' } }]) };
      return { h: `${esc(c.d.plan || 'Insurance')}${c.d.member_id ? ' \u00b7 Member ID <b>' + esc(c.d.member_id) + '</b>' : ''}${c.d.group ? ' \u00b7 Group ' + esc(c.d.group) : ''}${c.d.phone ? ' \u00b7 Member services ' + esc(c.d.phone) : ''}. The check-in QR code shows these to the front desk.` + acts([{ t: 'Show check-in QR', a: 'qr' }]) };
    }
    if (/deductible|out.of.pocket|oop|spent|how much (have|did)|max|met/.test(t)) {
      if (!c.p) return { h: `Add ${poss(c)} insurance and I can track the deductible and out-of-pocket maximum.` + acts([{ t: 'Add insurance', a: 'addItem', ds: { kind: 'insurance' } }]) };
      const ded = H.num(c.d.ded), dm = H.num(c.d.ded_met) || 0, oop = H.num(c.d.oop), om = H.num(c.d.oop_met) || 0, py = H.planYear(c.d);
      if (ded == null && oop == null) return { h: 'No deductible amounts saved yet. Add them from your plan\u2019s website' + (c.s.ben ? ', or check with your insurer now.' : '.') + acts([{ t: 'Update amounts', a: 'editItem', ds: { id: c.p.id } }].concat(c.s.ben ? [{ t: 'Check with my insurer', a: 'checkBen', ds: { id: c.p.id } }] : [])) };
      let h = '';
      if (ded != null) h += `Deductible: <b>${H.usd(dm)}</b> of ${H.usd(ded)} met${ded - dm > 0 ? ', ' + H.usd(ded - dm) + ' to go' : ''}. `;
      if (oop != null) h += `Out-of-pocket: <b>${H.usd(om)}</b> of ${H.usd(oop)}${oop - om > 0 ? ', ' + H.usd(oop - om) + ' until covered care is 100%' : ', so covered in-network care should be $0'}. `;
      h += `${py.left} days left before it resets. ` + (c.d.src === 'insurer' ? 'From your insurer\u2019s last check.' : 'Entered by you.');
      return { h: h + acts(c.s.ben ? [{ t: 'Refresh from insurer', a: 'checkBen', ds: { id: c.p.id } }] : [{ t: 'Update amounts', a: 'editItem', ds: { id: c.p.id } }]) };
    }
    if (/hsa|fsa|flex|health savings/.test(t)) return { h: c.d.hsa ? `${poss(c)} HSA/FSA balance is <b>${H.usd(c.d.hsa)}</b>. FSA money usually must be spent by the plan deadline; HSA money rolls over.` : 'No HSA or FSA balance saved yet.' + (c.p ? acts([{ t: 'Add it', a: 'editItem', ds: { id: c.p.id } }]) : '') };
    if (/cost|copay|how much|price|pay for|specialist cost|visit cost/.test(t)) {
      if (!c.p) return { h: `Add ${poss(c)} insurance to see visit costs.` + acts([{ t: 'Add insurance', a: 'addItem', ds: { kind: 'insurance' } }]) };
      const L = [['c_pcp', 'Primary care'], ['c_spec', 'Specialist'], ['c_urgent', 'Urgent care'], ['c_er', 'Emergency room'], ['c_tele', 'Video visit'], ['c_rx', 'Generic drugs'], ['coins', 'After deductible']].filter(([k]) => c.d[k]);
      return { h: L.length ? `${esc(c.d.plan || 'Plan')} in-network costs:<ul>${L.map(([k, l]) => `<li>${l}: <b>${esc(c.d[k])}</b></li>`).join('')}</ul>Confirm with your plan before a visit.` : 'No visit costs saved yet.' + acts([{ t: 'Add costs', a: 'editItem', ds: { id: c.p.id } }]) };
    }
    if (/medic|meds|prescri|refill|pharmac|\brx\b|pill/.test(t)) {
      const L = c.mi.filter(x => x.kind === 'medication');
      return { h: (L.length ? `${poss(c)} medications:<ul>${L.map(x => `<li><b>${esc([x.data.name, x.data.dose].filter(Boolean).join(' '))}</b>${x.data.how ? ' \u00b7 ' + esc(x.data.how) : ''}${x.data.pharmacy ? ' \u00b7 ' + esc(x.data.pharmacy) : ''}</li>`).join('')}</ul>` : `No medications saved for ${esc(c.f)}.`) + ' Refill tracking with pharmacies comes later; for now call your pharmacy for refills.' + acts([{ t: 'Add a medication', a: 'addItem', ds: { kind: 'medication' } }]) };
    }
    if (/allerg/.test(t)) { const L = c.mi.filter(x => x.kind === 'allergy'); return { h: L.length ? `${poss(c)} allergies: ${L.map(x => '<b>' + esc(x.data.name) + '</b>' + (x.data.reaction ? ' (' + esc(x.data.reaction) + ')' : '')).join(', ')}.` : `No allergies saved for ${esc(c.f)}.` + acts([{ t: 'Add an allergy', a: 'addItem', ds: { kind: 'allergy' } }]) }; }
    if (/condition|diagnos/.test(t)) { const L = c.mi.filter(x => x.kind === 'condition'); return { h: L.length ? `${poss(c)} conditions: ${L.map(x => esc(x.data.name)).join(', ')}.` : `No conditions saved for ${esc(c.f)}.` + acts([{ t: 'Add a condition', a: 'addItem', ds: { kind: 'condition' } }]) }; }
    if (/vaccin|shot|immuniz/.test(t)) { const L = c.mi.filter(x => x.kind === 'vaccine'); return { h: L.length ? `${poss(c)} vaccines: ${L.map(x => esc(x.data.name) + (x.data.date ? ' (' + esc(x.data.date) + ')' : '')).join(', ')}.` : `No vaccines saved for ${esc(c.f)}.` + acts([{ t: 'Add a vaccine', a: 'addItem', ds: { kind: 'vaccine' } }]) }; }
    if (/appoint|next visit|schedul|upcoming|calendar|book/.test(t)) {
      const U = H.upcoming(c.m);
      return { h: (U.length ? `${poss(c)} upcoming appointments:<ul>${U.map(a => `<li><b>${esc(H.apptWhen(a))}</b>${a.data.with ? ' \u00b7 ' + esc(a.data.with) : ''}${a.data.reason ? ' \u00b7 ' + esc(a.data.reason) : ''}</li>`).join('')}</ul>` : `No upcoming appointments saved for ${esc(c.f)}.`) + ' Online booking isn\u2019t live yet, so call the office to book, then save it here for a reminder and check-in QR.' + acts([{ t: 'Add appointment', a: 'addAppt' }]) };
    }
    if (/expir|lose it|use it|unused|remaining|before (the )?(year|dec)/.test(t)) return { h: `Here\u2019s what ${esc(c.f)} can still use this plan year.` + acts([{ t: 'Show Use it before you lose it', a: 'jump', ds: { id: 's-use' } }]) };
    if (/record|chart|mychart|epic|portal|lab|result/.test(t)) return { h: 'Connecting Epic/MyChart, Medicare and health plan records isn\u2019t live yet. When it is, records will come in only after you approve each connection. For now you can upload lab reports and visit summaries to Documents.' + acts([{ t: 'Upload a document', a: 'qUpload' }]) };
    if (/doctor|specialist|provider|in.network|find|dentist|therap|cardio|derm|ortho|eye|primary|pcp/.test(t)) {
      const docs = c.mi.filter(x => x.kind === 'doctor');
      const chip = /specialist|cardio|derm|ortho|eye|neuro|gi\b|ent\b/.test(t) ? 'c_spec' : /therap|counsel/.test(t) ? 'c_ther' : 'c_pcp';
      let h = docs.length ? `${poss(c)} care team: ${docs.map(x => '<b>' + esc(x.data.name) + '</b>' + (x.data.specialty ? ' (' + esc(x.data.specialty) + ')' : '')).join(', ')}. ` : '';
      h += c.p ? 'I can search the national provider registry near home and show your plan\u2019s cost.' : 'Add insurance to search with your plan\u2019s costs.';
      return { h: h + (c.p ? acts([{ t: 'Find primary care', a: 'findCare', ds: { id: c.p.id, chip: 'c_pcp' } }, { t: 'Find a specialist', a: 'findCare', ds: { id: c.p.id, chip: 'c_spec' } }].concat(chip === 'c_ther' ? [{ t: 'Find therapy', a: 'findCare', ds: { id: c.p.id, chip: 'c_ther' } }] : [])) : acts([{ t: 'Add insurance', a: 'addItem', ds: { kind: 'insurance' } }])) };
    }
    if (/benefit|cover|plan|eligib|active/.test(t)) {
      if (!c.p) return { h: `No insurance saved for ${esc(c.f)}.` + acts([{ t: 'Add insurance', a: 'addItem', ds: { kind: 'insurance' } }]) };
      return { h: `${esc(c.d.plan || 'Plan')}${c.d.coverage === 'active' ? ', reported active by the insurer' : c.d.coverage === 'inactive' ? ', <b>reported inactive</b> by the insurer' : ''}. Ask me about the deductible or visit costs, or check with the insurer now.` + acts(c.s.ben ? [{ t: 'Check with my insurer', a: 'checkBen', ds: { id: c.p.id } }] : []) };
    }
    if (/family|members|who/.test(t)) return { h: 'Your family in CollectCare: ' + c.s.members.map(x => esc(x.full_name)).join(', ') + '.' + acts(c.s.members.filter(x => x.id !== c.m.id).slice(0, 4).map(x => ({ t: 'View ' + H.first(x.full_name), a: 'select', ds: { id: x.id, n: H.first(x.full_name) } })).concat([{ t: 'Add family member', a: 'addMember' }])) };
    return { h: 'I\u2019m not sure about that one. Try asking about costs, the deductible, urgent care near home, medications, appointments or Jerry.', chips: CHIPS };
  }
})();
