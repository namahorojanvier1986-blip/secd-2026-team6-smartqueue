/**
 * Database setup.
 *   node src/db/migrate.js            create/upgrade tables (keeps data)
 *   node src/db/migrate.js --reset    delete everything -> next start shows the first-run setup
 *   node src/db/migrate.js --demo     reset and fill with a ready-made demo institution
 */
const fs = require('fs');
const path = require('path');
const db = require('./index');

// Settings every installation has. Institution name etc. come from the first-run setup.
const DEFAULT_SETTINGS = {
  institution_name: '',
  branch_name: '',
  default_language: 'en',
  setup_completed: 'false',
  approach_threshold: '3', // notify when fewer than this many customers are ahead
  webhook_url: '', // optional: POST every notification here (e.g. the B's mobile app backend)
  priority_policy:
    'Priority customers (pregnant women, elderly people and persons with disabilities) are served before the normal queue.',
};

async function reset() {
  await db.query(`
    DROP TABLE IF EXISTS notifications, tickets, daily_sequences, staff,
      counter_services, counters, services, settings CASCADE;
  `);
  require('../services/setup').resetCache();
}

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await db.query(sql);
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.query('INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING', [key, value]);
  }
  // Installations from the first version already had data: mark them as set up.
  await db.query(
    `UPDATE settings SET value = 'true'
      WHERE key = 'setup_completed' AND value = 'false'
        AND EXISTS (SELECT 1 FROM staff WHERE role = 'admin')
        AND EXISTS (SELECT 1 FROM settings WHERE key = 'institution_name' AND value <> '')`
  );
}

/** Demo institution for testing and presentations. */
async function seedDemo() {
  const setup = require('../services/setup');
  const bcrypt = require('bcryptjs');
  await setup.completeSetup({
    institutionName: 'Demo B Rwanda',
    branchName: 'Kigali Main Branch',
    managerName: 'Branch Manager',
    username: 'admin',
    password: 'admin1234',
    counters: 4,
    defaultLanguage: 'en',
    services: setup.DEFAULT_SERVICES.filter((s) => s.selected).map((s) => s.code),
  });
  for (const [name, username] of [['Aline Uwase', 'teller1'], ['Jean Mugisha', 'teller2']]) {
    await db.query(
      `INSERT INTO staff (full_name, username, password_hash, role) VALUES ($1, $2, $3, 'teller')
       ON CONFLICT (username) DO NOTHING`,
      [name, username, bcrypt.hashSync('teller123', 10)]
    );
  }
}

async function setup({ resetFirst = false, demo = false } = {}) {
  if (resetFirst || demo) await reset();
  await migrate();
  if (demo) await seedDemo();
}

module.exports = { setup, reset, migrate, seedDemo };

if (require.main === module) {
  const demo = process.argv.includes('--demo');
  const resetFirst = process.argv.includes('--reset');
  setup({ resetFirst, demo })
    .then(() => {
      if (demo) {
        console.log('[db] demo institution ready: admin / admin1234, teller1 / teller123, teller2 / teller123');
      } else if (resetFirst) {
        console.log('[db] database reset - open the app to run the first-time setup');
      } else {
        console.log('[db] schema ready');
      }
      return db.pool.end();
    })
    .catch((err) => {
      console.error('[db] setup failed:', err.message);
      process.exit(1);
    });
}

