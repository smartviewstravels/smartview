// Acceptance script — proves guide §7 tests T01–T13 (T14 is the
// screenshot sweep, not this script) against the LOCAL store.
//
//   npm run verify
//
// How it works (and why it is shaped this way):
// - It runs against a FRESH temp database: the real data/db.json is moved
//   aside first and restored afterwards (in a finally block), so running
//   this never touches real/demo data.
// - The lib is TypeScript with extensionless relative imports, which plain
//   `node` type-stripping cannot resolve (Node 24: "Cannot find module
//   './calc'"). So the script compiles the REAL lib/*.ts files to
//   CommonJS in a throwaway .verify-tmp/ dir inside the repo (so
//   @supabase/supabase-js still resolves from node_modules) with the
//   project's own typescript compiler, requires the compiled output, and
//   deletes the temp dir afterwards. No logic is duplicated — the tests
//   exercise the real store, calc and chatbot code.
// - Supabase env vars are deleted up front so getStore() always picks the
//   local JSON backend, even if .env.local is configured.
//
// Prints PASS/FAIL per test and exits non-zero on any failure.

import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";
import { createRequire } from "module";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DB_PATH = path.join(ROOT, "data", "db.json");
const BACKUP_PATH = path.join(ROOT, "data", "db.json.verify-backup");
const TMP_DIR = path.join(ROOT, ".verify-tmp");
const OUT_DIR = path.join(TMP_DIR, "out");
const TSC = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");

let failures = 0;
let passes = 0;

function check(name, actual, expected) {
  if (Object.is(actual, expected)) {
    passes += 1;
    console.log(`PASS ${name} — ${actual}`);
  } else {
    failures += 1;
    console.log(`FAIL ${name} — expected ${expected}, got ${actual}`);
  }
}

async function expectThrow(name, fn, snippet) {
  try {
    await fn();
    failures += 1;
    console.log(`FAIL ${name} — expected an error, but it succeeded`);
  } catch (err) {
    if (snippet && !String(err.message).includes(snippet)) {
      failures += 1;
      console.log(`FAIL ${name} — error did not mention "${snippet}": ${err.message}`);
    } else {
      passes += 1;
      console.log(`PASS ${name} — threw: ${err.message}`);
    }
  }
}

async function resetDb() {
  await fs.rm(DB_PATH, { force: true });
}

async function restoreDb(hadBackup) {
  await fs.rm(TMP_DIR, { recursive: true, force: true });
  await fs.rm(DB_PATH, { force: true });
  if (hadBackup) await fs.rename(BACKUP_PATH, DB_PATH);
}

