"use client";

import { useState } from "react";
import { updateExpense } from "@/app/actions/finance";
import type { Expense } from "@/lib/types";
import { EXPENSE_CATEGORIES } from "@/lib/types";

/** "Edit" button + modal for one expense, prefilled from the expense. */
export default function EditExpenseForm({ expense }: { expense: Expense }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData): Promise<void> {
    setPending(true);
    setError(null);
    const result = await updateExpense(formData);
    setPending(false);
    if (result.ok) setOpen(false);
    else setError(result.error ?? "Could not save the expense.");
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-small"
        onClick={() => setOpen(true)}
      >
        Edit
      </button>

      {open && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-box">
            <div className="modal-head">
              <h2>Edit expense</h2>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>

            {error && <p className="error">{error}</p>}

            <form action={handleSubmit}>
              <input type="hidden" name="expense_id" value={expense.id} />

              <div className="field">
                <label htmlFor={`edit-exp-name-${expense.id}`}>
                  Expense name
                </label>
                <input
                  id={`edit-exp-name-${expense.id}`}
                  name="name"
                  type="text"
                  required
                  defaultValue={expense.name}
                />
              </div>

              <div className="form-row">
                <div className="field">
                  <label htmlFor={`edit-exp-amount-${expense.id}`}>
                    Amount (PKR)
                  </label>
                  <input
                    id={`edit-exp-amount-${expense.id}`}
                    name="amount"
                    type="number"
                    min="1"
                    step="1"
                    required
                    defaultValue={expense.amount}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`edit-exp-date-${expense.id}`}>Date</label>
                  <input
                    id={`edit-exp-date-${expense.id}`}
                    name="expense_date"
                    type="date"
                    required
                    defaultValue={expense.expense_date}
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor={`edit-exp-cat-${expense.id}`}>Category</label>
                <select
                  id={`edit-exp-cat-${expense.id}`}
                  name="category"
                  required
                  defaultValue={expense.category}
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor={`edit-exp-desc-${expense.id}`}>
                  Description (optional)
                </label>
                <input
                  id={`edit-exp-desc-${expense.id}`}
                  name="description"
                  type="text"
                  defaultValue={expense.description ?? ""}
                />
              </div>

              <button type="submit" className="btn btn-primary" disabled={pending}>
                {pending ? "Saving..." : "Save changes"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
