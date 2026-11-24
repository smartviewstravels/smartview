// Data layer for Smart View Travel.
//
// Two backends, one interface:
//   - Supabase (real backend) when NEXT_PUBLIC_SUPABASE_URL and
//     SUPABASE_SERVICE_ROLE_KEY are set.
//   - Local JSON file (data/db.json, gitignored) for local dev / demo when
//     Supabase is not configured. Same shapes, same rules, same function
//     names — the app code above this layer never knows which is in use.
//
// SAFE DEFAULT (guide §9): overpayments are BLOCKED. addPayment throws when
// the amount is more than the record's remaining balance. This rule is
// enforced here, in both backends, so no UI path can bypass it.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import type {
  Customer,
  Expense,
  ExpenseCategory,
  FinanceRecord,
  FinanceType,
  Payment,
  PaymentMethod,
  Profile,
} from "./types";
import { sumActivePayments } from "./calc";

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

export interface CreateRecordInput {
  customer_id: string;
  type: FinanceType;
  tour_name?: string | null;
  total_amount: number;
  /** Required when type = 'combined'. */
  umrah_amount?: number | null;
  /** Required when type = 'combined'. */
  ticket_amount?: number | null;
  next_payment_date?: string | null;
}

export interface AddPaymentInput {
  finance_record_id: string;
  amount: number;
  payment_date: string; // YYYY-MM-DD
  method?: PaymentMethod | null;
  reference?: string | null;
  note?: string | null;
}

export interface AddExpenseInput {
  name: string;
  amount: number;
  expense_date: string; // YYYY-MM-DD
  category: ExpenseCategory;
  description?: string | null;
}

export interface Store {
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  createCustomer(data: {
    name: string;
    phone?: string | null;
    cnic_passport?: string | null;
  }): Promise<Customer>;

  listRecords(type?: FinanceType): Promise<FinanceRecord[]>;
  getRecord(id: string): Promise<FinanceRecord | null>;
  createRecord(data: CreateRecordInput): Promise<FinanceRecord>;
  updateRecordDueDate(
    id: string,
    next_payment_date: string | null,
  ): Promise<FinanceRecord>;
  /**
   * Edit a record (correct a wrong entry). Changing the total is
   * refused when the new total is less than the amount already
   * received — that money is real and must be voided first.
   */
  updateRecord(
    id: string,
    data: {
      customer_id?: string;
      tour_name?: string | null;
      total_amount?: number;
      umrah_amount?: number | null;
      ticket_amount?: number | null;
      next_payment_date?: string | null;
    },
  ): Promise<FinanceRecord>;
  /**
   * Delete a record. Refuses when the record has received (active)
   * payments — void those first, so received money never vanishes
   * silently from profit. Voided payments are removed with the record.
   */
  deleteRecord(id: string): Promise<void>;

  listPayments(recordId?: string): Promise<Payment[]>;
  addPayment(data: AddPaymentInput): Promise<Payment>;
  voidPayment(id: string, reason: string): Promise<Payment>;

  listExpenses(): Promise<Expense[]>;
  addExpense(data: AddExpenseInput): Promise<Expense>;
  /** Expenses have no dependents, so delete is unconditional. */
  deleteExpense(id: string): Promise<void>;
  /** Edit an expense (name, amount, date, category, description). */
  updateExpense(id: string, data: AddExpenseInput): Promise<Expense>;

  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  createCustomer(data: {
    name: string;
    phone?: string | null;
    cnic_passport?: string | null;
  }): Promise<Customer>;
  /**
   * Delete a customer. Refuses when the customer still has finance
   * records — delete those first, so no record loses its customer.
   */
  deleteCustomer(id: string): Promise<void>;
  /** Edit a customer (name, phone, CNIC / passport). */
  updateCustomer(
    id: string,
    data: {
      name: string;
      phone?: string | null;
      cnic_passport?: string | null;
    },
  ): Promise<Customer>;

  listProfiles(): Promise<Profile[]>;
}

export function getStore(): Store {
  return isSupabaseConfigured() ? new SupabaseStore() : new LocalStore();
}

// ---------------------------------------------------------------------------
// Local JSON backend (dev / demo only)
// ---------------------------------------------------------------------------

