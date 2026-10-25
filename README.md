# AL NOOR ISLAMIC SCIENCE SCHOOL MIRZAPUR — School Management System

Principal: **Muhammad Nafees** · Contact: **03058480044** · Domain reference: `alnoorschool.studentinfo.pk`
(the domain is a reference supplied by the school — it is **not** proof that hosting is configured.)

A production-oriented, role-based school ERP built with **Next.js (App Router) + TypeScript + Tailwind CSS +
PostgreSQL (Drizzle ORM)**. Server-side authentication, server-enforced permissions and audit logging are part of the
core, not an afterthought.

---

## 1. Technology

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4, custom accessible component set |
| Charts | Recharts |
| Backend | Next.js Route Handlers (REST-style JSON APIs — reusable by a future Android/iOS app) |
| Database | PostgreSQL via Drizzle ORM |
| Auth | HTTP-only signed session cookie + bcrypt password hashing |
| Icons | lucide-react |

The Power Platform alternative described in the brief is intentionally **not** mixed in — this is the independent web
application implementation.

## 2. Project structure

```
src/
  app/
    (app)/              # authenticated shell: dashboard + all modules
      dashboard, students, guardians, staff, academics, timetable,
      attendance, homework, exams, fees, expenses, payroll, admissions,
      leaves, announcements, library, transport, inventory, complaints,
      events, reports, users, audit, settings, portal/{student,parent}
    api/                # server APIs (authorisation enforced in every handler)
      auth/, resources/[resource]/, attendance/, fees/, exams/, announcements/,
      workflows/, reports/, users/, settings/, portal/, lookups/, audit/, health/
    login/              # public sign-in page
  components/           # shell, resource CRUD engine, portal, UI primitives
  db/                   # schema.ts (all tables), index.ts (pool), seed.ts (sample data)
  lib/                  # auth.ts, rbac.ts, grading.ts, resource definitions
public/images/          # generated logo + empty-state illustration
```

## 3. Setup

```bash
cp .env.example .env         # set DATABASE_URL and AUTH_SECRET
npm install
npx drizzle-kit push         # create/update all tables
npx tsx src/db/seed.ts       # load clearly-labelled SAMPLE data (optional)
npm run dev                  # http://localhost:3000
```

Production:

```bash
npm run build && npm run start
```

### Sample demo accounts (seed data only — replace before any pilot)

Password for every demo account: `Passw0rd!2024`

| Role | Email |
| --- | --- |
| Principal | principal@alnoorschool.studentinfo.pk |
| Administrator | admin@alnoorschool.studentinfo.pk |
| Teacher | teacher@alnoorschool.studentinfo.pk |
| Accountant | accountant@alnoorschool.studentinfo.pk |
| Receptionist / Admissions | reception@alnoorschool.studentinfo.pk |
| Librarian | library@alnoorschool.studentinfo.pk |
| Transport Manager | transport@alnoorschool.studentinfo.pk |
| Parent | parent@alnoorschool.studentinfo.pk |
| Student | student@alnoorschool.studentinfo.pk |

All seeded numbers (students, fees, attendance, results) come from real rows in the database and are labelled sample
data. Nothing on a dashboard is hard-coded.

## 4. Roles and permissions

Capabilities are declared in `src/lib/rbac.ts` and checked **server side** on every request via `requireCap()`.
Navigation is filtered by the same matrix, but hiding a link is never the security control.

Highlights:

* **Principal** – full oversight, user management, result publication, settings, audit logs.
* **Administrator** – students, admissions, classes/sections/subjects, timetable, calendar. No payroll.
* **Teacher** – own classes, attendance, homework, marks entry. No payroll, no school-wide fee data.
* **Student** – read-only personal portal.
* **Parent** – only children whose `student_guardians` link is verified; `/api/portal` rejects any other student id.
* **Accountant** – fees, invoices, payments, expenses. Payments are voided (audited), never deleted.
* **Receptionist, Librarian, Transport Manager, Other employees** – scoped modules only.

## 5. Modules implemented

