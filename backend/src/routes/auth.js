const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, requireAuth } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../utils/errors');

const router = express.Router();

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) throw new ApiError(400, 'Enter your username and password');
    const { rows } = await db.query('SELECT * FROM staff WHERE username = $1', [
      String(username).trim().toLowerCase(),
    ]);
    const staff = rows[0];
    if (!staff || !staff.is_active || !bcrypt.compareSync(String(password), staff.password_hash)) {
      throw new ApiError(401, 'Incorrect username or password', { errorCode: 'BAD_LOGIN' });
    }
    res.json({
      token: signToken(staff),
      user: { id: staff.id, fullName: staff.full_name, username: staff.username, role: staff.role },
    });
  })
);

router.get('/me', requireAuth, (req, res) => {
  const s = req.staff;
  res.json({ id: s.id, fullName: s.full_name, username: s.username, role: s.role, counterId: s.counter_id });
});

module.exports = router;

