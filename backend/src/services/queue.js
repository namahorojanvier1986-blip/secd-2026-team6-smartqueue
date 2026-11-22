/**
 * Core queue logic: issuing tickets, positions, waiting-time estimates,
 * calling customers and moving tickets through their lifecycle.
 *
 * Ticket lifecycle:
 *   waiting -> called -> serving -> served
 *                 \-> no_show
 *   waiting -> cancelled (by customer)
 *
 * Ordering rule (priority policy): within the tickets a counter can serve,
 * priority tickets (pregnant women, elderly, persons with disabilities) go first,
 * then everyone else in order of their sequential ticket number.
 */
const crypto = require('crypto');
const db = require('../db');
const { notify } = require('./notifier');
const { ApiError } = require('../utils/errors');
const { normalizeRwandaPhone, maskPhone } = require('../utils/phone');

const ACTIVE_STATUSES = ['waiting', 'called', 'serving'];
const PRIORITY_REASONS = ['pregnant', 'elderly', 'disability'];
const LANGUAGES = ['en', 'rw'];

const pad = (n) => String(n).padStart(3, '0');

// Service columns selected wherever a ticket is shown, so the UI can pick a language
const SERVICE_COLS = `s.name AS service_name, COALESCE(NULLIF(s.name_rw, ''), s.name) AS service_name_rw, s.code AS service_code`;

function generatePublicCode() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L confusion
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

async function getSettings(q = db) {
  const { rows } = await q.query('SELECT key, value FROM settings');
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    institutionName: map.institution_name || '',
    branchName: map.branch_name || '',
    defaultLanguage: map.default_language === 'rw' ? 'rw' : 'en',
    setupCompleted: map.setup_completed === 'true',
    approachThreshold: Math.max(1, parseInt(map.approach_threshold, 10) || 3),
    webhookUrl: map.webhook_url || '',
    priorityPolicy: map.priority_policy || '',
  };
}

/** Average minutes per customer for a service: learned from recent data, else configured default. */
async function avgServiceMinutes(q, serviceId) {
  const { rows } = await q.query(
    `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - service_started_at)) / 60.0) AS avg, COUNT(*) AS n
       FROM (SELECT completed_at, service_started_at FROM tickets
              WHERE service_id = $1 AND status = 'served'
                AND service_started_at IS NOT NULL AND completed_at IS NOT NULL
                AND completed_at > now() - interval '7 days'
              ORDER BY completed_at DESC LIMIT 30) recent`,
    [serviceId]
  );
  const svc = await q.query('SELECT avg_service_minutes FROM services WHERE id = $1', [serviceId]);
  const configured = svc.rows[0] ? svc.rows[0].avg_service_minutes : 5;
  if (rows[0].n >= 3 && rows[0].avg) return Math.min(60, Math.max(1, rows[0].avg));
  return configured;
}

async function openCountersFor(q, serviceId) {
  const { rows } = await q.query(
    `SELECT COUNT(*) AS n FROM counters c
       JOIN counter_services cs ON cs.counter_id = c.id
      WHERE cs.service_id = $1 AND c.is_open`,
    [serviceId]
  );
  return rows[0].n;
}

function estimateMinutes(ahead, avgMinutes, openCounters) {
  if (ahead <= 0) return 0;
  return Math.ceil((ahead * avgMinutes) / Math.max(1, openCounters));
}

/** Number of waiting tickets that will be served before this one in its service queue. */
async function customersAhead(q, ticket) {
  const { rows } = await q.query(
    `SELECT COUNT(*) AS ahead FROM tickets
      WHERE queue_date = $1 AND service_id = $2 AND status = 'waiting' AND id <> $5
        AND ((is_priority AND NOT $3::boolean)
             OR (is_priority = $3::boolean AND ticket_number < $4))`,
    [ticket.queue_date, ticket.service_id, ticket.is_priority, ticket.ticket_number, ticket.id]
  );
  return rows[0].ahead;
}

/* ------------------------------------------------------------------ */
/* Public views                                                        */
/* ------------------------------------------------------------------ */

async function loadTicketByCode(q, code) {
  const { rows } = await q.query(
    `SELECT t.*, ${SERVICE_COLS}, c.name AS counter_name
       FROM tickets t
       JOIN services s ON s.id = t.service_id
       LEFT JOIN counters c ON c.id = t.counter_id
      WHERE t.public_code = $1`,
    [String(code || '').toUpperCase()]
  );
  return rows[0] || null;
}

