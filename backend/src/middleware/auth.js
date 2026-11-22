const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { ApiError, asyncHandler } = require('../utils/errors');

function signToken(staff) {
  return jwt.sign({ sub: staff.id, role: staff.role }, config.jwtSecret, { expiresIn: '12h' });
}

const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError(401, 'Please sign in');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const { rows } = await db.query(
    'SELECT id, full_name, username, role, counter_id, is_active FROM staff WHERE id = $1',
    [payload.sub]
  );
  if (!rows[0] || !rows[0].is_active) throw new ApiError(401, 'Account not found or disabled');
  req.staff = rows[0];
  next();
});

const requireRole = (...roles) => (req, _res, next) => {
  if (!req.staff || !roles.includes(req.staff.role)) {
    return next(new ApiError(403, 'You do not have permission to do this'));
  }
  next();
};

module.exports = { signToken, requireAuth, requireRole };
