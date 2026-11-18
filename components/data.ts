// Shared data-loading helpers for pages (server only).
// Every list/detail page loads through getStore() and joins records with
// customers and payments using withTotals from lib/calc.ts.
import { getStore } from "@/lib/store";
import { withTotals } from "@/lib/calc";
import type {
  Customer,
  Expense,
  FinanceRecord,
  FinanceType,
  Payment,
  RecordWithTotals,
} from "@/lib/types";

export interface LoadedData {
  customers: Customer[];
  records: RecordWithTotals[];
  payments: Payment[];
  expenses: Expense[];
}

export async function loadAll(type?: FinanceType): Promise<LoadedData> {
  const store = getStore();
  const [customers, rawRecords, payments, expenses] = await Promise.all([
    store.listCustomers(),
    store.listRecords(type),
    store.listPayments(),
    store.listExpenses(),
  ]);

  const customersById = new Map<string, Customer>(
    customers.map((c) => [c.id, c] as [string, Customer]),
  );
  const paymentsByRecord = new Map<string, Payment[]>();
  for (const p of payments) {
    const list = paymentsByRecord.get(p.finance_record_id) ?? [];
    list.push(p);
    paymentsByRecord.set(p.finance_record_id, list);
  }

  const records = withTotals(rawRecords, customersById, paymentsByRecord);

  return { customers, records, payments, expenses };
}

/** A record's customer, looked up from the loaded customers list. */
export function findCustomer(
  customers: Customer[],
  record: FinanceRecord,
): Customer | undefined {
  return customers.find((c) => c.id === record.customer_id);
}
