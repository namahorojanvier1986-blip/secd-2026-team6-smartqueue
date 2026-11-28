const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const db = require('./db');
const { errorMiddleware } = require('./utils/errors');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',') }));
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'error', database: 'unreachable' });
  }
});

app.use('/api/setup', require('./routes/setup'));

// Until the first-run setup is done, only /health, /info and /setup work.
const { isSetupComplete } = require('./services/setup');
app.use('/api', async (req, res, next) => {
  if (req.path === '/info' || req.path === '/health') return next();
  try {
    if (await isSetupComplete()) return next();
    res.status(503).json({ error: 'The system has not been set up yet.', errorCode: 'SETUP_REQUIRED', setupRequired: true });
  } catch (err) {
    next(err);
  }
});

app.use('/api', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/teller', require('./routes/teller'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found' }));

// In production the built React app (frontend/dist) can be served by this same server.
const dist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use(errorMiddleware);

module.exports = app;