async function ticketView(q, t) {
  let ahead = null;
  let estimatedWaitMinutes = null;
  let openCounters = null;
  if (t.status === 'waiting') {
    ahead = await customersAhead(q, t);
    openCounters = await openCountersFor(q, t.service_id);
    estimatedWaitMinutes = estimateMinutes(ahead, await avgServiceMinutes(q, t.service_id), openCounters);
  }
  const notifications = await q.query(
    `SELECT id, type, title, message, data, created_at, read_at
       FROM notifications WHERE ticket_id = $1 ORDER BY id DESC`,
    [t.id]
  );
  return {
    code: t.public_code,
    number: t.ticket_number,
    displayNumber: pad(t.ticket_number),
    queueDate: t.queue_date,
    phone: maskPhone(t.phone),
    language: t.language,
    service: { id: t.service_id, name: t.service_name, nameRw: t.service_name_rw, code: t.service_code },
    isPriority: t.is_priority,
    priorityReason: t.priority_reason,
    status: t.status,
    counter: t.counter_name || null,
    customersAhead: ahead,
    estimatedWaitMinutes,
    openCounters,
    estimatedServiceTime:
      estimatedWaitMinutes === null ? null : new Date(Date.now() + estimatedWaitMinutes * 60000).toISOString(),
    createdAt: t.created_at,
    calledAt: t.called_at,
    completedAt: t.completed_at,
    notifications: notifications.rows,
    unreadCount: notifications.rows.filter((n) => !n.read_at).length,
  };
}

async function getTicket(code) {
  const t = await loadTicketByCode(db, code);
  if (!t) throw new ApiError(404, 'Ticket not found. Please check your ticket code.', { errorCode: 'TICKET_NOT_FOUND' });
  return ticketView(db, t);
}

/** Find today's ticket from phone number + ticket number (for customers who lost their link). */
async function findTicket(phone, number) {
  const normalized = normalizeRwandaPhone(phone);
  const n = parseInt(number, 10);
  if (!normalized || !n) {
    throw new ApiError(400, 'Enter your phone number and ticket number', { errorCode: 'LOOKUP_REQUIRED' });
  }
  const { rows } = await db.query(
    `SELECT public_code FROM tickets
      WHERE phone = $1 AND ticket_number = $2 AND queue_date = CURRENT_DATE`,
    [normalized, n]
  );
  if (!rows[0]) {
    throw new ApiError(404, 'No ticket found today for that phone and number', { errorCode: 'LOOKUP_NOT_FOUND' });
  }
  return getTicket(rows[0].public_code);
}

