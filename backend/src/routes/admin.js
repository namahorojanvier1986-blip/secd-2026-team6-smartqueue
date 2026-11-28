const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../utils/errors');
const { maskPhone } = require('../utils/phone');

const router = express.Router();
router.use(requireAuth, requireRole('admin'));

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const dateParam = (req) => (isDate(req.query.date) ? req.query.date : null);

/* ---------------- Reports ---------------- */

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const date = dateParam(req);
    const d = date ? '$1::date' : 'CURRENT_DATE';
    const params = date ? [date] : [];

    const totals = (
      await db.query(
        `SELECT COUNT(*) AS total,
                COUNT(*) FILTER (WHERE status = 'waiting') AS waiting,
                COUNT(*) FILTER (WHERE status IN ('called','serving')) AS in_service,
                COUNT(*) FILTER (WHERE status = 'served') AS served,
                COUNT(*) FILTER (WHERE status = 'no_show') AS no_show,
                COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
                COUNT(*) FILTER (WHERE is_priority) AS priority,
                ROUND(AVG(EXTRACT(EPOCH FROM (called_at - created_at)) / 60.0)::numeric, 1) AS avg_wait_minutes,
                ROUND(MAX(EXTRACT(EPOCH FROM (called_at - created_at)) / 60.0)::numeric, 1) AS max_wait_minutes,
                ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - service_started_at)) / 60.0)
                      FILTER (WHERE status = 'served')::numeric, 1) AS avg_service_minutes
           FROM tickets WHERE queue_date = ${d}`,
        params
      )
    ).rows[0];

    const byService = (
      await db.query(
        `SELECT s.id, s.name, COALESCE(NULLIF(s.name_rw, ''), s.name) AS name_rw, s.code,
                COUNT(t.id) AS total,
                COUNT(t.id) FILTER (WHERE t.status = 'waiting') AS waiting,
                COUNT(t.id) FILTER (WHERE t.status = 'served') AS served,
                ROUND(AVG(EXTRACT(EPOCH FROM (t.called_at - t.created_at)) / 60.0)::numeric, 1) AS avg_wait_minutes
           FROM services s
           LEFT JOIN tickets t ON t.service_id = s.id AND t.queue_date = ${d}
          GROUP BY s.id ORDER BY s.id`,
        params
      )
    ).rows;

    const byHour = (
      await db.query(
        `SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*) AS tickets
           FROM tickets WHERE queue_date = ${d} GROUP BY 1 ORDER BY 1`,
        params
      )
    ).rows;

    const byCounter = (
      await db.query(
        `SELECT c.id, c.name, c.is_open,
                COUNT(t.id) FILTER (WHERE t.status = 'served') AS served,
                ROUND(AVG(EXTRACT(EPOCH FROM (t.completed_at - t.service_started_at)) / 60.0)
                      FILTER (WHERE t.status = 'served')::numeric, 1) AS avg_service_minutes
           FROM counters c
           LEFT JOIN tickets t ON t.counter_id = c.id AND t.queue_date = ${d}
          GROUP BY c.id ORDER BY c.id`,
        params
      )
    ).rows;

    const byPriority = (
      await db.query(
        `SELECT priority_reason AS reason, COUNT(*) AS tickets
           FROM tickets WHERE queue_date = ${d} AND is_priority GROUP BY 1`,
        params
      )
    ).rows;

    const notificationsSent = (
      await db.query(
        `SELECT COUNT(*) AS n FROM notifications n JOIN tickets t ON t.id = n.ticket_id
          WHERE t.queue_date = ${d}`,
        params
      )
    ).rows[0].n;

    const day = (await db.query(`SELECT ${d} AS day`, params)).rows[0].day;
    res.json({ date: day, totals, byService, byHour, byCounter, byPriority, notificationsSent });
  })
);

router.get(
  '/tickets',
  asyncHandler(async (req, res) => {
    const date = dateParam(req);
    const params = [date];
    let where = 't.queue_date = COALESCE($1::date, CURRENT_DATE)';
    if (req.query.status) {
      params.push(String(req.query.status));
      where += ` AND t.status = $${params.length}`;
    }
    const { rows } = await db.query(
      `SELECT t.id, t.public_code, t.ticket_number, t.phone, t.status, t.is_priority, t.priority_reason,
              t.created_at, t.called_at, t.completed_at, t.language,
              s.name AS service, COALESCE(NULLIF(s.name_rw, ''), s.name) AS service_rw, c.name AS counter,
              st.full_name AS served_by
         FROM tickets t
         JOIN services s ON s.id = t.service_id
         LEFT JOIN counters c ON c.id = t.counter_id
         LEFT JOIN staff st ON st.id = t.served_by
        WHERE ${where}
        ORDER BY t.ticket_number DESC LIMIT 500`,
      params
    );
    res.json(
      rows.map((r) => ({
        ...r,
        phone: maskPhone(r.phone),
        display_number: String(r.ticket_number).padStart(3, '0'),
      }))
    );
  })
);

