const express = require('express');
const queue = require('../services/queue');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

const router = express.Router();
router.use(requireAuth); // tellers and admins can both operate a counter

router.get(
  '/state',
  asyncHandler(async (req, res) => {
    res.json(await queue.tellerState(req.staff.id));
  })
);

// Sit at a counter (opens it) or leave it (counterId: null closes it)
router.put(
  '/counter',
  asyncHandler(async (req, res) => {
    const raw = req.body ? req.body.counterId : null;
    await queue.setTellerCounter(req.staff.id, raw === null || raw === undefined ? null : Number(raw));
    res.json(await queue.tellerState(req.staff.id));
  })
);

router.post(
  '/call-next',
  asyncHandler(async (req, res) => {
    const ticket = await queue.callNext(req.staff.id);
    res.json({ ticket, message: ticket ? null : 'No customers waiting for your counter' });
  })
);

for (const action of ['start', 'complete', 'no_show', 'recall']) {
  router.post(
    `/tickets/:id/${action.replace('_', '-')}`,
    asyncHandler(async (req, res) => {
      res.json(await queue.updateTicket(req.staff.id, Number(req.params.id), action));
    })
  );
}

module.exports = router;

