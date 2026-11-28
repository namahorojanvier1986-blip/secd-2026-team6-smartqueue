/**
 * End-to-end API tests (UI -> API -> database path, minus the browser).
 * Uses a separate database: TEST_DATABASE_URL or .../smart_queue_test
 *   createdb smart_queue_test && npm test
 */
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/smart_queue_test';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/db');
const { setup } = require('../src/db/migrate');
const { normalizeRwandaPhone } = require('../src/utils/phone');

let server;
let base;
let tellerToken;
let adminToken;

async function api(method, path, body, token) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

before(async () => {
  await setup({ resetFirst: true });
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  server.close();
  await db.pool.end();
});

test('phone numbers are validated and normalised', () => {
  assert.equal(normalizeRwandaPhone('078 123 4567'), '+250781234567');
  assert.equal(normalizeRwandaPhone('+250 722 000 111'), '+250722000111');
  assert.equal(normalizeRwandaPhone('250731234567'), '+250731234567');
  assert.equal(normalizeRwandaPhone('0751234567'), null); // not a Rwandan mobile prefix
  assert.equal(normalizeRwandaPhone('12345'), null);
});

test('a fresh installation requires the first-run setup', async () => {
  const info = await api('GET', '/info');
  assert.equal(info.body.setupRequired, true);
  assert.equal((await api('GET', '/services')).status, 503);
  assert.equal((await api('POST', '/auth/login', { username: 'admin', password: 'x' })).status, 503);

  const status = await api('GET', '/setup/status');
  assert.equal(status.body.setupRequired, true);
  assert.ok(status.body.services.length >= 5);

  // Validation
  assert.equal((await api('POST', '/setup', { institutionName: '' })).status, 400);

  const done = await api('POST', '/setup', {
    institutionName: 'Umurenge SACCO',
    branchName: 'Nyamirambo',
    managerName: 'Grace Mukamana',
    username: 'admin',
    password: 'admin12345',
    counters: 4,
    defaultLanguage: 'en',
    services: ['D', 'W', 'A', 'L', 'C'],
  });
  assert.equal(done.status, 201);
  assert.ok(done.body.token);
  assert.equal(done.body.user.role, 'admin');
  adminToken = done.body.token;

  // Runs only once
  assert.equal((await api('POST', '/setup', { institutionName: 'Other' })).status, 409);
  const after = await api('GET', '/info');
  assert.equal(after.body.setupRequired, false);
  assert.equal(after.body.institutionName, 'Umurenge SACCO');

  // Manager adds a teller from the dashboard
  const teller = await api(
    'POST',
    '/admin/staff',
    { fullName: 'Aline Uwase', username: 'teller1', password: 'teller123', role: 'teller' },
    adminToken
  );
  assert.equal(teller.status, 201);
});

test('services are listed with live queue info', async () => {
  const { status, body } = await api('GET', '/services');
  assert.equal(status, 200);
  assert.ok(body.length >= 5);
  assert.ok('waiting' in body[0] && 'estimatedWaitMinutes' in body[0]);
  assert.equal(body[0].nameRw, 'Kubitsa amafaranga');
});

test('tickets get sequential numbers and an issued notification', async () => {
  const numbers = [];
  for (const phone of ['0781000001', '0781000002', '0781000003', '0781000004', '0781000005']) {
    const r = await api('POST', '/tickets', { phone, serviceId: 1 });
    assert.equal(r.status, 201);
    numbers.push(r.body.number);
  }
  assert.deepEqual(numbers, [1, 2, 3, 4, 5]);

  const sixth = await api('POST', '/tickets', { phone: '0781000006', serviceId: 1 });
  assert.equal(sixth.body.number, 6);
  assert.equal(sixth.body.displayNumber, '006');
  assert.equal(sixth.body.customersAhead, 5);
  assert.ok(sixth.body.estimatedWaitMinutes > 0);
  assert.equal(sixth.body.notifications[0].type, 'ticket_issued');
  assert.match(sixth.body.notifications[0].message, /queue number is 006/);
  assert.equal(sixth.body.phone, '078****006'); // masked
});

