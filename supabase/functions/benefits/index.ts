// CollectCare "benefits" Edge Function: real-time insurance benefits through Stedi (X12 270/271).
// The Stedi API key lives only in Supabase secrets, never in the browser or app.
//
// Secrets (Supabase dashboard > Edge Functions > Secrets):
//   STEDI_API_KEY       Stedi API key. A TEST key returns Stedi's mock Aetna response only.
//   STEDI_MODE          "test" (default) or "live". Live sends the member's real details to their insurer.
//   STEDI_PROVIDER_NPI  NPI of the partner provider or practice that has authorized CollectCare to check
//                       benefits on its behalf (required by Stedi for every live check).
//   DAILY_LIMIT         Optional. Live checks per account per 24 hours (default 6). Each live check costs money.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ORIGINS = ['https://collectmycare.com', 'https://www.collectmycare.com', 'capacitor://localhost', 'http://localhost:8765'];
const PUBLISHABLE = 'sb_publishable_fPRBvvBb82imUlnNtHFB0w_dehrE01U';
const STEDI = 'https://healthcare.us.stedi.com';

function cors(req: Request) {
  const o = req.headers.get('origin') || '';
  return { 'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0], 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Vary': 'Origin' };
}

// ---------- 271 response -> CollectCare benefit fields ----------
const TOTAL = ['CALENDAR_YEAR', 'SERVICE_YEAR', 'CONTRACT', 'YEARS', '24_HOURS'];
const IND = ['INDIVIDUAL', 'EMPLOYEE_ONLY'];
const n = (v: any) => { const x = parseFloat(v); return isFinite(x) ? x : null; };
const inNet = (e: any) => !e.network || !e.network.indicator || e.network.indicator === 'IN_NETWORK' || e.network.indicator === 'IN_AND_OUT_OF_NETWORK';
const plan30 = (e: any) => !e.service || !e.service.value || (e.service.system || 'STC') === 'STC' && e.service.value === '30';

export function accum(list: any[], fam: boolean) {
  const rows = (list || []).filter(e => inNet(e) && plan30(e) && (fam ? e.coverageLevel === 'FAMILY' : IND.includes(e.coverageLevel)));
  // Prefer strictly in-network rows when both kinds exist.
  const strict = rows.filter(e => e.network && e.network.indicator === 'IN_NETWORK');
  const use = strict.length ? strict : rows;
  const get = (ps: string[]) => { for (const e of use) if (ps.includes(e.timePeriod) && n(e.amount) != null) return n(e.amount); return null; };
  const total = get(TOTAL), remaining = get(['REMAINING']), ytd = get(['YEAR_TO_DATE']);
  if (total == null) return null;
  const met = ytd != null ? ytd : remaining != null ? Math.max(0, total - remaining) : null;
  return { total, met, remaining: remaining != null ? remaining : met != null ? Math.max(0, total - met) : null };
}

const COPAY: [string, string[], RegExp | null][] = [
  ['c_spec', ['98'], /specialist/i], ['c_pcp', ['98', 'BY', 'A0'], null], ['c_urgent', ['UC'], null], ['c_er', ['86'], null],
  ['c_rx', ['GF', '88', '89'], null], ['c_ther', ['MH', 'CF', 'A4', 'A6'], null], ['c_tele', [], /tele|virtual|video/i],
];
function money(v: number) { return '$' + (v % 1 ? v.toFixed(2) : String(v)); }