Students · Parents/guardians with verified links · Admissions workflow (submitted → documents reviewed → approved/
rejected → registered) · Staff & teaching assignments · Academic years, classes, sections, subjects · Timetable ·
Student attendance (duplicate-proof upsert per student/date/session) · Staff attendance · Homework · Examinations,
exam papers, marks entry with configurable grading, principal-only publication · Fees (class fee structures, invoice
generation, partial payments, receipt numbers, outstanding balances, defaulter report) · Expenses with approval ·
Payroll · Leave requests with routed approval · Notifications & announcements with recipient preview and per-recipient
delivery tracking · Library · Transport · Inventory · Complaints/discipline · Calendar & events · Reports with CSV
export · Users, roles, audit logs and system settings.

## 6. Messaging integrations (require external configuration)

| Channel | Requirement | Behaviour when not configured |
| --- | --- | --- |
| In-app portal | none | genuinely delivered to linked portal accounts |
| Email | `SMTP_*` variables + provider account | delivery row recorded as `skipped` with the reason |
| SMS | `SMS_API_KEY` (paid Pakistani gateway) | `skipped` |
| WhatsApp | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, approved Meta Business templates, opt-in | `skipped` |

The school starts in **test mode** (System Settings). While test mode is on, no external message is ever sent to a real
parent. The application never reports a message as delivered unless the channel actually delivered it. Recipient
phone numbers are masked in every delivery report, so one parent's number is never exposed to another.

## 7. Security

* bcrypt password hashing, HMAC-signed HTTP-only session cookie with expiry.
* `requireUser()` / `requireCap()` on every API route; 401/403 returned as JSON.
* Parent-to-student relationship validated on the server for every portal request.
* Input validation and type coercion on all writes; marks bounded by the paper maximum; payments cannot exceed the
  invoice balance; attendance statuses whitelisted.
* Unique constraints prevent duplicate attendance, duplicate results, duplicate admission numbers and repeated
  invoices for the same billing period.
* Completed payments cannot be edited — only voided with a reason, which is written to the audit log.
* `audit_logs` records create/update/delete, logins, failed logins, approvals, publications and settings changes.

## 8. Backup and recovery

```bash
# nightly backup (store off-site, encrypted)
pg_dump "$DATABASE_URL" -Fc -f backups/alnoor-$(date +%F).dump

# restore drill (run quarterly on a staging database)
pg_restore --clean --if-exists -d "$STAGING_DATABASE_URL" backups/alnoor-YYYY-MM-DD.dump
```

Document the restore drill result each quarter; a backup is only valid once a restore has been tested.

## 9. Deployment

1. Provision PostgreSQL (managed service recommended) and set `DATABASE_URL`.
2. Set a strong `AUTH_SECRET` (32+ random characters) in the hosting platform's secret store — never in git.
3. `npm ci && npm run build && npm run start` (or deploy to Vercel/Railway/any Node host).
4. Run `npx drizzle-kit push` once against the production database; do **not** run the seed script in production.
5. Create the real Principal account, then deactivate every demo account.
6. Configure the school profile, logo, academic year, classes, fee structures and grading rules in System Settings.
7. Point `alnoorschool.studentinfo.pk` at the host and enable HTTPS.

## 10. Testing checklist

- [ ] Each role can sign in and lands on the correct dashboard.
- [ ] A teacher receives 403 from `/api/fees/invoices` and `/api/users`.
- [ ] A parent receives 403 when requesting another family's `studentId`.
- [ ] Attendance submitted twice for the same class/date/session updates rather than duplicates.
- [ ] Invoice generation skips students already billed for the period.
- [ ] A partial payment sets status `partial`; completing the balance sets `paid`; overpayment is rejected.
- [ ] Voiding a payment recalculates the balance and writes an audit entry.
- [ ] Marks above the paper maximum are rejected; grades match the grading policy.
- [ ] Only the Principal can publish results; published results appear in the student/parent portal.
- [ ] Announcement preview shows the correct recipient count; delivery report shows masked references and honest
      statuses.
- [ ] Reports export CSV with the same figures shown on screen.
- [ ] Layouts verified on mobile (360px), tablet and desktop, in light and dark themes.
- [ ] Backup taken and restored into staging successfully.

## 11. Roadmap

Document/photo uploads to object storage, PDF report cards and ID cards, online fee payment gateway with verified
callbacks, SMS/WhatsApp provider adapters with delivery webhooks, biometric staff attendance, GPS transport tracking,
automated unit/E2E test suite (Vitest + Playwright) and a React Native client reusing the existing JSON APIs.
