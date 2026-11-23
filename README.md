# Smart View Travel

Finance system for a travel & tour agency — Ticket, Umrah, Umrah + Ticket
(combined), Tours, Daily Expenses, Profit & Loss, a read-only AI chatbot,
and a Dashboard with payment reminders. Built to the Tricky Tech developer
guidelines (guide §1–§9).

Stack: Next.js 16.4.6 (App Router) + React 19 + Tailwind 4, Supabase
(`@supabase/supabase-js`). Node 24, npm. No RLS — app-level checks only
(single admin login).

## Quick start (local demo)

```bash
npm install
npm run seed     # fake demo data only — see below
npm run dev      # http://localhost:3000
```

Local demo login (local mode only, when Supabase is NOT configured):

- Email: `admin@demo.local`
- Password: `demo1234`

The demo login only exists in the local JSON database (`data/db.json`,
gitignored). It never works against Supabase.

## Env (3 values, in `.env.local` — gitignored)

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server only, never expose) |

With none of these set, the app runs on the local JSON store
(`data/db.json`). With the URL + service-role key set, it uses Supabase.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run seed` | Seed clearly-fake demo data into `data/db.json` |
| `npm run verify` | Acceptance tests T01–T13 against a fresh temp DB |

`npm run seed` refuses to run twice — use `npm run seed -- --force` to
wipe `data/db.json` and re-seed. `npm run verify` moves your real
`data/db.json` aside, runs the tests on a fresh temp DB, then restores it.

## How it works

- **Data layer** — `lib/store.ts`: one `Store` interface, two backends
  (Supabase when env is set, local JSON otherwise). Same shapes, same
  rules. Overpayment blocking is enforced inside `addPayment` in both
  backends — no UI path can bypass it.
- **Maths** — `lib/calc.ts`: received = sum of ACTIVE payments only
  (voided excluded); pending = total − received; profit = total received
  − total expenses. Pending is NEVER counted as profit.
- **Server actions** — `app/actions/finance.ts` (`createCustomer`,
  `createRecord`, `addPayment`, `voidPayment`, `updateDueDate`,
  `addExpense`) and `app/actions/auth.ts` (`signInAction`,
  `signOutAction`). Every action checks the admin session first,
  validates inputs, returns `{ ok, error? }`, and revalidates the
  affected pages. `createRecord` accepts an existing `customer_id` OR a
  new customer name (created inline).
- **Chatbot** — `POST /api/chat` (`app/api/chat/route.ts`) builds a
  snapshot from live records and calls the rule-based chatbot in
  `lib/chatbot.ts`. Read-only: it refuses any create / edit / delete /
  void request and never writes anything. Requires a session (401 when
  logged out). No external AI API, key, or cost.
- **Auth** — `lib/auth.ts`: single admin session, cookie `tt_session`.
  Supabase mode verifies the token with Supabase Auth; local mode checks
  the demo admin seeded by `npm run seed`.

## Switching to Supabase

1. Create a Supabase project.
2. Run the setup SQL once in the Supabase SQL editor:
   `~/workspace/your_files/tt-travel-finance-setup.sql`
   (creates `customers`, `finance_records`, `payments`, `expenses`,
   `profiles`).
3. Create the admin user in Supabase Auth (Dashboard → Authentication →
   Add user), then add a matching row in `profiles` (id = the Auth user
   id, email, display name).
4. Set the 3 env values above in `.env.local` (local) or Vercel
   Environment Variables (deployed) and restart.

## Safe defaults (guide §9)

- Overpayments BLOCKED — a payment may never exceed the remaining balance.
- Single admin login; no multi-user roles in v1.
- One next payment date per record.
- Reminders: overdue + due within 7 days, in-system only
  (no SMS / WhatsApp / email).
- Deleting a payment = VOID with a reason (row kept, excluded from totals).
- PKR only. No data import in v1. No receipt upload in v1.
- Chatbot rule-based, no external AI API / key / cost.
- Excluded: ticket booking, visa processing, hotel/airline, payment gateway.

## Known gaps

- Live end-to-end check against a real Supabase project still pending
  (no project exists yet — SQL file verified by reading only).
- T14 screenshot sweep done 2026-11-19 by the tester: 22 screenshots
  (11 pages × 1440px + 390px) in `/tmp/tt-screenshots/`, zero page
  overflow at 390px; the one cosmetic defect found (record-detail stat
  wrap) was fixed and re-verified live the same day.
- No receipt upload, no data import, no SMS/WhatsApp/email reminders
  (all excluded in v1 by design).
- `confirm` / `cancel` of a record is not a DB transaction across
  tables in the local JSON backend (single-file writes only).
- 320px width was not checked (contract range is 360–1440px).