test('invalid input is rejected', async () => {
  assert.equal((await api('POST', '/tickets', { phone: '123', serviceId: 1 })).status, 400);
  assert.equal((await api('POST', '/tickets', { phone: '0782000000' })).status, 400);
  assert.equal(
    (await api('POST', '/tickets', { phone: '0782000000', serviceId: 1, isPriority: true })).status,
    400
  );
});

test('one active ticket per phone per day', async () => {
  const r = await api('POST', '/tickets', { phone: '+250781000001', serviceId: 2 });
  assert.equal(r.status, 409);
  assert.ok(r.body.code);
});

test('priority customers are placed ahead of the normal queue', async () => {
  const p = await api('POST', '/tickets', {
    phone: '0791000001',
    serviceId: 1,
    isPriority: true,
    priorityReason: 'elderly',
  });
  assert.equal(p.status, 201);
  assert.equal(p.body.number, 7);
  assert.equal(p.body.customersAhead, 0);
  assert.equal(p.body.priorityReason, 'elderly');

  const normal = await api('GET', `/tickets/${(await api('GET', '/tickets/lookup?phone=0781000002&number=2')).body.code}`);
  assert.equal(normal.body.customersAhead, 2); // ticket 1 + priority ticket 7
});

test('staff login works and protects routes', async () => {
  assert.equal((await api('GET', '/teller/state')).status, 401);
  assert.equal((await api('POST', '/auth/login', { username: 'teller1', password: 'wrong' })).status, 401);
  const t = await api('POST', '/auth/login', { username: 'teller1', password: 'teller123' });
  assert.equal(t.status, 200);
  tellerToken = t.body.token;
  const a = await api('POST', '/auth/login', { username: 'admin', password: 'admin12345' });
  assert.equal(a.status, 200);
  adminToken = a.body.token;
  assert.equal((await api('GET', '/admin/stats', null, tellerToken)).status, 403);
});

test('teller serves the queue: priority first, then sequential', async () => {
  // Calling before choosing a counter fails
  assert.equal((await api('POST', '/teller/call-next', null, tellerToken)).status, 400);

  const open = await api('PUT', '/teller/counter', { counterId: 1 }, tellerToken);
  assert.equal(open.status, 200);
  assert.equal(open.body.me.counter_id, 1);
  assert.equal(open.body.queue[0].displayNumber, '007'); // priority first

  const first = await api('POST', '/teller/call-next', null, tellerToken);
  assert.equal(first.body.ticket.number, 7);

  // Cannot call another customer while one is at the counter
  assert.equal((await api('POST', '/teller/call-next', null, tellerToken)).status, 409);

  const id = first.body.ticket.id;
  assert.equal((await api('POST', `/teller/tickets/${id}/recall`, null, tellerToken)).status, 200);
  assert.equal((await api('POST', `/teller/tickets/${id}/start`, null, tellerToken)).body.status, 'serving');
  assert.equal((await api('POST', `/teller/tickets/${id}/complete`, null, tellerToken)).body.status, 'served');

  const customer = await api('GET', `/tickets/${first.body.ticket.code}`);
  const types = customer.body.notifications.map((n) => n.type);
  assert.deepEqual(types.slice(0, 4), ['completed', 'recalled', 'called', 'ticket_issued']);

  const second = await api('POST', '/teller/call-next', null, tellerToken);
  assert.equal(second.body.ticket.number, 1);
  const called = await api('GET', `/tickets/${second.body.ticket.code}`);
  assert.equal(called.body.status, 'called');
  assert.equal(called.body.counter, 'Counter 1');
  assert.match(called.body.notifications[0].message, /proceed to Counter 1/);

  const ns = await api('POST', `/teller/tickets/${second.body.ticket.id}/no-show`, null, tellerToken);
  assert.equal(ns.body.status, 'no_show');
});

