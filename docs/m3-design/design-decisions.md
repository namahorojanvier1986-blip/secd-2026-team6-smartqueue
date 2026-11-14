# M3 Design Decisions - Team 6 - SmartQueue

## 1. Why USSD + SMS (not only App)?
- Mama Rose uses basic phone, no internet.
- Decision: USSD *123# + SMS in Kinyarwanda.
- Impact: Everyone can join, not only smartphone users.

## 2. Why Kinyarwanda SMS?
- Users understand Kinyarwanda better than English.
- Decision: All SMS in Kinyarwanda, simple words.
- Example: "Ticket A-042, Position 5, ~25 min"

## 3. Why Priority Lane 1:2?
- Elderly / disabled should not wait long.
- Decision: Priority 1 : 2 = 1 priority ticket, then 2 normal tickets.
- Impact: Fair, Mama Rose waits less but others still move.

## 4. Why ETA + Leave & Return?
- Eric and Grace waste time standing in line.
- Decision: Show ETA + SMS when 3 away.
- Impact: Users can teach, work, leave and return on time.

## 5. Why Teller Call Next + Recall?
- Claudine needs fast control.
- Decision: Big [ CALL NEXT ] button, Recall / Transfer / No-Show.
- Impact: No confusion, queue moves fast.

## 6. Why Manager Dashboard + Export?
- Jean Paul needs to see bottleneck and report.
- Decision: Dashboard refresh every 5s, Export PDF/CSV in 30s.
- Impact: Manager can fix slow counter quickly.

## Team
- Janvier Namahoro, Jeavis, Eraste
- Users: Eric, Mama Rose, Grace, Claudine, Jean Paul
