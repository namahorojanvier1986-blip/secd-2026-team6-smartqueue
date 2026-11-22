# SmartQueue Rwanda - Smart Queue Management System for Financial Institutions

A full-stack web system that lets bank customers take a queue number, leave the banking hall, follow their place in line from their phone, and come back when their turn approaches. Notifications go through the **API** (live web notifications on the customer's phone and an optional webhook), not SMS.

- **Works for any financial institution.** Nothing is hard-coded. The first time it runs, the institution's manager enters the institution name, picks the services and number of counters, and creates their account. They then land directly on the dashboard.
- **English and Kinyarwanda.** Every screen has an **EN | RW** switch. Customers get their notifications in the language they chose at the kiosk.

**Stack:** React (Vite) · Node.js / Express REST API · PostgreSQL

| Screen | URL | Who uses it |
|---|---|---|
| Home | `/` | Everyone |
| Self-service kiosk | `/kiosk` | Customer at the entrance (touch screen / tablet) |
| Track my ticket | `/track`, `/track/:code` | Customer on their own phone (QR code on the ticket) |
| Display board | `/display` | TV screen in the banking hall |
| Counter (teller) | `/staff/teller` | Teller at a counter |
| Dashboard | `/staff/admin` | Branch manager |
| First-run setup | `/setup` | Manager, once, on a new installation |

**First run:** open the app, and you are taken to the setup wizard. There are no built-in passwords: the manager creates the first account during setup and then adds tellers under **Dashboard → Staff**.

**Demo data (optional):** `npm run db:demo` in `backend/` loads a ready-made institution: *Demo Bank Rwanda*, `admin / admin1234`, `teller1 / teller123`, `teller2 / teller123`. It erases existing data first.

---

## 1. Run it

### Option 0 - IntelliJ IDEA

The project includes ready-made run configurations in the `.run/` folder.

1. Install **Node.js 18+** (nodejs.org) and **PostgreSQL** (postgresql.org/download). During the PostgreSQL install, set the password for the `postgres` user to `postgres`. If you choose another password, put it in `backend/.env` (see step 4).
2. Create the database. Open **pgAdmin** (or `psql`) and run `CREATE DATABASE smart_queue;`
3. In IntelliJ: **File → Open…** and select the `smart-queue-rwanda` folder, the one that contains `.run/`.
4. *(Only if your PostgreSQL password is not `postgres`.)* Copy `backend/.env.example` to `backend/.env` and edit `DATABASE_URL`.
5. In the run-configuration dropdown at the top right, choose **1. Install all dependencies** and press ▶. You only need to do this once.
6. Choose **2. Run Smart Queue (API + UI)** and press ▶. This starts the API (port 4000) and the React app (port 5173) in two tabs.
7. Open **http://localhost:5173**. The first time, the setup wizard opens: enter your institution name, choose services and counters, and create the manager account. You then land on the dashboard.

Other run configurations: **Backend tests**, **Database - load demo institution**, **Database - reset (first-run setup again)**, **Backend API** and **Frontend** (each one separately).

> The npm run configurations need JavaScript/Node.js support, which comes with IntelliJ IDEA **Ultimate**. On **Community Edition**, open the built-in **Terminal** (Alt+F12) and run `npm run setup`, then `npm run backend`, then `npm run frontend` in a second terminal tab.
>
> If Docker is installed, you can skip installing PostgreSQL. Run `npm run db` in a terminal to start only the database in Docker.

### Option A - Docker (easiest)

```bash
docker compose up --build
```

Open **http://localhost:4000** and complete the first-run setup.

### Option B - Run locally (for development)

Requirements: **Node.js 18+** and **PostgreSQL 14+**.

```bash
# 1. Create the database
createdb smart_queue            # or in psql:  CREATE DATABASE smart_queue;

# 2. Backend (API on http://localhost:4000)
cd backend
cp .env.example .env            # Windows: copy .env.example .env  - then edit DATABASE_URL / password
npm install
npm run dev                     # creates the tables automatically

# 3. Frontend (UI on http://localhost:5173), in a second terminal
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server forwards `/api` requests to the backend.

**Production build without Docker:** run `npm run build` in `frontend/`, then `npm start` in `backend/`. The API serves the built UI on port 4000.

### Useful commands (in `backend/`)

| Command | What it does |
|---|---|
| `npm run db:setup` | Create or upgrade tables (keeps data, safe to run again) |
| `npm run db:reset` | **Delete everything.** The next visit shows the first-run setup again |
| `npm run db:demo` | **Delete everything** and load the demo institution (for testing and presentations) |
| `npm test` | Run the API tests against `smart_queue_test` (create it first: `createdb smart_queue_test`) |

---

## 2. First-run setup and languages

### Setting up a new institution
When the system starts on an empty database, every page redirects to **/setup**, and the API refuses queue requests until setup is done. The wizard has three steps:
1. **Institution:** name (required), branch or location (optional), and the default language for customers (English or Kinyarwanda).
2. **Services & counters:** tick the services customers queue for, from a list of eight common banking services with English and Kinyarwanda names. Then choose how many counters the branch has. Cash services go to the general counters, and desk services (account opening, loans, customer care) go to the last counter. A preview shows the split.
3. **Manager account:** full name, username and password (at least 8 characters).

On **Finish**, everything is created in one database transaction, the manager is signed in, and they land on the **dashboard**. A welcome card points to the next steps: add tellers, open the kiosk and open the display board. Setup can only run once. Afterwards, the name, branch and default language can be changed in **Dashboard → Settings**, and services and counters in their own tabs.

### English / Kinyarwanda
- Every screen (kiosk, ticket tracking, display board, teller and dashboard) has an **EN | RW** switch. The choice is remembered on each device. Until someone chooses, the institution's default language is used.
- The language picked at the kiosk is saved with the ticket. That customer's notifications are written in that language, both in the database and in the webhook.
- Each notification also stores its values (number, service, counter and so on), so the tracking page can show it in either language when the customer switches.
- Every service has an English and a Kinyarwanda name, editable in **Dashboard → Services**.
- The teller sees which language the customer speaks ("Speaks Kinyarwanda").
- All texts are in `frontend/src/i18n.jsx` (screens) and `backend/src/services/messages.js` (notifications). Have a native speaker review the Kinyarwanda before going live.

## 3. How it works (a customer journey)

1. **Kiosk** - the customer taps a service (e.g. *Cash Deposit*), types their phone number (`078 123 4567`) on the keypad, and ticks *I need priority service* if they are pregnant, elderly or have a disability.
2. The system issues the **next sequential number for the day** (if 1-5 are taken, the customer gets **006**), and shows how many people are ahead, the estimated waiting time, and a **QR code**.
3. The customer scans the QR code and can **leave the hall**. The tracking page updates every 5 seconds.
4. When fewer than *N* customers are ahead (default 3, configurable), the system sends a **"Your turn is approaching"** notification.
5. A teller presses **Call next customer**. The customer gets **"It's your turn - proceed to Counter 2"**, their phone chimes and vibrates, and the display board highlights the number.
6. The teller marks the customer **arrived → completed**, or **recall** / **no-show** if they do not come.

### Queue rules
- Numbers are sequential per day and restart at 001 each morning (Rwanda time, `Africa/Kigali`).
- **Priority tickets are served first** at every counter, then everyone else in number order.
- One active ticket per phone number per day.
- Each counter serves only the services assigned to it (e.g. Counter 4 handles Account Opening, Loans and Customer Care).
- **Estimated wait** = customers ahead × average service time ÷ open counters for that service. The average is learned from the last 30 real services (once there are at least 3), otherwise the default minutes set per service.

### Notifications via API (no SMS)
Every notification (`ticket_issued`, `turn_approaching`, `called`, `recalled`, `completed`, `no_show`, `cancelled`) is:
1. **stored in the database** and shown live on the customer's ticket page, with a browser/phone notification, sound and vibration;
2. available to any client app via `GET /api/tickets/:code/notifications?since=<id>`;
3. optionally **POSTed to a webhook** (Admin → Settings) so the bank's mobile app or a messaging gateway can deliver it:

```json
{
  "event": "ticket.called",
  "ticket": { "code": "K7M2QX9A", "number": 6, "phone": "+250781234567" },
  "notification": { "id": 42, "type": "called", "title": "It's your turn!", "message": "Ticket 006: please proceed to Counter 2 now.", "created_at": "..." }
}
```

> Browser notifications work on `localhost` and on HTTPS sites. On a plain-HTTP network address, the tracking page still updates live and chimes, but the browser cannot show system notifications.

---

## 4. REST API

Base URL: `/api`. Staff routes need the header `Authorization: Bearer <token>` from `/auth/login`.

### Public (kiosk, customer, display)
| Method | Path | Description |
|---|---|---|
| GET | `/health` | API + database status |
| GET | `/info` | Institution name, branch, default language, `setupRequired` |
| GET | `/setup/status` | Whether first-run setup is needed, plus the service catalogue |
| POST | `/setup` | First-run setup (works once): `{ institutionName, branchName?, defaultLanguage, services: ['D','W',…], counters, managerName, username, password }` → `{ token, user }` |
| GET | `/services` | Active services with people waiting and estimated wait |
| POST | `/tickets` | Issue ticket: `{ phone, serviceId, isPriority?, priorityReason?, language? }` (`pregnant`, `elderly`, `disability`; `en` or `rw`) |
| GET | `/tickets/:code` | Ticket status, position, estimated wait, counter, notifications |
| GET | `/tickets/lookup?phone=&number=` | Find today's ticket by phone + number |
| GET | `/tickets/:code/notifications?since=` | New notifications only |
| POST | `/tickets/:code/notifications/read` | Mark notifications as read |
| POST | `/tickets/:code/cancel` | Customer cancels a waiting ticket |
| GET | `/display` | Data for the hall display board |

### Teller (any signed-in staff)
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | `{ username, password }` → `{ token, user }` |
| GET | `/teller/state` | My counter, current customer, waiting queue, my stats |
| PUT | `/teller/counter` | `{ counterId }` opens a counter; `{ counterId: null }` closes it |
| POST | `/teller/call-next` | Call the next customer (priority first) |
| POST | `/teller/tickets/:id/start` · `/complete` · `/recall` · `/no-show` | Move a ticket through its lifecycle |

### Admin
| Method | Path | Description |
|---|---|---|
| GET | `/admin/stats?date=YYYY-MM-DD` | Totals, average wait/service time, by hour/service/counter/priority |
| GET | `/admin/tickets?date=&status=` | Ticket log |
| GET/POST/PUT | `/admin/services`, `/admin/services/:id` | Manage services |
| GET/POST/PUT | `/admin/counters`, `/admin/counters/:id` | Manage counters and the services they handle |
| GET/POST/PUT | `/admin/staff`, `/admin/staff/:id` | Manage staff accounts |
| GET/PUT | `/admin/settings` | Branch name, approaching threshold, priority policy, webhook URL |

Errors always come back as `{ "error": "Readable message" }` with a matching HTTP status (400, 401, 403, 404, 409).

---

## 5. Database (PostgreSQL)

| Table | Purpose |
|---|---|
| `services` | Cash Deposit, Withdrawal, Account Opening… with default minutes per customer |
| `counters` / `counter_services` | Counters and which services each one handles |
| `staff` | Tellers and admins (passwords hashed with bcrypt) |
| `daily_sequences` | Today's last ticket number, which keeps numbers sequential with no gaps, even with several kiosks |
| `tickets` | Every ticket: number, phone, service, priority, status, counter and timestamps |
| `notifications` | Messages delivered to customers through the API |
| `settings` | Institution name, branch, default language, setup status and other configuration |

Ticket status flow: `waiting → called → serving → served`, or `called → no_show`, or `waiting → cancelled`.

The full schema is in `backend/src/db/schema.sql`.

---

## 6. Project structure

```
smart-queue-rwanda/
├── backend/
│   ├── src/
│   │   ├── server.js            # starts API, runs migrations
│   │   ├── app.js               # Express app and routes
│   │   ├── db/                  # schema.sql, migrate + seed, pg pool
│   │   ├── services/queue.js    # queue logic: numbering, priority, ETA, calling
│   │   ├── services/notifier.js # API notifications + webhook
│   │   ├── services/messages.js # notification texts in English + Kinyarwanda
│   │   ├── services/setup.js    # first-run setup
│   │   ├── routes/              # public, auth, teller, admin
│   │   ├── middleware/auth.js   # JWT authentication and roles
│   │   └── utils/               # phone validation (Rwanda), errors
│   └── tests/api.test.js        # end-to-end API tests
├── frontend/
│   └── src/
│       ├── pages/               # Setup, Home, Kiosk, Track, TicketStatus, Display, StaffLogin, Teller, Admin
│       ├── i18n.jsx             # English + Kinyarwanda texts, language switcher
│       ├── components/Layout.jsx
│       ├── api.js, hooks.js
│       └── styles.css           # design system
├── docs/user-stories.md         # user stories, acceptance criteria, Definition of Done
├── Dockerfile
└── docker-compose.yml
```

## 7. Security notes for a real deployment
- Set a long random `JWT_SECRET`. Don't load the demo data (`db:demo`) on a real installation.
- Serve over HTTPS. Browser notifications also require it.
- Phone numbers are masked (`078****567`) everywhere except the database and webhook.
- Customers access tickets with a random 8-character code, not the guessable ticket number.
