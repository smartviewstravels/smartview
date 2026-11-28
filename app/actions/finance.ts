'use server';

// Server actions for Smart View Travel.
// Every action: requireAdmin() first, validate inputs, return
// { ok, error? } (never throw user-facing errors), revalidatePath the
// affected pages. Overpayment blocking lives in the store — its error
// message is surfaced unchanged.

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getStore } from "@/lib/store";
import { requireAdmin } from "@/lib/auth";
import { todayPKT } from "@/lib/format";
import {
  EXPENSE_CATEGORIES,
  FINANCE_TYPES,
  PAYMENT_METHODS,
  type ExpenseCategory,
  type FinanceType,
  type PaymentMethod,
} from "@/lib/types";

export interface ActionResult {
  ok: boolean;
  error?: string;
  /** Id of the created record/customer/payment, when one was created. */
  id?: string;
}

function fail(error: string): ActionResult {
  return { ok: false, error };
}

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function num(formData: FormData, key: string): number {
  return Number(str(formData, key));
}

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T12:00:00");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Revalidate every page that shows this record type. */
function revalidateRecordPages(type: FinanceType, recordId?: string): void {
  const listPath =
    type === "ticket"
      ? "/tickets"
      : type === "umrah"
        ? "/umrah"
        : type === "combined"
          ? "/combined"
          : "/tours";
  revalidatePath("/");
  revalidatePath(listPath);
  revalidatePath("/profit-loss");
  revalidatePath("/customers");
  if (recordId) revalidatePath(`/records/${recordId}`);
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export async function createCustomer(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) return fail("Customer name is required.");
  try {
    const customer = await getStore().createCustomer({
      name,
      phone: str(formData, "phone") || null,
      cnic_passport: str(formData, "cnic_passport") || null,
    });
    revalidatePath("/customers");
    revalidatePath("/");
    return { ok: true, id: customer.id };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function deleteCustomer(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const customerId = str(formData, "customer_id") || str(formData, "id");
  if (!customerId) return fail("Customer is required.");
  try {
    await getStore().deleteCustomer(customerId);
    revalidatePath("/customers");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function updateCustomer(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const customerId = str(formData, "customer_id") || str(formData, "id");
  if (!customerId) return fail("Customer is required.");
  const name = str(formData, "name");
  if (!name) return fail("Customer name is required.");
  try {
    await getStore().updateCustomer(customerId, {
      name,
      phone: str(formData, "phone") || null,
      cnic_passport: str(formData, "cnic_passport") || null,
    });
    revalidatePath("/customers");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath("/umrah");
    revalidatePath("/combined");
    revalidatePath("/tours");
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------
//
// Form fields (the record pages use these names):
//   customer_id | new_customer_name, new_customer_phone, new_customer_cnic
//   type, total_amount | umrah_amount + ticket_amount (combined),
//   tour_name (tours), next_payment_date (YYYY-MM-DD, optional)

export async function createRecord(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const type = str(formData, "type") as FinanceType;
  if (!FINANCE_TYPES.includes(type)) return fail("Please choose a service type.");

  const nextPaymentDate = str(formData, "next_payment_date");
  if (nextPaymentDate && !isDate(nextPaymentDate)) {
    return fail("Next payment date must be a valid date.");
  }

  try {
    const store = getStore();

    // Customer: existing id OR a new name (created inline).
    let customerId = str(formData, "customer_id");
    if (customerId) {
      const existing = await store.getCustomer(customerId);
      if (!existing) return fail("Selected customer not found.");
    } else {
      const newName = str(formData, "new_customer_name");
      if (!newName) {
        return fail("Choose a customer or enter a new customer name.");
      }
      const created = await store.createCustomer({
        name: newName,
        phone: str(formData, "new_customer_phone") || null,
        cnic_passport: str(formData, "new_customer_cnic") || null,
      });
      customerId = created.id;
    }

    if (type === "tour" && !str(formData, "tour_name")) {
      return fail("Tour / city name is required.");
    }

    // Vendor (optional): empty id / cost = none. A chosen vendor must exist.
    const vendorId = str(formData, "vendor_id") || null;
    if (vendorId) {
      const vendor = await store.getVendor(vendorId);
      if (!vendor) return fail("Selected vendor not found.");
    }
    const vendorCostRaw = str(formData, "vendor_cost");
    let vendorCost: number | null = null;
    if (vendorCostRaw) {
      vendorCost = num(formData, "vendor_cost");
      if (!Number.isFinite(vendorCost) || vendorCost < 0) {
        return fail("Vendor cost must be zero or more.");
      }
    }

    if (type === "combined") {
      const umrah = num(formData, "umrah_amount");
      const ticket = num(formData, "ticket_amount");
      if (!Number.isFinite(umrah) || !Number.isFinite(ticket)) {
        return fail("Umrah and ticket amounts must be numbers.");
      }
      if (umrah < 0 || ticket < 0) return fail("Amounts cannot be negative.");
      if (umrah + ticket <= 0) {
        return fail("Combined total must be more than zero.");
      }
      const record = await store.createRecord({
        customer_id: customerId,
        type,
        total_amount: umrah + ticket,
        umrah_amount: umrah,
        ticket_amount: ticket,
        next_payment_date: nextPaymentDate || null,
        vendor_id: vendorId,
        vendor_reference: str(formData, "vendor_reference") || null,
        vendor_cost: vendorCost,
      });
      revalidateRecordPages(type, record.id);
      return { ok: true, id: record.id };
    }

    const total = num(formData, "total_amount");
    if (!Number.isFinite(total) || total <= 0) {
      return fail("Total amount must be more than zero.");
    }
    const record = await store.createRecord({
      customer_id: customerId,
      type,
      tour_name: type === "tour" ? str(formData, "tour_name") : null,
      total_amount: total,
      next_payment_date: nextPaymentDate || null,
      vendor_id: vendorId,
      vendor_reference: str(formData, "vendor_reference") || null,
      vendor_cost: vendorCost,
    });
    revalidateRecordPages(type, record.id);
    return { ok: true, id: record.id };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function addPayment(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const recordId = str(formData, "finance_record_id") || str(formData, "record_id");
  if (!recordId) return fail("Record is required.");
  const amount = num(formData, "amount");
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Payment amount must be more than zero.");
  }
  const paymentDate = str(formData, "payment_date") || todayPKT();
  if (!isDate(paymentDate)) return fail("Payment date must be a valid date.");
  const method = str(formData, "method") as PaymentMethod;
  if (method && !PAYMENT_METHODS.includes(method)) {
    return fail("Please choose a valid payment method.");
  }
  try {
    const store = getStore();
    const record = await store.getRecord(recordId);
    if (!record) return fail("Record not found.");
    // The store throws on overpayment — surface its message as-is.
    const payment = await store.addPayment({
      finance_record_id: recordId,
      amount,
      payment_date: paymentDate,
      method: method || null,
      reference: str(formData, "reference") || null,
      note: str(formData, "note") || null,
    });
    revalidateRecordPages(record.type, recordId);
    return { ok: true, id: payment.id };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function voidPayment(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const paymentId = str(formData, "payment_id") || str(formData, "id");
  if (!paymentId) return fail("Payment is required.");
  const reason = str(formData, "reason") || str(formData, "void_reason");
  if (!reason) return fail("A reason is required to void a payment.");
  try {
    const store = getStore();
    const all = await store.listPayments();
    const payment = all.find((p) => p.id === paymentId);
    if (!payment) return fail("Payment not found.");
    await store.voidPayment(paymentId, reason);
    const record = await store.getRecord(payment.finance_record_id);
    if (record) revalidateRecordPages(record.type, record.id);
    else {
      revalidatePath("/");
      revalidatePath("/profit-loss");
    }
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function updateDueDate(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const recordId = str(formData, "finance_record_id") || str(formData, "record_id");
  if (!recordId) return fail("Record is required.");
  const date = str(formData, "next_payment_date");
  if (date && !isDate(date)) return fail("Date must be a valid date.");
  try {
    const store = getStore();
    const record = await store.updateRecordDueDate(recordId, date || null);
    revalidateRecordPages(record.type, record.id);
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

/**
 * Delete a record. The store refuses when the record has received
 * payments — that message is surfaced as-is. `return_to` (record
 * detail page only) sends the user back to the record's list after a
 * successful delete; only in-app list paths are accepted.
 */
export async function deleteRecord(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const recordId = str(formData, "finance_record_id") || str(formData, "record_id");
  if (!recordId) return fail("Record is required.");
  try {
    const store = getStore();
    const record = await store.getRecord(recordId);
    if (!record) return fail("Record not found.");
    await store.deleteRecord(recordId);
    revalidateRecordPages(record.type, recordId);
    const returnTo = str(formData, "return_to");
    const allowed = [
      "/",
      "/tickets",
      "/umrah",
      "/combined",
      "/tours",
      "/customers",
      "/expenses",
      "/profit-loss",
    ];
    if (returnTo && allowed.includes(returnTo)) redirect(returnTo);
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function updateRecord(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const recordId =
    str(formData, "record_id") || str(formData, "finance_record_id");
  if (!recordId) return fail("Record is required.");
  const nextPaymentDate = str(formData, "next_payment_date");
  if (nextPaymentDate && !isDate(nextPaymentDate)) {
    return fail("Next payment date must be a valid date.");
  }
  try {
    const store = getStore();
    const record = await store.getRecord(recordId);
    if (!record) return fail("Record not found.");
    const customerId = str(formData, "customer_id");
    if (customerId) {
      const existing = await store.getCustomer(customerId);
      if (!existing) return fail("Selected customer not found.");
    }
    if (record.type === "tour" && !str(formData, "tour_name")) {
      return fail("Tour / city name is required.");
    }
    // Vendor fields: only applied when the form sends them, so older
    // edit forms without vendor inputs never wipe vendor data.
    // Empty id / cost = none; a chosen vendor must exist.
    const vendorPatch: {
      vendor_id?: string | null;
      vendor_reference?: string | null;
      vendor_cost?: number | null;
    } = {};
    if (formData.has("vendor_id")) {
      const vendorId = str(formData, "vendor_id") || null;
      if (vendorId) {
        const vendor = await store.getVendor(vendorId);
        if (!vendor) return fail("Selected vendor not found.");
      }
      vendorPatch.vendor_id = vendorId;
    }
    if (formData.has("vendor_reference")) {
      vendorPatch.vendor_reference = str(formData, "vendor_reference") || null;
    }
    if (formData.has("vendor_cost")) {
      const vendorCostRaw = str(formData, "vendor_cost");
      if (vendorCostRaw) {
        const vendorCost = num(formData, "vendor_cost");
        if (!Number.isFinite(vendorCost) || vendorCost < 0) {
          return fail("Vendor cost must be zero or more.");
        }
        vendorPatch.vendor_cost = vendorCost;
      } else {
        vendorPatch.vendor_cost = null;
      }
    }
    let updated;
    if (record.type === "combined") {
      const umrah = num(formData, "umrah_amount");
      const ticket = num(formData, "ticket_amount");
      if (!Number.isFinite(umrah) || !Number.isFinite(ticket)) {
        return fail("Umrah and ticket amounts must be numbers.");
      }
      updated = await store.updateRecord(recordId, {
        customer_id: customerId || undefined,
        umrah_amount: umrah,
        ticket_amount: ticket,
        next_payment_date: nextPaymentDate || null,
        ...vendorPatch,
      });
    } else {
      const total = num(formData, "total_amount");
      if (!Number.isFinite(total)) {
        return fail("Total amount must be a number.");
      }
      updated = await store.updateRecord(recordId, {
        customer_id: customerId || undefined,
        tour_name:
          record.type === "tour" ? str(formData, "tour_name") : undefined,
        total_amount: total,
        next_payment_date: nextPaymentDate || null,
        ...vendorPatch,
      });
    }
    revalidateRecordPages(updated.type, updated.id);
    return { ok: true, id: updated.id };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

export async function createVendor(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) return fail("Vendor name is required.");
  try {
    const vendor = await getStore().createVendor({
      name,
      company_name: str(formData, "company_name") || null,
      phone: str(formData, "phone") || null,
    });
    revalidatePath("/vendors");
    revalidatePath("/");
    return { ok: true, id: vendor.id };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function deleteVendor(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const vendorId = str(formData, "vendor_id") || str(formData, "id");
  if (!vendorId) return fail("Vendor is required.");
  try {
    await getStore().deleteVendor(vendorId);
    revalidatePath("/vendors");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function updateVendor(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const vendorId = str(formData, "vendor_id") || str(formData, "id");
  if (!vendorId) return fail("Vendor is required.");
  const name = str(formData, "name");
  if (!name) return fail("Vendor name is required.");
  try {
    await getStore().updateVendor(vendorId, {
      name,
      company_name: str(formData, "company_name") || null,
      phone: str(formData, "phone") || null,
    });
    revalidatePath("/vendors");
    revalidatePath("/");
    revalidatePath("/tickets");
    revalidatePath("/umrah");
    revalidatePath("/combined");
    revalidatePath("/tours");
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ---------------------------------------------------------------------------
// Vendor payments
// ---------------------------------------------------------------------------

export async function addVendorPayment(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const recordId = str(formData, "finance_record_id") || str(formData, "record_id");
  if (!recordId) return fail("Record is required.");
  const amount = num(formData, "amount");
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Vendor payment amount must be more than zero.");
  }
  const paymentDate = str(formData, "payment_date") || todayPKT();
  if (!isDate(paymentDate)) return fail("Payment date must be a valid date.");
  const method = str(formData, "method") as PaymentMethod;
  if (method && !PAYMENT_METHODS.includes(method)) {
    return fail("Please choose a valid payment method.");
  }
  try {
    const store = getStore();
    const record = await store.getRecord(recordId);
    if (!record) return fail("Record not found.");
    // The store throws when the record has no vendor / no vendor cost,
    // and on overpayment — surface its message as-is.
    const payment = await store.addVendorPayment({
      finance_record_id: recordId,
      amount,
      payment_date: paymentDate,
      method: method || null,
      reference: str(formData, "reference") || null,
      note: str(formData, "note") || null,
    });
    revalidateRecordPages(record.type, recordId);
    revalidatePath("/vendors");
    // revalidatePath("/vendors") only refreshes the list page — the
    // vendor's own detail page needs its literal path too, or its
    // totals stay stale after paying from that page.
    if (record.vendor_id) revalidatePath(`/vendors/${record.vendor_id}`);
    return { ok: true, id: payment.id };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function voidVendorPayment(
  formData: FormData,
): Promise<ActionResult> {
  await requireAdmin();
  const paymentId = str(formData, "vendor_payment_id") || str(formData, "id");
  if (!paymentId) return fail("Vendor payment is required.");
  const reason = str(formData, "reason") || str(formData, "void_reason");
  if (!reason) return fail("A reason is required to void a vendor payment.");
  try {
    const store = getStore();
    const all = await store.listVendorPayments();
    const payment = all.find((p) => p.id === paymentId);
    if (!payment) return fail("Vendor payment not found.");
    await store.voidVendorPayment(paymentId, reason);
    const record = await store.getRecord(payment.finance_record_id);
    if (record) revalidateRecordPages(record.type, record.id);
    revalidatePath("/vendors");
    revalidatePath(`/vendors/${payment.vendor_id}`);
    revalidatePath("/profit-loss");
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function addExpense(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = str(formData, "name");
  if (!name) return fail("Expense name is required.");
  const amount = num(formData, "amount");
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Expense amount must be more than zero.");
  }
  const expenseDate = str(formData, "expense_date") || todayPKT();
  if (!isDate(expenseDate)) return fail("Expense date must be a valid date.");
  const category = str(formData, "category") as ExpenseCategory;
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return fail("Please choose a valid category.");
  }
  try {
    const expense = await getStore().addExpense({
      name,
      amount,
      expense_date: expenseDate,
      category,
      description: str(formData, "description") || null,
    });
    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/profit-loss");
    return { ok: true, id: expense.id };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function deleteExpense(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const expenseId = str(formData, "expense_id") || str(formData, "id");
  if (!expenseId) return fail("Expense is required.");
  try {
    await getStore().deleteExpense(expenseId);
    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/profit-loss");
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}

export async function updateExpense(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const expenseId = str(formData, "expense_id") || str(formData, "id");
  if (!expenseId) return fail("Expense is required.");
  const name = str(formData, "name");
  if (!name) return fail("Expense name is required.");
  const amount = num(formData, "amount");
  if (!Number.isFinite(amount) || amount <= 0) {
    return fail("Expense amount must be more than zero.");
  }
  const expenseDate = str(formData, "expense_date") || todayPKT();
  if (!isDate(expenseDate)) return fail("Expense date must be a valid date.");
  const category = str(formData, "category") as ExpenseCategory;
  if (!EXPENSE_CATEGORIES.includes(category)) {
    return fail("Please choose a valid category.");
  }
  try {
    await getStore().updateExpense(expenseId, {
      name,
      amount,
      expense_date: expenseDate,
      category,
      description: str(formData, "description") || null,
    });
    revalidatePath("/expenses");
    revalidatePath("/");
    revalidatePath("/profit-loss");
    return { ok: true };
  } catch (err) {
    return fail(errorMessage(err));
  }
}
