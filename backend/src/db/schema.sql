-- Smart Queue Management System - PostgreSQL schema
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS institutions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  name_rw     VARCHAR(100),
  type        VARCHAR(50) NOT NULL DEFAULT 'bank',
  location    VARCHAR(100),
  phone       VARCHAR(20),
  email       VARCHAR(100),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id                   SERIAL PRIMARY KEY,
  code                 VARCHAR(10) NOT NULL UNIQUE,
  name                 VARCHAR(80) NOT NULL,
  name_rw              VARCHAR(80),
  description          TEXT,
  description_rw       TEXT,
  avg_service_minutes  INTEGER NOT NULL DEFAULT 5 CHECK (avg_service_minutes BETWEEN 1 AND 120),
  institution_id       INTEGER REFERENCES institutions(id) ON DELETE CASCADE,
  is_active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS counters (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(40) NOT NULL UNIQUE,
  is_open     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS counter_services (
  counter_id  INTEGER NOT NULL REFERENCES counters(id) ON DELETE CASCADE,
  service_id  INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (counter_id, service_id)
);

CREATE TABLE IF NOT EXISTS staff (
  id             SERIAL PRIMARY KEY,
  full_name      VARCHAR(100) NOT NULL,
  username       VARCHAR(50) NOT NULL UNIQUE,
  password_hash  VARCHAR(100) NOT NULL,
  role           VARCHAR(10) NOT NULL CHECK (role IN ('admin', 'teller')),
  counter_id     INTEGER REFERENCES counters(id) ON DELETE SET NULL,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS daily_sequences (
  queue_date   DATE PRIMARY KEY,
  last_number  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id                      SERIAL PRIMARY KEY,
  public_code             VARCHAR(12) NOT NULL UNIQUE,
  queue_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  ticket_number           INTEGER NOT NULL,
  phone                   VARCHAR(16) NOT NULL,
  service_id              INTEGER NOT NULL REFERENCES services(id),
  is_priority             BOOLEAN NOT NULL DEFAULT FALSE,
  priority_reason         VARCHAR(20) CHECK (priority_reason IN ('pregnant', 'elderly', 'disability')),
  status                  VARCHAR(12) NOT NULL DEFAULT 'waiting'
                          CHECK (status IN ('waiting', 'called', 'serving', 'served', 'no_show', 'cancelled')),
  counter_id              INTEGER REFERENCES counters(id) ON DELETE SET NULL,
  served_by               INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  estimated_wait_minutes  INTEGER,
  approaching_notified    BOOLEAN NOT NULL DEFAULT FALSE,
  two_min_notified        BOOLEAN NOT NULL DEFAULT FALSE,
  recall_count            INTEGER NOT NULL DEFAULT 0,
  language                VARCHAR(2) NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'rw')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  called_at               TIMESTAMPTZ,
  service_started_at      TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  UNIQUE (queue_date, ticket_number)
);

CREATE TABLE IF NOT EXISTS notifications (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  type        VARCHAR(20) NOT NULL
              CHECK (type IN ('ticket_issued', 'turn_approaching', 'two_minutes', 'called', 'recalled', 'completed', 'no_show', 'cancelled')),
  title       VARCHAR(120) NOT NULL,
  message     TEXT NOT NULL,
  data        JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS settings (
  key    VARCHAR(50) PRIMARY KEY,
  value  TEXT NOT NULL
);

-- Fix old databases: allow longer service codes
ALTER TABLE services ALTER COLUMN code TYPE VARCHAR(10);
ALTER TABLE services ADD COLUMN IF NOT EXISTS institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS name_rw VARCHAR(80);
ALTER TABLE services ADD COLUMN IF NOT EXISTS description_rw TEXT;

-- Insert YOUR institution - Rwamagana Savings Bank only
INSERT INTO institutions (code, name, name_rw, type, location) VALUES
('RSB', 'Rwamagana Savings Bank', 'Banki yo Kuzigama ya Rwamagana', 'bank', 'Rwamagana')
ON CONFLICT (code) DO NOTHING;