test('customers are alerted when their turn approaches', async () => {
  // Threshold 3: tickets with fewer than 3 people ahead get "turn_approaching"
  const lookup = await api('GET', '/tickets/lookup?phone=0781000004&number=4');
  assert.equal(lookup.body.customersAhead, 2);
  assert.ok(lookup.body.notifications.some((n) => n.type === 'turn_approaching'));

  const far = await api('GET', '/tickets/lookup?phone=0781000006&number=6');
  assert.ok(!far.body.notifications.some((n) => n.type === 'turn_approaching'));
});

test('customers get an alert about 2 minutes before their turn', async () => {
  // Cash Deposit: 4 min per customer, 1 open counter.
  // Ticket 2 is now next in line (estimated wait 0 min) -> alerted once
  const next = await api('GET', '/tickets/lookup?phone=0781000002&number=2');
  assert.equal(next.body.customersAhead, 0);
  const alerts = next.body.notifications.filter((n) => n.type === 'two_minutes');
  assert.equal(alerts.length, 1);
  assert.match(alerts[0].message, /about 2 minutes/);

  // Ticket 3 still has about 4 minutes to wait -> no 2-minute alert yet
  const later = await api('GET', '/tickets/lookup?phone=0781000003&number=3');
  assert.ok(later.body.estimatedWaitMinutes > 2);
  assert.ok(!later.body.notifications.some((n) => n.type === 'two_minutes'));
});

test('customer can cancel a waiting ticket and mark notifications read', async () => {
  const t = await api('GET', '/tickets/lookup?phone=0781000006&number=6');
  const c = await api('POST', `/tickets/${t.body.code}/cancel`);
  assert.equal(c.body.status, 'cancelled');
  assert.equal((await api('POST', `/tickets/${t.body.code}/cancel`)).status, 409);
  const r = await api('POST', `/tickets/${t.body.code}/notifications/read`);
  assert.ok(r.body.updated >= 1);
});

test('notifications are written in the language the customer chose', async () => {
  const rw = await api('POST', '/tickets', { phone: '0722000001', serviceId: 2, language: 'rw' });
  assert.equal(rw.status, 201);
  assert.equal(rw.body.language, 'rw');
  const n = rw.body.notifications[0];
  assert.match(n.title, /^Tike \d{3} yemejwe$/);
  assert.match(n.message, /Murakaza neza kuri Umurenge SACCO/);
  assert.match(n.message, /Kubikuza amafaranga/);
  assert.equal(n.data.service, 'Cash Withdrawal'); // data lets the page re-render it in English
  assert.equal(n.data.serviceRw, 'Kubikuza amafaranga');

  const en = await api('POST', '/tickets', { phone: '0722000002', serviceId: 2 });
  assert.equal(en.body.language, 'en'); // institution default
  assert.match(en.body.notifications[0].message, /^Welcome to Umurenge SACCO/);
  await api('POST', `/tickets/${rw.body.code}/cancel`);
  await api('POST', `/tickets/${en.body.code}/cancel`);
});

test('display board and admin reports', async () => {
  const d = await api('GET', '/display');
  assert.equal(d.status, 200);
  assert.ok(Array.isArray(d.body.upNext) && d.body.upNext.length > 0);

  const s = await api('GET', '/admin/stats', null, adminToken);
  assert.equal(s.status, 200);
  assert.equal(s.body.totals.total, 9);
  assert.equal(s.body.totals.served, 1);
  assert.equal(s.body.totals.priority, 1);
  assert.equal(s.body.totals.cancelled, 3);

  const st = await api('PUT', '/admin/settings', { approach_threshold: 5 }, adminToken);
  assert.equal(st.body.approach_threshold, '5');
  assert.equal((await api('PUT', '/admin/settings', { approach_threshold: 0 }, adminToken)).status, 400);
  const lang = await api('PUT', '/admin/settings', { default_language: 'rw', institution_name: 'Umurenge SACCO Nyamirambo' }, adminToken);
  assert.equal(lang.body.default_language, 'rw');
  assert.equal((await api('PUT', '/admin/settings', { institution_name: '' }, adminToken)).status, 400);
});

