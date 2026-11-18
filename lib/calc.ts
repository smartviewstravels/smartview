// Pure calculation functions (guide §4).
// Every figure in the app comes from these functions applied to source records.
// Nothing is stored as a duplicate total anywhere.
//
//   received = sum of ACTIVE payments only (voided payments excluded)
//   pending  = total_amount - received
//   profit   = total received - total expenses
//   pending is NEVER counted as profit.

import type {
  Customer,
  Expense,
  FinanceRecord,
  FinanceType,
  Payment,
  RecordWithTotals,
  ReminderItem,
  Totals,
} from "./types";
import { FINANCE_TYPES } from "./types";
import { addDays, daysBetween, todayPKT } from "./format";

export function sumActivePayments(payments: Payment[]): number {
  return payments
    .filter((p) => p.status === "active")
    .reduce((sum, p) => sum + p.amount, 0);
}

export function recordReceived(
  record: FinanceRecord,
  payments: Payment[],
): number {
  void record;
  return sumActivePayments(payments);
}

export function recordPending(
  record: FinanceRecord,
  payments: Payment[],
): number {
  return Math.max(0, record.total_amount - sumActivePayments(payments));
}

export function isFullyPaid(
  record: FinanceRecord,
  payments: Payment[],
): boolean {
  return recordPending(record, payments) === 0;
}

/** Join records with customers + payments and attach received/pending. */
export function withTotals(
  records: FinanceRecord[],
  customersById: Map<string, Customer>,
  paymentsByRecord: Map<string, Payment[]>,
): RecordWithTotals[] {
  return records.map((record) => {
    const customer = customersById.get(record.customer_id);
    if (!customer)
      throw new Error(
        `Finance record ${record.id} has no customer (${record.customer_id}).`,
      );
    const payments = (paymentsByRecord.get(record.id) ?? []).slice().sort(
      (a, b) => (a.payment_date < b.payment_date ? 1 : -1),
    );
    return {
      ...record,
      customer,
      payments,
      received: sumActivePayments(payments),
      pending: recordPending(record, payments),
    };
  });
}

export type Period = "today" | "month" | "all";

/** Does a YYYY-MM-DD date fall inside the period (Pakistan calendar)? */
export function inPeriod(dateISO: string, period: Period): boolean {
  if (period === "all") return true;
  const today = todayPKT();
  if (period === "today") return dateISO === today;
  // month: same YYYY-MM as today
  return dateISO.slice(0, 7) === today.slice(0, 7);
}

export const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  month: "This Month",
  all: "All Time",
};

/**
 * Totals for a period. Received and expenses are period-filtered;
 * pending is always the CURRENT outstanding balance (not period-filtered).
 */
export function computeTotals(
  records: RecordWithTotals[],
  allPayments: Payment[],
  expenses: Expense[],
  period: Period,
): Totals {
  const byType = {} as Record<FinanceType, { received: number; pending: number; count: number }>;
  for (const t of FINANCE_TYPES) byType[t] = { received: 0, pending: 0, count: 0 };

  let totalReceived = 0;
  let totalPending = 0;
  for (const r of records) {
    byType[r.type].count += 1;
    byType[r.type].pending += r.pending;
    totalPending += r.pending;
  }
  for (const p of allPayments) {
    if (p.status !== "active") continue;
    if (!inPeriod(p.payment_date, period)) continue;
    totalReceived += p.amount;
    const rec = records.find((r) => r.id === p.finance_record_id);
    if (rec) byType[rec.type].received += p.amount;
  }

  let totalExpenses = 0;
  for (const e of expenses) {
    if (inPeriod(e.expense_date, period)) totalExpenses += e.amount;
  }

  return {
    totalReceived,
    totalPending,
    totalExpenses,
    profit: totalReceived - totalExpenses,
    byType,
  };
}

/**
 * In-system reminders (guide §2): records with an outstanding balance and a
 * due date. Overdue = due date before today. Also includes due within 7 days.
 * Fully-paid records (pending 0) never appear here.
 */
export function getReminders(
  records: RecordWithTotals[],
  today: string = todayPKT(),
): ReminderItem[] {
  const items: ReminderItem[] = [];
  for (const r of records) {
    if (r.pending <= 0) continue;
    if (!r.next_payment_date) continue;
    const dueInDays = daysBetween(today, r.next_payment_date);
    if (r.next_payment_date < today || dueInDays <= 7) {
      items.push({
        record: r,
        customer: r.customer,
        pending: r.pending,
        next_payment_date: r.next_payment_date,
        overdue: r.next_payment_date < today,
        dueInDays,
      });
    }
  }
  items.sort((a, b) =>
    a.next_payment_date < b.next_payment_date ? -1 : 1,
  );
  return items;
}

/** Due date one week from today — used as the default next payment date. */
export function defaultDueDate(): string {
  return addDays(todayPKT(), 7);
}