export interface LocalDb {
  customers: Customer[];
  finance_records: FinanceRecord[];
  payments: Payment[];
  expenses: Expense[];
  profiles: Profile[];
  /** Demo admin login for local mode ONLY. Never used with Supabase. */
  local_admin: {
    email: string;
    password_hash: string;
    salt: string;
  } | null;
  sessions: { token: string; created_at: string }[];
}

const LOCAL_DB_PATH = path.join(process.cwd(), "data", "db.json");

export function emptyLocalDb(): LocalDb {
  return {
    customers: [],
    finance_records: [],
    payments: [],
    expenses: [],
    profiles: [],
    local_admin: null,
    sessions: [],
  };
}

export async function readLocalDb(): Promise<LocalDb> {
  try {
    const raw = await fs.readFile(LOCAL_DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<LocalDb>;
    return { ...emptyLocalDb(), ...parsed };
  } catch {
    return emptyLocalDb();
  }
}

export async function writeLocalDb(db: LocalDb): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_DB_PATH), { recursive: true });
  await fs.writeFile(LOCAL_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
}

function nowISO(): string {
  return new Date().toISOString();
}

class LocalStore implements Store {
  async listCustomers(): Promise<Customer[]> {
    const db = await readLocalDb();
    return db.customers
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCustomer(id: string): Promise<Customer | null> {
    const db = await readLocalDb();
    return db.customers.find((c) => c.id === id) ?? null;
  }

  async createCustomer(data: {
    name: string;
    phone?: string | null;
    cnic_passport?: string | null;
  }): Promise<Customer> {
    const db = await readLocalDb();
    const customer: Customer = {
      id: randomUUID(),
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      cnic_passport: data.cnic_passport?.trim() || null,
      created_at: nowISO(),
      updated_at: nowISO(),
    };
    db.customers.push(customer);
    await writeLocalDb(db);
    return customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    const db = await readLocalDb();
    const index = db.customers.findIndex((c) => c.id === id);
    if (index === -1) throw new Error("Customer not found.");
    if (db.finance_records.some((r) => r.customer_id === id)) {
      throw new Error(
        "This customer has finance records. Delete those records first.",
      );
    }
    db.customers.splice(index, 1);
    await writeLocalDb(db);
  }

  async updateCustomer(
    id: string,
    data: {
      name: string;
      phone?: string | null;
      cnic_passport?: string | null;
    },
  ): Promise<Customer> {
    const db = await readLocalDb();
    const customer = db.customers.find((c) => c.id === id);
    if (!customer) throw new Error("Customer not found.");
    customer.name = data.name.trim();
    customer.phone = data.phone?.trim() || null;
    customer.cnic_passport = data.cnic_passport?.trim() || null;
    customer.updated_at = nowISO();
    await writeLocalDb(db);
    return customer;
  }

  async listRecords(type?: FinanceType): Promise<FinanceRecord[]> {
    const db = await readLocalDb();
    const rows = type
      ? db.finance_records.filter((r) => r.type === type)
      : db.finance_records;
    return rows
      .slice()
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }

  async getRecord(id: string): Promise<FinanceRecord | null> {
    const db = await readLocalDb();
    return db.finance_records.find((r) => r.id === id) ?? null;
  }

  async createRecord(data: CreateRecordInput): Promise<FinanceRecord> {
    const db = await readLocalDb();
    const record = buildRecord(data);
    db.finance_records.push(record);
    await writeLocalDb(db);
    return record;
  }

  async updateRecordDueDate(
    id: string,
    next_payment_date: string | null,
  ): Promise<FinanceRecord> {
    const db = await readLocalDb();
    const record = db.finance_records.find((r) => r.id === id);
    if (!record) throw new Error("Record not found.");
    record.next_payment_date = next_payment_date || null;
    record.updated_at = nowISO();
    await writeLocalDb(db);
    return record;
  }

  async deleteRecord(id: string): Promise<void> {
    const db = await readLocalDb();
    const index = db.finance_records.findIndex((r) => r.id === id);
    if (index === -1) throw new Error("Record not found.");
    const payments = db.payments.filter((p) => p.finance_record_id === id);
    if (sumActivePayments(payments) > 0) {
      throw new Error(
        "This record has received payments. Void the payments first, then delete the record.",
      );
    }
    // Only voided payments can remain — remove them with the record.
    db.payments = db.payments.filter((p) => p.finance_record_id !== id);
    db.finance_records.splice(index, 1);
    await writeLocalDb(db);
  }

  async updateRecord(
    id: string,
    data: {
      customer_id?: string;
      tour_name?: string | null;
      total_amount?: number;
      umrah_amount?: number | null;
      ticket_amount?: number | null;
      next_payment_date?: string | null;
    },
  ): Promise<FinanceRecord> {
    const db = await readLocalDb();
    const record = db.finance_records.find((r) => r.id === id);
    if (!record) throw new Error("Record not found.");
    const payments = db.payments.filter((p) => p.finance_record_id === id);
    const received = sumActivePayments(payments);
    let total = record.total_amount;
    if (record.type === "combined") {
      const umrah = data.umrah_amount ?? record.umrah_amount ?? 0;
      const ticket = data.ticket_amount ?? record.ticket_amount ?? 0;
      if (umrah < 0 || ticket < 0)
        throw new Error("Amounts cannot be negative.");
      total = umrah + ticket;
      if (total <= 0)
        throw new Error("Combined total must be more than zero.");
      record.umrah_amount = umrah;
      record.ticket_amount = ticket;
    } else if (data.total_amount !== undefined) {
      if (data.total_amount <= 0)
        throw new Error("Total amount must be more than zero.");
      total = data.total_amount;
    }
    if (total < received) {
      throw new Error(
        `Total cannot be less than the amount already received (PKR ${Math.round(received).toLocaleString("en-PK")}). Void a payment first if the total is wrong.`,
      );
    }
    record.total_amount = total;
    if (data.customer_id) record.customer_id = data.customer_id;
    if (data.tour_name !== undefined)
      record.tour_name = data.tour_name?.trim() || null;
    if (data.next_payment_date !== undefined)
      record.next_payment_date = data.next_payment_date || null;
    record.updated_at = nowISO();
    syncRecordStatus(db, record);
    await writeLocalDb(db);
    return record;
  }

  async listPayments(recordId?: string): Promise<Payment[]> {
    const db = await readLocalDb();
    const rows = recordId
      ? db.payments.filter((p) => p.finance_record_id === recordId)
      : db.payments;
    return rows
      .slice()
      .sort((a, b) =>
        a.payment_date === b.payment_date
          ? a.created_at < b.created_at
            ? 1
            : -1
          : a.payment_date < b.payment_date
            ? 1
            : -1,
      );
  }

  async addPayment(data: AddPaymentInput): Promise<Payment> {
    const db = await readLocalDb();
    const record = db.finance_records.find(
      (r) => r.id === data.finance_record_id,
    );
    if (!record) throw new Error("Record not found.");
    const existing = db.payments.filter(
      (p) => p.finance_record_id === record.id,
    );
    assertPaymentAllowed(record, existing, data.amount);
    const payment: Payment = {
      id: randomUUID(),
      finance_record_id: record.id,
      amount: data.amount,
      payment_date: data.payment_date,
      method: data.method ?? null,
      reference: data.reference?.trim() || null,
      note: data.note?.trim() || null,
      status: "active",
      void_reason: null,
      voided_at: null,
      created_at: nowISO(),
    };
    db.payments.push(payment);
    syncRecordStatus(db, record);
    await writeLocalDb(db);
    return payment;
  }

  async voidPayment(id: string, reason: string): Promise<Payment> {
    const db = await readLocalDb();
    const payment = db.payments.find((p) => p.id === id);
    if (!payment) throw new Error("Payment not found.");
    if (payment.status === "voided")
      throw new Error("This payment is already voided.");
    if (!reason.trim()) throw new Error("A reason is required to void a payment.");
    payment.status = "voided";
    payment.void_reason = reason.trim();
    payment.voided_at = nowISO();
    const record = db.finance_records.find(
      (r) => r.id === payment.finance_record_id,
    );
    if (record) syncRecordStatus(db, record);
    await writeLocalDb(db);
    return payment;
  }

  async listExpenses(): Promise<Expense[]> {
    const db = await readLocalDb();
    return db.expenses
      .slice()
      .sort((a, b) =>
        a.expense_date === b.expense_date
          ? a.created_at < b.created_at
            ? 1
            : -1
          : a.expense_date < b.expense_date
            ? 1
            : -1,
      );
  }

  async addExpense(data: AddExpenseInput): Promise<Expense> {
    const db = await readLocalDb();
    const expense: Expense = {
      id: randomUUID(),
      name: data.name.trim(),
      amount: data.amount,
      expense_date: data.expense_date,
      category: data.category,
      description: data.description?.trim() || null,
      created_at: nowISO(),
    };
    db.expenses.push(expense);
    await writeLocalDb(db);
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    const db = await readLocalDb();
    const index = db.expenses.findIndex((e) => e.id === id);
    if (index === -1) throw new Error("Expense not found.");
    db.expenses.splice(index, 1);
    await writeLocalDb(db);
  }

  async updateExpense(id: string, data: AddExpenseInput): Promise<Expense> {
    const db = await readLocalDb();
    const expense = db.expenses.find((e) => e.id === id);
    if (!expense) throw new Error("Expense not found.");
    expense.name = data.name.trim();
    expense.amount = data.amount;
    expense.expense_date = data.expense_date;
    expense.category = data.category;
    expense.description = data.description?.trim() || null;
    await writeLocalDb(db);
    return expense;
  }

  async listProfiles(): Promise<Profile[]> {
    const db = await readLocalDb();
    return db.profiles.slice();
  }
}

/** Keep finance_records.status in step with the balance: 'paid' when the
 *  remaining balance is zero, 'open' otherwise (e.g. after a void). */
function syncRecordStatus(db: LocalDb, record: FinanceRecord): void {
  const payments = db.payments.filter(
    (p) => p.finance_record_id === record.id,
  );
  const remaining = record.total_amount - sumActivePayments(payments);
  record.status = remaining === 0 ? "paid" : "open";
  record.updated_at = nowISO();
}

/** Shared record-building + validation used by both backends. */
function buildRecord(data: CreateRecordInput): FinanceRecord {
  if (!data.customer_id) throw new Error("Customer is required.");
  if (data.type === "tour" && !data.tour_name?.trim())
    throw new Error("Tour / city name is required.");
  if (data.type === "combined") {
    const umrah = data.umrah_amount ?? 0;
    const ticket = data.ticket_amount ?? 0;
    if (umrah < 0 || ticket < 0)
      throw new Error("Amounts cannot be negative.");
    if (umrah + ticket <= 0)
      throw new Error("Combined total must be more than zero.");
    return {
      id: randomUUID(),
      customer_id: data.customer_id,
      type: "combined",
      tour_name: null,
      total_amount: umrah + ticket,
      umrah_amount: umrah,
      ticket_amount: ticket,
      next_payment_date: data.next_payment_date || null,
      status: "open",
      created_at: nowISO(),
      updated_at: nowISO(),
    };
  }
  if (data.total_amount < 0)
    throw new Error("Total amount cannot be negative.");
  return {
    id: randomUUID(),
    customer_id: data.customer_id,
    type: data.type,
    tour_name: data.type === "tour" ? data.tour_name!.trim() : null,
    total_amount: data.total_amount,
    umrah_amount: null,
    ticket_amount: null,
    next_payment_date: data.next_payment_date || null,
    status: "open",
    created_at: nowISO(),
    updated_at: nowISO(),
  };
}

/** Overpayment rule: a payment may never exceed the remaining balance. */
function assertPaymentAllowed(
  record: FinanceRecord,
  existing: Payment[],
  amount: number,
): void {
  if (!Number.isFinite(amount) || amount <= 0)
    throw new Error("Payment amount must be more than zero.");
  const remaining =
    record.total_amount - sumActivePayments(existing);
  if (amount > remaining) {
    throw new Error(
      `Payment of PKR ${Math.round(amount).toLocaleString("en-PK")} is more than the remaining balance of PKR ${Math.round(remaining).toLocaleString("en-PK")}. Overpayments are blocked.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Supabase backend (real backend)
// ---------------------------------------------------------------------------

function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Supabase is not configured (missing env values).");
  return createClient(url, key, { auth: { persistSession: false } });
}

class SupabaseStore implements Store {
  async listCustomers(): Promise<Customer[]> {
    const { data, error } = await supabaseAdmin()
      .from("customers")
      .select("*")
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as Customer[];
  }

  async getCustomer(id: string): Promise<Customer | null> {
    const { data, error } = await supabaseAdmin()
      .from("customers")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Customer | null) ?? null;
  }

  async createCustomer(data: {
    name: string;
    phone?: string | null;
    cnic_passport?: string | null;
  }): Promise<Customer> {
    const { data: row, error } = await supabaseAdmin()
      .from("customers")
      .insert({
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        cnic_passport: data.cnic_passport?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Customer;
  }

  async deleteCustomer(id: string): Promise<void> {
    const sb = supabaseAdmin();
    const customer = await this.getCustomer(id);
    if (!customer) throw new Error("Customer not found.");
    const { data: records, error: readError } = await sb
      .from("finance_records")
      .select("id")
      .eq("customer_id", id)
      .limit(1);
    if (readError) throw new Error(readError.message);
    if ((records ?? []).length > 0) {
      throw new Error(
        "This customer has finance records. Delete those records first.",
      );
    }
    const { error } = await sb.from("customers").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateCustomer(
    id: string,
    data: {
      name: string;
      phone?: string | null;
      cnic_passport?: string | null;
    },
  ): Promise<Customer> {
    const { data: row, error } = await supabaseAdmin()
      .from("customers")
      .update({
        name: data.name.trim(),
        phone: data.phone?.trim() || null,
        cnic_passport: data.cnic_passport?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Customer;
  }

  async listRecords(type?: FinanceType): Promise<FinanceRecord[]> {
    let q = supabaseAdmin()
      .from("finance_records")
      .select("*")
      .order("created_at", { ascending: false });
    if (type) q = q.eq("type", type);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as FinanceRecord[];
  }

  async getRecord(id: string): Promise<FinanceRecord | null> {
    const { data, error } = await supabaseAdmin()
      .from("finance_records")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as FinanceRecord | null) ?? null;
  }

  async createRecord(data: CreateRecordInput): Promise<FinanceRecord> {
    // Reuse the same validation + combined-total rule as local mode.
    const built = buildRecord(data);
    const { id, created_at, updated_at, ...insert } = built;
    void id;
    void created_at;
    void updated_at;
    const { data: row, error } = await supabaseAdmin()
      .from("finance_records")
      .insert(insert)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as FinanceRecord;
  }

  async updateRecordDueDate(
    id: string,
    next_payment_date: string | null,
  ): Promise<FinanceRecord> {
    const { data: row, error } = await supabaseAdmin()
      .from("finance_records")
      .update({
        next_payment_date: next_payment_date || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as FinanceRecord;
  }

  async deleteRecord(id: string): Promise<void> {
    const sb = supabaseAdmin();
    const record = await this.getRecord(id);
    if (!record) throw new Error("Record not found.");
    const payments = await this.listPayments(id);
    if (sumActivePayments(payments) > 0) {
      throw new Error(
        "This record has received payments. Void the payments first, then delete the record.",
      );
    }
    // Only voided payments can remain — remove them first, then the
    // record (no reliance on a DB cascade).
    const { error: payError } = await sb
      .from("payments")
      .delete()
      .eq("finance_record_id", id);
    if (payError) throw new Error(payError.message);
    const { error } = await sb.from("finance_records").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateRecord(
    id: string,
    data: {
      customer_id?: string;
      tour_name?: string | null;
      total_amount?: number;
      umrah_amount?: number | null;
      ticket_amount?: number | null;
      next_payment_date?: string | null;
    },
  ): Promise<FinanceRecord> {
    const record = await this.getRecord(id);
    if (!record) throw new Error("Record not found.");
    const payments = await this.listPayments(id);
    const received = sumActivePayments(payments);
    let total = record.total_amount;
    const patch: Record<string, unknown> = {};
    if (record.type === "combined") {
      const umrah = data.umrah_amount ?? record.umrah_amount ?? 0;
      const ticket = data.ticket_amount ?? record.ticket_amount ?? 0;
      if (umrah < 0 || ticket < 0)
        throw new Error("Amounts cannot be negative.");
      total = umrah + ticket;
      if (total <= 0)
        throw new Error("Combined total must be more than zero.");
      patch.umrah_amount = umrah;
      patch.ticket_amount = ticket;
    } else if (data.total_amount !== undefined) {
      if (data.total_amount <= 0)
        throw new Error("Total amount must be more than zero.");
      total = data.total_amount;
    }
    if (total < received) {
      throw new Error(
        `Total cannot be less than the amount already received (PKR ${Math.round(received).toLocaleString("en-PK")}). Void a payment first if the total is wrong.`,
      );
    }
    patch.total_amount = total;
    if (data.customer_id) patch.customer_id = data.customer_id;
    if (data.tour_name !== undefined)
      patch.tour_name = data.tour_name?.trim() || null;
    if (data.next_payment_date !== undefined)
      patch.next_payment_date = data.next_payment_date || null;
    patch.updated_at = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin()
      .from("finance_records")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await this.syncStatus(id);
    return (await this.getRecord(id)) ?? (row as FinanceRecord);
  }

  async listPayments(recordId?: string): Promise<Payment[]> {
    let q = supabaseAdmin()
      .from("payments")
      .select("*")
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (recordId) q = q.eq("finance_record_id", recordId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as Payment[];
  }

  async addPayment(data: AddPaymentInput): Promise<Payment> {
    const sb = supabaseAdmin();
    const record = await this.getRecord(data.finance_record_id);
    if (!record) throw new Error("Record not found.");
    const existing = await this.listPayments(record.id);
    assertPaymentAllowed(record, existing, data.amount);
    const { data: row, error } = await sb
      .from("payments")
      .insert({
        finance_record_id: record.id,
        amount: data.amount,
        payment_date: data.payment_date,
        method: data.method ?? null,
        reference: data.reference?.trim() || null,
        note: data.note?.trim() || null,
        status: "active",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await this.syncStatus(record.id);
    return row as Payment;
  }

  async voidPayment(id: string, reason: string): Promise<Payment> {
    if (!reason.trim())
      throw new Error("A reason is required to void a payment.");
    const { data: existing, error: readError } = await supabaseAdmin()
      .from("payments")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) throw new Error("Payment not found.");
    if ((existing as Payment).status === "voided")
      throw new Error("This payment is already voided.");
    const { data: row, error } = await supabaseAdmin()
      .from("payments")
      .update({
        status: "voided",
        void_reason: reason.trim(),
        voided_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await this.syncStatus((row as Payment).finance_record_id);
    return row as Payment;
  }

  /** 'paid' when the remaining balance is zero, 'open' otherwise. */
  private async syncStatus(recordId: string): Promise<void> {
    const record = await this.getRecord(recordId);
    if (!record) return;
    const payments = await this.listPayments(recordId);
    const remaining = record.total_amount - sumActivePayments(payments);
    const { error } = await supabaseAdmin()
      .from("finance_records")
      .update({
        status: remaining === 0 ? "paid" : "open",
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId);
    if (error) throw new Error(error.message);
  }

  async listExpenses(): Promise<Expense[]> {
    const { data, error } = await supabaseAdmin()
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Expense[];
  }

  async addExpense(data: AddExpenseInput): Promise<Expense> {
    const { data: row, error } = await supabaseAdmin()
      .from("expenses")
      .insert({
        name: data.name.trim(),
        amount: data.amount,
        expense_date: data.expense_date,
        category: data.category,
        description: data.description?.trim() || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Expense;
  }

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabaseAdmin()
      .from("expenses")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateExpense(id: string, data: AddExpenseInput): Promise<Expense> {
    const { data: row, error } = await supabaseAdmin()
      .from("expenses")
      .update({
        name: data.name.trim(),
        amount: data.amount,
        expense_date: data.expense_date,
        category: data.category,
        description: data.description?.trim() || null,
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Expense;
  }

  async listProfiles(): Promise<Profile[]> {
    const { data, error } = await supabaseAdmin()
      .from("profiles")
      .select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as Profile[];
  }
}
