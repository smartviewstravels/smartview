"use client";

import { useActionState } from "react";
import { addExpense } from "@/app/actions/finance";
import { todayPKT } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/types";

type FormState = { ok: boolean; error?: string };

async function submitExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return addExpense(formData);
}

export default function ExpenseForm() {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    submitExpense,
    { ok: false },
  );

  return (
    <form action={formAction}>
      {state.error && <p className="error">{state.error}</p>}
      {state.ok && <p className="success">Expense saved.</p>}
      <div className="form-row">
        <div className="field">
          <label htmlFor="name">Expense name</label>
          <input id="name" name="name" type="text" required placeholder="e.g. Office rent" />
        </div>
        <div className="field">
          <label htmlFor="amount">Amount (PKR)</label>
          <input id="amount" name="amount" type="number" min="1" step="1" required placeholder="0" />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="expense_date">Date</label>
          <input id="expense_date" name="expense_date" type="date" defaultValue={todayPKT()} required />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" defaultValue="Office">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="description">Description (optional)</label>
        <input id="description" name="description" type="text" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Saving..." : "Add expense"}
      </button>
    </form>
  );
}