export function parse271(r: any) {
  const out: Record<string, any> = {};
  const plan = (r.plans || [])[0];
  if (!plan) return { out, status: (r.errors && r.errors.length) ? 'error' : 'unknown' };
  const b = plan.benefits || {};
  const st = (b.statuses || []).filter((e: any) => plan30(e));
  const status = st.some((e: any) => /^ACTIVE/.test(e.status)) ? 'active' : st.some((e: any) => /^INACTIVE/.test(e.status)) ? 'inactive' : 'unknown';
  const d = accum(b.deductible, false), o = accum(b.outOfPocket, false), df = accum(b.deductible, true), of = accum(b.outOfPocket, true);
  if (d) { out.ded = String(d.total); if (d.met != null) out.ded_met = String(d.met); }
  if (o) { out.oop = String(o.total); if (o.met != null) out.oop_met = String(o.met); }
  if (df) { out.ded_fam = String(df.total); if (df.met != null) out.ded_fam_met = String(df.met); }
  if (of) { out.oop_fam = String(of.total); if (of.met != null) out.oop_fam_met = String(of.met); }
  const cp = (b.coPayment || []).filter((e: any) => inNet(e) && e.service && n(e.amount) != null);
  const txt = (e: any) => (e.messages || []).join(' ') + ' ' + (e.service.definition || '');
  for (const [k, codes, rx] of COPAY) {
    const hit = cp.find((e: any) => (!codes.length || codes.includes(e.service.value)) && (!rx || rx.test(txt(e))) && !(k === 'c_pcp' && /specialist/i.test(txt(e))));
    if (hit) out[k] = money(n(hit.amount)!);
  }
  const co = (b.coInsurance || []).find((e: any) => inNet(e) && plan30(e) && n(e.percent) != null);
  if (co) out.coins = Math.round(n(co.percent)! * 100) + '%';
  if (plan.name) out.plan_name_insurer = plan.name;
  const pd = (b.statuses || []).map((e: any) => e.dates && (e.dates.plan || e.dates.eligibility)).find((x: any) => x && x.start);
  if (pd) out.year_start = pd.start;
  return { out, status };
}

function friendlyError(r: any) {
  const e = (r.errors || [])[0];
  if (!e) return null;
  const map: Record<string, string> = {
    '42': 'Your insurer\u2019s system is not answering right now. Try again later.',
    '43': 'Your insurer does not recognize the provider used for this check yet.',
    '72': 'Your insurer could not match the member ID. Check it against your card.',
    '73': 'Your insurer could not match the name. Use the name exactly as it is on your card.',
    '75': 'Your insurer could not find this member. Check the member ID, name and date of birth.',
    '79': 'This insurer needs a different payer selection. Pick your insurance company again.',
  };
  return map[e.code] || ('Your insurer returned: ' + (e.description || 'an error') + '.');
}

