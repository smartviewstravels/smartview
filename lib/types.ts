// Shared types for TT Travel & Tour Finance.
// Field names match the SQL setup file (tt-travel-finance-setup.sql) exactly.

export type FinanceType = "ticket" | "umrah" | "combined" | "tour";

export type PaymentMethod = "Cash" | "Bank Transfer" | "Other";

export type ExpenseCategory =
  | "Office"
  | "Transport"
  | "Marketing"
  | "Staff"
  | "Other";

export const FINANCE_TYPES: FinanceType[] = [
  "ticket",
  "umrah",
  "combined",
  "tour",
];

export const FINANCE_TYPE_LABELS: Record<FinanceType, string> = {
  ticket: "Ticket",
  umrah: "Umrah",
  combined: "Umrah + Ticket",
  tour: "Tour",
};

export const PAYMENT_METHODS: PaymentMethod[] = [
  "Cash",
  "Bank Transfer",
  "Other",
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Office",
  "Transport",
  "Marketing",
  "Staff",
  "Other",
];

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  cnic_passport: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceRecord {
  id: string;
  customer_id: string;
  type: FinanceType;
  /** Tour / city name. Only used when type = 'tour'. */
  tour_name: string | null;
  total_amount: number;
  /** Umrah component. Only used when type = 'combined'. */
  umrah_amount: number | null;
  /** Ticket component. Only used when type = 'combined'. */
  ticket_amount: number | null;
  /** YYYY-MM-DD. One next payment date per record. */
  next_payment_date: string | null;
  status: "open" | "paid";
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  finance_record_id: string;
  amount: number;
  /** YYYY-MM-DD */
  payment_date: string;
  method: PaymentMethod | null;
  reference: string | null;
  note: string | null;
  status: "active" | "voided";
  void_reason: string | null;
  voided_at: string | null;
  created_at: string;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  /** YYYY-MM-DD */
  expense_date: string;
  category: ExpenseCategory;
  description: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

/** A finance record joined with its customer, payments and computed figures. */
export interface RecordWithTotals extends FinanceRecord {
  customer: Customer;
  payments: Payment[];
  received: number;
  pending: number;
}

export interface TypeTotals {
  received: number;
  pending: number;
  count: number;
}

export interface Totals {
  totalReceived: number;
  totalPending: number;
  totalExpenses: number;
  profit: number;
  byType: Record<FinanceType, TypeTotals>;
}

export interface ReminderItem {
  record: FinanceRecord;
  customer: Customer;
  pending: number;
  next_payment_date: string;
  overdue: boolean;
  /** Days from today to the due date. Negative when overdue. */
  dueInDays: number;
}
