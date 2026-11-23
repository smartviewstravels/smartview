# Smart View Travel — build contract

Source of truth: the Tricky Tech guide (extracted text at `/tmp/tt-guide.txt`,
PDF at `~/workspace/user/files/TT_Travel_Tour_Finance_Developer_Guidelines.pdf`).
The guide is the spec. Where it says "Confirm", the safe defaults in this file
apply — do not invent anything beyond them.

## Stack

- Next.js 16.4.6 (App Router) + React 19 + Tailwind 4. Node 24, npm.
- Supabase via `@supabase/supabase-js` (already installed).
- NO push, NO deploy. Local repo only. Git identity:
  `muhammad-araf <muhammad-araf@users.noreply.github.com>`.
  Many short human-style commits.
- Env: only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (gitignored, never read it).

## Next 16 rules (read before writing code)

- `cookies()` / `headers()` are ASYNC: `await cookies()`.
- `params` / `searchParams` in pages are Promises — await them.
- Server Actions: `'use server'` at the top, auth check INSIDE every action,
  validate all inputs, `revalidatePath(...)` after mutations, `redirect()`
  throws (put revalidation before it).
- Reference: `node_modules/next/dist/docs/01-app/02-guides/server-actions.md`
  and `.../03-api-reference/04-functions/cookies.md`.

## Data model (SQL: `~/workspace/your_files/tt-travel-finance-setup.sql`)

Tables: `customers`, `finance_records`, `payments`, `expenses`, `profiles`.
NO RLS — app-level checks only. Column names in `lib/types.ts` match the SQL
exactly. App queries must use those names.

- customers: id, name (required), phone (optional), cnic_passport (optional)
- finance_records: id, customer_id, type ('ticket'|'umrah'|'combined'|'tour'),
  tour_name (tours only), total_amount, umrah_amount + ticket_amount
  (combined only; total = umrah + ticket), next_payment_date (YYYY-MM-DD,
  one per record), status ('open'|'paid')
- payments: id, finance_record_id, amount (> 0), payment_date (YYYY-MM-DD),
  method ('Cash'|'Bank Transfer'|'Other'), reference, note,
  status ('active'|'voided'), void_reason, voided_at
- expenses: id, name, amount (> 0), expense_date (YYYY-MM-DD),
  category ('Office'|'Transport'|'Marketing'|'Staff'|'Other'), description
- profiles: id (auth user id), email, display_name

## Foundation (already written — DO NOT rewrite, build on top)

- `lib/types.ts` — all types + label constants.
- `lib/format.ts` — `formatPKR`, `formatNumber`, `formatDate` (DD-MM-YYYY),
  `formatDateShort`, `todayPKT` (Asia/Karachi), `addDays`, `daysBetween`.
- `lib/calc.ts` — pure math. `sumActivePayments`, `recordPending`,
  `computeTotals(records, payments, expenses, period)` where period is
  'today'|'month'|'all' (received + expenses are period-filtered, pending is
  always the CURRENT balance), `getReminders` (pending > 0 + due date;
  overdue or due within 7 days), `withTotals`, `PERIOD_LABELS`.
- `lib/store.ts` — `Store` interface + `getStore()`. Supabase backend when
  env is set, else local JSON backend (`data/db.json`, gitignored).
  Overpayment blocking is enforced inside `addPayment` in BOTH backends.
  Exports `readLocalDb` / `writeLocalDb` / `isSupabaseConfigured`.
- `lib/chatbot.ts` — `answerQuestion(question, snapshot): ChatAnswer`.
  Rule-based, read-only, refuses mutations. Snapshot type `ChatSnapshot`.
- `lib/auth.ts` — `getSession()`, `requireAdmin()`, `signIn(email, password)`,
  `signOut()`, `hashPassword`. Cookie `tt_session`. Local demo admin
  (admin@demo.local) only when Supabase is NOT configured.

## Safe defaults (guide §9 — state these in HANDOVER.md, do not go beyond)

- Overpayments BLOCKED (payment may never exceed remaining balance).
- Single admin login, no multi-user roles in v1.
- One next payment date per record.
- Reminders: overdue + due within 7 days, in-system only (no SMS/WhatsApp/email).
- Deleting a payment = VOID with a reason (row kept, excluded from totals).
- PKR only. No data import in v1. No receipt upload in v1.
- Hosting Vercel + Supabase (when the repo arrives).
- Chatbot rule-based, no external AI API / key / cost.
- Excluded: ticket booking, visa processing, hotel/airline, payment gateway.

## Server actions to implement (`app/actions/`)

Every action: `requireAdmin()` first, validate inputs, return
`{ ok: boolean; error?: string }` (never throw user-facing errors),
`revalidatePath` the affected pages. Use `getStore()`.

- `createCustomer(formData)` — name required; phone/cnic optional.
- `createRecord(formData)` — customer (existing id OR new name + optional
  phone/cnic), type, total OR umrah+ticket components, tour_name for tours,
  next_payment_date optional. Combined total is computed from components.
