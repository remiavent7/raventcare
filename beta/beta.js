/* CollectCare private beta. Talks only to the Ravent Care Supabase project.
   All access rules are enforced by the database (row-level security); this file is just the interface. */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BUCKET = 'family-files';
  const IDLE_MIN = 20;
  // In the iPhone app the page is served from capacitor://localhost, so links that leave the app point to the website.
  const NAT = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ? window.Capacitor.Plugins : null;
  const WEB = location.protocol.indexOf('http') === 0 ? location.origin + location.pathname : 'https://collectmycare.com/beta/';
  const LOCK_AFTER_MS = 60000;

  const KINDS = {
    insurance: { label: 'Insurance', one: 'insurance plan', fields: [['plan', 'Plan name', 'text', 1], ['type', 'Type (medical, dental, vision, Medicare)'], ['member_id', 'Member ID'], ['group', 'Group number'], ['phone', 'Member services phone', 'tel'], ['notes', 'Notes', 'area']], t: d => d.plan, s: d => [d.type, d.member_id && 'ID ' + d.member_id, d.group && 'Group ' + d.group, d.phone, d.notes] },
    doctor: { label: 'Doctors and care team', one: 'doctor', fields: [['name', 'Name', 'text', 1], ['specialty', 'Specialty'], ['practice', 'Practice or hospital'], ['phone', 'Phone', 'tel'], ['portal', 'Patient portal (e.g. MyChart at Cedars-Sinai)'], ['notes', 'Notes', 'area']], t: d => d.name, s: d => [d.specialty, d.practice, d.phone, d.portal, d.notes] },
    medication: { label: 'Medications', one: 'medication', fields: [['name', 'Medication', 'text', 1], ['dose', 'Dose'], ['how', 'How often'], ['prescriber', 'Prescribed by'], ['pharmacy', 'Pharmacy'], ['notes', 'Notes', 'area']], t: d => [d.name, d.dose].filter(Boolean).join(' '), s: d => [d.how, d.prescriber && 'By ' + d.prescriber, d.pharmacy, d.notes] },
    allergy: { label: 'Allergies', one: 'allergy', fields: [['name', 'Allergic to', 'text', 1], ['reaction', 'Reaction'], ['severity', 'Severity', 'select', 0, ['', 'Mild', 'Moderate', 'Severe']]], t: d => d.name, s: d => [d.reaction, d.severity] },
    condition: { label: 'Conditions', one: 'condition', fields: [['name', 'Condition', 'text', 1], ['since', 'Since'], ['notes', 'Notes', 'area']], t: d => d.name, s: d => [d.since && 'Since ' + d.since, d.notes] },
    vaccine: { label: 'Vaccines', one: 'vaccine', fields: [['name', 'Vaccine', 'text', 1], ['date', 'Date', 'date'], ['where', 'Where']], t: d => d.name, s: d => [d.date, d.where] },
    visit: { label: 'Visits', one: 'visit', fields: [['date', 'Date', 'date', 1], ['with', 'With'], ['reason', 'Reason'], ['notes', 'Notes', 'area']], t: d => [d.date, d.with].filter(Boolean).join(' · '), s: d => [d.reason, d.notes], sort: (a, b) => String(b.data.date || '').localeCompare(String(a.data.date || '')) },
    note: { label: 'Notes', one: 'note', fields: [['title', 'Title', 'text', 1], ['text', 'Note', 'area']], t: d => d.title, s: d => [d.text] }
  };
  const ORDER = ['insurance', 'doctor', 'medication', 'allergy', 'condition', 'vaccine', 'visit', 'note'];
  const REL = { self: 'Me', spouse: 'Spouse', partner: 'Partner', child: 'Child', parent: 'Parent', sibling: 'Sibling', other: 'Other' };

  let sb, user = null, isAdmin = false, members = [], items = [], docs = [], cur = null, idleT = null;

  // ---------- helpers ----------
  function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 3200); }
  function authMsg(m, bad = true) { const e = $('#authMsg'); e.textContent = m || ''; e.className = 'msg ' + (m ? (bad ? 'bad' : 'ok') : ''); }
  function show(v) { $$('.view').forEach(x => x.hidden = true); $('#v' + v[0].toUpperCase() + v.slice(1)).hidden = false; $$('#nav .lnk[data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === v)); window.scrollTo(0, 0); }
  function busy(btn, on) { if (btn) btn.disabled = on; }
  function fmt(ts) { try { return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ts; } }
  function first(n) { return String(n || '').split(' ')[0]; }
  async function log(action, detail) { if (!user) return; try { await sb.from('activity').insert({ action, detail: (detail || '').slice(0, 300) }); } catch (e) { } }
  function fail(e) { console.error(e); toast((e && e.message) ? 'Something went wrong: ' + e.message : 'Something went wrong. Please try again.'); }

  // Generic dialog form. fields: [key,label,type,required,options]
  function ask(title, fields, vals = {}, okText = 'Save', intro = '') {
    return new Promise(res => {
      const d = $('#dlg'), f = $('#dlgForm');
      f.innerHTML = `<h2>${esc(title)}</h2>${intro ? `<p class="mut small">${intro}</p>` : ''}` + fields.map(([k, l, t = 'text', req, opts]) => {
        const v = vals[k] == null ? '' : vals[k];
        const r = req ? ' required' : '';
        if (t === 'area') return `<label>${esc(l)}<textarea name="${k}" maxlength="4000"${r}>${esc(v)}</textarea></label>`;
        if (t === 'select') return `<label>${esc(l)}<select name="${k}"${r}>${opts.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o || 'Choose']; return `<option value="${esc(ov)}"${String(ov) === String(v) ? ' selected' : ''}>${esc(ol)}</option>`; }).join('')}</select></label>`;
        return `<label>${esc(l)}<input type="${t}" name="${k}" value="${esc(v)}" maxlength="300"${r}></label>`;
      }).join('') + `<div class="drow"><button class="btn ghost" value="cancel" formnovalidate>Cancel</button><button class="btn" value="ok">${esc(okText)}</button></div>`;
      const done = () => { d.removeEventListener('close', done); if (d.returnValue !== 'ok') return res(null); const o = {}; fields.forEach(([k]) => { const el = f.elements[k]; o[k] = el ? el.value.trim() : ''; }); res(o); };
      d.returnValue = ''; d.addEventListener('close', done); d.showModal();
      const fi = f.querySelector('input,textarea,select'); if (fi) fi.focus();
    });
  }
  function confirmBox(title, text, okText = 'Delete', typed) {
    return ask(title, typed ? [['typed', `Type ${typed} to confirm`, 'text', 1]] : [], {}, okText, esc(text)).then(v => v && (!typed || v.typed === typed));
  }

  // ---------- idle sign-out ----------
  function resetIdle() { clearTimeout(idleT); if (user) idleT = setTimeout(async () => { await sb.auth.signOut(); authMsg('You were signed out after ' + IDLE_MIN + ' minutes without activity.', false); }, IDLE_MIN * 60000); }
  ['click', 'keydown', 'touchstart', 'scroll'].forEach(e => addEventListener(e, resetIdle, { passive: true }));

  // ---------- auth ----------
  function authTab(t) {
    $$('.seg .chip').forEach(c => c.classList.toggle('on', c.dataset.tab === t));
    $('#fIn').hidden = t !== 'in'; $('#fUp').hidden = t !== 'up'; $('#fMfa').hidden = t !== 'mfa'; $('#fReset').hidden = t !== 'reset';
    $('.seg').hidden = t === 'mfa' || t === 'reset';
    authMsg('');
  }
  async function needsMfa() {
    const { data, error } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return false;
    return data.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  }
  async function enter(session) {
    user = session ? session.user : null;
    if (!user) { $('#nav').hidden = true; show('auth'); return; }
    if (await needsMfa()) { $('#nav').hidden = true; show('auth'); authTab('mfa'); return; }
    if (NAT && localStorage.getItem('cc_faceid') === '1' && !unlockedOnce) { lockUi(); if (!await unlock()) return; }
    $('#nav').hidden = false; resetIdle();
    const a = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    isAdmin = !!(a.data); $('#navAdmin').hidden = !isAdmin;
    await loadAll(); show('family');
  }

  function initAuthForms() {
    $$('.seg .chip').forEach(c => c.addEventListener('click', () => authTab(c.dataset.tab)));
    const inv = new URLSearchParams(location.search).get('invite');
    if (inv) { authTab('up'); $('#fUp').elements.code.value = inv.toUpperCase(); }

    $('#fIn').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector('.btn'); busy(b, 1); authMsg('');
      const { data, error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
      busy(b, 0);
      if (error) return authMsg(/confirm/i.test(error.message) ? 'Please confirm your email first. Check your inbox for the link.' : 'That email and password don\u2019t match. Try again or reset your password.');
      f.reset(); await enter(data.session); if (user) log('Signed in');
    });

    $('#fUp').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector('.btn'); busy(b, 1); authMsg('');
      const code = f.code.value.trim().toUpperCase(), email = f.email.value.trim();
      try {
        const ok = await sb.rpc('check_invite', { p_code: code, p_email: email });
        if (ok.error) throw ok.error;
        if (!ok.data) { busy(b, 0); return authMsg('That invite code isn\u2019t valid, has expired or is for a different email address.'); }
        const { data, error } = await sb.auth.signUp({ email, password: f.password.value, options: { data: { invite_code: code, display_name: f.name.value.trim(), beta_terms: 'accepted' }, emailRedirectTo: WEB } });
        busy(b, 0);
        if (error) return authMsg(/database error|invite/i.test(error.message) ? 'That invite code couldn\u2019t be used. Ask the person who invited you for a new one.' : error.message);
        if (data.session) { f.reset(); return enter(data.session); }
        f.reset(); authTab('in'); authMsg('Almost done. We sent a confirmation link to ' + email + '. Open it, then sign in here.', false);
      } catch (err) { busy(b, 0); authMsg('Could not create the account: ' + (err.message || err)); }
    });

    $('#forgot').addEventListener('click', async () => {
      const email = $('#fIn').elements.email.value.trim();
      if (!email) return authMsg('Enter your email above, then select Forgot password.');
      await sb.auth.resetPasswordForEmail(email, { redirectTo: WEB });
      authMsg('If that email has an account, a reset link is on its way.', false);
    });

    $('#fMfa').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, b = f.querySelector('.btn'); busy(b, 1);
      const fs = await sb.auth.mfa.listFactors(); const fac = fs.data && fs.data.totp && fs.data.totp[0];
      const r = fac ? await sb.auth.mfa.challengeAndVerify({ factorId: fac.id, code: f.code.value.trim() }) : { error: { message: 'No authenticator set up' } };
      busy(b, 0);
      if (r.error) return authMsg('That code didn\u2019t work. Check the time on your phone and try the newest code.');
      f.reset(); const s = await sb.auth.getSession(); await enter(s.data.session); log('Signed in with two-step verification');
    });

    $('#fReset').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target;
      const { error } = await sb.auth.updateUser({ password: f.password.value });
      if (error) return authMsg(error.message);
      f.reset(); log('Changed password'); const s = await sb.auth.getSession(); await enter(s.data.session); toast('Password updated');
    });

    $('#signOut').addEventListener('click', async () => { await log('Signed out'); await sb.auth.signOut(); });
  }

  // ---------- data ----------
  async function loadAll() {
    const [m, i, d] = await Promise.all([
      sb.from('members').select('*').order('created_at'),
      sb.from('items').select('*').order('created_at'),
      sb.from('documents').select('*').order('created_at', { ascending: false })
    ]);
    if (m.error || i.error || d.error) return fail(m.error || i.error || d.error);
    members = m.data; items = i.data; docs = d.data;
    if (!cur || !members.find(x => x.id === cur)) cur = members[0] ? members[0].id : null;
    renderFamily();
  }

  function renderFamily() {
    const p = user.user_metadata || {};
    $('#hello').textContent = p.display_name ? first(p.display_name) + '\u2019s family' : 'Your family';
    $('#memEmpty').hidden = members.length > 0;
    $('#memTabs').innerHTML = members.map(m => `<button data-mid="${m.id}" class="${m.id === cur ? 'on' : ''}"><b>${esc(first(m.full_name))}</b><span>${esc(REL[m.relationship] || '')}</span></button>`).join('');
    const m = members.find(x => x.id === cur);
    if (!m) { $('#memBody').innerHTML = ''; return; }
    const mi = items.filter(x => x.member_id === m.id), md = docs.filter(x => x.member_id === m.id);
    const age = m.birth_date ? Math.floor((Date.now() - new Date(m.birth_date + 'T00:00:00')) / 31557600000) : null;
    let h = `<div class="card"><div class="mhead"><div><h2>${esc(m.full_name)}</h2><p class="mut small">${esc(REL[m.relationship] || '')}${age != null ? ' · ' + age + ' years old' : ''}${m.birth_date ? ' · Born ' + esc(m.birth_date) : ''}</p>${m.notes ? `<p class="d small">${esc(m.notes)}</p>` : ''}</div><div class="a"><button class="btn ghost sm" data-act="editMember">Edit</button> <button class="btn red sm" data-act="delMember">Remove</button></div></div></div><div class="sects">`;
    ORDER.forEach(k => {
      const K = KINDS[k]; let list = mi.filter(x => x.kind === k); if (K.sort) list = list.slice().sort(K.sort);
      h += `<div class="card sect"><div class="sh"><h3>${esc(K.label)}</h3><button class="btn ghost sm" data-act="addItem" data-kind="${k}">Add</button></div>` +
        (list.length ? list.map(x => `<div class="it"><div><div class="t">${esc(K.t(x.data) || K.one)}</div><div class="d">${K.s(x.data).filter(Boolean).map(esc).join('\n')}</div></div><div class="a">${NAT && k === 'medication' ? remBtn(x) : ''}<button class="lnk small" data-act="editItem" data-id="${x.id}">Edit</button><button class="lnk small" data-act="delItem" data-id="${x.id}">Delete</button></div></div>`).join('') : `<p class="empty">No ${esc(K.label.toLowerCase())} yet.</p>`) + '</div>';
    });
    h += `<div class="card sect"><div class="sh"><h3>Documents</h3><span>${NAT ? '<button class="btn sm" data-act="scan">Scan with camera</button> ' : ''}<label class="btn ghost sm">Upload<input type="file" id="upFile" accept="application/pdf,image/jpeg,image/png,image/heic,image/heif,image/webp" hidden></label></span></div><p class="mut small">Insurance cards, lab reports, visit summaries. PDF or photo, up to 10 MB.</p>` +
      (md.length ? md.map(x => `<div class="it"><div><div class="t">${esc(x.name)}</div><div class="d">${fmt(x.created_at)} · ${Math.max(1, Math.round((x.size_bytes || 0) / 1024))} KB</div></div><div class="a"><button class="lnk small" data-act="openDoc" data-id="${x.id}">Open</button><button class="lnk small" data-act="delDoc" data-id="${x.id}">Delete</button></div></div>`).join('') : '<p class="empty">No documents yet.</p>') + '</div></div>';
    $('#memBody').innerHTML = h;
    const up = $('#upFile'); if (up) up.addEventListener('change', () => upload(up));
  }

  const MEMBER_FIELDS = () => [['full_name', 'Full name', 'text', 1], ['relationship', 'Relationship to you', 'select', 1, Object.entries(REL)], ['birth_date', 'Date of birth', 'date'], ['notes', 'Notes', 'area']];
  async function addMember(self) {
    const v = await ask(self ? 'Add yourself' : 'Add a family member', MEMBER_FIELDS(), self ? { full_name: (user.user_metadata || {}).display_name || '', relationship: 'self' } : { relationship: 'child' }, 'Add');
    if (!v) return;
    const { data, error } = await sb.from('members').insert({ full_name: v.full_name, relationship: v.relationship, birth_date: v.birth_date || null, notes: v.notes || null }).select().single();
    if (error) return fail(error);
    cur = data.id; log('Added family member', first(v.full_name)); await loadAll(); toast(first(v.full_name) + ' added');
  }

  async function onFamilyClick(e) {
    const t = e.target.closest('[data-mid],[data-act]'); if (!t) return;
    if (t.dataset.mid) { cur = t.dataset.mid; return renderFamily(); }
    const m = members.find(x => x.id === cur), act = t.dataset.act;
    try {
      if (act === 'editMember') {
        const v = await ask('Edit ' + first(m.full_name), MEMBER_FIELDS(), m); if (!v) return;
        const { error } = await sb.from('members').update({ full_name: v.full_name, relationship: v.relationship, birth_date: v.birth_date || null, notes: v.notes || null }).eq('id', m.id);
        if (error) return fail(error); log('Edited family member', first(v.full_name)); await loadAll();
      } else if (act === 'delMember') {
        if (!await confirmBox('Remove ' + m.full_name + '?', 'This deletes their profile, everything listed under it and their uploaded documents.', 'Remove')) return;
        const paths = docs.filter(x => x.member_id === m.id).map(x => x.storage_path);
        if (paths.length) { const r = await sb.storage.from(BUCKET).remove(paths); if (r.error) return fail(r.error); }
        const { error } = await sb.from('members').delete().eq('id', m.id); if (error) return fail(error);
        log('Removed family member', first(m.full_name)); cur = null; await loadAll(); toast('Removed');
      } else if (act === 'addItem' || act === 'editItem') {
        const it = act === 'editItem' ? items.find(x => x.id === t.dataset.id) : null;
        const kind = it ? it.kind : t.dataset.kind, K = KINDS[kind];
        const v = await ask((it ? 'Edit ' : 'Add ') + K.one + ' for ' + first(m.full_name), K.fields, it ? it.data : {}); if (!v) return;
        Object.keys(v).forEach(k => { if (!v[k]) delete v[k]; });
        const r = it ? await sb.from('items').update({ data: v }).eq('id', it.id) : await sb.from('items').insert({ member_id: m.id, kind, data: v });
        if (r.error) return fail(r.error); log((it ? 'Edited ' : 'Added ') + K.one, first(m.full_name)); await loadAll();
      } else if (act === 'delItem') {
        const it = items.find(x => x.id === t.dataset.id), K = KINDS[it.kind];
        if (!await confirmBox('Delete this ' + K.one + '?', 'It will be removed from ' + first(m.full_name) + '\u2019s profile.')) return;
        const { error } = await sb.from('items').delete().eq('id', it.id); if (error) return fail(error);
        if (NAT) await stopReminder(it.id);
        log('Deleted ' + K.one, first(m.full_name)); await loadAll();
      } else if (act === 'openDoc') {
        const d = docs.find(x => x.id === t.dataset.id);
        const w = NAT ? null : window.open('', '_blank'); if (w) w.opener = null;
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(d.storage_path, 120);
        if (NAT && !error) { await NAT.Browser.open({ url: data.signedUrl, presentationStyle: 'popover' }); log('Opened document', d.name); return; }
        if (error) { if (w) w.close(); return fail(error); }
        if (w) w.location = data.signedUrl; else location.assign(data.signedUrl);
        log('Opened document', d.name);
      } else if (act === 'scan') {
        await scanDoc();
      } else if (act === 'remind') {
        await setReminder(items.find(x => x.id === t.dataset.id), m);
      } else if (act === 'unremind') {
        await stopReminder(t.dataset.id); toast('Reminder stopped'); renderFamily();
      } else if (act === 'delDoc') {
        const d = docs.find(x => x.id === t.dataset.id);
        if (!await confirmBox('Delete ' + d.name + '?', 'The file is permanently removed.')) return;
        const r = await sb.storage.from(BUCKET).remove([d.storage_path]); if (r.error) return fail(r.error);
        const { error } = await sb.from('documents').delete().eq('id', d.id); if (error) return fail(error);
        log('Deleted document', d.name); await loadAll();
      }
    } catch (err) { fail(err); }
  }

  async function upload(inp) {
    const f = inp.files && inp.files[0]; if (!f) return;
    if (f.size > 10485760) { inp.value = ''; return toast('That file is over 10 MB.'); }
    return uploadFile(f, inp);
  }
  async function uploadFile(f, inp = { value: '' }) {
    const m = members.find(x => x.id === cur);
    const safe = f.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'file';
    const path = `${user.id}/${m.id}/${crypto.randomUUID()}-${safe}`;
    toast('Uploading…');
    const up = await sb.storage.from(BUCKET).upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (up.error) { inp.value = ''; return fail(up.error); }
    const { error } = await sb.from('documents').insert({ member_id: m.id, name: f.name.slice(0, 200), mime: f.type, size_bytes: f.size, storage_path: path });
    if (error) { await sb.storage.from(BUCKET).remove([path]); return fail(error); }
    log('Uploaded document', f.name); await loadAll(); toast('Uploaded');
  }

  // ---------- activity ----------
  async function renderActivity() {
    const { data, error } = await sb.from('activity').select('*').order('at', { ascending: false }).limit(200);
    if (error) return fail(error);
    $('#actList').innerHTML = data.length ? data.map(a => `<li><time>${fmt(a.at)}</time><span>${esc(a.action)}${a.detail ? ' · ' + esc(a.detail) : ''}</span></li>`).join('') : '<li class="empty">No activity yet.</li>';
  }

  // ---------- settings ----------
  async function renderSettings() {
    $('#acctLine').textContent = 'Signed in as ' + user.email;
    if (NAT) renderDevice();
    $('#fName').elements.name.value = (user.user_metadata || {}).display_name || '';
    const box = $('#mfaBox'), st = $('#mfaState');
    const fs = await sb.auth.mfa.listFactors();
    const ver = (fs.data && fs.data.totp || []).filter(f => f.status === 'verified');
    if (ver.length) {
      st.innerHTML = '<span class="tag ok">On</span> You\u2019ll enter a code from your authenticator app each time you sign in.';
      box.innerHTML = '<button class="btn ghost sm" id="mfaOff">Turn off</button>';
      $('#mfaOff').onclick = async () => {
        if (!await confirmBox('Turn off two-step verification?', 'Your account will only be protected by your password.', 'Turn off')) return;
        const r = await sb.auth.mfa.unenroll({ factorId: ver[0].id }); if (r.error) return fail(r.error);
        log('Turned off two-step verification'); renderSettings();
      };
    } else {
      st.textContent = 'Recommended. Use an authenticator app such as Google Authenticator, Microsoft Authenticator or 1Password.';
      box.innerHTML = '<button class="btn sm" id="mfaOn">Set up two-step verification</button>';
      $('#mfaOn').onclick = async () => {
        const all = (fs.data && fs.data.all) || [];
        for (const f of all) if (f.status !== 'verified') await sb.auth.mfa.unenroll({ factorId: f.id });
        const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'CollectCare ' + Date.now() });
        if (error) return fail(error);
        box.innerHTML = `<p class="small">1. Scan this code with your authenticator app.</p><img class="qr" alt="QR code for your authenticator app" src="${esc(data.totp.qr_code)}"><p class="small mut">Can\u2019t scan? Enter this key: <code>${esc(data.totp.secret)}</code></p><form id="fMfaOn" class="row-f"><label>2. Enter the 6-digit code<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required></label><button class="btn">Turn on</button></form>`;
        $('#fMfaOn').onsubmit = async e => {
          e.preventDefault();
          const r = await sb.auth.mfa.challengeAndVerify({ factorId: data.id, code: e.target.code.value.trim() });
          if (r.error) return toast('That code didn\u2019t work. Try the newest one.');
          log('Turned on two-step verification'); toast('Two-step verification is on'); renderSettings();
        };
      };
    }
  }

  async function exportData() {
    const signed = {};
    for (const d of docs) { const r = await sb.storage.from(BUCKET).createSignedUrl(d.storage_path, 3600); if (!r.error) signed[d.id] = r.data.signedUrl; }
    const out = { exported_at: new Date().toISOString(), account: { email: user.email, name: (user.user_metadata || {}).display_name || null },
      note: 'Document links expire one hour after export.',
      family: members.map(m => ({ name: m.full_name, relationship: m.relationship, birth_date: m.birth_date, notes: m.notes,
        records: ORDER.reduce((o, k) => { const l = items.filter(x => x.member_id === m.id && x.kind === k).map(x => x.data); if (l.length) o[KINDS[k].label] = l; return o; }, {}),
        documents: docs.filter(x => x.member_id === m.id).map(x => ({ name: x.name, uploaded: x.created_at, link: signed[x.id] || null })) })) };
    const fname = 'collectcare-my-data-' + new Date().toISOString().slice(0, 10) + '.json';
    if (NAT) {
      const w = await NAT.Filesystem.writeFile({ path: fname, data: JSON.stringify(out, null, 2), directory: 'CACHE', encoding: 'utf8' });
      await NAT.Share.share({ title: 'My CollectCare data', url: w.uri }).catch(() => { });
    } else {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
      a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    }
    log('Downloaded my data');
  }

  async function deleteAccount() {
    if (!await confirmBox('Delete your CollectCare account?', 'Every family profile, record and document will be permanently deleted.', 'Delete forever', 'DELETE')) return;
    try {
      const paths = docs.map(d => d.storage_path);
      for (let i = 0; i < paths.length; i += 100) { const r = await sb.storage.from(BUCKET).remove(paths.slice(i, i + 100)); if (r.error) throw r.error; }
      const { error } = await sb.rpc('delete_my_account'); if (error) throw error;
      await sb.auth.signOut(); authMsg('Your account and everything in it has been deleted.', false);
    } catch (e) { fail(e); }
  }

  // ---------- admin ----------
  function newCode() { const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', b = crypto.getRandomValues(new Uint8Array(8)); const s = [...b].map(x => A[x % A.length]).join(''); return 'CC-' + s.slice(0, 4) + '-' + s.slice(4); }
  function inviteLink(c) { return WEB + '?invite=' + encodeURIComponent(c); }
  async function renderAdmin() {
    const [inv, acc] = await Promise.all([sb.from('invites').select('*').order('created_at', { ascending: false }), sb.rpc('admin_beta_accounts')]);
    if (inv.error) return fail(inv.error);
    const now = Date.now();
    $('#invTbl').innerHTML = '<tr><th>Code</th><th>For</th><th>Used</th><th>Expires</th><th>Status</th><th></th></tr>' + inv.data.map(i => {
      const st = i.revoked ? '<span class="tag bad">Revoked</span>' : new Date(i.expires_at) < now ? '<span class="tag">Expired</span>' : i.uses >= i.max_uses ? '<span class="tag ok">Used</span>' : '<span class="tag ac">Open</span>';
      return `<tr><td><code>${esc(i.code)}</code></td><td>${esc(i.note || '')}${i.email ? '<br><span class="mut small">' + esc(i.email) + '</span>' : ''}</td><td>${i.uses}/${i.max_uses}</td><td>${fmt(i.expires_at)}</td><td>${st}</td><td>${!i.revoked && i.uses < i.max_uses ? `<button class="lnk small" data-copy="${esc(i.code)}">Copy link</button><button class="lnk small" data-revoke="${esc(i.code)}">Revoke</button>` : ''}</td></tr>`;
    }).join('');
    $('#accTbl').innerHTML = acc.error ? '<tr><td>' + esc(acc.error.message) + '</td></tr>' : '<tr><th>Name</th><th>Email</th><th>Joined</th><th>Last sign-in</th><th>Invite</th><th>Profiles</th></tr>' + acc.data.map(a => `<tr><td>${esc(a.display_name || '')}</td><td>${esc(a.email)}${a.confirmed ? '' : ' <span class="tag">Unconfirmed</span>'}</td><td>${fmt(a.joined)}</td><td>${a.last_sign_in ? fmt(a.last_sign_in) : '—'}</td><td><code>${esc(a.invite_code || '')}</code></td><td>${a.family_members}</td></tr>`).join('');
  }
  async function copy(t) { try { await navigator.clipboard.writeText(t); toast('Invite link copied'); } catch (e) { toast(t); } }

  // ---------- iPhone app only: Face ID lock, camera scan, medication reminders ----------
  let unlockedOnce = false, hiddenAt = 0;
  function lockUi() { $('#lock').hidden = false; document.body.classList.add('locked'); }
  function unlockUi() { const l = $('#lock'); if (l) l.hidden = true; document.body.classList.remove('locked'); }
  async function unlock() {
    try {
      await NAT.BiometricAuthNative.internalAuthenticate({ reason: 'Unlock CollectCare', cancelTitle: 'Cancel', allowDeviceCredential: true, iosFallbackTitle: 'Use passcode' });
      unlockedOnce = true; unlockUi(); resetIdle(); return true;
    } catch (e) { lockUi(); return false; }
  }
  async function bioName() {
    try { const r = await NAT.BiometricAuthNative.checkBiometry(); return r.biometryType === 2 ? 'Touch ID' : r.biometryType === 4 ? 'Optic ID' : 'Face ID'; } catch (e) { return 'Face ID'; }
  }
  async function renderDevice() {
    const box = $('#devBox'); if (!box) return; box.hidden = false;
    const name = await bioName(), on = localStorage.getItem('cc_faceid') === '1';
    $('#bioName').textContent = name;
    $('#bioState').innerHTML = on ? '<span class="tag ok">On</span> CollectCare asks for ' + esc(name) + ' when it opens and after a minute in the background.' : 'Lock the app with ' + esc(name) + ' or your iPhone passcode.';
    $('#bioBtn').textContent = on ? 'Turn off' : 'Turn on ' + name;
    $('#bioBtn').className = on ? 'btn ghost sm' : 'btn sm';
    const n = Object.keys(rems()).length;
    $('#remState').textContent = n ? n + ' daily medication reminder' + (n > 1 ? 's' : '') + ' on this iPhone. Reminders stay on this device and never name the medication on your lock screen.' : 'Add a daily reminder from any medication with Remind me. Reminders stay on this device.';
  }
  async function toggleBio() {
    if (localStorage.getItem('cc_faceid') === '1') { localStorage.removeItem('cc_faceid'); log('Turned off app lock'); return renderDevice(); }
    try {
      await NAT.BiometricAuthNative.internalAuthenticate({ reason: 'Turn on app lock', cancelTitle: 'Cancel', allowDeviceCredential: true, iosFallbackTitle: 'Use passcode' });
      localStorage.setItem('cc_faceid', '1'); unlockedOnce = true; log('Turned on app lock'); toast('App lock is on');
    } catch (e) { toast('App lock was not turned on.'); }
    renderDevice();
  }
  async function scanDoc() {
    const m = members.find(x => x.id === cur); if (!m) return;
    let p;
    try { p = await NAT.Camera.getPhoto({ source: 'CAMERA', resultType: 'base64', quality: 82, width: 2400, correctOrientation: true, saveToGallery: false }); }
    catch (e) { if (!/cancel/i.test(e.message || '')) toast('Camera unavailable. Allow camera access for CollectCare in Settings.'); return; }
    const bin = atob(p.base64String), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    const fmtx = (p.format || 'jpeg').toLowerCase(), type = fmtx === 'png' ? 'image/png' : 'image/jpeg';
    const v = await ask('Name this scan', [['name', 'Name', 'text', 1]], { name: 'Scan ' + new Date().toLocaleDateString() }, 'Upload'); if (!v) return;
    const f = new File([u], v.name.replace(/[\\/]/g, '-') + (type === 'image/png' ? '.png' : '.jpg'), { type });
    if (f.size > 10485760) return toast('That photo is over 10 MB.');
    await uploadFile(f);
  }
  function rems() { try { return JSON.parse(localStorage.getItem('cc_rem') || '{}'); } catch (e) { return {}; } }
  function saveRems(r) { localStorage.setItem('cc_rem', JSON.stringify(r)); }
  function remBtn(x) { const r = rems()[x.id]; return r ? `<button class="lnk small" data-act="unremind" data-id="${x.id}">Stop ${esc(r.label)} reminder</button>` : `<button class="lnk small" data-act="remind" data-id="${x.id}">Remind me</button>`; }
  async function setReminder(it, m) {
    const v = await ask('Daily reminder', [['time', 'Time', 'time', 1]], { time: '08:00' }, 'Set reminder', 'Your lock screen will say \u201cMedication reminder for ' + esc(first(m.full_name)) + '\u201d without naming the medication.'); if (!v || !v.time) return;
    let perm = await NAT.LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') perm = await NAT.LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return toast('Allow notifications for CollectCare in iPhone Settings.');
    const [hh, mm] = v.time.split(':').map(Number), r = rems(), nid = Math.floor(Math.random() * 2e9) + 1;
    if (r[it.id]) await NAT.LocalNotifications.cancel({ notifications: [{ id: r[it.id].nid }] });
    await NAT.LocalNotifications.schedule({ notifications: [{ id: nid, title: 'CollectCare', body: 'Medication reminder for ' + first(m.full_name), schedule: { on: { hour: hh, minute: mm }, allowWhileIdle: true } }] });
    r[it.id] = { nid, label: new Date(2000, 0, 1, hh, mm).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }; saveRems(r);
    log('Set a medication reminder', first(m.full_name)); toast('Reminder set for ' + r[it.id].label + ' every day'); renderFamily();
  }
  async function stopReminder(id) { const r = rems(); if (!r[id]) return; try { await NAT.LocalNotifications.cancel({ notifications: [{ id: r[id].nid }] }); } catch (e) { } delete r[id]; saveRems(r); }
  function clearReminders() { const r = rems(), ids = Object.values(r).map(x => ({ id: x.nid })); if (ids.length) NAT.LocalNotifications.cancel({ notifications: ids }).catch(() => { }); localStorage.removeItem('cc_rem'); }
  function wireNative() {
    document.documentElement.classList.add('native');
    $('#bioBtn').addEventListener('click', toggleBio);
    $('#lockBtn').addEventListener('click', unlock);
    $('#lockOut').addEventListener('click', async () => { unlockUi(); await sb.auth.signOut(); });
    NAT.App.addListener('appStateChange', async ({ isActive }) => {
      if (!isActive) { hiddenAt = Date.now(); if (user && localStorage.getItem('cc_faceid') === '1') document.body.classList.add('shield'); return; }
      document.body.classList.remove('shield');
      if (user && localStorage.getItem('cc_faceid') === '1' && hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS) { lockUi(); await unlock(); }
    });
  }

  // ---------- wiring ----------
  function wire() {
    $$('#nav .lnk[data-view]').forEach(b => b.addEventListener('click', async () => {
      const v = b.dataset.view; show(v);
      try { if (v === 'activity') await renderActivity(); if (v === 'settings') await renderSettings(); if (v === 'admin') await renderAdmin(); if (v === 'family') await loadAll(); } catch (e) { fail(e); }
    }));
    $('#vFamily').addEventListener('click', onFamilyClick);
    $('#addMember').addEventListener('click', () => addMember(members.length === 0));
    $('#addSelf').addEventListener('click', () => addMember(true));
    $('#export').addEventListener('click', () => exportData().catch(fail));
    $('#delAcct').addEventListener('click', deleteAccount);
    $('#fName').addEventListener('submit', async e => {
      e.preventDefault(); const n = e.target.name.value.trim().slice(0, 120);
      const r = await sb.auth.updateUser({ data: { display_name: n } }); if (r.error) return fail(r.error);
      await sb.from('profiles').update({ display_name: n }).eq('id', user.id);
      user = r.data.user; log('Updated display name'); toast('Saved');
    });
    $('#fInv').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target, code = newCode();
      const days = Math.min(90, Math.max(1, +f.days.value || 30));
      const { error } = await sb.from('invites').insert({ code, note: f.note.value.trim() || null, email: f.email.value.trim() || null, max_uses: Math.min(50, Math.max(1, +f.max.value || 1)), expires_at: new Date(Date.now() + days * 864e5).toISOString(), created_by: user.id });
      if (error) return fail(error);
      $('#invNew').innerHTML = `<div class="newinv"><b>Invite created:</b> <code>${esc(code)}</code><br><span class="small">Link: ${esc(inviteLink(code))}</span><br><button class="btn sm" data-copy="${esc(code)}">Copy link</button></div>`;
      f.reset(); f.max.value = 1; f.days.value = 30; log('Created invite', code); renderAdmin();
    });
    $('#vAdmin').addEventListener('click', async e => {
      const c = e.target.closest('[data-copy]'); if (c) return copy(inviteLink(c.dataset.copy));
      const r = e.target.closest('[data-revoke]'); if (r) {
        if (!await confirmBox('Revoke ' + r.dataset.revoke + '?', 'Nobody will be able to sign up with this code.', 'Revoke')) return;
        const { error } = await sb.from('invites').update({ revoked: true }).eq('code', r.dataset.revoke); if (error) return fail(error);
        log('Revoked invite', r.dataset.revoke); renderAdmin();
      }
    });
  }

  // ---------- start ----------
  const C = window.CC_CONFIG || {};
  if (!C.url || !C.anonKey || !window.supabase) { show('setup'); return; }
  sb = window.supabase.createClient(C.url, C.anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  wire(); initAuthForms(); if (NAT) wireNative();
  sb.auth.onAuthStateChange((evt, session) => {
    if (evt === 'PASSWORD_RECOVERY') { show('auth'); authTab('reset'); return; }
    if (evt === 'SIGNED_OUT') { if (NAT) { clearReminders(); localStorage.removeItem('cc_faceid'); unlockUi(); } user = null; members = []; items = []; docs = []; clearTimeout(idleT); $('#nav').hidden = true; show('auth'); authTab('in'); }
  });
  sb.auth.getSession().then(r => enter(r.data.session)).catch(() => show('auth'));
})();
