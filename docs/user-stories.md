# User stories - Smart Queue Management System

Each story is built as a **vertical slice**: React UI → Express API → PostgreSQL. Each one works end to end on its own.

## Definition of Done
- Meets its acceptance criteria (automated tests in `backend/tests/api.test.js` where marked ✅)
- Merged to `main` through a reviewed pull request
- Works on the deployed version
- Jira card moved to Done

## Core journeys (Milestone 4 minimum: 2 working end to end)

| ID | Story | UI | API | DB |
|---|---|---|---|---|
| **US-01** | As a customer, I want to **request a queue ticket with my phone number** so that I get my place in line. | `/kiosk` | `POST /api/tickets` | `tickets`, `daily_sequences` |
| **US-02** | As a customer, I want to **see my position and estimated waiting time** so that I can leave and come back. | `/track/:code` | `GET /api/tickets/:code` | `tickets`, `services`, `counters` |
| **US-03** | As a teller, I want to **call the next customer** so that the queue moves in the right order. | `/staff/teller` | `POST /api/teller/call-next` | `tickets`, `counter_services` |
| **US-04** | As a customer, I want to **be notified when my turn approaches and when I am called** (via API, not SMS). | `/track/:code` | `GET /api/tickets/:code/notifications` | `notifications` |
| **US-05** | As a pregnant, elderly or disabled customer, I want **priority service** so that I am served first. | `/kiosk` | `POST /api/tickets` (`isPriority`) | `tickets.is_priority` |
| **US-06** | As a customer in the hall, I want a **display board** showing who is being served and where. | `/display` | `GET /api/display` | `tickets` |
| **US-07** | As a branch manager, I want **daily reports** on waiting times and service performance. | `/staff/admin` | `GET /api/admin/stats` | all |
| **US-09** | As an institution manager, I want to **set up the system the first time it runs** (institution name, services, counters, my account) and go **straight to the dashboard**. | `/setup` | `GET/POST /api/setup` | `settings`, `services`, `counters`, `staff` |
| **US-10** | As a customer or staff member, I want to **use the system in English or Kinyarwanda**. | all screens | `language` on tickets, `name_rw` on services | `tickets.language`, `notifications.data` |
| **US-08** | As a branch manager, I want to **configure services, counters, staff and settings**. | `/staff/admin` | `/api/admin/*` | `services`, `counters`, `staff`, `settings` |

## Acceptance criteria

**US-01 Request ticket** ✅
- Given customers 1-5 have registered today, when the next customer registers, they receive number **006**.
- Phone must be a valid Rwandan mobile number (072/073/078/079); otherwise a clear error is shown.
- One active ticket per phone per day. A second request shows the existing ticket.
- The ticket shows its number, service, people ahead, estimated wait and a QR code for tracking.

**US-02 Track ticket** ✅
- Position and estimated wait refresh automatically (every 5 s).
- A customer can find their ticket by code, QR scan, or phone number + ticket number.
- A customer can cancel a waiting ticket.

**US-03 Call next** ✅
- Priority tickets are called first, then the lowest number.
- A teller cannot call a new customer while one is still at their counter.
- A counter only receives tickets for the services assigned to it.
- The teller can mark: arrived, completed, recall, or no-show.

**US-04 Notifications** ✅
- "Ticket issued" with number and estimated wait on registration.
- "Turn approaching" when fewer than *N* customers are ahead (N configurable, default 3), sent once per ticket.
- "It's your turn - proceed to Counter X" when called. The page chimes and vibrates, and shows a browser notification if allowed.
- Optional webhook POST for each notification, after the database commits.

**US-05 Priority** ✅
- The customer must choose a reason: pregnant, elderly, or disability.
- A priority ticket has 0 priority tickets ahead of it in its service queue, apart from earlier priority tickets.

**US-07 Reports** ✅
- Tickets issued, waiting, served, no-shows, cancelled, average and longest wait, average service time, notifications sent.
- Breakdown by hour, service, counter and priority reason, for any date.

**US-09 First-run setup** ✅
- On an empty database, every page redirects to the setup wizard, and queue endpoints return 503 `SETUP_REQUIRED`.
- The institution name, at least one service, at least one counter and a manager account (password of 8 or more characters) are required.
- Setup runs only once. A second attempt returns 409.
- After setup, the manager is signed in and lands on the dashboard.

**US-10 English / Kinyarwanda** ✅
- An EN | RW switch on every screen, remembered per device. The institution's default language is used until someone chooses.
- A ticket keeps the language chosen at the kiosk, and its notifications are written in that language.
- The tracking page can re-display all notifications in the other language.
