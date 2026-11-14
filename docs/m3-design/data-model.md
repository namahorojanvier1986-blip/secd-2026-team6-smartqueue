# Data Model - M3

User (id, phone, role: Customer/Teller/Manager/Admin, language: EN/RW)
Ticket (id, number: A-042/P-012, service, status: waiting/called/serving/done/no-show, priority: normal/priority, created_at)
Service (id, name, working_hours)
Counter (id, number, teller_id, status: open/break/closed)
Appointment (id, user_id, service, slot, status)
Feedback (id, ticket_id, rating 1-5, comment)
AuditLog (id, user_id, action, time)