// ---------- HTTP handler ----------
Deno.serve(async (req: Request) => {
  const h = cors(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h });
  const send = (body: any, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...h, 'Content-Type': 'application/json' } });
  try {
    const key = Deno.env.get('STEDI_API_KEY');
    if (!key) return send({ error: 'Benefit checks are not turned on yet. Add STEDI_API_KEY in Supabase.' }, 503);
    const live = (Deno.env.get('STEDI_MODE') || 'test').toLowerCase() === 'live';
    const auth = req.headers.get('Authorization') || '';
    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') || PUBLISHABLE, { global: { headers: { Authorization: auth } } });
    const { data: u } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
    if (!u || !u.user) return send({ error: 'Please sign in again.' }, 401);
    const body = await req.json().catch(() => ({}));
    const stedi = (path: string, init: RequestInit = {}) => fetch(STEDI + path, { ...init, headers: { Authorization: 'Key ' + key, 'Content-Type': 'application/json', ...(init.headers || {}) } });

    if (body.action === 'payers') {
      const q = String(body.q || '').slice(0, 60).trim();
      if (q.length < 2) return send({ payers: [] });
      const r = await stedi('/2024-04-01/payers/search?pageSize=10&query=' + encodeURIComponent(q));
      const j = await r.json().catch(() => ({}));
      if (!r.ok) return send({ error: 'Could not search insurers right now.' }, 502);
      return send({ payers: (j.items || []).map((x: any) => ({ id: x.payer.primaryPayerId, name: x.payer.displayName, elig: x.payer.transactionSupport && x.payer.transactionSupport.eligibilityCheck })) });
    }

    if (body.action !== 'check') return send({ error: 'Unknown request.' }, 400);
    // Row-level security: this only finds the item if it belongs to the signed-in account.
    const { data: it } = await sb.from('items').select('id, member_id, kind, data').eq('id', String(body.item_id || '')).maybeSingle();
    if (!it || it.kind !== 'insurance') return send({ error: 'Insurance plan not found.' }, 404);
    const { data: m } = await sb.from('members').select('full_name, birth_date').eq('id', it.member_id).maybeSingle();
    const d = it.data || {};
    let reqBody: any;
    if (!live) {
      // Test mode: Stedi only accepts its predefined mock requests, so no real details are sent.
      reqBody = { payerId: '60054', provider: { npi: '1999999984' }, subscriber: { memberId: 'AETNA12345', dateOfBirth: '2004-04-04', name: { person: { firstName: 'Jane', lastName: 'Doe' } } }, encounter: { services: [{ system: 'STC', value: '30' }] } };
    } else {
      const npi = Deno.env.get('STEDI_PROVIDER_NPI');
      if (!npi) return send({ error: 'Live checks need a partner provider NPI. Add STEDI_PROVIDER_NPI in Supabase.' }, 503);
      if (!d.payer_id) return send({ error: 'Pick your insurance company first.', need: 'payer' }, 400);
      if (!d.member_id) return send({ error: 'Add the member ID from your card first.', need: 'member_id' }, 400);
      if (!m || !m.birth_date) return send({ error: 'Add this person\u2019s date of birth first.', need: 'birth_date' }, 400);
      const parts = String(m.full_name || '').trim().split(/\s+/);
      const holder = d.holder_name ? String(d.holder_name).trim().split(/\s+/) : null;
      const limit = parseInt(Deno.env.get('DAILY_LIMIT') || '6', 10);
      const since = new Date(Date.now() - 864e5).toISOString();
      const { count } = await sb.from('activity').select('id', { count: 'exact', head: true }).eq('action', 'Checked benefits').gte('at', since);
      if ((count || 0) >= limit) return send({ error: 'You have reached today\u2019s limit for benefit checks. Try again tomorrow.' }, 429);
      const person = { firstName: parts[0], lastName: parts.slice(1).join(' ') || parts[0] };
      reqBody = { payerId: d.payer_id, provider: { npi }, encounter: { services: [{ system: 'STC', value: '30' }] } };
      if (holder && d.holder_dob) {
        reqBody.subscriber = { memberId: d.member_id, dateOfBirth: d.holder_dob, name: { person: { firstName: holder[0], lastName: holder.slice(1).join(' ') || holder[0] } } };
        reqBody.dependent = { dateOfBirth: m.birth_date, name: { person } };
      } else {
        reqBody.subscriber = { memberId: d.member_id, dateOfBirth: m.birth_date, name: { person } };
      }
    }
    const r = await stedi('/2026-06-01/eligibility-check', { method: 'POST', body: JSON.stringify(reqBody) });
    const j = await r.json().catch(() => ({}));
    if (live) await sb.from('activity').insert({ owner_id: u.user.id, action: 'Checked benefits', detail: String(d.plan || 'insurance').slice(0, 80) });
    const fe = friendlyError(j);
    if (!r.ok && !fe) return send({ error: 'Your insurer could not be reached (' + r.status + '). Try again later.' }, 502);
    if (fe && !(j.plans || []).length) return send({ error: fe, test: !live }, 200);
    const { out, status } = parse271(j);
    const today = new Date().toISOString().slice(0, 10);
    const result = { ...out, coverage: status, as_of: today, src: live ? 'insurer' : 'test', checked_at: new Date().toISOString(), check_id: j.id || null };
    if (live) {
      const merged = { ...d, ...result };
      const { error } = await sb.from('items').update({ data: merged }).eq('id', it.id);
      if (error) return send({ error: 'Checked, but could not save the results.' }, 500);
    }
    return send({ test: !live, payer: j.payer && j.payer.name && (j.payer.name.organization || ''), benefits: result });
  } catch (e) {
    return send({ error: 'Something went wrong checking benefits.' }, 500);
  }
});