/* ---------------- Services ---------------- */

function validateService(b) {
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  const mins = parseInt(b.avgServiceMinutes, 10);
  if (!/^[A-Z]{1,4}$/.test(code)) throw new ApiError(400, 'Code must be 1-4 letters');
  if (name.length < 2) throw new ApiError(400, 'Enter a service name');
  if (!(mins >= 1 && mins <= 120)) throw new ApiError(400, 'Average service time must be 1-120 minutes');
  return {
    code,
    name,
    nameRw: String(b.nameRw || '').trim(),
    description: String(b.description || '').trim(),
    descriptionRw: String(b.descriptionRw || '').trim(),
    mins,
    active: b.isActive !== false,
  };
}

router.get(
  '/services',
  asyncHandler(async (_req, res) => {
    res.json((await db.query('SELECT * FROM services ORDER BY id')).rows);
  })
);

router.post(
  '/services',
  asyncHandler(async (req, res) => {
    const v = validateService(req.body || {});
    try {
      const { rows } = await db.query(
        `INSERT INTO services (code, name, name_rw, description, description_rw, avg_service_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [v.code, v.name, v.nameRw, v.description, v.descriptionRw, v.mins, v.active]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') throw new ApiError(409, 'A service with that code already exists');
      throw e;
    }
  })
);

router.put(
  '/services/:id',
  asyncHandler(async (req, res) => {
    const v = validateService(req.body || {});
    try {
      const { rows } = await db.query(
        `UPDATE services SET code = $1, name = $2, name_rw = $3, description = $4, description_rw = $5,
                avg_service_minutes = $6, is_active = $7
          WHERE id = $8 RETURNING *`,
        [v.code, v.name, v.nameRw, v.description, v.descriptionRw, v.mins, v.active, Number(req.params.id)]
      );
      if (!rows[0]) throw new ApiError(404, 'Service not found');
      res.json(rows[0]);
    } catch (e) {
      if (e.code === '23505') throw new ApiError(409, 'A service with that code already exists');
      throw e;
    }
  })
);

/* ---------------- Counters ---------------- */

router.get(
  '/counters',
  asyncHandler(async (_req, res) => {
    const { rows } = await db.query(
      `SELECT c.*, st.full_name AS staffed_by,
              COALESCE(array_agg(cs.service_id ORDER BY cs.service_id) FILTER (WHERE cs.service_id IS NOT NULL), '{}') AS service_ids
         FROM counters c
         LEFT JOIN counter_services cs ON cs.counter_id = c.id
         LEFT JOIN staff st ON st.counter_id = c.id
        GROUP BY c.id, st.full_name ORDER BY c.id`
    );
    res.json(rows);
  })
);

async function saveCounter(c, id, body) {
  const name = String(body.name || '').trim();
  if (name.length < 2) throw new ApiError(400, 'Enter a counter name');
  const serviceIds = Array.isArray(body.serviceIds) ? body.serviceIds.map(Number).filter(Boolean) : [];
  if (!serviceIds.length) throw new ApiError(400, 'Choose at least one service for this counter');
  let counterId = id;
  try {
    if (id) {
      const r = await c.query('UPDATE counters SET name = $1 WHERE id = $2 RETURNING id', [name, id]);
      if (!r.rows[0]) throw new ApiError(404, 'Counter not found');
    } else {
      counterId = (await c.query('INSERT INTO counters (name) VALUES ($1) RETURNING id', [name])).rows[0].id;
    }
  } catch (e) {
    if (e.code === '23505') throw new ApiError(409, 'A counter with that name already exists');
    throw e;
  }
  await c.query('DELETE FROM counter_services WHERE counter_id = $1', [counterId]);
  for (const sid of serviceIds) {
    await c.query('INSERT INTO counter_services (counter_id, service_id) VALUES ($1, $2)', [counterId, sid]);
  }
  return counterId;
}

router.post(
  '/counters',
  asyncHandler(async (req, res) => {
    const id = await db.withTransaction((c) => saveCounter(c, null, req.body || {}));
    res.status(201).json({ id });
  })
);

router.put(
  '/counters/:id',
  asyncHandler(async (req, res) => {
    const id = await db.withTransaction((c) => saveCounter(c, Number(req.params.id), req.body || {}));
    res.json({ id });
  })
);

/* ---------------- Staff ---------------- */

router.get(
  '/staff',
  asyncHandler(async (_req, res) => {
    const { rows } = await db.query(
      `SELECT s.id, s.full_name, s.username, s.role, s.is_active, s.created_at, c.name AS counter
         FROM staff s LEFT JOIN counters c ON c.id = s.counter_id ORDER BY s.id`
    );
    res.json(rows);
  })
);

router.post(
  '/staff',
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const fullName = String(b.fullName || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const role = b.role === 'admin' ? 'admin' : 'teller';
    if (fullName.length < 2) throw new ApiError(400, 'Enter the full name');
    if (!/^[a-z0-9._-]{3,50}$/.test(username)) throw new ApiError(400, 'Username: 3-50 letters, numbers, . _ -');
    if (String(b.password || '').length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    try {
      const { rows } = await db.query(
        `INSERT INTO staff (full_name, username, password_hash, role) VALUES ($1, $2, $3, $4)
         RETURNING id, full_name, username, role, is_active`,
        [fullName, username, bcrypt.hashSync(String(b.password), 10), role]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') throw new ApiError(409, 'That username is already taken');
      throw e;
    }
  })
);

router.put(
  '/staff/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const b = req.body || {};
    if (id === req.staff.id && b.isActive === false) throw new ApiError(400, 'You cannot disable your own account');
    const sets = [];
    const params = [];
    if (b.fullName !== undefined) {
      params.push(String(b.fullName).trim());
      sets.push(`full_name = $${params.length}`);
    }
    if (b.role !== undefined) {
      if (id === req.staff.id && b.role !== 'admin') throw new ApiError(400, 'You cannot remove your own admin role');
      params.push(b.role === 'admin' ? 'admin' : 'teller');
      sets.push(`role = $${params.length}`);
    }
    if (b.isActive !== undefined) {
      params.push(Boolean(b.isActive));
      sets.push(`is_active = $${params.length}`);
      if (!b.isActive) sets.push('counter_id = NULL');
    }
    if (b.password) {
      if (String(b.password).length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
      params.push(bcrypt.hashSync(String(b.password), 10));
      sets.push(`password_hash = $${params.length}`);
    }
    if (!sets.length) throw new ApiError(400, 'Nothing to update');
    params.push(id);
    const { rows } = await db.query(
      `UPDATE staff SET ${sets.join(', ')} WHERE id = $${params.length}
       RETURNING id, full_name, username, role, is_active`,
      params
    );
    if (!rows[0]) throw new ApiError(404, 'Staff member not found');
    res.json(rows[0]);
  })
);

/* ---------------- Settings ---------------- */

const EDITABLE_SETTINGS = [
  'institution_name',
  'branch_name',
  'default_language',
  'approach_threshold',
  'webhook_url',
  'priority_policy',
];

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    const { rows } = await db.query('SELECT key, value FROM settings');
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  })
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    if (b.approach_threshold !== undefined) {
      const n = parseInt(b.approach_threshold, 10);
      if (!(n >= 1 && n <= 20)) throw new ApiError(400, 'Approaching alert must be between 1 and 20 customers');
      b.approach_threshold = String(n);
    }
    if (b.institution_name !== undefined && String(b.institution_name).trim().length < 2) {
      throw new ApiError(400, 'Enter the name of your institution');
    }
    if (b.default_language !== undefined && !['en', 'rw'].includes(b.default_language)) {
      throw new ApiError(400, 'Default language must be en or rw');
    }
    if (b.webhook_url && !/^https?:\/\/\S+$/.test(b.webhook_url)) {
      throw new ApiError(400, 'Webhook URL must start with http:// or https://');
    }
    for (const key of EDITABLE_SETTINGS) {
      if (b[key] !== undefined) {
        await db.query(
          `INSERT INTO settings (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, String(b[key]).trim()]
        );
      }
    }
    const { rows } = await db.query('SELECT key, value FROM settings');
    res.json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
  })
);

module.exports = router;

