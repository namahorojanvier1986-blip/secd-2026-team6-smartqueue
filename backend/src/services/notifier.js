/**
 * API-based notifications (replaces SMS).
 *
 * Every notification is:
 *   1. stored in the `notifications` table, in the customer's language, together
 *      with the values used to write it (`data`) so the ticket page can show it
 *      in English or Kinyarwanda; clients read it via GET /api/tickets/:code;
 *   2. optionally POSTed as JSON to a webhook URL configured by the institution
 *      (Admin > Settings), so a mobile banking app or messaging gateway can push
 *      it to the customer. The webhook fires only after the transaction commits.
 */
const { renderMessage } = require('./messages');

async function postWebhook(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'SmartQueue-Rwanda/1.0' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) console.warn(`[notifier] webhook responded ${res.status}`);
  } catch (err) {
    console.warn(`[notifier] webhook failed: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Creates a notification for a ticket inside the current transaction.
 * @param client  pg client from db.withTransaction
 * @param ticket  ticket row (id, public_code, phone, ticket_number, service_id, counter_id, language, is_priority)
 * @param type    ticket_issued | turn_approaching | two_minutes | called | recalled | completed | no_show | cancelled
 * @param extra   { ahead, eta, soon } where relevant
 */
async function notify(client, ticket, type, extra = {}) {
  const { rows: ctx } = await client.query(
    `SELECT s.name AS service, COALESCE(NULLIF(s.name_rw, ''), s.name) AS service_rw, c.name AS counter,
            (SELECT value FROM settings WHERE key = 'institution_name') AS institution,
            (SELECT value FROM settings WHERE key = 'webhook_url') AS webhook_url
       FROM services s LEFT JOIN counters c ON c.id = $2
      WHERE s.id = $1`,
    [ticket.service_id, ticket.counter_id || null]
  );
  const info = ctx[0] || {};
  const lang = ticket.language === 'rw' ? 'rw' : 'en';

  const data = {
    number: String(ticket.ticket_number).padStart(3, '0'),
    service: info.service,
    serviceRw: info.service_rw,
    counter: info.counter || null,
    institution: info.institution || '',
    priority: Boolean(ticket.is_priority),
    ...extra,
  };
  const { title, message } = renderMessage(lang, type, {
    ...data,
    service: lang === 'rw' ? data.serviceRw : data.service,
  });

  const { rows } = await client.query(
    `INSERT INTO notifications (ticket_id, type, title, message, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, type, title, message, data, created_at, read_at`,
    [ticket.id, type, title, message, data]
  );
  const notification = rows[0];

  const url = (info.webhook_url || '').trim();
  if (url && Array.isArray(client.afterCommit)) {
    client.afterCommit.push(() =>
      postWebhook(url, {
        event: `ticket.${type}`,
        language: lang,
        ticket: { code: ticket.public_code, number: ticket.ticket_number, phone: ticket.phone },
        notification,
      })
    );
  }
  return notification;
}

module.exports = { notify };
