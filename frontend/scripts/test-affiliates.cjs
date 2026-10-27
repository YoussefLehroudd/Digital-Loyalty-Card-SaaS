/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS test loader transpiles the actual TypeScript handlers. */
// Real PostgreSQL (PGlite), actual API handlers; all data and email stay local.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { randomUUID, createHash } = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const db = new PGlite();
const originalLoad = Module._load;
const originalFetch = global.fetch;
const originalKey = process.env.RESEND_API_KEY;
function sql(strings, ...values) {
  const query = strings.reduce((s, p, i) => s + (i ? '$' + i : '') + p, '');
  return { query, values, then(resolve, reject) { return db.query(query, values).then(r => r.rows).then(resolve, reject); } };
}
sql.transaction = queries => db.transaction(async tx => {
  const out = [];
  for (const q of queries) out.push((await tx.query(q.query, q.values)).rows);
  return out;
});
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
Module._load = function (id, parent, main) {
  if (id === '@/lib/server/db') return { getSql: () => sql };
  if (id.startsWith('@/')) id = path.join(root, 'src', id.slice(2));
  return originalLoad.call(this, id, parent, main);
};
const sent = [];
global.fetch = async (url, options) => {
  assert.equal(url, 'https://api.resend.com/emails', 'unexpected external request');
  sent.push(JSON.parse(options.body));
  return Response.json({ id: 'mock-email' });
};
process.env.RESEND_API_KEY = 'local-test-only';
const api = require('../src/app/api/[...path]/route.ts');
const { ensureAffiliateSchema } = require('../src/lib/server/affiliate-schema.ts');
const { affiliateMonth, commissionRate } = require('../src/lib/affiliate.ts');
let testNumber = 0;
async function call(url, method = 'GET', body, token = '', cookie = '', raw = false) {
  const req = new Request('https://loyvance.example/api/' + url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(cookie ? { Cookie: cookie } : {}), 'x-forwarded-for': '127.0.0.' + (++testNumber) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const response = await api[method](req, { params: Promise.resolve({ path: url.split('?')[0].split('/') }) });
  if (raw) return response;
  return { status: response.status, body: await response.json() };
}
async function ok(url, method, body, token = 'admin-test', cookie) {
  const result = await call(url, method, body, token, cookie);
  assert(result.status >= 200 && result.status < 300, `${method || 'GET'} ${url}: ${JSON.stringify(result)}`);
  return result.body;
}
async function signup(name, cookie = '', extra = {}) {
  const email = name + '@example.test';
  const response = await ok('auth/register', 'POST', { business_name: name, business_email: email, name, email, password: 'Test-only-Password1!', password_confirmation: 'Test-only-Password1!', ...extra }, '', cookie);
  assert.equal(response.verification_required, true);
  const code = sent.findLast(x => x.to.includes(email)).subject.match(/^\d{6}/)[0];
  // No cookie on verification: the validated attribution must survive in the OTP payload.
  return ok('auth/verify-business-email', 'POST', { email, code }, '');
}
const today = new Date().toISOString();
const thisMonth = affiliateMonth();
async function activate(business, months, amount, overrides = {}) {
  const detail = await ok(`admin/businesses/${business}/subscription`);
  const body = { request_id: randomUUID(), revision: detail.subscription.revision, duration_months: months, mode: 'extend', note: 'Local test verified payment', payment_recorded: amount !== null, paid_amount: amount, payment_method: 'cash', paid_at: today, payment_confirmed: amount !== null, ...overrides };
  const result = await ok(`admin/businesses/${business}/subscription`, 'POST', body);
  return { body, result };
}
async function main() {
  assert.equal((await call('admin/affiliates')).status, 401);
  const adminId = randomUUID();
  await sql`INSERT INTO app_users(id,name,email,password_hash,role) VALUES(${adminId},'Test admin','admin@example.test','unused','platform_admin')`;
  await sql`INSERT INTO user_sessions(token,user_id) VALUES('admin-test',${adminId})`;
  await ensureAffiliateSchema(sql); // repeat migration is safe
  assert.equal(commissionRate('12.34'), 1234);
  for (const value of [0, -1, '100.01', '1e2', '20.001', 'abc']) assert.equal(commissionRate(value), null);

  const createBody = { request_id: randomUUID(), name: 'Test partner', code: 'test-partner', email: 'partner@example.test', commission_percent: '12.50' };
  const { affiliate } = await ok('admin/affiliates', 'POST', createBody);
  assert.equal((await ok('admin/affiliates', 'POST', createBody)).affiliate.id, affiliate.id);
  assert.equal((await call('admin/affiliates', 'POST', { ...createBody, request_id: randomUUID() }, 'admin-test')).status, 409);
  assert.equal((await call('admin/affiliates', 'POST', { ...createBody, request_id: randomUUID(), code: 'bad/path' }, 'admin-test')).status, 422);
  const second = (await ok('admin/affiliates', 'POST', { request_id: randomUUID(), name: 'Other partner', commission_percent: 20 })).affiliate;
  assert.match(second.code, /^ref-[a-f0-9]{12}$/);
  const visit = await call('referrals/test-partner', 'GET', undefined, '', '', true);
  assert.equal(visit.status, 302); assert.equal(visit.headers.get('location'), 'https://loyvance.example/register');
  assert.match(visit.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Secure/);
  const cookie = visit.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('referrals/' + second.code, 'GET', undefined, '', cookie, true)).headers.get('set-cookie'), null);
  assert.equal((await call('referrals/unknown-code', 'GET', undefined, '', '', true)).headers.get('set-cookie'), null);
  const customer = await signup('referred-business', cookie, { affiliate_id: second.id });
  const businessId = customer.user.business_id;
  assert.equal((await sql`SELECT affiliate_id FROM affiliate_referrals WHERE business_id=${businessId}`)[0].affiliate_id, affiliate.id);
  assert.equal((await call('admin/affiliates', 'GET', undefined, customer.token)).status, 403);
  assert.equal((await call('admin/affiliates', 'POST', createBody, customer.token)).status, 403);
  assert.equal((await call(`admin/affiliates/${affiliate.id}/export`, 'GET', undefined, customer.token)).status, 403);
  const direct = await signup('direct-business', '', { affiliate_id: affiliate.id });
  assert.equal((await sql`SELECT * FROM affiliate_referrals WHERE business_id=${direct.user.business_id}`).length, 0);
  const self = await signup('partner', cookie);
  assert.equal((await sql`SELECT * FROM affiliate_referrals WHERE business_id=${self.user.business_id}`).length, 0);
  console.log('PASS: admin authorization, partner creation/duplicates, generated/custom URLs, secure first-touch referral, signup/OTP binding, self-referral and forged signup protection');

  await activate(businessId, 1, null);
  assert.equal((await sql`SELECT * FROM affiliate_commissions`).length, 0);
  const amounts = ['149.00', '399.00', '749.00', '1299.00'];
  for (const [index, months] of [1, 3, 6, 12].entries()) {
    const event = await activate(businessId, months, amounts[index]);
    await ok(`admin/businesses/${businessId}/subscription`, 'POST', event.body); // retry activation
    const rows = await sql`SELECT * FROM affiliate_commissions WHERE event_id=${event.body.request_id}`;
    assert.equal(rows.length, 1); assert.equal(rows[0].duration_months, months);
    assert.equal(rows[0].amount_centimes, Math.round(Number(amounts[index]) * 100 * .125));
  }
  await activate(direct.user.business_id, 1, '149');
  assert.equal((await sql`SELECT * FROM affiliate_commissions WHERE business_id=${direct.user.business_id}`).length, 0);
  await ok(`admin/affiliates/${affiliate.id}`, 'PATCH', { name: affiliate.name, email: affiliate.email, commission_percent: '20', active: false, revision: 0 });
  assert.equal((await call(`admin/affiliates/${affiliate.id}`, 'PATCH', { name: affiliate.name, email: affiliate.email, commission_percent: '30', active: true, revision: 0 }, 'admin-test')).status, 409);
  assert.equal((await call('referrals/test-partner', 'GET', undefined, '', '', true)).headers.get('set-cookie'), null);
  const pausedSignup = await signup('paused-business', cookie);
  assert.equal((await sql`SELECT * FROM affiliate_referrals WHERE business_id=${pausedSignup.user.business_id}`).length, 0);
  await activate(businessId, 3, '100.05'); // paused partner still earns for existing clients, actual amount not plan price
  const commissions = await sql`SELECT * FROM affiliate_commissions WHERE affiliate_id=${affiliate.id} ORDER BY created_at`;
  assert.equal(commissions.length, 5); assert.equal(commissions[0].rate_bps, 1250);
  assert.equal(commissions[4].amount_centimes, 2001); assert.equal(commissions[4].rate_bps, 2000);
  const stalePayment = await ok(`admin/businesses/${businessId}/subscription`);
  const rejected = await call(`admin/businesses/${businessId}/subscription`, 'POST', { request_id: randomUUID(), revision: stalePayment.subscription.revision, duration_months: 1, note: 'unconfirmed', payment_recorded: true, paid_amount: '149', payment_method: 'cash', paid_at: today }, 'admin-test');
  assert.equal(rejected.status, 422); assert.equal((await sql`SELECT * FROM affiliate_commissions`).length, 5);
  console.log('PASS: 1/3/6/12-month plans, renewals, exact centime rounding, actual amount, immutable historical rate, no commission for free/unconfirmed/direct payments, idempotent activations');

  const detail = await ok(`admin/affiliates/${affiliate.id}?month=${thisMonth}`);
  assert.equal(detail.commission_total, 5); assert.equal(detail.referral_total, 1);
  const total = commissions.reduce((sum, c) => sum + c.amount_centimes, 0);
  assert.equal(detail.settlement.amount_centimes, total);
  const payoutBody = { request_id: randomUUID(), commission_ids: detail.settlement.ids, amount_centimes: total, reference: 'LOCAL PAYOUT ONLY', paid_at: today, confirmed: true };
  assert.equal((await call(`admin/affiliates/${affiliate.id}/payouts?month=${thisMonth}`, 'POST', { ...payoutBody, amount_centimes: total + 1 }, 'admin-test')).status, 409);
  assert.equal((await call(`admin/affiliates/${second.id}/payouts?month=${thisMonth}`, 'POST', payoutBody, 'admin-test')).status, 409);
  const payoutBodies = [payoutBody, { ...payoutBody, request_id: randomUUID() }];
  const attempts = await Promise.all(payoutBodies.map(body => call(`admin/affiliates/${affiliate.id}/payouts?month=${thisMonth}`, 'POST', body, 'admin-test')));
  assert.deepEqual(attempts.map(a => a.status).sort(), [201, 409]);
  await ok(`admin/affiliates/${affiliate.id}/payouts?month=${thisMonth}`, 'POST', payoutBodies[attempts.findIndex(a => a.status === 201)]);
  assert.equal((await sql`SELECT * FROM affiliate_payouts`).length, 1);
  const settled = await ok(`admin/affiliates/${affiliate.id}?month=${thisMonth}`);
  assert.equal(settled.settlement.amount_centimes, 0); assert.equal(settled.affiliate.month_paid, total);
  assert.equal((await call(`admin/affiliates/${affiliate.id}/commissions/${commissions[0].id}/void`, 'POST', { reason: 'cannot void paid' }, 'admin-test')).status, 409);
  await activate(businessId, 6, '749.99');
  const toVoid = (await ok(`admin/affiliates/${affiliate.id}?month=${thisMonth}`)).commissions.find(c => !c.payout_id);
  await ok(`admin/affiliates/${affiliate.id}/commissions/${toVoid.id}/void`, 'POST', { reason: 'Refunded outside platform' });
  assert.equal((await ok(`admin/affiliates/${affiliate.id}?month=${thisMonth}`)).settlement.amount_centimes, 0);
  console.log('PASS: exact reviewed payout amount, cross-partner isolation, double-submit/racing payout requests, retry idempotency, paid ledger preservation and unpaid voids');

  const previous = new Date(Date.UTC(Number(thisMonth.slice(0,4)), Number(thisMonth.slice(5))-2, 15, 12)).toISOString();
  const previousMonth = affiliateMonth(new Date(previous));
  await activate(businessId, 1, '149', { paid_at: previous });
  const old = await ok(`admin/affiliates/${affiliate.id}?month=${previousMonth}`);
  assert.equal(old.affiliate.month_earned, 2980); assert.equal(old.settlement.amount_centimes, 2980);
  const now = await ok(`admin/affiliates/${affiliate.id}?month=${thisMonth}`);
  assert.equal(now.settlement.amount_centimes, 2980); assert.equal(now.affiliate.month_earned, total);
  const boundary = '2024-09-30T23:30:00.000Z'; // Historical UTC+1 boundary, independent of future timezone rule changes.
  assert.equal(affiliateMonth(new Date(boundary)), '2024-10');
  await sql`UPDATE affiliate_commissions SET earned_at=${boundary}::timestamptz WHERE id=${commissions[0].id}`;
  assert.equal((await ok(`admin/affiliates/${affiliate.id}?month=2024-09`)).affiliate.month_earned, 0);
  assert.equal((await ok(`admin/affiliates/${affiliate.id}?month=2024-10`)).affiliate.month_earned, commissions[0].amount_centimes);
  await sql`UPDATE affiliate_commissions SET earned_at=${today}::timestamptz WHERE id=${commissions[0].id}`;
  await sql`UPDATE affiliate_commissions SET business_name='=HYPERLINK("bad")' WHERE id=${commissions[0].id}`;
  const csv = await call(`admin/affiliates/${affiliate.id}/export?month=${thisMonth}`, 'GET', undefined, 'admin-test', '', true);
  assert.equal(csv.status, 200); const csvText = await csv.text();
  assert(csvText.includes("\"'=HYPERLINK")); assert(csvText.includes('12.50')); assert(csvText.includes('void'));
  const expiredToken = cookie.split('=')[1];
  const tokenHash = createHash('sha256').update(expiredToken).digest('hex');
  await sql`UPDATE affiliate_visits SET expires_at=now()-interval '1 day' WHERE token_hash=${tokenHash}`;
  const { registrationAffiliate } = require('../src/lib/server/affiliates.ts');
  assert.equal(await registrationAffiliate(sql, new Request('https://example.test', { headers: { Cookie: cookie } }), []), null);
  assert((await sql`SELECT count(*)::int AS n FROM admin_audit_logs WHERE action LIKE 'affiliate_%'`)[0].n >= 5);
  console.log('PASS: monthly cash accounting, carry-forward of backdated payments, Casablanca month boundary, CSV formula safety, cookie expiry and audit trail');
}
main().then(() => console.log('All affiliate integration checks passed. No real accounts, payments or emails were created.')).finally(async () => {
  Module._load = originalLoad; global.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = originalKey;
  await db.close();
}).catch(error => { console.error(error); process.exitCode = 1; });
