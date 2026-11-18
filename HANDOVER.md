# HANDOVER — TT Travel & Tour Finance

Source of truth: the Tricky Tech developer guidelines
(`~/workspace/user/files/TT_Travel_Tour_Finance_Developer_Guidelines.pdf`,
extracted text at `/tmp/tt-guide.txt`). Build contract:
`.coordination/CONTRACT.md`.

## Status per module

| Module | Status |
| --- | --- |
| Foundation (`lib/types`, `lib/format`, `lib/calc`, `lib/store`, `lib/chatbot`, `lib/auth`) | Done (scaffold) — frozen, do not rewrite |
| Server actions (`app/actions/finance.ts`, `app/actions/auth.ts`) | Done — see below |
| Chat API (`app/api/chat/route.ts`) | Done — read-only, session required |
| Seed (`scripts/seed.mjs`) | Done — fake demo data only |
| Acceptance (`scripts/verify-acceptance.mjs`) | Done — T01–T13 green, 30/30 checks |
| Pages (`/`, `/login`, `/tickets`, `/umrah`, `/combined`, `/tours`, `/records/[id]`, `/expenses`, `/profit-loss`, `/chat`, `/customers`, layout/nav) | UI agent — in progress in parallel |
| Docs (README, this file) | Done (this version) |

## What the backend work did

- `app/actions/finance.ts` — `createCustomer`, `createRecord`
  (existing `customer_id` OR new customer name + phone/CNIC created
  inline; combined total computed from Umrah + Ticket components),
  `addPayment` (store's overpayment error surfaced as-is),
  `voidPayment` (reason required), `updateDueDate` (may clear to empty),
  `addExpense`. All: `requireAdmin()` first, input validation, return
  `{ ok, error? }` (+ `id` when something was created), `revalidatePath`
  on the dashboard, the module list, the record page, Profit & Loss and
  Customers as applicable. Form field names the record pages should use
  are documented at the top of `createRecord` in the file.
- `app/actions/auth.ts` — `signInAction` (redirects to `/` on success,
  returns the error on failure), `signOutAction` (redirects to `/login`).
- `app/api/chat/route.ts` — POST `{ question }` → `{ answer, refused }`.
  Returns 401 when logged out. Builds the `ChatSnapshot` from live
  records (`getStore()` + `lib/calc.ts`: All Time totals, received /
  expenses today, overdue + due-soon reminder counts, `todayLabel` via
  `formatDate(todayPKT())`) and calls `answerQuestion`. Never writes.
- `scripts/seed.mjs` — dependency-free plain node. Local demo admin
  `admin@demo.local` / `demo1234` (scrypt hash, same as `lib/auth.ts`),
  5 demo customers, one record per type (ticket 100,000, umrah 250,000,
  combined 80,000+20,000, tour "Demo Tour Lahore" 150,000) with payments,
  4 demo expenses. Refuses to run twice unless `--force` (wipes first).
- `scripts/verify-acceptance.mjs` — proves T01–T13 with exact guide §7
  figures (T01 100,000+40,000 → 40,000/60,000; T02 +20,000 → 60,000/
  40,000; T03 reminder appears; T04 full pay → pending 0, reminder gone;
  T05 Umrah partial; T06 80,000+20,000=100,000; T07 +25,000 → 75,000;
  T08 tour; T09 expenses 5,000+2,000; T10 received 60,000, expenses
  15,000 → profit 45,000; T11 pending kept out of profit; T12 chatbot
  expenses + profit answers match live records; T13 delete refused,
  nothing changed) plus the overpayment block and void-exclusion checks.
  Prints PASS/FAIL per test, exits non-zero on any failure.
  It backs up `data/db.json`, tests on a fresh temp DB, and restores it.
  Implementation note: plain `node` type-stripping cannot run the lib —
  its relative imports have no file extension (`./calc`), which Node
  refuses to resolve. The script therefore compiles the REAL `lib/*.ts`
  to CommonJS in a throwaway `.verify-tmp/` dir with the project's own
  `typescript` compiler, requires the compiled output, and deletes the
  temp dir. No logic is duplicated; the tests exercise the real store,
  calc and chatbot. `package.json` needed no change — `npm run verify`
  already points at `scripts/verify-acceptance.mjs`.
- Typecheck: `npx tsc --noEmit` — (result recorded by the backend agent
  at commit time; UI pages did not exist yet, so the build was not run).

## Safe defaults applied (guide §9)

- Overpayments BLOCKED (enforced in `lib/store.ts`, both backends).
- Single admin login, no multi-user roles in v1.
- One next payment date per record.
- Reminders: overdue + due within 7 days, in-system only.
- Payment deletion = VOID with a reason; voided rows excluded from totals.
- PKR only. No data import in v1. No receipt upload in v1.
- Chatbot rule-based, no external AI API / key / cost.
- Excluded: ticket booking, visa processing, hotel/airline, payment gateway.

## Known gaps

- (Coordinator to finalize.)
- Live Supabase end-to-end check still pending (see README).
- T14 screenshot sweep still pending.
- Pages are the UI agent's work — server actions were written against
  the contract's form field names; if the UI uses different names, the
  actions' field readers are the place to reconcile, not the store.
- The local JSON backend is single-file read/write, not transactional
  across tables.
- `data/db.json` is gitignored demo data; never commit it, never put
  real customer data in it.

## Still needed from the user / client

- Repo location (the repo comes later; building locally first).
- Supabase project (URL + anon key + service-role key) when ready to go live.
- Real data import plan (out of scope for v1 — no import built).
- No FBR decisions apply here — this is not an FBR invoicing build.
