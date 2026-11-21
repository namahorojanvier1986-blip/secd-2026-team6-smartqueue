const { Pool, types } = require('pg');
const config = require('../config');

// Return DATE columns as plain 'YYYY-MM-DD' strings, and counts/averages as numbers.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(20, (v) => parseInt(v, 10));
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));

// Every connection uses Rwanda time, so CURRENT_DATE is the local business day.
const pool = new Pool({
  connectionString: config.databaseUrl,
  options: `-c timezone=${config.timezone}`,
});

pool.on('error', (err) => console.error('[db] idle client error', err.message));

function query(text, params) {
  return pool.query(text, params);
}

/**
 * Runs fn inside a transaction. fn may push callbacks onto client.afterCommit;
 * they run only once the transaction has committed (used for webhooks).
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  client.afterCommit = [];
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    for (const cb of client.afterCommit) {
      try {
        cb();
      } catch (e) {
        console.error('[db] afterCommit error', e.message);
      }
    }
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.afterCommit = [];
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
