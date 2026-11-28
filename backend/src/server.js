const app = require('./app');
const config = require('./config');
const { setup } = require('./db/migrate');
const { isSetupComplete } = require('./services/setup');
const { checkTwoMinuteAlerts } = require('./services/queue');

async function start() {
  await setup(); // creates or upgrades tables; keeps existing data

  app.listen(config.port, async () => {
    console.log(`[api] Smart Queue API running on http://localhost:${config.port}`);
    if (!(await isSetupComplete())) {
      console.log('[api] First run: open the app in your browser to set up your institution.');
    }
  });

  // Send the "about 2 minutes to your turn" alerts that queue changes alone would not trigger
  setInterval(() => {
    checkTwoMinuteAlerts().catch((err) => console.warn('[api] 2-minute alert check failed:', err.message));
  }, 30000);
}

start().catch((err) => {
  console.error('[api] failed to start:', err.message);
  console.error('      Check that PostgreSQL is running and DATABASE_URL in backend/.env is correct.');
  process.exit(1);
});

