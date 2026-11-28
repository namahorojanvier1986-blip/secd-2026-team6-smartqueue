const express = require('express');
const queue = require('../services/queue');
const { asyncHandler, ApiError } = require('../utils/errors');

const router = express.Router();

// Services offered + live queue length and estimated wait for a new ticket
router.get(
  '/services',
  asyncHandler(async (_req, res) => {
    res.json(await queue.listServicesWithQueue());
  })
);

// Kiosk: request a queue ticket
router.post(
  '/tickets',
  asyncHandler(async (req, res) => {
    const { phone, serviceId, isPriority, priorityReason, language } = req.body || {};
    if (!serviceId) throw new ApiError(400, 'Choose a service', { errorCode: 'SERVICE_REQUIRED' });
    const ticket = await queue.issueTicket({
      phone,
      serviceId: Number(serviceId),
      isPriority,
      priorityReason,
      language,
    });
    res.status(201).json(ticket);
  })
);

// Find today's ticket by phone number + ticket number
router.get(
  '/tickets/lookup',
  asyncHandler(async (req, res) => {
    res.json(await queue.findTicket(req.query.phone, req.query.number));
  })
);

// Live ticket status: position, estimated wait, counter, notifications
router.get(
  '/tickets/:code',
  asyncHandler(async (req, res) => {
    res.json(await queue.getTicket(req.params.code));
  })
);

// Notifications only (lightweight polling for client apps). ?since=<last id>
router.get(
  '/tickets/:code/notifications',
  asyncHandler(async (req, res) => {
    const ticket = await queue.getTicket(req.params.code);
    const since = parseInt(req.query.since, 10) || 0;
    res.json(ticket.notifications.filter((n) => n.id > since));
  })
);

router.post(
  '/tickets/:code/notifications/read',
  asyncHandler(async (req, res) => {
    res.json({ updated: await queue.markNotificationsRead(req.params.code) });
  })
);

router.post(
  '/tickets/:code/cancel',
  asyncHandler(async (req, res) => {
    res.json(await queue.cancelTicket(req.params.code));
  })
);

// Public display board for the Bing hall screen
router.get(
  '/display',
  asyncHandler(async (_req, res) => {
    res.json(await queue.displayBoard());
  })
);

router.get(
  '/info',
  asyncHandler(async (_req, res) => {
    const s = await queue.getSettings();
    res.json({
      setupRequired: !s.setupCompleted,
      institutionName: s.institutionName,
      branchName: s.branchName,
      defaultLanguage: s.defaultLanguage,
      priorityPolicy: s.priorityPolicy,
    });
  })
);

module.exports = router;

