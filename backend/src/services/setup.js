/**
 * First-run setup. A fresh deployment has no institution name, no services,
 * no counters and no staff. The institution's manager opens the app, completes
 * the setup wizard once, and is signed straight into the admin dashboard.
 */
const bcrypt = require('bcryptjs');
const db = require('../db');
const { ApiError } = require('../utils/errors');

// Services the manager can choose from in the wizard (editable later in Admin > Services)
const DEFAULT_SERVICES = [
  { code: 'D', group: 'cash', minutes: 4, selected: true, name: 'Cash Deposit', nameRw: 'Kubitsa amafaranga', description: 'Deposit cash into your account', descriptionRw: 'Gushyira amafaranga kuri konti yawe' },
  { code: 'W', group: 'cash', minutes: 4, selected: true, name: 'Cash Withdrawal', nameRw: 'Kubikuza amafaranga', description: 'Withdraw cash over the counter', descriptionRw: 'Gukura amafaranga kuri konti yawe' },
  { code: 'A', group: 'desk', minutes: 15, selected: true, name: 'Account Opening', nameRw: 'Gufungura konti', description: 'Open a new personal or business account', descriptionRw: "Gufungura konti nshya bwite cyangwa y'ubucuruzi" },
  { code: 'L', group: 'desk', minutes: 12, selected: true, name: 'Loans & Credit', nameRw: 'Inguzanyo', description: 'Loan applications and enquiries', descriptionRw: "Gusaba inguzanyo n'amakuru ajyanye nayo" },
  { code: 'C', group: 'desk', minutes: 7, selected: true, name: 'Customer Care', nameRw: "Serivisi z'abakiriya", description: 'Cards, statements, complaints and enquiries', descriptionRw: "Amakarita, imbonerahamwe za konti, ibibazo n'ibisobanuro" },
  { code: 'T', group: 'cash', minutes: 5, selected: false, name: 'Transfers & Payments', nameRw: 'Kohereza no kwishyura', description: 'Money transfers, bills and tax payments', descriptionRw: "Kohereza amafaranga, kwishyura fagitire n'imisoro" },
  { code: 'M', group: 'desk', minutes: 6, selected: false, name: 'Mobile & Internet Bing', nameRw: 'Serivisi za telefoni na interineti', description: 'Register for or fix mobile and internet Bing', descriptionRw: 'Kwiyandikisha cyangwa gukemura ibibazo bya serivisi za telefoni na interineti' },
  { code: 'F', group: 'cash', minutes: 5, selected: false, name: 'Foreign Exchange', nameRw: 'Kuvunja amafaranga', description: 'Buy and sell foreign currency', descriptionRw: 'Kugura no kugurisha amadovize' },
];

let setupDoneCache = false;

async function isSetupComplete() {
  if (setupDoneCache) return true;
  const { rows } = await db.query("SELECT value FROM settings WHERE key = 'setup_completed'");
  setupDoneCache = rows[0] && rows[0].value === 'true';
  return setupDoneCache;
}

function resetCache() {
  setupDoneCache = false;
}

/**
 * Splits the chosen services across the counters:
 * cash services go to the general counters, desk services (accounts, loans,
 * customer care) to the last counter. Every counter gets at least one service.
 */
function planCounters(count, services) {
  const cash = services.filter((s) => s.group === 'cash').map((s) => s.code);
  const desk = services.filter((s) => s.group === 'desk').map((s) => s.code);
  const all = services.map((s) => s.code);
  const plan = [];
  for (let i = 1; i <= count; i++) {
    let codes = all;
    if (count > 1 && cash.length && desk.length) codes = i === count ? desk : cash;
    plan.push({ name: `Counter ${i}`, codes });
  }
  return plan;
}

async function completeSetup(body) {
  const institutionName = String(body.institutionName || '').trim();
  const branchName = String(body.branchName || '').trim();
  const managerName = String(body.managerName || '').trim();
  const username = String(body.username || '').trim().toLowerCase();
  const password = String(body.password || '');
  const counters = parseInt(body.counters, 10);
  const defaultLanguage = body.defaultLanguage === 'rw' ? 'rw' : 'en';
  const codes = Array.isArray(body.services) ? body.services.map(String) : [];
  const chosen = DEFAULT_SERVICES.filter((s) => codes.includes(s.code));

  if (institutionName.length < 2) throw new ApiError(400, 'Enter the name of your institution');
  if (managerName.length < 2) throw new ApiError(400, "Enter the manager's full name");
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) throw new ApiError(400, 'Username: 3-50 letters, numbers, . _ -');
  if (password.length < 8) throw new ApiError(400, 'Password must be at least 8 characters');
  if (!(counters >= 1 && counters <= 20)) throw new ApiError(400, 'Number of counters must be between 1 and 20');
  if (!chosen.length) throw new ApiError(400, 'Choose at least one service');

  const result = await db.withTransaction(async (c) => {
    // Only one setup can ever run, even if two browsers submit at once
    await c.query('SELECT pg_advisory_xact_lock(724242)');
    const done = await c.query("SELECT value FROM settings WHERE key = 'setup_completed'");
    if (done.rows[0] && done.rows[0].value === 'true') {
      throw new ApiError(409, 'This system has already been set up. Please sign in.');
    }

    const ids = {};
    for (const s of chosen) {
      const r = await c.query(
        `INSERT INTO services (code, name, name_rw, description, description_rw, avg_service_minutes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name_rw = EXCLUDED.name_rw, is_active = TRUE
         RETURNING id`,
        [s.code, s.name, s.nameRw, s.description, s.descriptionRw, s.minutes]
      );
      ids[s.code] = r.rows[0].id;
    }

    for (const plan of planCounters(counters, chosen)) {
      const r = await c.query(
        `INSERT INTO counters (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [plan.name]
      );
      for (const code of plan.codes) {
        await c.query(
          'INSERT INTO counter_services (counter_id, service_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [r.rows[0].id, ids[code]]
        );
      }
    }

    const admin = await c.query(
      `INSERT INTO staff (full_name, username, password_hash, role) VALUES ($1, $2, $3, 'admin')
       ON CONFLICT (username) DO UPDATE SET full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash, role = 'admin', is_active = TRUE
       RETURNING id, full_name, username, role`,
      [managerName, username, bcrypt.hashSync(password, 10)]
    );

    const settings = {
      institution_name: institutionName,
      branch_name: branchName,
      default_language: defaultLanguage,
      setup_completed: 'true',
    };
    for (const [key, value] of Object.entries(settings)) {
      await c.query(
        `INSERT INTO settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    }
    return admin.rows[0];
  });

  setupDoneCache = true;
  return result;
}

module.exports = { DEFAULT_SERVICES, isSetupComplete, completeSetup, resetCache, planCounters };