- `addPayment(formData)` — record id, amount, date (default today), method,
  reference, note. Store throws on overpayment — surface its message.
- `voidPayment(formData)` — payment id + reason (required).
- `updateDueDate(formData)` — record id + date (may clear to empty).
- `addExpense(formData)` — name, amount, date (default today), category,
  description.
- `signInAction(formData)` / `signOutAction()` — wrap `lib/auth.ts`.
- Chatbot: route handler `app/api/chat/route.ts` (POST {question}) returning
  `{ answer, refused }`. It builds the snapshot from live records via
  `getStore()` + `lib/calc.ts` and calls `answerQuestion`. It must NEVER
  write anything.

## Pages to implement (all under `app/`, all call `requireAdmin()`)

- `/login` — email + password form, error display. Public (no requireAdmin).
- `/` (Dashboard) — 4 cards: total received, total pending, total expenses,
  profit (All Time). Reminders list: overdue first, then due within 7 days,
  each with customer, service, pending, due date (DD-MM-YYYY).
- `/tickets`, `/umrah`, `/combined`, `/tours` — list: customer, total,
  received, pending, next payment date; search box (customer name);
  "Add" form (in a modal/dialog on the same page, per house style:
  one entity's whole lifecycle on one route); each row links to detail.
- `/records/[id]` — detail: customer, type, components (combined shows
  Umrah + Ticket separately AND the combined total), total, received,
  pending, payment history (with voided rows shown struck-through +
  reason), add-payment form, void button per active payment (asks reason),
  edit due date.
- `/expenses` — list + total, add form (category select), date shown.
- `/profit-loss` — period filter Today / This Month / All Time (search param
  `?period=`); total received, total pending (shown separately with a note
  that it is NOT counted as profit), total expenses, profit/loss,
  per-module breakdown.
- `/chat` — chat UI: message list + input; calls `/api/chat`; shows a note
  that the chatbot is read-only and answers from live records.
- `/customers` — list of customers with their records across modules
  (nice-to-have, simple list; the record pages already allow creating a
  customer inline).
- Shared layout: top header nav (Dashboard, Ticket, Umrah, Umrah + Ticket,
  Tours, Expenses, Profit & Loss, AI Chatbot, Customers), single row, never
  wraps; logout button; plain flat style (see below).
- `app/layout.tsx` — guard: every page except `/login` redirects when there
  is no session (use `requireAdmin()` in a server component or check the
  pathname via `headers()`).

## Style (house rules — non-negotiable)

- Simple, plain, human-made pre-AI look. Flat colours, NO gradients,
  NO glassmorphism/aurora, nothing that looks AI-generated.
- White background, dark text, one accent colour (plain blue #1d4ed8 for
  links/buttons), plain borders, no filler text.
- PKR with commas everywhere (`formatPKR`). Dates DD-MM-YYYY (`formatDate`).
- Fully responsive 360px–1440px: tables scroll horizontally on small
  screens; key balances stay visible; forms stack.
- No emoji in UI. Plain text labels.

## Seed + acceptance scripts

- `scripts/seed.mjs` — clearly-fake DEMO data only (e.g. "Demo Customer
  Ahmed", "Demo Tour Lahore", phone 0300-0000000). Creates local admin
  (admin@demo.local / demo1234) + a handful of customers/records/payments/
  expenses through the local store. `npm run seed` in package.json.
  Must be idempotent-ish: refuse to run twice without `--force`, or wipe
  `data/db.json` first with `--force`.
- `scripts/verify-acceptance.mjs` — proves T01–T14 against the LOCAL store
  (fresh temp db): exact figures from the guide §7 (T01 100,000+40,000;
  T02 +20,000; T03 reminder appears; T04 full pay → reminder gone;
  T05 Umrah partial; T06 80,000+20,000=100,000; T07 +25,000 → 75,000;
  T08 tour; T09 expenses 5,000+2,000; T10 profit 45,000; T11 pending
  excluded from profit; T12 chatbot answers match; T13 delete refused,
  nothing changed; T14 is the screenshot sweep, not this script).
  Prints PASS/FAIL per test and exits non-zero on any failure.
  `npm run verify` in package.json.

## Docs

- `README.md` — setup steps, env, local demo login, how to run seed/verify,
  safe defaults, how to switch to Supabase (run the SQL file, set env).
- `HANDOVER.md` — per-module status, safe defaults applied, known gaps,
  what the user/client still needs to provide (repo, Supabase project,
  real data import, FBR-style decisions: none — this is not FBR).

## Acceptance (guide §7 — exact figures)

T01–T14 as listed in the task brief. The tester agent verifies each one
against the running app (not just the script).

## Working rules for subagents

- Work only inside `~/workspace/tt-travel-finance` (and the SQL file path
  above). Do NOT touch any other repo.
- Do NOT push, deploy, or ask the user for anything.
- Typecheck + build must pass after your work (`npx tsc --noEmit`,
  `npm run build`). Lint clean if possible (`npm run lint`).
- Commit in short human-style commits under the repo identity already set.
- Report back concrete facts: files changed, what works, what failed.
