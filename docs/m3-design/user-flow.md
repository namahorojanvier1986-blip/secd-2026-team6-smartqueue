# M3 User Flow - Team 6 - SmartQueue

## Flow 1: ERIC - Join Queue (Web)
1. Eric opens SmartQueue web -> Select Service: Deposit
2. Clicks [ JOIN QUEUE ]
3. System gives Ticket A-042 - Position: 5 - ETA ~25 min
4. Eric gets SMS in Kinyarwanda: "Ticket A-042, Position 5, ~25 min"
5. Eric leaves -> Gets SMS when 3 away -> Returns -> Served

## Flow 2: MAMA ROSE - USSD (Priority)
1. Mama Rose dials *123# on basic phone
2. Selects Service -> System detects Priority (Elderly)
3. Gets Ticket P-012 - Counter 2 - Priority 1:2
4. SMS: "Ticket P-012, Counter 2, come when called"
5. Leaves -> SMS calls her -> Served first

## Flow 3: GRACE - ETA + Appointment (Teacher)
1. Grace joins queue -> Ticket A-045 - Position: 3 - ETA ~15 min
2. Checks ETA -> Goes to teach
3. Gets SMS: "3 away - Return now"
4. Returns on time -> Served, no missed class

## Flow 4: CLAUDINE - Teller
1. Claudine opens Teller view -> Sees queue
2. Clicks [ CALL NEXT ] -> Calls A-043
3. If no-show -> [ RECALL ] or [ TRANSFER ]
4. Marks Served -> Next auto-called

## Flow 5: JEAN PAUL - Manager
1. Jean Paul opens Dashboard -> Queue 18 - Wait 22 min
2. Sees bottleneck: Counter 2 slow
3. Reassigns teller -> Wait drops
4. Clicks [ EXPORT REPORT ] -> PDF / CSV in 30s