async function listServicesWithQueue() {
  const { rows } = await db.query(
    `SELECT s.id, s.code, s.name, COALESCE(NULLIF(s.name_rw, ''), s.name) AS name_rw,
            s.description, COALESCE(NULLIF(s.description_rw, ''), s.description) AS description_rw,
            COUNT(t.id) FILTER (WHERE t.status = 'waiting') AS waiting
       FROM services s
       LEFT JOIN tickets t ON t.service_id = s.id AND t.queue_date = CURRENT_DATE
      WHERE s.is_active
      GROUP BY s.id ORDER BY s.id`
  );
  const result = [];
  for (const s of rows) {
    const open = await openCountersFor(db, s.id);
    const avg = await avgServiceMinutes(db, s.id);
    result.push({
      id: s.id,
      code: s.code,
      name: s.name,
      nameRw: s.name_rw,
      description: s.description,
      descriptionRw: s.description_rw,
      waiting: s.waiting,
      openCounters: open,
      estimatedWaitMinutes: estimateMinutes(s.waiting, avg, open),
    });
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* Issuing tickets                                                     */
/* ------------------------------------------------------------------ */

async function issueTicket({ phone, serviceId, isPriority, priorityReason, language }) {
  const normalized = normalizeRwandaPhone(phone);
  if (!normalized) {
    throw new ApiError(400, 'Enter a valid Rwandan mobile number, e.g. 078 123 4567', { errorCode: 'INVALID_PHONE' });
  }
  const priority = Boolean(isPriority);
  if (priority && !PRIORITY_REASONS.includes(priorityReason)) {
    throw new ApiError(400, 'Choose the reason for priority service', { errorCode: 'PRIORITY_REASON' });
  }

  try {
    return await db.withTransaction(async (c) => {
      const svc = await c.query('SELECT * FROM services WHERE id = $1 AND is_active', [serviceId]);
      if (!svc.rows[0]) throw new ApiError(404, 'Service not available', { errorCode: 'SERVICE_UNAVAILABLE' });
      const service = svc.rows[0];
      const settings = await getSettings(c);
      const lang = LANGUAGES.includes(language) ? language : settings.defaultLanguage;

      const existing = await c.query(
        `SELECT public_code, ticket_number FROM tickets
          WHERE phone = $1 AND queue_date = CURRENT_DATE AND status = ANY($2)`,
        [normalized, ACTIVE_STATUSES]
      );
      if (existing.rows[0]) {
        throw new ApiError(409, 'This phone number already has an active ticket today.', {
          errorCode: 'ACTIVE_TICKET',
          code: existing.rows[0].public_code,
          displayNumber: pad(existing.rows[0].ticket_number),
        });
      }

      // Gap-free sequential number for today (row lock serialises concurrent kiosks).
      const seq = await c.query(
        `INSERT INTO daily_sequences (queue_date, last_number) VALUES (CURRENT_DATE, 1)
         ON CONFLICT (queue_date) DO UPDATE SET last_number = daily_sequences.last_number + 1
         RETURNING last_number`
      );
      const number = seq.rows[0].last_number;

      const ins = await c.query(
        `INSERT INTO tickets (public_code, ticket_number, phone, service_id, is_priority, priority_reason, language)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [generatePublicCode(), number, normalized, service.id, priority, priority ? priorityReason : null, lang]
      );
      const ticket = ins.rows[0];

      const ahead = await customersAhead(c, ticket);
      const open = await openCountersFor(c, service.id);
      const eta = estimateMinutes(ahead, await avgServiceMinutes(c, service.id), open);
      const soon = ahead < settings.approachThreshold;

      // If the wait is already 2 minutes or less, the ticket message covers it: no separate 2-minute alert
      await c.query(
        'UPDATE tickets SET estimated_wait_minutes = $1, approaching_notified = $2, two_min_notified = $3 WHERE id = $4',
        [eta, soon, eta <= TWO_MINUTES, ticket.id]
      );
      await notify(c, ticket, 'ticket_issued', { ahead, eta, soon });

      const full = await loadTicketByCode(c, ticket.public_code);
      return ticketView(c, full);
    });
  } catch (err) {
    // Two kiosks submitting the same phone at the same moment
    if (err.code === '23505' && String(err.constraint).includes('uniq_active_ticket_per_phone')) {
      throw new ApiError(409, 'This phone number already has an active ticket today.', { errorCode: 'ACTIVE_TICKET' });
    }
    throw err;
  }
}

/** Notify waiting customers who have moved within the "approaching" threshold. */
async function notifyApproaching(c, serviceId) {
  const settings = await getSettings(c);
  const { rows } = await c.query(
    `SELECT * FROM (
        SELECT t.*, ROW_NUMBER() OVER (ORDER BY is_priority DESC, ticket_number ASC) - 1 AS ahead
          FROM tickets t
         WHERE queue_date = CURRENT_DATE AND service_id = $1 AND status = 'waiting'
     ) q
     WHERE ahead < $2 AND NOT approaching_notified`,
    [serviceId, settings.approachThreshold]
  );
  if (rows.length) {
    const avg = await avgServiceMinutes(c, serviceId);
    const open = await openCountersFor(c, serviceId);
    for (const t of rows) {
      await notify(c, t, 'turn_approaching', { ahead: t.ahead, eta: estimateMinutes(t.ahead, avg, open) });
      await c.query('UPDATE tickets SET approaching_notified = TRUE WHERE id = $1', [t.id]);
    }
  }
  await notifyTwoMinutes(c, serviceId);
}

/** Minutes before the estimated turn when the customer gets the "about 2 minutes" alert. */
const TWO_MINUTES = 2;

/**
 * Alert each waiting customer once, when their estimated wait drops to 2 minutes or less.
 * Only counts while at least one counter for the service is open (otherwise there is no real ETA).
 */
async function notifyTwoMinutes(c, serviceId) {
  const open = await openCountersFor(c, serviceId);
  if (Number(open) === 0) return;
  const avg = await avgServiceMinutes(c, serviceId);
  const { rows } = await c.query(
    `SELECT * FROM (
        SELECT t.*, ROW_NUMBER() OVER (ORDER BY is_priority DESC, ticket_number ASC) - 1 AS ahead
          FROM tickets t
         WHERE queue_date = CURRENT_DATE AND service_id = $1 AND status = 'waiting'
     ) q
     WHERE NOT two_min_notified`,
    [serviceId]
  );
  for (const t of rows) {
    const ahead = Number(t.ahead);
    const eta = estimateMinutes(ahead, avg, open);
    if (eta > TWO_MINUTES) continue;
    await notify(c, t, 'two_minutes', { ahead, eta });
    await c.query('UPDATE tickets SET two_min_notified = TRUE WHERE id = $1', [t.id]);
  }
}

/** Background check (every 30 s from server.js): catches changes such as a counter opening. */
async function checkTwoMinuteAlerts() {
  const { rows } = await db.query(
    `SELECT DISTINCT service_id FROM tickets
      WHERE queue_date = CURRENT_DATE AND status = 'waiting' AND NOT two_min_notified`
  );
  for (const r of rows) {
    await db.withTransaction((c) => notifyTwoMinutes(c, r.service_id));
  }
}

async function cancelTicket(code) {
  return db.withTransaction(async (c) => {
    const { rows } = await c.query('SELECT * FROM tickets WHERE public_code = $1 FOR UPDATE', [
      String(code).toUpperCase(),
    ]);
    const t = rows[0];
    if (!t) throw new ApiError(404, 'Ticket not found', { errorCode: 'TICKET_NOT_FOUND' });
    if (t.status !== 'waiting') {
      throw new ApiError(409, 'Only a waiting ticket can be cancelled', { errorCode: 'CANCEL_NOT_WAITING' });
    }
    await c.query("UPDATE tickets SET status = 'cancelled', completed_at = now() WHERE id = $1", [t.id]);
    await notify(c, t, 'cancelled');
    await notifyApproaching(c, t.service_id);
    return ticketView(c, await loadTicketByCode(c, t.public_code));
  });
}

async function markNotificationsRead(code) {
  const { rowCount } = await db.query(
    `UPDATE notifications SET read_at = now()
      WHERE read_at IS NULL AND ticket_id = (SELECT id FROM tickets WHERE public_code = $1)`,
    [String(code).toUpperCase()]
  );
  return rowCount;
}

/* ------------------------------------------------------------------ */
/* Teller operations                                                   */
/* ------------------------------------------------------------------ */

async function setTellerCounter(staffId, counterId) {
  return db.withTransaction(async (c) => {
    const me = (await c.query('SELECT * FROM staff WHERE id = $1 FOR UPDATE', [staffId])).rows[0];

    if (me.counter_id && me.counter_id !== counterId) {
      const busy = await c.query(
        "SELECT 1 FROM tickets WHERE counter_id = $1 AND status IN ('called','serving')",
        [me.counter_id]
      );
      if (busy.rows[0]) throw new ApiError(409, 'Finish your current customer before leaving this counter');
      await c.query('UPDATE counters SET is_open = FALSE WHERE id = $1', [me.counter_id]);
    }

    if (counterId === null) {
      await c.query('UPDATE staff SET counter_id = NULL WHERE id = $1', [staffId]);
      return;
    }

    const counter = (await c.query('SELECT * FROM counters WHERE id = $1 FOR UPDATE', [counterId])).rows[0];
    if (!counter) throw new ApiError(404, 'Counter not found');
    const other = await c.query('SELECT full_name FROM staff WHERE counter_id = $1 AND id <> $2', [
      counterId,
      staffId,
    ]);
    if (other.rows[0]) {
      throw new ApiError(409, `${counter.name} is already in use by ${other.rows[0].full_name}`);
    }
    await c.query('UPDATE staff SET counter_id = $1 WHERE id = $2', [counterId, staffId]);
    await c.query('UPDATE counters SET is_open = TRUE WHERE id = $1', [counterId]);
  });
}

async function tellerState(staffId) {
  const me = (
    await db.query(
      `SELECT s.id, s.full_name, s.role, s.counter_id, c.name AS counter_name, c.is_open
         FROM staff s LEFT JOIN counters c ON c.id = s.counter_id WHERE s.id = $1`,
      [staffId]
    )
  ).rows[0];

  const counters = (
    await db.query(
      `SELECT c.id, c.name, c.is_open, st.full_name AS staffed_by,
              COALESCE(json_agg(json_build_object('id', s.id, 'name', s.name,
                         'nameRw', COALESCE(NULLIF(s.name_rw, ''), s.name), 'code', s.code)
                       ORDER BY s.id) FILTER (WHERE s.id IS NOT NULL), '[]') AS services
         FROM counters c
         LEFT JOIN counter_services cs ON cs.counter_id = c.id
         LEFT JOIN services s ON s.id = cs.service_id
         LEFT JOIN staff st ON st.counter_id = c.id
        GROUP BY c.id, st.full_name ORDER BY c.id`
    )
  ).rows;

  let current = null;
  let queue = [];
  if (me.counter_id) {
    const cur = await db.query(
      `SELECT t.*, ${SERVICE_COLS}
         FROM tickets t JOIN services s ON s.id = t.service_id
        WHERE t.counter_id = $1 AND t.status IN ('called','serving')
        ORDER BY t.called_at DESC LIMIT 1`,
      [me.counter_id]
    );
    if (cur.rows[0]) current = tellerTicket(cur.rows[0]);

    const q = await db.query(
      `SELECT t.*, ${SERVICE_COLS}
         FROM tickets t JOIN services s ON s.id = t.service_id
        WHERE t.queue_date = CURRENT_DATE AND t.status = 'waiting'
          AND t.service_id IN (SELECT service_id FROM counter_services WHERE counter_id = $1)
        ORDER BY t.is_priority DESC, t.ticket_number ASC LIMIT 50`,
      [me.counter_id]
    );
    queue = q.rows.map(tellerTicket);
  }

  const stats = (
    await db.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'served') AS served,
              COUNT(*) FILTER (WHERE status = 'no_show') AS no_show,
              ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - service_started_at)) / 60.0)
                    FILTER (WHERE status = 'served')::numeric, 1) AS avg_service_minutes
         FROM tickets WHERE served_by = $1 AND queue_date = CURRENT_DATE`,
      [staffId]
    )
  ).rows[0];

  return { me, counters, current, queue, stats };
}

function tellerTicket(t) {
  return {
    id: t.id,
    code: t.public_code,
    displayNumber: pad(t.ticket_number),
    number: t.ticket_number,
    phone: maskPhone(t.phone),
    language: t.language,
    service: { name: t.service_name, nameRw: t.service_name_rw, code: t.service_code },
    isPriority: t.is_priority,
    priorityReason: t.priority_reason,
    status: t.status,
    createdAt: t.created_at,
    calledAt: t.called_at,
    serviceStartedAt: t.service_started_at,
    recallCount: t.recall_count,
  };
}

async function loadTellerTicket(c, id) {
  const { rows } = await c.query(
    `SELECT t.*, ${SERVICE_COLS} FROM tickets t JOIN services s ON s.id = t.service_id WHERE t.id = $1`,
    [id]
  );
  return tellerTicket(rows[0]);
}

async function callNext(staffId) {
  return db.withTransaction(async (c) => {
    const me = (await c.query('SELECT * FROM staff WHERE id = $1', [staffId])).rows[0];
    if (!me.counter_id) throw new ApiError(400, 'Select your counter first');
    const counter = (await c.query('SELECT * FROM counters WHERE id = $1 FOR UPDATE', [me.counter_id])).rows[0];
    if (!counter.is_open) throw new ApiError(400, 'Open your counter first');

    const busy = await c.query(
      "SELECT 1 FROM tickets WHERE counter_id = $1 AND status IN ('called','serving')",
      [counter.id]
    );
    if (busy.rows[0]) {
      throw new ApiError(409, 'Complete or mark the current customer before calling the next one');
    }

    const next = await c.query(
      `SELECT * FROM tickets
        WHERE queue_date = CURRENT_DATE AND status = 'waiting'
          AND service_id IN (SELECT service_id FROM counter_services WHERE counter_id = $1)
        ORDER BY is_priority DESC, ticket_number ASC
        LIMIT 1 FOR UPDATE SKIP LOCKED`,
      [counter.id]
    );
    const t = next.rows[0];
    if (!t) return null;

    await c.query(
      `UPDATE tickets SET status = 'called', counter_id = $1, served_by = $2, called_at = now()
        WHERE id = $3`,
      [counter.id, staffId, t.id]
    );
    await notify(c, { ...t, counter_id: counter.id }, 'called');
    await notifyApproaching(c, t.service_id);
    return loadTellerTicket(c, t.id);
  });
}

const TRANSITIONS = {
  start: { from: ['called'] },
  complete: { from: ['called', 'serving'] },
  no_show: { from: ['called'] },
  recall: { from: ['called'] },
};

async function updateTicket(staffId, ticketId, action) {
  if (!TRANSITIONS[action]) throw new ApiError(400, 'Unknown action');
  return db.withTransaction(async (c) => {
    const me = (await c.query('SELECT * FROM staff WHERE id = $1', [staffId])).rows[0];
    const t = (await c.query('SELECT * FROM tickets WHERE id = $1 FOR UPDATE', [ticketId])).rows[0];
    if (!t) throw new ApiError(404, 'Ticket not found');
    if (t.counter_id !== me.counter_id) throw new ApiError(403, 'This ticket belongs to another counter');
    if (!TRANSITIONS[action].from.includes(t.status)) {
      throw new ApiError(409, `Cannot ${action.replace('_', ' ')} a ticket that is ${t.status}`);
    }

    if (action === 'start') {
      await c.query("UPDATE tickets SET status = 'serving', service_started_at = now() WHERE id = $1", [t.id]);
    } else if (action === 'complete') {
      await c.query(
        `UPDATE tickets SET status = 'served', completed_at = now(),
                service_started_at = COALESCE(service_started_at, called_at) WHERE id = $1`,
        [t.id]
      );
      await notify(c, t, 'completed');
    } else if (action === 'no_show') {
      await c.query("UPDATE tickets SET status = 'no_show', completed_at = now() WHERE id = $1", [t.id]);
      await notify(c, t, 'no_show');
    } else if (action === 'recall') {
      await c.query('UPDATE tickets SET recall_count = recall_count + 1 WHERE id = $1', [t.id]);
      await notify(c, t, 'recalled');
    }
    return loadTellerTicket(c, t.id);
  });
}

/* ------------------------------------------------------------------ */
/* Display board                                                       */
/* ------------------------------------------------------------------ */

async function displayBoard() {
  const settings = await getSettings();
  const nowServing = await db.query(
    `SELECT t.ticket_number, t.status, t.is_priority, t.called_at, c.name AS counter, ${SERVICE_COLS}
       FROM tickets t
       JOIN counters c ON c.id = t.counter_id
       JOIN services s ON s.id = t.service_id
      WHERE t.queue_date = CURRENT_DATE AND t.status IN ('called','serving')
      ORDER BY t.called_at DESC LIMIT 8`
  );
  const upNext = await db.query(
    `SELECT t.ticket_number, t.is_priority, ${SERVICE_COLS}
       FROM tickets t JOIN services s ON s.id = t.service_id
      WHERE t.queue_date = CURRENT_DATE AND t.status = 'waiting'
      ORDER BY t.is_priority DESC, t.ticket_number ASC LIMIT 10`
  );
  const svc = (r) => ({ name: r.service_name, nameRw: r.service_name_rw, code: r.service_code });
  return {
    institutionName: settings.institutionName,
    branchName: settings.branchName,
    serverTime: new Date().toISOString(),
    nowServing: nowServing.rows.map((r) => ({
      displayNumber: pad(r.ticket_number),
      status: r.status,
      isPriority: r.is_priority,
      counter: r.counter,
      service: svc(r),
      calledAt: r.called_at,
    })),
    upNext: upNext.rows.map((r) => ({
      displayNumber: pad(r.ticket_number),
      isPriority: r.is_priority,
      service: svc(r),
    })),
    services: await listServicesWithQueue(),
  };
}

module.exports = {
  checkTwoMinuteAlerts,
  PRIORITY_REASONS,
  getSettings,
  issueTicket,
  getTicket,
  findTicket,
  cancelTicket,
  markNotificationsRead,
  listServicesWithQueue,
  setTellerCounter,
  tellerState,
  callNext,
  updateTicket,
  displayBoard,
};
