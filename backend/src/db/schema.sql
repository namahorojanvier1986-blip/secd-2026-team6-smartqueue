-- Smart Queue - Institutions Setup
-- Creates institutions table and inserts Banks

-- 1. Create institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  name_rw     VARCHAR(100),
  type        VARCHAR(50) NOT NULL DEFAULT 'bank',
  location    VARCHAR(100),
  address     TEXT,
  phone       VARCHAR(20),
  email       VARCHAR(100),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add institution_id to services table (to link services to institutions)
ALTER TABLE services ADD COLUMN IF NOT EXISTS institution_id INTEGER REFERENCES institutions(id) ON DELETE CASCADE;

-- 3. Delete old demo services
DELETE FROM tickets WHERE service_id IN (SELECT id FROM services WHERE name IN ('Administration office', 'Emergency Clinic', 'Technical Help Desk'));
DELETE FROM services WHERE name IN ('Administration office', 'Emergency Clinic', 'Technical Help Desk');

-- 4. Insert Institutions - YOUR BANKS
INSERT INTO institutions (code, name, name_rw, type, location, phone, email) VALUES
('BK', 'Bank of Kigali', 'Banki ya Kigali', 'bank', 'Kigali', '+250788000000', 'info@bk.rw'),
('EQUITY', 'Equity Bank Rwanda', 'Equity Bank Rwanda', 'bank', 'Kigali', '+250788000001', 'info@equitybank.co.rw'),
('IMBANK', 'I&M Bank Rwanda', 'I&M Bank Rwanda', 'bank', 'Kigali', '+250788000002', 'info@imbank.rw'),
('KCB', 'KCB Bank Rwanda', 'KCB Bank Rwanda', 'bank', 'Kigali', '+250788000003', 'info@kcb.rw'),
('ACCESS', 'Access Bank Rwanda', 'Access Bank Rwanda', 'bank', 'Kigali', '+250788000004', 'info@accessbank.rw')
ON CONFLICT (code) DO NOTHING;

-- 5. Insert Services for each Institution
-- Bank of Kigali Services
INSERT INTO services (code, name, name_rw, description, description_rw, avg_service_minutes, institution_id) VALUES
('BK01', 'Account Opening', 'Gufungura Konti', 'Open new bank account', 'Gufungura konti nshya', 10, (SELECT id FROM institutions WHERE code='BK')),
('BK02', 'Loan Services', 'Serivisi z Inguzanyo', 'Apply for loan', 'Gusaba inguzanyo', 15, (SELECT id FROM institutions WHERE code='BK')),
('BK03', 'Cash Deposit / Withdrawal', 'Kubitsa / Gukuramo Amafaranga', 'Deposit and withdrawal', 'Kubitsa no gukuramo amafaranga', 5, (SELECT id FROM institutions WHERE code='BK'));

-- Equity Bank Services
INSERT INTO services (code, name, name_rw, description, description_rw, avg_service_minutes, institution_id) VALUES
('EQ01', 'Account Opening', 'Gufungura Konti', 'Open new bank account', 'Gufungura konti nshya', 10, (SELECT id FROM institutions WHERE code='EQUITY')),
('EQ02', 'Loan Services', 'Serivisi z Inguzanyo', 'Apply for loan', 'Gusaba inguzanyo', 15, (SELECT id FROM institutions WHERE code='EQUITY')),
('EQ03', 'Cash Deposit / Withdrawal', 'Kubitsa / Gukuramo Amafaranga', 'Deposit and withdrawal', 'Kubitsa no gukuramo amafaranga', 5, (SELECT id FROM institutions WHERE code='EQUITY'));

-- I&M Bank Services
INSERT INTO services (code, name, name_rw, description, description_rw, avg_service_minutes, institution_id) VALUES
('IM01', 'Account Opening', 'Gufungura Konti', 'Open new bank account', 'Gufungura konti nshya', 10, (SELECT id FROM institutions WHERE code='IMBANK')),
('IM02', 'Loan Services', 'Serivisi z Inguzanyo', 'Apply for loan', 'Gusaba inguzanyo', 15, (SELECT id FROM institutions WHERE code='IMBANK'));

-- KCB Bank Services
INSERT INTO services (code, name, name_rw, description, description_rw, avg_service_minutes, institution_id) VALUES
('KCB01', 'Account Opening', 'Gufungura Konti', 'Open new bank account', 'Gufungura konti nshya', 10, (SELECT id FROM institutions WHERE code='KCB')),
('KCB02', 'Loan Services', 'Serivisi z Inguzanyo', 'Apply for loan', 'Gusaba inguzanyo', 15, (SELECT id FROM institutions WHERE code='KCB'));

-- Access Bank Services
INSERT INTO services (code, name, name_rw, description, description_rw, avg_service_minutes, institution_id) VALUES
('AC01', 'Account Opening', 'Gufungura Konti', 'Open new bank account', 'Gufungura konti nshya', 10, (SELECT id FROM institutions WHERE code='ACCESS')),
('AC02', 'Loan Services', 'Serivisi z Inguzanyo', 'Apply for loan', 'Gusaba inguzanyo', 15, (SELECT id FROM institutions WHERE code='ACCESS'));

-- 6. Verify
SELECT * FROM institutions;
SELECT code, name, institution_id FROM services;
