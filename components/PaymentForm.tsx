"use client";

import { useActionState } from "react";
import { addPayment } from "@/app/actions/finance";
import { formatPKR, todayPKT } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/types";

type FormState = { ok: boolean; error?: string };

async function submitPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return addPayment(formData);
}

interface PaymentFormProps {
  recordId: string;
  pending: number;
}

/** Add-payment form. Shows the remaining balance so the user knows the max. */
export default function PaymentForm({ recordId, pending }: PaymentFormProps) {
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    submitPayment,
    { ok: false },
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="finance_record_id" value={recordId} />
      {state.error && <p className="error">{state.error}</p>}
      {state.ok && (
        <p className="success">Payment saved.</p>
      )}
      <p className="note" style={{ marginBottom: 12 }}>
        Remaining balance: {formatPKR(pending)}. A payment cannot be more
        than this amount.
      </p>
      <div className="form-row">
        <div className="field">
          <label htmlFor="amount">Amount (PKR)</label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="1"
            max={pending}
            step="1"
            required
            placeholder="0"
          />
        </div>
        <div className="field">
          <label htmlFor="payment_date">Payment date</label>
          <input
            id="payment_date"
            name="payment_date"
            type="date"
            defaultValue={todayPKT()}
            required
          />
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <label htmlFor="method">Method</label>
          <select id="method" name="method" defaultValue="Cash">
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="reference">Reference (optional)</label>
          <input id="reference" name="reference" type="text" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="note">Note (optional)</label>
        <input id="note" name="note" type="text" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={isPending || pending <= 0}>
        {isPending ? "Saving..." : "Add payment"}
      </button>
      {pending <= 0 && (
        <p className="note" style={{ marginTop: 8 }}>
          This record is fully paid.
        </p>
      )}
    </form>
  );
}
