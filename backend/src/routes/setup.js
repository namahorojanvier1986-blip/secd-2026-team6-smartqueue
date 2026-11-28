const express = require('express');
const setup = require('../services/setup');
const { signToken } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../utils/errors');

const router = express.Router();

// Is this a fresh installation? Returns the service catalogue for the wizard.
router.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const complete = await setup.isSetupComplete();
    res.json({
      setupRequired: !complete,
      services: complete ? [] : setup.DEFAULT_SERVICES,
    });
  })
);

// First-run setup: creates the institution, services, counters and the manager account,
// then returns a session so the manager lands directly on the dashboard.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    if (await setup.isSetupComplete()) {
      throw new ApiError(409, 'This system has already been set up. Please sign in.');
    }
    const admin = await setup.completeSetup(req.body || {});
    res.status(201).json({
      token: signToken(admin),
      user: { id: admin.id, fullName: admin.full_name, username: admin.username, role: admin.role },
    });
  })
);

module.exports = router;

