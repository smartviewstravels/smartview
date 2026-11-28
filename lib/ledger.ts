// Ledger data builder for the customer account statement (guide §5).
// Pure data only: takes the customer's records + payments and returns
// the rows a statement / ledger printout shows. No figures are stored
// here — every amount comes from the source records, so the ledger
// always agrees with the dashboard figures (lib/calc.ts).
//
//   charge  = one finance record, debit = total_amount
//   payment = one ACTIVE payment, credit = amount (voided excluded,
//             exactly as sumActivePayments in lib/calc.ts)
//   balance = previous balance + debit - credit, running down the rows
//
// Opening balance is 0 for this all-time statement: the ledger covers
// every record the customer ever had, so there is nothing before it.
// Rate is "1.00" on every row — Smart View stores no rate anywhere and
// PKR is the base currency, so no other rate is ever invented.

import type { Customer, Payment, RecordWithTotals } from "./types";
import { FINANCE_TYPE_LABELS } from "./types";

export interface LedgerRow {
  /** YYYY-MM-DD */
  date: string;
  type: string;
  transNo: string;
  particulars: string;
  invRef: string;
  rate: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface LedgerData {
  accountCode: string;
  accountTitle: string;
  balance: number;
  /** YYYY-MM-DD */
  periodFrom: string;
  /** YYYY-MM-DD */
  periodTo: string;
  /** YYYY-MM-DD */
  printDate: string;
  currency: string;
  /** First row is always the Previous Balance row. */
  rows: LedgerRow[];
  totalDebit: number;
  totalCredit: number;
}

/** Tie-break for same-day rows: charges come before payments, then by id.
 *  Dates alone can't order a charge and a payment made the same day, so
 *  this rule keeps the order deterministic (a charge first, then the
 *  payment against it) and stable across runs. */
type LedgerEntry = Omit<LedgerRow, "balance"> & { kind: "charge" | "payment" };

function compareEntries(a: LedgerEntry, b: LedgerEntry): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === "charge" ? -1 : 1;
  if (a.transNo !== b.transNo) return a.transNo < b.transNo ? -1 : 1;
  return 0;
}

export function buildLedger(
  customer: Customer,
  myRecords: RecordWithTotals[],
  allPayments: Payment[],
  statementDateISO: string,
): LedgerData {
  const entries: LedgerEntry[] = [];

  // One charge row per finance record.
  for (const record of myRecords) {
    const label = FINANCE_TYPE_LABELS[record.type];
    const particulars =
      record.type === "tour" && record.tour_name
        ? `${label} (${record.tour_name})`
        : label;
    entries.push({
      date: record.created_at.slice(0, 10),
      type: label,
      transNo: record.id.slice(0, 8),
      particulars,
      invRef: "",
      rate: "1.00",
      debit: record.total_amount,
      credit: 0,
      kind: "charge",
    });
  }

  // One credit row per ACTIVE payment. Voided payments are excluded
  // entirely — same rule as sumActivePayments in lib/calc.ts, so the
  // ledger's totalCredit always equals the sum of received.
  const recordIds = new Set(myRecords.map((r) => r.id));
  for (const payment of allPayments) {
    if (payment.status !== "active") continue;
    if (!recordIds.has(payment.finance_record_id)) continue;
    const type = payment.method ? `Payment — ${payment.method}` : "Payment";
    const particulars = [payment.method, payment.note]
      .filter((part): part is string => !!part)
      .join(" — ");
    entries.push({
      date: payment.payment_date,
      type,
      transNo: payment.id.slice(0, 8),
      particulars,
      invRef: payment.reference ?? "",
      rate: "1.00",
      debit: 0,
      credit: payment.amount,
      kind: "payment",
    });
  }

  entries.sort(compareEntries);

  const periodFrom =
    entries.length > 0 ? entries[0].date : statementDateISO;

  // Previous Balance row first, then the running balance down the rows.
  const rows: LedgerRow[] = [
    {
      date: periodFrom,
      type: "—",
      transNo: "—",
      particulars: "Previous Balance",
      invRef: "",
      rate: "1.00",
      debit: 0,
      credit: 0,
      balance: 0,
    },
  ];

  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;
  for (const entry of entries) {
    totalDebit += entry.debit;
    totalCredit += entry.credit;
    running += entry.debit - entry.credit;
    const { kind: _kind, ...row } = entry;
    rows.push({ ...row, balance: running });
  }

  return {
    // Customers have no account-code field, so the id prefix is used.
    accountCode: customer.id.slice(0, 8),
    accountTitle: customer.name,
    balance: running,
    periodFrom,
    periodTo: statementDateISO,
    printDate: statementDateISO,
    currency: "PKR",
    rows,
    totalDebit,
    totalCredit,
  };
}
