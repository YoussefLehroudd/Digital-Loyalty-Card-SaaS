/* eslint-disable @typescript-eslint/no-require-imports -- Run actual TypeScript handlers in a local PostgreSQL regression test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }, fileName: filename,
}).outputText, filename);
const { ensureAffiliateSchema, handleAdminAffiliates } = require(process.env.AFFILIATE_TEST_SOURCE || path.join(__dirname, '../src/lib/server/affiliates.ts'));
function sql(parts, ...values) { return db.query(parts.reduce((s, p, i) => s + (i ? '$' + i : '') + p, ''), values).then(r => r.rows); }
async function account(name, role = 'customer') {
  const id = randomUUID(), email = id + '@example.test';
  await sql`INSERT INTO app_users(id,name,email,role,status) VALUES(${id},${name},${email},${role},'active')`;
  return { id, email, name };
}
async function grant(user, code) {
  const response = await handleAdminAffiliates(['admin', 'affiliates'], new Request('https://loyvance.example/api/admin/affiliates', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: user.id, code }),
  }), sql, { id: randomUUID() });
  return { status: response.status, body: await response.json() };
}
function created(result) {
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.match(result.body.affiliate.code, /^[a-z0-9][a-z0-9-]{2,39}$/);
  return result.body.affiliate;
}
async function main() {
  await db.exec(`
    CREATE TABLE businesses(id uuid PRIMARY KEY,name text,email text);
    CREATE TABLE app_users(id uuid PRIMARY KEY,name text,email text UNIQUE,role text,status text,business_id uuid REFERENCES businesses(id));
    CREATE TABLE subscription_events(id uuid PRIMARY KEY);
  `);
  await ensureAffiliateSchema(sql);

  const firstUser = await account('Salim Jhilal');
  const first = created(await grant(firstUser));
  const second = created(await grant(await account('SALIM JHILAL')));
  assert.equal(first.code, 'salim-jhilal');
  assert.match(second.code, /^salim-jhilal-[0-9a-f]{8}$/);
  assert.notEqual(first.id, second.id);
  assert.equal((await sql`SELECT code FROM affiliate_partners WHERE id=${first.id}`)[0].code, first.code);
  console.log('PASS: different accounts with identical names receive distinct links; the existing link stays unchanged.');

  const customUser = await account('Custom partner');
  const collision = await grant(customUser, first.code);
  assert.equal(collision.status, 409);
  assert.match(collision.body.message, /referral code is already in use/i);
  assert.equal((await sql`SELECT * FROM affiliate_partners WHERE user_id=${customUser.id}`).length, 0);
  const custom = created(await grant(customUser, 'my-custom-link'));
  assert.equal(custom.code, 'my-custom-link');
  const badUser = await account('Bad custom code');
  assert.equal((await grant(badUser, 'bad/path')).status, 422);
  assert.equal((await grant(badUser, 'x'.repeat(41))).status, 422);
  created(await grant(badUser, '   '));

  const short = created(await grant(await account('Al')));
  const arabic = created(await grant(await account('سليم الجيلالي')));
  assert.equal(short.code, 'partner');
  assert.match(arabic.code, /^partner-[0-9a-f]{8}$/);
  const accented = created(await grant(await account('Éléonore')));
  assert.equal(accented.code, 'eleonore');
  const longOne = created(await grant(await account('a'.repeat(100))));
  const longTwo = created(await grant(await account('a'.repeat(100))));
  assert.equal(longOne.code.length, 40); assert.equal(longTwo.code.length, 40); assert.notEqual(longOne.code, longTwo.code);
  console.log('PASS: custom-code validation and collisions, blank codes, Arabic, accents, short and long names.');

  const sameNameUsers = await Promise.all([account('Concurrent partner'), account('Concurrent partner')]);
  const sameNameResults = (await Promise.all(sameNameUsers.map(u => grant(u)))).map(created);
  assert.notEqual(sameNameResults[0].code, sameNameResults[1].code);
  const sameUser = await account('One account only');
  const sameUserResults = await Promise.all([grant(sameUser), grant(sameUser)]);
  assert.deepEqual(sameUserResults.map(r => r.status).sort(), [201, 409]);
  assert.equal((await sql`SELECT * FROM affiliate_partners WHERE user_id=${sameUser.id}`).length, 1);
  assert.equal((await grant(firstUser)).status, 409);
  console.log('PASS: concurrent same-name grants succeed, while repeated or competing grants for one account stay unique.');

  await sql`UPDATE affiliate_partners SET archived_at=now(),is_active=false WHERE id=${first.id}`;
  const afterArchived = created(await grant(await account('Salim Jhilal')));
  assert.notEqual(afterArchived.code, first.code);
  const legacyUser = await account('Legacy partner');
  const legacyId = randomUUID(), businessId = randomUUID(), eventId = randomUUID();
  await sql`INSERT INTO affiliate_partners(id,name,email,code,password_hash) VALUES(${legacyId},'Legacy partner',${legacyUser.email},'legacy-link','unused')`;
  await sql`INSERT INTO businesses(id,name,email) VALUES(${businessId},'Local business','business@example.test')`;
  await sql`INSERT INTO subscription_events(id) VALUES(${eventId})`;
  await sql`INSERT INTO affiliate_businesses(business_id,affiliate_id) VALUES(${businessId},${legacyId})`;
  await sql`INSERT INTO affiliate_commissions(subscription_event_id,affiliate_id,business_id,duration_months,amount_centimes,rate_bps,commission_centimes)
    VALUES(${eventId},${legacyId},${businessId},1,14900,1500,2235)`;
  const linked = await grant(legacyUser);
  assert.equal(linked.status, 200); assert.equal(linked.body.linked_existing, true); assert.equal(linked.body.affiliate.id, legacyId);
  assert.equal(linked.body.affiliate.code, 'legacy-link');
  assert.equal((await sql`SELECT commission_centimes FROM affiliate_commissions WHERE affiliate_id=${legacyId}`)[0].commission_centimes, 2235);
  assert.equal((await sql`SELECT role FROM app_users WHERE id=${legacyUser.id}`)[0].role, 'customer');

  const archivedEmailUser = await account('Archived email');
  await sql`INSERT INTO affiliate_partners(id,name,email,code,password_hash,archived_at) VALUES(${randomUUID()},'Archived',${archivedEmailUser.email},'archived-email','unused',now())`;
  const archivedConflict = await grant(archivedEmailUser);
  assert.equal(archivedConflict.status, 409); assert.match(archivedConflict.body.message, /archived/i);
  const otherEmailUser = await account('Another email conflict'), owner = await account('Existing owner');
  await sql`INSERT INTO affiliate_partners(id,user_id,name,email,code,password_hash) VALUES(${randomUUID()},${owner.id},'Owned partner',${otherEmailUser.email},'owned-email','unused')`;
  const emailConflict = await grant(otherEmailUser);
  assert.equal(emailConflict.status, 409); assert.match(emailConflict.body.message, /email already belongs/i);
  assert.equal((await sql`SELECT user_id FROM affiliate_partners WHERE email=${otherEmailUser.email}`)[0].user_id, owner.id);
  console.log('PASS: archived links remain reserved; legacy linking preserves commissions; email conflicts never reassign existing partners.');
}
main().finally(() => db.close()).catch(error => { console.error(error); process.exitCode = 1; });