async function main() {
  process.chdir(ROOT);
  // Local backend only — never touch a configured Supabase project.
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  let hadBackup = false;
  try {
    await fs.access(BACKUP_PATH);
    console.error(
      "Leftover data/db.json.verify-backup found from a crashed run. " +
        "Restore or delete it manually, then re-run.",
    );
    process.exit(1);
  } catch {
    // No leftover backup — good.
  }
  try {
    await fs.access(DB_PATH);
    await fs.rename(DB_PATH, BACKUP_PATH);
    hadBackup = true;
    console.log("Backed up data/db.json — it will be restored after the run.");
  } catch {
    hadBackup = false;
  }

  try {
    // Compile the REAL lib to CommonJS in a temp dir, then require it.
    execFileSync(
      process.execPath,
      [
        TSC,
        "lib/store.ts",
        "lib/calc.ts",
        "lib/chatbot.ts",
        "lib/format.ts",
        "lib/types.ts",
        "--module",
        "commonjs",
        "--target",
        "es2022",
        "--esModuleInterop",
        "--skipLibCheck",
        "--outDir",
        OUT_DIR,
      ],
      { cwd: ROOT, stdio: "pipe" },
    );
    const require = createRequire(import.meta.url);
    const storeLib = require(path.join(OUT_DIR, "store.js"));
    const calc = require(path.join(OUT_DIR, "calc.js"));
    const chatbot = require(path.join(OUT_DIR, "chatbot.js"));
    const format = require(path.join(OUT_DIR, "format.js"));
    const { getStore, readLocalDb } = storeLib;
    const { computeTotals, getReminders, recordPending, sumActivePayments, withTotals } = calc;
    const { answerQuestion } = chatbot;
    const { formatPKR, todayPKT, addDays } = format;

    const store = getStore();
    const today = todayPKT();

    async function figures(recordId) {
      const record = await store.getRecord(recordId);
      const payments = await store.listPayments(recordId);
      return { record, payments, received: sumActivePayments(payments), pending: recordPending(record, payments) };
    }

    async function snapshot() {
      const [records, customers, payments, expenses] = await Promise.all([
        store.listRecords(),
        store.listCustomers(),
        store.listPayments(),
        store.listExpenses(),
      ]);
      const customersById = new Map(customers.map((c) => [c.id, c]));
      const paymentsByRecord = new Map();
      for (const p of payments) {
        const list = paymentsByRecord.get(p.finance_record_id) ?? [];
        list.push(p);
        paymentsByRecord.set(p.finance_record_id, list);
      }
      const withT = withTotals(records, customersById, paymentsByRecord);
      return {
        records, customers, payments, expenses, withTotals: withT,
        totalsAll: computeTotals(withT, payments, expenses, "all"),
        totalsToday: computeTotals(withT, payments, expenses, "today"),
        reminders: getReminders(withT),
      };
    }

    function chatSnapshot(snap) {
      return {
        totalPending: snap.totalsAll.totalPending,
        totalReceived: snap.totalsAll.totalReceived,
        totalExpenses: snap.totalsAll.totalExpenses,
        profit: snap.totalsAll.profit,
        receivedToday: snap.totalsToday.totalReceived,
        expensesToday: snap.totalsToday.totalExpenses,
        remindersOverdue: snap.reminders.filter((r) => r.overdue).length,
        remindersDueSoon: snap.reminders.filter((r) => !r.overdue).length,
        todayLabel: format.formatDate(today),
      };
    }

    // ---- Phase A: T01–T09, T12, T13, overpayment + void ----
    await resetDb();

    // T01 — ticket 100,000 + 40,000 -> received 40,000, pending 60,000.
    const custA = await store.createCustomer({ name: "Demo Verify Ahmed", phone: "0300-0000000" });
    const ticket = await store.createRecord({
      customer_id: custA.id, type: "ticket", total_amount: 100000,
      next_payment_date: addDays(today, 3),
    });
    await store.addPayment({ finance_record_id: ticket.id, amount: 40000, payment_date: today, method: "Cash" });
    let f = await figures(ticket.id);
    check("T01 ticket received", f.received, 40000);
    check("T01 ticket pending", f.pending, 60000);

    // T02 — +20,000 -> received 60,000, pending 40,000.
    await store.addPayment({ finance_record_id: ticket.id, amount: 20000, payment_date: today, method: "Cash" });
    f = await figures(ticket.id);
    check("T02 ticket received", f.received, 60000);
    check("T02 ticket pending", f.pending, 40000);

    // Overpayment block — 50,000 against 40,000 remaining must throw.
    await expectThrow(
      "Overpayment blocked",
      () => store.addPayment({ finance_record_id: ticket.id, amount: 50000, payment_date: today, method: "Cash" }),
      "Overpayments are blocked",
    );
    f = await figures(ticket.id);
    check("Overpayment changed nothing (pending)", f.pending, 40000);

    // Void — voided payment excluded from totals.
    const custVoid = await store.createCustomer({ name: "Demo Verify Void", phone: "0300-0000000" });
    const voidRec = await store.createRecord({ customer_id: custVoid.id, type: "ticket", total_amount: 50000 });
    const voidPay = await store.addPayment({ finance_record_id: voidRec.id, amount: 20000, payment_date: today, method: "Cash" });
    await store.voidPayment(voidPay.id, "Test void — wrong amount entered.");
    f = await figures(voidRec.id);
    check("Void excluded from received", f.received, 0);
    check("Void restores pending", f.pending, 50000);
    const voidedRow = (await store.listPayments(voidRec.id)).find((p) => p.id === voidPay.id);
    check("Voided row kept with status voided", voidedRow.status, "voided");

    // T03 — due date + balance -> in reminders.
    let snap = await snapshot();
    check(
      "T03 ticket in reminders (due in 3 days)",
      snap.reminders.some((r) => r.record.id === ticket.id),
      true,
    );

    // T04 — full payment -> pending 0, reminder gone.
    await store.addPayment({ finance_record_id: ticket.id, amount: 40000, payment_date: today, method: "Cash" });
    f = await figures(ticket.id);
    check("T04 ticket pending after full payment", f.pending, 0);
    snap = await snapshot();
    check(
      "T04 ticket gone from reminders",
      snap.reminders.some((r) => r.record.id === ticket.id),
      false,
    );

    // T05 — Umrah partial: 250,000 - 100,000 = 150,000 pending.
    const custB = await store.createCustomer({ name: "Demo Verify Bilal", phone: "0300-0000000" });
    const umrah = await store.createRecord({ customer_id: custB.id, type: "umrah", total_amount: 250000 });
    await store.addPayment({ finance_record_id: umrah.id, amount: 100000, payment_date: today, method: "Bank Transfer" });
    f = await figures(umrah.id);
    check("T05 umrah pending", f.pending, 150000);

    // T06 — combined 80,000 + 20,000 = 100,000.
    const custC = await store.createCustomer({ name: "Demo Verify Sana", phone: "0300-0000000" });
    const combined = await store.createRecord({
      customer_id: custC.id, type: "combined", total_amount: 100000,
      umrah_amount: 80000, ticket_amount: 20000,
    });
    check("T06 combined total", combined.total_amount, 100000);
    check("T06 combined umrah component", combined.umrah_amount, 80000);
    check("T06 combined ticket component", combined.ticket_amount, 20000);

    // T07 — combined +25,000 -> remaining 75,000.
    await store.addPayment({ finance_record_id: combined.id, amount: 25000, payment_date: today, method: "Cash" });
    f = await figures(combined.id);
    check("T07 combined pending", f.pending, 75000);

    // T08 — tour payment updates pending: 150,000 - 50,000 = 100,000.
    const custD = await store.createCustomer({ name: "Demo Verify Usman", phone: "0300-0000000" });
    const tour = await store.createRecord({
      customer_id: custD.id, type: "tour", tour_name: "Demo Tour Lahore", total_amount: 150000,
    });
    await store.addPayment({ finance_record_id: tour.id, amount: 50000, payment_date: today, method: "Bank Transfer" });
    f = await figures(tour.id);
    check("T08 tour pending", f.pending, 100000);

    // T09 — expenses 5,000 + 2,000 -> +7,000 total expenses.
    await store.addExpense({ name: "Demo Office", amount: 5000, expense_date: today, category: "Office" });
    await store.addExpense({ name: "Demo Transport", amount: 2000, expense_date: today, category: "Transport" });
    snap = await snapshot();
    check("T09 total expenses", snap.totalsAll.totalExpenses, 7000);

    // T12 — chatbot answers for expenses + profit match live records.
    const chatSnap = chatSnapshot(snap);
    const expAns = answerQuestion("What are the total expenses?", chatSnap);
    check("T12 chatbot not refused (expenses)", expAns.refused, false);
    check("T12 chatbot expenses figure", expAns.answer.includes(formatPKR(7000)), true);
    const profitAns = answerQuestion("What is the current profit?", chatSnap);
    check("T12 chatbot not refused (profit)", profitAns.refused, false);
    check("T12 chatbot profit figure", profitAns.answer.includes(formatPKR(snap.totalsAll.profit)), true);

    // T13 — delete refused, nothing changed.
    const before = JSON.stringify(await readLocalDb());
    const delAns = answerQuestion("delete this payment", chatSnap);
    check("T13 chatbot refuses delete", delAns.refused, true);
    const after = JSON.stringify(await readLocalDb());
    check("T13 nothing changed after refused delete", after === before, true);

    // ---- Phase B: T10 + T11 on a fresh db (exact figures) ----
    await resetDb();
    const custE = await store.createCustomer({ name: "Demo Verify Profit", phone: "0300-0000000" });
    const profitRec = await store.createRecord({ customer_id: custE.id, type: "ticket", total_amount: 100000 });
    await store.addPayment({ finance_record_id: profitRec.id, amount: 60000, payment_date: today, method: "Cash" });
    await store.addExpense({ name: "Demo Expense A", amount: 10000, expense_date: today, category: "Office" });
    await store.addExpense({ name: "Demo Expense B", amount: 5000, expense_date: today, category: "Transport" });
    const snapB = await snapshot();
    check("T10 total received", snapB.totalsAll.totalReceived, 60000);
    check("T10 total expenses", snapB.totalsAll.totalExpenses, 15000);
    check("T10 profit (60,000 - 15,000)", snapB.totalsAll.profit, 45000);
    // T11 — pending shown separately, NOT counted as profit.
    check("T11 pending kept separate", snapB.totalsAll.totalPending, 40000);
    check(
      "T11 profit excludes pending",
      snapB.totalsAll.profit,
      snapB.totalsAll.totalReceived - snapB.totalsAll.totalExpenses,
    );
  } finally {
    await restoreDb(hadBackup);
  }

  console.log(`\n${passes} passed, ${failures} failed.`);
  if (failures > 0) {
    console.log("ACCEPTANCE FAILED — T01–T13 not all green.");
    process.exit(1);
  }
  console.log("ACCEPTANCE PASSED — T01–T13 green (T14 is the screenshot sweep).");
}

main().catch((err) => {
  console.error("Verify crashed:", err);
  process.exit(1);
});
