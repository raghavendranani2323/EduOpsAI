# EduOps Permission Matrix

Server checks and RLS must both enforce this matrix. UI visibility is not an
authorization control.

| Resource | Owner | Admin | Teacher | Accountant | Parent | Anonymous |
|---|---|---|---|---|---|---|
| Institution settings | Manage | Manage | No | No | No | No |
| Team and invitations | Manage | Manage, except owner escalation | No | No | No | No |
| Classes and academic years | Manage | Manage | View assigned classes | No | No | No |
| Students | Manage | Manage | View assigned-class students | View only through fee workflows | Own children only | No |
| Attendance | All classes | All classes | Assigned classes only | No | Own children summary | No |
| Subjects | Manage | Manage | View assigned/global subjects | No | No | No |
| Exams and marks | Manage | Manage | View and enter marks for assigned classes | No | Published own-child results only | No |
| Timetable | Manage | Manage | View assigned classes | No | No | No |
| Homework | Manage | Manage | Manage assigned classes | No | Own-child classes | Token/session only |
| Notices | Manage | Manage | View teacher/general notices; manage own assigned-class notices | No | Authorised parent notices | Token/session only |
| Admissions | Manage | Manage | No | No | No | No |
| Communications | Manage | Manage | No bulk sends | No | Recipient only | No |
| Fees/exports | Manage | Manage | No | Manage fee workflows | Own children only | No |
| Audit log | View | View | No | No | No | No |

Rules:

- A teacher assignment is the union of section teacher and class-group head.
- A teacher cannot infer unassigned class existence through direct IDs.
- Accountants do not receive general academic or administrative access.
- Parent access is scoped by verified guardian relationship or a valid,
  revocable student portal token.
- Payment provider and reconciliation permissions remain deferred with
  `PAY-001` through `PAY-004`.
